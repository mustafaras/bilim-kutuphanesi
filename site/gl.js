'use strict';
/* BKGL — the one place that knows about the GPU for every WebGL scene (hero, shelf/record stage, ground, constellation, Nobel galaxy, skyline, empty state).
   • probe(gl|renderer): GPU name, texture units/size, WebGL2, float/half-float render targets, parallel shader compile (cached, never opens a context of its own)
   • watch(canvas,{name,onLost,onRestore}): the ONLY webglcontextlost/restored listener in the code base. It always calls preventDefault (without it the browser never restores the
     context) and keeps per-scene counters; modules just pass what to do while lost and after restore. Returns {lost, off()}.
   • flags: switch features on/off at run time — BKGL.flags.set('stagequality',false) or localStorage bk-flag-<name>=0|1
   • report(name,fn|obj) + log(msg) + diag(): every scene adds its own status; ?diag shows them all in ONE corner panel
   • gpuTimer(gl|renderer): per-frame GPU ms from EXT_disjoint_timer_query_webgl2 (null where the GPU lacks it); the hero governor reads it before it looks at rAF time (flag gputime)
   • perf.track(name,renderer): frame recorder behind the ?perf panel (last 120 frames: GPU ms / CPU ms / fps / draw calls / triangles / programs + copy button). Idle and free unless ?perf (or flag perf) is on: work stays 0
   • warm(name,renderer,build,opts): compileAsync (KHR_parallel_shader_compile) of the scenes build() returns, in idle time, so the first open of a book / medal does not stall on shader compilation (flag warm) */
