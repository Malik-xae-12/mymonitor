# Security Controls

**Last Updated:** 2026-09-23

---

## 1. Secret Management
- All credentials live in `.env` (root) — never committed. See `.env.example` for keys.
- Secrets in use: Azure Service Principal (`AZURE_TENANT_ID`, `AZURE_CLIENT_ID`,
  `AZURE_CLIENT_SECRET`), `GEMINI_API_KEY`, Gmail SMTP (`MAIL_USERNAME`, `MAIL_PASSWORD`).
- Ensure `.env` is listed in `.gitignore`.

## 2. Authentication & Authorization
- **Microsoft Entra ID (Azure AD)** sign-in via MSAL (SPA). App registration:
  client `25ad11d7-5885-4f0e-8424-919bf02e04eb`, tenant `008502d6-3f79-46f0-ab37-9354e3fe80ff`.
- **Redirect URI** `http://localhost:3000` (dev) must be registered as a SPA redirect in Entra ID.
- Backend validates the Entra ID **ID token** (audience = client id, issuer = tenant) using the
  Entra **JWKS** endpoint (`PyJWT[crypto]`). Tokens are never trusted without signature + claim checks.
- **RBAC**: `ADMIN_EMAILS` bootstrap admins; L1/L2 derived from `workspace_assignments`.
  Admin-only routes guarded by `require_admin`; data scoped to assigned workspaces.
- The Fabric Service Principal (`AZURE_CLIENT_SECRET`) is **backend-only** and never exposed
  to the browser. It should hold least privilege (`Viewer`) on Fabric workspaces.

## 3. Input Validation
- All API request bodies validated via Pydantic V2 at the boundary (`app/models/`).
- Guard against malformed Fabric / Gemini / SMTP responses (missing/typed fields).

## 4. External Service Hardening
- **Fabric REST**: throttled via `rate_limiter` (asyncio.Semaphore) to respect rate limits.
- **Gmail SMTP**: STARTTLS on port 587, `VALIDATE_CERTS=True`. Use a Gmail App Password,
  not the account password.
- **Gemini**: only error text is sent for analysis; avoid sending secrets/PII in payloads.

## 5. Data at Rest
- SQLite DB (`backend/data/fabric_monitor.db`) stores run telemetry and cached diagnostics.
  Protect the host filesystem; the DB may contain workspace/pipeline names and error text.

## 6. OWASP Considerations
- Injection: parameterized SQLite queries only (no string-built SQL).
- Sensitive data exposure: no secrets in logs, code, or client bundle.
- Security misconfiguration: bind backend to `127.0.0.1` in dev; front it with a
  hardened reverse proxy in production.
