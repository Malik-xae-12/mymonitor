import json
import urllib.request
import urllib.parse
from verify_sp_access import TENANT_ID, CLIENT_ID, CLIENT_SECRET

token_data = urllib.parse.urlencode({
    'grant_type': 'client_credentials',
    'client_id': CLIENT_ID,
    'client_secret': CLIENT_SECRET,
    'scope': 'https://api.fabric.microsoft.com/.default'
}).encode('utf-8')

req = urllib.request.Request(f'https://login.microsoftonline.com/{TENANT_ID}/oauth2/v2.0/token', data=token_data, method='POST')
with urllib.request.urlopen(req) as r:
    token = json.loads(r.read().decode())['access_token']

headers = {'Authorization': f'Bearer {token}'}
ws_id = '4d19f1c8-9ab6-4c40-99c4-62803626edbd'
pipe_url = f'https://api.fabric.microsoft.com/v1/workspaces/{ws_id}/items?type=DataPipeline'

with urllib.request.urlopen(urllib.request.Request(pipe_url, headers=headers)) as r:
    pipes = json.loads(r.read().decode()).get('value', [])

print(f"Total Pipelines: {len(pipes)}")
for p in pipes:
    pid = p['id']
    name = p['displayName']
    job_url = f'https://api.fabric.microsoft.com/v1/workspaces/{ws_id}/items/{pid}/jobs/instances'
    try:
        with urllib.request.urlopen(urllib.request.Request(job_url, headers=headers)) as jr:
            instances = json.loads(jr.read().decode()).get('value', [])
            print(f"\n[PIPELINE] {name} ({pid}) - {len(instances)} run(s)")
            for inst in instances:
                print(f"   ├─ Run ID: {inst.get('id')}")
                print(f"   ├─ Status: {inst.get('status')}")
                print(f"   ├─ Start:  {inst.get('startTime')}")
                print(f"   └─ End:    {inst.get('endTime')}")
    except Exception as e:
        print(f"Error querying {name}: {e}")

