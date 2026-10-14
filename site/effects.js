'use strict';
(()=>{
 const root=document.documentElement,canvas=document.getElementById('knowledgeCanvas'),hero=document.querySelector('.hero-scene'),button=document.getElementById('motionToggle'),label=document.getElementById('motionLabel'),progress=document.getElementById('readingProgress');
 const reduced=matchMedia('(prefers-reduced-motion: reduce)'),ctx=canvas?.getContext('2d');let paused=false;try{paused=localStorage.getItem('bk-effects-paused')==='true'}catch{}
 try{if(/Mac|iPhone|iPad/.test(navigator.platform))root.dataset.os='mac'}catch{}
 let visible=true,frame=0,last=0,w=0,h=0,phase=0,pointer=null,areas=null;
 const stars=Array.from({length:150},(_,i)=>({x:((i*211+37)%1009)/1009,y:((i*331+89)%1013)/1013,r:.45+1.05*(((i*97)%11)/10),tw:((i*53)%97)/97}));
 function buildAreas(){
  try{
   const groups=typeof DISCOVERY==='undefined'?[]:DISCOVERY,rows=typeof records==='undefined'?[]:records,stat=(typeof catalog==='object'&&catalog&&catalog.stats)||{};
   if(!groups.length){areas=[];return}
   const counts=groups.map(d=>d.nobel?Number(stat.nobelDocuments)||0:rows.filter(r=>r.collection==='books'&&(d.categories||[]).includes(r.category)).length),top=Math.max(1,...counts);
   areas=groups.map((d,i)=>{const angle=-Math.PI*.92+i*(Math.PI*1.84/Math.max(1,groups.length-1)),rad=.34+.52*(((i*7+3)%5)/4);return {x:Math.cos(angle)*rad,y:Math.sin(angle)*rad*1.45,bright:.34+.66*(counts[i]/top)}})
  }catch{areas=[]}
 }
 function draw(){
  if(!ctx||!w)return;ctx.clearRect(0,0,w,h);
  if(!areas)buildAreas();
  const horizon=h*.80;
  const sky=ctx.createLinearGradient(0,0,0,h);
  sky.addColorStop(0,'rgba(10,26,46,.55)');sky.addColorStop(.6,'rgba(10,26,46,.14)');sky.addColorStop(1,'rgba(10,26,46,0)');
  ctx.fillStyle=sky;ctx.fillRect(0,0,w,h);
  const air=ctx.createLinearGradient(0,horizon-h*.30,0,horizon);
  air.addColorStop(0,'rgba(124,199,183,0)');air.addColorStop(1,'rgba(124,199,183,.10)');
  ctx.fillStyle=air;ctx.fillRect(0,horizon-h*.30,w,h*.30);
  stars.forEach((s,i)=>{
   const x=s.x*w,y=s.y*horizon*.95,tw=.28+.52*(.5+.5*Math.sin(phase*.7+s.tw*6.283));
   if(i%26===0){ctx.fillStyle=`rgba(198,220,255,${(tw*.20).toFixed(3)})`;ctx.beginPath();ctx.arc(x,y,s.r*4.6,0,Math.PI*2);ctx.fill()}
   ctx.fillStyle=`rgba(232,239,246,${(tw*(.30+.55*(s.r-.45))).toFixed(3)})`;
   ctx.beginPath();ctx.arc(x,y,s.r,0,Math.PI*2);ctx.fill();
  });
  for(let i=0;i<96;i++){const p=i/95;
   ctx.fillStyle=`rgba(204,219,240,${(.04+.09*(.5+.5*Math.sin(phase*.4+i*.9))).toFixed(3)})`;
   ctx.beginPath();ctx.arc((p*1.24-.12)*w,horizon*.60+p*horizon*.16+Math.sin(p*7.5)*h*.045,1.35,0,Math.PI*2);ctx.fill()}
  ctx.beginPath();ctx.moveTo(0,h);ctx.lineTo(0,horizon);
  for(let x=0;x<=w;x+=Math.max(24,w/16)){const u=x/Math.max(1,w),ridge=6+(.5+.5*Math.sin(u*9.1+phase*.03))*16+(.5+.5*Math.sin(u*23.7+1.3))*9;ctx.lineTo(x,horizon-ridge)}
  ctx.lineTo(w,h);ctx.closePath();
  const ground=ctx.createLinearGradient(0,horizon-h*.05,0,h);
  ground.addColorStop(0,'rgba(4,8,16,.86)');ground.addColorStop(1,'rgba(3,5,11,.99)');
  ctx.fillStyle=ground;ctx.fill();
  const drift=pointer&&!paused&&!reduced.matches?{x:(pointer.x-.5)*26,y:(pointer.y-.5)*18}:{x:0,y:0};
  const cx=w*.68+drift.x,cy=h*.42+drift.y,radius=Math.min(w*.30,h*.36);
  if(areas.length){
   ctx.lineWidth=1;ctx.strokeStyle='rgba(232,206,158,.24)';ctx.beginPath();
   areas.forEach((a,i)=>{const x=cx+a.x*radius,y=cy+a.y*radius;i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.stroke();
   areas.forEach(a=>{const x=cx+a.x*radius,y=cy+a.y*radius,glow=12+14*a.bright;
    const halo=ctx.createRadialGradient(x,y,0,x,y,glow);halo.addColorStop(0,`rgba(248,235,203,${(.30*a.bright).toFixed(3)})`);halo.addColorStop(1,'rgba(248,235,203,0)');
    ctx.fillStyle=halo;ctx.beginPath();ctx.arc(x,y,glow,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=`rgba(250,242,220,${(.55+.45*a.bright).toFixed(3)})`;ctx.beginPath();ctx.arc(x,y,1.7+a.bright*2.3,0,Math.PI*2);ctx.fill()})
  }
  ctx.save();ctx.translate(w*.60,horizon-1);ctx.strokeStyle='rgba(206,172,118,.58)';ctx.lineWidth=1.5;ctx.lineJoin='round';ctx.lineCap='round';
  ctx.beginPath();ctx.moveTo(0,-30);ctx.lineTo(-26,0);ctx.moveTo(0,-30);ctx.lineTo(26,0);ctx.moveTo(0,-30);ctx.lineTo(2,2);ctx.stroke();
  ctx.beginPath();ctx.moveTo(-40,-4);ctx.lineTo(-34,-14);ctx.lineTo(38,-56);ctx.lineTo(32,-45);ctx.closePath();ctx.stroke();
  ctx.beginPath();ctx.moveTo(38,-56);ctx.lineTo(46,-60);ctx.moveTo(32,-45);ctx.lineTo(40,-49);ctx.stroke();
  ctx.restore();
 }
 function allowed(){return !paused&&!reduced.matches&&visible&&!document.hidden}
 function animate(now){frame=0;if(!allowed())return;if(now-last>33){phase+=.033;draw();last=now}frame=requestAnimationFrame(animate)}
 function refresh(){document.documentElement.classList.toggle('effects-paused',paused||reduced.matches);button.disabled=reduced.matches;button.setAttribute('aria-pressed',String(!paused&&!reduced.matches));label.textContent=t(reduced.matches?'motionReduced':paused?'motionPlay':'motionPause');cancelAnimationFrame(frame);frame=0;draw();if(allowed())frame=requestAnimationFrame(animate)}
 function fit(){if(!ctx)return;const r=hero.getBoundingClientRect(),scale=Math.min(devicePixelRatio||1,2);w=r.width;h=r.height;canvas.width=Math.round(w*scale);canvas.height=Math.round(h*scale);ctx.setTransform(scale,0,0,scale,0,0);draw()}
 button.addEventListener('click',()=>{paused=!paused;try{localStorage.setItem('bk-effects-paused',String(paused))}catch{}refresh()});reduced.addEventListener('change',refresh);document.addEventListener('visibilitychange',refresh);document.addEventListener('library:language',refresh);
 if(ctx){new ResizeObserver(fit).observe(hero);new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;refresh()}).observe(hero);fit()}
 if(ctx&&matchMedia('(hover: hover) and (pointer: fine)').matches){hero.addEventListener('pointermove',event=>{if(paused||reduced.matches)return;const r=hero.getBoundingClientRect();pointer={x:(event.clientX-r.left)/r.width,y:(event.clientY-r.top)/r.height}},{passive:true});hero.addEventListener('pointerleave',()=>{pointer=null;draw()})}
 let scrollFrame=0,condensed=null;function scroll(){if(scrollFrame)return;scrollFrame=requestAnimationFrame(()=>{const max=document.documentElement.scrollHeight-innerHeight;progress.style.transform=`scaleX(${max>0?Math.min(1,scrollY/max):0})`;const next=scrollY>24;if(next!==condensed){condensed=next;if(next)root.dataset.condensed='';else delete root.dataset.condensed}scrollFrame=0})}addEventListener('scroll',scroll,{passive:true});addEventListener('resize',scroll);scroll();
 if(matchMedia('(hover: hover) and (pointer: fine)').matches)document.addEventListener('pointermove',event=>{const card=event.target.closest('.card,.collection-tile');if(!card||paused||reduced.matches)return;const r=card.getBoundingClientRect();card.style.setProperty('--px',`${event.clientX-r.left}px`);card.style.setProperty('--py',`${event.clientY-r.top}px`)},{passive:true});
 if('IntersectionObserver'in window){const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('reveal-in');observer.unobserve(entry.target)}}),{threshold:.08});document.querySelectorAll('.panorama,.collection-section,.catalog-section,.routes-section,.archive-section').forEach(section=>observer.observe(section))}
 const statEls=document.querySelectorAll('#stats strong');
 if(statEls.length&&'IntersectionObserver'in window){const seen=new WeakSet();const ticker=new IntersectionObserver(entries=>entries.forEach(entry=>{if(!entry.isIntersecting||seen.has(entry.target))return;seen.add(entry.target);ticker.unobserve(entry.target);const target=Number(entry.target.dataset.count);if(!Number.isFinite(target)||target<=0)return;entry.target.classList.add('stat-tick')}),{threshold:.35});statEls.forEach(el=>ticker.observe(el))}
 document.addEventListener('library:ready',()=>{buildAreas();draw()});
 refresh();
})();
