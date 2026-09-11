"""
verify_sp_access.py
-------------------
Tests the Service Principal credentials and lists all workspaces
and pipelines it currently has access to.

Usage:
  python verify_sp_access.py
"""

import json
import urllib.request
import urllib.parse
import urllib.error
import sys

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

import os
from pathlib import Path

# Load from .env if present
env_file = Path(__file__).resolve().parent / ".env"
if env_file.exists():
    with open(env_file, "r", encoding="utf-8") as _ef:
        for _line in _ef:
            if "=" in _line and not _line.strip().startswith("#"):
                _k, _v = _line.strip().split("=", 1)
                os.environ.setdefault(_k, _v)

TENANT_ID = os.getenv("AZURE_TENANT_ID")
CLIENT_ID = os.getenv("AZURE_CLIENT_ID")
CLIENT_SECRET = os.getenv("AZURE_CLIENT_SECRET")

def main():
    print("=" * 60)
    print("  Testing Service Principal Access to Microsoft Fabric")
    print("=" * 60)

    # 1. Acquire Token
    token_url = f"https://login.microsoftonline.com/{TENANT_ID}/oauth2/v2.0/token"
    token_data = urllib.parse.urlencode({
        "grant_type": "client_credentials",
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET,
        "scope": "https://api.fabric.microsoft.com/.default"
    }).encode("utf-8")

    req = urllib.request.Request(token_url, data=token_data, method="POST")
    try:
        with urllib.request.urlopen(req) as resp:
            token_json = json.loads(resp.read().decode())
            token = token_json["access_token"]
            print("  [1] OAuth2 Token Acquisition:  SUCCESS")
    except Exception as e:
        print(f"  [1] OAuth2 Token Acquisition:  FAILED ({e})")
        return

    # 2. Query Workspaces
    headers = {"Authorization": f"Bearer {token}"}
    ws_req = urllib.request.Request("https://api.fabric.microsoft.com/v1/workspaces", headers=headers, method="GET")
    try:
        with urllib.request.urlopen(ws_req) as resp:
            ws_json = json.loads(resp.read().decode())
            workspaces = ws_json.get("value", [])
            print(f"  [2] Fabric Workspaces Query:   SUCCESS ({len(workspaces)} workspaces found)")
    except Exception as e:
        print(f"  [2] Fabric Workspaces Query:   FAILED ({e})")
        return

    # 3. List Workspaces and Pipelines
    print("\n" + "-" * 60)
    if not workspaces:
        print("  Notice: No workspaces are assigned to this Service Principal yet.")
        print("  Please add the Service Principal to your workspaces as Viewer.")
    else:
        for ws in workspaces:
            ws_id = ws["id"]
            ws_name = ws["displayName"]
            print(f"\n[WORKSPACE] {ws_name} (ID: {ws_id})")

            # Query pipelines in this workspace
            pipe_url = f"https://api.fabric.microsoft.com/v1/workspaces/{ws_id}/items?type=DataPipeline"
            pipe_req = urllib.request.Request(pipe_url, headers=headers, method="GET")
            try:
                with urllib.request.urlopen(pipe_req) as p_resp:
                    pipes = json.loads(p_resp.read().decode()).get("value", [])
                    print(f"   Pipelines ({len(pipes)}):")
                    for p in pipes:
                        print(f"     └─ [PIPELINE] {p['displayName']} (ID: {p['id']})")
            except Exception as e:
                print(f"   Could not fetch pipelines: {e}")

    print("\n" + "=" * 60)

if __name__ == "__main__":
    main()

