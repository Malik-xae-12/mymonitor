import pyodbc, os
from pathlib import Path

env_file = Path('.env')
if env_file.exists():
    for line in open(env_file):
        if '=' in line and not line.strip().startswith('#'):
            k, v = line.strip().split('=', 1)
            os.environ.setdefault(k, v)

server = '2ybikadzh7yenkzxsnkoh7ua74-5dxahqitgouelpe64javee2vsi.datawarehouse.fabric.microsoft.com'
cid = os.getenv("AZURE_CLIENT_ID")
cpw = os.getenv("AZURE_CLIENT_SECRET")
conn_str = f'Driver={{ODBC Driver 18 for SQL Server}};Server={server},1433;Database=WH_MetaData;Authentication=ActiveDirectoryServicePrincipal;UID={cid};PWD={cpw};Encrypt=yes;TrustServerCertificate=no;'
conn = pyodbc.connect(conn_str)
cursor = conn.cursor()

print('Checking all batches in ETLBatchHeader:')
cursor.execute('SELECT BatchId, PipelineName, PipelineRunId, Status FROM Log.ETLBatchHeader ORDER BY BatchId DESC')
batches = cursor.fetchall()
for r in batches:
    b_id = r[0]
    cursor.execute('SELECT COUNT(*) FROM Log.ETLBatchBronzeDetails WHERE BatchId = ?', (b_id,))
    br_cnt = cursor.fetchone()[0]
    cursor.execute('SELECT COUNT(*) FROM Log.ETLBatchSilverLogDetails WHERE BatchId = ?', (str(b_id),))
    sl_cnt = cursor.fetchone()[0]
    print(f'  Batch {b_id}: {r[1]} | RunId: {r[2]} | Status: {r[3]} | Bronze rows: {br_cnt} | Silver rows: {sl_cnt}')

conn.close()

