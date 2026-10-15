'use strict';
/* FAZ-5 · Kayıt deneyimi — düğüm sayfası, keşif takımyıldızı, alıntı, paylaşım kartı.
   Diyalog kaldırıldı: #recordView tam sayfa, SPA kalır. ?record= / popstate / Escape /
   odak dönüşü sözleşmeleri aynen korunur (eski discovery.js davranışı). */
(()=>{
 const view=document.getElementById('recordView'),sheet=document.getElementById('recordSheet');
 /* Tabs: Overview / Cite & share. Arrow keys, Home/End; selection survives re-render only via setTab. */
 function setTab(i,focus){if(!sheet.querySelectorAll)return;sheet.querySelectorAll('.rv-tab').forEach((b,k)=>{const on=k===i;b.setAttribute('aria-selected',String(on));b.tabIndex=on?0:-1;if(on&&focus)b.focus()});sheet.querySelectorAll('.rv-panel').forEach((p,k)=>{p.hidden=k!==i})}
 if(sheet.addEventListener){sheet.addEventListener('click',e=>{const b=e.target.closest?e.target.closest('.rv-tab'):null;if(b)setTab(Number(b.dataset.tab))});
  sheet.addEventListener('keydown',e=>{const b=e.target.closest?e.target.closest('.rv-tab'):null;if(!b)return;const n=sheet.querySelectorAll('.rv-tab').length,i=Number(b.dataset.tab);let j=null;if(e.key==='ArrowRight')j=(i+1)%n;else if(e.key==='ArrowLeft')j=(i-1+n)%n;else if(e.key==='Home')j=0;else if(e.key==='End')j=n-1;if(j!==null){e.preventDefault();setTab(j,true)}})}
 let current=null,returnFocus=null,previousOverflow=null,inertElements=[],pushed=false;
 const SPINE=['#528584','#729c7d','#6b8aab','#967b9b','#729c7d','#6b8aab','#967b9b','#b49767'];
 const motionOff=()=>{const c=document.documentElement.classList;if(c&&c.contains('effects-paused'))return true;return typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches};

 function recordCover(r){return `<div class="catalog-cover cover-${recordArtIndex(r)}" aria-hidden="true"><span class="cover-rule"></span><span class="cover-category">${esc(label(r.category).replace(/^\d+ - /,''))}</span>${catalogRecordArt(r)}<span class="cover-title">${esc(displayTitle(r))}</span><span class="cover-author">${esc(r.author)}</span><span class="cover-imprint">BK · ${esc(r.format.toUpperCase())}</span></div>`}

 /* Keşif önerisi — hesaplama mantığı AYNEN (eski renderRelated), sunum takımyıldıza taşındı. */
 function relatedRecords(r,count){const candidates=records.filter(other=>other.id!==r.id&&other.collection===r.collection&&other.category===r.category&&other.title!==r.title).sort((a,b)=>Number(b.language===r.language)-Number(a.language===r.language)||(r.level&&r.level!=='Belirtilmedi'?Number(b.level===r.level)-Number(a.level===r.level):0)||(r.collection==='books'?0:Math.abs(Number(a.year)-Number(r.year))-Math.abs(Number(b.year)-Number(r.year)))||a.title.localeCompare(b.title,locale()));const selected=[],authors=new Set();for(const item of candidates){const author=norm(item.author);if(authors.has(author))continue;selected.push(item);authors.add(author);if(selected.length===count)break}for(const item of candidates){if(selected.length===count)break;if(!selected.includes(item))selected.push(item)}return selected}

 function shareUrl(r){const u=new URL(location.href);u.search='';u.searchParams.set('record',r.id);u.searchParams.set('ui',uiLang);u.hash='';return u.href}
 function citation(r){let tpl=t('citeTemplate');if(!r.year)tpl=tpl.replace('{collection}, {year}','{collection}');if(!r.author)tpl=tpl.replace('{author}. ','');const url=shareUrl(r),title=String(displayTitle(r)).replace(/[.\s]+$/,''),fill=x=>x.replace('{author}',r.author||'').replace('{title}',title).replace('{collection}',t(r.collection)).replace('{year}',r.year||'');return{full:fill(tpl).replace('{url}',url),preview:fill(tpl).replace(' — {url}','')}}

 /* What links two records, strongest first: same author, close year, same language, same field. */
 function relation(r,n){const dy=Math.abs(Number(r.year)-Number(n.year));if(r.author&&norm(r.author)===norm(n.author))return{k:'author',w:1};if(r.year&&n.year&&dy<=2)return{k:'year',w:.75};if(r.language&&r.language===n.language)return{k:'lang',w:.55};return{k:'field',w:.35}}
 function constellationHtml(r,nodes){
  if(!nodes.length)return '';
  const W=1000,H=560,cx=500,cy=284;
  const pts=nodes.map((n,i)=>{const ang=(-90+i*(360/nodes.length)+(i*53%17)-8)*Math.PI/180,rad=150+(i*97%66);return{x:Math.max(96,Math.min(904,Math.round(cx+Math.cos(ang)*rad*1.5))),y:Math.max(78,Math.min(486,Math.round(cy+Math.sin(ang)*rad*0.92)))}});
  const rels=nodes.map(n=>relation(r,n));
  const lines=pts.map((p,i)=>{const mx=(cx+p.x)/2,my=(cy+p.y)/2,dx=p.y-cy,dy=cx-p.x,len=Math.hypot(dx,dy)||1,bend=(i%2?1:-1)*Math.min(46,len*.16);return `<path class="rel-${rels[i].k}" d="M${cx} ${cy} Q${Math.round(mx+dx/len*bend)} ${Math.round(my+dy/len*bend)} ${p.x} ${p.y}" pathLength="1" style="--w:${rels[i].w};animation-delay:${.25+i*.07}s"></path>`}).join('');
  const twinkles=[[120,60],[310,44],[520,70],[770,40],[905,96],[60,300],[950,320],[240,470],[700,500],[860,470],[420,510],[150,180]].map(([x,y],i)=>`<circle class="tk" cx="${x}" cy="${y}" r="${(1+(i%3)*.5).toFixed(1)}" style="animation-delay:${(i*.7)%4}s"></circle>`).join('');
  const buttons=pts.map((p,i)=>`<button type="button" class="rv-node spine-${recordArtIndex(nodes[i])} rel-${rels[i].k}" data-detail="${esc(nodes[i].id)}" style="left:${(p.x/W*100).toFixed(2)}%;top:${(p.y/H*100).toFixed(2)}%;--d:${(i*.55).toFixed(2)}s;animation-delay:${.35+i*.07}s" aria-label="${esc(displayTitle(nodes[i])+' — '+nodes[i].author+' · '+t('rel_'+rels[i].k))}"><span class="rv-dot" aria-hidden="true"></span><span class="rv-node-label"><b>${esc(displayTitle(nodes[i]))}</b><i>${esc([nodes[i].author,nodes[i].year].filter(Boolean).join(' · '))}</i></span></button>`).join('');
  return `<div class="rv-constellation"><svg class="rv-lines" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true" focusable="false"><g class="rv-orbits"><circle cx="${cx}" cy="${cy}" r="120" stroke-dasharray="1 10"></circle><circle cx="${cx}" cy="${cy}" r="210" stroke-dasharray="1 14" opacity=".6"></circle></g><g class="rv-edges">${lines}</g><g class="rv-twinkle">${twinkles}</g><g class="rv-center"><circle cx="${cx}" cy="${cy}" r="26" opacity=".18"></circle><circle cx="${cx}" cy="${cy}" r="12" opacity=".35"></circle><circle class="rv-core" cx="${cx}" cy="${cy}" r="5.5"></circle></g></svg><p class="rv-center-no" aria-hidden="true">${esc(catalogNo(r))}</p>${buttons}</div><ul class="rv-legend" aria-label="${esc(t('relLegend'))}">${['author','year','lang','field'].filter(k=>rels.some(x=>x.k===k)).map(k=>`<li class="rel-${k}"><i aria-hidden="true"></i>${esc(t('rel_'+k))}</li>`).join('')}</ul>`}

 function renderExplore(record){const authorCount=record.author?records.filter(other=>norm(other.author)===norm(record.author)).length:0,fieldCount=records.filter(other=>other.collection===record.collection&&other.category===record.category).length;return[...(authorCount?[{kind:'author',text:t('browseAuthor'),value:record.author,count:authorCount}]:[]),{kind:'category',text:t('browseField'),value:label(record.category).replace(/^\d+ - /,''),count:fieldCount}].map(item=>`<a href="${esc(browseUrl(record,item.kind))}" data-browse="${item.kind}" aria-label="${esc(item.text+': '+item.value+' · '+item.count+' '+t('records'))}"><span>${esc(item.text)}<small>${item.count.toLocaleString(locale())} ${t('records')}</small></span><span aria-hidden="true">↗</span></a>`).join('')}
 function browseUrl(record,kind){const params=new URLSearchParams({ui:uiLang});if(kind==='author')params.set('author',record.author);else{params.set('collection',record.collection);params.set('category',record.category)}return location.pathname+'?'+params+'#catalog'}

 function renderRecord(){if(!current)return;const r=current,nodes=relatedRecords(r,8),cite=citation(r);
  sheet.className='rv-sheet spine-'+recordArtIndex(r);
  sheet.innerHTML=`<div class="rv-art-col"><div class="rv-art" id="recordArt"><span class="rv-halo" aria-hidden="true"></span><div id="recordCoverArt">${recordCover(r)}</div></div><div class="rv-links detail-links">${safeUrl(r.drive)?`<a class="primary" href="${esc(safeUrl(r.drive))}" target="_blank" rel="noopener">${t(r.format==='pdf'?'pdf':'file')}</a>`:''}${sourceLink(r)}<p class="rv-access rv-chip">${esc(t(safeUrl(r.drive)?'ready':r.collection==='awards'?'sourceOnly':'pending'))}</p></div><p class="visual-note rv-art-note">${esc(t('coverNote'))}</p></div>`+
   `<div class="rv-plate"><p class="rv-strip"><b>${esc(catalogNo(r))}</b><span aria-hidden="true">·</span><span>${esc(label(r.collection))}</span><span aria-hidden="true">·</span><span>${esc(r.year||'—')}</span></p><h2 id="recordTitle" tabindex="-1">${esc(displayTitle(r))}</h2><p class="rv-author">${esc(r.author)}</p><div class="rv-tabs" role="tablist" aria-label="${esc(t('rvTabs'))}"><button type="button" role="tab" id="rvTab0" class="rv-tab" aria-selected="true" aria-controls="rvPanel0" data-tab="0">${esc(t('rvTabOverview'))}</button><button type="button" role="tab" id="rvTab1" class="rv-tab" aria-selected="false" aria-controls="rvPanel1" data-tab="1" tabindex="-1">${esc(t('rvTabCite'))}</button></div><div class="rv-panel" id="rvPanel0" role="tabpanel" aria-labelledby="rvTab0"><dl class="rv-meta">${[['language',label(r.language)],['kind',label(r.kind)],['level',label(r.level)],['year',r.year],['pages',r.pages]].filter(([,v])=>v).map(([key,v])=>`<div><dt>${esc(t(key))}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl><p class="rv-description">${esc(displayDescription(r)||t('noDescription'))}</p>${displayDescription(r)&&uiLang==='en'?`<p class="visual-note">${esc(t('originalNote'))}</p>`:''}<nav class="detail-explore rv-explore" aria-label="${esc(t('browseRelated'))}">${renderExplore(r)}</nav></div><div class="rv-panel" id="rvPanel1" role="tabpanel" aria-labelledby="rvTab1" hidden><section class="rv-cite" aria-label="${esc(t('citeHeading'))}"><p class="rv-cite-label">${esc(t('citeHeading'))}</p><blockquote>${esc(cite.preview)}</blockquote><button id="recordCiteCopy" type="button">${esc(t('cite'))}</button></section><div class="rv-actions"><button id="recordShareCard" type="button"><span class="rv-btn-glyph" aria-hidden="true">✦</span>${esc(t('shareCard'))}</button></div></div></div>`+
   (nodes.length?`<figure class="rv-constellation-wrap"><figcaption><span class="eyebrow"><span class="dot"></span>${esc(t('constellationTitle'))}</span><p>${esc(t('constellationNote'))}</p></figcaption>${constellationHtml(r,nodes)}<p class="rv-node-hint">${esc(t('nodeHint'))}</p><ul class="rv-neighbors">${nodes.map(n=>`<li><button type="button" class="related-source" data-detail="${esc(n.id)}"><span class="related-art" aria-hidden="true">${catalogRecordArt(n)}</span><span class="related-copy"><strong>${esc(displayTitle(n))}</strong><span>${esc(n.author)}</span><small>${esc(label(n.language))}${n.year?' · '+esc(n.year):''}</small></span><span class="related-arrow" aria-hidden="true">↗</span></button></li>`).join('')}</ul></figure>`:'');
  const star=document.getElementById('recordFavorite');star.textContent=(favorites.has(r.id)?'★ ':'☆ ')+t(favorites.has(r.id)?'remove':'add');star.setAttribute('aria-pressed',String(favorites.has(r.id)));
  document.getElementById('recordShare').textContent=t('copyRecordLink');
  document.getElementById('recordBack').setAttribute('aria-label',t('close'));
  const ogT=document.getElementById('ogTitle'),ogD=document.getElementById('ogDesc'),ogU=document.getElementById('ogUrl');
  if(ogT)ogT.setAttribute('content',displayTitle(r)+' — '+r.author+' · '+t('brand'));
  if(ogD)ogD.setAttribute('content',(displayDescription(r)||t('heroFoot')).slice(0,180));
  if(ogU)ogU.setAttribute('content',shareUrl(r));
  if(!motionOff()&&typeof matchMedia==='function'&&matchMedia('(pointer:fine)').matches){const art=document.getElementById('recordArt');if(art)art.addEventListener('pointermove',e=>{const b=art.getBoundingClientRect?art.getBoundingClientRect():{left:0,top:0,width:1,height:1};if(!art.style||!art.style.setProperty)return;art.style.setProperty('--mx',((e.clientX-b.left)/(b.width||1)*100).toFixed(1)+'%');art.style.setProperty('--my',((e.clientY-b.top)/(b.height||1)*100).toFixed(1)+'%')})}
  const all=s=>sheet.querySelectorAll?[...sheet.querySelectorAll(s)]:[];
  all('.rv-node').forEach((node,i)=>{const line=all('.rv-edges path')[i];if(!line||!line.classList)return;const lit=on=>line.classList.toggle('lit',on);node.addEventListener('mouseenter',()=>lit(true));node.addEventListener('mouseleave',()=>lit(false));node.addEventListener('focus',()=>lit(true));node.addEventListener('blur',()=>lit(false))});
  const cons=sheet.querySelector?sheet.querySelector('.rv-constellation'):null;if(cons&&!motionOff()&&typeof matchMedia==='function'&&matchMedia('(pointer:fine)').matches)cons.addEventListener('pointermove',e=>{if(!cons.style||!cons.style.setProperty)return;const b=cons.getBoundingClientRect();cons.style.setProperty('--px',(((e.clientX-b.left)/b.width-.5)*2).toFixed(3));cons.style.setProperty('--py',(((e.clientY-b.top)/b.height-.5)*2).toFixed(3))})}

 /* Kart→sayfa morfu: kaynak kapakla yeni kapak aynı view-transition-name'i paylaşır. */
 function withMorph(sourceArt,mutate){
  if(!sourceArt||typeof document.startViewTransition!=='function'||motionOff()){mutate();return}
  const name='bk-cover';sourceArt.style.setProperty('view-transition-name',name);
  try{const vt=document.startViewTransition(()=>{mutate();const fresh=document.getElementById('recordCoverArt');if(fresh)fresh.style.setProperty('view-transition-name',name)});
   const clean=()=>{sourceArt.style.removeProperty('view-transition-name');const fresh=document.getElementById('recordCoverArt');if(fresh)fresh.style.removeProperty('view-transition-name')};
   vt.finished.then(clean).catch(clean)}catch{mutate();sourceArt.style.removeProperty('view-transition-name')}}

 function lockPage(){previousOverflow=document.body.style.overflow;document.body.style.overflow='hidden';inertElements=[...document.querySelectorAll('header,main,footer,.motion-toggle,.skip')].map(el=>[el,el.inert]);inertElements.forEach(([el])=>el.inert=true)}
 function unlockPage(){document.body.style.overflow=previousOverflow;inertElements.forEach(([el,wasInert])=>el.inert=wasInert);inertElements=[]}
 function urlHasRecord(){return new URLSearchParams(location.search).get('record')}
 function writeParam(id){const u=new URL(location.href);if(id)u.searchParams.set('record',id);else u.searchParams.delete('record');history.replaceState(null,'',u)}

 function open(id,sourceEl){const r=records.find(rec=>rec.id===id);if(!r)return;const wasOpen=view.hidden===false;if(!wasOpen)returnFocus=document.activeElement;current=r;
  const sourceArt=sourceEl&&sourceEl.nodeType===1&&sourceEl.querySelector?sourceEl.querySelector('.catalog-cover,.card-illustration,.route-source-art,.related-art'):null;
  withMorph(sourceArt,()=>{renderRecord();view.hidden=false;view.scrollTop=0;document.getElementById('recordTitle').focus({preventScroll:true})});
  if(!wasOpen)lockPage();
  if(urlHasRecord()!==r.id){if(wasOpen||urlHasRecord())writeParam(r.id);else{pushed=true;history.pushState({record:r.id},'',(()=>{const u=new URL(location.href);u.searchParams.set('record',r.id);return u})())}}}
 function close(){if(view.hidden!==false)return;current=null;view.hidden=true;sheet.innerHTML='';unlockPage();writeParam(null);document.getElementById('recordShareFallback').hidden=true;if(returnFocus&&returnFocus.isConnected)returnFocus.focus()}

 /* Okuma yolları / yazar-keşif gezintisi — katalog üstüne süzgeç uygular. */
 function browse(kind){if(!current)return;const record=current;returnFocus=null;close();reset();if(kind==='author')authorFacet=record.author;else $('collection').value=record.collection;populateFilters();if(kind==='category')$('category').value=record.category;render();$('cards').scrollIntoView({block:'start'});const first=$('cards').querySelector('.title-detail');if(first)first.focus({preventScroll:true})}

 view.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();close()} if(event.key==='Tab'){const items=(view.querySelectorAll?[...view.querySelectorAll('button,a[href],input')]:[]).filter(el=>!el.disabled&&(el.getClientRects?el.getClientRects().length:true));if(!items.length)return;const first=items[0],last=items[items.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}}});
 document.addEventListener('click',event=>{const link=event.target.closest('[data-browse]');if(link&&['author','category'].includes(link.dataset.browse)){if(event.ctrlKey||event.metaKey||event.shiftKey||event.altKey||event.button>0)return;event.preventDefault();browse(link.dataset.browse);return} const item=event.target.closest('[data-detail]');if(item){if(item.tagName==='A'){if(event.ctrlKey||event.metaKey||event.shiftKey||event.altKey||event.button>0)return;event.preventDefault()} if(view.hidden!==false||!item.closest||item.closest('#recordView'))open(item.dataset.detail,item)}});
 document.getElementById('recordBack').addEventListener('click',close);
 document.getElementById('recordFavorite').addEventListener('click',()=>{if(!current)return;favorites.has(current.id)?favorites.delete(current.id):favorites.add(current.id);saveFavorites();render();renderRecord();const star=document.getElementById('recordFavorite');star.setAttribute('aria-pressed',String(favorites.has(current.id)))});
 document.getElementById('recordShare').addEventListener('click',async()=>{if(!current)return;const u=shareUrl(current);try{await navigator.clipboard.writeText(u.href);toast(t('linkCopied'))}catch{document.getElementById('recordShareFallback').hidden=false;const input=document.getElementById('recordShareUrl');input.value=u.href;input.focus();input.select()}});
 document.addEventListener('click',event=>{const cite=event.target.closest('#recordCiteCopy');if(cite&&current){copyText(citation(current).full,t('citedCopied'));return}const card=event.target.closest('#recordShareCard');if(card&&current)drawShareCard(current)});
 async function copyText(text,doneKey){try{await navigator.clipboard.writeText(text);toast(t(doneKey))}catch{document.getElementById('recordShareFallback').hidden=false;const input=document.getElementById('recordShareUrl');input.value=text;input.focus();input.select()}}

 /* Paylaşım kartı: 1200×630 PNG, tamamen istemci tarafında, çevrimdışı. */
 function drawShareCard(r){const c=document.createElement('canvas');if(!c.getContext)return;const g=c.getContext('2d');if(!g)return;c.width=1200;c.height=630;
  const grad=g.createLinearGradient(0,0,1200,630);grad.addColorStop(0,'#04070E');grad.addColorStop(.65,'#08172A');grad.addColorStop(1,'#13324A');g.fillStyle=grad;g.fillRect(0,0,1200,630);
  let seed=0;for(const ch of String(r.id))seed=(seed*31+ch.charCodeAt(0))>>>0;const rnd=()=>((seed=(seed*1103515245+12345)&0x7fffffff)/0x7fffffff);
  for(let i=0;i<130;i++){g.globalAlpha=.2+rnd()*.55;g.fillStyle='#FAF6EC';g.beginPath();g.arc(rnd()*1200,rnd()*430,.4+rnd()*1.5,0,7);g.fill()}g.globalAlpha=1;
  g.fillStyle='#E8CE9E';g.beginPath();g.arc(1010,150,5,0,7);g.fill();g.strokeStyle='#E8CE9E44';g.beginPath();g.ellipse(1010,150,88,30,-.5,0,7);g.stroke();
  g.fillStyle=SPINE[recordArtIndex(r)];g.fillRect(84,148,8,196);
  g.fillStyle='#E8CE9E';g.font='500 21px "IBM Plex Mono",monospace';g.fillText((catalogNo(r)+' · '+(r.year||t('brand'))).toUpperCase(),122,170);
  g.fillStyle='#FAF6EC';g.font='400 54px Fraunces,Georgia,serif';let line='',y=238;for(const word of String(displayTitle(r)).split(' ')){const test=line?line+' '+word:word;if(g.measureText(test).width>880&&line){g.fillText(line,122,y);line=word;y+=68;if(y>420)break}else line=test}if(line&&y<=420)g.fillText(line,122,y);
  g.fillStyle='#9FB8C8';g.font='400 26px Inter,system-ui,sans-serif';g.fillText(String(r.author).slice(0,70),124,Math.min(y+ (line?68:0)+30,470));
  g.fillStyle='#FAF6EC';g.font='400 30px Fraunces,Georgia,serif';g.fillText(t('brand'),84,566);
  g.fillStyle='#9FB8C8';g.font='400 17px "IBM Plex Mono",monospace';g.fillText('DEC +41°16′ · RA 12h 30m · '+label(r.collection),360,566);
  try{c.toBlob(blob=>{if(!blob)return;const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='bilim-kutuphanem-'+catalogNo(r)+'.png';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),4000);toast(t('shareCardDone'))},'image/png')}catch{}}

 function onPop(){const id=urlHasRecord();const openNow=view.hidden===false;if(id&&records.some(r=>r.id===id)){if(!openNow||current.id!==id)open(id)}else if(!id&&openNow)close()}
 if(typeof window!=='undefined'&&window.addEventListener)window.addEventListener('popstate',onPop);

 /* FAZ-6 · Kayıt görünümü klavye uygarlığı: j/k komşu yolculuğu, s yıldız, c alıntı. */
 let travelList=[],travelIndex=0;
 const press=el=>{if(!el)return;if(el.click)el.click();else if(el.handlers&&el.handlers.click)el.handlers.click()};
 function travel(dir){if(!current)return;if(!travelList.some(n=>n.id===current.id)){travelList=[current,...relatedRecords(current,8)];travelIndex=0}if(travelList.length<2)return;travelIndex=(travelIndex+dir+travelList.length)%travelList.length;open(travelList[travelIndex].id,null)}
 document.addEventListener('keydown',event=>{if(view.hidden!==false||event.ctrlKey||event.metaKey||event.altKey)return;if(['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName))return;if(typeof window!=='undefined'&&window.paletteIsOpen&&(window.paletteIsOpen()||window.shortcutsIsOpen()))return;const key=String(event.key).toLowerCase();
  if(key==='j'){event.preventDefault();travel(1)}else if(key==='k'){event.preventDefault();travel(-1)}else if(key==='s'){event.preventDefault();press(document.getElementById('recordFavorite'))}else if(key==='c'&&current){event.preventDefault();copyText(citation(current).full,'citedCopied')}});

 function ready(){const id=new URLSearchParams(location.search).get('record');if(id&&records.some(r=>r.id===id))open(id)}
 document.addEventListener('library:ready',ready);
 document.addEventListener('library:language',()=>{if(current)renderRecord()});
 if(records.length)ready();
 if(typeof window!=='undefined')Object.assign(window,{openRecord:open,closeRecord:close,recordCurrent:()=>current,recordCover:recordCover});
})();
