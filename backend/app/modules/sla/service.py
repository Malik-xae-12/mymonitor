import asyncio
import datetime
import email.mime.multipart
import email.mime.text
import json
import logging
import smtplib
from typing import Any, Dict, List, Optional

from app.core.config import settings
from app.modules.sla.schema import IncidentResolveRequest, SlaConfigPayload, TestEmailRequest
from app.modules.sla.repository import sla_repository
from app.modules.websocket.connection_manager import connection_manager
from app.shared.constants import DEFAULT_SLA1_MINUTES, DEFAULT_SLA2_MINUTES

logger = logging.getLogger("fabric_monitor.sla")


class AlertService:
    """Watchdog and alerting service responsible for SLA monitoring, email notifications, and L2 escalations."""

    def __init__(self):
        """Initializes the alert notification service and background watchdog state."""
        self._is_running = False
        self._task: Optional[asyncio.Task] = None

    def start(self) -> None:
        """Start the background SLA incident watchdog timer."""
        if not self._is_running:
            self._is_running = True
            self._task = asyncio.create_task(self._sla_monitor_loop())
            logger.info("AlertService background SLA monitor loop started.")

    def stop(self) -> None:
        """Stop the background SLA incident watchdog timer."""
        self._is_running = False
        if self._task:
            self._task.cancel()
            logger.info("AlertService background SLA monitor loop stopped.")

    def _send_smtp_email_sync(self, to_email: str, subject: str, html_body: str, plain_body: str) -> bool:
        """Synchronously deliver an email notification over SMTP with STARTTLS."""
        if not to_email:
            logger.warning("No recipient email provided for alert.")
            return False

        recipients = [e.strip() for e in to_email.replace(";", ",").split(",") if e.strip()]
        if not recipients:
            logger.warning("No valid recipient email address parsed.")
            return False

        try:
            msg = email.mime.multipart.MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = settings.MAIL_FROM or settings.MAIL_USERNAME
            msg["To"] = ", ".join(recipients)
            msg["Date"] = datetime.datetime.now(datetime.timezone.utc).strftime("%a, %d %b %Y %H:%M:%S +0000")

            part1 = email.mime.text.MIMEText(plain_body, "plain", "utf-8")
            part2 = email.mime.text.MIMEText(html_body, "html", "utf-8")
            msg.attach(part1)
            msg.attach(part2)

            with smtplib.SMTP(settings.MAIL_SERVER, settings.MAIL_PORT, timeout=15) as server:
                if settings.MAIL_STARTTLS:
                    server.starttls()
                if settings.USE_CREDENTIALS:
                    server.login(settings.MAIL_USERNAME, settings.MAIL_PASSWORD)
                server.sendmail(settings.MAIL_FROM or settings.MAIL_USERNAME, recipients, msg.as_string())

            logger.info(f"Successfully sent alert email to {recipients} (Subject: {subject})")
            return True
        except Exception as e:
            logger.error(f"Failed to send alert email to {recipients}: {e}")
            return False

    async def send_email(self, to_email: str, subject: str, html_body: str, plain_body: str) -> bool:
        """Asynchronously dispatch an email notification using a worker thread."""
        return await asyncio.to_thread(self._send_smtp_email_sync, to_email, subject, html_body, plain_body)

    async def process_failed_run(
        self,
        workspace_id: str,
        pipeline_id: str,
        pipeline_name: str,
        pipeline_run_id: str,
        error_info: Optional[Dict[str, Any]] = None,
        failed_at: Optional[str] = None
    ) -> None:
        """Create an SLA tracking incident for a failed pipeline run and dispatch initial L1 alert."""
        existing = await sla_repository.get_active_incident_for_run(pipeline_run_id)
        if existing:
            return

        now_utc = datetime.datetime.now(datetime.timezone.utc)
        failed_time_str = failed_at or now_utc.isoformat()
        try:
            failed_dt = datetime.datetime.fromisoformat(failed_time_str.replace("Z", "+00:00"))
            if failed_dt.tzinfo is None:
                failed_dt = failed_dt.replace(tzinfo=datetime.timezone.utc)
        except Exception:
            failed_dt = now_utc

        sla_cfg = await sla_repository.get_sla_config(workspace_id, pipeline_id)
        sla_minutes = sla_cfg.get("slaMinutes", DEFAULT_SLA1_MINUTES)
        l1_email = sla_cfg.get("l1Email") or settings.MAIL_FROM or settings.MAIL_USERNAME
        target_dt = failed_dt + datetime.timedelta(minutes=sla_minutes)
        sla_target_time = target_dt.isoformat()

        err_msg = "Pipeline execution failed."
        err_code = "PipelineFailure"
        err_target = pipeline_name
        err_type = "UserError"
        raw_error_str = ""

        if error_info and isinstance(error_info, dict):
            err_msg = error_info.get("message") or "Pipeline execution failed."
            err_code = str(error_info.get("errorCode") or "Failed")
            err_target = error_info.get("target") or pipeline_name
            err_type = error_info.get("failureType") or "UserError"
            try:
                raw_error_str = json.dumps(error_info.get("rawError") or error_info, indent=2)
            except Exception:
                raw_error_str = str(error_info)
        elif error_info:
            err_msg = str(error_info)

        incident_id = f"inc_{pipeline_run_id}"
        incident = {
            "id": incident_id,
            "pipelineId": pipeline_id,
            "pipelineName": pipeline_name,
            "pipelineRunId": pipeline_run_id,
            "workspaceId": workspace_id,
            "status": "ACTIVE",
            "failedAt": failed_time_str,
            "slaTargetTime": sla_target_time,
            "l1NotifiedAt": now_utc.isoformat(),
            "l2EscalatedAt": None,
            "resolvedAt": None,
            "resolvedBy": None,
            "errorMessage": f"[{err_code}] {err_msg}",
            "updatedAt": now_utc.isoformat()
        }

        await sla_repository.create_incident(incident)

        subject = f"[CRITICAL L1 ALERT] Pipeline Failure: {pipeline_name} (Code: {err_code})"
        plain_body = f"""
CRITICAL L1 INCIDENT ALERT
============================================================
Pipeline: {pipeline_name}
Target: {err_target}
Run ID: {pipeline_run_id}
Workspace ID: {workspace_id}
Failure Time: {failed_time_str}
SLA Target Resolution Time: {sla_target_time} ({sla_minutes} min window)

ERROR DIAGNOSTICS:
------------------------------------------------------------
Error Code: {err_code}
Failure Type: {err_type}
Message: {err_msg}

RAW LOG TRACE:
{raw_error_str}
============================================================
Dispatched from Microsoft Fabric Real-Time Hub
        """.strip()

        html_body = f"""
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<style>
  body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #090d16; color: #e2e8f0; margin: 0; padding: 24px; }}
  .card {{ max-width: 600px; margin: 0 auto; background: #0f172a; border: 1px solid #dc2626; border-radius: 12px; padding: 24px; box-shadow: 0 10px 25px rgba(220, 38, 38, 0.2); }}
  .badge {{ display: inline-block; background: #dc2626; color: #ffffff; font-weight: bold; font-size: 11px; text-transform: uppercase; padding: 4px 10px; border-radius: 6px; letter-spacing: 0.5px; }}
  .title {{ font-size: 20px; font-weight: 700; color: #ffffff; margin: 12px 0 4px; }}
  .sub {{ font-family: monospace; font-size: 12px; color: #94a3b8; margin-bottom: 20px; }}
  .field {{ margin-bottom: 16px; }}
  .label {{ font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 600; margin-bottom: 4px; }}
  .val {{ font-size: 14px; color: #cbd5e1; font-family: monospace; }}
  .error-box {{ background: rgba(220, 38, 38, 0.1); border: 1px solid rgba(220, 38, 38, 0.3); border-radius: 8px; padding: 12px; color: #fca5a5; font-size: 13px; line-height: 1.5; }}
  .log-box {{ background: #030712; border: 1px solid #1e293b; border-radius: 8px; padding: 12px; font-family: monospace; font-size: 11px; color: #94a3b8; overflow-x: auto; max-height: 200px; }}
  .btn {{ display: inline-block; background: #2563eb; color: #ffffff; text-decoration: none; padding: 10px 20px; border-radius: 8px; font-size: 13px; font-weight: 600; margin-top: 16px; }}
  .footer {{ margin-top: 24px; padding-top: 16px; border-top: 1px solid #1e293b; font-size: 11px; color: #64748b; text-align: center; }}
</style>
</head>
<body>
  <div class="card">
    <div class="badge">Critical L1 Alert</div>
    <h2 class="title">{pipeline_name}</h2>
    <div class="sub">Run ID: {pipeline_run_id}</div>

    <div class="field">
      <div class="label">Failed Component</div>
      <div class="val" style="color: #f87171; font-weight: bold;">{err_target}</div>
    </div>

    <div class="field">
      <div class="label">SLA Target Resolution Time</div>
      <div class="val" style="color: #fbbf24;">{sla_target_time} ({sla_minutes}m window)</div>
    </div>

    <div class="field">
      <div class="label">Error Diagnostics</div>
      <div class="error-box">
        <strong>[{err_code}]</strong> {err_msg}
      </div>
    </div>

    {f'''<div class="field">
      <div class="label">Raw Trace</div>
      <pre class="log-box">{raw_error_str}</pre>
    </div>''' if raw_error_str else ''}

    <div style="text-align: center;">
      <a href="{settings.FRONTEND_URL}" class="btn">Open Fabric Monitoring Dashboard</a>
    </div>

    <div class="footer">
      Microsoft Fabric Real-Time Monitoring Hub • Automated Alert Engine<br/>
      If unresolved before SLA expires ({sla_minutes}m), automatic L2 escalation triggers.
    </div>
  </div>
</body>
</html>
        """.strip()

        sent = await self.send_email(l1_email, subject, html_body, plain_body)
        if sent:
            now_str = datetime.datetime.now(datetime.timezone.utc).isoformat()
            await sla_repository.update_incident(incident_id, {"l1_notified_at": now_str, "updated_at": now_str})
            incident["l1NotifiedAt"] = now_str

        await connection_manager.broadcast_to_workspace(workspace_id, {
            "type": "INCIDENT_CREATED",
            "workspaceId": workspace_id,
            "incident": incident
        })

    async def _sla_monitor_loop(self) -> None:
        """Periodically check for SLA breaches on active incidents and dispatch L2 escalations."""
        while self._is_running:
            try:
                await asyncio.sleep(5.0)
                active_incidents = await sla_repository.get_all_unresolved_incidents()
                now_utc = datetime.datetime.now(datetime.timezone.utc)

                for inc in active_incidents:
                    if inc.get("status") != "ACTIVE":
                        continue

                    sla_target_str = inc.get("sla_target_time")
                    if not sla_target_str:
                        continue

                    try:
                        clean_str = sla_target_str.replace("Z", "+00:00")
                        target_dt = datetime.datetime.fromisoformat(clean_str)
                        if target_dt.tzinfo is None:
                            target_dt = target_dt.replace(tzinfo=datetime.timezone.utc)
                    except Exception:
                        continue

                    if now_utc >= target_dt:
                        inc_id = inc["id"]
                        p_id = inc["pipeline_id"]
                        p_name = inc["pipeline_name"]
                        ws_id = inc["workspace_id"]
                        run_id = inc["pipeline_run_id"]
                        
                        overdue_seconds = int((now_utc - target_dt).total_seconds())
                        overdue_min = overdue_seconds // 60

                        logger.warning(f"SLA BREACHED for incident {inc_id} ({p_name}). Overdue by {overdue_min}m. Escalating to L2!")

                        sla_cfg = await sla_repository.get_sla_config(ws_id, p_id)
                        l2_email = sla_cfg.get("l2Email") or settings.MAIL_FROM or settings.MAIL_USERNAME

                        subject = f"[URGENT L2 ESCALATION - SLA BREACHED] {p_name} is +{overdue_min}m Overdue!"
                        plain_body = f"""
URGENT L2 ESCALATION ALERT - SLA RESOLUTION BREACHED
============================================================
Pipeline: {p_name}
Run ID: {run_id}
Workspace ID: {ws_id}
Failure Time: {inc.get('failed_at')}
SLA Target Was: {sla_target_str}
Breach Overdue Time: +{overdue_min} minutes
Error Summary: {inc.get('error_message')}

This incident has exceeded its SLA resolution window without resolution.
Immediate L2 lead intervention is required!
                        """.strip()

                        html_body = f"""
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<style>
  body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #090d16; color: #e2e8f0; margin: 0; padding: 24px; }}
  .card {{ max-width: 600px; margin: 0 auto; background: #1c0a0a; border: 2px solid #ef4444; border-radius: 12px; padding: 24px; box-shadow: 0 10px 30px rgba(239, 68, 68, 0.3); }}
  .header {{ border-bottom: 1px solid #7f1d1d; padding-bottom: 16px; margin-bottom: 20px; }}
  .badge {{ display: inline-block; background: #dc2626; color: #ffffff; font-weight: bold; font-size: 11px; text-transform: uppercase; padding: 4px 10px; border-radius: 6px; letter-spacing: 0.5px; animation: pulse 2s infinite; }}
  .title {{ font-size: 20px; font-weight: 700; color: #fca5a5; margin: 12px 0 4px; }}
  .sub {{ font-family: monospace; font-size: 12px; color: #94a3b8; }}
  .overdue {{ background: #7f1d1d; color: #fecaca; padding: 8px 12px; border-radius: 6px; font-weight: 700; font-size: 14px; margin-top: 12px; display: inline-block; }}
  .field {{ margin-bottom: 16px; }}
  .label {{ font-size: 11px; text-transform: uppercase; color: #94a3b8; font-weight: 600; margin-bottom: 4px; }}
  .val {{ font-size: 14px; color: #e2e8f0; font-family: monospace; }}
  .error-box {{ background: rgba(0, 0, 0, 0.4); border: 1px solid #991b1b; border-radius: 8px; padding: 12px; color: #fca5a5; font-size: 13px; line-height: 1.5; }}
  .btn {{ display: inline-block; background: #ef4444; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 13px; font-weight: 700; margin-top: 16px; }}
  .footer {{ margin-top: 24px; padding-top: 16px; border-top: 1px solid #7f1d1d; font-size: 11px; color: #94a3b8; text-align: center; }}
</style>
</head>
<body>
  <div class="card">
    <div class="header">
      <span class="badge">L2 Escalation • SLA Breached</span>
      <h2 class="title">{p_name}</h2>
      <div class="sub">Run ID: {run_id}</div>
      <div class="overdue">
        ⚠️ SLA Breach Overdue by: +{overdue_min}m {overdue_seconds % 60}s
      </div>
    </div>

    <div class="field">
      <div class="label">Failure Timestamp (UTC)</div>
      <div class="val">{inc.get('failed_at')}</div>
    </div>

    <div class="field">
      <div class="label">Target SLA Time</div>
      <div class="val" style="color: #f87171; font-weight: bold;">{sla_target_str} (BREACHED)</div>
    </div>

    <div class="field">
      <div class="label">Error Diagnostics</div>
      <div class="error-box">
        {inc.get('error_message') or 'Pipeline execution failed.'}
      </div>
    </div>

    <div style="text-align: center;">
      <a href="{settings.FRONTEND_URL}" class="btn">Take Action in Monitoring Dashboard</a>
    </div>

    <div class="footer">
      Microsoft Fabric Real-Time Monitoring Hub • Automated L2 Escalation System
    </div>
  </div>
</body>
</html>
                        """.strip()

                        await self.send_email(l2_email, subject, html_body, plain_body)

                        now_str = now_utc.isoformat()
                        await sla_repository.update_incident(inc_id, {
                            "status": "ESCALATED_L2",
                            "l2_escalated_at": now_str,
                            "updated_at": now_str
                        })

                        await connection_manager.broadcast_to_workspace(ws_id, {
                            "type": "SLA_BREACHED",
                            "workspaceId": ws_id,
                            "incidentId": inc_id,
                            "pipelineId": p_id,
                            "status": "ESCALATED_L2",
                            "l2EscalatedAt": now_str
                        })

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in SLA monitor loop: {e}", exc_info=True)

    async def resolve_incident(self, incident_id: str, resolved_by: str = "User") -> Optional[Dict[str, Any]]:
        """Acknowledge and mark an SLA failure incident as resolved."""
        now_str = datetime.datetime.now(datetime.timezone.utc).isoformat()
        await sla_repository.update_incident(incident_id, {
            "status": "RESOLVED",
            "resolved_at": now_str,
            "resolved_by": resolved_by,
            "updated_at": now_str
        })

        return {
            "incidentId": incident_id,
            "status": "RESOLVED",
            "resolvedAt": now_str,
            "resolvedBy": resolved_by
        }

    async def rearm_and_notify_l1(self, workspace_id: str, pipeline_id: str, l1_email: str, sla_minutes: int) -> None:
        """Re-arm SLA tracking for a failed pipeline run and dispatch immediate L1 alert email."""
        from app.modules.pipelines.repository import pipeline_repository
        history = await pipeline_repository.get_pipeline_history(workspace_id, pipeline_id)
        if not history:
            return
        latest_run = history[0]
        if str(latest_run.get("status", "")).lower() != "failed":
            return

        run_id = latest_run["id"]
        pipeline_name = latest_run["pipelineName"]
        now_utc = datetime.datetime.now(datetime.timezone.utc)
        target_dt = now_utc + datetime.timedelta(minutes=sla_minutes)
        sla_target_time = target_dt.isoformat()

        err_info = latest_run.get("error")
        err_target = pipeline_name
        if not err_info or not err_info.get("message"):
            for act in latest_run.get("activities", []):
                if act.get("status", "").lower() == "failed" and act.get("error"):
                    err_info = act.get("error")
                    err_target = f"{pipeline_name} → {act.get('activityName')}"
                    break

        err_msg = "Pipeline execution failed."
        err_code = "PipelineFailure"
        raw_error_str = ""
        if err_info and isinstance(err_info, dict):
            err_msg = err_info.get("message") or "Pipeline execution failed."
            err_code = str(err_info.get("errorCode") or "Failed")
            try:
                raw_error_str = json.dumps(err_info.get("rawError") or err_info, indent=2)
            except Exception:
                raw_error_str = str(err_info)

        incident_id = f"inc_{run_id}"
        incident = {
            "id": incident_id,
            "pipelineId": pipeline_id,
            "pipelineName": pipeline_name,
            "pipelineRunId": run_id,
            "workspaceId": workspace_id,
            "status": "ACTIVE",
            "failedAt": latest_run.get("startTime") or now_utc.isoformat(),
            "slaTargetTime": sla_target_time,
            "l1NotifiedAt": now_utc.isoformat(),
            "l2EscalatedAt": None,
            "resolvedAt": None,
            "resolvedBy": None,
            "errorMessage": f"[{err_code}] {err_msg}",
            "updatedAt": now_utc.isoformat()
        }

        await sla_repository.create_incident(incident)

        subject = f"[CRITICAL L1 ALERT] Pipeline Failed: {pipeline_name} (Code: {err_code})"
        plain_body = f"""
CRITICAL L1 INCIDENT ALERT
============================================================
Pipeline: {pipeline_name}
Failed Target / Activity: {err_target}
Run ID: {run_id}
Workspace ID: {workspace_id}
SLA Resolution Window: {sla_minutes} minutes
SLA Breach Target: {sla_target_time}

ERROR DIAGNOSTICS:
------------------------------------------------------------
Error Code: {err_code}
Message: {err_msg}

RAW LOG TRACE:
{raw_error_str}
============================================================
Notification dispatched automatically from {settings.MAIL_FROM or settings.MAIL_USERNAME}
"""
        html_body = f"""
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<style>
  body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #090d16; color: #e2e8f0; margin: 0; padding: 24px; }}
  .card {{ max-width: 600px; margin: 0 auto; background: #0f172a; border: 1px solid #dc2626; border-radius: 12px; padding: 24px; box-shadow: 0 10px 25px rgba(220, 38, 38, 0.2); }}
  .badge {{ display: inline-block; background: #dc2626; color: #ffffff; font-weight: bold; font-size: 11px; text-transform: uppercase; padding: 4px 10px; border-radius: 6px; letter-spacing: 0.5px; }}
  .title {{ font-size: 20px; font-weight: 700; color: #ffffff; margin: 12px 0 4px; }}
  .sub {{ font-family: monospace; font-size: 12px; color: #94a3b8; margin-bottom: 20px; }}
  .field {{ margin-bottom: 16px; }}
  .label {{ font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 600; margin-bottom: 4px; }}
  .val {{ font-size: 14px; color: #cbd5e1; font-family: monospace; }}
  .error-box {{ background: rgba(220, 38, 38, 0.1); border: 1px solid rgba(220, 38, 38, 0.3); border-radius: 8px; padding: 12px; color: #fca5a5; font-size: 13px; line-height: 1.5; }}
  .log-box {{ background: #030712; border: 1px solid #1e293b; border-radius: 8px; padding: 12px; font-family: monospace; font-size: 11px; color: #94a3b8; overflow-x: auto; max-height: 200px; }}
  .footer {{ margin-top: 24px; padding-top: 16px; border-top: 1px solid #1e293b; font-size: 11px; color: #64748b; text-align: center; }}
</style>
</head>
<body>
  <div class="card">
    <div class="badge">Critical L1 Alert</div>
    <h2 class="title">{pipeline_name}</h2>
    <div class="sub">Run ID: {run_id}</div>

    <div class="field">
      <div class="label">Failed Target / Component</div>
      <div class="val" style="color: #f87171; font-weight: bold;">{err_target}</div>
    </div>

    <div class="field">
      <div class="label">SLA Target Resolution Time</div>
      <div class="val" style="color: #fbbf24;">{sla_target_time} ({sla_minutes}m window)</div>
    </div>

    <div class="field">
      <div class="label">Error Diagnostics</div>
      <div class="error-box">
        <strong>[{err_code}]</strong> {err_msg}
      </div>
    </div>

    {f'''<div class="field">
      <div class="label">Raw Trace</div>
      <pre class="log-box">{raw_error_str}</pre>
    </div>''' if raw_error_str else ''}

    <div class="footer">
      Dispatched automatically from {settings.MAIL_FROM or settings.MAIL_USERNAME} • Microsoft Fabric Job Monitor
    </div>
  </div>
</body>
</html>
"""
        await self.send_email(l1_email, subject, html_body, plain_body)
        logger.info(f"Rearmed L1 notification to {l1_email}")

        await connection_manager.broadcast_to_workspace(workspace_id, {
            "type": "INCIDENT_UPDATE",
            "workspaceId": workspace_id,
            "incident": incident
        })

    async def send_test_email(self, to_email: str, role: str, pipeline_name: str) -> bool:
        """Send a test email notification to verify operational alerting deliverability."""
        subject = f"[TEST ALERT] Fabric Monitor - {role} Alerting Verification ({pipeline_name})"
        plain_body = f"""
TEST NOTIFICATION DISPATCHED
============================================================
This is a test notification from Microsoft Fabric Job Monitor.
Sender: {settings.MAIL_FROM or settings.MAIL_USERNAME}
Configured Role: {role}
Target Pipeline: {pipeline_name}
Status: System verified. When an SLA incident triggers or breaches, you will receive real-time failure diagnostics here.
Timestamp (UTC): {datetime.datetime.now(datetime.timezone.utc).isoformat()}
============================================================
"""
        html_body = f"""
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<style>
  body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #090d16; color: #e2e8f0; margin: 0; padding: 24px; }}
  .card {{ max-width: 550px; margin: 0 auto; background: #0f172a; border: 1px solid #3b82f6; border-radius: 12px; padding: 24px; box-shadow: 0 10px 25px rgba(59, 130, 246, 0.2); }}
  .badge {{ display: inline-block; background: #2563eb; color: #ffffff; font-weight: bold; font-size: 11px; text-transform: uppercase; padding: 4px 10px; border-radius: 6px; letter-spacing: 0.5px; }}
  .title {{ font-size: 18px; font-weight: 700; color: #ffffff; margin: 12px 0 4px; }}
  .desc {{ color: #94a3b8; font-size: 13px; line-height: 1.6; margin-top: 10px; }}
  .footer {{ margin-top: 24px; padding-top: 16px; border-top: 1px solid #1e293b; font-size: 11px; color: #64748b; text-align: center; }}
</style>
</head>
<body>
  <div class="card">
    <div class="badge">{role} Alerting Verified</div>
    <h2 class="title">Test Notification Received</h2>
    <p class="desc">
      Your email address has been successfully verified for <strong>{pipeline_name}</strong> {role} alerts.
      When failures occur or SLA breaches, automated diagnostic reports will be delivered here from <strong>{settings.MAIL_FROM or settings.MAIL_USERNAME}</strong>.
    </p>
    <div class="footer">
      Dispatched from {settings.MAIL_FROM or settings.MAIL_USERNAME} • Microsoft Fabric Real-Time Hub
    </div>
  </div>
</body>
</html>
"""
        return await self.send_email(to_email, subject, html_body, plain_body)


