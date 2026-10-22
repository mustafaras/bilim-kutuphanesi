'use strict';
/* BKTransition — R10.i `handover`: the data itself changes scene.
   Every record of the library is ONE plotted point. When the section switches view, those points are measured on the outgoing
   scene (the real tower block, the real star, the real bar segment) and on the incoming scene, and each one flies from its own
   origin to its own destination. The frame underneath the points cross-dissolves, and a dashed year rail bends from the old
   axis layout to the new one. Nothing is decorative: the only things that move are the library's own records and its own axis.
   • ONE effect for every switch: `handover`. The retired names (weave / iris / dive / materialize / chroma / filament) alias to it,
     so an older tool still runs the one transition that exists.
   • TWO programs, ZERO render targets: `dissolve` (full-screen quad: background + both frozen frames + rail + one light sweep)
     and `points` (the record cloud). Both frames are baked into the quad analytically with mix(bg, frame, cov), so there is no
     freeze render target any more — one less target, one less pass, and still() stays deterministic.
   • TWO CanvasTextures, uploaded with renderer.initTexture() in the SAME task as the source render: a preserveDrawingBuffer:false
     canvas is blank once the task ends, so a later upload would freeze an empty frame.
   • both sides are sampled through their own panel box (uBoxF / uBoxT) instead of a contain-fit, so a frame that belonged to a
     shorter card is composited exactly where it was on screen — no letterbox bands, no stretched skyline.
   • a missing frozen frame is not a hard cut and a missing point set is not a hard cut either: the dissolve still runs over the
     host background, which is how the chart (DOM, no GL frame) and a galaxy that has not booted join the same effect.
   • reduced-motion: no transition is built at all (0 frames, 0 ms) — the view switch is already a cut.
   • quality S3+: the cut mode (<=120 ms) instead of the full handover.
   • context loss mid-transition: the composite is removed in the same tick, so the live incoming scene shows.
   • still(mode,t): one deterministic frame at a fixed uT for tools/visual_audit.py (?still only) */
