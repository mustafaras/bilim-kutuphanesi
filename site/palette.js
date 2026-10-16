'use strict';
/* FAZ-6 · Command palette v2 — ⌘K/Ctrl+K, `?` shortcut map.
   Five sources (action → path → field → record → author), scope chips and prefixes (> # ~ @), a live preview pane,
   remembered recents, and a sliding selection lens. Actions call existing APIs; nothing new is invented here. */
(()=>{
 const $$=id=>document.getElementById(id);
 const overlay=$$('paletteOverlay'),input=$$('paletteInput'),list=$$('paletteList'),count=$$('paletteCount'),emptyBox=$$('paletteEmpty'),closeBtn=$$('paletteClose'),tryBox=$$('paletteTry'),map=$$('shortcutMap'),mapClose=$$('shortcutClose'),scopesBox=$$('paletteScopes'),preview=$$('palettePreview'),panel=overlay.querySelector?overlay.querySelector('.palette'):null;
 let results=[],active=-1,query='',opener=null,mapOpener=null,debounce=null,authors=null,authorCounts=null,scope='all',recMap=null;
 const isOpen=()=>overlay.hidden===false;
 const mapIsOpen=()=>map.hidden===false;
 const all=(root,s)=>root&&root.querySelectorAll?[...root.querySelectorAll(s)]:[];
 const GROUP={action:'groupActions',route:'groupRoutes',field:'groupFields',record:'groupRecords',author:'groupAuthors'};
 const PREFIX={'>':'action','#':'route','~':'field','@':'author'};
 const SCOPES=['all','action','route','field','record','author'];
 const busy=()=>['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName);
 const svg=d=>`<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${d}</svg>`;
 const ICON={action:svg('<path d="M13 3 5 14h6l-1 7 8-11h-6z"/>'),route:svg('<circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M8 18h5a3 3 0 0 0 0-6h-2a3 3 0 0 1 0-6h5"/>'),field:svg('<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9z"/><circle cx="12" cy="12" r="2"/>'),record:svg('<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h11"/>'),author:svg('<circle cx="12" cy="8" r="3.5"/><path d="M5 20c1-4 4-6 7-6s6 2 7 6"/>'),recent:svg('<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3 2"/>')};

 const jump=id=>{const el=$$(id);if(el)el.scrollIntoView({block:'start'})};
 const ACTIONS=[
  ['actTop',()=>jump('hero')],
  ['actCatalog',()=>jump('catalog')],
  ['actDiscover',()=>jump('collections')],
  ['actRoutes',()=>jump('routes')],
  ['actArchives',()=>jump('archives')],
  ['actTheme',()=>{const b=$$('themeToggle');b&&b.click&&b.click()}],
  ['actMotion',()=>{const b=$$('motionToggle');b&&b.click&&b.click()}],
  ['actLang',()=>setLanguage(uiLang==='tr'?'en':'tr')],
  ['actSaved',()=>{reset();$('favoritesOnly').checked=true;page=0;render();jump('catalog')}],
  ['actDownload',()=>{const a=document.createElement('a');a.href='data/catalog.json';a.download='bilim-kutuphanesi-katalog.json';a.click()}]
 ];
 /* Bilingual match surface: TR + EN dictionary values together. */
 const hook=key=>norm(String(t(key))+' '+(UI.tr[key]||'')+' '+(UI.en[key]||''));
 const actions=()=>ACTIONS.map(([key,run])=>({kind:'action',key,label:t(key),sub:'',hay:hook(key),run,pv:()=>pvText(ICON.action,t(key),t('groupActions'),'',t('pvRun'))}));

 const recordById=id=>{if(!recMap)recMap=new Map(records.map(r=>[r.id,r]));return recMap.get(id)};
 function routes(){return(catalog&&catalog.routes||[]).map((route,i)=>{const tr=typeof routeI18n==='function'?routeI18n(route):null,title=tr?tr.title:route.title,desc=tr?tr.description:route.description,stepTitles=route.steps.map(s=>{const r=recordById(s.id);return r?displayTitle(r):''}).filter(Boolean);
  return{kind:'route',key:String(i),label:title,sub:String(route.steps.length)+' '+t('steps'),hay:norm(route.title+' '+title+' '+desc+' '+route.description+' path paths yol yollari okuma reading route rota'),
   run:()=>{jump('routes');const open=all($$('routeList'),'details')[i];if(open){open.open=true;const s=open.querySelector?open.querySelector('summary'):null;if(s&&s.focus)s.focus({preventScroll:true})}},
   pv:()=>`<p class="pv-kicker">${esc(t('groupRoutes'))} · ${route.steps.length} ${esc(t('steps'))}</p><h4>${esc(title)}</h4><p class="pv-desc">${esc(desc||'')}</p><ol class="pv-steps">${stepTitles.slice(0,4).map(x=>`<li>${esc(x)}</li>`).join('')}</ol><p class="pv-hint">${esc(t('pvOpenRoute'))} <kbd>↵</kbd></p>`}})}
 function fields(){return DISCOVERY.map((d,i)=>({kind:'field',key:String(i),label:d.title[uiLang==='en'?1:0],sub:d.note[uiLang==='en'?1:0],hay:norm(d.title[0]+' '+d.title[1]+' '+d.note[0]+' '+d.note[1]),
  run:()=>{reset();discoveryIndex=i;populateFilters();render();jump('catalog')},
  pv:()=>{const n=records.filter(r=>d.nobel?r.collection!=='books':r.collection==='books'&&d.categories.includes(r.category)).length;return`<p class="pv-kicker">${esc(t('groupFields'))}</p><h4>${esc(d.title[uiLang==='en'?1:0])}</h4><p class="pv-desc">${esc(d.note[uiLang==='en'?1:0])}</p><p class="pv-stat"><b>${n.toLocaleString(locale())}</b> ${esc(t('records'))}</p><p class="pv-hint">${esc(t('pvOpenField'))} <kbd>↵</kbd></p>`}}))}
 function recordItem(r){return{kind:'record',key:r.id,label:displayTitle(r),sub:[r.author,r.year,label(r.category).replace(/^\d+ - /,'')].filter(Boolean).join(' · '),hay:r.search,run:()=>window.openRecord&&window.openRecord(r.id),
  pv:()=>`<div class="pv-art spine-${recordArtIndex(r)}" aria-hidden="true">${catalogRecordArt(r)}<canvas class="pv-3d" data-rec="${esc(r.id)}"></canvas></div><p class="pv-kicker">${esc(catalogNo(r))} · ${esc(t(r.collection))}${r.year?' · '+esc(r.year):''}</p><h4>${esc(displayTitle(r))}</h4><p class="pv-author">${esc(r.author||'')}</p><p class="pv-desc">${esc(displayDescription(r)||t('pvNoDesc'))}</p><p class="pv-chips">${[r.language,r.kind,r.level].filter(Boolean).map(v=>`<span>${esc(label(v))}</span>`).join('')}</p><p class="pv-hint">${esc(t('pvOpenRecord'))} <kbd>↵</kbd></p>`}}
 function recordsFor(tokens,limit){const scored=[];for(const r of records){if(!tokens.every(w=>r.search.includes(w)))continue;const title=norm(displayTitle(r)),author=norm(r.author);let score=1;if(tokens.every(w=>title.includes(w)))score+=4;if(tokens.every(w=>author.includes(w)))score+=3;scored.push([score,r])}
  scored.sort((a,b)=>b[0]-a[0]||a[1].title.localeCompare(b[1].title,locale()));
  return scored.slice(0,limit).map(([,r])=>recordItem(r))}
 function authorItem(a){const n=authorCount(a);return{kind:'author',key:a,label:a,sub:n.toLocaleString(locale())+' '+t(n===1?'recordOne':'records'),hay:norm(a),run:()=>{reset();authorFacet=a;populateFilters();render();jump('catalog')},
  pv:()=>{const own=records.filter(r=>r.author===a).slice(0,3);return`<p class="pv-kicker">${esc(t('groupAuthors'))}</p><h4>${esc(a)}</h4><p class="pv-stat"><b>${n.toLocaleString(locale())}</b> ${esc(t(n===1?'recordOne':'records'))}</p><ul class="pv-steps">${own.map(r=>`<li>${esc(displayTitle(r))}</li>`).join('')}</ul><p class="pv-hint">${esc(t('pvOpenAuthor'))} <kbd>↵</kbd></p>`}}}
 function authorCount(a){if(!authorCounts){authorCounts=new Map();for(const r of records)if(r.author)authorCounts.set(r.author,(authorCounts.get(r.author)||0)+1);authors=[...authorCounts.keys()].sort((x,y)=>authorCounts.get(y)-authorCounts.get(x)||x.localeCompare(y,locale()))}return authorCounts.get(a)||0}
 function authorsFor(tokens,limit){authorCount('');const q=norm(tokens.join(' '));return(q?authors.filter(a=>norm(a).includes(q)):authors).slice(0,limit).map(authorItem)}
 const pvText=(icon,title,kicker,desc,hint)=>`<div class="pv-icon" aria-hidden="true">${icon}</div><p class="pv-kicker">${esc(kicker)}</p><h4>${esc(title)}</h4>${desc?`<p class="pv-desc">${esc(desc)}</p>`:''}<p class="pv-hint">${esc(hint)} <kbd>↵</kbd></p>`;

 /* Recents survive reloads; stored as {k,v} so they re-resolve in the current language. */
 const RKEY='bk-palette-recent';
 const recents=()=>{try{return JSON.parse(localStorage.getItem(RKEY)||'[]').filter(e=>e&&e.k&&e.v!==undefined)}catch{return[]}};
 function remember(item){if(!item.key&&item.key!==0)return;try{const next=[{k:item.kind,v:item.key},...recents().filter(e=>!(e.k===item.kind&&e.v===item.key))].slice(0,5);localStorage.setItem(RKEY,JSON.stringify(next))}catch{}}
 function resolveRecent(e){let item=null;try{if(e.k==='action')item=actions().find(a=>a.key===e.v);else if(e.k==='route')item=routes()[Number(e.v)];else if(e.k==='field')item=fields()[Number(e.v)];else if(e.k==='record'){const r=recordById(e.v);item=r&&recordItem(r)}else if(e.k==='author'&&authorCount(e.v))item=authorItem(e.v)}catch{}return item?{...item,recent:true}:null}

 /* "> theme", "#path", "~ physics", "@tong" jump straight into a scope. */
 function parse(q){const c=String(q).trimStart()[0];if(PREFIX[c])return{kind:PREFIX[c],text:String(q).trimStart().slice(1)};return{kind:scope==='all'?null:scope,text:String(q)}}
 /* Fuzzy fallback: when nothing matches, snap each unknown word to the nearest word in the library (edit distance <=1 for short, <=2 for long words). */
 let vocab=null;
 function words(){if(vocab)return vocab;const m=new Map(),add=x=>{for(const w of norm(x).split(/[^a-z0-9]+/))if(w.length>=3)m.set(w,(m.get(w)||0)+1)};for(const r of records){add(r.author);add(displayTitle(r))}for(const a of actions())add(a.label);for(const d of DISCOVERY){add(d.title[0]);add(d.title[1])}return vocab=[...m.entries()].sort((a,b)=>b[1]-a[1]).map(e=>e[0])}
 function edit(a,b,max){if(Math.abs(a.length-b.length)>max)return max+1;let prev=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){const cur=[i];let low=i;for(let j=1;j<=b.length;j++){const v=Math.min(prev[j]+1,cur[j-1]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));cur.push(v);if(v<low)low=v}if(low>max)return max+1;prev=cur}return prev[b.length]}
 function snap(w,hay){if(w.length<4||hay.includes(w))return w;const max=w.length>=7?2:1;let best=w,bd=max+1;for(const v of words()){const d=edit(w,v,max);if(d<bd){bd=d;best=v;if(d===1&&max===1)break}}return best}
 function build(q,fuzzy){
  const out0=build0(q);
  if(out0.length||fuzzy)return out0;
  const {kind,text}=parse(q),tokens=norm(text).split(/\s+/).filter(Boolean);if(!tokens.length)return out0;
  const fixed=tokens.map(w=>snap(w,''));if(fixed.join(' ')===tokens.join(' '))return out0;
  const pre=String(q).trimStart()[0],prefix=PREFIX[pre]?pre:'';
  const res=build0(prefix+fixed.join(' '));if(!res.length)return out0;
  const phrase=fixed.join(' ');
  return[{kind:'action',key:'dym',label:t('paletteDym')+' '+phrase+'?',sub:'',hay:'',run:()=>{input.value=prefix+phrase;render();input.focus()},pv:()=>`<p class="pv-hint">${esc(t('paletteDym'))} <b>${esc(phrase)}</b> <kbd>↵</kbd></p>`},...res].slice(0,12)}
 function build0(q){
  const {kind,text}=parse(q),tokens=norm(text).split(/\s+/).filter(Boolean),want=k=>!kind||kind===k,solo=!!kind;
  const match=x=>!tokens.length||tokens.every(w=>x.hay.includes(w));
  if(!tokens.length&&!kind){const rec=recents().map(resolveRecent).filter(Boolean).slice(0,4);return[...rec,...actions().slice(0,10)]}
  const out=[];
  if(want('action'))out.push(...actions().filter(match).slice(0,solo?12:4));
  if(want('route'))out.push(...routes().filter(match).slice(0,solo?12:4));
  if(want('field'))out.push(...fields().filter(match).slice(0,solo?12:4));
  if(want('record')&&tokens.length&&(solo||out.length<12))out.push(...recordsFor(tokens,solo?12:6));
  if(want('author')&&(solo||out.length<12)&&(tokens.length||solo))out.push(...authorsFor(tokens,solo?12:4));
  return out.slice(0,12)}

 const groupKey=item=>item.recent?'recent':item.kind;
 const groupLabel=k=>k==='recent'?t('paletteRecent'):t(GROUP[k]);
 function rowHtml(item,i){const k=groupKey(item);return `<div class="pk-opt pk-${item.kind}" role="option" id="pk-${i}" data-pk="${i}" style="--i:${Math.min(i,9)}" aria-selected="${i===active}"><span class="pk-glyph" aria-hidden="true">${item.recent?ICON.recent:ICON[item.kind]}</span><span class="pk-main"><strong>${highlight(item.label,query)}</strong>${item.sub?`<small>${esc(item.sub)}</small>`:''}</span><span class="pk-kind">${esc(groupLabel(item.recent?item.kind:k))}</span></div>`}
 function renderScopes(){if(!scopesBox)return;const cur=parse(input.value).kind||'all';scopesBox.innerHTML=SCOPES.map(k=>`<button type="button" class="pk-chip" data-scope="${k}" aria-pressed="${cur===k}">${esc(k==='all'?t('scopeAll'):t(GROUP[k]))}</button>`).join('')}
 function render(q){
  query=String(q===undefined?input.value||'':q);const parsed=parse(query);query=parsed.text;results=build(q===undefined?input.value||'':q);active=-1;
  let html='<i class="pk-lens" aria-hidden="true"></i>',last='';
  results.forEach((item,i)=>{const k=groupKey(item);if(k!==last){html+=`<p class="pk-head" role="presentation">${esc(groupLabel(k))}</p>`;last=k}html+=rowHtml(item,i)});
  list.innerHTML=html;list.setAttribute('aria-label',t('paletteResultsLabel'));
  const none=results.length===0&&!!norm(query);
  emptyBox.hidden=!none;list.hidden=!results.length;
  tryBox.innerHTML=none?['paletteTry1','paletteTry2','paletteTry3'].map(k=>`<button type="button" data-try="${esc(t(k))}">${esc(t(k))}</button>`).join(''):'';
  count.textContent=results.length?results.length+' '+plural('paletteResult',results.length):'';
  input.setAttribute('aria-expanded',String(isOpen()));input.removeAttribute('aria-activedescendant');
  renderScopes();showPreview(results.length?0:-1);lens()}

 function showPreview(i){if(!preview)return;const item=results[i];preview.innerHTML=item&&item.pv?item.pv():`<p class="pv-hint">${esc(t('pvStart'))}</p>`;
  /* H1: the record preview's cover becomes a real, lit 3D book (shared renderer; falls back to the 2D art) */
  const cv=preview.querySelector?preview.querySelector('canvas.pv-3d'):null;if(cv&&window.BKStage&&window.BKStage.mini&&typeof matchMedia==='function'&&!matchMedia('(prefers-reduced-motion: reduce)').matches){const rec=records.find(x=>x.id===cv.dataset.rec);if(rec)window.BKStage.mini(cv,rec,()=>{const a=cv.closest('.pv-art');if(a)a.classList.add('has-3d')})}}
 /* The lens is one absolutely-positioned element that glides to the active row (transform only). */
 function lens(){const l=list.querySelector?list.querySelector('.pk-lens'):null;if(!l||!l.style)return;const el=all(list,'.pk-opt')[active>=0?active:-1];if(!el){l.style.opacity='0';return}l.style.opacity='1';l.style.height=el.offsetHeight+'px';l.style.transform='translateY('+el.offsetTop+'px)'}
 function setActive(i,scroll){active=i;all(list,'.pk-opt').forEach((o,k)=>{o.setAttribute('aria-selected',String(k===active));o.classList&&o.classList.toggle('active',k===active)});
  if(active>=0){input.setAttribute('aria-activedescendant','pk-'+active);const el=all(list,'#pk-'+active)[0];if(scroll&&el&&el.scrollIntoView)el.scrollIntoView({block:'nearest'})}else input.removeAttribute('aria-activedescendant');
  showPreview(active>=0?active:0);lens()}
 function move(dir){if(!results.length)return;setActive((active+dir+results.length)%results.length,true)}
 function choose(i){const item=results[i===undefined?active:i];if(!item)return;if(item.key==='dym'){item.run();return}remember(item);closePalette();item.run()}
 function setScope(k){scope=SCOPES.includes(k)?k:'all';const t0=input.value;if(PREFIX[String(t0).trimStart()[0]])input.value=String(t0).trimStart().slice(1);render();input.focus()}

 function openPalette(){if(isOpen())return;opener=document.activeElement;overlay.hidden=false;input.value='';scope='all';document.body.style.overflow='hidden';render('');input.focus()}
 function closePalette(){if(!isOpen())return;overlay.hidden=true;list.innerHTML='';results=[];active=-1;query='';document.body.style.overflow='';input.setAttribute('aria-expanded','false');if(opener&&opener.focus)opener.focus()}
 function openShortcuts(){if(mapIsOpen())return;mapOpener=document.activeElement;map.hidden=false;mapClose.focus()}
 function closeShortcuts(){if(!mapIsOpen())return;map.hidden=true;if(mapOpener&&mapOpener.focus)mapOpener.focus()}
 const cycleScope=d=>{const cur=SCOPES.indexOf(parse(input.value).kind||scope);setScope(SCOPES[(Math.max(0,cur)+d+SCOPES.length)%SCOPES.length])};

 input.addEventListener('input',()=>{clearTimeout(debounce);debounce=setTimeout(()=>render(),120)});
 input.addEventListener('keydown',event=>{
  if(event.key==='ArrowDown'){event.preventDefault();move(1)}
  else if(event.key==='ArrowUp'){event.preventDefault();move(-1)}
  else if(event.key==='Enter'){event.preventDefault();choose(active>=0?active:0)}
  else if(event.altKey&&(event.key==='ArrowRight'||event.key==='ArrowLeft')){event.preventDefault();cycleScope(event.key==='ArrowRight'?1:-1)}
  else if(event.key==='Escape'){event.preventDefault();closePalette()}});
 overlay.addEventListener('keydown',event=>{
  if(event.key==='Escape'){event.preventDefault();closePalette();return}
  if(event.key==='Tab'){event.preventDefault();const f=[input,...all(scopesBox,'button'),closeBtn],at=f.indexOf(document.activeElement);f[(at+(event.shiftKey?-1:1)+f.length)%f.length].focus()}});
 overlay.addEventListener('click',event=>{if(event.target===overlay)closePalette()});
 list.addEventListener('click',event=>{const opt=event.target.closest?event.target.closest('[data-pk]'):null;if(opt)choose(Number(opt.dataset.pk))});
 list.addEventListener('pointermove',event=>{const opt=event.target.closest?event.target.closest('[data-pk]'):null;if(opt){const i=Number(opt.dataset.pk);if(i!==active)setActive(i,false)}});
 if(scopesBox)scopesBox.addEventListener('click',event=>{const b=event.target.closest?event.target.closest('[data-scope]'):null;if(b)setScope(b.dataset.scope)});
 if(panel)panel.addEventListener('pointermove',event=>{const r=panel.getBoundingClientRect();if(panel.style&&panel.style.setProperty){panel.style.setProperty('--mx',(event.clientX-r.left)+'px');panel.style.setProperty('--my',(event.clientY-r.top)+'px')}});
 tryBox.addEventListener('click',event=>{const b=event.target.closest?event.target.closest('[data-try]'):null;if(!b)return;input.value=b.dataset.try;render();input.focus()});
 closeBtn.addEventListener('click',closePalette);
 mapClose.addEventListener('click',closeShortcuts);

 document.addEventListener('keydown',event=>{
  if((event.ctrlKey||event.metaKey)&&String(event.key).toLowerCase()==='k'){event.preventDefault();isOpen()?closePalette():openPalette();return}
  if(event.key==='Escape'&&mapIsOpen()){closeShortcuts();return}
  if(event.key==='?'&&!busy()&&!isOpen()&&!mapIsOpen()){event.preventDefault();openShortcuts()}});
 document.addEventListener('library:language',()=>{if(isOpen())render()});

 if(typeof window!=='undefined')Object.assign(window,{openPalette,closePalette,paletteIsOpen:isOpen,shortcutsIsOpen:mapIsOpen,paletteQuery:render,paletteResults:()=>results,palettePick:choose,paletteScope:setScope});
})();
