from pathlib import Path
import json,re
P=Path(__file__).resolve().parents[1];S=P/'site';d=json.loads((S/'data/catalog.json').read_text(encoding='utf-8'));r=d['records'];ids={x['id'] for x in r}
assert len(ids)==len(r),'Duplicate IDs'
assert len(r)>2000
assert d['stats']['documents']==sum(x['collection']!='awards' for x in r)
assert d['stats']['uploaded']==sum(bool(x['drive']) for x in r)
assert d['stats']['pdfs']==sum(x['format']=='pdf' for x in r)
for x in r:
 assert x['title'] and x['category']
 for key in ['drive','source']:
  assert not x[key] or x[key].startswith(('https://','http://'))
 assert not any(p in json.dumps(x) for p in ['C:\\Users\\','file:///','access_token','refresh_token'])
for route in d['routes']:
 assert len(route['steps'])>0
 assert all(s['id'] in ids for s in route['steps'])
for file in ['index.html','style.css','i18n.js','app.js','visuals.js','effects.js','discovery.js','record.js','palette.js','facets.js','sw.js','manifest.webmanifest','icon.svg']:
 assert (S/file).is_file()
assert not list(S.rglob('*.pdf')) and not list(S.rglob('*.epub'))
assert sum(p.stat().st_size for p in S.rglob('*') if p.is_file())<10_000_000
html=(S/'index.html').read_text(encoding='utf-8');js=(S/'app.js').read_text(encoding='utf-8')+(S/'record.js').read_text(encoding='utf-8')+(S/'palette.js').read_text(encoding='utf-8');known=set(re.findall(r'\bid="([^"]+)"',html))
assert set(re.findall(r"\$\('([^']+)'\)",js))<=known
worker=(S/'sw.js').read_text(encoding='utf-8')
for asset in re.findall(r'(?:src|href)="([^"?#]+\.(?:js|css)\?v=\d+)"',html):
 assert "'"+asset+"'" in worker,'Offline cache asset version differs: '+asset
print('OK:',len(r),'records;',len(d['routes']),'routes;',d['stats']['uploaded'],'Drive links; no PDFs or credentials in public site.')