(()=>{
 const reduced=typeof matchMedia==='function'?matchMedia('(prefers-reduced-motion: reduce)'):{matches:false};
 const MODE={handover:0,cut:1};
 /* the retired names resolve to the one effect: an older tool (weave / iris / dive / materialize / chroma / filament) still runs
    the handover instead of asking for a transition that no longer exists */
 const ALIAS={weave:'handover',iris:'handover',dive:'handover',materialize:'handover',chroma:'handover',filament:'handover'};
 const DUR={handover:640,cut:120};
 /* the year rail: 13 nodes = 12 dashed segments. Fixed here because the shader unrolls it. */
 const RN=13;
 const VERT='varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}';
 let THREE=null,loading=false,cross=null,cur=null,last=null,blankCv=null,exitWhy='idle';

 let FRAG=null;
 function frag(){
  if(FRAG)return FRAG;
  FRAG=`
varying vec2 vUv;
uniform sampler2D tFrom,tTo;
uniform vec4 uBoxF,uBoxT;
uniform vec2 uBgC,uBgR,uDir;
uniform vec3 uBgA,uBgB;
uniform vec2 uTickF[${RN}],uTickT[${RN}];
uniform float uT,uMode,uAspect,uHasF,uHasT,uHasTick,uLight,uInvH;
vec3 bgAt(vec2 uv){vec2 d=(uv-uBgC)/max(uBgR,vec2(1e-4));return mix(uBgA,uBgB,clamp(length(d),0.,1.));}
/* a frozen frame is sampled through the box its own panel occupied, so it composites where it really was */
vec4 fromAt(vec2 uv,out float cov){
 vec2 su=(uv-uBoxF.xy)/max(uBoxF.zw,vec2(1e-4));
 cov=uHasF>.5&&su.x>0.&&su.x<1.&&su.y>0.&&su.y<1.?1.:0.;
 vec4 s=uHasF>.5?texture2D(tFrom,clamp(su,0.,1.)):vec4(0.);
 if(any(isnan(s)))s=vec4(0.);
 cov*=clamp(s.a,0.,1.);
 return s;
}
vec4 toAt(vec2 uv,out float cov){
 vec2 su=(uv-uBoxT.xy)/max(uBoxT.zw,vec2(1e-4));
 cov=uHasT>.5&&su.x>0.&&su.x<1.&&su.y>0.&&su.y<1.?1.:0.;
 vec4 s=uHasT>.5?texture2D(tTo,clamp(su,0.,1.)):vec4(0.);
 if(any(isnan(s)))s=vec4(0.);
 cov*=clamp(s.a,0.,1.);
 return s;
}
float segD(vec2 p,vec2 a,vec2 b,out float sp){vec2 pa=p-a,ba=b-a;sp=clamp(dot(pa,ba)/max(dot(ba,ba),1e-6),0.,1.);return length(pa-ba*sp);}
void main(){
 float cf,ct;
 vec4 f=fromAt(vUv,cf),t=toAt(vUv,ct);
 /* the frame dissolve: the outgoing scene is gone by 92 %, the incoming one is complete at 92 %, so the two never sit at
    50/50 and the composite reads as one scene replacing another instead of two images stacked */
 float d=smoothstep(.16,.92,uT);
 vec3 col=mix(mix(bgAt(vUv),f.rgb,cf),mix(bgAt(vUv),t.rgb,ct),d);
 col*=1.-.06*sin(3.14159265*d);      /* a 6 % exposure dip at the midpoint: one beat, not a double exposure */
 if(uMode<.5){
  /* ---- the year axis ---- the rail is the library's own timeline: 13 nodes that BEND from the outgoing layout into the
     incoming one (a straight rule becomes the spiral's screen curve), joined by hairline dashes. This is the only line in
     the app that a view switch ever draws, and it is the axis itself. */
  float rt=smoothstep(.10,.56,uT);
  float vis=1.-smoothstep(.66,.94,uT);
  if(uHasTick>.5&&vis>.002){
   vec2 q=vec2(vUv.x*uAspect,vUv.y);
   float rail=0.,node=0.;
   for(int i=0;i<${RN};i++){
    vec2 a=mix(uTickF[i],uTickT[i],rt);a.x*=uAspect;
    node=max(node,1.-smoothstep(1.2*uInvH,2.2*uInvH,length(q-a)));
    if(i<${RN - 1}){
     vec2 b=mix(uTickF[i+1],uTickT[i+1],rt);b.x*=uAspect;
     float sp;float sd=segD(q,a,b,sp);
     float u1=fract(sp*2.6+.5);
     float dash=smoothstep(.30,.42,u1)*(1.-smoothstep(.74,.86,u1));
     rail=max(rail,(1.-smoothstep(.55*uInvH,1.6*uInvH,sd))*dash);
    }
   }
   vec3 ink=uLight>.5?vec3(.11,.18,.27):vec3(.82,.89,.96);
   col=mix(col,ink,clamp(max(rail*.8,node)*vis,0.,.92));
  }
  /* ---- one light sweep, along the switch's own direction ---- */
  float sp0=clamp(dot(vUv-.5,uDir)+.5,0.,1.);
  float pos=mix(-.28,1.28,smoothstep(0.,.74,uT));
  float band=(1.-smoothstep(0.,.15,abs(sp0-pos)))*(1.-smoothstep(.52,.78,uT));
  vec3 lc=uLight>.5?vec3(.16,.26,.42):vec3(1.,.87,.64);
  col=mix(col,lc,clamp(band*.07,0.,.08));
 }
 /* exact endpoints: uT=0 is the untouched outgoing frame, uT=1 is fully transparent so the live incoming scene shows */
 float a=uMode<.5?(1.-smoothstep(.90,1.,uT)):(1.-uT);
 /* feather only the outer few pixels: the composite is a square canvas over a rounded card */
 float edge=smoothstep(0.,.022,vUv.x)*smoothstep(0.,.022,1.-vUv.x)*smoothstep(0.,.035,vUv.y)*smoothstep(0.,.035,1.-vUv.y);
 gl_FragColor=vec4(col,clamp(a,0.,1.)*edge);
}`;
  return FRAG;
 }

 /* the record cloud: one point per record, `position` (the live outgoing origin) → aTo (the incoming destination).
    `aCurve` bows the flight into an arc (deterministic, from the record's own index) and `aW` staggers the departure
    left to right, so the cloud crosses as a wave instead of a block. */
 const PVERT=`
attribute vec2 aTo;
attribute vec3 aCol;
attribute vec2 aSize;
attribute float aCurve,aW;
uniform float uT,uDpr,uLight;
varying vec3 vC;
varying float vA;
void main(){
 float st=.13+aW*.13;
 float e=clamp((uT-st)/.42,0.,1.);
 float k=e*e*(3.-2.*e);
 vec2 p=mix(position.xy,aTo,k);
 vec2 dv=aTo-position.xy;
 float dl=max(length(dv),1e-5);
 p+=vec2(-dv.y,dv.x)/dl*aCurve*sin(3.14159265*k)*min(dl*.32,.05);
 gl_Position=vec4(p*2.-1.,0.,1.);
 gl_PointSize=mix(aSize.x,aSize.y,k)*uDpr;
 vA=smoothstep(.01,.12,uT)*(1.-smoothstep(.62,.94,uT));
 vC=aCol*mix(1.12,.72,uLight);        /* the same CATC palette on both themes, only weighted: pastels wash out on parchment */
}`;
 const PFRAG=`varying vec3 vC;varying float vA;void main(){float d=length(gl_PointCoord-.5);float a=(1.-smoothstep(.30,.5,d))*vA;if(a<.012)discard;gl_FragColor=vec4(vC,clamp(a,0.,1.));}`;

 function init(){
  if(THREE||loading)return;
  loading=true;
  import('./vendor/three.module.min.js').then(m=>{THREE=m}).catch(()=>{}).finally(()=>{loading=false});
 }

 /* nobel3d registers both sides for one switch:
    from / to  -> a canvas, {render:()=>canvas}, or a function returning a canvas (null when that side has no frozen frame)
    panelFrom() -> the panel the outgoing frame belonged to (its box places that frame inside the composite)
    host()     -> the incoming panel the composite covers
    bg()       -> that panel's own background gradient
    points()   -> {n, from, to, col, size, curve, w} in host-uv, or null
    rail()     -> {from, to} each Float32Array(2*RN) in host-uv, or null
    dir        -> {x,y} unit direction of the switch (light sweep) */
 function bind(c){cross=c||null}

 function snapshotOf(x){
  let v=typeof x==='function'?x():x;
  if(v&&typeof v.render==='function')v=v.render();
  return v&&typeof v.getContext==='function'?v:null;
 }
 const srcOf=k=>{if(!cross||!cross[k])return null;try{return snapshotOf(cross[k])}catch{return null}};

 /* a 1x1 transparent stand-in, so a side without a frozen frame still runs the same composite instead of a hard cut */
 function blank(){
  if(blankCv)return blankCv;
  blankCv=document.createElement('canvas');blankCv.width=blankCv.height=1;
  return blankCv;
 }

 /* where a panel sat inside the composite, in composite-uv: the frozen frame is composited into its own box.
    A plain rect is accepted too, because the outgoing panel is already hidden by the time the composite is built — its box
    has to be measured while it is still laid out. */
 function boxOf(panel,host){
  if(!panel||!host)return[0,0,1,1];
  const p=panel.getBoundingClientRect?panel.getBoundingClientRect():panel,h=host.getBoundingClientRect();
  if(!h.width||!h.height)return[0,0,1,1];
  /* a degenerate box means the panel was measured while hidden; fill the composite instead of compositing nowhere */
  if(!p.width||!p.height)return[0,0,1,1];
  return[(p.left-h.left)/h.width,(p.top-h.top)/h.height,p.width/h.width,p.height/h.height];
 }

 const modeOf=m=>MODE[m]!=null?m:ALIAS[m]||'handover';

 function ticks(arr){
  const a=[];for(let i=0;i<RN;i++)a.push(new THREE.Vector2(arr?arr[i*2]:.5,arr?arr[i*2+1]:.5));
  return a;
 }

 function build(host,mode){
  const w=Math.max(2,host.clientWidth|0),h=Math.max(2,host.clientHeight|0),dpr=Math.min(devicePixelRatio||1,1.5);
  const srcF=srcOf('from'),srcT=srcOf('to');
  const cv=document.createElement('canvas');
  cv.className='nc-cross';cv.setAttribute('aria-hidden','true');
  host.appendChild(cv);
  let renderer;
  try{renderer=new THREE.WebGLRenderer({canvas:cv,alpha:true,antialias:false,depth:false,stencil:false,powerPreference:'low-power'})}
  catch{cv.remove();return null}
  renderer.setPixelRatio(dpr);renderer.setSize(w,h,false);renderer.setClearColor(0,0);
  const mk=src=>{const t=new THREE.CanvasTexture(src||blank());
   t.minFilter=t.magFilter=THREE.LinearFilter;t.generateMipmaps=false;t.wrapS=t.wrapT=THREE.ClampToEdgeWrapping;
   if(THREE.NoColorSpace!==undefined)t.colorSpace=THREE.NoColorSpace;
   renderer.initTexture(t);                        /* upload now: the source canvas is only readable inside this task */
   return t};
  const texF=mk(srcF),texT=mk(srcT);
  const bg=(cross&&cross.bg?cross.bg():null)||{a:[.06,.13,.19],b:[.02,.06,.1],center:[.5,.5],radii:[.8,.9]};
  const light=document.documentElement.dataset.theme==='light';
  const bF=boxOf(cross&&cross.panelFrom?cross.panelFrom():null,host);
  const rail=cross&&cross.rail?cross.rail():null;
  const dir=(cross&&cross.dir)||{x:0,y:1};
  const U={
   tFrom:{value:texF},tTo:{value:texT},
   uBoxF:{value:new THREE.Vector4(bF[0],bF[1],bF[2],bF[3])},
   uBoxT:{value:new THREE.Vector4(0,0,1,1)},
   uBgC:{value:new THREE.Vector2(bg.center[0],bg.center[1])},
   uBgR:{value:new THREE.Vector2(bg.radii[0],bg.radii[1])},
   uBgA:{value:new THREE.Color(bg.a[0],bg.a[1],bg.a[2])},
   uBgB:{value:new THREE.Color(bg.b[0],bg.b[1],bg.b[2])},
   uTickF:{value:ticks(rail&&rail.from)},uTickT:{value:ticks(rail&&rail.to)},
   uHasTick:{value:rail&&rail.from&&rail.to?1:0},
   uDir:{value:new THREE.Vector2(dir.x,dir.y)},
   uT:{value:0},uMode:{value:MODE[mode]||0},
   uAspect:{value:w/Math.max(1,h)},uInvH:{value:1/Math.max(1,h)},
   uHasF:{value:srcF?1:0},uHasT:{value:srcT?1:0},uLight:{value:light?1:0}
  };
  const geo=new THREE.PlaneGeometry(2,2);
  const mat=new THREE.ShaderMaterial({uniforms:U,vertexShader:VERT,fragmentShader:frag(),depthTest:false,depthWrite:false,transparent:true});
  const scn=new THREE.Scene(),cam=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
  const mesh=new THREE.Mesh(geo,mat);mesh.frustumCulled=false;scn.add(mesh);
  /* the point cloud is the second (and last) program; it is skipped entirely when a side could not supply its records */
  const P=cross&&cross.points?cross.points():null;
  let pGeo=null,pMat=null,pScn=null,pN=0;
  if(P&&P.n>0&&P.from&&P.to&&P.from.length>=P.n*2&&P.to.length>=P.n*2){
   pN=P.n;
   pGeo=new THREE.BufferGeometry();
   pGeo.setAttribute('position',new THREE.BufferAttribute(P.from,2));
   pGeo.setAttribute('aTo',new THREE.BufferAttribute(P.to,2));
   pGeo.setAttribute('aCol',new THREE.BufferAttribute(P.col,3));
   pGeo.setAttribute('aSize',new THREE.BufferAttribute(P.size,2));
   pGeo.setAttribute('aCurve',new THREE.BufferAttribute(P.curve,1));
   pGeo.setAttribute('aW',new THREE.BufferAttribute(P.w,1));
   pGeo.setDrawRange(0,pN);
   /* clip space, already in -1..1: a fixed sphere keeps three from running computeBoundingSphere over a 2-component
      position attribute (which reads z out of pattern and reports a NaN radius) */
   pGeo.boundingSphere=new THREE.Sphere(new THREE.Vector3(0,0,0),4);
   pMat=new THREE.ShaderMaterial({vertexShader:PVERT,fragmentShader:PFRAG,
    uniforms:{uT:U.uT,uDpr:{value:dpr},uLight:U.uLight},
    depthTest:false,depthWrite:false,transparent:true});
   const pts=new THREE.Points(pGeo,pMat);pts.frustumCulled=false;
   pScn=new THREE.Scene();pScn.add(pts);
  }
  return{cv,renderer,texF,texT,geo,mat,scn,cam,U,pGeo,pMat,pScn,pN,w,h,
   draw(){renderer.setRenderTarget(null);renderer.render(scn,cam);
    if(pScn){renderer.autoClear=false;renderer.render(pScn,cam);renderer.autoClear=true}}};
 }

 function end(){
  const c=cur;if(!c)return;
  cur=null;
  if(c.guard)try{clearTimeout(c.guard)}catch{}
  if(c.raf)try{cancelAnimationFrame(c.raf)}catch{}
  try{c.renderer.setRenderTarget(null)}catch{}
  try{c.renderer.dispose()}catch{}
  try{c.renderer.forceContextLoss()}catch{}
  try{
   c.geo.dispose();c.mat.dispose();c.texF.dispose();c.texT.dispose();
   if(c.pGeo)c.pGeo.dispose();if(c.pMat)c.pMat.dispose()
  }catch{}
  try{c.cv.remove()}catch{}
  if(c.watch)try{c.watch.off()}catch{}
  if(cross&&cross.end)try{cross.end()}catch{}
 }

 function run(mode,dur){
  if(cur||!THREE||!cross)return false;
  if(reduced.matches)return false;                 /* a11y: the switch is already a cut — nothing is built */
  const host=cross.host&&cross.host();if(!host)return false;
  const q=window.BKMotion&&BKMotion.quality?BKMotion.quality.level:0;
  const m=q>=3?'cut':modeOf(mode);
  const D=dur||DUR[m]||DUR.handover;
  const c=build(host,m);
  if(!c)return false;
  cur=c;exitWhy='run';
  if(window.BKGL&&BKGL.watch)c.watch=BKGL.watch(c.cv,{name:'transition',onLost:()=>{exitWhy='lost-event';end()}});
  const t0=performance.now(),ease=(window.BKMotion&&BKMotion.ease.inOut3)||(x=>x);
  let frames=0,raf=0;
  /* the context-loss event is a task, so a frame can still be scheduled after the context is gone: three.js then reads a null
     program log and throws. Check the context before every draw and cut at once instead. */
  const alive=()=>{try{return !c.renderer.getContext().isContextLost()}catch{return false}};
  const frame=now=>{
   raf=0;
   if(!cur)return;
   if(!alive()){exitWhy='lost';end();return}
   const raw=D>0?Math.min(1,(now-t0)/D):1;
   c.U.uT.value=m==='cut'?raw:ease(raw);
   try{c.draw()}catch(e){exitWhy='draw';end();return}
   frames++;
   if(raw<1)raf=requestAnimationFrame(frame);
   else{exitWhy='done';last={mode:m,dur:D,frames,ms:Math.round(performance.now()-t0),points:c.pN,targets:0,programs:c.pN?2:1,textures:2,exit:'done'};end()}
  };
  raf=requestAnimationFrame(frame);
  /* R10.b watchdog: a throttled/backgrounded tab can starve the rAF loop, and a transition that never ends would keep `cur` set —
     which makes every later run() return false and leaves the view switch locked. Force the exit one beat after the duration. */
  c.guard=setTimeout(()=>{if(cur===c){exitWhy='guard';end()}},D+1500);
  return true;
 }

 /* one deterministic frame at a fixed uT — tools/visual_audit.py captures the intermediate frames of the transition this way, and
   tools/gpu_budget_audit.py reads the composite's programs/targets from the same held frame. The image is identical on every tick,
   so re-drawing it keeps a live frame window open without changing what is on screen. */
 function still(mode,t){
  if(!THREE||!cross)return null;
  end();
  const host=cross.host&&cross.host();if(!host)return null;
  const m=modeOf(mode);
  const c=build(host,m);
  if(!c)return null;
  cur=c;
  c.U.uT.value=Math.max(0,Math.min(1,Number(t)||0));
  const alive=()=>{try{return !c.renderer.getContext().isContextLost()}catch{return false}};
  const draw=()=>{if(!cur||!alive())return false;try{c.draw()}catch{return false}return true};
  if(!draw()){end();return null}
  const loop=()=>{if(!cur)return;if(!draw()){end();return}c.raf=requestAnimationFrame(loop)};
  c.raf=requestAnimationFrame(loop);
  /* srcW/srcH expose the two frozen frames the composite is sampling, so an audit can tell a real snapshot from the 1x1 blank */
  last={mode:m,t:c.U.uT.value,frames:1,targets:0,programs:c.pN?2:1,textures:2,points:c.pN,still:true,srcW:[c.texF.image?c.texF.image.width:0,c.texT.image?c.texT.image.width:0]};
  return last;
 }

 function info(){
  return{ready:!!THREE,bound:!!cross,active:!!cur,exit:exitWhy,last:last?{...last}:null,
   targets:0,programs:cur?(cur.pN?2:1):0,modes:Object.keys(MODE)};
 }

 window.BKTransition={init,bind,run,still,end,info,get ready(){return !!THREE},MODES:Object.keys(MODE),RN};
})();
