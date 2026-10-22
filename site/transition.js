'use strict';
/* BKTransition — R10.a freeze-and-cross.
   The outgoing scene's last frame is frozen into ONE render target, the incoming scene keeps drawing live underneath,
   and a single ShaderMaterial composites the two on a separate pointer-events:none canvas that is removed on exit.
   • ONE effect for every switch (R10.h): `weave` — a dotted node field joined by dashed links, under three dashed arcs that
     open from the centre. Every view pair (galaxy / skyline / chart, both directions) runs this one cross, so the whole
     section speaks a single visual language: plotted points and hairline dashes. No vignette, no flash, no zoom, no morph.
   • ONE program: uMode only picks weave (the show) or cut (the <=120 ms fallback for software GL), so the program count
     never grows with the transition table.
   • the frozen frame is a CanvasTexture uploaded with renderer.initTexture() in the SAME task as the source render — a
     preserveDrawingBuffer:false canvas is blank once the task ends, so a later upload would freeze an empty frame
   • the freeze pass bakes the HOST panel's own background behind the frame (both scene canvases are alpha:true), so the
     frozen image is opaque and the composite can hand the incoming scene back through its alpha channel
   • the frozen frame is contain-fitted (uFit), so a 3D frame crossing into the shorter chart card keeps its aspect instead
     of stretching the skyline
   • a missing frozen frame is not a hard cut: the weave still runs over the host background — that is how the chart, which
     is DOM and has no GL frame, joins the same effect
   • reduced-motion: no transition is built at all (0 frames, 0 ms) — the view switch is already a cut
   • quality S3+: the cut mode (<=120 ms) instead of the requested effect
   • context loss mid-transition: the frozen frame is dropped and the composite is removed in the same tick, so the live
     incoming scene shows
   • still(mode,t): one deterministic frame at a fixed uT for tools/visual_audit.py (?still only) */
