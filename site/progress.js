'use strict';
/* Reader progress & small living details.
   • Reading paths remember what you opened: a ✓ on each step, a progress ring + "n/N" on each route, "continue where you left off".
   • Archive cards get an orbital completion ring.
   • The three headline stats are real filters (books, Nobel documents, PDFs).
   • Footer: section map + build version. Everything is local (localStorage); nothing is sent anywhere. */
(()=>{
 if(typeof document==='undefined')return;
 const KEY='bk-read';
 const load=()=>{try{return new Set(JSON.parse(localStorage.getItem(KEY)||'[]'))}catch{return new Set()}};
 const save=s=>{try{localStorage.setItem(KEY,JSON.stringify([...s].slice(-800)))}catch{}};
 let read=load();
 const $$=id=>document.getElementById(id);
 const ring=(p,label)=>`<span class="rp-ring" style="--p:${p}" role="img" aria-label="${label}"><svg viewBox="0 0 36 36" aria-hidden="true"><circle class="bg" cx="18" cy="18" r="15"></circle><circle class="fg" cx="18" cy="18" r="15" pathLength="100"></circle></svg><b aria-hidden="true">${label}</b></span>`;

 /* ---- reading paths ---- */
 function applyRoutes(){
  const list=$$('routeList');if(!list||!list.querySelectorAll)return;
  list.querySelectorAll('.route-card').forEach(card=>{
   const links=[...card.querySelectorAll('.route-body li a[data-detail]')];if(!links.length)return;
   let n=0;links.forEach(a=>{const done=read.has(a.dataset.detail);if(done)n++;a.parentElement.classList.toggle('is-read',done);a.setAttribute('data-read',done?'1':'0')});
   const sum=card.querySelector('summary');if(!sum)return;let slot=sum.querySelector('.rp-slot');if(!slot){slot=document.createElement('span');slot.className='rp-slot';const exp=sum.querySelector('.route-expand');sum.insertBefore(slot,exp||null)}
   const pct=Math.round(n/links.length*100),lab=`${n}/${links.length}`;slot.innerHTML=ring(pct,lab);slot.title=(typeof t==='function'?t('rpRead'):'')+' '+lab;
   card.classList.toggle('is-done',n===links.length)})}
 function markCurrent(){if(typeof window.recordCurrent!=='function')return;const r=window.recordCurrent();if(!r||read.has(r.id))return;read.add(r.id);save(read);applyRoutes()}
 const rv=$$('recordView');
 if(rv&&typeof MutationObserver==='function')new MutationObserver(()=>{if(!rv.hidden)setTimeout(markCurrent,350)}).observe(rv,{attributes:true,attributeFilter:['hidden']});
 const rl=$$('routeList');if(rl&&typeof MutationObserver==='function')new MutationObserver(()=>applyRoutes()).observe(rl,{childList:true});
 document.addEventListener('library:ready',()=>setTimeout(applyRoutes,200));document.addEventListener('library:language',()=>setTimeout(applyRoutes,200));

 /* ---- archive rings ---- */
 function applyArchive(){
  const box=$$('archiveProgress');if(!box||!box.querySelectorAll)return;
  box.querySelectorAll('.archive-sync-card').forEach(card=>{if(card.querySelector('.rp-ring'))return;const pr=card.querySelector('progress');if(!pr)return;const max=Number(pr.max)||1,p=Math.round(Number(pr.value)/max*100);
   const head=card.querySelector('.archive-sync-heading');if(!head)return;head.insertAdjacentHTML('afterbegin',ring(p,p+'%'));card.classList.add('has-ring')})}
 const ap=$$('archiveProgress');if(ap&&typeof MutationObserver==='function')new MutationObserver(applyArchive).observe(ap,{childList:true});
 document.addEventListener('library:ready',()=>setTimeout(applyArchive,250));

 /* ---- stats are filters ---- */
 document.addEventListener('click',e=>{const b=e.target.closest?e.target.closest('[data-stat]'):null;if(!b)return;
  try{reset();const k=b.dataset.stat;if(k==='books')$('collection').value='books';else if(k==='nobel')$('collection').value='nobel';else if(k==='pdf')$('availability').value='ready';populateFilters();render();const c=$$('catalog');if(c)c.scrollIntoView({block:'start'})}catch{}});

 /* ---- footer: section map + build ---- */
 function footer(){
  const base=document.querySelector('.footer-base');if(!base||base.dataset.v)return;base.dataset.v='1';
  const src=document.querySelector('script[src*="app.js"]'),v=src&&(src.getAttribute('src').match(/v=(\d+)/)||[])[1];
  if(v){const s=document.createElement('span');s.className='footer-ver';s.textContent='BUILD v'+v;s.setAttribute('aria-label','Build '+v);base.insertBefore(s,base.lastElementChild)}}
 footer();
})();
