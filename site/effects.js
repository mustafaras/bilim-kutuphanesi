'use strict';
/* FAZ-2 · "First Light" engine — observatory hero scene, shell motion.
   Layered starfield + Milky Way band + data-driven constellation (8 discovery
   fields, brightness follows record counts) + meteor + double-ridge horizon
   with brass hairline and a telescope dome silhouette. Also drives header
   condensation, reading progress, section reveals and the instrument-panel
   count-up. Honors prefers-reduced-motion and the manual motion toggle. */
(()=>{
 const root=document.documentElement,canvas=document.getElementById('knowledgeCanvas'),scene=document.querySelector('.hero-scene'),button=document.getElementById('motionToggle'),label=document.getElementById('motionLabel'),progress=document.getElementById('readingProgress');
 const reduced=matchMedia('(prefers-reduced-motion: reduce)'),ctx=canvas?canvas.getContext('2d'):null;let paused=false;try{paused=localStorage.getItem('bk-effects-paused')==='true'}catch{}
 try{if(/Mac|iPhone|iPad/.test(navigator.platform))root.dataset.os='mac'}catch{}
 let visible=true,frame=0,last=0,w=0,h=0,phase=1.7,pointer=null,px=0,py=0,areas=null,meteor=null,nextMeteor=7;

 /* Deterministic hash noise so the starfield is stable between frames. */
 const hash=(i,s)=>{let x=Math.imul(i^s,2654435761)>>>0;x^=x>>>13;x=Math.imul(x,1597334677)>>>0;return((x>>>8)&0xffffff)/16777216};
 const STAR_LAYERS=[{n:130,r:[.3,.75],a:[.08,.26]},{n:74,r:[.65,1.2],a:[.16,.5]},{n:30,r:[1.05,1.8],a:[.34,.85]}];
 const stars=STAR_LAYERS.map((L,li)=>Array.from({length:L.n},(_,i)=>({x:hash(i,11+li*97),y:hash(i,53+li*131),r:L.r[0]+(L.r[1]-L.r[0])*hash(i,7+li*61),a:L.a[0]+(L.a[1]-L.a[0])*hash(i,29+li*17),tw:hash(i,101+li*13),sp:.5+1.4*hash(i,211+li*29)})));
 const BAND={x0:.04,y0:.62,x1:1.02,y1:.10};
 const bandStars=Array.from({length:70},(_,i)=>{const t=hash(i,331),off=(hash(i,457)-.5)*(0.10+0.16*Math.sin(t*Math.PI));return{t,off,r:.3+.8*hash(i,571),a:.05+.2*hash(i,683),tw:hash(i,797)}});
 let horizon=0;
 const ridgeAmp=(u,layer,salt)=>{const base=layer?9:15,detail=layer?4:7,extra=layer?2:4;return (0.5+0.5*Math.sin(u*(layer?7.3:11.5)+salt))*base+(0.5+0.5*Math.sin(u*(layer?19.1:27.7)+salt*2.7))*detail+extra};

 function buildAreas(){
  try{
   const groups=typeof DISCOVERY==='undefined'?[]:DISCOVERY,rows=typeof records==='undefined'?[]:records,stat=(typeof catalog==='object'&&catalog&&catalog.stats)||{};
   if(!groups.length){areas=[];return}
   const counts=groups.map(d=>d.nobel?Number(stat.nobelDocuments)||0:rows.filter(r=>r.collection==='books'&&(d.categories||[]).includes(r.category)).length),top=Math.max(1,...counts);
   areas=groups.map((d,i)=>{const angle=-Math.PI*.94+i*(Math.PI*1.88/Math.max(1,groups.length-1)),rad=.36+.54*hash(i,88);return{x:Math.cos(angle)*rad,y:Math.sin(angle)*rad*1.42,bright:.3+.7*(counts[i]/top)}})
  }catch{areas=[]}
 }

 function draw(){
  if(!ctx||!w)return;ctx.clearRect(0,0,w,h);
  horizon=h*.82;
  const sky=ctx.createLinearGradient(0,0,0,h);
  sky.addColorStop(0,'rgba(9,24,44,.66)');sky.addColorStop(.55,'rgba(9,22,40,.22)');sky.addColorStop(1,'rgba(6,13,24,0)');
  ctx.fillStyle=sky;ctx.fillRect(0,0,w,h);
  /* Milky Way band */
  ctx.save();ctx.globalCompositeOperation='screen';
  const by0=BAND.y0*horizon,by1=BAND.y1*horizon;
  for(let i=0;i<5;i++){const t=i/4,bx=(BAND.x0+(BAND.x1-BAND.x0)*t)*w,by=by0+(by1-by0)*t,r=Math.max(w,h)*.16;
   const g=ctx.createRadialGradient(bx,by,0,bx,by,r);g.addColorStop(0,'rgba(126,148,180,.05)');g.addColorStop(.6,'rgba(110,130,160,.024)');g.addColorStop(1,'rgba(110,130,160,0)');
   ctx.fillStyle=g;ctx.beginPath();ctx.arc(bx,by,r,0,Math.PI*2);ctx.fill()}
  bandStars.forEach(s=>{const x=(BAND.x0+(BAND.x1-BAND.x0)*s.t)*w-px*.35,y=by0+(by1-by0)*s.t+s.off*h-py*.2,tw=.6+.4*Math.sin(phase*.5+s.tw*6.283);
   ctx.fillStyle=`rgba(198,214,240,${(s.a*tw).toFixed(3)})`;ctx.beginPath();ctx.arc(x,y,s.r,0,Math.PI*2);ctx.fill()});
  ctx.restore();
  /* Starfield — three parallax depths */
  stars.forEach((layer,li)=>{const par=px*(li===2?.55:.16*(li+1)),parY=py*(li===2?.55:.16*(li+1));
   layer.forEach((s,i)=>{const x=s.x*w-par,y=s.y*horizon*.94-parY,tw=.55+.45*Math.sin(phase*s.sp+s.tw*6.283);
    if(hash(i,li*3+5)>.93){ctx.fillStyle=`rgba(198,220,255,${(s.a*tw*.5).toFixed(3)})`;ctx.beginPath();ctx.arc(x,y,s.r*5.2,0,Math.PI*2);ctx.fill()}
    ctx.fillStyle=`rgba(234,240,248,${(s.a*tw).toFixed(3)})`;ctx.beginPath();ctx.arc(x,y,s.r,0,Math.PI*2);ctx.fill()})});
  /* Data constellation */
  const cx=w*.66+px,cy=h*.33+py,radius=Math.min(w*.27,h*.32);
  if(areas&&areas.length){
   ctx.lineWidth=1;ctx.strokeStyle='rgba(232,206,158,.22)';ctx.beginPath();
   areas.forEach((a,i)=>{const x=cx+a.x*radius,y=cy+a.y*radius;i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.stroke();
   let peak=-1,peakV=0;
   areas.forEach((a,i)=>{const x=cx+a.x*radius,y=cy+a.y*radius,glow=11+15*a.bright;
    const halo=ctx.createRadialGradient(x,y,0,x,y,glow);halo.addColorStop(0,`rgba(248,235,203,${(.32*a.bright).toFixed(3)})`);halo.addColorStop(1,'rgba(248,235,203,0)');
    ctx.fillStyle=halo;ctx.beginPath();ctx.arc(x,y,glow,0,Math.PI*2);ctx.fill();
    const breathe=(.5+.5*Math.sin(phase*.9+i*1.7))*.28;
    ctx.fillStyle=`rgba(250,243,222,${Math.min(1,.55+.45*a.bright+breathe*a.bright).toFixed(3)})`;ctx.beginPath();ctx.arc(x,y,1.6+a.bright*2.4,0,Math.PI*2);ctx.fill();
    if(a.bright>peakV){peakV=a.bright;peak=i}});
   if(peak>=0){const a=areas[peak],x=cx+a.x*radius,y=cy+a.y*radius,f=5+4*a.bright;
    ctx.strokeStyle=`rgba(248,235,203,${(.35+.25*Math.sin(phase*.8)).toFixed(3)})`;ctx.lineWidth=1;ctx.beginPath();
    ctx.moveTo(x-f,y);ctx.lineTo(x+f,y);ctx.moveTo(x,y-f);ctx.lineTo(x,y+f);ctx.stroke()}
   ctx.font='500 9px "IBM Plex Mono",monospace';ctx.textBaseline='top';
   areas.forEach((a,i)=>{const x=cx+a.x*radius,y=cy+a.y*radius;
    ctx.fillStyle=`rgba(232,206,158,${(.38+.3*a.bright).toFixed(3)})`;ctx.fillText(String(i+1).padStart(2,'0'),x+7,y+6)})}
  /* Meteor */
  if(meteor){const m=meteor,k=m.t/m.life,tail=110*(1-k*.4);
   const tx=m.x-m.vx*tail*.016,ty=m.y-m.vy*tail*.016;
   const g=ctx.createLinearGradient(tx,ty,m.x,m.y);g.addColorStop(0,'rgba(232,206,158,0)');g.addColorStop(.7,`rgba(240,225,190,${(.5*(1-k)).toFixed(3)})`);g.addColorStop(1,`rgba(250,245,230,${(.85*(1-k)).toFixed(3)})`);
   ctx.strokeStyle=g;ctx.lineWidth=1.4;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(tx,ty);ctx.lineTo(m.x,m.y);ctx.stroke()}
  /* Atmosphere above horizon */
  const air=ctx.createLinearGradient(0,horizon-h*.26,0,horizon);
  air.addColorStop(0,'rgba(124,199,183,0)');air.addColorStop(1,'rgba(124,199,183,.10)');
  ctx.fillStyle=air;ctx.fillRect(0,horizon-h*.26,w,h*.26);
  /* Ridges */
  const ridge=(layer,color,salt)=>{ctx.beginPath();ctx.moveTo(0,h);ctx.lineTo(0,horizon-ridgeAmp(0,layer,salt));
   const step=Math.max(18,w/22);for(let x=0;x<=w;x+=step){const u=x/Math.max(1,w);ctx.lineTo(x,horizon-ridgeAmp(u,layer,salt))}
   ctx.lineTo(w,h);ctx.closePath();ctx.fillStyle=color;ctx.fill()};
  ridge(1,'rgba(9,17,30,.88)',2.1);
  ridge(0,'rgba(3,6,13,.985)',.4);
  /* Brass hairline on the front crest */
  ctx.beginPath();const step2=Math.max(18,w/22);
  for(let x=0;x<=w;x+=step2){const u=x/Math.max(1,w),y=horizon-ridgeAmp(u,0,.4)+.75;x?ctx.lineTo(x,y):ctx.moveTo(x,y)}
  ctx.strokeStyle='rgba(232,206,158,.30)';ctx.lineWidth=1;ctx.stroke();
  /* Observatory silhouette */
  const ox=w*.62,oy=horizon-ridgeAmp(ox/w,0,.4)+1;
  ctx.save();ctx.translate(ox,oy);
  ctx.fillStyle='rgba(5,9,17,.99)';
  ctx.beginPath();ctx.moveTo(-19,0);ctx.lineTo(-15,-20);ctx.lineTo(15,-20);ctx.lineTo(19,0);ctx.closePath();ctx.fill();
  ctx.beginPath();ctx.moveTo(-22,-20);ctx.arc(0,-20,22,Math.PI,0);ctx.closePath();ctx.fill();
  ctx.strokeStyle='rgba(206,172,118,.6)';ctx.lineWidth=1.5;ctx.lineJoin='round';ctx.lineCap='round';
  ctx.beginPath();ctx.moveTo(-22,-20);ctx.arc(0,-20,22,Math.PI,0);ctx.stroke();
  ctx.beginPath();ctx.moveTo(-19,0);ctx.lineTo(-15,-20);ctx.moveTo(19,0);ctx.lineTo(15,-20);ctx.stroke();
  /* Slit + warm light */
  const sa=-Math.PI*.36,sweep=.16,lx=Math.cos(sa)*17.5,ly=-20+Math.sin(sa)*17.5;
  ctx.strokeStyle='rgba(232,206,158,.85)';ctx.lineWidth=2.2;
  ctx.beginPath();ctx.arc(0,-20,17.5,sa-sweep,sa+sweep);ctx.stroke();
  const glowR=13+3*Math.sin(phase*1.4),lamp=ctx.createRadialGradient(lx,ly,0,lx,ly,glowR);
  lamp.addColorStop(0,'rgba(255,224,168,.30)');lamp.addColorStop(1,'rgba(255,224,168,0)');
  ctx.fillStyle=lamp;ctx.beginPath();ctx.arc(lx,ly,glowR,0,Math.PI*2);ctx.fill();
  /* Telescope aimed at the constellation */
  const aim=Math.atan2(cy-oy,Math.max(60,cx-ox)),len=34;
  ctx.strokeStyle='rgba(232,206,158,.75)';ctx.lineWidth=1.5;
  ctx.beginPath();ctx.moveTo(-4,-24);ctx.lineTo(-4+Math.cos(aim)*len,-24+Math.sin(aim)*len);ctx.stroke();
  ctx.lineWidth=1;ctx.strokeStyle='rgba(206,172,118,.5)';
  ctx.beginPath();ctx.moveTo(-6,-27);ctx.lineTo(-6+Math.cos(aim)*len,-27+Math.sin(aim)*len);ctx.moveTo(-2,-27);ctx.lineTo(-2+Math.cos(aim)*len,-27+Math.sin(aim)*len);ctx.stroke();
  ctx.restore();
 }
 function tickMeteor(dt){
  if(meteor){meteor.t+=dt;meteor.x+=meteor.vx*dt;meteor.y+=meteor.vy*dt;
   if(meteor.t>=meteor.life||meteor.x<-160||meteor.x>w+160||meteor.y>horizon){meteor=null;nextMeteor=6+Math.random()*7}}
  else{nextMeteor-=dt;if(nextMeteor<=0){const dir=Math.random()>.5?1:-1,speed=420+Math.random()*260;
   meteor={x:w*(.15+Math.random()*.7),y:h*(.06+Math.random()*.22),vx:dir*speed,vy:speed*.42,t:0,life:.9+Math.random()*.5}}}
 }
 function allowed(){return !paused&&!reduced.matches&&visible&&!document.hidden}
 function animate(now){frame=0;if(!allowed())return;const dt=Math.min(.05,(now-last)/1000||.016);last=now;phase+=dt;
  px+=((pointer?(pointer.x-.5)*44:0)-px)*.06;py+=((pointer?(pointer.y-.5)*30:0)-py)*.06;
  tickMeteor(dt);draw();frame=requestAnimationFrame(animate)}
 function refresh(){root.classList.toggle('effects-paused',paused||reduced.matches);button.disabled=reduced.matches;button.setAttribute('aria-pressed',String(!paused&&!reduced.matches));label.textContent=t(reduced.matches?'motionReduced':paused?'motionPlay':'motionPause');cancelAnimationFrame(frame);frame=0;meteor=null;draw();if(allowed())frame=requestAnimationFrame(animate)}
 function fit(){if(!ctx)return;const r=scene.getBoundingClientRect(),scale=Math.min(devicePixelRatio||1,2);w=r.width;h=r.height;canvas.width=Math.round(w*scale);canvas.height=Math.round(h*scale);ctx.setTransform(scale,0,0,scale,0,0);draw()}
 button.addEventListener('click',()=>{paused=!paused;try{localStorage.setItem('bk-effects-paused',String(paused))}catch{}refresh()});reduced.addEventListener('change',refresh);document.addEventListener('visibilitychange',refresh);document.addEventListener('library:language',refresh);
 if(ctx){new ResizeObserver(fit).observe(scene);new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;refresh()}).observe(scene);fit();
  if(document.fonts&&document.fonts.ready)document.fonts.ready.then(()=>{if(!allowed())draw()})}
 if(ctx&&matchMedia('(hover: hover) and (pointer: fine)').matches){scene.addEventListener('pointermove',event=>{if(paused||reduced.matches)return;const r=scene.getBoundingClientRect();pointer={x:(event.clientX-r.left)/r.width,y:(event.clientY-r.top)/r.height}},{passive:true});scene.addEventListener('pointerleave',()=>{pointer=null})}
 /* Scroll: reading progress + header condensation */
 let scrollFrame=0,condensed=null;function onScroll(){if(scrollFrame)return;scrollFrame=requestAnimationFrame(()=>{const max=document.documentElement.scrollHeight-innerHeight;progress.style.transform=`scaleX(${max>0?Math.min(1,scrollY/max):0})`;const next=scrollY>24;if(next!==condensed){condensed=next;if(next)root.dataset.condensed='';else delete root.dataset.condensed}scrollFrame=0})}addEventListener('scroll',onScroll,{passive:true});addEventListener('resize',onScroll);onScroll();
 /* Card / tile spotlight */
 if(matchMedia('(hover: hover) and (pointer: fine)').matches)document.addEventListener('pointermove',event=>{const card=event.target.closest('.card,.collection-tile');if(!card||paused||reduced.matches)return;const r=card.getBoundingClientRect();card.style.setProperty('--px',`${event.clientX-r.left}px`);card.style.setProperty('--py',`${event.clientY-r.top}px`)},{passive:true});
 /* Section reveals */
 if('IntersectionObserver'in window){const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('reveal-in');observer.unobserve(entry.target)}}),{threshold:.08});document.querySelectorAll('.panorama,.collection-section,.catalog-section,.routes-section,.archive-section').forEach(section=>observer.observe(section))}
 /* Instrument panel count-up — fires once, when renderStats first populates #stats */
 const statsBox=document.getElementById('stats');let statsPlayed=false;
 if(statsBox&&'MutationObserver'in window&&!reduced.matches){const mo=new MutationObserver(()=>{if(statsPlayed)return;const els=statsBox.querySelectorAll('strong[data-count]');if(!els.length)return;statsPlayed=true;mo.disconnect();
   const items=[...els].map(el=>({el,target:Number(el.dataset.count)||0})).filter(it=>it.target>0);if(!items.length)return;
   const t0=performance.now(),DUR=1150,fmt=v=>v.toLocaleString(typeof locale==='function'?locale():'tr');
   const step=now=>{const k=Math.min(1,(now-t0)/DUR),e=1-Math.pow(1-k,3);items.forEach(({el,target})=>{el.textContent=fmt(Math.round(target*e))});if(k<1)requestAnimationFrame(step);else items.forEach(({el,target})=>{el.textContent=fmt(target)})};
   requestAnimationFrame(step)});mo.observe(statsBox,{childList:true})}
 document.addEventListener('library:ready',()=>{buildAreas();draw()});
 refresh();
})();