(()=>{
 const reduced=typeof matchMedia==='function'?matchMedia('(prefers-reduced-motion: reduce)'):{matches:false};
 const MODE={weave:0,cut:1};
 /* the retired names resolve to the one effect: an older tool (iris / dive / materialize / chroma / filament) still runs the
    weave instead of asking for a transition that no longer exists */
 const ALIAS={iris:'weave',dive:'weave',materialize:'weave',chroma:'weave',filament:'weave'};
 const DUR={weave:1050,cut:120};
 const VERT='varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}';
 let THREE=null,loading=false,cross=null,cur=null,last=null,blankCv=null;

 /* the fragment source is built once, on first use: BKShaders must already be on the page */
 let FRAG=null;
 function frag(){
  if(FRAG)return FRAG;
  FRAG=window.BKShaders.use('hash')+`
varying vec2 vUv;
uniform sampler2D tFrom;
uniform vec2 uCenter,uBgC,uBgR,uFit;
uniform vec3 uBgA,uBgB;
uniform float uT,uMode,uPass,uAspect,uGrid,uHasSrc,uLight;
vec3 bgAt(vec2 uv){vec2 d=(uv-uBgC)/max(uBgR,vec2(1e-4));return mix(uBgA,uBgB,clamp(length(d),0.,1.));}
/* the frozen frame is contain-fitted inside the composite: outside its box the host background shows instead of a stretched scene */
vec4 fromAt(vec2 uv,out float cov){
 vec2 su=(uv-.5)*uFit+.5;
 cov=uHasSrc>.5&&su.x>0.&&su.x<1.&&su.y>0.&&su.y<1.?1.:0.;
 vec4 s=uHasSrc>.5?texture2D(tFrom,clamp(su,0.,1.)):vec4(0.);
 if(any(isnan(s)))s=vec4(0.);
 cov*=clamp(s.a,0.,1.);
 return s;
}
void main(){
 float cov;vec4 s=fromAt(vUv,cov);
 if(uPass<.5){gl_FragColor=vec4(mix(bgAt(vUv),s.rgb,cov),1.);return;}   /* freeze: the outgoing frame over the host background */
 vec2 uv=vUv,d=uv-uCenter;d.x*=uAspect;
 float r=length(d);
 vec3 col=mix(bgAt(vUv),s.rgb,cov);
 float a=1.;
 if(uMode<.5){
  /* weave — the one cross. A lattice of plotted points ignites along a top-left to bottom-right front and is joined by
     DASHED links; three dashed arcs open from the centre underneath them. The frozen frame is gone by 34 %, so nothing of
     the outgoing view survives into the second half and the field is the only thing on screen. One hash per cell drives the
     offset, the ignition time and the colour, so the whole branch is deterministic (still() can hold any uT) and costs
     5 hashes per fragment. */
  float base=1.-smoothstep(0.,.34,uT);
  float sweep=clamp(uv.x*.55+(1.-uv.y)*.45,0.,1.);          /* ignition front, never radial */
  vec2 g=uv*vec2(uAspect,1.)*uGrid;
  vec2 cell=floor(g),f=g-cell;
  float h=bk_hash12(cell);
  vec2 p0=.5+(vec2(fract(h*7.31),fract(h*13.7))-.5)*.5;      /* +-0.25 keeps every point inside its own cell */
  float t0=sweep*.30+h*.14;
  float ig=smoothstep(t0,t0+.20,uT);
  float hold=1.-smoothstep(.60,.98,uT);
  float dd=length(f-p0);
  float core=1.-smoothstep(.026,.055,dd);                    /* crisp plotted dot */
  float ring=smoothstep(.040,.052,dd)*(1.-smoothstep(.062,.082,dd));   /* hairline halo around it */
  float node=max(core,ring*.7)*ig*hold;
  float line=0.;
  for(int i=0;i<4;i++){                                      /* all four neighbours: each cell draws its half of every link */
   vec2 o=i==0?vec2(1.,0.):i==1?vec2(0.,1.):i==2?vec2(-1.,0.):vec2(0.,-1.);
   float h1=bk_hash12(cell+o);
   vec2 p1=o+.5+(vec2(fract(h1*7.31),fract(h1*13.7))-.5)*.5;
   float t1=sweep*.30+h1*.14;
   float k1=smoothstep(t1,t1+.20,uT);
   vec2 pa=f-p0,ba=p1-p0;
   float sp=clamp(dot(pa,ba)/max(dot(ba,ba),1e-6),0.,1.);
   float sd=length(pa-ba*sp);
   /* the dash: 3.2 periods along the segment with soft ends, so the link reads as a ruled measurement line, not a bar */
   float u1=fract(sp*3.2);
   float dash=smoothstep(.34,.40,u1)*(1.-smoothstep(.86,.92,u1));
   line=max(line,(1.-smoothstep(.007,.017,sd))*dash*min(ig,k1));
  }
  line*=.85*(1.-smoothstep(.52,.94,uT));
  float arcs=0.;
  for(int i=0;i<3;i++){                                      /* dashed arcs opening from the centre: the astronomical aura */
   float R=mix(.04,.58,uT)*(1.+float(i)*.22);
   float ang=atan(d.y,d.x);
   float das=step(.42,fract(ang*4.1379+float(i)*.37));
   arcs=max(arcs,(1.-smoothstep(.0018,.0055,abs(r-R)))*das);
  }
  arcs*=.75*(1.-smoothstep(.50,.92,uT));
  float field=max(max(node,line),arcs*.8);
  /* theme: night sky gets azure and gold dots, parchment gets ink blue and brass, so neither theme washes the field out */
  vec3 az=uLight>.5?vec3(.13,.28,.46):vec3(.32,.60,1.);
  vec3 gd=uLight>.5?vec3(.62,.42,.11):vec3(1.,.74,.36);
  vec3 fc=mix(az,gd,clamp(node*1.3+arcs,0.,1.));
  /* exact endpoints: uT=0 is the untouched frozen frame, uT=1 is fully transparent, so the cross starts and ends on a clean
     frame instead of a half-lit one (visual_audit compares those two frames) */
  col=mix(col,fc,clamp(field,0.,1.));
  a=max(base,field);
 }else{
  a=1.-uT;                                                   /* cut: one short cross-fade, no motion */
 }
 /* feather the composite's own edges so the frozen frame melts into the page instead of ending on a hard rectangle */
 float edge=smoothstep(0.,.05,vUv.x)*smoothstep(0.,.05,1.-vUv.x)*smoothstep(0.,.07,vUv.y)*smoothstep(0.,.07,1.-vUv.y);
 gl_FragColor=vec4(col,clamp(a,0.,1.)*edge);
}`;
  return FRAG;
 }

 function init(){
  if(THREE||loading)return;
  loading=true;
  import('./vendor/three.module.min.js').then(m=>{THREE=m}).catch(()=>{}).finally(()=>{loading=false});
 }

 /* nobel3d registers the two sides once both scenes exist: from() → {render} of the outgoing view, host() → the incoming panel, bg() → its background */
 function bind(c){cross=c||null}

 function snapshot(){
  const f=cross&&cross.from?cross.from():null;
  if(!f)return null;
  let cv=f.canvas;
  if(typeof f.render==='function'){const r=f.render();if(r&&typeof r.getContext==='function')cv=r}
  return cv&&typeof cv.getContext==='function'?cv:null;
 }

 /* a 1x1 transparent stand-in, so a switch without a frozen frame still runs the same composite instead of a hard cut */
 function blank(){
  if(blankCv)return blankCv;
  blankCv=document.createElement('canvas');blankCv.width=blankCv.height=1;
  return blankCv;
 }

 /* contain-fit of the frozen frame inside the composite (the chart card is shorter than the 3D panel) */
 function fitOf(src,w,h){
  if(!src||!src.width||!src.height)return{x:1,y:1};
  const sa=src.width/src.height,ha=w/Math.max(1,h);
  return sa>ha?{x:1,y:sa/ha}:{x:ha/sa,y:1};
 }

 const modeOf=m=>MODE[m]!=null?m:ALIAS[m]||'weave';

 function build(host,src,mode){
  const w=Math.max(2,host.clientWidth|0),h=Math.max(2,host.clientHeight|0),dpr=Math.min(devicePixelRatio||1,1.5);
  const cv=document.createElement('canvas');
  cv.className='nc-cross';cv.setAttribute('aria-hidden','true');
  host.appendChild(cv);
  let renderer;
  try{renderer=new THREE.WebGLRenderer({canvas:cv,alpha:true,antialias:false,depth:false,stencil:false,powerPreference:'low-power'})}
  catch{cv.remove();return null}
  renderer.setPixelRatio(dpr);renderer.setSize(w,h,false);renderer.setClearColor(0,0);
  const fit=fitOf(src,w,h);
  const tex=new THREE.CanvasTexture(src||blank());
  tex.minFilter=tex.magFilter=THREE.LinearFilter;tex.generateMipmaps=false;
  tex.wrapS=tex.wrapT=THREE.ClampToEdgeWrapping;
  if(THREE.NoColorSpace!==undefined)tex.colorSpace=THREE.NoColorSpace;
  renderer.initTexture(tex);                       /* upload now: the source canvas is only readable inside this task */
  const rt=new THREE.WebGLRenderTarget(cv.width,cv.height,{minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,format:THREE.RGBAFormat,type:THREE.UnsignedByteType,depthBuffer:false,stencilBuffer:false,generateMipmaps:false});
  const bg=(cross&&cross.bg?cross.bg():null)||{a:[.06,.13,.19],b:[.02,.06,.1],center:[.5,.5],radii:[.8,.9]};
  const light=document.documentElement.dataset.theme==='light';
  const U={
   tFrom:{value:tex},
   uFit:{value:new THREE.Vector2(fit.x,fit.y)},
   uCenter:{value:new THREE.Vector2(.5,.5)},
   uBgC:{value:new THREE.Vector2(bg.center[0],bg.center[1])},
   uBgR:{value:new THREE.Vector2(bg.radii[0],bg.radii[1])},
   uBgA:{value:new THREE.Color(bg.a[0],bg.a[1],bg.a[2])},
   uBgB:{value:new THREE.Color(bg.b[0],bg.b[1],bg.b[2])},
   uT:{value:0},uMode:{value:MODE[mode]||0},uPass:{value:0},
   uAspect:{value:w/Math.max(1,h)},uGrid:{value:12.},uHasSrc:{value:src?1:0},uLight:{value:light?1:0}
  };
  const geo=new THREE.PlaneGeometry(2,2);
  const mat=new THREE.ShaderMaterial({uniforms:U,vertexShader:VERT,fragmentShader:frag(),depthTest:false,depthWrite:false,transparent:true});
  const scn=new THREE.Scene(),cam=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
  const mesh=new THREE.Mesh(geo,mat);mesh.frustumCulled=false;scn.add(mesh);
  U.uPass.value=0;renderer.setRenderTarget(rt);renderer.render(scn,cam);   /* freeze once */
  U.uPass.value=1;renderer.setRenderTarget(null);
  return{cv,renderer,rt,tex,geo,mat,scn,cam,U,w,h};
 }

 function end(){
  const c=cur;if(!c)return;
  cur=null;
  if(c.guard)try{clearTimeout(c.guard)}catch{}
  if(c.raf)try{cancelAnimationFrame(c.raf)}catch{}
  try{c.renderer.setRenderTarget(null)}catch{}
  try{c.renderer.dispose()}catch{}
  try{c.renderer.forceContextLoss()}catch{}
  try{c.rt.dispose();c.mat.dispose();c.geo.dispose();c.tex.dispose()}catch{}
  try{c.cv.remove()}catch{}
  if(c.watch)try{c.watch.off()}catch{}
  if(cross&&cross.end)try{cross.end()}catch{}
 }

 function run(mode,dur){
  if(cur||!THREE||!cross)return false;
  if(reduced.matches)return false;                 /* a11y: the switch is already a cut — nothing is built */
  const host=cross.host&&cross.host();if(!host)return false;
  const src=snapshot();                            /* null is allowed: the weave runs over the host background */
  const q=window.BKMotion&&BKMotion.quality?BKMotion.quality.level:0;
  const m=q>=3?'cut':modeOf(mode);
  const D=dur||DUR[m]||DUR.weave;
  const c=build(host,src,m);
  if(!c)return false;
  cur=c;
  if(window.BKGL&&BKGL.watch)c.watch=BKGL.watch(c.cv,{name:'transition',onLost:()=>{end()}});
  const t0=performance.now(),ease=(window.BKMotion&&BKMotion.ease.inOut3)||(x=>x);
  let frames=0,raf=0;
  /* the context-loss event is a task, so a frame can still be scheduled after the context is gone: three.js then reads a null
     program log and throws. Check the context before every draw and cut at once instead. */
  const alive=()=>{try{return !c.renderer.getContext().isContextLost()}catch{return false}};
  const frame=now=>{
   raf=0;
   if(!cur)return;
   if(!alive()){end();return}
   const raw=D>0?Math.min(1,(now-t0)/D):1;
   c.U.uT.value=m==='cut'?raw:ease(raw);
   c.renderer.setRenderTarget(null);
   try{c.renderer.render(c.scn,c.cam)}catch{end();return}
   frames++;
   if(raw<1)raf=requestAnimationFrame(frame);
   else{last={mode:m,dur:D,frames,ms:Math.round(performance.now()-t0),targets:1,programs:1};end()}
  };
  raf=requestAnimationFrame(frame);
  /* R10.b watchdog: a throttled/backgrounded tab can starve the rAF loop, and a transition that never ends would keep `cur` set —
     which makes every later run() return false and leaves the view switch locked. Force the exit one beat after the duration. */
  c.guard=setTimeout(()=>{if(cur===c)end()},D+1500);
  return true;
 }

 /* one deterministic frame at a fixed uT — tools/visual_audit.py captures the intermediate frames of the transition this way, and
   tools/gpu_budget_audit.py reads the composite's targets/programs from the same held frame. The image is identical on every tick, so
   re-drawing it keeps a live frame window open without changing what is on screen. */
 function still(mode,t){
  if(!THREE||!cross)return null;
  end();
  const host=cross.host&&cross.host();if(!host)return null;
  const src=snapshot();
  const m=modeOf(mode);
  const c=build(host,src,m);
  if(!c)return null;
  cur=c;
  c.U.uT.value=Math.max(0,Math.min(1,Number(t)||0));
  const alive=()=>{try{return !c.renderer.getContext().isContextLost()}catch{return false}};
  const draw=()=>{if(!cur||!alive())return false;c.renderer.setRenderTarget(null);try{c.renderer.render(c.scn,c.cam)}catch{return false}return true};
  if(!draw()){end();return null}
  const loop=()=>{if(!cur)return;if(!draw()){end();return}c.raf=requestAnimationFrame(loop)};
  c.raf=requestAnimationFrame(loop);
  last={mode:m,t:c.U.uT.value,frames:1,targets:1,programs:1,still:true};
  return last;
 }

 function info(){
  return{ready:!!THREE,bound:!!cross,active:!!cur,last:last?{...last}:null,
   targets:cur?1:0,programs:cur?1:0,modes:Object.keys(MODE)};
 }

 window.BKTransition={init,bind,run,still,end,info,get ready(){return !!THREE},MODES:Object.keys(MODE)};
})();
