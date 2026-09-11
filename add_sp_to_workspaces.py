"""
add_sp_to_workspaces.py
-----------------------
Automates adding your Service Principal (Fabric-Job-Monitoring-App)
as a 'Viewer' across all Microsoft Fabric workspaces in your tenant.

Usage:
  python add_sp_to_workspaces.py
"""

import json
import time
import urllib.request
import urllib.parse
import urllib.error

TENANT_ID = "f45de27c-093c-413b-be2d-a2a92f98cf24"
SP_ENTERPRISE_OBJECT_ID = "22dd7329-500a-42ba-9ad6-64508eb6fec9"  # Fabric-Job-Monitoring-App Enterprise Object ID
SP_CLIENT_ID = "1d625bc8-fbc9-4c3d-b0ac-407eafd69429"             # Application (Client) ID
AZURE_CLI_CLIENT_ID = "04b07795-8ddb-461a-bbee-02f9e1bf7b46"

def get_admin_token_via_device_code():
    print("=" * 70)
    print("  Microsoft Fabric Admin Authentication")
    print("=" * 70)

    # 1. Request Device Code
    device_url = f"https://login.microsoftonline.com/{TENANT_ID}/oauth2/v2.0/devicecode"
    data = urllib.parse.urlencode({
        "client_id": AZURE_CLI_CLIENT_ID,
        "scope": "https://api.fabric.microsoft.com/.default offline_access"
    }).encode("utf-8")

    req = urllib.request.Request(device_url, data=data, method="POST")
    with urllib.request.urlopen(req) as resp:
        device_resp = json.loads(resp.read().decode())

    user_code = device_resp["user_code"]
    device_code = device_resp["device_code"]
    verification_uri = device_resp.get("verification_uri", "https://microsoft.com/devicelogin")
    interval = device_resp.get("interval", 5)
    expires_in = device_resp.get("expires_in", 900)

    print("\n--- ACTION REQUIRED ---")
    print(f"1. Open your browser to: {verification_uri}")
    print(f"2. Enter this code:      {user_code}")
    print("3. Sign in with your Fabric Administrator account.\n")
    print("Waiting for sign-in...", end="", flush=True)

    # 2. Poll for token
    token_url = f"https://login.microsoftonline.com/{TENANT_ID}/oauth2/v2.0/token"
    poll_data = urllib.parse.urlencode({
        "grant_type": "urn:ietf:params:oauth:grant-type:device_code",
        "client_id": AZURE_CLI_CLIENT_ID,
        "device_code": device_code
    }).encode("utf-8")

    start_time = time.time()
    while time.time() - start_time < expires_in:
        time.sleep(interval)
        poll_req = urllib.request.Request(token_url, data=poll_data, method="POST")
        try:
            with urllib.request.urlopen(poll_req) as resp:
                token_res = json.loads(resp.read().decode())
                print("\n\n[SUCCESS] Authentication successful!\n")
                return token_res["access_token"]
        except urllib.error.HTTPError as e:
            err = json.loads(e.read().decode())
            err_code = err.get("error")
            if err_code == "authorization_pending":
                print(".", end="", flush=True)
                continue
            elif err_code == "slow_down":
                time.sleep(interval + 5)
                continue
            else:
                print(f"\n[FAILED] Login failed: {err.get('error_description')}")
                return None

    print("\n[TIMEOUT] Device code timed out. Please run the script again.")
    return None

