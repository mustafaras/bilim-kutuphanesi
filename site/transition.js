'use strict';
/* BKTransition — R10.a "dondur-ve-geç" (freeze-and-cross).
   The outgoing scene's last frame is frozen into ONE render target, the incoming scene keeps drawing live underneath,
   and a single ShaderMaterial composites the two on a separate pointer-events:none canvas that is removed on exit.
   • ONE program for every effect: uMode picks dive / materialize / iris / chromatic / filament / cut, so the program count never grows with the transition table
   • R10.g: `filament` is the view-switch cross — the frozen frame dissolves in the first quarter of the cross and the rest of the show is a
     sparse lattice of points that fly outward from the centre, joined by thin links that stretch as the field expands. No radial mask, no
     burn flash, and no lingering dark rectangle: the user rejected both the vignette look and the frozen-frame dissolve ("black
     transformation"), so the frame is gone by 26 % and the points carry the whole cross
   • the frozen frame is a CanvasTexture uploaded with renderer.initTexture() in the SAME task as the source render — a preserveDrawingBuffer:false
     canvas is blank once the task ends, so a later upload would freeze an empty frame
   • the freeze pass bakes the outgoing panel's own CSS radial-gradient behind the frame (both scene canvases are alpha:true), so the frozen
     image is opaque and the composite can hand the incoming scene back through its alpha channel
   • reduced-motion: no transition is built at all (0 frames, 0 ms) — the view switch is already a cut
   • quality S3+: the cut mode (<=120 ms) instead of the requested effect
   • context loss mid-transition: the frozen frame is dropped and the composite is removed in the same tick, so the live incoming scene shows
   • still(mode,t): one deterministic frame at a fixed uT for tools/visual_audit.py (?still only) */
