'use strict';
/* FAZ-6 · Komut paleti — ⌘K/Ctrl+K, `?` kısayol haritası, beş kaynak:
   eylem → rota → alan → kayıt → yazar. Eylemler mevcut API'leri çağırır, yenisini üretmez. */
(()=>{
 const overlay=document.getElementById('paletteOverlay'),input=document.getElementById('paletteInput'),list=document.getElementById('paletteList'),count=document.getElementById('paletteCount'),emptyBox=document.getElementById('paletteEmpty'),closeBtn=document.getElementById('paletteClose'),tryBox=document.getElementById('paletteTry'),map=document.getElementById('shortcutMap'),mapClose=document.getElementById('shortcutClose');
 let results=[],active=-1,query='',opener=null,mapOpener=null,debounce=null,authors=null;
 const isOpen=()=>overlay.hidden===false;
 const mapIsOpen=()=>map.hidden===false;
 const all=(root,s)=>root&&root.querySelectorAll?[...root.querySelectorAll(s)]:[];
 const GROUP={action:'groupActions',route:'groupRoutes',field:'groupFields',record:'groupRecords',author:'groupAuthors'};
 const busy=()=>['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName);

 const jump=id=>{const el=document.getElementById(id);if(el)el.scrollIntoView({block:'start'})};
 function actions(){return[
  ['actTop',()=>jump('hero')],
  ['actCatalog',()=>jump('catalog')],
  ['actDiscover',()=>jump('collections')],
  ['actRoutes',()=>jump('routes')],
  ['actArchives',()=>jump('archives')],
  ['actTheme',()=>{const b=document.getElementById('themeToggle');b&&b.click&&b.click()}],
  ['actMotion',()=>{const b=document.getElementById('motionToggle');b&&b.click&&b.click()}],
  ['actLang',()=>setLanguage(uiLang==='tr'?'en':'tr')],
  ['actSaved',()=>{reset();$('favoritesOnly').checked=true;page=0;render();jump('catalog')}],
  ['actDownload',()=>{const a=document.createElement('a');a.href='data/catalog.json';a.download='bilim-kutuphanesi-katalog.json';a.click()}]
 ].map(([key,run])=>({kind:'action',glyph:'▸',label:t(key),sub:'',hay:hook(key),run}))}
 /* İki dilli eşleşme yüzeyi: anahtar TR+EN sözlük değerlerinin birleşimi. */
 function hook(key){return norm(String(t(key))+' '+(UI.tr[key]||'')+' '+(UI.en[key]||''))}

 function routes(){return(catalog&&catalog.routes||[]).map((route,i)=>{const tr=typeof routeI18n==='function'?routeI18n(route):null;return{kind:'route',glyph:'✦',label:tr?tr.title:route.title,sub:String(route.steps.length)+' '+t('steps'),hay:norm(route.title+' '+(tr?tr.title+' '+tr.description:'')+' '+route.description),run:()=>{jump('routes');const open=all(document.getElementById('routeList'),'details')[i];if(open){open.open=true;const s=open.querySelector?open.querySelector('summary'):null;if(s&&s.focus)s.focus({preventScroll:true})}}}})}
 function fields(){return DISCOVERY.map((d,i)=>({kind:'field',glyph:'◈',label:d.title[uiLang==='en'?1:0],sub:d.note[uiLang==='en'?1:0],hay:norm(d.title[0]+' '+d.title[1]+' '+d.note[0]+' '+d.note[1]),run:()=>{reset();discoveryIndex=i;populateFilters();render();jump('catalog')}}))}
 function recordsFor(tokens){const scored=[];for(const r of records){if(!tokens.every(w=>r.search.includes(w)))continue;const title=norm(displayTitle(r)),author=norm(r.author);let score=1;if(tokens.every(w=>title.includes(w)))score+=4;if(tokens.every(w=>author.includes(w)))score+=3;scored.push([score,r])}
  scored.sort((a,b)=>b[0]-a[0]||a[1].title.localeCompare(b[1].title,locale()));
  return scored.slice(0,6).map(([,r])=>({kind:'record',glyph:'❖',label:displayTitle(r),sub:[r.author,r.year,label(r.category).replace(/^\d+ - /,'')].filter(Boolean).join(' · '),hay:r.search,run:()=>window.openRecord&&window.openRecord(r.id)}))}
 function authorsFor(tokens){if(!authors)authors=[...new Set(records.map(r=>r.author).filter(Boolean))].sort((a,b)=>a.localeCompare(b,locale()));const q=norm(tokens.join(' '));
  return authors.filter(a=>norm(a).includes(q)).slice(0,4).map(a=>({kind:'author',glyph:'✎',label:a,sub:String(records.filter(r=>r.author===a).length)+' '+t('records'),hay:norm(a),run:()=>{reset();authorFacet=a;populateFilters();render();jump('catalog')}}))}

 function build(q){
  const tokens=norm(q).split(/\s+/).filter(Boolean);
  const acts=actions().filter(a=>!tokens.length||tokens.every(w=>a.hay.includes(w)));
  if(!tokens.length)return acts.slice(0,10);
  const out=[...acts,...routes().filter(x=>tokens.every(w=>x.hay.includes(w))).slice(0,4),...fields().filter(x=>tokens.every(w=>x.hay.includes(w))).slice(0,4)];
  if(out.length<12)out.push(...recordsFor(tokens));
  if(out.length<12)out.push(...authorsFor(tokens));
  return out.slice(0,12)}

 function rowHtml(item,i){return `<div class="pk-opt pk-${item.kind}" role="option" id="pk-${i}" data-pk="${i}" aria-selected="${i===active}"><span class="pk-glyph" aria-hidden="true">${item.glyph}</span><span class="pk-main"><strong>${highlight(item.label,query)}</strong>${item.sub?`<small>${esc(item.sub)}</small>`:''}</span><span class="pk-kind">${esc(t(GROUP[item.kind]))}</span></div>`}
 function render(q){
  query=String(q===undefined?input.value||'':q);results=build(query);active=-1;
  let html='',last='';
  results.forEach((item,i)=>{if(item.kind!==last){html+=`<p class="pk-head" role="presentation">${esc(t(GROUP[item.kind]))}</p>`;last=item.kind}html+=rowHtml(item,i)});
  list.innerHTML=html;list.setAttribute('aria-label',t('paletteResultsLabel'));
  const none=results.length===0&&!!norm(query);
  emptyBox.hidden=!none;list.hidden=!html;
  tryBox.innerHTML=none?['paletteTry1','paletteTry2','paletteTry3'].map(k=>`<button type="button" data-try="${esc(t(k))}">${esc(t(k))}</button>`).join(''):'';
  count.textContent=results.length?results.length+' '+plural('paletteResult',results.length):'';
  input.setAttribute('aria-expanded',String(isOpen()));input.removeAttribute('aria-activedescendant')}

 function move(dir){if(!results.length)return;active=(active+dir+results.length)%results.length;
  all(list,'.pk-opt').forEach((o,i)=>{o.setAttribute('aria-selected',String(i===active));o.classList&&o.classList.toggle('active',i===active)});
  if(active>=0){input.setAttribute('aria-activedescendant','pk-'+active);const el=all(list,'#pk-'+active)[0];if(el&&el.scrollIntoView)el.scrollIntoView({block:'nearest'})}}
 function choose(i){const item=results[i===undefined?active:i];if(!item)return;closePalette();item.run()}

 function openPalette(){if(isOpen())return;opener=document.activeElement;overlay.hidden=false;input.value='';document.body.style.overflow='hidden';render('');input.focus()}
 function closePalette(){if(!isOpen())return;overlay.hidden=true;list.innerHTML='';results=[];active=-1;query='';document.body.style.overflow='';input.setAttribute('aria-expanded','false');if(opener&&opener.focus)opener.focus()}
 function openShortcuts(){if(mapIsOpen())return;mapOpener=document.activeElement;map.hidden=false;mapClose.focus()}
 function closeShortcuts(){if(!mapIsOpen())return;map.hidden=true;if(mapOpener&&mapOpener.focus)mapOpener.focus()}

 input.addEventListener('input',()=>{clearTimeout(debounce);debounce=setTimeout(()=>render(),120)});
 input.addEventListener('keydown',event=>{
  if(event.key==='ArrowDown'){event.preventDefault();move(1)}
  else if(event.key==='ArrowUp'){event.preventDefault();move(-1)}
  else if(event.key==='Enter'){event.preventDefault();choose(active>=0?active:0)}
  else if(event.key==='Escape'){event.preventDefault();closePalette()}});
 overlay.addEventListener('keydown',event=>{
  if(event.key==='Escape'){event.preventDefault();closePalette();return}
  if(event.key==='Tab'){event.preventDefault();(document.activeElement===input?closeBtn:input).focus()}});
 overlay.addEventListener('click',event=>{if(event.target===overlay)closePalette()});
 list.addEventListener('click',event=>{const opt=event.target.closest?event.target.closest('[data-pk]'):null;if(opt)choose(Number(opt.dataset.pk))});
 tryBox.addEventListener('click',event=>{const b=event.target.closest?event.target.closest('[data-try]'):null;if(!b)return;input.value=b.dataset.try;render();input.focus()});
 closeBtn.addEventListener('click',closePalette);
 mapClose.addEventListener('click',closeShortcuts);

 document.addEventListener('keydown',event=>{
  if((event.ctrlKey||event.metaKey)&&String(event.key).toLowerCase()==='k'){event.preventDefault();isOpen()?closePalette():openPalette();return}
  if(event.key==='Escape'&&mapIsOpen()){closeShortcuts();return}
  if(event.key==='?'&&!busy()&&!isOpen()&&!mapIsOpen()){event.preventDefault();openShortcuts()}});
 document.addEventListener('library:language',()=>{if(isOpen())render()});

 if(typeof window!=='undefined')Object.assign(window,{openPalette,closePalette,paletteIsOpen:isOpen,shortcutsIsOpen:mapIsOpen,paletteQuery:render,paletteResults:()=>results,palettePick:choose});
})();