def add_sp_to_all_workspaces(admin_token):
    headers = {
        "Authorization": f"Bearer {admin_token}",
        "Content-Type": "application/json"
    }

    # 1. Fetch all workspaces in the tenant
    print("Fetching workspaces across your tenant...")
    workspaces = []

    # Try tenant-wide admin endpoint first
    admin_req = urllib.request.Request("https://api.fabric.microsoft.com/v1/admin/workspaces", headers=headers, method="GET")
    try:
        with urllib.request.urlopen(admin_req) as resp:
            data = json.loads(resp.read().decode())
            workspaces = data.get("workspaces", [])
            print(f"Discovered {len(workspaces)} workspace(s) via Tenant Admin API.")
    except Exception:
        # Fall back to standard workspaces endpoint
        std_req = urllib.request.Request("https://api.fabric.microsoft.com/v1/workspaces", headers=headers, method="GET")
        try:
            with urllib.request.urlopen(std_req) as resp:
                data = json.loads(resp.read().decode())
                workspaces = data.get("value", [])
                print(f"Discovered {len(workspaces)} workspace(s) via Standard Workspaces API.")
        except Exception as e:
            print(f"[ERROR] Failed to fetch workspaces: {e}")
            return

    if not workspaces:
        print("No workspaces found under this account.")
        return

    # 2. Add SP to each shared workspace as Viewer
    success_count = 0
    skipped_count = 0

    for ws in workspaces:
        ws_id = ws.get("id")
        ws_name = ws.get("name") or ws.get("displayName", "Unnamed Workspace")
        ws_type = ws.get("type", "")

        # Skip personal sandboxes and system monitoring workspaces
        if ws_type.lower() in ("personal", "adminmonitoring") or ws_name.lower() in ("my workspace", "admin monitoring", "microsoft fabric capacity metrics"):
            print(f"  [SKIPPED] {ws_name} (Personal/System workspace)")
            skipped_count += 1
            continue

        # Strategy 1: Power BI Tenant Admin API (allows adding to ANY workspace in the tenant)
        admin_add_url = f"https://api.powerbi.com/v1.0/myorg/admin/groups/{ws_id}/users"
        admin_payload = json.dumps({
            "identifier": SP_ENTERPRISE_OBJECT_ID,
            "principalType": "App",
            "groupUserAccessRight": "Viewer"
        }).encode("utf-8")

        assigned = False
        try:
            req_admin = urllib.request.Request(admin_add_url, data=admin_payload, headers=headers, method="POST")
            with urllib.request.urlopen(req_admin) as resp:
                print(f"  [ADDED via Tenant Admin] {ws_name} ({ws_id})")
                success_count += 1
                assigned = True
        except urllib.error.HTTPError as e_admin:
            if e_admin.code in (200, 201):
                print(f"  [ADDED via Tenant Admin] {ws_name} ({ws_id})")
                success_count += 1
                assigned = True
            elif e_admin.code == 409:
                print(f"  [ALREADY EXISTS] {ws_name}")
                success_count += 1
                assigned = True

        # Strategy 2: Core Fabric Workspace roleAssignments (if Tenant Admin API returned 403/other)
        if not assigned:
            role_url = f"https://api.fabric.microsoft.com/v1/workspaces/{ws_id}/roleAssignments"
            role_payload = json.dumps({
                "principal": {
                    "id": SP_ENTERPRISE_OBJECT_ID,
                    "type": "ServicePrincipal"
                },
                "role": "Viewer"
            }).encode("utf-8")

            req = urllib.request.Request(role_url, data=role_payload, headers=headers, method="POST")
            try:
                with urllib.request.urlopen(req) as resp:
                    print(f"  [ADDED via Core API] {ws_name} ({ws_id})")
                    success_count += 1
            except urllib.error.HTTPError as e:
                if e.code == 409:
                    print(f"  [ALREADY EXISTS] {ws_name}")
                    success_count += 1
                else:
                    err_body = e.read().decode()
                    print(f"  [FAILED] {ws_name}: HTTP {e.code} - {err_body}")
            except Exception as e:
                print(f"  [ERROR] {ws_name}: {e}")

    print("\n" + "=" * 70)
    print(f"  Summary: {success_count} workspace(s) configured successfully ({skipped_count} personal/system skipped).")
    print("=" * 70)

if __name__ == "__main__":
    token = get_admin_token_via_device_code()
    if token:
        add_sp_to_all_workspaces(token)



