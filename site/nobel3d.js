'use strict';
/* Nobel Galaxy — the 1901→today archive as one spiral: every non-book record is a star, one turn-and-a-bit per generation,
   colour = prize category. Select a year (click) → the dossier below updates through the same control the chart uses;
   double-click a star → opens that record; drag to orbit; Ctrl+wheel / buttons to zoom. The accessible chart stays the default view. */
(()=>{
 const section=document.getElementById('timeline');
 if(!section||typeof document.createElement!=='function')return;
 const reduced=typeof matchMedia==='function'?matchMedia('(prefers-reduced-motion: reduce)'):{matches:false};
 const root=document.documentElement,CATC=['#e8c58a','#7fcdb4','#d9909f','#b4a1e2','#8fbaf0','#e59a6e','#8fa3ad'];
 const hasGL=()=>{try{const c=document.createElement('canvas');return!!(c.getContext('webgl2')||c.getContext('webgl'))}catch{return false}};

 /* shared filter: legend chips in the HUD drive Skyline, Galaxy and Chart at once */
 const NF=window.NobelFilter={on:new Array(7).fill(true),set(c,iso){const on=this.on;if(iso){on.fill(false);on[c]=true}else{on[c]=!on[c];if(!on.slice(0,6).some(Boolean))on.fill(true)}section.querySelector('.nobel-chronicle').dataset.off=on.map((v,i)=>v?'':i).filter(x=>x!=='').join(' ');document.dispatchEvent(new Event('nobel:filter'))}};
 let mounted=false;
 function mount(){
  if(mounted||!hasGL())return;const chart=section.querySelector('.nc-chart');if(!chart||typeof records==='undefined'||!records.length)return;mounted=true;
  if(window.BKTransition)BKTransition.init();   /* R10.a: load three for the transition pass while the user is still reading the chart */
  const sw=document.createElement('div');sw.className='nc-viewswitch';sw.setAttribute('role','group');
  const panel=document.createElement('div');panel.className='nc-3d';panel.hidden=true;
  chart.parentNode.insertBefore(panel,chart.nextSibling);
  const chron=section.querySelector('.nobel-chronicle'),head=chron.querySelector('.nc-head');
  /* head = three big figures + view switch; the old meta line and the duplicate legend are retired */
  const years=[...(typeof nobelIndex!=='undefined'&&nobelIndex?nobelIndex.keys():[])].sort();
  const stats=document.createElement('div');stats.className='nc-stats';head.insertBefore(stats,head.firstChild);head.appendChild(sw);
  /* HUD = live readout + category chips (shared by all three views) */
  const hud=document.createElement('div');hud.className='nc-hud';hud.innerHTML='<div class="nc-read" aria-live="polite"><p class="nc-read-k"></p><p class="nc-read-y"></p><p class="nc-read-m"></p><i class="nc-read-bar"></i></div><div class="nc-chips" role="group"></div>';
  chart.parentNode.insertBefore(hud,chart);const chips=hud.querySelector('.nc-chips');
  const CN=i=>typeof nobelCatLabel==='function'?nobelCatLabel(i):String(i);
  const tot=new Array(7).fill(0);if(typeof nobelIndex!=='undefined'&&nobelIndex)nobelIndex.forEach(e=>e.cats.forEach((c,i)=>tot[i]+=c));
  const drawChips=()=>{chips.innerHTML=CATC.slice(0,6).map((c,i)=>`<button type="button" data-c="${i}" aria-pressed="${NF.on[i]}" style="--c:${c}"><i></i><span>${esc(CN(i))}</span><small>${tot[i]}</small></button>`).join('');
   const idx=typeof nobelIndex!=='undefined'&&nobelIndex?nobelIndex:null;if(idx&&idx.size){const ys=[...idx.keys()].sort();let peak=ys[0],n=0;ys.forEach(y=>{n+=idx.get(y).total;if(idx.get(y).total>idx.get(peak).total)peak=y});
    stats.innerHTML=`<div><b>${Number(ys[ys.length-1])-Number(ys[0])+1}</b><span>${esc(t('ncStYears'))}</span></div><div><b>${n.toLocaleString(locale())}</b><span>${esc(t('ncStRecords'))}</span></div><div><b>${peak}</b><span>${esc(t('ncStPeak'))}</span></div>`}};
  drawChips();document.addEventListener('library:language',drawChips);document.addEventListener('nobel:filter',()=>{chips.querySelectorAll('[data-c]').forEach(b=>b.setAttribute('aria-pressed',String(NF.on[Number(b.dataset.c)])))});
  chips.addEventListener('click',e=>{const b=e.target.closest?e.target.closest('[data-c]'):null;if(!b)return;NF.set(Number(b.dataset.c),e.shiftKey||e.altKey||NF.on.slice(0,6).every(Boolean))});
  const rd={k:hud.querySelector('.nc-read-k'),y:hud.querySelector('.nc-read-y'),m:hud.querySelector('.nc-read-m'),bar:hud.querySelector('.nc-read-bar')};let hoverY=0,lastShown='';
  function readout(){const sel=typeof nobelYear!=='undefined'&&nobelYear?nobelYear:'',y=hoverY?String(hoverY):sel;const key=y+'|'+(hoverY?1:0)+'|'+document.documentElement.lang;if(key===lastShown)return;lastShown=key;
   const idx=typeof nobelIndex!=='undefined'&&nobelIndex?nobelIndex:null,e=idx&&idx.get(y);if(!e){rd.y.textContent='—';rd.k.textContent='';rd.m.textContent='';rd.bar.innerHTML='';return}
   rd.k.textContent=t(hoverY?'ncRdHover':'ncRdSel');rd.y.textContent=y;rd.m.textContent=e.total.toLocaleString(locale())+' '+t('records')+' · '+e.laureates.length+' '+t('ncRdLaur');
   rd.bar.innerHTML=e.cats.slice(0,6).map((c,i)=>c?`<b style="flex:${c};background:${CATC[i]}"></b>`:'').join('')}
  document.addEventListener('nobel:hover',ev=>{hoverY=ev.detail||0;readout()});setInterval(readout,350);readout();
  chart.addEventListener('pointerover',e=>{const b=e.target.closest?e.target.closest('.nc-year'):null;if(b&&!b.classList.contains('is-empty')){hoverY=Number(b.dataset.year);readout()}});chart.addEventListener('pointerleave',()=>{hoverY=0;readout()});
  const sky=document.createElement('div');sky.className='nc-3d nc-sky';sky.hidden=true;
  sky.innerHTML='<canvas></canvas><div class="nc-3d-labels" aria-hidden="true"></div><div class="nc-sky-chip" hidden aria-hidden="true"></div><div class="nc-3d-tip" aria-hidden="true" hidden></div><div class="nc-3d-ctl" role="group"><button type="button" data-z="in">+</button><button type="button" data-z="out">−</button><button type="button" data-z="reset">⌂</button></div>';
  chart.parentNode.insertBefore(sky,chart);
  sky.querySelector('.nc-3d-ctl').setAttribute('aria-label',t('heroZoom'));
  const labelsOf=()=>{sw.setAttribute('aria-label',t('ncViewLabel'));sw.innerHTML=`${window.NobelSkyline?`<button type="button" data-v="skyline" aria-pressed="${view==='skyline'}">${esc(t('ncViewSky'))}</button>`:''}<button type="button" data-v="chart" aria-pressed="${view==='chart'}">${esc(t('ncViewChart'))}</button><button type="button" data-v="galaxy" aria-pressed="${view==='galaxy'}">${esc(t('ncViewGalaxy'))}</button>`;
   if(ui.hint)ui.hint.textContent=t('ncGalaxyHint');if(ui.note)ui.note.textContent=t('ncGalaxyNote')};
  let view=window.NobelSkyline?'skyline':'chart',ui={},booted=false;
  panel.innerHTML=`<canvas aria-hidden="true"></canvas><div class="nc-3d-labels" aria-hidden="true"></div><div class="nc-3d-tip" aria-hidden="true" hidden></div><div class="nc-3d-ctl" role="group"><button type="button" data-z="in">+</button><button type="button" data-z="out">−</button><button type="button" data-z="reset">⌂</button></div><p class="nc-3d-hint"></p><p class="sr-only nc-3d-note"></p>`;
  ui={canvas:panel.querySelector('canvas'),labels:panel.querySelector('.nc-3d-labels'),tip:panel.querySelector('.nc-3d-tip'),hint:panel.querySelector('.nc-3d-hint'),note:panel.querySelector('.nc-3d-note'),ctl:panel.querySelector('.nc-3d-ctl')};
  labelsOf();
  ui.ctl.setAttribute('aria-label',t('heroZoom'));[['in','heroZoomIn'],['out','heroZoomOut'],['reset','heroZoomReset']].forEach(([k,key])=>ui.ctl.querySelector(`[data-z=${k}]`).setAttribute('aria-label',t(key)));
  const setView=v=>{if(morphing)return;{const from=view;if(from!==v&&!reduced.matches&&!(window.BKGL&&BKGL.still)&&MN>0&&ready(from)&&ready(v)){if(crossTo(from,v))return;morphTo(from,v);return}}view=v;chart.hidden=view!=='chart';panel.hidden=view!=='galaxy';sky.hidden=view!=='skyline';labelsOf();
   const shown=view==='galaxy'?panel:view==='skyline'?sky:chart;if(!reduced.matches&&!(window.BKGL&&BKGL.still)){shown.classList.remove('nc-enter');void shown.offsetWidth;shown.classList.add('nc-enter');setTimeout(()=>shown.classList.remove('nc-enter'),900)}
   if(view==='galaxy'){if(!booted){booted=true;boot()}else if(api){api.wake();if(api.enter)api.enter()}}
   if(view==='skyline'&&window.NobelSkyline){const si=window.NobelSkyline.inst;if(si){si.sync();if(si.enter)si.enter()}else window.NobelSkyline.init(sky).then(r=>{if(!r){setView('chart')}})}
   linkKick()};
  sw.addEventListener('click',e=>{const b=e.target.closest?e.target.closest('[data-v]'):null;if(!b)return;setView(b.dataset.v)});
  if(view==='skyline')setTimeout(()=>setView('skyline'),60);
  document.addEventListener('library:language',labelsOf);
  /* a thin light line ties the selected year in the 3D scene to its dossier below */
  const NS='http://www.w3.org/2000/svg',linkSvg=document.createElementNS(NS,'svg');linkSvg.setAttribute('class','nc-link');linkSvg.setAttribute('aria-hidden','true');
  const linkPath=document.createElementNS(NS,'path');linkSvg.appendChild(linkPath);chron.appendChild(linkSvg);
  let linkRaf=0,linkKey='',linkVis=true;
  function linkFrame(){linkRaf=0;if(!linkVis||document.hidden)return;
   const a=view==='skyline'&&window.NobelSkyline&&window.NobelSkyline.inst?window.NobelSkyline.inst.anchor():view==='galaxy'&&api&&api.anchor?api.anchor():null,tgt=section.querySelector('.nc-big');
   if(!a||!tgt||view==='chart'){linkPath.setAttribute('d','');linkSvg.classList.remove('on')}
   else{const cr=chron.getBoundingClientRect(),tr=tgt.getBoundingClientRect(),ax=a.x-cr.left,ay=a.y-cr.top,tx=tr.left-cr.left+Math.min(46,tr.width*.18),ty=tr.top-cr.top+6;
    if(ay<ty-24){const dy=Math.max(70,(ty-ay)*.5);linkPath.setAttribute('d',`M${ax.toFixed(1)},${ay.toFixed(1)} C${ax.toFixed(1)},${(ay+dy).toFixed(1)} ${tx.toFixed(1)},${(ty-dy).toFixed(1)} ${tx.toFixed(1)},${ty.toFixed(1)}`);const k=(typeof nobelYear!=='undefined'?nobelYear:'')+view;if(k!==linkKey){linkKey=k;linkSvg.classList.remove('on');void linkSvg.getBoundingClientRect();linkSvg.classList.add('on')}else linkSvg.classList.add('on')}else{linkPath.setAttribute('d','');linkSvg.classList.remove('on')}}
   if(!reduced.matches&&!root.classList.contains('effects-paused'))linkRaf=requestAnimationFrame(linkFrame)}
  function linkKick(){if(!linkRaf)linkRaf=requestAnimationFrame(linkFrame)}
  if(typeof IntersectionObserver==='function')new IntersectionObserver(es=>{linkVis=es[es.length-1].isIntersecting;if(linkVis)linkKick()}).observe(chron);
  document.addEventListener('nobel:filter',linkKick);addEventListener('scroll',linkKick,{passive:true});addEventListener('resize',linkKick);setTimeout(linkKick,800);
  /* ---- one record = one particle: Grafik ⇄ Silüet ⇄ Galaksi morph the SAME records ----
     chart: a record sits inside its year × category segment; skyline: one block per record in the tower; galaxy: its star.
     Positions are read from whichever view is on screen, the next view is revealed invisibly, then every record flies along a swirling arc. */
  const mrows=records.filter(r=>r.collection!=='books'&&/^\d{4}$/.test(r.year||'')),MN=mrows.length,mYear=new Int16Array(MN),mCat=new Uint8Array(MN),mLvl=new Int16Array(MN),mCnt=new Int16Array(MN),mAward=new Uint8Array(MN);
  {const cnt=new Map();mrows.forEach((r,i)=>{mYear[i]=Number(r.year);mCat[i]=typeof nobelCat==='function'?nobelCat(r):6;mAward[i]=r.collection==='awards'?1:0;const k=mYear[i]*8+mCat[i];mLvl[i]=cnt.get(k)||0;cnt.set(k,mLvl[i]+1)});mrows.forEach((r,i)=>{mCnt[i]=cnt.get(mYear[i]*8+mCat[i])})}
  const mHash=i=>{let x=Math.imul(i+1,2654435761)>>>0;x^=x>>>13;x=Math.imul(x,1274126177)>>>0;return((x^x>>>16)>>>0)/4294967296};
  const mList=mrows.map((r,i)=>({year:mYear[i],c:mCat[i],l:mLvl[i],n:mCnt[i],jx:mHash(i)-.5,jz:mHash(i+977)-.5}));
  let morphing=false;
  const ready=v=>v==='chart'||(v==='skyline'&&window.NobelSkyline&&window.NobelSkyline.inst)||(v==='galaxy'&&booted&&api&&api.projectRecords);
  function positions(v){const xy=new Float32Array(MN*2),al=new Float32Array(MN).fill(1);
   if(v==='chart'){const cache=new Map();for(let i=0;i<MN;i++){const key=mYear[i]*8+mCat[i];let seg=cache.get(key);if(seg===undefined){const el=chart.querySelector(`.nc-year[data-year="${mYear[i]}"] .nc-c${mCat[i]}`)||chart.querySelector(`.nc-year[data-year="${mYear[i]}"]`);seg=el?el.getBoundingClientRect():null;cache.set(key,seg)}
     if(seg){xy[i*2]=seg.left+seg.width*(.5+(mHash(i)-.5)*.55);xy[i*2+1]=seg.bottom-((mLvl[i]+.5)/mCnt[i])*seg.height}else{const cr0=chart.getBoundingClientRect();xy[i*2]=cr0.left+cr0.width/2;xy[i*2+1]=cr0.bottom}al[i]=NF.on[mCat[i]]?1:.12}}
   else if(v==='skyline'){const a=window.NobelSkyline.inst.projectRecords(mList,xy);for(let i=0;i<MN;i++)al[i]=a[i]}
   else{api.projectRecords(xy);for(let i=0;i<MN;i++)al[i]=NF.on[mCat[i]]?1:.12}
   return{xy,al}}
  const easeIO=(window.BKMotion&&BKMotion.ease.inOut3)||(x=>x<.5?4*x*x*x:1-Math.pow(-2*x+2,3)/2),clamp01=x=>x<0?0:x>1?1:x;
  /* ---- R10.a freeze-and-cross: the outgoing view's last frame is frozen into one render target, the incoming view keeps drawing live
     underneath, and BKTransition composites the two on a pointer-events:none canvas that is removed when the transition ends.
     The frozen frame carries the outgoing panel's own CSS radial-gradient, so the composite can hand the incoming scene back through its alpha. */
  const splitTop=s=>{const out=[];let d=0,cur='';for(const ch of s){if(ch==='(')d++;else if(ch===')')d--;if(ch===','&&d===0){out.push(cur);cur=''}else cur+=ch}out.push(cur);return out};
  const bgOf=el=>{const bi=(el&&getComputedStyle(el).backgroundImage)||'',i=bi.indexOf('('),j=bi.lastIndexOf(')'),parts=i>=0&&j>i?splitTop(bi.slice(i+1,j)):[];
   const rgb=s=>{const n=(s||'').match(/[\d.]+/g)||[];return[(+n[0]||0)/255,(+n[1]||0)/255,(+n[2]||0)/255]};
   const a=parts[1]?rgb(parts[1]):[.06,.13,.19],b=parts[2]?rgb(parts[2]):[.02,.06,.1];
   let c=[.5,.5],r=[.8,.9];
   if(parts[0]){const at=parts[0].split(' at '),sz=(at[0]||'').trim().split(/\s+/),ps=(at[1]||'').trim().split(/\s+/);
    if(sz.length>=2)r=[(parseFloat(sz[0])||80)/100,(parseFloat(sz[1])||90)/100];
    if(ps.length>=2)c=[(parseFloat(ps[0])||50)/100,(parseFloat(ps[1])||30)/100]}
   return{a,b,center:c,radii:r}};
  const crossSide=v=>v==='skyline'?(window.NobelSkyline&&window.NobelSkyline.inst)||null:v==='galaxy'?(api&&api.snap?api:null):null;
  function crossTo(from,to){
   const T=window.BKTransition;if(!T||!T.ready)return false;
   const src=crossSide(from),dst=crossSide(to);
   if(!src||!dst||typeof src.snap!=='function')return false;
   const fromPanel=from==='skyline'?sky:panel,toPanel=to==='skyline'?sky:panel,tc=toPanel.querySelector('canvas');
   T.bind({from:()=>({render:()=>src.snap()}),host:()=>toPanel,bg:()=>bgOf(fromPanel),
    end:()=>{morphing=false;chron.classList.remove('nc-morphing');toPanel.style.opacity='';if(tc)tc.style.transition='';linkKick()}});
   /* the incoming panel has to be on screen and its canvas opaque before the composite is built */
   view=to;chart.hidden=true;panel.hidden=view!=='galaxy';sky.hidden=view!=='skyline';labelsOf();
   toPanel.style.transition='none';toPanel.style.opacity='1';
   if(tc){tc.style.transition='none';tc.classList.add('on')}
   if(to==='galaxy'&&api)api.wake();if(to==='skyline'&&window.NobelSkyline.inst)window.NobelSkyline.inst.sync();
   morphing=true;chron.classList.add('nc-morphing');linkSvg.classList.remove('on');
   if(T.run(from==='skyline'?'materialize':'iris'))return true;
   morphing=false;chron.classList.remove('nc-morphing');toPanel.style.opacity='';if(tc)tc.style.transition='';
   return false}
  /* audit hook: hold ONE transition frame at a fixed uT. tools/visual_audit.py captures the intermediate frames of the cross with it and
     tools/gpu_budget_audit.py reads the composite's targets/programs from the same held frame. It only runs when a tool calls it. */
  window.__bkCrossStill=(mode,t)=>{
   const T=window.BKTransition;if(!T||!T.ready)return null;
   const src=crossSide('skyline'),dst=crossSide('galaxy');
   if(!src||!dst)return null;
   T.bind({from:()=>({render:()=>src.snap()}),host:()=>panel,bg:()=>bgOf(sky)});
   view='galaxy';chart.hidden=true;panel.hidden=false;sky.hidden=true;labelsOf();
   const tc=panel.querySelector('canvas');if(tc){tc.style.transition='none';tc.classList.add('on')}
   if(api)api.wake();
   return T.still(mode,t)};
  function morphTo(from,to){morphing=true;chron.classList.add('nc-morphing');linkSvg.classList.remove('on');
   const A=positions(from);view=to;chart.hidden=view!=='chart';panel.hidden=view!=='galaxy';sky.hidden=view!=='skyline';labelsOf();
   const shown=view==='galaxy'?panel:view==='skyline'?sky:chart;shown.style.transition='none';shown.style.opacity='0';
   if(view==='galaxy'&&api)api.wake();if(view==='skyline'&&window.NobelSkyline.inst)window.NobelSkyline.inst.sync();
   let fr=0;const wait=()=>{if(++fr<4){requestAnimationFrame(wait);return}run(A,positions(to),shown)};requestAnimationFrame(wait)}
  function run(A,B,shown){
   const cr=chron.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,1.5),cv=document.createElement('canvas');cv.className='nc-morph';cv.width=Math.round(cr.width*dpr);cv.height=Math.round(cr.height*dpr);chron.appendChild(cv);
   const g=cv.getContext('2d'),DUR=1600,t0=performance.now(),light=root.dataset.theme==='light',RGB=CATC.map(c=>{const n=parseInt(c.slice(1),16),k=light?.62:1;return[(n>>16&255)*k|0,(n>>8&255)*k|0,(n&255)*k|0]});
   const ox=cr.left,oy=cr.top;let revealed=false;
   function at(i,T,o){const d=(mYear[i]-1901)/125*.3;let tt=clamp01((T-d)/.7),e=easeIO(tt);const ax=A.xy[i*2]-ox,ay=A.xy[i*2+1]-oy,bx=B.xy[i*2]-ox,by=B.xy[i*2+1]-oy,dx=bx-ax,dy=by-ay,len=Math.hypot(dx,dy)||1,sw=Math.sin(Math.PI*e),amp=(mHash(i)-.5)*Math.min(len,700)*.5*sw,lift=-sw*70*mHash(i+7);
    o.x=ax+dx*e+(-dy/len)*amp;o.y=ay+dy*e+(dx/len)*amp+lift;o.e=e;o.sw=sw}
   const p0={},p1={};
   function frame(now){const T=clamp01((now-t0)/DUR);g.setTransform(dpr,0,0,dpr,0,0);g.clearRect(0,0,cr.width,cr.height);g.globalCompositeOperation=light?'source-over':'lighter';g.lineCap='round';
    if(T>.55&&!revealed){revealed=true;shown.style.transition='opacity .65s ease';shown.style.opacity='1'}
    for(let i=0;i<MN;i++){at(i,T,p1);at(i,Math.max(0,T-.045),p0);const al=(A.al[i]+(B.al[i]-A.al[i])*p1.e)*(.5+.5*p1.sw+.25*(1-p1.sw)),c=RGB[mCat[i]],rr=(mAward[i]?2.5:1.5)*(1+.7*p1.sw);
     if(p1.sw>.02){g.strokeStyle=`rgba(${c[0]},${c[1]},${c[2]},${(al*.4).toFixed(3)})`;g.lineWidth=rr*.9;g.beginPath();g.moveTo(p0.x,p0.y);g.lineTo(p1.x,p1.y);g.stroke()}
     g.fillStyle=`rgba(${c[0]},${c[1]},${c[2]},${Math.min(1,al).toFixed(3)})`;g.beginPath();g.arc(p1.x,p1.y,rr,0,6.2832);g.fill()}
    if(T<1)requestAnimationFrame(frame);else{cv.remove();shown.style.opacity='';shown.style.transition='';morphing=false;chron.classList.remove('nc-morphing');if(view==='galaxy'&&api)api.wake();linkKick()}}
   requestAnimationFrame(frame)}
  let api=null;
  async function boot(){
   let THREE;try{THREE=await import('./vendor/three.module.min.js')}catch{return}
   const canvas=ui.canvas,renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true});renderer.setClearColor(0,0);
   const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(40,2,.1,100),grp=new THREE.Group();scene.add(grp);grp.rotation.x=-.95;
   let seed=1901;const rnd=()=>{seed=(seed*16807)%2147483647;return seed/2147483647},gauss=()=>{let u=0;for(let i=0;i<4;i++)u+=rnd();return(u-2)*1.7};
   const rows=records.filter(r=>r.collection!=='books'&&/^\d{4}$/.test(r.year||'')),N=rows.length,pos=new Float32Array(N*3),col=new Float32Array(N*3),siz=new Float32Array(N),yr=new Float32Array(N),idx=new Float32Array(N),tw=new Float32Array(N);
   const MIN=1901,SPAN=125,TURNS=1.7,anchor=y=>{const t=(y-MIN)/SPAN,th=t*Math.PI*2*TURNS,rad=1.3+t*4.2;return new THREE.Vector3(Math.cos(th)*rad,0,Math.sin(th)*rad)};
   const color=new THREE.Color(),kat=new Float32Array(N);
   rows.forEach((r,i)=>{const y=Number(r.year),t=(y-MIN)/SPAN,th=t*Math.PI*2*TURNS+gauss()*.05,rad=1.3+t*4.2+gauss()*(.17+.07*t);pos[i*3]=Math.cos(th)*rad;pos[i*3+1]=gauss()*.14;pos[i*3+2]=Math.sin(th)*rad;
    const kc=typeof nobelCat==='function'?nobelCat(r):6;kat[i]=kc;color.set(CATC[kc]);col[i*3]=color.r;col[i*3+1]=color.g;col[i*3+2]=color.b;siz[i]=r.collection==='awards'?.24:.15;yr[i]=y;idx[i]=i;tw[i]=rnd()});
   /* stars are instanced billboard quads (true sprite impostors): no point-size cap, so spikes and halos can grow with the star */
   const geo=new THREE.InstancedBufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute([-.5,-.5,0,.5,-.5,0,.5,.5,0,-.5,.5,0],3));geo.setIndex([0,1,2,0,2,3]);geo.instanceCount=N;
   const ia=(a,n)=>new THREE.InstancedBufferAttribute(a,n);geo.setAttribute('iPos',ia(pos,3));geo.setAttribute('aC',ia(col,3));geo.setAttribute('aS',ia(siz,1));geo.setAttribute('aYr',ia(yr,1));geo.setAttribute('aI',ia(idx,1));geo.setAttribute('aT',ia(tw,1));geo.setAttribute('aK',ia(kat,1));
   const U={uTime:{value:0},uScale:{value:600},uSel:{value:0},uPick:{value:-99},uOn:{value:new Float32Array(7).fill(1)},uLight:{value:0},uInv:{value:new THREE.Vector2(1/800,1/500)}};
   const mat=new THREE.ShaderMaterial({uniforms:U,transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,
    vertexShader:`attribute vec3 iPos,aC;attribute float aS,aYr,aI,aT,aK;uniform vec2 uInv;uniform float uTime,uScale,uSel,uPick;uniform float uOn[7];varying vec3 vC;varying float vA,vBig;varying vec2 vPC;void main(){vec4 mv=modelViewMatrix*vec4(iPos,1.);gl_Position=projectionMatrix*mv;vPC=position.xy;float sel=abs(aYr-uSel)<.5?1.:0.;float pk=abs(aI-uPick)<.5?1.:0.;float tw=.82+.18*sin(uTime*(.7+aT*2.)+aT*50.);float on=uOn[int(aK+.5)];vC=mix(aC,vec3(1.),pk*.7);vBig=max(smoothstep(.2,.26,aS)*.5,sel*.9+pk);float px=clamp(aS*uScale/-mv.z*tw*(1.+sel*1.4+pk*2.6)*(.35+.9*on)*(1.+vBig*.9),1.5,110.);gl_Position.xy+=position.xy*px*uInv*2.*gl_Position.w;vA=(tw*(uSel>0.?(.55+sel*1.6):1.)+pk)*(.08+.92*on);}`,
    fragmentShader:`uniform float uLight;varying vec3 vC;varying float vA,vBig;varying vec2 vPC;void main(){vec2 pc=vPC;float d=length(pc);if(d>.5)discard;if(uLight>.5){/* light theme: opaque ink-like stars (normal blending, deepened colour, crisp core + faint halo) instead of additive glow that washes out on parchment */float lum=dot(vC,vec3(.3,.59,.11));vec3 c=mix(vec3(lum),vC,1.18)*.8;float core=1.-smoothstep(.16,.26,d);float halo=smoothstep(.5,.12,d)*.28;gl_FragColor=vec4(c,clamp((core*.95+halo)*vA,0.,1.));return;}float a=smoothstep(.5,0.,d);a=a*a*.8+(1.-smoothstep(0.,.14,d))*.9;/* sphere impostor: the bright core is shaded like a lit ball (normal from the sprite coordinate) */{vec2 q=pc*3.6;float r2=dot(q,q);if(r2<1.){vec3 nn=vec3(q,sqrt(1.-r2));float lit=.62+.55*max(dot(nn,normalize(vec3(-.5,.6,.65))),0.)+.35*pow(max(dot(reflect(-normalize(vec3(-.5,.6,.65)),nn),vec3(0.,0.,1.)),0.),18.);a=min(1.,a*(.78+.3*lit));}}/* diffraction spikes on prize records and the selected year */float spk=(exp(-abs(pc.x)*46.)*exp(-abs(pc.y)*4.5)+exp(-abs(pc.y)*46.)*exp(-abs(pc.x)*4.5))*vBig;a=max(a,spk*.75);float rim=smoothstep(.5,.3,d)*.25;gl_FragColor=vec4(vC*1.35+rim*vC,clamp(a*vA,0.,1.));}`});
   const stars=new THREE.Mesh(geo,mat);stars.frustumCulled=false;grp.add(stars);
   /* spiral guide + selected-year ring */
   const guide=[];for(let i=0;i<=240;i++){const t=i/240,th=t*Math.PI*2*TURNS;guide.push(new THREE.Vector3(Math.cos(th)*(1.3+t*4.2),0,Math.sin(th)*(1.3+t*4.2)))}
   grp.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(guide),new THREE.LineBasicMaterial({color:0x9fb8c8,transparent:true,opacity:.16,blending:THREE.AdditiveBlending})));
   const ringPts=Array.from({length:65},(_,i)=>new THREE.Vector3(Math.cos(i/64*Math.PI*2)*.5,0,Math.sin(i/64*Math.PI*2)*.5)),ring=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(ringPts),new THREE.LineBasicMaterial({color:0xfff0cf,transparent:true,opacity:.85,blending:THREE.AdditiveBlending}));grp.add(ring);
   const glow=(()=>{const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d'),r=g.createRadialGradient(32,32,0,32,32,32);r.addColorStop(0,'rgba(255,240,200,.9)');r.addColorStop(1,'rgba(255,240,200,0)');g.fillStyle=r;g.fillRect(0,0,64,64);return new THREE.CanvasTexture(c)})();
   /* category nebulae along the spiral */
   [[.15,0],[.35,1],[.55,2],[.75,3],[.9,4]].forEach(([tt,ci],q)=>{const a=anchor(1901+tt*SPAN),sp2=new THREE.Sprite(new THREE.SpriteMaterial({map:glow,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,opacity:.16,color:new THREE.Color(CATC[ci])}));sp2.position.copy(a);sp2.scale.set(2.8,2.8,1);grp.add(sp2)});
   /* background dust disc */
   {const DN=900,dpos=new Float32Array(DN*3);for(let i=0;i<DN;i++){const a=rnd()*Math.PI*2,r2=.6+Math.pow(rnd(),.7)*6.8;dpos[i*3]=Math.cos(a)*r2;dpos[i*3+1]=gauss()*.25;dpos[i*3+2]=Math.sin(a)*r2}
    const dg=new THREE.BufferGeometry();dg.setAttribute('position',new THREE.BufferAttribute(dpos,3));grp.add(new THREE.Points(dg,new THREE.PointsMaterial({color:0x9fb8c8,size:.025,transparent:true,opacity:.35,depthWrite:false,blending:THREE.AdditiveBlending})))}
   /* decade ticks: short radial strokes at every decade on the spiral */
   {const tp=[];for(let d=1910;d<=2020;d+=10){const a0=anchor(d),dir=a0.clone().normalize();tp.push(a0.clone().addScaledVector(dir,-.12),a0.clone().addScaledVector(dir,.22))}
    grp.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(tp),new THREE.LineBasicMaterial({color:0xcfdde6,transparent:true,opacity:.35,blending:THREE.AdditiveBlending})))}
   /* selected-year beam from the core */
   const beamG=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3(1,0,0)]),beam=new THREE.Line(beamG,new THREE.LineBasicMaterial({color:0xfff0cf,transparent:true,opacity:.0,blending:THREE.AdditiveBlending}));beam.visible=false;grp.add(beam);
   const ring2=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(Array.from({length:65},(_,i)=>new THREE.Vector3(Math.cos(i/64*Math.PI*2)*.8,0,Math.sin(i/64*Math.PI*2)*.8))),new THREE.LineBasicMaterial({color:0xfff0cf,transparent:true,opacity:.0,blending:THREE.AdditiveBlending}));ring2.visible=false;grp.add(ring2);
   const core=new THREE.Sprite(new THREE.SpriteMaterial({map:glow,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,opacity:.55}));core.scale.set(2.6,2.6,1);grp.add(core);
   /* category-coloured light shafts fanning out of the selected year: one per prize category, length = how many records */
   const fan=CATC.slice(0,6).map(c=>{const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:glow,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,opacity:0,color:new THREE.Color(c)}));sp.visible=false;grp.add(sp);return sp});
   /* every additive helper (guide, glows, ticks, beam, rings, dust) is re-tinted for the light theme in draw() */
   const themed=[];grp.traverse(o=>{const mt=o.material;if(mt&&mt!==mat&&mt.blending===THREE.AdditiveBlending)themed.push({mt,c:mt.color?mt.color.clone():null,op:mt.opacity,sprite:!!o.isSprite})});let litNow=null;
   const applyTheme=()=>{const lt=root.dataset.theme==='light';if(lt===litNow)return;litNow=lt;core.visible=!lt;U.uLight.value=lt?1:0;mat.blending=lt?THREE.NormalBlending:THREE.AdditiveBlending;mat.needsUpdate=true;themed.forEach(t=>{t.mt.blending=lt?THREE.NormalBlending:THREE.AdditiveBlending;if(t.c)t.mt.color.copy(t.c).multiplyScalar(lt?.42:1);t.mt.needsUpdate=true})};
   /* decade labels */
   const decs=[1900,1920,1940,1960,1980,2000,2020].filter(d=>d<=2026);ui.labels.innerHTML=decs.map(d=>`<span>${d}</span>`).join('');const lab=[...ui.labels.children];let labFrame=0;
   /* laureate capsules: the selected year's people float beside their stars on springs; hidden ones never overlap (declutter) */
   const caps=document.createElement('div');caps.className='nc-caps';panel.appendChild(caps);let capItems=[],capSel=0,capFrame=0;
   const SHORT=t=>String(t||'').replace(/\s*-\s*Nobel.*$/i,'').replace(/\s*\(.*$/,'');
   function buildCaps(){caps.innerHTML='';capItems=[];if(!sel)return;
    const list=[];for(let i=0;i<N;i++)if(Number(rows[i].year)===sel)list.push(i);
    list.sort((a,b)=>(rows[a].collection==='awards'?0:1)-(rows[b].collection==='awards'?0:1));
    list.slice(0,7).forEach((i,k)=>{const r=rows[i],kc=typeof nobelCat==='function'?nobelCat(r):6,b=document.createElement('button');b.type='button';b.className='nc-cap';b.style.setProperty('--c',CATC[kc]);b.style.setProperty('--d',(k*70)+'ms');
     b.innerHTML='<i aria-hidden="true"></i><span></span>';b.lastChild.textContent=SHORT(r.title);b.title=String(r.title||'');
     b.addEventListener('click',e=>{e.stopPropagation();if(typeof window.openRecord==='function')window.openRecord(r.id)});
     b.addEventListener('pointerdown',e=>e.stopPropagation());caps.appendChild(b);capItems.push({i,el:b,x:0,y:0})});
    requestAnimationFrame(()=>caps.classList.add('in'))}
   /* camera / interaction state */
   let anchorLocal=null;let yaw=0,pitch=0,vYaw=0,zoom=1,zoomT=1,pan=new THREE.Vector3(),panT=new THREE.Vector3(),sel=0,drag=null,hover=-1,mouse={x:0,y:0,in:false},visible=true,raf=0,t0=performance.now(),time=0;
   const v=new THREE.Vector3(),wake=()=>{if(!raf)raf=requestAnimationFrame(frame)};document.addEventListener('bk:quality',()=>{size();wake()});
   /* GPU context loss: three re-initialises itself on restore but nothing repaints a static frame, so ask for one. */
   window.BKGL&&BKGL.watch(canvas,{name:'nobel',onRestore(){size();wake()}});
   function size(){const w=canvas.clientWidth||600,h=canvas.clientHeight||400,dpr=Math.max(.6,Math.min(devicePixelRatio||1,1.6)*([1,1,.85,.7,.55][window.BKMotion?BKMotion.quality.level:0]||1));renderer.setPixelRatio(dpr);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();U.uScale.value=renderer.domElement.height/(2*Math.tan(20*Math.PI/180));U.uInv.value.set(1/renderer.domElement.width,1/renderer.domElement.height)}
   function select(){const y=typeof nobelYear!=='undefined'?Number(nobelYear):0;if(y===sel)return;sel=y;U.uSel.value=y;if(y){const a=anchor(y);ring.position.copy(a);ring.visible=true;ring2.position.copy(a);ring2.visible=true;beam.visible=true;fan.forEach(f=>f.visible=true);caps.classList.remove('in');setTimeout(buildCaps,40);beamG.setFromPoints([new THREE.Vector3(0,0,0),a.clone()]);panT.copy(a).multiplyScalar(.45);zoomT=Math.max(zoomT,1.25)}else{ring.visible=false;ring2.visible=false;beam.visible=false;fan.forEach(f=>f.visible=false);buildCaps()}}
   function pick(){if(!mouse.in||drag){set(-1);return}const rect=canvas.getBoundingClientRect();let best=-1,bd=13*13;grp.updateMatrixWorld(true);
    for(let i=0;i<N;i++){v.set(pos[i*3],pos[i*3+1],pos[i*3+2]);grp.localToWorld(v);v.project(camera);if(v.z>1)continue;const sx=(v.x*.5+.5)*rect.width+rect.left,sy=(-v.y*.5+.5)*rect.height+rect.top,d=(sx-mouse.x)**2+(sy-mouse.y)**2;if(d<bd){bd=d;best=i}}set(best)}
   function set(i){if(i===hover)return;hover=i;U.uPick.value=i<0?-99:i;document.dispatchEvent(new CustomEvent('nobel:hover',{detail:i<0?0:Number(rows[i].year)}));const tip=ui.tip;if(i<0){tip.hidden=true;return}const r=rows[i],c=typeof nobelCat==='function'?nobelCat(r):6;tip.innerHTML=`<small style="--c:${CATC[c]}">${esc(r.year)} · ${esc(typeof nobelCatLabel==='function'?nobelCatLabel(c):'')}</small><strong>${esc(r.collection==='awards'?r.author:displayTitle(r))}</strong>${r.collection==='awards'?`<span>${esc(displayTitle(r))}</span>`:`<span>${esc(r.author||'')}</span>`}`;tip.hidden=false;place()}
   function place(){const r=panel.getBoundingClientRect();ui.tip.style.transform=`translate(${Math.max(8,Math.min(mouse.x-r.left+14,r.width-250))}px,${Math.max(8,Math.min(mouse.y-r.top+16,r.height-90))}px)`}
   const pointer=e=>{mouse={x:e.clientX,y:e.clientY,in:true}};
   canvas.parentNode.addEventListener('pointermove',e=>{pointer(e);if(drag){const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.abs(dx)+Math.abs(dy)>4)drag.moved=true;yaw+=dx*.006;pitch=Math.max(-.45,Math.min(.45,pitch+dy*.004));vYaw=dx*.006;drag.x=e.clientX;drag.y=e.clientY;set(-1)}else{pick();if(!ui.tip.hidden)place()}wake()},{passive:true});
   canvas.parentNode.addEventListener('pointerleave',()=>{mouse.in=false;set(-1)});
   canvas.parentNode.addEventListener('pointerdown',e=>{if(e.button>0||e.target.closest('.nc-3d-ctl'))return;drag={x:e.clientX,y:e.clientY,moved:false}});
   addEventListener('pointerup',()=>{const d=drag;drag=null;if(d&&!d.moved&&hover>=0){const y=rows[hover].year;if(typeof selectNobelYear==='function')selectNobelYear(String(y));else{const btn=section.querySelector(`.nc-year[data-year="${y}"]`);if(btn&&!btn.disabled)btn.click()}wake()}});
   canvas.parentNode.addEventListener('dblclick',()=>{if(hover>=0&&window.openRecord)window.openRecord(rows[hover].id)});
   canvas.tabIndex=0;canvas.setAttribute('role','application');canvas.setAttribute('aria-label',t('ncGalaxyHint'));
   canvas.addEventListener('keydown',e=>{const cur=typeof nobelYear!=='undefined'&&nobelYear?Number(nobelYear):2025,step=(e.ctrlKey||e.metaKey)?10:1;let ny=cur;
    if(e.key==='Escape'){canvas.blur();return}/* I1: Escape leaves the 3D canvas so Tab continues through the page */
    if(e.key==='ArrowRight')ny=cur+step;else if(e.key==='ArrowLeft')ny=cur-step;else if(e.key==='Home')ny=1901;else if(e.key==='End')ny=2026;else if(e.key==='PageUp')ny=cur+10;else if(e.key==='PageDown')ny=cur-10;else return;e.preventDefault();
    const ix=typeof nobelIndex!=='undefined'?nobelIndex:null;if(!ix)return;const dir=ny>=cur?1:-1;let best=null;for(let y=ny;y>=1901&&y<=2026;y+=dir){if(ix.has(String(y))){best=String(y);break}}if(best&&typeof selectNobelYear==='function')selectNobelYear(best,true)});
   canvas.parentNode.addEventListener('wheel',e=>{if(!(e.ctrlKey||e.metaKey))return;e.preventDefault();zoomT=Math.max(.7,Math.min(5,zoomT*Math.exp(-e.deltaY*.01)));wake()},{passive:false});
   ui.ctl.addEventListener('click',e=>{const b=e.target.closest?e.target.closest('[data-z]'):null;if(!b)return;if(b.dataset.z==='in')zoomT=Math.min(5,zoomT*1.4);else if(b.dataset.z==='out')zoomT=Math.max(.7,zoomT/1.4);else{zoomT=1;panT.set(0,0,0);yaw=0;pitch=0}wake()});
   function draw(dt){applyTheme();time+=(window.BKGL&&BKGL.still)?0:dt;U.uTime.value=time;select();for(let q=0;q<7;q++)U.uOn.value[q]=NF.on[q]?1:0;if(!drag){yaw+=vYaw;vYaw*=.94;if(Math.abs(vYaw)<1e-4)vYaw=0}
    const k=Math.min(1,dt*5);zoom+=(zoomT-zoom)*k;pan.lerp(panT,k);
    /* scroll-linked entrance: the galaxy dollies in and swings round as the section arrives (continuity with the hero galaxy) */
    const pr=panel.getBoundingClientRect(),sp=Math.max(0,Math.min(1,(innerHeight-pr.top)/(innerHeight*.85))),se=sp*sp*(3-2*sp),dolly=.6+.4*se;
    camera.position.set(pan.x,pan.y+1.6/(zoom*dolly),17.2/(zoom*dolly)+pan.z*.2);camera.lookAt(pan.x*.6,0,pan.z*.6);
    grp.rotation.y=yaw+(1-se)*1.25+(reduced.matches||root.classList.contains('effects-paused')?0:time*.045);grp.rotation.x=-.95+pitch;core.material.opacity=.45+.08*Math.sin(time*.8);if(ring2.visible){const ph=(time*.9)%1;ring2.scale.setScalar(1+ph*1.8);ring2.material.opacity=.7*(1-ph);beam.material.opacity=.22+.1*Math.sin(time*2.2);ring.scale.setScalar(1+.08*Math.sin(time*3))}
    const w=canvas.clientWidth,h=canvas.clientHeight;grp.updateMatrixWorld(true);lab.forEach((el,i)=>{const a=anchor(decs[i]);v.copy(a);grp.localToWorld(v);v.project(camera);el.style.transform=`translate(${((v.x*.5+.5)*w).toFixed(1)}px,${((-v.y*.5+.5)*h).toFixed(1)}px)`;el.style.opacity=v.z<1?1:0});if(window.BKText&&++labFrame%6===0){const L=lab.filter(el=>el.style.opacity==='1').map((el,i)=>{const b=el.getBoundingClientRect();return{el,x:b.left+b.width/2,y:b.top,w:b.width,h:b.height,prio:i}});lab.forEach(el=>{el.style.visibility=''});window.BKText.declutter(L,2)}
    if(sel){const e=typeof nobelIndex!=='undefined'&&nobelIndex?nobelIndex.get(String(sel)):null,an=ring.position,ang0=Math.atan2(an.z,an.x),p1=new THREE.Vector3(),p2=new THREE.Vector3();
     fan.forEach((f,k)=>{const n=e?e.cats[k]:0,on=n>0&&NF.on[k];f.visible=on;if(!on)return;const th=ang0+(k-2.5)*.3,len=.9+n*.38,dx=Math.cos(th),dz=Math.sin(th);
      p1.set(an.x,an.y,an.z);grp.localToWorld(p1);p2.set(an.x+dx*len*.5,an.y,an.z+dz*len*.5);grp.localToWorld(p2);
      f.position.copy(p2);f.scale.set(len,.32+n*.02,1);const a=p1.clone().project(camera),b2=p2.clone().project(camera);f.material.rotation=Math.atan2((b2.y-a.y)*h,(b2.x-a.x)*w);f.material.opacity=(.45+.12*Math.sin(time*1.4+k))*(.5+.5*Math.min(1,time))});
     v.copy(an);grp.localToWorld(v);v.project(camera);anchorLocal={x:(v.x*.5+.5)*w,y:(-v.y*.5+.5)*h}}
    if(capItems.length){const cc=new THREE.Vector3(0,0,0);grp.localToWorld(cc);cc.project(camera);const cx0=(cc.x*.5+.5)*w,cy0=(-cc.y*.5+.5)*h;
     capItems.forEach(c=>{v.set(pos[c.i*3],pos[c.i*3+1],pos[c.i*3+2]);grp.localToWorld(v);v.project(camera);const sx=(v.x*.5+.5)*w,sy=(-v.y*.5+.5)*h;let dx=sx-cx0,dy=sy-cy0;const L=Math.hypot(dx,dy)||1;dx/=L;dy/=L;
      const tx=sx+dx*34,ty=sy+dy*26;c.x+=(tx-c.x)*Math.min(1,dt*11.9);c.y+=(ty-c.y)*Math.min(1,dt*11.9);if(!c.init){c.x=sx;c.y=sy;c.init=true}c.el.style.transform=`translate(${c.x.toFixed(1)}px,${c.y.toFixed(1)}px)`;c.el.style.opacity=v.z<1?'':'0'});
     if(window.BKText&&++capFrame%6===0){const L=capItems.map((c,k)=>{const bb=c.el.getBoundingClientRect();return{el:c.el,x:bb.left+bb.width/2,y:bb.top,w:bb.width,h:bb.height,prio:100-k}});capItems.forEach(c=>{c.el.style.visibility=''});window.BKText.declutter(L,4)}}
    renderer.render(scene,camera)}
   function frame(now){raf=0;const dt=Math.min(.05,(now-(frame.l||now))/1000||0);frame.l=now;if(view!=='galaxy'||!visible||document.hidden)return;draw(dt);const still=reduced.matches||root.classList.contains('effects-paused');if(!still||drag||Math.abs(vYaw)>1e-4||Math.abs(zoomT-zoom)>.002)raf=requestAnimationFrame(frame)}
   size();new ResizeObserver(()=>{size();wake()}).observe(panel);addEventListener('scroll',()=>{if(visible&&view==='galaxy')wake()},{passive:true});document.addEventListener('nobel:filter',wake);if(typeof IntersectionObserver==='function')new IntersectionObserver(es=>{visible=es[0].isIntersecting;if(visible)wake()}).observe(panel);
   new MutationObserver(wake).observe(root,{attributes:true,attributeFilter:['class','data-theme']});
   const projectRecords=out=>{const r=canvas.getBoundingClientRect();grp.updateMatrixWorld(true);camera.updateMatrixWorld();const vv=new THREE.Vector3();for(let i=0;i<N;i++){vv.set(pos[i*3],pos[i*3+1],pos[i*3+2]);grp.localToWorld(vv);vv.project(camera);out[i*2]=r.left+(vv.x*.5+.5)*r.width;out[i*2+1]=r.top+(-vv.y*.5+.5)*r.height}};
   api={wake,projectRecords,enter(){if(!reduced.matches){zoom=zoomT*.7;vYaw=.015}wake()},anchor(){if(!sel||!anchorLocal)return null;const r=canvas.getBoundingClientRect();return{x:r.left+anchorLocal.x,y:r.top+anchorLocal.y}},
    /* R10.a: one synchronous frame with dt 0 (no drift), so BKTransition can freeze the galaxy inside the same task */
    snap(){draw(0);return canvas}};draw(.016);wake();canvas.classList.add('on')}
 }
 const go=()=>setTimeout(mount,400);document.addEventListener('library:ready',go);if(typeof records!=='undefined'&&records.length)go();
})();
