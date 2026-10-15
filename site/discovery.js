'use strict';
/* FAZ-5: kayıt detayı record.js'e taşındı — burada yalnız vitrin rafı kalır. */
(()=>{
 const choices=['f1e533fac4fc119031a8','91ad8c65d92e25801768','635e076e22eebfbb8889','3dd6d02cf85e782fb067'];
 function renderShelf(){document.getElementById('spotlightGrid').innerHTML=choices.map(id=>records.find(r=>r.id===id)).filter(Boolean).map(r=>`<button class="spotlight-card" aria-label="${esc(displayTitle(r))} — ${esc(r.author)}" data-detail="${r.id}">${window.recordCover(r)}<span class="shelf-edge" aria-hidden="true"></span><span class="spotlight-caption"><span>${esc(label(r.language))}</span><span>${t('viewDetails')} ↗</span></span></button>`).join('')}
 function ready(){renderShelf()}
 document.addEventListener('library:ready',ready);
 document.addEventListener('library:language',()=>{if(records.length)renderShelf()});
 if(records.length)ready();
})();
