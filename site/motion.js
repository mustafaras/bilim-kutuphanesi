'use strict';
/* BKMotion — the single source of motion + quality for every scene.
   • ease: shared easing curves (every camera / morph / dive uses these, so the whole site accelerates and settles alike)
   • damp(cur,target,lambda,dt): frame-rate independent exponential smoothing (replaces ad-hoc `*.12` per frame)
   • spring(k,c): critically damped spring {v,x,to,step(dt)} for overshoot-free camera and label motion
   • quality: one tier (0 full … 4 minimal) published by the hero's frame-time governor; other scenes listen to 'bk:quality'
   • perf: window.__bkPerf (development only) exposes live fps / frame ms / tier, also on software GL */
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
 function spring(x0,k,c){k=k||90;c=c==null?2*Math.sqrt(k):c;const s={x:x0||0,v:0,to:x0||0,step(dt){dt=Math.min(dt,.05);const a=-k*(s.x-s.to)-c*s.v;s.v+=a*dt;s.x+=s.v*dt;return s.x}};return s}
 const quality={level:0,
  set(l){l=Math.max(0,Math.min(4,l|0));if(l===quality.level)return;quality.level=l;try{document.dispatchEvent(new CustomEvent('bk:quality',{detail:l}))}catch{}}};
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
 window.BKMotion={ease,damp,spring,quality,tick,clamp01};
 window.__bkPerf=perf;
})();
