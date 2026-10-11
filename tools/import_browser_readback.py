"""Import only uniquely matched files whose uploaded sizes match the local archive."""
from pathlib import Path
import json, hashlib, sys
root=Path(__file__).resolve().parents[1]
local=root/'.local'
jobs=json.loads((local/'upload-jobs.json').read_text(encoding='utf-8'))
readback=Path(sys.argv[1]) if len(sys.argv)>1 else local/'all-browser-readback.json'
if not readback.exists():readback=local/'second-readback.json'
groups=json.loads(readback.read_text(encoding='utf-8'))
previous=json.loads((local/'drive-index.json').read_text(encoding='utf-8')).get('files',{})
count=0
issues=[]
verified={}
for group in groups:
    for remote in group['files']:
        matches=[j for j in jobs if j['collection']+'/'+j['category']==group['group'] and j['name']==remote['title']]
        if not matches:
            matches=[j for j in jobs if j['collection']+'/'+j['category']==group['group'] and previous.get(j['key'],{}).get('id')==remote['id']]
        if len(matches)>1:
            matches=[j for j in matches if previous.get(j['key'],{}).get('id')==remote['id']]
        if len(matches)!=1 or int(remote.get('size') or 0)!=matches[0]['size'] or not remote.get('can_download'):
            issues.append(remote['title']); continue
        job=matches[0]
        record=dict(job,status='uploaded',id=remote['id'],url=remote['url'],account=group.get('account','primary' if job['collection']=='nobel' else 'secondary'))
        target=local/'transfers'/('browser-'+hashlib.sha256(job['key'].encode()).hexdigest()[:20]+'.json')
        target.write_text(json.dumps(record,ensure_ascii=False),encoding='utf-8')
        count+=1
        verified[job['key']]=record
missing=[j['key'] for j in jobs if j['key'] not in verified]
audit=dict(readback=str(readback),expected=len(jobs),verifiedUnique=len(verified),verifiedEntries=count,
           counts={c:sum(r['collection']==c for r in verified.values()) for c in ['books','nobel']},
           missing=missing,unmatched=issues,
           stalePrevious=[k for k in previous if k not in verified],
           method='Category, filename, byte size, downloadable status and existing ID for ambiguous names; no remote content hash available')
(local/'full-readback-audit.json').write_text(json.dumps(audit,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({k:v for k,v in audit.items() if k not in ['missing','stalePrevious','unmatched']},ensure_ascii=False))
print(json.dumps(dict(missing=len(missing),unmatched=len(issues),stalePrevious=len(audit['stalePrevious'])),ensure_ascii=False))