(()=>{
 const DEFAULTS={stagequality:true,diag:false,perf:false,gputime:true,warm:true,warmforce:false,matlib:true,acestone:false,pagebend:true,paperfiber:true};   // stagequality: the 3D stage follows the quality tier (DPR cap / idle frame rate); off = always full quality · perf: the ?perf panel · gputime: GPU timer queries feed the hero governor · warm: idle shader warm-up (pagebend: turning leaves bend around a cylinder with sheet thickness (off = the old parabola) · paperfiber: paper fibre normal map, back-face bleed and leaf shadows (off = plain paper) · matlib: BKMaterials factories build the full PBR materials (off = plain standard level) · acestone: ACES tone mapping + exposure per theme (off = NoToneMapping, what the visual goldens use) · warmforce: also without KHR_parallel_shader_compile, where compiling blocks the main thread; tests only)
 const mem={};
 const flags={
  get(n){if(n in mem)return mem[n];let v=!!DEFAULTS[n];try{const s=localStorage.getItem('bk-flag-'+n);if(s==='0')v=false;else if(s==='1')v=true}catch{}return mem[n]=v},
  set(n,v){v=!!v;mem[n]=v;try{localStorage.setItem('bk-flag-'+n,v?'1':'0')}catch{}try{document.dispatchEvent(new CustomEvent('bk:flag',{detail:{name:n,value:v}}))}catch{}return v},
  all(){const o={};for(const n in DEFAULTS)o[n]=flags.get(n);return o}};
 /* ?still=1 — deterministic mode for the visual regression gate (tools/visual_audit.py): seeded Math.random, effects paused (static frames, no CSS animation), tiles render with dt 0. Nothing changes without the parameter. */
 const STILL=/[?&]still\b/.test(location.search);
 let reseed=()=>{};
 if(STILL){let a=20261018;reseed=n=>{a=20261018+(n|0)*7919};Math.random=()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296};document.documentElement.classList.add('effects-paused','still-mode')}
 let info=null;
 function probe(src){
  if(info&&info.gpu)return info;
  try{const g=src&&src.getContext?src.getContext():src;if(!g||!g.getParameter)return info;
   const d=g.getExtension('WEBGL_debug_renderer_info'),w2=typeof WebGL2RenderingContext!=='undefined'&&g instanceof WebGL2RenderingContext;
   info={gpu:String(d?g.getParameter(d.UNMASKED_RENDERER_WEBGL):g.getParameter(g.RENDERER)),units:g.getParameter(g.MAX_TEXTURE_IMAGE_UNITS),size:g.getParameter(g.MAX_TEXTURE_SIZE),webgl2:w2,
    floatRT:!!(g.getExtension('EXT_color_buffer_float')||g.getExtension('WEBGL_color_buffer_float')),
    halfRT:!!(g.getExtension('EXT_color_buffer_half_float')||g.getExtension('EXT_color_buffer_float')),
    parallelCompile:!!g.getExtension('KHR_parallel_shader_compile')}}catch{}
  return info}
 const scenes={},reports={},logs=[];
 /* ---------- GPU timer queries ---------- */
 const RING=120,stat=(a,n)=>{if(!n)return{avg:0,p95:0,max:0};const v=Array.prototype.slice.call(a,0,n).sort((x,y)=>x-y);let t=0;for(const x of v)t+=x;return{avg:t/n,p95:v[Math.min(n-1,Math.floor(n*.95))],max:v[n-1]}};
 function gpuTimer(src){
  let g=null,ext=null;try{g=src&&src.getContext?src.getContext():src;if(!g||!g.createQuery)return null;ext=g.getExtension('EXT_disjoint_timer_query_webgl2')}catch{return null}
  if(!ext)return null;
  const pend=[],spare=[],ring=new Float32Array(RING),win=[];let cur=null,i=0,n=0;
  const T={last:0,disjoint:0,get n(){return n},
   poll(){try{while(pend.length&&g.getQueryParameter(pend[0],g.QUERY_RESULT_AVAILABLE)){const q=pend.shift();
     if(g.getParameter(ext.GPU_DISJOINT_EXT)){T.disjoint++}else{const ms=g.getQueryParameter(q,g.QUERY_RESULT)/1e6;T.last=ms;ring[i]=ms;i=(i+1)%RING;if(n<RING)n++;win.push(ms)}spare.push(q)}}catch{}},
   begin(){if(cur||!flags.get('gputime'))return;T.poll();if(pend.length>8)return;try{const q=spare.pop()||g.createQuery();g.beginQuery(ext.TIME_ELAPSED_EXT,q);cur=q}catch{cur=null}},
   end(){if(!cur)return;try{g.endQuery(ext.TIME_ELAPSED_EXT);pend.push(cur)}catch{}cur=null},
   /* mean GPU ms of the results that arrived since the last take() (the governor's measurement window) */
   take(){T.poll();const k=win.length;let t=0;for(const x of win)t+=x;win.length=0;return{ms:k?t/k:0,n:k}},
   stats(){T.poll();return{...stat(ring,n),n}}};
  return T}

 /* ---------- ?perf: last 120 frames per scene ---------- */
 const PERFQ=/[?&]perf\b/.test(location.search),perfOn=()=>PERFQ||flags.get('perf');   // read once: the app rewrites the address bar after load
 const tracks={};let panelEl=null,obs=null;const LT={n:0,max:0,first5:0};
 const P={work:0,lastCopy:'',get on(){return perfOn()},
  track(name,renderer,o){
   const gl=renderer.getContext?renderer.getContext():null,T=gpuTimer(renderer),cpu=new Float32Array(RING),dts=new Float32Array(RING),calls=new Float32Array(RING),tris=new Float32Array(RING);
   let i=0,n=0,frames=0,long=0,t0=0,prev=0,mine=false;
   const tr={name,renderer,timer:T,get frames(){return frames},
    begin(){if(T)T.begin();if(!perfOn()){if(mine){renderer.info.autoReset=true;mine=false}return}
     if(!mine){renderer.info.autoReset=false;mine=true}renderer.info.reset();t0=performance.now()},
    end(){if(T)T.end();if(!mine)return;P.work++;
     const now=performance.now(),c=now-t0;cpu[i]=c;dts[i]=prev&&now-prev<1000?now-prev:0;calls[i]=renderer.info.render.calls;tris[i]=renderer.info.render.triangles;prev=now;i=(i+1)%RING;if(n<RING)n++;frames++;if(c>50)long++},
    stats(){const c=stat(cpu,n),d=Array.prototype.slice.call(dts,0,n).filter(x=>x>0),dt=d.length?d.reduce((a,b)=>a+b,0)/d.length:0,gp=T?T.stats():null,last=(i+RING-1)%RING,inf=renderer.info;
     return{n,frames,fps:dt?1000/dt:0,cpuAvg:c.avg,cpuP95:c.p95,cpuMax:c.max,gpu:gp,gpuNote:T?(flags.get('gputime')?'timer query':'timer query (flag off)'):'no timer query (rAF only)',
      draws:n?calls[last]:0,tris:n?tris[last]:0,programs:inf.programs?inf.programs.length:0,geometries:inf.memory.geometries,textures:inf.memory.textures,longFrames:long,level:q(),source:T&&T.n>=8?'gpu':'raf'}}};
   tracks[name]=tr;return tr},
  stats(name){const t=tracks[name];return t?t.stats():null},
  get tracks(){return Object.keys(tracks)},
  text(){const f=v=>v==null||!isFinite(v)?'-':v.toFixed(1),i=info;
   let s='BK PERF · '+new Date().toISOString().slice(0,19)+'Z · '+(navigator.userAgent.match(/(Edg|Firefox|Chrome)\/[\d.]+/)||navigator.userAgent.match(/Version\/[\d.]+/)||[''])[0]+'\nGPU '+(i?i.gpu+' · '+(i.webgl2?'webgl2':'webgl1')+' · units '+i.units+' · max '+i.size+(i.parallelCompile?' · parallel-compile':''):'no context yet')+'\nquality L'+q()+' · viewport '+innerWidth+'x'+innerHeight+' @'+(devicePixelRatio||1)+' · flags '+Object.keys(flags.all()).map(k=>k+'='+(flags.get(k)?1:0)).join(',');
   for(const nm in tracks){const t=tracks[nm].stats(),g=t.gpu;
    s+='\n'+nm+' · frames '+t.n+'/'+RING+' · '+f(t.fps)+' fps · GPU '+(g&&g.n?f(g.avg)+' avg / '+f(g.p95)+' p95 / '+f(g.max)+' max ms (n '+g.n+')':t.gpuNote)+' · CPU '+f(t.cpuAvg)+' avg / '+f(t.cpuP95)+' p95 / '+f(t.cpuMax)+' max ms · draws '+t.draws+' · tris '+t.tris+' · programs '+t.programs+' · geom '+t.geometries+' · tex '+t.textures+' · >50 ms frames '+t.longFrames+' · governor '+t.source}
   const w=warm.states;for(const nm in w)s+='\nwarm '+nm+' · '+w[nm].state+(w[nm].ms!=null?' · '+w[nm].ms+' ms (compile '+w[nm].compileMs+' ms)':'')+(w[nm].programs!=null?' · programs '+w[nm].programs:'')+(w[nm].start!=null?' · started '+w[nm].start+' ms after load':'');
   s+='\nlong tasks (>50 ms) since the panel opened: '+LT.n+' · longest '+LT.max+' ms · in the first 5 s: '+LT.first5;return s},
  mount(){if(panelEl||!document.body)return;
   const el=panelEl=document.createElement('div');el.setAttribute('data-bkgl-perf','');el.style.cssText='position:fixed;right:8px;bottom:8px;z-index:9998;padding:6px 8px;font:11px/1.35 monospace;color:#fec;background:rgba(0,0,0,.78);border-radius:6px;max-width:min(92vw,720px)';
   const pre=document.createElement('pre');pre.style.cssText='margin:0;white-space:pre-wrap;pointer-events:none';const b=document.createElement('button');b.type='button';b.textContent='kopyala';b.style.cssText='margin-top:4px;font:11px monospace;padding:2px 8px;cursor:pointer';
   b.addEventListener('click',()=>{const t=P.text();P.lastCopy=t;const ok=()=>{b.textContent='kopyalandı'},fb=()=>{try{const ta=document.createElement('textarea');ta.value=t;ta.style.cssText='position:fixed;opacity:0';document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();ok()}catch{b.textContent='kopyalanamadı'}};
    try{navigator.clipboard.writeText(t).then(ok,fb)}catch{fb()}setTimeout(()=>{b.textContent='kopyala'},1600)});
   el.append(pre,b);document.body.appendChild(el);const up=()=>{if(!perfOn()){el.remove();panelEl=null;return}pre.textContent=P.text();P.work++;setTimeout(up,500)};up();
   try{obs=new PerformanceObserver(l=>{for(const e of l.getEntries()){if(e.duration<=50)continue;LT.n++;LT.max=Math.max(LT.max,Math.round(e.duration));if(e.startTime<5000)LT.first5++}});obs.observe({type:'longtask',buffered:true})}catch{}}};
 document.addEventListener('bk:flag',()=>{if(perfOn()){if(document.body)P.mount()}else if(panelEl){panelEl.remove();panelEl=null;if(obs){obs.disconnect();obs=null}}});

 /* ---------- idle shader warm-up ---------- */
 const warm=(name,renderer,build,o)=>{o=o||{};const st=warm.states[name]={state:'idle'};
  if(!flags.get('warm')){st.state='off';return Promise.resolve(st)}
  if(!probe(renderer)||(!info.parallelCompile&&!flags.get('warmforce'))||typeof renderer.compileAsync!=='function'){st.state='skipped';st.why='no KHR_parallel_shader_compile';return Promise.resolve(st)}
  st.state='waiting';
  return new Promise(res=>{
   const run=()=>{if(!flags.get('warm')){st.state='off';return res(st)}
    st.state='running';st.start=Math.round(performance.now());const t0=performance.now();let cm=0;
    try{const jobs=build()||[];
     (function next(k){if(k>=jobs.length){st.state='done';st.ms=Math.round(performance.now()-t0);st.compileMs=Math.round(cm);st.programs=renderer.info.programs?renderer.info.programs.length:0;log('warm '+name+' done '+st.ms+' ms');return res(st)}
      let j=jobs[k];try{if(typeof j==='function')j=j()}catch(e){j=null}const c0=performance.now();if(!j){idle(()=>next(k+1),200);return}
      Promise.race([renderer.compileAsync(j[0],j[1]),new Promise(r=>setTimeout(r,8000))]).catch(()=>{}).then(()=>{cm+=performance.now()-c0;idle(()=>next(k+1),200)})})(0)}
    catch(e){st.state='failed';st.why=String(e).slice(0,120);log('warm '+name+' failed '+st.why);res(st)}};
   if(o.now)run();else setTimeout(()=>idle(run,2500),Math.max(0,(o.minAt||0)-performance.now()))})};
 warm.states={};
 const idle=(f,t)=>typeof requestIdleCallback==='function'?requestIdleCallback(f,{timeout:t||1500}):setTimeout(f,60);

 const q=()=>window.BKMotion?BKMotion.quality.level:0;
 function watch(canvas,o){o=o||{};let name=o.name||'gl';
  const old=scenes[name];if(old&&old.attached&&old.canvas.isConnected&&old.canvas!==canvas){let i=2;while(scenes[name+'#'+i]&&scenes[name+'#'+i].canvas.isConnected)i++;name+='#'+i}
  const rec=scenes[name]={canvas,attached:canvas.isConnected,lost:false,losses:0,restores:0,t:0};
  const lost=e=>{e.preventDefault();rec.lost=true;rec.losses++;rec.t=Date.now();log(name+': context lost');try{o.onLost&&o.onLost(e)}catch(err){log(name+': onLost threw '+err)}};
  const back=e=>{rec.lost=false;rec.restores++;log(name+': context restored');try{o.onRestore&&o.onRestore(e)}catch(err){log(name+': onRestore threw '+err)}};
  canvas.addEventListener('webglcontextlost',lost);canvas.addEventListener('webglcontextrestored',back);
  return{get lost(){return rec.lost},off(){canvas.removeEventListener('webglcontextlost',lost);canvas.removeEventListener('webglcontextrestored',back);if(scenes[name]===rec)delete scenes[name]}}}
 function log(m){logs.push(((performance.now()/1000)|0)+'s '+m);if(logs.length>12)logs.shift()}
 function report(name,v){reports[name]=v}
 const fmt=v=>{try{v=typeof v==='function'?v():v}catch(e){return 'report error'}if(v==null)return '';if(typeof v==='object')return Object.keys(v).map(k=>k+' '+(v[k]&&typeof v[k]==='object'?JSON.stringify(v[k]):v[k])).join(' · ');return String(v)};
 function diag(){
  for(const n in scenes)if(scenes[n].attached&&!scenes[n].canvas.isConnected)delete scenes[n];   // torn-down scenes (closed record, replaced empty state) are not "lost"
  const sc={};for(const n in scenes){const r=scenes[n];sc[n]={lost:r.lost,losses:r.losses,restores:r.restores}}
  const rp={};for(const n in reports)rp[n]=fmt(reports[n]);
  return{info,quality:q(),flags:flags.all(),scenes:sc,reports:rp,log:logs.slice(),warm:{...warm.states}}}
 function text(){const d=diag(),i=d.info,names=[...new Set([...Object.keys(d.scenes),...Object.keys(d.reports)])];
  let s='BK GL · quality L'+d.quality+(i?' · '+i.gpu+' · units '+i.units+' · max '+i.size+' · '+(i.webgl2?'webgl2':'webgl1')+(i.floatRT?' · floatRT':'')+(i.halfRT?' · halfRT':'')+(i.parallelCompile?' · parallel-compile':''):' · no context yet')+' · flags '+Object.keys(d.flags).map(k=>k+'='+(d.flags[k]?1:0)).join(',');
  for(const n of names){const c=d.scenes[n];s+='\n'+n+' '+(c?(c.lost?'LOST':'ok')+(c.losses?' ×'+c.losses:''):'-')+(d.reports[n]?' · '+d.reports[n]:'')}
  if(d.log.length)s+='\n'+d.log.slice(-3).join(' ; ');return s}
 function panel(){if(document.querySelector('pre[data-bkgl-diag]'))return;
  const el=document.createElement('pre');el.setAttribute('data-bkgl-diag','');el.style.cssText='position:fixed;left:8px;bottom:8px;z-index:9999;margin:0;padding:6px 8px;font:11px/1.35 monospace;color:#cfe;background:rgba(0,0,0,.72);border-radius:6px;max-width:92vw;white-space:pre-wrap;pointer-events:none';
  document.body.appendChild(el);const up=()=>{el.textContent=text()};up();setInterval(up,1000)}
 window.BKGL={still:STILL,reseed,probe,watch,flags,report,log,diag,text,gpuTimer,perf:P,warm,get info(){return info}};
 const want=()=>/[?&]diag\b/.test(location.search)||flags.get('diag');
 if(want()){if(document.body)panel();else addEventListener('DOMContentLoaded',panel,{once:true})}
 if(perfOn()){if(document.body)P.mount();else addEventListener('DOMContentLoaded',()=>P.mount(),{once:true})}
})();
