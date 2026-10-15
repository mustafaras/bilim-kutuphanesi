'use strict';
/* FAZ-4 · Faset rayı — canlı sayımlı sol ray (≥1024px). Mevcut <select> süzgeçleri
   tek doğruluk kaynağı olarak kalır: ray onları okur, değiştirir ve change olayını tetikler. */
(function(){
 const FACETS=[['collection','collection'],['category','field'],['language','language'],['kind','kind'],['level','level'],['availability','availability']];
 const ACCESS=['ready','pending','source'];
 const open=new Set(['collection','category','language']);
 let timer=0;
 const el=id=>document.getElementById(id);
 const valuesOf=(r,id)=>id==='availability'?[safeUrl(r.drive)?'ready':null,r.collection!=='awards'&&!safeUrl(r.drive)?'pending':null,safeUrl(r.source)?'source':null].filter(Boolean):[String(r[id]||'')];
 function counts(id){const map=new Map();for(const r of matchRecords(id))for(const v of valuesOf(r,id))map.set(v,(map.get(v)||0)+1);return map}
 const optionsOf=id=>Array.from(el(id).options).map(o=>({value:o.value,text:['category','language','kind','level'].includes(id)?o.textContent.replace(/^\d+ - /,''):o.textContent}));
 function build(){
  const rail=el('facetRail');if(!rail||!records.length)return;
  const active=document.activeElement,key=active&&active.dataset&&active.dataset.fkey;
  const total=matchRecords('').length;
  let html=`<div class="facet-head"><h3>${esc(t('filterPanelTitle'))}</h3><button type="button" class="facet-clear" data-clear${FILTERS.some(id=>id!=='sort'&&el(id).value)||authorFacet?'':' disabled'}>${esc(t('clear'))}</button></div>`;
  for(const [id,labelKey] of FACETS){
   const map=counts(id),current=el(id).value,isOpen=open.has(id),opts=optionsOf(id);
   const all=`<li><label class="facet-opt"><input type="radio" name="f-${id}" value="" data-fkey="${id}|" ${current===''?'checked':''}><span class="facet-box" aria-hidden="true"></span><span class="facet-text">${esc(t('all'))}</span><b class="facet-count">${[...map.values()].reduce((a,b)=>a+b,0).toLocaleString(locale())}</b></label></li>`;
   const rows=opts.filter(o=>o.value!=='').map(o=>{const n=map.get(o.value)||0,sel=current===o.value,off=!n&&!sel;return `<li><label class="facet-opt${off?' is-zero':''}"><input type="radio" name="f-${id}" value="${esc(o.value)}" data-fkey="${id}|${esc(o.value)}" ${sel?'checked':''}${off?' disabled':''}><span class="facet-box" aria-hidden="true"></span><span class="facet-text">${esc(o.text)}</span><b class="facet-count">${n.toLocaleString(locale())}</b></label></li>`}).join('');
   const picked=current?(opts.find(o=>o.value===current)||{}).text:'';
   html+=`<section class="facet${isOpen?' is-open':''}"><h4><button type="button" class="facet-toggle" aria-expanded="${isOpen}" aria-controls="facet-${id}" data-toggle="${id}" data-fkey="t|${id}"><span>${esc(t(labelKey))}</span>${picked?`<em>${esc(picked)}</em>`:''}<i aria-hidden="true"></i></button></h4><ul id="facet-${id}" class="facet-body"${isOpen?'':' hidden'}>${all}${rows}</ul></section>`;
  }
  const yr=(id,k)=>`<label class="facet-select"><span>${esc(t(k))}</span><select data-sync="${id}" data-fkey="s|${id}">${el(id).innerHTML}</select></label>`;
  html+=`<section class="facet is-open"><h4><span class="facet-static">${esc(t('yearRange'))}</span></h4><div class="facet-years">${yr('yearFrom','yearFrom')}${yr('yearTo','yearTo')}</div></section>`;
  html+=`<section class="facet is-open"><h4><span class="facet-static">${esc(t('sort'))}</span></h4><div class="facet-years">${yr('sort','sort')}</div></section>`;
  rail.innerHTML=html;
  for(const s of rail.querySelectorAll('select[data-sync]'))s.value=el(s.dataset.sync).value;
  rail.setAttribute('data-total',total);
  if(key){const back=rail.querySelector(`[data-fkey="${key.replace(/"/g,'\\"')}"]`);if(back&&!back.disabled)back.focus({preventScroll:true})}
 }
 window.renderFacetRail=function(){clearTimeout(timer);timer=setTimeout(build,60)};
 window.facetAlternatives=function(){
  const out=[];
  for(const [id,labelKey] of FACETS){const cur=el(id).value;if(!cur)continue;const opts=optionsOf(id),map=counts(id);for(const o of opts){if(!o.value||o.value===cur)continue;const n=map.get(o.value)||0;if(n)out.push({id,value:o.value,count:n,text:t(labelKey)+': '+o.text})}}
  if(!out.length)for(const [id,labelKey] of FACETS){if(!el(id).value)continue;const n=matchRecords(id).length;if(n)out.push({id,value:'',count:n,text:t('removeFilter')+': '+t(labelKey)})}
  if(!out.length&&el('query').value){const n=matchRecords('query').length;if(n)out.push({id:'query',value:'',count:n,text:t('removeFilter')+': '+t('search')})}
  return out.sort((a,b)=>b.count-a.count).slice(0,3);
 };
 document.addEventListener('DOMContentLoaded',()=>{
  const rail=el('facetRail');if(!rail)return;
  const fire=(id,v)=>{const s=el(id);s.value=v;s.dispatchEvent(new Event('change',{bubbles:true}))};
  rail.addEventListener('change',event=>{const t0=event.target;if(t0.matches('input[type=radio]')){fire(t0.name.slice(2),t0.value)}else if(t0.matches('select[data-sync]'))fire(t0.dataset.sync,t0.value)});
  rail.addEventListener('click',event=>{const tg=event.target.closest('[data-toggle]');if(tg){const id=tg.dataset.toggle;open.has(id)?open.delete(id):open.add(id);build();return}if(event.target.closest('[data-clear]')){el('clear').click()}});
 });
})();
