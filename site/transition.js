'use strict';
/* BKContinuum — R11 "süreklilik" (continuum). The three Nobel views are not three screens that get swapped: they are three
   arrangements of the same 1 895 records. This module owns ONE persistent WebGL context on the stage and ONE point program;
   on a switch every record travels from where the outgoing view put it to where the incoming view puts it, in world space,
   while the two panels crossfade underneath. No frozen frame, no screenshot, no render target, no texture, no rail, no sweep:
   one draw call, one program, zero targets. The field IS the transition, and it is the data changing hands.

   Contract (nobel3d.js is the only caller):
     init()                      load three in the background
     can()                       true when a real transition may run (three loaded, motion allowed, quality < 3)
     bind({host,points,end})     host() -> the stage element, points() -> the field, end() -> restore the panels
     run()                       animate; false = the caller must fall back to a plain cut
     still(t)                    hold one deterministic frame at uT = t (audit hook)
     end()                       stop and hide the field, then call bound.end()
     info()                      {ready,bound,active,exit,last,targets,programs,points,modes}
   The canvas is created once and reused for the life of the page; a context loss tears it down and the next run rebuilds it. */
(()=>{
 const reduced=typeof matchMedia==='function'?matchMedia('(prefers-reduced-motion: reduce)'):{matches:false};
 const DUR=720;
 let THREE=null,loading=false,bound=null,cur=null,last=null,exitWhy='idle';
 let renderer=null,scene=null,camera=null,points=null,geo=null,mat=null,canvas=null,hostEl=null,dead=false,ro=null,watch=null;

 /* One point per record. `position` is where the outgoing view put it, `aTo` where the incoming view puts it; the shader
    mixes the two with a per-record smoothstep, so the whole flight is one attribute read and one draw call. The bow is a
    shallow arc in world space (not a screen-space curve), which is what makes the points read as one 3D space instead of
    two flat pictures sliding over each other. */
 const VERT=`
attribute vec3 aTo;
attribute vec3 aCol;
attribute vec2 aSize;
attribute float aDelay;
attribute float aArc;
uniform float uT;
uniform float uDpr;
uniform float uLight;
varying vec3 vC;
varying float vA;
void main(){
  float st=aDelay*0.18;
  float e=clamp((uT-st)/0.64,0.0,1.0);
  float k=e*e*(3.0-2.0*e);
  vec3 p=mix(position,aTo,k);
  float bow=sin(3.14159265*k);
  p.z+=aArc*bow*0.42;
  p.x+=aArc*bow*0.05;
  p.y+=aArc*bow*0.03;
  vec4 mv=modelViewMatrix*vec4(p,1.0);
  gl_Position=projectionMatrix*mv;
  float persp=2.4/max(0.35,-mv.z);
  gl_PointSize=mix(aSize.x,aSize.y,k)*uDpr*persp;
  vA=smoothstep(0.0,0.04,uT)*(1.0-smoothstep(0.80,1.0,uT));
  vC=aCol*mix(1.12,0.66,uLight);
}`;

 const FRAG=`
varying vec3 vC;
varying float vA;
void main(){
  float d=length(gl_PointCoord-0.5);
  float a=(1.0-smoothstep(0.28,0.5,d))*vA;
  if(a<0.012)discard;
  gl_FragColor=vec4(vC,clamp(a,0.0,1.0));
}`;

 function init(){if(THREE||loading)return;loading=true;import('./vendor/three.module.min.js').then(m=>{THREE=m}).catch(()=>{}).finally(()=>{loading=false})}
 function can(){if(!THREE||reduced.matches)return false;const q=window.BKMotion&&BKMotion.quality?BKMotion.quality.level:0;return q<3}
 function bind(c){bound=c||null}

 function size(){
  if(!renderer||!hostEl)return;
  const w=Math.max(2,hostEl.clientWidth|0),h=Math.max(2,hostEl.clientHeight|0);
  const dpr=Math.min(window.devicePixelRatio||1,1.5);
  renderer.setPixelRatio(dpr);renderer.setSize(w,h,false);
  camera.aspect=w/Math.max(1,h);camera.updateProjectionMatrix();
  if(mat)mat.uniforms.uDpr.value=dpr;
 }

 function ensure(host){
  if(!THREE)return false;
  if(dead){teardown();dead=false}
  if(renderer&&hostEl===host)return true;
  if(renderer&&canvas&&host){hostEl=host;host.appendChild(canvas);size();return true}
  teardown();hostEl=host;
  canvas=document.createElement('canvas');canvas.className='nc-field';canvas.setAttribute('aria-hidden','true');
  host.appendChild(canvas);
  try{renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:false,depth:false,stencil:false,powerPreference:'low-power'})}
  catch{canvas.remove();canvas=null;hostEl=null;return false}
  renderer.setClearColor(0,0);
  scene=new THREE.Scene();
  camera=new THREE.PerspectiveCamera(42,1,.1,20);camera.position.set(0,0,2.4);
  if(window.BKGL&&BKGL.watch)watch=BKGL.watch(canvas,{name:'continuum',onLost(){dead=true;exitWhy='lost';end();teardown()}});
  if(typeof ResizeObserver==='function'){ro=new ResizeObserver(size);ro.observe(host)}
  size();return true;
 }

 function build(P){
  if(points){try{scene.remove(points);geo.dispose();mat.dispose()}catch{}points=null;geo=null;mat=null}
  geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.BufferAttribute(P.from,3));
  geo.setAttribute('aTo',new THREE.BufferAttribute(P.to,3));
  geo.setAttribute('aCol',new THREE.BufferAttribute(P.col,3));
  geo.setAttribute('aSize',new THREE.BufferAttribute(P.size,2));
  geo.setAttribute('aDelay',new THREE.BufferAttribute(P.delay,1));
  geo.setAttribute('aArc',new THREE.BufferAttribute(P.arc,1));
  geo.setDrawRange(0,P.n);
  geo.boundingSphere=new THREE.Sphere(new THREE.Vector3(0,0,0),12);
  mat=new THREE.ShaderMaterial({vertexShader:VERT,fragmentShader:FRAG,
   uniforms:{uT:{value:0},uDpr:{value:Math.min(window.devicePixelRatio||1,1.5)},uLight:{value:document.documentElement.dataset.theme==='light'?1:0}},
   depthTest:false,depthWrite:false,transparent:true});
  points=new THREE.Points(geo,mat);points.frustumCulled=false;scene.add(points);
 }

 function draw(t){
  if(!renderer||!scene||!camera)return false;
  try{if(renderer.getContext().isContextLost())return false}catch{return false}
  const lt=document.documentElement.dataset.theme==='light';
  mat.uniforms.uT.value=t;
  mat.uniforms.uLight.value=lt?1:0;
  /* dark theme: additive, so overlapping records glow like the galaxy's own stars. light theme: normal blending with a
     deepened colour, because adding light to parchment only makes it lighter. */
  const want=lt?THREE.NormalBlending:THREE.AdditiveBlending;
  if(mat.blending!==want){mat.blending=want;mat.needsUpdate=true}
  const bow=Math.sin(Math.PI*Math.max(0,Math.min(1,t)));
  camera.position.z=2.4-0.20*bow;
  camera.rotation.z=0.018*bow;
  camera.updateMatrixWorld();
  renderer.setRenderTarget(null);
  renderer.render(scene,camera);
  return true;
 }

 function end(){
  const c=cur;cur=null;
  if(c){if(c.guard)clearTimeout(c.guard);if(c.raf)cancelAnimationFrame(c.raf)}
  if(canvas)canvas.classList.remove('on');
  if(bound&&bound.end)try{bound.end()}catch{}
 }

 function run(){
  if(cur)return false;
  if(!can())return false;
  const host=bound&&bound.host?bound.host():null;
  if(!host){end();return false}
  if(!ensure(host)){end();return false}
  const P=bound.points?bound.points():null;
  if(!P||!P.n){end();return false}
  build(P);
  canvas.classList.add('on');
  cur={P};
  exitWhy='run';
  const t0=performance.now();
  let frames=0;
  const frame=now=>{
   if(!cur)return;
   cur.raf=0;
   const raw=DUR>0?Math.min(1,(now-t0)/DUR):1;
   if(!draw(raw)){exitWhy='draw';end();return}
   frames++;
   if(raw<1)cur.raf=requestAnimationFrame(frame);
   else{exitWhy='done';last={mode:'continuum',dur:DUR,frames,ms:Math.round(performance.now()-t0),points:P.n,targets:0,programs:1,textures:0,exit:'done'};end()}
  };
  cur.raf=requestAnimationFrame(frame);
  cur.guard=setTimeout(()=>{if(cur)end()},DUR+1500);
  return true;
 }

 function still(t){
  if(!THREE||!bound)return null;
  end();
  const host=bound.host?bound.host():null;
  if(!host||!ensure(host))return null;
  const P=bound.points?bound.points():null;
  if(!P||!P.n)return null;
  build(P);
  canvas.classList.add('on');
  cur={P};
  const v=Math.max(0,Math.min(1,Number(t)||0));
  if(!draw(v)){end();return null}
  const loop=()=>{if(!cur)return;if(!draw(v)){end();return}cur.raf=requestAnimationFrame(loop)};
  cur.raf=requestAnimationFrame(loop);
  last={mode:'continuum',t:v,frames:1,targets:0,programs:1,textures:0,points:P.n,still:true};
  return last;
 }

 function teardown(){
  if(ro){try{ro.disconnect()}catch{}ro=null}
  if(watch){try{watch.off()}catch{}watch=null}
  if(points){try{scene.remove(points);geo.dispose();mat.dispose()}catch{}points=null;geo=null;mat=null}
  if(renderer){try{renderer.dispose();renderer.forceContextLoss()}catch{}renderer=null}
  if(canvas){try{canvas.remove()}catch{}canvas=null}
  scene=null;camera=null;hostEl=null;
 }

 function info(){
  return{ready:!!THREE,bound:!!bound,active:!!cur,exit:exitWhy,last:last?{...last}:null,
   targets:0,programs:cur?1:0,points:cur?cur.P.n:0,modes:['continuum']};
 }

 window.BKContinuum={init,can,bind,run,still,end,info,get ready(){return!!THREE},get dur(){return DUR},get canvas(){return canvas}};
 window.BKTransition=window.BKContinuum;   /* older tools and docs still call it BKTransition */
})();
