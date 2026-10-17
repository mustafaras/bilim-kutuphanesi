'use strict';
/* Stage — one shared three.js renderer that paints small live scenes into ordinary 2D canvases inside the page
   (bento field tiles, the 3D book shelf). Why not a fixed full-page canvas: DOM-scrolled canvases never lag behind the page,
   obey overflow/z-order, and keep text on top. A single WebGL context serves every tile.
   • Atlas tiles: 8 engraved-line scenes (atom, DNA, globe, open book, lattice, ringed planet, armillary, laurel medal).
   • Shelf: real 3D books (cover texture drawn from the record), tilt toward the pointer, drag to turn, click still opens the record.
   Falls back silently (the SVG engravings / CSS covers stay) without WebGL. Honors reduced-motion and the motion toggle. */
(()=>{
 if(typeof document==='undefined'||!document.getElementById('collectionGrid'))return;
 const TF=window.BKText;if(!TF)return;
 const root=document.documentElement,reduced=typeof matchMedia==='function'?matchMedia('(prefers-reduced-motion: reduce)'):{matches:false};
 const hasGL=()=>{try{const c=document.createElement('canvas');return!!(c.getContext('webgl2')||c.getContext('webgl'))}catch{return false}};
 if(!hasGL())return;
 let THREE=null,renderer=null,loading=null,items=[],raf=0,last=0;
 const paused=()=>root.classList.contains('effects-paused')||reduced.matches;
 const load=()=>loading||(loading=import('./vendor/three.module.min.js').then(m=>{THREE=m;renderer=new m.WebGLRenderer({alpha:true,antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(1);renderer.shadowMap.enabled=true;renderer.shadowMap.type=m.PCFSoftShadowMap;renderer.setClearColor(0x000000,0);renderer.setScissorTest(true);watchContext();return m}).catch(()=>null));
 /* Self-check and graceful degradation. Some GPU/driver combinations cannot build (or silently drop) the heavy book materials; the book then paints as a few untextured bits
    (headband, foil, ribbon) or not at all. Every checked tile therefore inspects what it painted; when that looks broken the whole stage steps down one level and repaints:
    1 plain standard materials, no shadows / bump / clearcoat / sheen · 2 lambert (no PBR, no environment) · 3 flat basic colours, no textures · 4 give up on 3D, the CSS cover stays.
    Add ?diag to the address for a one-line status in the corner (level, shader errors, GPU). */
 let SAFE=0,lastEsc=0;const DIAG={shaderErrors:0,escalations:[],gpu:'',maxTex:0,maxSize:0,webgl2:false};
 const probe=document.createElement('canvas');probe.width=probe.height=32;const pctx=probe.getContext('2d',{willReadFrequently:true});
 function looksBroken(it){try{pctx.clearRect(0,0,32,32);pctx.drawImage(it.canvas,0,0,32,32);const d=pctx.getImageData(0,0,32,32).data;let n=0,sum=0;
   for(let i=0;i<d.length;i+=4)if(d[i+3]>200){n++;sum+=d[i]+d[i+1]+d[i+2]}
   it.stat={cover:+(n/1024).toFixed(3),lum:n?Math.round(sum/n/3):0};return n/1024<.05||(n&&sum/n/3<35)}catch{return false}}
 function lighter(mt,level){if(!mt||mt.isShaderMaterial||mt.isShadowMaterial)return mt;const o={side:mt.side,transparent:mt.transparent,opacity:mt.opacity,depthWrite:mt.depthWrite};
  if(mt.color)o.color=mt.color.clone();if(level<3&&mt.map)o.map=mt.map;
  if(level>=3&&mt.map&&mt.map.image){try{const c=document.createElement('canvas');c.width=c.height=1;const x=c.getContext('2d');x.drawImage(mt.map.image,0,0,1,1);const d=x.getImageData(0,0,1,1).data;o.color=new THREE.Color().setRGB(d[0]/255,d[1]/255,d[2]/255,THREE.SRGBColorSpace)}catch{}}
  if(level===1){o.roughness=mt.roughness!=null?mt.roughness:.8;o.metalness=Math.min(mt.metalness||0,1);o.envMapIntensity=mt.envMapIntensity!=null?mt.envMapIntensity:1}
  if(mt.emissive){o.emissive=mt.emissive.clone();o.emissiveIntensity=mt.emissiveIntensity}
  const M=level>=3?THREE.MeshBasicMaterial:level===2?THREE.MeshLambertMaterial:THREE.MeshStandardMaterial;if(level>=3)delete o.emissive,delete o.emissiveIntensity;return new M(o)}
 function simplify(sc,level){if(!sc||!THREE)return;sc.traverse(o=>{
   if(o.isLight){if(o.castShadow)o.castShadow=false;return}
   if(!o.isMesh)return;const m0=o.__mat0||(o.__mat0=o.material);
   if(m0&&(m0.isShadowMaterial||(Array.isArray(m0)&&m0.some(x=>x&&x.isShadowMaterial)))){o.visible=false;return}
   if(level<1){o.material=m0;return}
   o.material=Array.isArray(m0)?m0.map(x=>lighter(x,level)):lighter(m0,level)})}
 function applySafe(){try{renderer.shadowMap.enabled=SAFE<1}catch{}
  for(const i of items){if(i.scene)simplify(i.scene,SAFE);i.rn=0;i.dirty=true}
  try{sceneCache.forEach(x=>simplify(x.scene,SAFE))}catch{}
  if(SAFE>=4)for(const i of items)if(i.opts.check)failItem(i);
  kick()}
 function failItem(it){if(it.failed)return;it.failed=true;it.visible=false;it.canvas.classList.remove('on');it.canvas.style.display='none';
  const h=it.host;if(h){h.classList.remove('has-3d','rec-ready');const t=h.querySelector&&h.querySelector('.rv-3d-toggle');if(t)t.setAttribute('aria-pressed','false')}}
 function escalate(why){const now=performance.now();if(SAFE>=4||now-lastEsc<2500)return;lastEsc=now;SAFE++;DIAG.escalations.push(why+' -> level '+SAFE);
  try{console.warn('[stage] rendering looked broken ('+why+'), stepping down to level '+SAFE)}catch{}applySafe()}
 function selfCheck(it){if(!it.opts.check||it.failed||it.checked)return;it.rn=(it.rn||0)+1;if(it.rn<(paused()?2:70))return;
  if(looksBroken(it))escalate('cover '+(it.stat&&it.stat.cover)+' lum '+(it.stat&&it.stat.lum));else it.checked=true}
 if(/[?&]diag\b/.test(location.search)){const el=document.createElement('pre');el.style.cssText='position:fixed;left:8px;bottom:8px;z-index:9999;margin:0;padding:6px 8px;font:11px/1.35 monospace;color:#cfe;background:rgba(0,0,0,.72);border-radius:6px;max-width:92vw;white-space:pre-wrap;pointer-events:none';
  document.body.appendChild(el);setInterval(()=>{el.textContent='BK stage level '+SAFE+' · shader errors '+DIAG.shaderErrors+' · lost '+glLost+' · '+DIAG.gpu+' · units '+DIAG.maxTex+'\n'+items.filter(i=>i.opts.check).map(i=>i.failed?'failed':i.stat?('cover '+i.stat.cover+' lum '+i.stat.lum):'-').join(' | ')+(DIAG.escalations.length?'\n'+DIAG.escalations.join(' ; '):'')},1000)}
 /* GPU context loss (memory pressure, driver reset, sleep/wake): three re-initialises itself on restore, but the baked PMREM studio map is a render target whose
    pixels are gone, so every lit material goes dark (only foil and ribbon stay visible). Keep the last frame while lost, rebuild the map and repaint on restore. */
 let glLost=false;
 function watchContext(){const rc=renderer.domElement;
  renderer.debug.onShaderError=(gl,prog,vs,fs)=>{DIAG.shaderErrors++;if(DIAG.shaderErrors===1)try{console.warn('[stage] shader error, falling back to simpler materials')}catch{}if(SAFE===0)escalate('shader error')};   // later levels are judged by the pixel check only: errors of the level just left arrive late and must not skip levels
  try{const g=renderer.getContext(),dbg=g.getExtension('WEBGL_debug_renderer_info');DIAG.gpu=dbg?g.getParameter(dbg.UNMASKED_RENDERER_WEBGL):g.getParameter(g.RENDERER);DIAG.maxTex=g.getParameter(g.MAX_TEXTURE_IMAGE_UNITS);DIAG.maxSize=g.getParameter(g.MAX_TEXTURE_SIZE);DIAG.webgl2=!!(g instanceof self.WebGL2RenderingContext)}catch{}
  rc.addEventListener('webglcontextlost',e=>{e.preventDefault();glLost=true});
  rc.addEventListener('webglcontextrestored',()=>{glLost=false;try{rebuildEnv()}catch{}for(const i of items)i.dirty=true;kick()})}
 function rebuildEnv(){const old=ENV;if(!old||!THREE)return;ENV=null;const fresh=studioEnv(THREE);if(!fresh){ENV=old;return}
  const swap=sc=>{if(!sc)return;if(sc.environment===old)sc.environment=fresh;sc.traverse(o=>{const ms=Array.isArray(o.material)?o.material:o.material?[o.material]:[];ms.forEach(mt=>{if(mt.envMap===old){mt.envMap=fresh;mt.needsUpdate=true}})})};
  for(const i of items)swap(i.scene);try{sceneCache.forEach(x=>swap(x.scene))}catch{}}
 const io=typeof IntersectionObserver==='function'?new IntersectionObserver(es=>{for(const e of es){const it=e.target.__stage;if(it){it.visible=e.isIntersecting;it.dirty=true}}kick()},{rootMargin:'160px'}):null;

 function register(canvas,factory,opts={}){
  const it={canvas,factory,ctx:canvas.getContext('2d'),host:opts.host||canvas.parentElement,opts,visible:!io,dirty:true,hover:0,hoverT:0,px:0,py:0,t:Math.random()*8,scene:null,camera:null,api:null,drag:null,dragged:false,frame:0};
  canvas.__stage=it;items.push(it);if(io)io.observe(canvas);
  const h=it.host;
  h.addEventListener('pointerenter',()=>{it.hover=1;kick()});
  h.addEventListener('pointerleave',()=>{it.hover=0;it.px=0;it.py=0;it.dirty=true;kick()});
  h.addEventListener('pointermove',e=>{const r=canvas.getBoundingClientRect();it.px=((e.clientX-r.left)/Math.max(1,r.width)-.5)*2;it.py=((e.clientY-r.top)/Math.max(1,r.height)-.5)*2;if(it.drag){const dx=e.clientX-it.drag.x,dy=e.clientY-it.drag.y;if(Math.abs(dx)+Math.abs(dy)>5)it.dragged=true;if(it.api&&it.api.drag)it.api.drag(dx,dy);it.drag.x=e.clientX;it.drag.y=e.clientY}it.dirty=true;kick()},{passive:true});
  if(opts.drag){h.addEventListener('pointerdown',e=>{if(e.button>0)return;it.drag={x:e.clientX,y:e.clientY};it.dragged=false});
   addEventListener('pointerup',()=>{if(it.drag){it.drag=null;if(it.dragged){if(it.api&&it.api.release)it.api.release();setTimeout(()=>{it.dragged=false},0)}}});
   if(opts.dbl)h.addEventListener('dblclick',e=>{if(it.api&&it.api.dbl){e.preventDefault();it.api.dbl();it.dirty=true;kick()}});
   h.addEventListener('click',e=>{if(it.dragged){e.preventDefault();e.stopPropagation()}},true)}
  load().then(m=>{if(!m||!canvas.isConnected)return;if(SAFE>=4&&opts.check){failItem(it);return}const made=factory(m,it);if(!made)return;if(SAFE>0)simplify(made.scene,SAFE);it.scene=made.scene;it.camera=made.camera;it.api=made;it.ready=true;it.dirty=true;canvas.classList.add('on');if(opts.onReady)opts.onReady();kick()});
  return it}

 function render(it,dt){
  if(glLost||(renderer.getContext&&renderer.getContext().isContextLost()))return;   // keep the last frame on screen while the GPU context is gone
  const c=it.canvas,dpr=Math.min(devicePixelRatio||1,1.5),w=Math.max(2,Math.round(c.clientWidth*dpr)),h=Math.max(2,Math.round(c.clientHeight*dpr));
  if(c.width!==w||c.height!==h){c.width=w;c.height=h}
  const rc=renderer.domElement;if(rc.width<w||rc.height<h)renderer.setSize(Math.max(rc.width,w),Math.max(rc.height,h),false);
  it.hoverT+=(it.hover-it.hoverT)*Math.min(1,dt*7);it.t+=dt*(1+it.hoverT*1.6);
  it.camera.aspect=w/h;it.camera.updateProjectionMatrix();
  if(it.api.update)it.api.update(it.t,dt,it);
  renderer.setViewport(0,0,w,h);renderer.setScissor(0,0,w,h);renderer.clear();renderer.render(it.scene,it.camera);
  it.ctx.clearRect(0,0,w,h);it.ctx.drawImage(rc,0,rc.height-h,w,h,0,0,w,h);it.dirty=false;selfCheck(it)}

 /* A scene whose canvas left the DOM (record closed, preview re-rendered) releases its GPU memory: geometries, materials and every texture except the shared studio environment. Scenes kept in sceneCache survive (they are reused); shared geometries just re-upload on next use. */
 function disposeItem(it){const sc=it.scene;if(!sc||it.disposed)return;it.disposed=true;
  try{if([...sceneCache.values()].some(x=>x.scene===sc))return}catch{}
  const env=sc.environment;
  sc.traverse(o=>{if(o.geometry)o.geometry.dispose();const ms=Array.isArray(o.material)?o.material:o.material?[o.material]:[];
   ms.forEach(mt=>{for(const k in mt){const v=mt[k];if(v&&v.isTexture&&v!==env)v.dispose()}mt.dispose()})});
  it.scene=null;it.api=null;it.ready=false}
 function tick(now){
  raf=0;const dt=Math.min(.05,(now-last)/1000||0);last=now;
  {const gone=items.filter(i=>!i.canvas.isConnected);if(gone.length){gone.forEach(disposeItem);items=items.filter(i=>i.canvas.isConnected)}}let again=false;
  if(!document.hidden&&renderer){const still=paused();
   for(const it of items){if(!it.ready||!it.visible)continue;
    if(still){if(it.dirty){render(it,dt);}continue}
    again=true;it.frame++;if(it.hoverT<.05&&!it.drag&&it.frame%2)continue;   // idle tiles at 30fps, hovered at full rate
    render(it,dt*(it.hoverT<.05?2:1))}}
  if(again||items.some(i=>i.ready&&i.visible&&i.dirty))raf=requestAnimationFrame(tick)}
 function kick(){if(!raf)raf=requestAnimationFrame(tick)}
 if(typeof MutationObserver==='function')new MutationObserver(()=>{for(const i of items)i.dirty=true;kick()}).observe(root,{attributes:true,attributeFilter:['class','data-theme']});
 addEventListener('resize',()=>{for(const i of items)i.dirty=true;kick()});
 document.addEventListener('visibilitychange',kick);

 /* ---------- helpers ---------- */
 const mk=m=>({
  col:hex=>new m.Color(hex),
  line:(geo,color,op=1)=>new m.LineSegments(geo,new m.LineBasicMaterial({color,transparent:true,opacity:op,blending:m.AdditiveBlending,depthWrite:false})),
  loop:(pts,color,op=1)=>new m.LineLoop(new m.BufferGeometry().setFromPoints(pts),new m.LineBasicMaterial({color,transparent:true,opacity:op,blending:m.AdditiveBlending,depthWrite:false})),
  curve:(pts,color,op=1)=>new m.Line(new m.BufferGeometry().setFromPoints(pts),new m.LineBasicMaterial({color,transparent:true,opacity:op,blending:m.AdditiveBlending,depthWrite:false})),
  dots:(arr,color,size,op=1)=>{const g=new m.BufferGeometry();g.setAttribute('position',new m.BufferAttribute(arr,3));return new m.Points(g,new m.PointsMaterial({color,size,sizeAttenuation:true,transparent:true,opacity:op,blending:m.AdditiveBlending,depthWrite:false,map:dotTex(m)}))}});
 let _dot=null;const dotTex=m=>_dot||(_dot=(()=>{const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d'),r=g.createRadialGradient(32,32,0,32,32,32);r.addColorStop(0,'rgba(255,255,255,1)');r.addColorStop(.35,'rgba(255,255,255,.7)');r.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=r;g.fillRect(0,0,64,64);return new m.CanvasTexture(c)})());
 const circlePts=(m,r,n=96,ex=1)=>Array.from({length:n},(_,i)=>{const a=i/n*Math.PI*2;return new m.Vector3(Math.cos(a)*r,Math.sin(a)*r*ex,0)});
 const rig=(m,fov=34,z=5.1)=>{const scene=new m.Scene(),camera=new m.PerspectiveCamera(fov,2,.1,50);camera.position.set(0,0,z);return{scene,camera}};
 const aim=(g,it,t,spin=.35,tilt=.3)=>{g.rotation.y=t*spin+it.px*.6*it.hoverT;g.rotation.x=tilt+it.py*.35*it.hoverT};

 /* ---------- atlas scenes (index = discovery field) ---------- */
 const ATLAS=[
  /* 0 physics & mathematics — atom */
  (m,it,col)=>{const h=mk(m),{scene,camera}=rig(m),g=new m.Group();scene.add(g);
   const orbs=[0,1,2].map(i=>{const o=new m.Group();o.rotation.set(i*1.05,i*.6,i*.8);o.add(h.loop(circlePts(m,1.6,96,.55),col,.75));const e=h.dots(new Float32Array(3),0xffffff,.22);o.add(e);g.add(o);return{o,e,s:1.1+i*.5,p:i*2.1}});
   const core=h.dots(new Float32Array([0,0,0,.18,.1,0,-.14,-.12,.1]),col,.55);g.add(core);
   g.add(h.line(new m.WireframeGeometry(new m.IcosahedronGeometry(.9,1)),col,.2));
   return{scene,camera,update(t,dt,it){aim(g,it,t,.25,.35);orbs.forEach(o=>{const a=t*o.s*1.6+o.p;o.e.geometry.attributes.position.setXYZ(0,Math.cos(a)*1.6,Math.sin(a)*1.6*.55,0);o.e.geometry.attributes.position.needsUpdate=true})}}},
  /* 1 life & mind — DNA */
  (m,it,col)=>{const h=mk(m),{scene,camera}=rig(m,34,5.5),g=new m.Group();scene.add(g);const N=72,A=[],B=[],rungs=[];
   for(let i=0;i<=N;i++){const y=(i/N-.5)*3.4,a=i/N*Math.PI*4;A.push(new m.Vector3(Math.cos(a)*.62,y,Math.sin(a)*.62));B.push(new m.Vector3(Math.cos(a+Math.PI)*.62,y,Math.sin(a+Math.PI)*.62));if(i%3===0){rungs.push(A[i],B[i])}}
   g.add(h.curve(A,col,.95));g.add(h.curve(B,0xcfe0ff,.7));g.add(h.line(new m.BufferGeometry().setFromPoints(rungs),col,.4));
   const pa=new Float32Array(rungs.length*3);rungs.forEach((v,i)=>{pa[i*3]=v.x;pa[i*3+1]=v.y;pa[i*3+2]=v.z});g.add(h.dots(pa,0xffffff,.16));
   g.rotation.z=.5;return{scene,camera,update(t,dt,it){g.rotation.y=t*.7+it.px*.8*it.hoverT;g.rotation.x=it.py*.3*it.hoverT}}},
  /* 2 world & society — globe with arcs */
  (m,it,col)=>{const h=mk(m),{scene,camera}=rig(m),g=new m.Group();scene.add(g);
   g.add(h.line(new m.WireframeGeometry(new m.SphereGeometry(1.4,20,14)),col,.32));
   const pts=[];let sd=7;const r=()=>{sd=(sd*16807)%2147483647;return sd/2147483647};const P=[];for(let i=0;i<26;i++){const u=r()*2-1,a=r()*Math.PI*2,s=Math.sqrt(1-u*u);const v=new m.Vector3(Math.cos(a)*s,u,Math.sin(a)*s).multiplyScalar(1.42);P.push(v);pts.push(v.x,v.y,v.z)}
   const dots=h.dots(new Float32Array(pts),0xffffff,.16);g.add(dots);
   for(let k=0;k<7;k++){const a=P[k*3%26],b=P[(k*5+7)%26],mid=a.clone().add(b).multiplyScalar(.5).normalize().multiplyScalar(2.1);g.add(h.curve(new m.QuadraticBezierCurve3(a,mid,b).getPoints(32),col,.7))}
   return{scene,camera,update(t,dt,it){g.rotation.y=t*.28+it.px*.6*it.hoverT;g.rotation.x=.4+it.py*.3*it.hoverT;dots.material.opacity=.7+.3*Math.sin(t*2)}}},
  /* 3 literature — open book + drifting pages */
  (m,it,col)=>{const h=mk(m),{scene,camera}=rig(m,36,5.6),g=new m.Group();scene.add(g);
   const tex=(()=>{const c=document.createElement('canvas');c.width=256;c.height=320;const x=c.getContext('2d');x.fillStyle='rgba(248,240,222,.9)';x.fillRect(0,0,256,320);x.fillStyle='rgba(60,45,30,.55)';for(let i=0;i<16;i++){x.fillRect(26,34+i*17,150+((i*37)%70),3)}const t=new m.CanvasTexture(c);t.colorSpace=m.SRGBColorSpace;return t})();
   const mat=new m.MeshBasicMaterial({map:tex,side:m.DoubleSide,transparent:true,opacity:.92});
   const L=new m.Mesh(new m.PlaneGeometry(1.4,1.8,10,1),mat),R=new m.Mesh(new m.PlaneGeometry(1.4,1.8,10,1),mat);
   const bend=(mesh,s)=>{const p=mesh.geometry.attributes.position;for(let i=0;i<p.count;i++){const x=p.getX(i);p.setZ(i,Math.pow(Math.abs(x+.7*s*-1),1.4)*.0+Math.sin((x/1.4+.5*s)*Math.PI)*.12)}p.needsUpdate=true};
   L.position.x=-.72;R.position.x=.72;L.rotation.y=.32;R.rotation.y=-.32;bend(L,1);bend(R,-1);g.add(L,R);
   g.add(h.line(new m.EdgesGeometry(new m.PlaneGeometry(1.4,1.8)),col,.5));
   const fl=Array.from({length:7},(_,i)=>{const p=new m.Mesh(new m.PlaneGeometry(.5,.66),mat.clone());p.material.opacity=.0;scene.add(p);return{p,s:i*.9}});
   return{scene,camera,update(t,dt,it){g.rotation.set(-.55+it.py*.25*it.hoverT,Math.sin(t*.5)*.35+it.px*.5*it.hoverT,0);g.position.y=Math.sin(t*1.2)*.06;fl.forEach(f=>{const k=((t*.12+f.s)%1);f.p.position.set(Math.sin(f.s*3+t*.4)*1.3,-.4+k*2.6,.3+Math.cos(f.s)*.4);f.p.rotation.set(k*4,f.s,k*3);f.p.material.opacity=Math.sin(k*Math.PI)*.55})}}},
  /* 4 technology & data — lattice with signals */
  (m,it,col)=>{const h=mk(m),{scene,camera}=rig(m,34,5.7),g=new m.Group();scene.add(g);const n=4,s=.62,pts=[],ed=[];const id=(x,y,z)=>x+y*n+z*n*n;
   for(let z=0;z<n;z++)for(let y=0;y<n;y++)for(let x=0;x<n;x++){pts.push((x-1.5)*s,(y-1.5)*s,(z-1.5)*s);if(x<n-1)ed.push(id(x,y,z),id(x+1,y,z));if(y<n-1)ed.push(id(x,y,z),id(x,y+1,z));if(z<n-1)ed.push(id(x,y,z),id(x,y,z+1))}
   const pa=new Float32Array(pts);g.add(h.dots(pa,col,.2));const vs=[];ed.forEach(i=>vs.push(pa[i*3],pa[i*3+1],pa[i*3+2]));const lg=new m.BufferGeometry();lg.setAttribute('position',new m.BufferAttribute(new Float32Array(vs),3));g.add(h.line(lg,col,.22));
   const sig=h.dots(new Float32Array(18*3),0xffffff,.3);g.add(sig);
   return{scene,camera,update(t,dt,it){aim(g,it,t,.3,.45);const p=sig.geometry.attributes.position;for(let k=0;k<18;k++){const e=(k*7)%(ed.length/2),a=ed[e*2],b=ed[e*2+1],f=(t*.6+k*.37)%1;p.setXYZ(k,pa[a*3]+(pa[b*3]-pa[a*3])*f,pa[a*3+1]+(pa[b*3+1]-pa[a*3+1])*f,pa[a*3+2]+(pa[b*3+2]-pa[a*3+2])*f)}p.needsUpdate=true}}},
  /* 5 planet & matter — banded planet, ring, moon */
  (m,it,col)=>{const h=mk(m),{scene,camera}=rig(m,34,5.7),g=new m.Group();scene.add(g);
   const tex=(()=>{const c=document.createElement('canvas');c.width=64;c.height=256;const x=c.getContext('2d');for(let i=0;i<256;i++){const v=.5+.5*Math.sin(i*.09)*Math.sin(i*.023+1);x.fillStyle=`rgba(${Math.round(150+80*v)},${Math.round(120+70*v)},${Math.round(80+60*v)},.9)`;x.fillRect(0,i,64,1)}const t=new m.CanvasTexture(c);t.colorSpace=m.SRGBColorSpace;return t})();
   const P=new m.Mesh(new m.SphereGeometry(1,40,28),new m.MeshBasicMaterial({map:tex,transparent:true,opacity:.92}));g.add(P);
   g.add(h.line(new m.WireframeGeometry(new m.SphereGeometry(1.02,18,12)),col,.25));
   const ring=h.loop(circlePts(m,1.75,120),col,.9);ring.rotation.x=Math.PI/2.4;g.add(ring);const ring2=h.loop(circlePts(m,2.05,120),0xffffff,.35);ring2.rotation.x=Math.PI/2.4;g.add(ring2);
   const moon=new m.Mesh(new m.SphereGeometry(.2,16,12),new m.MeshBasicMaterial({color:0xe8ce9e}));g.add(moon);g.rotation.z=-.35;
   return{scene,camera,update(t,dt,it){P.rotation.y=t*.4;g.rotation.x=.35+it.py*.3*it.hoverT;g.rotation.y=it.px*.5*it.hoverT;const a=t*.9;moon.position.set(Math.cos(a)*2.4,Math.sin(a*.7)*.5,Math.sin(a)*2.4)}}},
  /* 6 art & history of science — armillary sphere */
  (m,it,col)=>{const h=mk(m),{scene,camera}=rig(m),g=new m.Group();scene.add(g);const R=1.5,rs=[];
   [[0,0,0],[Math.PI/2,0,0],[0,Math.PI/2,0],[Math.PI/3,0,.4]].forEach((r,i)=>{const L=h.loop(circlePts(m,R*(i===3?1.02:1)),i===0?0xffffff:col,i===3?.9:.65);L.rotation.set(...r);g.add(L);rs.push(L)});
   const eq=h.loop(circlePts(m,R*1.25),col,.4);eq.rotation.x=Math.PI/2;g.add(eq);
   g.add(h.curve([new m.Vector3(0,-1.9,0),new m.Vector3(0,1.9,0)],col,.55));g.add(h.dots(new Float32Array([0,0,0]),0xffe9b8,.7));
   return{scene,camera,update(t,dt,it){g.rotation.set(.35+it.py*.3*it.hoverT,t*.3+it.px*.6*it.hoverT,.35);rs[3].rotation.y=t*.5;eq.rotation.z=t*.2}}},
  /* 7 Nobel archive — struck gold medal: relief face (laurel, star, lettering via bump), clearcoat, ribbon, orbiting glints */
  (m,it,col)=>{const{scene,camera}=rig(m,32,7.4),g=new m.Group();scene.add(g);
   const envMap=studioEnv(m);if(envMap)scene.environment=envMap;
   /* One struck face per Nobel prize: shared rim + laurel, a category emblem in the centre, lettering laid along the arc by measured width. */
   const CATS=['PHYSICS','CHEMISTRY','MEDICINE','LITERATURE','PEACE','ECONOMICS'];
   const emblem=(x,k)=>{x.lineWidth=7;x.lineCap='round';x.lineJoin='round';
    if(k===0){for(let i=0;i<3;i++){x.save();x.rotate(i*Math.PI/3);x.beginPath();x.ellipse(0,0,118,42,0,0,7);x.stroke();x.restore()}x.beginPath();x.arc(0,0,17,0,7);x.fill()}
    else if(k===1){x.beginPath();for(let i=0;i<6;i++){const a=i/6*Math.PI*2-Math.PI/2,px=Math.cos(a)*92,py=Math.sin(a)*92;i?x.lineTo(px,py):x.moveTo(px,py)}x.closePath();x.stroke();x.lineWidth=4;x.beginPath();x.arc(0,0,58,0,7);x.stroke();x.lineWidth=5;for(let i=0;i<6;i+=2){const a=(i+.5)/6*Math.PI*2-Math.PI/2;x.beginPath();x.moveTo(Math.cos(a)*92,Math.sin(a)*92);x.lineTo(Math.cos(a+Math.PI/3)*92,Math.sin(a+Math.PI/3)*92);x.stroke()}}
    else if(k===2){x.beginPath();x.moveTo(0,-118);x.lineTo(0,118);x.stroke();x.beginPath();x.moveTo(0,-90);x.bezierCurveTo(70,-70,70,-30,0,-14);x.bezierCurveTo(-70,4,-70,44,0,64);x.bezierCurveTo(46,80,40,100,10,104);x.stroke();x.beginPath();x.arc(0,-118,11,0,7);x.fill();x.lineWidth=5;x.beginPath();x.moveTo(-34,-96);x.quadraticCurveTo(0,-112,34,-96);x.stroke()}
    else if(k===3){x.beginPath();x.moveTo(-70,104);x.bezierCurveTo(-96,0,-30,-96,78,-112);x.bezierCurveTo(88,-30,40,52,-70,104);x.closePath();x.stroke();x.lineWidth=4;x.beginPath();x.moveTo(-70,104);x.lineTo(40,-70);x.stroke();for(let i=0;i<5;i++){x.beginPath();x.moveTo(-38+i*14,64-i*28);x.lineTo(-6+i*24,52-i*26);x.stroke()}x.lineWidth=5;x.beginPath();x.moveTo(-100,116);x.lineTo(-40,116);x.stroke()}
    else if(k===4){x.beginPath();x.ellipse(-6,10,64,34,-.45,0,7);x.stroke();x.beginPath();x.moveTo(-30,-6);x.bezierCurveTo(-60,-70,10,-110,60,-96);x.bezierCurveTo(46,-60,20,-30,6,-8);x.stroke();x.beginPath();x.moveTo(52,-22);x.lineTo(104,-52);x.lineTo(70,-6);x.closePath();x.stroke();x.beginPath();x.arc(66,-18,5,0,7);x.fill();x.lineWidth=4;x.beginPath();x.moveTo(-96,92);x.bezierCurveTo(-40,64,20,86,86,96);x.stroke();for(let i=0;i<5;i++){x.beginPath();x.ellipse(-70+i*34,84-(i%2)*10,12,5,.5,0,7);x.fill()}}
    else if(k===5){for(let i=0;i<4;i++){x.fillRect(-104+i*54,96-(i+1)*38,36,(i+1)*38)}x.lineWidth=5;x.beginPath();x.moveTo(-108,60);x.lineTo(-52,18);x.lineTo(-8,36);x.lineTo(70,-52);x.stroke();x.beginPath();x.moveTo(70,-52);x.lineTo(46,-52);x.moveTo(70,-52);x.lineTo(70,-28);x.stroke()}
    else{x.beginPath();x.moveTo(0,-104);for(let i=1;i<=10;i++){const a=i/10*Math.PI*2-Math.PI/2,rr=i%2?46:112;x.lineTo(Math.cos(a)*rr,Math.sin(a)*rr)}x.closePath();x.fill()}};
   const arcText=(x,txt,R,fontPx)=>{let px=fontPx,tw;do{x.font='600 '+px+'px "IBM Plex Mono",monospace';tw=[...txt].reduce((q,ch)=>q+x.measureText(ch).width+px*.22,0);px-=1}while(tw/R>Math.PI*1.7&&px>14);
    const track=px*.22;let ang=-tw/R/2;x.textAlign='center';[...txt].forEach(ch=>{const w=x.measureText(ch).width+track,a=ang+w/R/2;x.save();x.rotate(a);x.translate(0,-R);x.fillText(ch,0,0);x.restore();ang+=w/R})};
   const drawFace=(x,W,H,k)=>{x.fillStyle='#000';x.fillRect(0,0,W,H);x.translate(W/2,H/2);x.strokeStyle='#fff';x.fillStyle='#fff';x.lineWidth=7;x.beginPath();x.arc(0,0,236,0,7);x.stroke();x.lineWidth=2.5;x.beginPath();x.arc(0,0,218,0,7);x.stroke();x.beginPath();x.arc(0,0,150,0,7);x.stroke();
    x.lineWidth=2;for(let i=0;i<72;i++){const a=i/72*Math.PI*2,r1=156,r2=i%6===0?172:164;x.beginPath();x.moveTo(Math.cos(a)*r1,Math.sin(a)*r1);x.lineTo(Math.cos(a)*r2,Math.sin(a)*r2);x.stroke()}/* year-ruler ticks */
    for(let s2=-1;s2<=1;s2+=2){for(let i=0;i<13;i++){const a=Math.PI*.58+i*.17,rr=190;x.save();x.scale(s2,1);x.rotate(a);x.translate(rr,0);x.rotate(.9);x.beginPath();x.ellipse(0,0,26,9,0,0,7);x.fill();x.restore()}}
    emblem(x,k);arcText(x,k<6?'· NOBEL · '+CATS[k]+' · 1901 – 2026 ·':'· BİLİM KÜTÜPHANEM ·',188,30)};
   const faceMaskOf=k=>canvasTex(m,512,512,(x,W,H)=>drawFace(x,W,H,k),false);
   /* relief: a height field (sunburst field, guilloche band, soft shoulders on every raised shape) turned into a normal map — sharper, truer lighting than a bump of the flat mask */
   const reliefOf=k=>{const mk=faceMaskOf(k).image,c=document.createElement('canvas');c.width=c.height=512;const x=c.getContext('2d');x.fillStyle='#4a4a4a';x.fillRect(0,0,512,512);x.save();x.translate(256,256);
    x.strokeStyle='rgba(255,255,255,.10)';x.lineWidth=1;for(let i=0;i<180;i++){const a=i/180*Math.PI*2;x.beginPath();x.moveTo(Math.cos(a)*40,Math.sin(a)*40);x.lineTo(Math.cos(a)*146,Math.sin(a)*146);x.stroke()}
    x.strokeStyle='rgba(255,255,255,.16)';for(let n=0;n<3;n++){x.beginPath();for(let i=0;i<=720;i++){const a=i/720*Math.PI*2,r=186+7*Math.sin(a*(18+n*6)+n)+4*Math.sin(a*7);i?x.lineTo(Math.cos(a)*r,Math.sin(a)*r):x.moveTo(Math.cos(a)*r,Math.sin(a)*r)}x.closePath();x.stroke()}x.restore();
    x.globalCompositeOperation='lighten';if('filter' in x){x.filter='blur(7px)';x.globalAlpha=.55;x.drawImage(mk,0,0);x.filter='blur(2px)';x.globalAlpha=1;x.drawImage(mk,0,0);x.filter='none'}else x.drawImage(mk,0,0);
    return normalFromHeight(m,c,3.4)};
   const faceCol=canvasTex(m,512,512,(x,W,H)=>{const gr=x.createRadialGradient(W*.4,H*.35,20,W/2,H/2,W*.62);gr.addColorStop(0,'#f6e3ad');gr.addColorStop(.55,'#d9b46c');gr.addColorStop(1,'#a67c34');x.fillStyle=gr;x.fillRect(0,0,W,H)},true);
   const faceOf=k=>{const mk=faceMaskOf(k),rf=canvasTex(m,512,512,(x,W,H)=>{x.fillStyle='#8a8a8a';x.fillRect(0,0,W,H);x.drawImage(mk.image,0,0);x.globalCompositeOperation='multiply';x.fillStyle='#cfcfcf';x.fillRect(0,0,W,H)},false);
    return new m.MeshPhysicalMaterial({map:faceCol,normalMap:reliefOf(k),normalScale:new m.Vector2(1,1),metalness:.9,roughness:.34,roughnessMap:rf,clearcoat:.5,clearcoatRoughness:.12,iridescence:.35,iridescenceIOR:1.35,iridescenceThicknessRange:[180,420],envMapIntensity:2.2})};
   const edge=new m.MeshPhysicalMaterial({color:0xe3c17a,metalness:.95,roughness:.24,iridescence:.25,iridescenceIOR:1.3,iridescenceThicknessRange:[150,380],envMapIntensity:2.0});
   /* coin reeding: 96 fine ridges around the rim */
   const reed=(()=>{const c=document.createElement('canvas');c.width=128;c.height=8;const x=c.getContext('2d');for(let i=0;i<128;i++){const v=(.5+.5*Math.sin(i/128*Math.PI*2*16))*255|0;x.fillStyle=`rgb(${v},${v},${v})`;x.fillRect(i,0,1,8)}const t=normalFromHeight(m,c,2.6);t.repeat.set(6,1);return t})();
   const edgeSide=edge.clone();edgeSide.normalMap=reed;edgeSide.normalScale=new m.Vector2(1.4,1.4);
   const disc=new m.Mesh(new m.CylinderGeometry(1.45,1.45,.16,96),[edgeSide,edge,edge]);disc.rotation.x=Math.PI/2;g.add(disc);
   const faces=CATS.map((c,k)=>{const f=new m.Mesh(new m.CircleGeometry(1.4,96),faceOf(k));f.position.z=.0815;f.visible=k===0;g.add(f);return f});
   const backF=new m.Mesh(new m.CircleGeometry(1.4,96),faceOf(6));backF.rotation.y=Math.PI;backF.position.z=-.0815;g.add(backF);
   let cur=0,flipT=-1,hold=0;
   const rim=new m.Mesh(new m.TorusGeometry(1.42,.06,16,120),edge);g.add(rim);
   const bail=new m.Mesh(new m.TorusGeometry(.16,.04,12,32),edge);bail.position.y=1.62;g.add(bail);
   const rb=new m.PlaneGeometry(.5,1.5,1,16),rpp=rb.attributes.position;for(let i=0;i<rpp.count;i++){const y=rpp.getY(i);rpp.setZ(i,Math.sin(y*3.4)*.05)}rb.computeVertexNormals();
   const ribMat=new m.MeshPhysicalMaterial({color:0x16406e,roughness:.4,sheen:1,sheenColor:new m.Color(0xb8d4ff),iridescence:1,iridescenceIOR:1.5,iridescenceThicknessRange:[250,600],metalness:.25,side:m.DoubleSide});
   [-1,1].forEach(sg=>{const rbm=new m.Mesh(rb,ribMat);rbm.position.set(sg*.28,2.35,-.02);rbm.rotation.z=sg*-.2;g.add(rbm)});
   const N=60,gp=new Float32Array(N*3),gs=[];for(let i=0;i<N;i++)gs.push({a:Math.random()*7,r:1.7+Math.random()*1.1,y:(Math.random()-.5)*2.4,s:.25+Math.random()*.6});
   const gl=new m.Points(new m.BufferGeometry().setAttribute('position',new m.BufferAttribute(gp,3)),new m.PointsMaterial({color:0xffe6a8,size:.05,transparent:true,opacity:.85,depthWrite:false,blending:m.AdditiveBlending}));scene.add(gl);
   scene.add(new m.AmbientLight(0xffffff,.4));const k=new m.DirectionalLight(0xfff0d0,2.6);k.position.set(2.5,2,4);scene.add(k);const k2=new m.DirectionalLight(0x9fc4ff,.9);k2.position.set(-3,-1,3);scene.add(k2);
   return{scene,camera,info(){return{normal:!!faces[cur].material.normalMap,bump:!!faces[cur].material.bumpMap,reed:!!edgeSide.normalMap,faces:faces.length}},face(i){faces[cur].visible=false;cur=((i%faces.length)+faces.length)%faces.length;faces[cur].visible=true},update(t,dt,it){hold+=dt;if(flipT<0&&hold>5.5&&!paused()){flipT=0}
    let spin=0;if(flipT>=0){flipT+=dt/.95;const e=flipT<1?(flipT<.5?2*flipT*flipT:1-Math.pow(-2*flipT+2,2)/2):1;spin=e*Math.PI*2;if(flipT>.5&&faces[cur].visible&&flipT<1){faces[cur].visible=false;cur=(cur+1)%faces.length;faces[cur].visible=true}if(flipT>=1){flipT=-1;hold=0;spin=0}}
    g.rotation.y=Math.sin(t*.6)*.7+it.px*.7*it.hoverT+spin;g.rotation.x=.1+it.py*.3*it.hoverT;k.position.x=Math.cos(t*.9)*3.2;
    for(let i=0;i<N;i++){const q=gs[i],a=q.a+t*q.s;gp[i*3]=Math.cos(a)*q.r;gp[i*3+1]=q.y+Math.sin(t*q.s*2+i)*.15;gp[i*3+2]=Math.sin(a)*q.r*.6}gl.geometry.attributes.position.needsUpdate=true}}}
 ];

 /* ---------- 3D book (shelf) ---------- */
 const COVER=['#2b5666','#386049','#355779','#5e4468','#386049','#355779','#5e4468','#6e563a'];
 function coverTexture(m,r,idx){
  const W=512,H=720,c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d'),base=COVER[idx%8];
  const g=x.createLinearGradient(0,0,W,H);g.addColorStop(0,base);g.addColorStop(1,'#101c26');x.fillStyle=g;x.fillRect(0,0,W,H);
  x.strokeStyle='rgba(232,206,158,.55)';x.lineWidth=2;x.strokeRect(26,26,W-52,H-52);
  {const fl=TF.fitLine(x,String(label(r.category)).replace(/^\d+ - /,'').toUpperCase(),{maxW:W-96,sizes:[22,20,18,16],font:z=>'600 '+z+'px "IBM Plex Mono",monospace'});x.fillStyle='rgba(232,206,158,.9)';x.font='600 '+fl.size+'px "IBM Plex Mono",monospace';x.fillText(fl.text,48,76)}
  x.fillRect(48,92,W-96,2);
  x.strokeStyle='rgba(232,206,158,.35)';x.lineWidth=1.5;for(let i=0;i<5;i++){x.beginPath();x.arc(W/2,250,36+i*26,0,Math.PI*2);x.stroke()}
  x.fillStyle='rgba(255,236,196,.95)';[[0,-1],[.9,.4],[-.8,.5],[.4,1.2],[-.3,-.3]].forEach(([a,b],i)=>{x.beginPath();x.arc(W/2+a*90,250+b*60,3+i%2*1.5,0,Math.PI*2);x.fill()});
  const TOPc=400,BOTc=H-150,ft=TF.fitBlock(x,displayTitle(r),{maxW:W-96,maxH:BOTc-TOPc,sizes:[44,40,36,32,28,25,22],lh:1.22});
  x.fillStyle='#f6efdc';x.font='400 '+ft.size+'px Fraunces,Georgia,serif';ft.lines.forEach((l,i)=>x.fillText(l,48,TOPc+ft.size+i*ft.lh));
  if(!TF.authorInTitle(displayTitle(r),r.author)){const fa=TF.fitLine(x,String(r.author||''),{maxW:W-96,sizes:[24,22,20,18],font:z=>'400 '+z+'px Inter,sans-serif'});x.fillStyle='rgba(246,239,220,.8)';x.font='400 '+fa.size+'px Inter,sans-serif';x.fillText(fa.text,48,H-96)}
  x.fillStyle='rgba(232,206,158,.8)';x.font='600 18px "IBM Plex Mono",monospace';x.fillText(TF.ellipsize(x,'BK · '+String(r.format||'').toUpperCase(),W-96),48,H-52);
  const t=new m.CanvasTexture(c);t.anisotropy=4;t.colorSpace=m.SRGBColorSpace;return t}
 function pagesTexture(m){const c=document.createElement('canvas');c.width=64;c.height=256;const x=c.getContext('2d');x.fillStyle='#efe6d0';x.fillRect(0,0,64,256);for(let i=0;i<256;i+=3){x.fillStyle=i%6?'rgba(120,100,70,.18)':'rgba(120,100,70,.32)';x.fillRect(0,i,64,1)}const t=new m.CanvasTexture(c);t.wrapS=t.wrapT=m.RepeatWrapping;t.colorSpace=m.SRGBColorSpace;return t}

 function backTexture(m,idx){const W=512,H=720,c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d'),g=x.createLinearGradient(0,0,W,H);g.addColorStop(0,COVER[idx%8]);g.addColorStop(1,'#101c26');x.fillStyle=g;x.fillRect(0,0,W,H);
  x.strokeStyle='rgba(232,206,158,.5)';x.lineWidth=2;x.strokeRect(26,26,W-52,H-52);x.fillStyle='rgba(232,206,158,.85)';x.font='600 64px Fraunces,Georgia,serif';x.textAlign='center';x.fillText('BK',W/2,H/2);x.font='600 16px "IBM Plex Mono",monospace';x.fillText('BİLİM KÜTÜPHANEM',W/2,H/2+44);
  x.fillStyle='rgba(246,239,220,.18)';for(let i=0;i<9;i++)x.fillRect(80,120+i*22,W-160-((i*53)%90),5);
  const t=new m.CanvasTexture(c);t.colorSpace=m.SRGBColorSpace;return t}
 function spineTexture(m,r,idx){const W=128,H=720,c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d');x.fillStyle=COVER[idx%8];x.fillRect(0,0,W,H);x.globalAlpha=.75;x.fillStyle=matOf(idx).foil;x.fillRect(0,40,W,2);x.fillRect(0,H-42,W,2);x.globalAlpha=1;
  x.save();x.translate(W/2+10,H/2);x.rotate(Math.PI/2);x.fillStyle='#f6efdc';x.textAlign='center';{const fl=TF.fitLine(x,displayTitle(r),{maxW:H-270,sizes:[34,30,27,24,21],font:z=>'400 '+z+'px Fraunces,Georgia,serif'});x.font='400 '+fl.size+'px Fraunces,Georgia,serif';x.fillText(fl.text,0,0)}x.restore();
  const tx=new m.CanvasTexture(c);tx.colorSpace=m.SRGBColorSpace;return tx}

 window.BKStage={diag:()=>({level:SAFE,...DIAG,lost:glLost,items:items.filter(i=>i.opts.check).map(i=>i.failed?'failed':i.stat||null)}),forceLevel:l=>{SAFE=Math.max(0,Math.min(4,l|0));lastEsc=0;applySafe()},paintPage,medalInfo:()=>{const it=items.find(i=>i.api&&i.api.face&&i.api.info);return it?it.api.info():null},medal:k=>{const it=items.find(i=>i.api&&i.api.face);if(!it)return false;it.api.face(k);it.dirty=true;kick();return true},tiles:()=>items.filter(i=>i.canvas.classList.contains('tile-3d')&&i.camera).map(i=>({z:+i.camera.position.z.toFixed(3),op:i.canvas.style.opacity,top:Math.round(i.host.getBoundingClientRect().top+scrollY)})),info:()=>renderer?{...renderer.info.memory,programs:renderer.info.programs?renderer.info.programs.length:0,items:items.length,cache:sceneCache.size}:null,paintCover,coverTexture,spineTexture,mini:(cv,rec,done)=>register(cv,m=>{try{return sceneFor(m,rec)}catch{return null}},{host:cv.parentElement||cv,onReady:()=>{cv.classList.add('on');if(done)done()}})}; /* test hook for tools/text_fit_audit.py */

 /* Image-based lighting: a tiny studio (soft boxes) baked once into a PMREM map; makes foil, cloth, clearcoat and gold read as real materials. */
 let ENV=null;
 function studioEnv(m){if(ENV)return ENV;
  try{const es=new m.Scene();es.background=new m.Color(0x07090f);
   const box=(w,h,x,y,z,c,k)=>{const mm=new m.Mesh(new m.PlaneGeometry(w,h),new m.MeshBasicMaterial({color:new m.Color(c).multiplyScalar(k),side:m.DoubleSide}));mm.position.set(x,y,z);mm.lookAt(0,0,0);es.add(mm)};
   box(9,5,-6,5,6,0xfff0d6,6);box(4,9,8,1,3,0xd6e4ff,3.4);box(12,2,0,-6,1,0xffdca8,1.3);box(7,3,0,7,-6,0xffffff,2.6);box(3,6,-8,-1,-2,0xffe6c4,1.4);box(7,5,0,1,9,0xfff4dc,3.2);
   const pm=new m.PMREMGenerator(renderer);renderer.setScissorTest(false);ENV=pm.fromScene(es,.035).texture;renderer.setScissorTest(true);pm.dispose()}catch{ENV=null}
  return ENV}
 const GOLD='#e8cf94';
 /* Cover material identity per subject index: binding (leather / linen cloth / matte board), foil metal and finish. */
 const FOIL={gold:'#e8cf94',silver:'#d9dee6',copper:'#dc9b72'};
 const MATS=[{bind:'leather',foil:FOIL.gold,rough:.62,coat:.26},{bind:'linen',foil:FOIL.gold,rough:.86,coat:.04},{bind:'leather',foil:FOIL.silver,rough:.58,coat:.3},{bind:'leather',foil:FOIL.copper,rough:.66,coat:.2},
  {bind:'board',foil:FOIL.gold,rough:.9,coat:.02},{bind:'linen',foil:FOIL.silver,rough:.84,coat:.05},{bind:'board',foil:FOIL.copper,rough:.88,coat:.03},{bind:'leather',foil:FOIL.gold,rough:.7,coat:.18}];
 const matOf=idx=>MATS[((idx|0)%8+8)%8];
 /* deterministic grain so a given book always looks the same */
 const rng=seed=>{let a=seed>>>0||1;return()=>((a=Math.imul(a^a>>>15,1|a)+0x6D2B79F5|0,(a^a>>>7)>>>0)/4294967296)};
 /* bump texture = foil emboss (from the mask) lifted by a procedural binding grain: leather pebbles, linen weave or fine board tooth */
 function grainBump(m,mask,bind,seed){
  const W=mask.image.width,H=mask.image.height,c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d');x.drawImage(mask.image,0,0);
  const d=x.getImageData(0,0,W,H),q=d.data,R=rng(seed),amp=bind==='board'?9:bind==='linen'?16:20;
  const GS=24,GW=Math.ceil(W/GS)+3,grid=[];if(bind==='leather')for(let i=0;i<900;i++){const px=R()*W,py=R()*H,key=((py/GS|0)+1)*GW+((px/GS|0)+1);(grid[key]||(grid[key]=[])).push([px,py])}
  for(let yy=0;yy<H;yy++)for(let xx=0;xx<W;xx++){
   let g;
   if(bind==='leather'){let best=1e9;const cx=(xx/GS|0)+1,cy=(yy/GS|0)+1;for(let oy=-1;oy<=1;oy++)for(let ox=-1;ox<=1;ox++){const bk=grid[(cy+oy)*GW+(cx+ox)];if(bk)for(const pt of bk){const dx=pt[0]-xx,dy=pt[1]-yy,dd=dx*dx+dy*dy;if(dd<best)best=dd}}g=Math.min(1,Math.sqrt(best)/9)*2-1}
   else if(bind==='linen'){g=((xx%3===0?1:0)+(yy%3===0?1:0))-.6+(R()-.5)*.5}
   else g=(R()-.5)*1.2;
   const i=(yy*W+xx)*4,v=40+q[i]*.75+g*amp;q[i]=q[i+1]=q[i+2]=v<0?0:v>255?255:v;q[i+3]=255;
  }
  x.putImageData(d,0,0);const t=new m.CanvasTexture(c);t.anisotropy=8;return t}
 function noise(x,W,H,a,n){for(let i=0;i<n;i++){x.fillStyle=`rgba(${Math.random()<.5?'255,240,210':'0,0,0'},${(Math.random()*a).toFixed(3)})`;x.fillRect(Math.random()*W,Math.random()*H,1+Math.random()*1.5,1+Math.random()*1.5)}}
 /* cover = colour map + foil mask (white = gold leaf: drives metalness, roughness and the embossing bump) */
 function paintCover(x,W,H,r,idx,mask){
  if(mask){x.fillStyle='#000';x.fillRect(0,0,W,H);x.strokeStyle='rgba(255,255,255,.07)';x.lineWidth=1;for(let i=0;i<H;i+=3){x.beginPath();x.moveTo(0,i);x.lineTo(W,i);x.stroke()}for(let i=0;i<W;i+=3){x.beginPath();x.moveTo(i,0);x.lineTo(i,H);x.stroke()}}
  else{const g=x.createLinearGradient(0,0,W,H);g.addColorStop(0,COVER[idx%8]);g.addColorStop(1,'#0d1822');x.fillStyle=g;x.fillRect(0,0,W,H);x.strokeStyle='rgba(0,0,0,.10)';for(let i=0;i<H;i+=3){x.beginPath();x.moveTo(0,i);x.lineTo(W,i);x.stroke()}for(let i=0;i<W;i+=3){x.beginPath();x.moveTo(i,0);x.lineTo(i,H);x.stroke()}noise(x,W,H,.14,5200)}
  const F=mask?'#fff':matOf(idx).foil,T=mask?'#9a9a9a':'#f6efdc';
  if(!mask){x.save();x.strokeStyle='rgba(244,226,190,.13)';x.lineWidth=14;x.strokeRect(2,2,W-4,H-4);x.strokeStyle='rgba(0,0,0,.16)';x.lineWidth=22;x.strokeRect(-6,-6,W+12,H+12);x.restore()} /* worn edges: lighter rub line, darker rim */
  x.strokeStyle=F;x.lineWidth=3;x.strokeRect(24,24,W-48,H-48);x.lineWidth=1.2;x.strokeRect(34,34,W-68,H-68);
  [[24,24],[W-24,24],[24,H-24],[W-24,H-24]].forEach(([cx,cy])=>{x.beginPath();x.arc(cx,cy,9,0,Math.PI*2);x.stroke()});
  {const cat=String(label(r.category)).replace(/^\d+ - /,'').toUpperCase(),fl=TF.fitLine(x,cat,{maxW:W-104,sizes:[21,19,17,15],font:z=>'600 '+z+'px "IBM Plex Mono",monospace'});x.fillStyle=F;x.font='600 '+fl.size+'px "IBM Plex Mono",monospace';x.fillText(fl.text,52,84);x.fillRect(52,100,W-104,2)}
  x.strokeStyle=F;x.globalAlpha=mask?.9:.5;x.lineWidth=1.4;for(let i=0;i<6;i++){x.beginPath();x.arc(W/2,262,34+i*24,0,Math.PI*2);x.stroke()}
  for(let i=0;i<8;i++){const a=i/8*Math.PI*2;x.beginPath();x.moveTo(W/2+Math.cos(a)*34,262+Math.sin(a)*34);x.lineTo(W/2+Math.cos(a)*150,262+Math.sin(a)*150);x.stroke()}x.globalAlpha=1;
  x.fillStyle=F;[[0,-1],[.9,.4],[-.8,.5],[.4,1.2],[-.3,-.3]].forEach(([a,b],i)=>{x.beginPath();x.arc(W/2+a*90,262+b*60,3.4+i%2*1.8,0,Math.PI*2);x.fill()});
  /* title block: auto-fit between y=400 and y=H-150 (TextFit) so it can never reach the author line */
  const TOP=400,BOT=H-150,ft=TF.fitBlock(x,displayTitle(r),{maxW:W-112,maxH:BOT-TOP,sizes:[44,40,36,32,28,25,22],lh:1.2});
  x.fillStyle=T;x.font='400 '+ft.size+'px Fraunces,Georgia,serif';ft.lines.forEach((l,i)=>x.fillText(l,52,TOP+ft.size+i*ft.lh));
  const sameAsTitle=TF.authorInTitle(displayTitle(r),r.author);
  if(!sameAsTitle){const fa=TF.fitLine(x,String(r.author||''),{maxW:W-112,sizes:[24,22,20,18],font:z=>'400 '+z+'px Inter,sans-serif'});x.fillStyle=mask?'#777':'rgba(246,239,220,.82)';x.font='400 '+fa.size+'px Inter,sans-serif';x.fillText(fa.text,52,H-100)}
  x.fillStyle=F;x.font='600 17px "IBM Plex Mono",monospace';x.fillText(TF.ellipsize(x,'BK · '+String(r.format||'').toUpperCase(),W-104),52,H-58);x.fillRect(52,H-82,W-104,1.5)}
 function canvasTex(m,W,H,draw,srgb){const c=document.createElement('canvas');c.width=W;c.height=H;draw(c.getContext('2d'),W,H);const t=new m.CanvasTexture(c);t.anisotropy=8;if(srgb)t.colorSpace=m.SRGBColorSpace;return t}
 function pageEdge(m,vertical){return canvasTex(m,vertical?512:64,vertical?64:512,(x,W,H)=>{x.fillStyle='#efe5cb';x.fillRect(0,0,W,H);const n=vertical?W:H;for(let i=0;i<n;i+=1){const a=.05+Math.random()*.2;x.fillStyle=`rgba(${110+Math.random()*30|0},${90+Math.random()*30|0},60,${a})`;vertical?x.fillRect(i,0,1,H):x.fillRect(0,i,W,1)}/* leaf ridges: every few px a slightly darker, wobbling leaf boundary so the block reads as stacked sheets */for(let i=0;i<n;i+=5+((i*7)%4)){x.fillStyle='rgba(90,70,40,'+(.16+((i*13)%7)/60).toFixed(3)+')';vertical?x.fillRect(i,0,1,H):x.fillRect(0,i,W,1)}const g=vertical?x.createLinearGradient(0,0,W,0):x.createLinearGradient(0,0,0,H);g.addColorStop(0,'rgba(80,60,30,.25)');g.addColorStop(.15,'rgba(80,60,30,0)');g.addColorStop(.85,'rgba(80,60,30,0)');g.addColorStop(1,'rgba(80,60,30,.25)');x.fillStyle=g;x.fillRect(0,0,W,H)},true)}
 function roundedShape(m,w,h,r){const s=new m.Shape(),x=-w/2,y=-h/2;s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.quadraticCurveTo(x+w,y,x+w,y+r);s.lineTo(x+w,y+h-r);s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);s.lineTo(x+r,y+h);s.quadraticCurveTo(x,y+h,x,y+h-r);s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);return s}
/* F3: books on a shelf share geometry (same dimensions): built once, reused by every bookScene */
 const GEO=new Map();const shared=(key,make)=>{let g=GEO.get(key);if(!g){g=make();GEO.set(key,g)}return g};
 function board(m,w,h,T,flipU){return shared('board|'+[w,h,T,flipU].join('|'),()=>board0(m,w,h,T,flipU))}
 function board0(m,w,h,T,flipU){const g=new m.ExtrudeGeometry(roundedShape(m,w,h,.07),{depth:T,bevelEnabled:true,bevelSize:.016,bevelThickness:.016,bevelSegments:4,curveSegments:10});g.translate(0,0,-T/2);
  const pos=g.attributes.position,uv=g.attributes.uv;for(let i=0;i<pos.count;i++){let u=(pos.getX(i)+w/2)/w;if(flipU)u=1-u;uv.setXY(i,u,(pos.getY(i)+h/2)/h)}uv.needsUpdate=true;return g}
 /* B5: one page of the open 3D book (768x1080). Pages come in pairs: even k = right-hand (front of a leaf), odd k = left-hand (its back).
    0 title page · 1 abstract · 2 details · 3 citation · 4 read alongside · 5 colophon. Every text block goes through BKText (fits or ellipsizes), so nothing can overflow. */
 function paintPage(x,W,H,r,k){
  const TF=window.BKText,tt=typeof t==='function'?t:(q=>q),left=k%2===1,mx=86,top=150,bot=H-150,cw=W-2*mx,ink='#2a2118',mute='#7a6a55';
  const g=x.createLinearGradient(left?W:0,0,left?W-110:110,0);g.addColorStop(0,'rgba(70,52,30,.34)');g.addColorStop(1,'rgba(70,52,30,0)');
  x.fillStyle='#f3ead4';x.fillRect(0,0,W,H);x.fillStyle=g;x.fillRect(0,0,W,H);
  let sd=(k+3)*7919;const rnd=()=>{sd=(sd*16807)%2147483647;return sd/2147483647};for(let i=0;i<260;i++){x.fillStyle=`rgba(${120+rnd()*40|0},${100+rnd()*30|0},60,${.02+rnd()*.05})`;x.fillRect(rnd()*W,rnd()*H,1+rnd()*2,1)}
  x.textAlign='center';x.fillStyle=mute;x.font='500 22px "IBM Plex Mono",monospace';x.fillText((typeof catalogNo==='function'?catalogNo(r):'')+'  ·  '+tt('brand').toUpperCase(),W/2,78);
  x.strokeStyle='rgba(120,100,70,.4)';x.lineWidth=1.5;x.beginPath();x.moveTo(mx,102);x.lineTo(W-mx,102);x.stroke();
  x.font='500 24px "IBM Plex Mono",monospace';x.fillText(String(k+1),W/2,H-62);
  const head=txt=>{x.textAlign='left';x.fillStyle=ink;x.font='500 50px Fraunces,Georgia,serif';x.fillText(TF?TF.ellipsize(x,txt,cw):txt,mx,top+34);x.strokeStyle='rgba(165,92,57,.7)';x.lineWidth=3;x.beginPath();x.moveTo(mx,top+58);x.lineTo(mx+90,top+58);x.stroke()};
  const para=(text,y0,sizes,lh,font)=>{const f=TF.fitBlock(x,text,{maxW:cw,maxH:bot-y0,sizes,lh,font:font||(z=>'400 '+z+'px Fraunces,Georgia,serif')});x.fillStyle=ink;x.textAlign='left';f.lines.forEach((ln,i)=>x.fillText(ln,mx,y0+f.size+i*f.lh));return f};
  const title=typeof displayTitle==='function'?displayTitle(r):r.title,author=r.author||'';
  if(k===0){
   x.textAlign='center';x.strokeStyle='rgba(165,92,57,.65)';x.lineWidth=2.5;x.beginPath();x.moveTo(W/2-60,top+10);x.lineTo(W/2+60,top+10);x.stroke();x.fillStyle='rgba(165,92,57,.85)';x.beginPath();x.arc(W/2,top+10,6,0,7);x.fill();
   const f=TF.fitBlock(x,title,{maxW:cw-20,maxH:380,sizes:[64,58,52,46,42,38,34],lh:1.22,font:z=>'500 '+z+'px Fraunces,Georgia,serif'});x.fillStyle=ink;f.lines.forEach((ln,i)=>x.fillText(ln,W/2,top+90+f.size+i*f.lh));
   let y=top+90+f.lines.length*f.lh+f.size*.3+36;
   if(author){const fa=TF.fitLine(x,author,{maxW:cw-20,sizes:[38,34,30,27],font:z=>'italic 400 '+z+'px Fraunces,Georgia,serif'});x.font='italic 400 '+fa.size+'px Fraunces,Georgia,serif';x.fillStyle=mute;x.fillText(fa.text,W/2,Math.min(y+fa.size,bot-120));y+=fa.size+30}
   x.fillStyle=mute;x.font='500 25px "IBM Plex Mono",monospace';x.fillText([r.year,tt(r.collection)].filter(Boolean).join('  ·  '),W/2,bot-60);
  }else if(k===1){head(tt('bkPgAbstract'));const d=typeof displayDescription==='function'?displayDescription(r):(r.description||'');para(d||tt('bkPgNone'),top+110,[37,34,32,30,28],1.5)}
  else if(k===2){head(tt('bkPgDetails'));const rows=detailRows(r);
   let y=top+120;rows.forEach(([a,b])=>{x.textAlign='left';x.fillStyle=mute;x.font='500 22px "IBM Plex Mono",monospace';x.fillText(String(a).toUpperCase(),mx,y);const fl=TF.fitLine(x,String(b),{maxW:cw,sizes:[40,36,32,28],font:z=>'400 '+z+'px Fraunces,Georgia,serif'});x.fillStyle=ink;x.font='400 '+fl.size+'px Fraunces,Georgia,serif';x.fillText(fl.text,mx,y+fl.size+8);x.strokeStyle='rgba(120,100,70,.28)';x.lineWidth=1;x.beginPath();x.moveTo(mx,y+fl.size+30);x.lineTo(W-mx,y+fl.size+30);x.stroke();y+=fl.size+78})}
  else if(k===3){head(tt('bkPgCite'));const c=window.BKRecordText?window.BKRecordText.citation(r):'';para(c,top+110,[33,31,29,27],1.5,z=>'400 '+z+'px "IBM Plex Mono",monospace')}
  else if(k===4){head(tt('bkPgRelated'));const rel=window.BKRecordText?window.BKRecordText.related(r,3):[];let y=top+120;
   rel.forEach(q=>{const ft=TF.fitBlock(x,(typeof displayTitle==='function'?displayTitle(q):q.title),{maxW:cw,maxH:130,maxLines:2,sizes:[36,33,30,27],lh:1.25,font:z=>'500 '+z+'px Fraunces,Georgia,serif'});x.textAlign='left';x.fillStyle=ink;ft.lines.forEach((ln,i)=>{x.font='500 '+ft.size+'px Fraunces,Georgia,serif';x.fillText(ln,mx,y+ft.size+i*ft.lh)});y+=ft.lines.length*ft.lh+ft.size*.9;
    if(q.author){const fa=TF.fitLine(x,q.author,{maxW:cw,sizes:[26,24,22],font:z=>'italic 400 '+z+'px Fraunces,Georgia,serif'});x.font='italic 400 '+fa.size+'px Fraunces,Georgia,serif';x.fillStyle=mute;x.fillText(fa.text,mx,y);y+=fa.size+44}else y+=30})}
  else{x.textAlign='center';x.fillStyle='rgba(165,92,57,.5)';x.font='600 170px Fraunces,Georgia,serif';x.fillText('BK',W/2,H/2+40);x.fillStyle=mute;x.font='500 24px "IBM Plex Mono",monospace';x.fillText(tt('brand').toUpperCase(),W/2,H/2+100)}
 }
 /* record data values are stored in Turkish: run them through the UI dictionary so the EN book shows "English", not "İngilizce" */
 function detailRows(r){const tt=typeof t==='function'?t:(q=>q),tv=v=>v&&typeof label==='function'?label(v):v;
  return[[tt('bkLang'),tv(r.language)],[tt('bkType'),tt(r.collection)],[tt('bkYear'),r.year],[tt('bkPages'),r.pages],[tt('bkField'),typeof label==='function'&&r.category?String(label(r.category)).replace(/^\d+ - /,''):''],[tt('bkLevel'),tv(r.level)]].filter(q=>q[1])}
 /* the same page content as plain text, for the screen-reader mirror of the canvas pages */
 function pageText(r,k){const tt=typeof t==='function'?t:(q=>q),T=typeof displayTitle==='function'?displayTitle(r):r.title;
  if(k===0)return[T,r.author,[r.year,tt(r.collection)].filter(Boolean).join(', ')].filter(Boolean).join('. ');
  if(k===1)return tt('bkPgAbstract')+'. '+((typeof displayDescription==='function'?displayDescription(r):r.description)||tt('bkPgNone'));
  if(k===2)return tt('bkPgDetails')+'. '+detailRows(r).map(q=>q[0]+': '+q[1]).join('. ');
  if(k===3)return tt('bkPgCite')+'. '+(window.BKRecordText?window.BKRecordText.citation(r):'');
  if(k===4)return tt('bkPgRelated')+'. '+(window.BKRecordText?window.BKRecordText.related(r,3):[]).map(q=>(typeof displayTitle==='function'?displayTitle(q):q.title)+(q.author?', '+q.author:'')).join('. ');
  return tt('brand')}
 /* B1: edge wear (worn tan speckle along the edges / corners; `rough` mode paints rougher, i.e. lighter, pixels) and a fingerprint smudge as clearcoat normal */
 function wearEdges(x,W,H,seed,mode){let s=seed|0;const rnd=()=>{s=(s*1664525+1013904223)|0;return((s>>>8)&0xffff)/65536};
  x.save();for(let i=0;i<1100;i++){const side=(rnd()*4)|0,t=rnd(),d=Math.pow(rnd(),3.4)*20;let px,py;
   if(side===0){px=t*W;py=d}else if(side===1){px=t*W;py=H-d}else if(side===2){px=d;py=t*H}else{px=W-d;py=t*H}
   const corner=Math.min(Math.min(px,W-px),Math.min(py,H-py));const k=1-Math.min(1,corner/46)*.6,r=.5+rnd()*1.7;
   x.fillStyle=mode==='rough'?`rgba(255,255,255,${(.25+.4*rnd())*k})`:`rgba(${216+rnd()*24|0},${196+rnd()*22|0},${150+rnd()*30|0},${(.06+.16*rnd())*k})`;x.beginPath();x.arc(px,py,r,0,7);x.fill()}x.restore()}
 /* B6: height canvas -> tangent-space normal map (Sobel, wrapping), shared by the medal relief and the coin reeding */
 function normalFromHeight(m,cv,strength){const W=cv.width,H=cv.height,src=cv.getContext('2d').getImageData(0,0,W,H).data,out=document.createElement('canvas');out.width=W;out.height=H;const ox=out.getContext('2d'),od=ox.createImageData(W,H),h=(i,j)=>src[(((j+H)%H)*W+((i+W)%W))*4]/255;
  for(let j=0;j<H;j++)for(let i=0;i<W;i++){const dx=(h(i+1,j)-h(i-1,j))*strength,dy=(h(i,j+1)-h(i,j-1))*strength,l=Math.hypot(dx,dy,1),o=(j*W+i)*4;od.data[o]=(-dx/l*.5+.5)*255;od.data[o+1]=(dy/l*.5+.5)*255;od.data[o+2]=(1/l*.5+.5)*255;od.data[o+3]=255}
  ox.putImageData(od,0,0);const t=new m.CanvasTexture(out);t.wrapS=t.wrapT=m.RepeatWrapping;return t}
 function smudgeNormal(m,seed){const N=256,c=document.createElement('canvas');c.width=c.height=N;const x=c.getContext('2d');x.fillStyle='#000';x.fillRect(0,0,N,N);
  let s=seed|0;const rnd=()=>{s=(s*1664525+1013904223)|0;return((s>>>8)&0xffff)/65536};
  x.strokeStyle='#fff';for(let f=0;f<3;f++){const cx=rnd()*N,cy=rnd()*N,rx=22+rnd()*26,ry=rx*(1.25+rnd()*.35),rot=rnd()*3.14;x.save();x.translate(cx,cy);x.rotate(rot);x.globalAlpha=.55;x.lineWidth=1.5;for(let r=3;r<1;r++);for(let k=2;k<rx;k+=3.2){x.beginPath();x.ellipse(0,0,k,k*ry/rx,0,0,6.283);x.stroke()}x.restore()}
  const src=x.getImageData(0,0,N,N).data,out=x.createImageData(N,N),h=(i,j)=>src[(((j+N)%N)*N+((i+N)%N))*4]/255;
  for(let j=0;j<N;j++)for(let i=0;i<N;i++){const dx=(h(i+1,j)-h(i-1,j))*2.2,dy=(h(i,j+1)-h(i,j-1))*2.2,l=Math.hypot(dx,dy,1),o=(j*N+i)*4;out.data[o]=(-dx/l*.5+.5)*255;out.data[o+1]=(dy/l*.5+.5)*255;out.data[o+2]=(1/l*.5+.5)*255;out.data[o+3]=255}
  x.putImageData(out,0,0);const t=new m.CanvasTexture(c);t.wrapS=t.wrapT=m.RepeatWrapping;return t}
 const sceneCache=new Map();/* shelf peek + palette preview reuse built book scenes (16 most recent) */
 function sceneFor(m,rec){let s=sceneCache.get(rec.id);if(!s){s=bookScene(m,null,rec);sceneCache.set(rec.id,s);if(sceneCache.size>16)sceneCache.delete(sceneCache.keys().next().value)}return s}
 function bookScene(m,it,r,real){
  const{scene,camera}=rig(m,30,7.2),g=new m.Group();scene.add(g);const idx=(typeof recordArtIndex==='function')?recordArtIndex(r):0;
  const envMap=studioEnv(m);if(envMap)scene.environment=envMap;
  const wseed=(idx+3)*2654435+String(r.id||'').length*977,col=canvasTex(m,512,720,(x,W,H)=>{paintCover(x,W,H,r,idx,false);wearEdges(x,W,H,wseed,'col')},true),mask=canvasTex(m,512,720,(x,W,H)=>paintCover(x,W,H,r,idx,true),false);
  const rough=canvasTex(m,512,720,(x,W,H)=>{paintCover(x,W,H,r,idx,true);const d=x.getImageData(0,0,W,H),q=d.data;for(let i=0;i<q.length;i+=4){const v=q[i];const rr=Math.round(215-v*.78);q[i]=q[i+1]=q[i+2]=rr}x.putImageData(d,0,0);wearEdges(x,W,H,wseed,'rough')},false);
  const MT=matOf(idx),bump=grainBump(m,mask,MT.bind,(idx+1)*7919+String(r.id||'').length*131),cover=new m.MeshPhysicalMaterial({map:col,roughnessMap:rough,roughness:1,metalnessMap:mask,metalness:1,bumpMap:bump,bumpScale:2.6,clearcoat:MT.coat,clearcoatRoughness:MT.rough*.7,clearcoatNormalMap:smudgeNormal(m,wseed),clearcoatNormalScale:new m.Vector2(.16,.16),anisotropy:.5,anisotropyRotation:Math.PI/2,sheen:.8,sheenRoughness:.6,sheenColor:new m.Color(0x8fa3b8),envMapIntensity:1.1});
  const backCol=canvasTex(m,512,720,(x,W,H)=>{const gr=x.createLinearGradient(0,0,W,H);gr.addColorStop(0,COVER[idx%8]);gr.addColorStop(1,'#0d1822');x.fillStyle=gr;x.fillRect(0,0,W,H);noise(x,W,H,.14,5200);x.strokeStyle=GOLD;x.lineWidth=3;x.strokeRect(24,24,W-48,H-48);x.lineWidth=1.2;x.strokeRect(34,34,W-68,H-68);x.fillStyle=GOLD;x.font='600 64px Fraunces,Georgia,serif';x.textAlign='center';x.fillText('BK',W/2,H/2);x.font='600 15px "IBM Plex Mono",monospace';x.fillText('BİLİM KÜTÜPHANEM',W/2,H/2+42);x.fillStyle='rgba(246,239,220,.16)';for(let i=0;i<9;i++)x.fillRect(80,120+i*22,W-160-((i*53)%90),5)},true);
  const backM=new m.MeshPhysicalMaterial({map:backCol,roughness:.75,sheen:.7,sheenColor:new m.Color(0x8fa3b8),envMapIntensity:.8});
  const clothSide=new m.MeshPhysicalMaterial({color:new m.Color(COVER[idx%8]).multiplyScalar(.7),roughness:.8,sheen:.8,sheenColor:new m.Color(0x8fa3b8)});
  const W=2.1,Hh=3.1,D=.54,T=.05,xL=-W/2+.04;
  const front=new m.Mesh(board(m,W-.04,Hh,T,false),[cover,clothSide]),hinge=new m.Group();hinge.position.set(xL,0,D/2-T/2);front.position.set((W-.04)/2,0,0);hinge.add(front);g.add(hinge);
  const back=new m.Mesh(board(m,W-.04,Hh,T,true),[backM,clothSide]);back.position.set(xL+(W-.04)/2,0,-(D/2-T/2));g.add(back);
  /* spine: rounded, with raised bands + foil title */
  const spineTex=(()=>{const t=spineTexture(m,r,idx);t.anisotropy=8;return t})();
  const spine=new m.Mesh(shared('spine',()=>new m.CylinderGeometry(D/2,D/2,Hh-.01,40,1,true,Math.PI,Math.PI)),new m.MeshPhysicalMaterial({map:spineTex,roughness:.5,metalness:.15,sheen:.6,sheenColor:new m.Color(0x8fa3b8),envMapIntensity:1.0,side:m.DoubleSide}));spine.position.set(xL,0,0);g.add(spine);
  [-1.3,-1.2,1.2,1.3].forEach(y=>{const band=new m.Mesh(new m.TorusGeometry(D/2+.002,.008,8,40,Math.PI),new m.MeshStandardMaterial({color:new m.Color(MT.foil),metalness:1,roughness:.28,envMapIntensity:1.3}));band.rotation.set(Math.PI/2,0,Math.PI/2);band.position.set(xL,y,0);g.add(band)});
  /* page block with real page-edge texture + headbands */
  const edgeV=pageEdge(m,true),edgeH=pageEdge(m,false),paper=new m.MeshStandardMaterial({color:0xefe6cf,roughness:.95}),
   pagesMat=[new m.MeshStandardMaterial({map:edgeV,roughness:.92,bumpMap:edgeV,bumpScale:.6}),paper,new m.MeshStandardMaterial({map:edgeH,roughness:.92,bumpMap:edgeH,bumpScale:.6}),new m.MeshStandardMaterial({map:edgeH,roughness:.92}),paper,paper];
  const pgGeo=shared('pages',()=>new m.BoxGeometry(W-.2,Hh-.14,D-.1,28,1,8)),pgPos=pgGeo.attributes.position,PX=(W-.2)/2,PY=(Hh-.14)/2;/* fore-edge bulge + gently wavy head/tail edges (±0.004), so the block reads as loose leaves, not a brick */if(!pgGeo.userData.shaped)for(let i=0;i<pgPos.count;i++){const u=pgPos.getZ(i)/((D-.1)/2),px=pgPos.getX(i);if(px>PX-1e-4)pgPos.setX(i,px+.022*(1-u*u));if(Math.abs(Math.abs(pgPos.getY(i))-PY)<1e-4)pgPos.setY(i,pgPos.getY(i)+Math.sign(pgPos.getY(i))*.004*Math.sin(px*13+u*5.3)*Math.cos(px*5.1-u*2))}if(!pgGeo.userData.shaped){pgGeo.computeVertexNormals();pgGeo.userData.shaped=true}const pages=new m.Mesh(pgGeo,pagesMat);pages.position.set(xL+(W-.2)/2+.01,0,0);g.add(pages);
  [1,-1].forEach(s=>{const hb=new m.Mesh(new m.CylinderGeometry(.02,.02,D-.12,12),new m.MeshStandardMaterial({color:0xb8423a,roughness:.5}));hb.rotation.x=Math.PI/2;hb.position.set(xL+.03,s*(Hh/2-.085),0);g.add(hb)});
  /* ribbon bookmark: 6-segment verlet chain hanging from the head of the block (gravity follows the book's pose; a fast yaw flicks the tail); the plane's rows are skinned onto the chain */
  const rg=new m.PlaneGeometry(.07,.65,1,14),RN=6,RL=.65/RN,AX=xL+.55,AY=-Hh/2+.145,AZ=.02,chain=[];for(let i=0;i<=RN;i++)chain.push({x:AX,y:AY-i*RL,z:AZ,px:AX,py:AY-i*RL,pz:AZ});
  const rpos=rg.attributes.position,rrow=new Float32Array(rpos.count),rside=new Float32Array(rpos.count);for(let i=0;i<rpos.count;i++){rrow[i]=(.325-rpos.getY(i))/.65*RN;rside[i]=rpos.getX(i)}
  const ribbon=new m.Mesh(rg,new m.MeshPhysicalMaterial({color:0xa5262c,roughness:.4,sheen:1,sheenColor:new m.Color(0xff8a80),side:m.DoubleSide}));ribbon.frustumCulled=false;g.add(ribbon);
  const gdown=new m.Vector3(),qInv=new m.Quaternion();let lastYaw=null;
  const stepRibbon=(dt,yawV,t)=>{dt=Math.min(dt,.033);g.updateMatrixWorld(true);g.getWorldQuaternion(qInv).invert();gdown.set(0,-1,0).applyQuaternion(qInv);
   const G=7.5,wx=Math.sin(t*1.3)*.5+yawV*.9;
   for(let i=1;i<=RN;i++){const n=chain[i],tail=i/RN,vx=(n.x-n.px)*.955,vy=(n.y-n.py)*.955,vz=(n.z-n.pz)*.955;n.px=n.x;n.py=n.y;n.pz=n.z;
    n.x+=vx+(gdown.x*G+wx*tail)*dt*dt;n.y+=vy+gdown.y*G*dt*dt;n.z+=vz+(gdown.z*G+Math.cos(t*1.1+i)*.35*tail)*dt*dt}
   for(let it2=0;it2<5;it2++){chain[0].x=AX;chain[0].y=AY;chain[0].z=AZ;
    for(let i=0;i<RN;i++){const a=chain[i],b=chain[i+1];let dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z;const d=Math.hypot(dx,dy,dz)||1e-6,k=(d-RL)/d*(i===0?1:.5);
     if(i===0){b.x-=dx*k;b.y-=dy*k;b.z-=dz*k}else{a.x+=dx*k;a.y+=dy*k;a.z+=dz*k;b.x-=dx*k;b.y-=dy*k;b.z-=dz*k}}
    chain.forEach(n=>{if(n.z<.004&&n.x>xL-.05&&n.x<xL+W-.1&&n.y>-Hh/2)n.z=.004})}
   for(let i=0;i<rpos.count;i++){const f=Math.max(0,Math.min(RN-1e-4,rrow[i])),k=Math.floor(f),u=f-k,a=chain[k],b=chain[k+1];rpos.setXYZ(i,a.x+(b.x-a.x)*u+rside[i],a.y+(b.y-a.y)*u,a.z+(b.z-a.z)*u)}
   rpos.needsUpdate=true;rg.computeVertexNormals()};
  for(let i=0;i<30;i++)stepRibbon(.016,0,0);
  /* contact shadow: two soft layers */
  const shMap=(()=>{const c=document.createElement('canvas');c.width=256;c.height=128;const x=c.getContext('2d'),gr=x.createRadialGradient(128,64,0,128,64,120);gr.addColorStop(0,'rgba(0,0,0,.62)');gr.addColorStop(.5,'rgba(0,0,0,.22)');gr.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=gr;x.fillRect(0,0,256,128);return new m.CanvasTexture(c)})();
  const shadow=new m.Mesh(new m.PlaneGeometry(3.8,1.3),new m.MeshBasicMaterial({map:shMap,transparent:true,depthWrite:false}));shadow.rotation.x=-Math.PI/2;shadow.position.y=-1.78;scene.add(shadow);
  scene.add(new m.AmbientLight(0xffffff,.42));const key=new m.DirectionalLight(0xfff1d6,2.3);key.position.set(-3,4,5);scene.add(key);
  if(real){[front,back,spine,pages].forEach(o=>{o.castShadow=true});key.castShadow=true;key.shadow.mapSize.set(1024,1024);const sc=key.shadow.camera;sc.left=-3.2;sc.right=3.2;sc.top=3.6;sc.bottom=-3.6;sc.near=1;sc.far=16;key.shadow.bias=-.0006;key.shadow.radius=5;
   const floor=new m.Mesh(new m.PlaneGeometry(9,6),new m.ShadowMaterial({opacity:.26}));floor.rotation.x=-Math.PI/2;floor.position.y=-1.775;floor.receiveShadow=true;scene.add(floor);shadow.material.opacity=.4}const rim=new m.DirectionalLight(0x9fc4ff,1.1);rim.position.set(4,1,-3);scene.add(rim);const fill=new m.DirectionalLight(0xffe2c0,.5);fill.position.set(3,-2,4);scene.add(fill);
  g.position.x=-.05;
  /* pose machine: auto (gentle sway toward the pointer) → drag (free) → snap (springs onto the nearest of front / spine / back / page edge) → auto after the pointer has left; read (double-click): square-on reading pose, cover closed, slightly larger */
  const QP=Math.PI/2,BASE=-.42,wrap=(a,ref)=>a-Math.PI*2*Math.round((a-ref)/(Math.PI*2));
  let yaw=BASE,pitch=.08,vy=0,mode='auto',snapYaw=BASE,idle=0,open=0,zoom=1,bookOpen=false,coverK=0,leafIdx=0;const dark=()=>root.dataset.theme!=='light';
  /* B5: pages. Built on first open (6 canvases are not free). Three leaves hinge on the spine axis; leaf k carries page 2k on its front and 2k+1 on its back.
     The cover swings a full 180°, an endpaper lines its inside, a turning leaf curls (its outer edge lags) and lifts over the stack. */
  const LN=3,LW=W-.34,LH=Hh-.22,LPX=xL+.07,leaves=[],leafP=[0,0,0],leafT=[0,0,0];let endpaper=null;
  const zr=k=>.2225+.0035*(LN-k),zl=k=>.2985+.0035*k;/* left stack must clear the endpaper (hinge z .245 + .045 = .29 once the cover lies flat) */
  function buildLeaves(){
   if(leaves.length||!real)return;
   endpaper=new m.Mesh(new m.PlaneGeometry(W-.13,Hh-.16),new m.MeshStandardMaterial({map:canvasTex(m,512,720,(x,w2,h2)=>{x.fillStyle=COVER[idx%8];x.fillRect(0,0,w2,h2);const gr=x.createLinearGradient(0,0,w2,0);gr.addColorStop(0,'rgba(0,0,0,.28)');gr.addColorStop(.18,'rgba(0,0,0,0)');x.fillStyle=gr;x.fillRect(0,0,w2,h2);x.strokeStyle='rgba(246,239,220,.22)';x.lineWidth=2;x.strokeRect(34,34,w2-68,h2-68);x.strokeStyle='rgba(246,239,220,.12)';for(let i=0;i<22;i++){x.beginPath();x.arc(w2*.6,h2*.5,20+i*18,0,7);x.stroke()}noise(x,w2,h2,.1,321)},true),roughness:.85,side:m.FrontSide}));
   endpaper.rotation.y=Math.PI;endpaper.position.set((W-.04)/2,0,-(T/2+.016)-.004);/* just outside the board's inner bevel (bevelThickness .016), or the cap hides it */hinge.add(endpaper);endpaper.visible=false;
   const pageMat=k=>new m.MeshStandardMaterial({map:canvasTex(m,768,1080,(x,w2,h2)=>paintPage(x,w2,h2,r,k),true),roughness:.9,side:m.FrontSide});
   const lgeo=()=>{const gg=new m.PlaneGeometry(LW,LH,24,1);gg.translate(LW/2,0,0);return gg};
   for(let k=0;k<LN;k++){const pv=new m.Group();pv.position.set(LPX,0,zr(k));
    const fr=new m.Mesh(lgeo(),pageMat(k*2)),bk=new m.Mesh(lgeo(),pageMat(k*2+1));bk.rotation.y=Math.PI;bk.position.x=LW;
    fr.castShadow=bk.castShadow=true;pv.add(fr,bk);pv.visible=false;g.add(pv);leaves.push({pv,fr,bk,base:Float32Array.from(fr.geometry.attributes.position.array)})}}
  function animateLeaves(dt,still){
   leaves.forEach((L,k)=>{leafP[k]+=still?leafT[k]-leafP[k]:(leafT[k]-leafP[k])*(1-Math.exp(-6.2*Math.min(dt,.05)));const p=leafP[k];
    L.pv.visible=coverK>.02;L.pv.rotation.y=-Math.PI*p*.995;L.pv.position.z=zr(k)+(zl(k)-zr(k))*p+Math.sin(Math.PI*p)*.03;
    const amp=.34*Math.sin(Math.PI*p)*(1-2*p),a1=L.fr.geometry.attributes.position,a2=L.bk.geometry.attributes.position;
    for(let i=0;i<a1.count;i++){const x0=L.base[i*3],uf=x0/LW,ub=(LW-x0)/LW;a1.setZ(i,-amp*uf*uf);a2.setZ(i,amp*ub*ub)}
    a1.needsUpdate=a2.needsUpdate=true;L.fr.geometry.computeVertexNormals();L.bk.geometry.computeVertexNormals()})}
  return{scene,camera,
   drag(dx,dy){mode='drag';if(bookOpen){yaw=Math.max(-.7,Math.min(.5,yaw+dx*.01));pitch=Math.max(-.1,Math.min(.5,pitch+dy*.006));vy=0;return}yaw+=dx*.012;pitch=Math.max(-.5,Math.min(.5,pitch+dy*.008));vy=dx*.012},
   release(){if(mode!=='drag')return;if(bookOpen){mode='open';vy=0;return}const k=Math.round((yaw+vy*10-BASE)/QP);snapYaw=BASE+k*QP;vy=0;mode='snap';idle=0},
   open(on){on=!!on;if(on&&!real)return false;bookOpen=on;if(on){buildLeaves();mode='open'}else{leafIdx=0;leafT.fill(0);if(mode==='open')mode='auto'}return bookOpen},
   turn(d){if(!bookOpen)return leafIdx;leafIdx=Math.max(0,Math.min(LN,leafIdx+d));for(let k=0;k<LN;k++)leafT[k]=k<leafIdx?1:0;return leafIdx},
   state(){return{open:bookOpen,leaf:leafIdx,leaves:LN,coverK:+coverK.toFixed(3),p:leafP.map(v=>+v.toFixed(3))}},
   dbl(){if(bookOpen)return;if(mode==='read'){mode='auto';yaw=wrap(yaw,BASE)}else{mode='read';yaw=wrap(yaw,-.12)}},
   update(t,dt,it){const hov=it.hoverT,k7=Math.min(1,dt*7);
    if(bookOpen&&!it.drag&&mode!=='open')mode='open';
    if(it.drag){mode='drag'}
    if(mode==='drag'){/* yaw driven by drag() */}
    else if(mode==='snap'){yaw+=(snapYaw+it.px*.12*hov-yaw)*k7;pitch+=(.08-pitch)*k7;if(hov<.02){idle+=dt;if(idle>2.2){mode='auto';yaw=wrap(yaw,BASE)}}else idle=0}
    else if(mode==='read'){yaw+=(-.12-yaw)*k7;pitch+=(.04-pitch)*k7}
    else if(mode==='open'){yaw+=((-.04+it.px*.12*hov)-yaw)*k7;pitch+=((.2+it.py*.06*hov)-pitch)*k7}
    else{yaw+=((BASE+Math.sin(t*.7)*.1)+it.px*.55*hov-yaw)*.12}
    const calm=mode==='read'?0:1,openT=mode==='read'||mode==='drag'||bookOpen?0:hov*.21;open+=(openT-open)*k7;zoom+=((bookOpen?.86:mode==="read"?1.06:1)-zoom)*k7;
    coverK+=((bookOpen?1:0)-coverK)*Math.min(1,dt*(paused()?60:4.2));hinge.rotation.y=-(open*(1-coverK)+coverK*Math.PI);if(endpaper)endpaper.visible=coverK>.02;g.scale.setScalar(zoom);g.position.x=-.05+coverK*1.057;animateLeaves(dt,paused());shadow.scale.x=1+coverK*.9;shadow.position.y=-1.78+coverK*.18;shadow.position.x=coverK*.95;
    g.rotation.y=yaw;g.rotation.x=pitch+(mode==='auto'?it.py*.2*hov:0)+Math.sin(t*.9)*.015*calm;g.position.y=Math.sin(t*1.1)*.08*calm+hov*.12*calm+coverK*.18;g.position.z=hov*.3*calm;
    {const yv=lastYaw==null?0:(yaw-lastYaw)/Math.max(dt,.001);lastYaw=yaw;stepRibbon(dt,Math.max(-3,Math.min(3,yv))*.5,t)}shadow.material.opacity=(real?.4:.95)-it.hoverT*.2;key.intensity=dark()?2.3:2.0;rim.intensity=dark()?1.1:.7}}}


 /* F1: every atlas tile gets solid, lit objects in its own material (glass atom core, glass DNA with gold rungs, glass globe, gold lattice nodes, lit banded planet, gold armillary rings), all under the same studio IBL (one PMREM, see studioEnv). F2: the camera drifts with the pointer so the layers separate (parallax). */
 const SOLID={
  0:(m,sc,g,col)=>{const mat=new m.MeshPhysicalMaterial({color:col.clone().lerp(new m.Color(1,1,1),.35),transparent:true,opacity:.62,roughness:.06,metalness:0,clearcoat:1,clearcoatRoughness:.04,envMapIntensity:1.7});
   [[0,0,0,.3],[.2,.12,.05,.2],[-.16,-.1,.12,.17]].forEach(([x,y,z,r])=>{const n=new m.Mesh(new m.SphereGeometry(r,36,24),mat);n.position.set(x,y,z);g.add(n)});
   const gold=new m.MeshStandardMaterial({color:0xe8ce9e,metalness:1,roughness:.22,envMapIntensity:1.5});[0,1,2].forEach(i=>{const o=new m.Mesh(new m.TorusGeometry(1.6,.012,8,120),gold);o.scale.y=.55;o.rotation.set(i*1.05,i*.6,i*.8);g.add(o)})},
  1:(m,sc,g,col)=>{const N=72,A=[],B=[];for(let i=0;i<=N;i++){const y=(i/N-.5)*3.4,a=i/N*Math.PI*4;A.push(new m.Vector3(Math.cos(a)*.62,y,Math.sin(a)*.62));B.push(new m.Vector3(Math.cos(a+Math.PI)*.62,y,Math.sin(a+Math.PI)*.62))}
   const glassA=new m.MeshPhysicalMaterial({color:col.clone().lerp(new m.Color(1,1,1),.25),transparent:true,opacity:.7,roughness:.08,clearcoat:1,envMapIntensity:1.6}),glassB=new m.MeshPhysicalMaterial({color:0xcfe0ff,transparent:true,opacity:.6,roughness:.08,clearcoat:1,envMapIntensity:1.6});
   g.add(new m.Mesh(new m.TubeGeometry(new m.CatmullRomCurve3(A),160,.05,10,false),glassA),new m.Mesh(new m.TubeGeometry(new m.CatmullRomCurve3(B),160,.05,10,false),glassB));
   const rungs=[];for(let i=0;i<=N;i+=3)rungs.push(i);const im=new m.InstancedMesh(new m.CylinderGeometry(.018,.018,1,8),new m.MeshStandardMaterial({color:0xe8ce9e,metalness:1,roughness:.25,envMapIntensity:1.4}),rungs.length),M=new m.Matrix4(),q=new m.Quaternion(),up=new m.Vector3(0,1,0),d=new m.Vector3(),c=new m.Vector3();
   rungs.forEach((i,k)=>{d.copy(B[i]).sub(A[i]);const len=d.length();c.copy(A[i]).add(B[i]).multiplyScalar(.5);q.setFromUnitVectors(up,d.normalize());M.compose(c,q,new m.Vector3(1,len,1));im.setMatrixAt(k,M)});g.add(im)},
  2:(m,sc,g,col)=>{g.add(new m.Mesh(new m.SphereGeometry(1.38,48,32),new m.MeshPhysicalMaterial({color:col.clone().lerp(new m.Color(1,1,1),.5),transparent:true,opacity:.2,roughness:.05,clearcoat:1,envMapIntensity:1.8})));
   const ring=new m.Mesh(new m.TorusGeometry(1.46,.018,10,128),new m.MeshStandardMaterial({color:0xe8ce9e,metalness:1,roughness:.2,envMapIntensity:1.5}));ring.rotation.x=Math.PI/2;g.add(ring)},
  4:(m,sc,g,col)=>{const n=4,s=.62,im=new m.InstancedMesh(new m.SphereGeometry(.075,16,12),new m.MeshStandardMaterial({color:0xe8ce9e,metalness:1,roughness:.2,envMapIntensity:1.5}),n*n*n),M=new m.Matrix4();let k=0;
   for(let z=0;z<n;z++)for(let y=0;y<n;y++)for(let x=0;x<n;x++){M.makeTranslation((x-1.5)*s,(y-1.5)*s,(z-1.5)*s);im.setMatrixAt(k++,M)}g.add(im)},
  5:(m,sc,g,col)=>{const P=g.children.find(o=>o.isMesh&&o.geometry.parameters&&o.geometry.parameters.radius===1),mo=g.children.find(o=>o.isMesh&&o.geometry.parameters&&o.geometry.parameters.radius===.2);
   if(P){const map=P.material.map;P.material=new m.MeshStandardMaterial({map,roughness:.62,metalness:.05,envMapIntensity:1})}
   if(mo)mo.material=new m.MeshStandardMaterial({color:0xe8ce9e,metalness:1,roughness:.28,envMapIntensity:1.4})},
  6:(m,sc,g,col)=>{const gold=new m.MeshStandardMaterial({color:0xe8ce9e,metalness:1,roughness:.22,envMapIntensity:1.5});
   [[0,0,0],[Math.PI/2,0,0],[0,Math.PI/2,0]].forEach(r=>{const t=new m.Mesh(new m.TorusGeometry(1.5,.026,10,120),gold);t.rotation.set(...r);g.add(t)});
   g.add(new m.Mesh(new m.SphereGeometry(.2,24,18),new m.MeshStandardMaterial({color:0xffe9b8,emissive:0xffc870,emissiveIntensity:.8,roughness:.3})))}};
 ATLAS.forEach((f,i)=>{if(!SOLID[i])return;ATLAS[i]=(m,it,col)=>{const made=f(m,it,col);if(!made)return made;
  const env=studioEnv(m),g=made.scene.children.find(o=>o.type==='Group');
  if(env)made.scene.environment=env;
  try{SOLID[i](m,made.scene,g,col)}catch{}
  made.scene.add(new m.AmbientLight(0xffffff,.45));const key=new m.DirectionalLight(0xfff1d6,2);key.position.set(-3,4,5);made.scene.add(key);
  const up0=made.update,z0=made.camera.position.z,MO=window.BKMotion;
  made.update=(t,dt,it2)=>{if(up0)up0(t,dt,it2);
   /* A1: the object dollies in (and fades up) as its tile arrives from below the fold; A4: a click dives the camera into it before the filter applies */
   const arr=MO?MO.arrival(it2.host):1,dv=it2.diveT0?(MO||{ease:{inOut3:x=>x}}).ease.inOut3(Math.min(1,(performance.now()-it2.diveT0)/420)):0;
   made.camera.position.x=it2.px*.45*it2.hoverT*(1-dv);made.camera.position.y=-it2.py*.28*it2.hoverT*(1-dv);made.camera.position.z=z0*(1+.5*(1-arr))*(1-.52*dv);made.camera.lookAt(0,0,0);
   it2.canvas.style.opacity=arr>=.999?'':String((.3+.7*arr).toFixed(3));if(dv>0&&dv<1)it2.dirty=true};
  return made}});

 /* ---------- mounting ---------- */
 function mountAtlas(){
  document.querySelectorAll('.atlas-tile').forEach(tile=>{
   if(tile.querySelector('.tile-3d'))return;const art=tile.querySelector('.subject-art'),i=Number((tile.className.match(/atlas-(\d)/)||[])[1]);if(!art||!ATLAS[i])return;
   const cv=document.createElement('canvas');cv.className='tile-3d';cv.setAttribute('aria-hidden','true');art.appendChild(cv);
   const col=(getComputedStyle(tile).getPropertyValue('--atlas-light')||'#d9bd8a').trim();
   const it=register(cv,(m)=>{try{return ATLAS[i](m,null,new m.Color(col))}catch{return null}},{host:tile,onReady:()=>art.classList.add('has-3d')});
   /* A4: clicking a tile first dives the camera into its object (420 ms), then the click goes through as usual; modifier clicks, reduced motion and paused effects skip the dive */
   tile.addEventListener('click',e=>{if(tile.__dived||e.ctrlKey||e.metaKey||e.shiftKey||e.altKey||e.button>0)return;if(!it.ready||paused()||(typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches))return;
    e.preventDefault();e.stopImmediatePropagation();tile.__dived=true;it.diveT0=performance.now();tile.classList.add('diving');it.dirty=true;kick();
    setTimeout(()=>{tile.classList.remove('diving');tile.click();setTimeout(()=>{tile.__dived=false;it.diveT0=0},150)},420)},true)})}
 function mountShelf(){
  document.querySelectorAll('.spotlight-card').forEach(card=>{
   if(card.querySelector('.shelf-3d'))return;const rec=(typeof records!=='undefined')&&records.find(r=>r.id===card.dataset.detail),cover=card.querySelector('.catalog-cover');if(!rec||!cover)return;
   const cv=document.createElement('canvas');cv.className='shelf-3d';cv.setAttribute('aria-hidden','true');card.appendChild(cv);
   const place=()=>{const cr=cover.getBoundingClientRect(),kr=card.getBoundingClientRect();cv.style.left=(cr.left-kr.left-cr.width*.12)+'px';cv.style.top=(cr.top-kr.top-cr.height*.08)+'px';cv.style.width=cr.width*1.24+'px';cv.style.height=cr.height*1.16+'px'};
   place();if(typeof ResizeObserver==='function')new ResizeObserver(place).observe(card);
   (document.fonts&&document.fonts.load?Promise.all([document.fonts.load('400 44px Fraunces'),document.fonts.load('400 24px Inter'),document.fonts.load('600 22px "IBM Plex Mono"')]).catch(()=>{}):Promise.resolve()).then(()=>
    register(cv,(m)=>{try{return bookScene(m,null,rec)}catch{return null}},{host:card,drag:true,check:true,onReady:()=>card.classList.add('has-3d')}))})}
 /* Record page: the animated cover can be swapped for a real, draggable 3D book (button on the cover). */
 function mountRecord(){
  const art=document.querySelector('#recordSheet .rv-art');if(!art||art.querySelector('.rv-3d-toggle'))return;
  const r=typeof window.recordCurrent==='function'?window.recordCurrent():null;if(!r)return;
  const btn=document.createElement('button');btn.type='button';btn.className='rv-3d-toggle';btn.setAttribute('aria-pressed','false');btn.textContent='3D';btn.title=typeof t==='function'?t('rv3d'):'3D';btn.setAttribute('aria-label',btn.title);
  art.appendChild(btn);let cv=null,rit=null;
  btn.addEventListener('click',e=>{e.stopPropagation();const on=btn.getAttribute('aria-pressed')!=='true';btn.setAttribute('aria-pressed',String(on));art.classList.toggle('has-3d',on);
   if(!on)document.dispatchEvent(new CustomEvent('bk:book-close'));
   if(on&&!cv){cv=document.createElement('canvas');cv.className='rec-3d';cv.setAttribute('aria-hidden','true');art.appendChild(cv);
    (document.fonts&&document.fonts.load?Promise.all([document.fonts.load('400 44px Fraunces'),document.fonts.load('400 24px Inter'),document.fonts.load('600 22px "IBM Plex Mono"')]).catch(()=>{}):Promise.resolve()).then(()=>
     {rit=register(cv,(m)=>{try{return bookScene(m,null,r,true)}catch{return null}},{host:art,drag:true,dbl:true,check:true,onReady:()=>{art.classList.add('rec-ready');mountBookCtl(art,()=>rit,r)}})})}})}
 /* G4: list view — hovering a row shows a small real 3D cover beside it. One canvas, one registered item; the scene is swapped per record (cached). */
 function mountListPeek(){
  const host=document.getElementById('cards');if(!host||mountListPeek.done||typeof records==='undefined')return;mountListPeek.done=true;
  const cv=document.createElement('canvas');cv.className='list-peek';cv.setAttribute('aria-hidden','true');cv.hidden=true;document.body.appendChild(cv);
  let it=null,cur=null,pending=null;
  const show=(row)=>{const el=row.querySelector('[data-detail]'),id=el&&el.dataset.detail;if(!id||id===cur)return;const rec=records.find(r=>r.id===id);if(!rec)return;
   const r=row.getBoundingClientRect(),w=148,h=206;cv.style.left=Math.max(8,Math.min(innerWidth-w-8,r.left+r.width*.66-w/2))+'px';/* over the quiet metadata columns, never over the title or the access links */cv.style.top=Math.max(72,Math.min(innerHeight-h-8,r.top+r.height/2-h/2))+'px';
   cur=id;cv.hidden=false;
   const apply=()=>{if(!it||!it.ready||cur!==id)return;let made;try{made=sceneFor(THREE,rec)}catch{return}
    it.scene=made.scene;it.camera=made.camera;it.api=made;it.hover=1;it.dirty=true;cv.classList.add('on');kick()};
   if(!it){it=register(cv,m=>{const dummy=m?{scene:new m.Scene(),camera:new m.PerspectiveCamera(30,1,.1,50),update(){}}:null;return dummy},{host:cv,onReady:()=>{pending=null;apply()}})}else apply()};
  const hide=()=>{cur=null;cv.hidden=true;cv.classList.remove('on')};
  host.addEventListener('pointerover',e=>{if(!host.classList.contains('list-view')||matchMedia('(pointer:coarse)').matches)return;const row=e.target.closest&&e.target.closest('.card,.ledger-row');if(row&&host.contains(row))show(row)});
  host.addEventListener('pointerleave',hide);addEventListener('scroll',hide,{passive:true});document.addEventListener('library:render',hide)}
 /* B5: reader controls for the record page's 3D book: open/close (a large reading stage), previous/next page, arrow keys, click on the page halves, Esc closes. */
 function mountBookCtl(art,getItem,rec){
  if(art.querySelector('.rv-book-ctl'))return;
  const T=typeof t==='function'?t:(q=>q);
  const ctl=document.createElement('div');ctl.className='rv-book-ctl';ctl.setAttribute('role','group');ctl.setAttribute('aria-label',T('bkReader'));
  ctl.innerHTML=`<button type="button" data-a="open" aria-pressed="false">${T('bkOpen')}</button><button type="button" data-a="prev" disabled aria-label="${T('bkPrev')}">‹</button><button type="button" data-a="next" disabled aria-label="${T('bkNext')}">›</button>`;
  const scrim=document.createElement('div');scrim.className='rv-book-scrim';art.appendChild(scrim);art.appendChild(ctl);
  const live=document.createElement('div');live.className='rv-book-live';live.setAttribute('role','status');live.setAttribute('aria-live','polite');live.setAttribute('aria-atomic','true');art.appendChild(live);
  const say=st=>{if(!st.open||!rec){live.textContent='';return}const L=st.leaf-1,R=st.leaf,n=st.leaves*2,parts=[];if(L>=0)parts.push(pageText(rec,L*2+1));if(R<st.leaves)parts.push(pageText(rec,R*2));live.textContent=T('bkReader')+' '+(st.leaf+1)+'/'+(st.leaves+1)+'. '+parts.join(' ')};
  const q=a=>ctl.querySelector(`[data-a=${a}]`),api=()=>{const it=getItem();return it&&it.api&&it.api.open?it.api:null},touch=()=>{const it=getItem();if(it){it.dirty=true;kick()}};
  const sync=()=>{const a=api();if(!a)return;const st=a.state(),on=st.open;art.classList.toggle('book-open',on);q('open').textContent=T(on?'bkClose':'bkOpen');q('open').setAttribute('aria-pressed',String(on));q('prev').disabled=!on||st.leaf<=0;q('next').disabled=!on||st.leaf>=st.leaves;say(st);const ae=document.activeElement;if(ae&&ae.disabled&&ctl.contains(ae))(on?(q('prev').disabled?q('open'):q('prev')):q('open')).focus()};
  const setOpen=on=>{const a=api();if(!a)return;a.open(on);touch();sync();if(on)q('next').focus();else q('open').focus()};
  const turn=d=>{const a=api();if(!a||!a.state().open)return;a.turn(d);touch();sync()};
  q('open').addEventListener('click',e=>{e.stopPropagation();setOpen(!art.classList.contains('book-open'))});
  q('prev').addEventListener('click',e=>{e.stopPropagation();turn(-1)});q('next').addEventListener('click',e=>{e.stopPropagation();turn(1)});
  scrim.addEventListener('click',e=>{e.stopPropagation();setOpen(false)});
  art.addEventListener('click',e=>{if(!art.classList.contains('book-open')||e.target.closest('.rv-book-ctl,.rv-3d-toggle,.rv-book-scrim'))return;const c=art.querySelector('.rec-3d');if(!c)return;const r=c.getBoundingClientRect();turn(e.clientX>r.left+r.width/2?1:-1)});
  document.addEventListener('keydown',e=>{if(!art.classList.contains('book-open')||!art.isConnected)return;if(e.key==='Escape'){e.preventDefault();setOpen(false);return}if(e.key==='ArrowRight'){e.preventDefault();turn(1)}else if(e.key==='ArrowLeft'){e.preventDefault();turn(-1)}});
  document.addEventListener('bk:book-close',()=>{if(art.classList.contains('book-open'))setOpen(false)});
  window.BKStage.book={state:()=>{const a=api();return a?a.state():null}}}
 function mountAll(){mountAtlas();mountShelf()}
 const start=()=>{mountAll();if(typeof MutationObserver==='function')for(const id of ['collectionGrid','spotlightGrid']){const el=document.getElementById(id);if(el)new MutationObserver(()=>{clearTimeout(start.t);start.t=setTimeout(mountAll,60)}).observe(el,{childList:true})}};
 const go=()=>{if(typeof requestIdleCallback==='function')requestIdleCallback(start,{timeout:1800});else setTimeout(start,400)};
 {const sh=document.getElementById('recordSheet');if(sh&&typeof MutationObserver==='function')new MutationObserver(()=>setTimeout(mountRecord,80)).observe(sh,{childList:true})}
 document.addEventListener('library:ready',()=>setTimeout(()=>{go();mountListPeek()},300));if(typeof records!=='undefined'&&records.length)setTimeout(go,300);
})();
