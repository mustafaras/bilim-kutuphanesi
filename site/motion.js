'use strict';
/* BKMotion — the single source of motion + quality for every scene.
   • ease: shared easing curves (every camera / morph / dive uses these, so the whole site accelerates and settles alike)
   • damp(cur,target,lambda,dt): frame-rate independent exponential smoothing (replaces ad-hoc `*.12` per frame)
   • spring(k,c): critically damped spring {v,x,to,step(dt)} for overshoot-free camera and label motion
   • quality: one tier (0 full … 4 minimal) published by the hero's frame-time governor; other scenes listen to 'bk:quality'
   • perf: window.__bkPerf (only when localStorage bk-test=1) exposes live fps / frame ms / tier, also on software GL */
(()=>{
 const clamp01=x=>x<0?0:x>1?1:x;
 const ease={
  out3:x=>1-Math.pow(1-clamp01(x),3),
  in3:x=>{x=clamp01(x);return x*x*x},
  inOut3:x=>{x=clamp01(x);return x<.5?4*x*x*x:1-Math.pow(-2*x+2,3)/2},
  outExpo:x=>{x=clamp01(x);return x>=1?1:1-Math.pow(2,-10*x)},
  outBack:x=>{x=clamp01(x);const c1=1.70158,c3=c1+1;return 1+c3*Math.pow(x-1,3)+c1*Math.pow(x-1,2)},
  smooth:x=>{x=clamp01(x);return x*x*(3-2*x)}
 };
 const damp=(cur,target,lambda,dt)=>target+(cur-target)*Math.exp(-lambda*dt);
 /* springZ(x0,wn,zeta): a second-order spring in the engineer's terms — natural frequency wn (rad/s) and damping ratio zeta (zeta .8 overshoots ~1.5 %, 1 is critical). Sub-stepped (<= 8 ms) so it stays stable and accurate at the 50 ms frame cap. step(dt) returns x. */
 function springZ(x0,wn,zeta){wn=wn||8;zeta=zeta==null?.8:zeta;const s={x:x0||0,v:0,to:x0||0,wn,zeta,step(dt){dt=Math.min(Math.max(dt,0),.05);const n=Math.max(1,Math.ceil(dt/.008)),h=dt/n;for(let i=0;i<n;i++){s.v+=(s.wn*s.wn*(s.to-s.x)-2*s.zeta*s.wn*s.v)*h;s.x+=s.v*h}return s.x}};return s}
 function spring(x0,k,c){k=k||90;c=c==null?2*Math.sqrt(k):c;const s={x:x0||0,v:0,to:x0||0,step(dt){dt=Math.min(dt,.05);const a=-k*(s.x-s.to)-c*s.v;s.v+=a*dt;s.x+=s.v*dt;return s.x}};return s}
 const quality={level:0,pinned:false,
  set(l){if(quality.pinned)return;l=Math.max(0,Math.min(4,l|0));if(l===quality.level)return;quality.level=l;try{document.dispatchEvent(new CustomEvent('bk:quality',{detail:l}))}catch{}},
  /* pin(l): hold the tier against the hero's frame-time governor (audit tools and BKSkyline.tier use it, so a measured tier is the tier that ran) */
  pin(l){quality.pinned=true;l=Math.max(0,Math.min(4,l|0));if(l!==quality.level){quality.level=l;try{document.dispatchEvent(new CustomEvent('bk:quality',{detail:l}))}catch{}}return quality.level},
  unpin(){quality.pinned=false;return quality.level}};
 const perf={fps:0,ms:0,level:0,frames:0,t:0};
 function tick(dtMs){perf.frames++;perf.t+=dtMs;perf.ms+=(dtMs-perf.ms)*.1;if(perf.t>=500){perf.fps=Math.round(perf.frames*1000/perf.t);perf.frames=0;perf.t=0}perf.level=quality.level}
 /* scroll choreography published as CSS variables (works with or without WebGL):
    --hero-p   0→1 while the hero leaves the viewport
    --atlas-in 0→1 while the catalogue ("atlas") section approaches, so it arrives instead of just appearing */
 const rm=typeof matchMedia==='function'?matchMedia('(prefers-reduced-motion: reduce)'):{matches:false};
 let sq=false,hero=null,atlas=null;
 function scrollVars(){sq=false;const st=document.documentElement.style;
  if(rm.matches){st.setProperty('--hero-p','0');st.setProperty('--atlas-in','1');return}
  hero=hero||document.getElementById('hero');atlas=atlas||document.getElementById('catalog');
  const vh=innerHeight||800;
  if(hero)st.setProperty('--hero-p',clamp01(scrollY/Math.max(1,hero.clientHeight*.9)).toFixed(3));
  if(atlas){const top=atlas.getBoundingClientRect().top;st.setProperty('--atlas-in',ease.smooth(1-(top-vh*.28)/(vh*.72)).toFixed(3))}}
 const askScroll=()=>{if(!sq){sq=true;requestAnimationFrame(scrollVars)}};
 addEventListener('scroll',askScroll,{passive:true});addEventListener('resize',askScroll);scrollVars();
 /* G2: pointer position inside a card/tile as --mx/--my (-1..1): living covers shift their layers against each other (depth) */
 let pq=null;
 document.addEventListener('pointermove',e=>{if(rm.matches||e.pointerType==='touch')return;const c=e.target.closest&&e.target.closest('.card,.spotlight-card');if(!c){if(pq&&pq.el){pq.el.style.removeProperty('--mx');pq.el.style.removeProperty('--my');pq=null}return}
  if(pq&&pq.el!==c){pq.el.style.removeProperty('--mx');pq.el.style.removeProperty('--my')}pq={el:c,x:e.clientX,y:e.clientY,raf:pq&&pq.el===c?pq.raf:0};
  if(!pq.raf)pq.raf=requestAnimationFrame(()=>{const q=pq;if(!q)return;q.raf=0;const r=q.el.getBoundingClientRect();q.el.style.setProperty('--mx',(((q.x-r.left)/Math.max(1,r.width)-.5)*2).toFixed(3));q.el.style.setProperty('--my',(((q.y-r.top)/Math.max(1,r.height)-.5)*2).toFixed(3))})},{passive:true});
 /* A1: how far an element has "arrived" while scrolling (0 = still below the fold, 1 = settled around the middle of the viewport); scenes use it to dolly in as their section approaches, continuing the hero's camera path */
 const arrival=(el,from=1.05,to=.46)=>{if(!el||rm.matches||document.documentElement.classList.contains('effects-paused'))return 1;const r=el.getBoundingClientRect(),c=(r.top+r.height/2)/Math.max(1,innerHeight||800);return ease.smooth((from-c)/(from-to))};
 window.BKMotion={ease,damp,spring,springZ,quality,tick,clamp01,arrival};
 try{if(localStorage.getItem('bk-test')==='1')window.__bkPerf=perf}catch{}
})();