(()=>{
 const reduced=typeof matchMedia==='function'?matchMedia('(prefers-reduced-motion: reduce)'):{matches:false};
 const MODE={cut:0,iris:1,dive:2,materialize:3,chroma:4,filament:5};
 const DUR={cut:120,iris:900,dive:1000,materialize:850,chroma:700,filament:1000};
 const VERT='varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}';
 let THREE=null,loading=false,cross=null,cur=null,last=null;

 /* the fragment source is built once, on first use: BKShaders must already be on the page */
 let FRAG=null;
 function frag(){
  if(FRAG)return FRAG;
  FRAG=window.BKShaders.use('hash','noise')+`
varying vec2 vUv;
uniform sampler2D tFrom;
uniform vec2 uCenter,uBgC,uBgR;
uniform vec3 uBgA,uBgB;
uniform float uT,uMode,uPass,uAspect,uSeed,uSoft,uGrid;
vec3 bgAt(vec2 uv){vec2 d=(uv-uBgC)/max(uBgR,vec2(1e-4));return mix(uBgA,uBgB,clamp(length(d),0.,1.));}
void main(){
 vec4 s=texture2D(tFrom,vUv);if(any(isnan(s)))s=vec4(0.);
 if(uPass<.5){gl_FragColor=vec4(mix(bgAt(vUv),s.rgb,clamp(s.a,0.,1.)),1.);return;}   /* freeze: the outgoing frame over its own panel background */
 vec2 uv=vUv,d=uv-uCenter;d.x*=uAspect;
 float r=length(d),a=1.,burn=0.;
 vec3 col=s.rgb;
 if(uMode<.5){                                                                     /* cut: one short cross-fade, no motion */
  a=1.-uT;
 }else if(uMode<1.5){                                                              /* iris: the incoming opens from uCenter */
  float R=mix(-.06,1.05,uT);
  a=smoothstep(R-uSoft,R,r);
  burn=1.-smoothstep(0.,uSoft*1.6,abs(r-R));
 }else if(uMode<2.5){                                                              /* dive: the frozen frame stretches into the centre */
  float k=uT*uT*.16;vec3 acc=vec3(0.);
  for(int i=0;i<8;i++){acc+=texture2D(tFrom,uv-d*(float(i)/7.)*k).rgb;}
  col=acc/8.;
  float R=mix(-.06,1.1,uT);
  a=smoothstep(R-uSoft,R,r);
  burn=(1.-smoothstep(0.,uSoft*1.4,abs(r-R)))*.8;
 }else if(uMode<3.5){                                                              /* materialize: a noise dissolve, grain by grain */
  float n=bk_fbm2(uv*vec2(uAspect,1.)*5.5+uSeed)*.5+.5,e=uSoft*.5;
  a=smoothstep(uT-e,uT+e,n);
  burn=(1.-smoothstep(0.,e*2.,abs(n-uT)))*.9;
 }else if(uMode<4.5){                                                              /* chromatic: RGB split, then the frame drops */
  float ca=sin(uT*3.14159265)*.012;
  col=vec3(texture2D(tFrom,uv+vec2(ca,0.)).r,texture2D(tFrom,uv).g,texture2D(tFrom,uv-vec2(ca,0.)).b);
  a=1.-smoothstep(.55,1.,uT);
 }else{                                                                            /* filament: the frame dissolves into a field of flying points and links */
   /* R10.g: the frozen frame is gone by 26 % of the cross, so there is no dark rectangle left to read as a "black transformation". What
      carries the rest is a sparse lattice of points that fly outward from the centre, joined by thin links that stretch as the field
      expands. One hash per cell drives the offset, the ignition time and the colour, so the field is deterministic (still() holds any uT)
      and the whole branch costs 5 hashes per fragment — fewer than the 9 the previous orbit version needed. */
   float zoom=1.+uT*1.30;                                                           /* the field expands: a lattice point L appears at (L-.5)*zoom+.5 */
   vec2 g=((uv-.5)/zoom+.5)*vec2(uAspect,1.)*uGrid;
   vec2 cell=floor(g),f=g-cell;
   float h=bk_hash12(cell);
   vec2 off=vec2(fract(h*7.31),fract(h*13.7))-.5;
   vec2 p0=.5+off*.56;                                                             /* +-0.28 keeps every point inside its own cell, so nothing is clipped */
   float sweep=clamp(uv.x*.55+(1.-uv.y)*.45,0.,1.);                                 /* ignition front: top-left to bottom-right, never radial */
   float t0=h*.18+sweep*.18;
   float k=smoothstep(t0,t0+.22,uT);
   float rad=mix(.06,.17,k)/zoom;                                                  /* the point swells as it ignites, then holds its screen size */
   float star=1.-smoothstep(rad*.35,rad,length(f-p0));
   float line=0.;
   for(int i=0;i<4;i++){                                                           /* all four neighbours: each cell draws its half of every link, so the segments meet */
    vec2 o=i==0?vec2(1.,0.):i==1?vec2(0.,1.):i==2?vec2(-1.,0.):vec2(0.,-1.);
    float h1=bk_hash12(cell+o);
    vec2 off1=vec2(fract(h1*7.31),fract(h1*13.7))-.5;
    vec2 p1=o+.5+off1*.56;
    float t1=h1*.18+sweep*.18;
    float k1=smoothstep(t1,t1+.22,uT);
    vec2 pa=f-p0,ba=p1-p0;                                                          /* point-to-segment distance between the two points */
    float dist=length(pa-ba*clamp(dot(pa,ba)/max(dot(ba,ba),1e-6),0.,1.));
    float w=.022/zoom;                                                             /* the link keeps its screen width as the field expands */
    line=max(line,(1.-smoothstep(w,w*2.6,dist))*min(k,k1));                         /* a link only exists once BOTH ends are lit */
   }
   /* alpha: base is the frozen frame and it is gone by 26 %, so the cross never sits on a dark rectangle; lattice is the point field that
      replaces it. At uT=0 base=1 and lattice=0 so a=1; at uT=1 both are 0 so a=0. Both endpoints are exact, so the cross starts and ends on
      a clean frame instead of a half-lit one. */
   float base=1.-smoothstep(0.,.26,uT);
   float lattice=max(star,line*.85)*(1.-smoothstep(.52,1.,uT));
   a=max(base,lattice);
   /* cool azure points with warm gold highlights. The point colour REPLACES the base instead of being added to it: the base is the frozen
      frame, which is paper-bright in the upper half of the panel, so an additive dot saturated to white and vanished there — the field
      only ever showed up over the dark towers. Mixing keeps the dot readable on paper and on night sky alike, and a hot white core on top
      of the mix gives it the lit-from-within look. The base itself fades from the frozen frame to the panel's own background as base
      falls, so once the frame is gone the field sits on the page colour instead of on a ghost of the skyline (in dark mode that ghost was
      a navy veil that dimmed the galaxy's core). The point term is gated by its own ignition k so nothing glows before it lights up
      (that also makes the uT=0 frame exactly the frozen image), and the whole field is gone before the cross ends. */
   vec3 gc=mix(vec3(.30,.58,1.),vec3(1.,.72,.34),smoothstep(.72,1.,h));
   float f1=clamp(star*k*1.7+line*1.1,0.,1.)*(1.-smoothstep(.58,1.,uT));
   col=mix(mix(bgAt(vUv),col,base),gc,f1)+vec3(1.)*pow(star,3.)*k*.5*(1.-smoothstep(.58,1.,uT));
 }
 col=mix(col,vec3(1.,.78,.42),burn*.55);
 /* R10.b: feather the composite's own edges so the frozen frame melts into the page instead of ending on a hard rectangle */
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

 /* nobel3d registers the two sides once both scenes exist: from() → {canvas,render} of the outgoing view, host() → the incoming panel, bg() → its gradient */
 function bind(c){cross=c||null}

 function snapshot(){
  const f=cross&&cross.from?cross.from():null;
  if(!f)return null;
  let cv=f.canvas;
  if(typeof f.render==='function'){const r=f.render();if(r&&typeof r.getContext==='function')cv=r}
  return cv&&typeof cv.getContext==='function'?cv:null;
 }

 function build(host,src,mode){
  const w=Math.max(2,host.clientWidth|0),h=Math.max(2,host.clientHeight|0),dpr=Math.min(devicePixelRatio||1,1.5);
  const cv=document.createElement('canvas');
  cv.className='nc-cross';cv.setAttribute('aria-hidden','true');
  host.appendChild(cv);
  let renderer;
  try{renderer=new THREE.WebGLRenderer({canvas:cv,alpha:true,antialias:false,depth:false,stencil:false,powerPreference:'low-power'})}
  catch{cv.remove();return null}
  renderer.setPixelRatio(dpr);renderer.setSize(w,h,false);renderer.setClearColor(0,0);
  const tex=new THREE.CanvasTexture(src);
  tex.minFilter=tex.magFilter=THREE.LinearFilter;tex.generateMipmaps=false;
  tex.wrapS=tex.wrapT=THREE.ClampToEdgeWrapping;
  if(THREE.NoColorSpace!==undefined)tex.colorSpace=THREE.NoColorSpace;
  renderer.initTexture(tex);                       /* upload now: the source canvas is only readable inside this task */
  const rt=new THREE.WebGLRenderTarget(cv.width,cv.height,{minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,format:THREE.RGBAFormat,type:THREE.UnsignedByteType,depthBuffer:false,stencilBuffer:false,generateMipmaps:false});
  const bg=(cross&&cross.bg?cross.bg():null)||{a:[.06,.13,.19],b:[.02,.06,.1],center:[.5,.5],radii:[.8,.9]};
  const U={
   tFrom:{value:tex},
   uCenter:{value:new THREE.Vector2(.5,.5)},
   uBgC:{value:new THREE.Vector2(bg.center[0],bg.center[1])},
   uBgR:{value:new THREE.Vector2(bg.radii[0],bg.radii[1])},
   uBgA:{value:new THREE.Color(bg.a[0],bg.a[1],bg.a[2])},
   uBgB:{value:new THREE.Color(bg.b[0],bg.b[1],bg.b[2])},
   uT:{value:0},uMode:{value:MODE[mode]||0},uPass:{value:0},
   uAspect:{value:w/Math.max(1,h)},uSeed:{value:0},uSoft:{value:.18},uGrid:{value:12.}
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
  const src=snapshot();if(!src)return false;
  const want=typeof mode==='string'&&MODE[mode]!=null?mode:'iris';
  const q=window.BKMotion&&BKMotion.quality?BKMotion.quality.level:0;
  const m=q>=3?'cut':want;
  const D=dur||DUR[m]||900;
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
  const src=snapshot();if(!src)return null;
  const m=typeof mode==='string'&&MODE[mode]!=null?mode:'iris';
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
