'use strict';
/* BKGL — the one place that knows about the GPU for every WebGL scene (hero, shelf/record stage, ground, constellation, Nobel galaxy, skyline, empty state).
   • probe(gl|renderer): GPU name, texture units/size, WebGL2, float/half-float render targets, parallel shader compile (cached, never opens a context of its own)
   • watch(canvas,{name,onLost,onRestore}): the ONLY webglcontextlost/restored listener in the code base. It always calls preventDefault (without it the browser never restores the
     context) and keeps per-scene counters; modules just pass what to do while lost and after restore. Returns {lost, off()}.
   • flags: switch features on/off at run time — BKGL.flags.set('stagequality',false) or localStorage bk-flag-<name>=0|1
   • report(name,fn|obj) + log(msg) + diag(): every scene adds its own status; ?diag shows them all in ONE corner panel */
(()=>{
 const DEFAULTS={stagequality:true,diag:false};   // stagequality: the 3D stage follows the quality tier (DPR cap / idle frame rate); off = always full quality
 const mem={};
 const flags={
  get(n){if(n in mem)return mem[n];let v=!!DEFAULTS[n];try{const s=localStorage.getItem('bk-flag-'+n);if(s==='0')v=false;else if(s==='1')v=true}catch{}return mem[n]=v},
  set(n,v){v=!!v;mem[n]=v;try{localStorage.setItem('bk-flag-'+n,v?'1':'0')}catch{}try{document.dispatchEvent(new CustomEvent('bk:flag',{detail:{name:n,value:v}}))}catch{}return v},
  all(){const o={};for(const n in DEFAULTS)o[n]=flags.get(n);return o}};
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
  return{info,quality:q(),flags:flags.all(),scenes:sc,reports:rp,log:logs.slice()}}
 function text(){const d=diag(),i=d.info,names=[...new Set([...Object.keys(d.scenes),...Object.keys(d.reports)])];
  let s='BK GL · quality L'+d.quality+(i?' · '+i.gpu+' · units '+i.units+' · max '+i.size+' · '+(i.webgl2?'webgl2':'webgl1')+(i.floatRT?' · floatRT':'')+(i.halfRT?' · halfRT':'')+(i.parallelCompile?' · parallel-compile':''):' · no context yet')+' · flags '+Object.keys(d.flags).map(k=>k+'='+(d.flags[k]?1:0)).join(',');
  for(const n of names){const c=d.scenes[n];s+='\n'+n+' '+(c?(c.lost?'LOST':'ok')+(c.losses?' ×'+c.losses:''):'-')+(d.reports[n]?' · '+d.reports[n]:'')}
  if(d.log.length)s+='\n'+d.log.slice(-3).join(' ; ');return s}
 function panel(){if(document.querySelector('pre[data-bkgl-diag]'))return;
  const el=document.createElement('pre');el.setAttribute('data-bkgl-diag','');el.style.cssText='position:fixed;left:8px;bottom:8px;z-index:9999;margin:0;padding:6px 8px;font:11px/1.35 monospace;color:#cfe;background:rgba(0,0,0,.72);border-radius:6px;max-width:92vw;white-space:pre-wrap;pointer-events:none';
  document.body.appendChild(el);const up=()=>{el.textContent=text()};up();setInterval(up,1000)}
 window.BKGL={probe,watch,flags,report,log,diag,text,get info(){return info}};
 const want=()=>/[?&]diag\b/.test(location.search)||flags.get('diag');
 if(want()){if(document.body)panel();else addEventListener('DOMContentLoaded',panel,{once:true})}
})();