class SlaService:
    """Service providing high-level operations for SLA thresholds, incidents, and test dispatches."""

    def __init__(self, alert_mgr: AlertService):
        """Initializes the SLA service with repository and notification service references."""
        self._alert = alert_mgr

    async def get_sla_config(self, workspace_id: str, pipeline_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve SLA configuration and email assignees for a pipeline."""
        return await sla_repository.get_sla_config(workspace_id, pipeline_id)

    async def save_sla_config(self, workspace_id: str, pipeline_id: str, payload: SlaConfigPayload) -> Dict[str, Any]:
        """Save SLA 1 and SLA 2 thresholds and assignee contact details for a pipeline."""
        now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
        sla1 = payload.sla1Minutes if payload.sla1Minutes is not None else (payload.slaMinutes or DEFAULT_SLA1_MINUTES)
        sla2 = payload.sla2Minutes if payload.sla2Minutes is not None else (payload.slaMinutes or DEFAULT_SLA2_MINUTES)
        l1_email = (payload.l1Email or "").strip()
        l2_email = (payload.l2Email or "").strip()
        l1_name = (payload.l1Name or "").strip()
        l2_name = (payload.l2Name or "").strip()

        await sla_repository.save_sla_config(
            workspace_id=workspace_id,
            pipeline_id=pipeline_id,
            l1_email=l1_email,
            l2_email=l2_email,
            l1_name=l1_name,
            l2_name=l2_name,
            sla_minutes=sla1,
            updated_at=now_iso,
            sla1_minutes=sla1,
            sla2_minutes=sla2,
        )

        try:
            from app.modules.users.service import users_service
            await users_service.ensure_assignment_users(l1_email, l2_email)
        except Exception as exc:
            logger.warning(f"Could not record user roles for SLA config: {exc}")

        asyncio.create_task(self._alert.rearm_and_notify_l1(
            workspace_id=workspace_id,
            pipeline_id=pipeline_id,
            l1_email=l1_email,
            sla_minutes=sla1,
        ))

        return {
            "status": "success",
            "pipelineId": pipeline_id,
            "l1Email": l1_email,
            "l1Name": l1_name,
            "l2Email": l2_email,
            "l2Name": l2_name,
            "slaMinutes": sla1,
            "sla1Minutes": sla1,
            "sla2Minutes": sla2,
        }

    async def get_workspace_incidents(self, workspace_id: str) -> List[Dict[str, Any]]:
        """Retrieve active and escalated SLA incidents for a specific workspace."""
        return await sla_repository.get_active_incidents(workspace_id)

    async def get_all_incidents(self) -> List[Dict[str, Any]]:
        """Retrieve all unresolved SLA incidents across the tenant."""
        return await sla_repository.get_active_incidents()

    async def resolve_incident(self, incident_id: str, resolved_by: str = "Operator", workspace_id: Optional[str] = None) -> Dict[str, Any]:
        """Mark an incident as resolved and broadcast update over WebSocket."""
        result = await self._alert.resolve_incident(incident_id, resolved_by=resolved_by)
        if workspace_id:
            await connection_manager.broadcast_to_workspace(workspace_id, {
                "type": "INCIDENT_RESOLVED",
                "workspaceId": workspace_id,
                "incidentId": incident_id,
                "resolvedBy": resolved_by,
                "resolvedAt": result.get("resolvedAt") if isinstance(result, dict) else None,
            })
        return result

    async def send_test_email(self, payload: TestEmailRequest) -> bool:
        """Trigger a test verification email to confirm email address deliverability."""
        return await self._alert.send_test_email(
            to_email=payload.email.strip(),
            role=payload.role,
            pipeline_name=payload.pipelineName or "Data Pipeline",
        )


alert_service = AlertService()
sla_service = SlaService(alert_mgr=alert_service)
