"""Import only uniquely matched files whose uploaded sizes match the local archive."""
from pathlib import Path
import json, hashlib
root=Path(__file__).resolve().parents[1]
local=root/'.local'
jobs=json.loads((local/'upload-jobs.json').read_text(encoding='utf-8'))
readback=local/'all-browser-readback.json'
if not readback.exists():readback=local/'second-readback.json'
groups=json.loads(readback.read_text(encoding='utf-8'))
count=0
issues=[]
for group in groups:
    for remote in group['files']:
        matches=[j for j in jobs if j['collection']+'/'+j['category']==group['group'] and j['name']==remote['title']]
        if len(matches)!=1 or int(remote.get('size') or 0)!=matches[0]['size'] or not remote.get('can_download'):
            issues.append(remote['title']); continue
        job=matches[0]
        record=dict(job,status='uploaded',id=remote['id'],url=remote['url'],account='primary' if job['collection']=='nobel' else 'secondary')
        target=local/'transfers'/('browser-'+hashlib.sha256(job['key'].encode()).hexdigest()[:20]+'.json')
        target.write_text(json.dumps(record,ensure_ascii=False),encoding='utf-8')
        count+=1
print(json.dumps(dict(verified=count,unmatched=issues),ensure_ascii=False))
