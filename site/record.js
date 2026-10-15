'use strict';
/* FAZ-5 · Record page. Replaces the FAZ-4 dialog: full-page node view with View Transitions, academic details,
   one-click citation and the discovery constellation. URL/focus/back-button contract is unchanged:
   ?record=<id> opens on library:ready, back/popstate and Escape close, focus returns to the opener, page is inert + scroll-locked. */
(()=>{
 const view=document.getElementById('record-view'),$$=id=>document.getElementById(id);
 let current=null,returnFocus=null,returnId=null,previousOverflow,inertElements=[],pushed=false;
 const META={};
 const isOpen=()=>view.hidden===false;
 const calm=()=>!!document.documentElement.classList&&document.documentElement.classList.contains('effects-paused');
 function shareUrl(r){const u=new URL(location.href);u.search='';u.searchParams.set('record',r.id);u.searchParams.set('ui',uiLang);u.hash='';return u.href}
 function citeText(r){const title=String(displayTitle(r)).trim().replace(/[.\s]+$/,''),author=String(r.author||'').trim().replace(/[.\s]+$/,'');return t('citeTemplate').replace('{author}',author?author+'. ':'').replace('{title}',title).replace('{collection}',t(r.collection)).replace('{year}',r.year?', '+r.year:'').replace('{url}',shareUrl(r))}
 /* Open Graph: static defaults live in index.html; an open record swaps in its own card (tools/og_cards.py), closing restores them. */
 function setMeta(r){for(const prop of ['og:title','og:description','og:image','og:url','twitter:image']){const el=document.querySelectorAll('meta[property="'+prop+'"],meta[name="'+prop+'"]')[0];if(!el)continue;if(!(prop in META))META[prop]=el.getAttribute('content');let v=META[prop];if(r){if(prop==='og:title')v=displayTitle(r)+' — '+t('brand');else if(prop==='og:description')v=(displayDescription(r)||r.author||'').slice(0,200);else if(prop==='og:url')v=shareUrl(r);else v=new URL('og/'+r.id+'.png',location.href).href}el.setAttribute('content',v)}}
 function lock(){previousOverflow=document.body.style.overflow;document.body.style.overflow='hidden';inertElements=[...document.querySelectorAll('header,main,footer,.motion-toggle,.skip')].map(el=>[el,el.inert]);inertElements.forEach(([el])=>el.inert=true)}
 function unlock(){document.body.style.overflow=previousOverflow;inertElements.forEach(([el,wasInert])=>el.inert=wasInert);inertElements=[]}
 function recordUrl(id){const u=new URL(location.href);if(id)u.searchParams.set('record',id);else u.searchParams.delete('record');return u}
 /* Morph source: the shelf cover, or the card/ledger row the reader clicked. View-transition names are scoped to one transition. */
 function morphSource(el){if(!el||typeof el.closest!=='function')return null;const shelf=el.closest('.spotlight-card');if(shelf)return shelf.querySelector('.catalog-cover');return el.closest('.card,.ledger-row')}
 function name(el,on){if(el&&el.style)el.style.viewTransitionName=on?'record-art':''}
 function transition(update,from,to,skip){
  if(skip||typeof document.startViewTransition!=='function'||calm()){update();return}
  name(from,true);
  try{const vt=document.startViewTransition(()=>{name(from,false);update();name(to,true)});const done=()=>name(to,false);vt.finished.then(done,done)}catch{name(from,false);update();name(to,false)}
 }
 function renderDetail(){
  if(!current)return;const r=current;
  $$('detailArt').innerHTML=cover(r);
  $$('detailKunye').textContent=[catalogNo(r),t(r.collection),r.year].filter(Boolean).join(' · ');
  $$('detailCategory').textContent=label(r.category).replace(/^\d+ - /,'');
  $$('detailTitle').textContent=displayTitle(r);
  $$('detailAuthor').textContent=r.author;
  $$('detailDescription').textContent=displayDescription(r)||t('noDescription');
  $$('detailMetadata').innerHTML=[['language',label(r.language)],['kind',label(r.kind)],['level',label(r.level)],['year',r.year],['pages',r.pages]].filter(([,v])=>v).map(([key,v])=>`<div><dt>${esc(t(key))}</dt><dd>${esc(v)}</dd></div>`).join('');
  $$('detailAccess').textContent=t(safeUrl(r.drive)?'ready':r.collection==='awards'?'sourceOnly':'pending');
  $$('detailLinks').innerHTML=`${safeUrl(r.drive)?`<a class="primary" href="${esc(safeUrl(r.drive))}" target="_blank" rel="noopener">${t(r.format==='pdf'?'pdf':'file')}</a>`:''}${sourceLink(r)}`;
  renderFavorite();
  $$('detailClose').setAttribute('aria-label',t('backToCatalog'));
  $$('detailShare').textContent=t('copyRecordLink');
  $$('detailCite').textContent=t('cite');
  $$('detailCiteText').textContent=citeText(r);
  $$('detailVisualNote').textContent=t('coverNote');
  $$('detailNote').textContent=t('originalNote');
  renderConstellation(r);renderExplore(r);
 }
 function renderFavorite(){const star=$$('detailFavorite'),on=!!current&&favorites.has(current.id);star.textContent=(on?'★ ':'☆ ')+t(on?'remove':'add');star.setAttribute('aria-pressed',String(on))}
 /* Constellation: same neighbours as the FAZ-4 related panel (relatedRecords), drawn as up to 8 nodes around the open record.
    The svg is decorative-but-labelled (role=img); nodes are real buttons; the list below is the text equivalent. */
 function renderConstellation(r){
  const list=relatedRecords(r,8),n=list.length;$$('detailRelated').hidden=!n;
  $$('detailRelatedTitle').textContent=t('relatedTitle');$$('detailRelatedNote').textContent=t('relatedNote');
  const pts=list.map((_,i)=>{const a=-Math.PI/2+i*2*Math.PI/n;return [50+41*Math.cos(a),50+34*Math.sin(a)]});
  const summary=t('constellationSummary').replace('{title}',displayTitle(r)).replace('{count}',n);
  $$('detailGraph').innerHTML=`<svg class="rv-links" viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="${esc(summary)}" focusable="false"><circle class="rv-ring" cx="50" cy="50" r="22" vector-effect="non-scaling-stroke"></circle>${pts.map(([x,y])=>`<line x1="50" y1="50" x2="${x.toFixed(2)}" y2="${y.toFixed(2)}" vector-effect="non-scaling-stroke"></line>`).join('')}</svg><div class="rv-center spine-${recordArtIndex(r)}" aria-hidden="true"><small>${esc(catalogNo(r))}</small><strong>${esc(displayTitle(r))}</strong></div>${list.map((item,i)=>`<button type="button" class="rv-node spine-${recordArtIndex(item)}" style="left:${pts[i][0].toFixed(2)}%;top:${pts[i][1].toFixed(2)}%;--i:${i}" data-detail="${esc(item.id)}" aria-label="${esc(displayTitle(item)+' — '+item.author)}" title="${esc(t('nodeJump'))}"><span class="rv-dot" aria-hidden="true"></span><span class="rv-node-label" aria-hidden="true"><strong>${esc(displayTitle(item))}</strong><small>${esc(item.author)}</small></span></button>`).join('')}`;
  $$('detailRelatedGrid').innerHTML=list.map(item=>`<li><button type="button" class="rv-row spine-${recordArtIndex(item)}" data-detail="${esc(item.id)}"><span class="rv-row-no">${esc(catalogNo(item))}</span><span class="rv-row-title">${esc(displayTitle(item))}</span><span class="rv-row-author">${esc(item.author)}</span><span class="rv-row-meta">${esc(label(item.language))}${item.year?' · '+esc(item.year):''}</span><span class="rv-row-arrow" aria-hidden="true">↗</span></button></li>`).join('');
 }
 function browseUrl(record,kind){const params=new URLSearchParams({ui:uiLang});if(kind==='author')params.set('author',record.author);else{params.set('collection',record.collection);params.set('category',record.category)}return location.pathname+'?'+params+'#catalog'}
 function renderExplore(record){const authorCount=record.author?records.filter(other=>norm(other.author)===norm(record.author)).length:0,fieldCount=records.filter(other=>other.collection===record.collection&&other.category===record.category).length;$$('detailExplore').innerHTML=[...(authorCount?[{kind:'author',text:t('browseAuthor'),value:record.author,count:authorCount}]:[]),{kind:'category',text:t('browseField'),value:label(record.category).replace(/^\d+ - /,''),count:fieldCount}].map(item=>`<a href="${esc(browseUrl(record,item.kind))}" data-browse="${item.kind}" aria-label="${esc(item.text+': '+item.value+' · '+item.count+' '+t('records'))}"><span>${esc(item.text)}<small>${item.count.toLocaleString(locale())} ${t('records')}</small></span><span aria-hidden="true">↗</span></a>`).join('')}
 /* opts.history: 'push' (default when opening) | 'replace' | 'none' (popstate / deep link already hold the right entry). */
 function openRecord(id,opts={}){
  const r=records.find(x=>x.id===id);if(!r)return;
  const wasOpen=isOpen(),from=wasOpen?null:morphSource(opts.trigger||document.activeElement);
  if(!wasOpen){returnFocus=document.activeElement;returnId=opts.trigger&&opts.trigger.dataset?opts.trigger.dataset.detail:id;lock()}
  document.getElementById('detailShareFallback').hidden=true;
  transition(()=>{current=r;renderDetail();view.hidden=false;view.scrollTop=0;setMeta(r);$$('detailTitle').focus({preventScroll:true})},from,$$('detailArt'));
  const mode=opts.history||(wasOpen||new URLSearchParams(location.search).get('record')===id?'replace':'push');
  if(mode==='push'&&typeof history.pushState==='function'){history.pushState({bkRecord:id},'',recordUrl(id));pushed=true}
  else if(mode==='replace'){try{history.replaceState(pushed?{bkRecord:id}:history.state,'',recordUrl(id))}catch{}}
 }
 /* Hide the page. opts.url: strip ?record= (UI close); opts.focus=false: skip focus return (browse hand-off); popstate passes url:false. */
 function hideRecord(opts={}){
  if(!isOpen())return;
  const back=opts.focus===false?null:returnFocus,id=returnId;
  /* Focus moves inside the update callback: the page is still inert until unlock() has run. */
  const update=()=>{view.hidden=true;current=null;unlock();setMeta(null);focusOpener(back,id)};
  transition(update,$$('detailArt'),opts.transition===false?null:morphSource(back),opts.transition===false);
  if(opts.url!==false){try{history.replaceState(pushed?null:history.state,'',recordUrl(null))}catch{}pushed=false}
  returnFocus=null;
 }
 /* The opener may have been re-rendered (a star toggle rebuilds the cards): fall back to the same record's control. */
 function focusOpener(el,id){let target=el&&el.isConnected?el:null;if(!target&&id&&typeof document.querySelector==='function')target=document.querySelector('#cards [data-detail="'+id+'"]');if(target&&typeof target.focus==='function')target.focus({preventScroll:true})}
 /* UI close: if this session pushed the entry, pop it so back/forward stay symmetric; popstate then hides the page. */
 function closeRecord(){if(!isOpen())return;if(pushed&&typeof history.back==='function'){history.back();return}hideRecord()}
 function browse(kind){if(!current)return;const record=current;hideRecord({focus:false,transition:false});reset();if(kind==='author')authorFacet=record.author;else $('collection').value=record.collection;populateFilters();if(kind==='category')$('category').value=record.category;render();$('cards').scrollIntoView({block:'start'});$('cards').querySelector('.title-detail')?.focus({preventScroll:true})}
 async function copyText(text,doneKey,labelKey){try{await navigator.clipboard.writeText(text);toast(t(doneKey))}catch{const box=$$('detailShareFallback'),input=$$('detailShareUrl');$$('detailShareLabel').textContent=t(labelKey);box.hidden=false;input.value=text;input.focus();input.select()}}
 document.addEventListener('click',event=>{const link=event.target.closest('[data-browse]');if(link&&['author','category'].includes(link.dataset.browse)){if(event.ctrlKey||event.metaKey||event.shiftKey||event.altKey||event.button>0)return;event.preventDefault();browse(link.dataset.browse);return}const item=event.target.closest('[data-detail]');if(item){if(item.tagName==='A'){if(event.ctrlKey||event.metaKey||event.shiftKey||event.altKey||event.button>0)return;event.preventDefault()}openRecord(item.dataset.detail,{trigger:item})}});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&isOpen()){event.preventDefault();closeRecord()}});
 $$('detailClose').addEventListener('click',closeRecord);
 $$('detailFavorite').addEventListener('click',()=>{if(!current)return;favorites.has(current.id)?favorites.delete(current.id):favorites.add(current.id);saveFavorites();render();renderFavorite()});
 $$('detailShare').addEventListener('click',()=>{if(current)copyText(shareUrl(current),'linkCopied','recordLink')});
 $$('detailCite').addEventListener('click',()=>{if(current)copyText(citeText(current),'citedCopied','citeLabel')});
 if(typeof addEventListener==='function')addEventListener('popstate',event=>{pushed=!!(event.state&&event.state.bkRecord);const id=new URLSearchParams(location.search).get('record');if(id){if(!current||current.id!==id)openRecord(id,{history:'none'})}else hideRecord({url:false})});
 function ready(){const id=new URLSearchParams(location.search).get('record');if(id&&!isOpen())openRecord(id,{history:'none'})}
 document.addEventListener('library:ready',ready);document.addEventListener('library:language',()=>{if(current){renderDetail();setMeta(current)}});if(records.length)ready();
})();
