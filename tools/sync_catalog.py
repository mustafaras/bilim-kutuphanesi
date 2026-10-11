"""Rebuild a public metadata catalog from local archives; never copy source PDFs."""
from pathlib import Path
import csv,json,hashlib,os,re
from datetime import datetime,timezone,timedelta
P=Path(__file__).resolve().parents[1];desktop=Path.home()/'Desktop'
B=Path(os.environ.get('BOOK_LIBRARY',str(desktop/'ODTU Kitap Seckisi')))
N=Path(os.environ.get('NOBEL_LIBRARY',str(desktop/'Nobel Calismalari Arsivi')))
L=P/'.local';state=json.loads((L/'drive-index.json').read_text(encoding='utf-8'))
for f in (L/'transfers').glob('*.json'):
 r=json.loads(f.read_text(encoding='utf-8'))
 if r.get('status')=='uploaded':state['files'][r['key']]=r
def read(p,sep=','):return list(csv.DictReader(p.open(encoding='utf-8-sig'),delimiter=sep))
def identity(key):return hashlib.sha256(key.encode()).hexdigest()[:20]
def url(s):return s if isinstance(s,str) and s.startswith(('https://','http://')) else ''
records=[];book_ids={};files_by_key={};unavailable=[]
for r in read(B/'KITAP LISTESI.csv',';'):
 rel=r.get('Dosya','').replace('\\','/')
 if not rel:
  unavailable.append(dict(title=r['Kitap'],status=r['İndirme durumu']));continue
 key='books/'+rel;p=(B/rel).resolve();assert p.is_relative_to(B.resolve()) and p.is_file()
 cloud=state['files'].get(key,{});book_ids[rel]=identity(key)
 match=re.search(r'(\d+) (?:PDF )?sayfa',r.get('İndirme durumu',''))
 records.append(dict(id=identity(key),collection='books',title=r['Kitap'],author=r['Yazar'],category=r['Kategori'].split('/')[0],language=r.get('Dil','Belirtilmedi'),year='',kind=r.get('Belge türü','kaynak'),level=r.get('Seviye','Belirtilmedi'),description=r.get('Kısa açıklama',''),tags=r.get('Etiketler',''),pages=match.group(1) if match else '',format=p.suffix.lstrip('.').lower(),source=url(r.get('Kaynak','')),drive=url(cloud.get('url',''))))
 files_by_key[key]=p
# Match observed language checks by content hash, rather than assuming every Nobel PDF is English.
audit=desktop/'Yeni klasör'/'tmp/full_audit/nobel.json';lang={}
if audit.exists():
 for a in json.loads(audit.read_text(encoding='utf-8')):
  if a.get('sha256') and a.get('detected_language') not in [None,'Belirsiz']:lang[a['sha256']]=a['detected_language']
for r in read(N/'BELGE KATALOGU.csv'):
 rel=r['file'].replace('\\','/');key='nobel/'+rel;p=(N/rel).resolve();assert p.is_relative_to(N.resolve()) and p.is_file();cloud=state['files'].get(key,{})
 records.append(dict(id=identity(key),collection='nobel',title=r['title'],author=r['author'],category=r['area'],language=lang.get(r.get('sha256',''),'Belirtilmedi'),year=r['year'],kind=r['kind'],level='Belirtilmedi',description=r.get('relation',''),tags=r.get('publication_year',''),pages=r.get('pages',''),format=p.suffix.lstrip('.').lower(),source=url(r.get('source_page') or r.get('pdf_url','')),drive=url(cloud.get('url',''))));files_by_key[key]=p
areas={'Physics':'01 - Fizik','Chemistry':'02 - Kimya','Physiology or Medicine':'03 - Fizyoloji ve Tıp','Literature':'04 - Edebiyat','Peace':'05 - Barış','Economic Sciences':'06 - Ekonomi'}
for r in read(N/'ODUL KATALOGU.csv'):
 if not r.get('laureates'):continue
 key='award/'+r['category']+'/'+r['year']
 records.append(dict(id=identity(key),collection='awards',title=r.get('topic_tr') or r['folder_name'],author=r['laureates'],category=areas.get(r['category'],r['category']),language='',year=r['year'],kind='ödül kaydı',level='',description=r['motivation'],tags=r['status'],pages='',format='',source=url(r['source']),drive=''))
routes=[]
for name in ['OKUMA ROTALARI.json','ALAN REHBERI.json']:
 for route in json.loads((B/name).read_text(encoding='utf-8')):
  routes.append(dict(title=route['title'],description=route['description'],steps=[dict(id=book_ids[s['file']],note=s['note']) for s in route['steps'] if s['file'] in book_ids]))
stats=dict(books=sum(r['collection']=='books' for r in records),nobelDocuments=sum(r['collection']=='nobel' for r in records),awards=sum(r['collection']=='awards' for r in records),pdfs=sum(r['format']=='pdf' for r in records),documents=len(files_by_key),uploaded=sum(bool(r['drive']) for r in records),languages=len(set(r['language'] for r in records if r['language'] not in ['', 'Belirtilmedi','Belirsiz'])))
today=datetime.now(timezone(timedelta(hours=3)))
months=['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık']
data=dict(version=1,updated=f'{today.day} {months[today.month-1]} {today.year}',repository='https://github.com/mustafaras/bilim-kutuphanesi',driveRoot=state['root_url'],stats=stats,records=records,routes=routes,unavailable=unavailable)
target=P/'site/data';target.mkdir(exist_ok=True);(target/'catalog.json').write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
print(json.dumps(stats,ensure_ascii=False))
