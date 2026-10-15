'use strict';
/* Stage — one shared three.js renderer that paints small live scenes into ordinary 2D canvases inside the page
   (bento field tiles, the 3D book shelf). Why not a fixed full-page canvas: DOM-scrolled canvases never lag behind the page,
   obey overflow/z-order, and keep text on top. A single WebGL context serves every tile.
   • Atlas tiles: 8 engraved-line scenes (atom, DNA, globe, open book, lattice, ringed planet, armillary, laurel medal).
   • Shelf: real 3D books (cover texture drawn from the record), tilt toward the pointer, drag to turn, click still opens the record.
   Falls back silently (the SVG engravings / CSS covers stay) without WebGL. Honors reduced-motion and the motion toggle. */
(()=>{
 if(typeof document==='undefined'||!document.getElementById('collectionGrid'))return;
 const root=document.documentElement,reduced=typeof matchMedia==='function'?matchMedia('(prefers-reduced-motion: reduce)'):{matches:false};
 const hasGL=()=>{try{const c=document.createElement('canvas');return!!(c.getContext('webgl2')||c.getContext('webgl'))}catch{return false}};
 if(!hasGL())return;
 let THREE=null,renderer=null,loading=null,items=[],raf=0,last=0;
 const paused=()=>root.classList.contains('effects-paused')||reduced.matches;
 const load=()=>loading||(loading=import('./vendor/three.module.min.js').then(m=>{THREE=m;renderer=new m.WebGLRenderer({alpha:true,antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(1);renderer.setClearColor(0x000000,0);renderer.setScissorTest(true);return m}).catch(()=>null));
 const io=typeof IntersectionObserver==='function'?new IntersectionObserver(es=>{for(const e of es){const it=e.target.__stage;if(it){it.visible=e.isIntersecting;it.dirty=true}}kick()},{rootMargin:'160px'}):null;

 function register(canvas,factory,opts={}){
  const it={canvas,factory,ctx:canvas.getContext('2d'),host:opts.host||canvas.parentElement,opts,visible:!io,dirty:true,hover:0,hoverT:0,px:0,py:0,t:Math.random()*8,scene:null,camera:null,api:null,drag:null,dragged:false,frame:0};
  canvas.__stage=it;items.push(it);if(io)io.observe(canvas);
  const h=it.host;
  h.addEventListener('pointerenter',()=>{it.hover=1;kick()});
  h.addEventListener('pointerleave',()=>{it.hover=0;it.px=0;it.py=0;it.dirty=true;kick()});
  h.addEventListener('pointermove',e=>{const r=canvas.getBoundingClientRect();it.px=((e.clientX-r.left)/Math.max(1,r.width)-.5)*2;it.py=((e.clientY-r.top)/Math.max(1,r.height)-.5)*2;if(it.drag){const dx=e.clientX-it.drag.x,dy=e.clientY-it.drag.y;if(Math.abs(dx)+Math.abs(dy)>5)it.dragged=true;if(it.api&&it.api.drag)it.api.drag(dx,dy);it.drag.x=e.clientX;it.drag.y=e.clientY}it.dirty=true;kick()},{passive:true});
  if(opts.drag){h.addEventListener('pointerdown',e=>{if(e.button>0)return;it.drag={x:e.clientX,y:e.clientY};it.dragged=false});
   addEventListener('pointerup',()=>{if(it.drag){it.drag=null;if(it.dragged)setTimeout(()=>{it.dragged=false},0)}});
   h.addEventListener('click',e=>{if(it.dragged){e.preventDefault();e.stopPropagation()}},true)}
  load().then(m=>{if(!m||!canvas.isConnected)return;const made=factory(m,it);if(!made)return;it.scene=made.scene;it.camera=made.camera;it.api=made;it.ready=true;it.dirty=true;canvas.classList.add('on');if(opts.onReady)opts.onReady();kick()});
  return it}

 function render(it,dt){
  const c=it.canvas,dpr=Math.min(devicePixelRatio||1,1.5),w=Math.max(2,Math.round(c.clientWidth*dpr)),h=Math.max(2,Math.round(c.clientHeight*dpr));
  if(c.width!==w||c.height!==h){c.width=w;c.height=h}
  const rc=renderer.domElement;if(rc.width<w||rc.height<h)renderer.setSize(Math.max(rc.width,w),Math.max(rc.height,h),false);
  it.hoverT+=(it.hover-it.hoverT)*Math.min(1,dt*7);it.t+=dt*(1+it.hoverT*1.6);
  it.camera.aspect=w/h;it.camera.updateProjectionMatrix();
  if(it.api.update)it.api.update(it.t,dt,it);
  renderer.setViewport(0,0,w,h);renderer.setScissor(0,0,w,h);renderer.clear();renderer.render(it.scene,it.camera);
  it.ctx.clearRect(0,0,w,h);it.ctx.drawImage(rc,0,rc.height-h,w,h,0,0,w,h);it.dirty=false}

 function tick(now){
  raf=0;const dt=Math.min(.05,(now-last)/1000||0);last=now;
  items=items.filter(i=>i.canvas.isConnected);let again=false;
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
  /* 7 Nobel archive — medal */
  (m,it,col)=>{const{scene,camera}=rig(m,32,5.1),g=new m.Group();scene.add(g);
   const gold=new m.MeshStandardMaterial({color:0xd9b46c,metalness:.92,roughness:.28});
   const disc=new m.Mesh(new m.CylinderGeometry(1.45,1.45,.16,72),gold);disc.rotation.x=Math.PI/2;g.add(disc);
   const rim=new m.Mesh(new m.TorusGeometry(1.4,.05,12,80),gold);g.add(rim);const rim2=new m.Mesh(new m.TorusGeometry(1.05,.025,10,80),gold);rim2.position.z=.09;g.add(rim2);
   const sh=new m.Shape();for(let i=0;i<10;i++){const a=i/10*Math.PI*2-Math.PI/2,r=i%2?.32:.78;i?sh.lineTo(Math.cos(a)*r,Math.sin(a)*r):sh.moveTo(Math.cos(a)*r,Math.sin(a)*r)}sh.closePath();
   const star=new m.Mesh(new m.ExtrudeGeometry(sh,{depth:.07,bevelEnabled:true,bevelSize:.02,bevelThickness:.02,bevelSegments:2}),gold);star.position.z=.08;g.add(star);
   scene.add(new m.AmbientLight(0xffffff,.55));const k=new m.PointLight(0xfff0d0,34,0,2);k.position.set(2.5,2,4);scene.add(k);const k2=new m.PointLight(0x9fc4ff,10,0,2);k2.position.set(-3,-1,3);scene.add(k2);
   return{scene,camera,update(t,dt,it){g.rotation.y=Math.sin(t*.6)*.6+it.px*.7*it.hoverT;g.rotation.x=.12+it.py*.3*it.hoverT;k.position.x=Math.cos(t*.9)*3.2}}}
 ];

 /* ---------- 3D book (shelf) ---------- */
 const COVER=['#2b5666','#386049','#355779','#5e4468','#386049','#355779','#5e4468','#6e563a'];
 function coverTexture(m,r,idx){
  const W=512,H=720,c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d'),base=COVER[idx%8];
  const g=x.createLinearGradient(0,0,W,H);g.addColorStop(0,base);g.addColorStop(1,'#101c26');x.fillStyle=g;x.fillRect(0,0,W,H);
  x.strokeStyle='rgba(232,206,158,.55)';x.lineWidth=2;x.strokeRect(26,26,W-52,H-52);
  x.fillStyle='rgba(232,206,158,.9)';x.font='600 22px "IBM Plex Mono",monospace';x.fillText(String(label(r.category)).replace(/^\d+ - /,'').toUpperCase().slice(0,30),48,76);
  x.fillRect(48,92,W-96,2);
  x.strokeStyle='rgba(232,206,158,.35)';x.lineWidth=1.5;for(let i=0;i<5;i++){x.beginPath();x.arc(W/2,250,36+i*26,0,Math.PI*2);x.stroke()}
  x.fillStyle='rgba(255,236,196,.95)';[[0,-1],[.9,.4],[-.8,.5],[.4,1.2],[-.3,-.3]].forEach(([a,b],i)=>{x.beginPath();x.arc(W/2+a*90,250+b*60,3+i%2*1.5,0,Math.PI*2);x.fill()});
  x.fillStyle='#f6efdc';x.font='400 44px Fraunces,Georgia,serif';
  const words=String(displayTitle(r)).split(/\s+/),lines=[];let cur='';for(const w of words){const t=(cur+' '+w).trim();if(x.measureText(t).width>W-100&&cur){lines.push(cur);cur=w}else cur=t}lines.push(cur);
  lines.slice(0,5).forEach((l,i)=>x.fillText(i===4&&lines.length>5?l+'…':l,48,420+i*54));
  x.fillStyle='rgba(246,239,220,.8)';x.font='400 24px Inter,sans-serif';x.fillText(String(r.author||'').slice(0,34),48,H-96);
  x.fillStyle='rgba(232,206,158,.8)';x.font='600 18px "IBM Plex Mono",monospace';x.fillText('BK · '+String(r.format||'').toUpperCase(),48,H-52);
  const t=new m.CanvasTexture(c);t.anisotropy=4;t.colorSpace=m.SRGBColorSpace;return t}
 function pagesTexture(m){const c=document.createElement('canvas');c.width=64;c.height=256;const x=c.getContext('2d');x.fillStyle='#efe6d0';x.fillRect(0,0,64,256);for(let i=0;i<256;i+=3){x.fillStyle=i%6?'rgba(120,100,70,.18)':'rgba(120,100,70,.32)';x.fillRect(0,i,64,1)}const t=new m.CanvasTexture(c);t.wrapS=t.wrapT=m.RepeatWrapping;t.colorSpace=m.SRGBColorSpace;return t}

 function backTexture(m,idx){const W=512,H=720,c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d'),g=x.createLinearGradient(0,0,W,H);g.addColorStop(0,COVER[idx%8]);g.addColorStop(1,'#101c26');x.fillStyle=g;x.fillRect(0,0,W,H);
  x.strokeStyle='rgba(232,206,158,.5)';x.lineWidth=2;x.strokeRect(26,26,W-52,H-52);x.fillStyle='rgba(232,206,158,.85)';x.font='600 64px Fraunces,Georgia,serif';x.textAlign='center';x.fillText('BK',W/2,H/2);x.font='600 16px "IBM Plex Mono",monospace';x.fillText('BİLİM KÜTÜPHANEM',W/2,H/2+44);
  x.fillStyle='rgba(246,239,220,.18)';for(let i=0;i<9;i++)x.fillRect(80,120+i*22,W-160-((i*53)%90),5);
  const t=new m.CanvasTexture(c);t.colorSpace=m.SRGBColorSpace;return t}
 function spineTexture(m,r,idx){const W=128,H=720,c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d');x.fillStyle=COVER[idx%8];x.fillRect(0,0,W,H);x.fillStyle='rgba(232,206,158,.7)';x.fillRect(0,40,W,2);x.fillRect(0,H-42,W,2);
  x.save();x.translate(W/2+10,H/2);x.rotate(Math.PI/2);x.fillStyle='#f6efdc';x.font='400 34px Fraunces,Georgia,serif';x.textAlign='center';let t=String(displayTitle(r));while(x.measureText(t).width>H-170&&t.length>6)t=t.slice(0,-2);x.fillText(t.length<String(displayTitle(r)).length?t+'…':t,0,0);x.restore();
  const tx=new m.CanvasTexture(c);tx.colorSpace=m.SRGBColorSpace;return tx}
 function bookScene(m,it,r){
  const{scene,camera}=rig(m,30,7.2),g=new m.Group();scene.add(g);const idx=(typeof recordArtIndex==='function')?recordArtIndex(r):0;
  const cover=new m.MeshStandardMaterial({map:coverTexture(m,r,idx),roughness:.55,metalness:.05}),pages=new m.MeshStandardMaterial({map:pagesTexture(m),roughness:.9,emissive:0x4a4234}),board=new m.MeshStandardMaterial({map:backTexture(m,idx),roughness:.6}),spine=new m.MeshStandardMaterial({map:spineTexture(m,r,idx),roughness:.6});
  const W=2.2,Hh=3.1,D=.52;
  const mesh=new m.Mesh(new m.BoxGeometry(W,Hh,D),[pages,spine,pages,pages,cover,board]);g.add(mesh);
  const shadow=new m.Mesh(new m.PlaneGeometry(3.4,1.1),new m.MeshBasicMaterial({map:(()=>{const c=document.createElement('canvas');c.width=128;c.height=64;const x=c.getContext('2d'),gr=x.createRadialGradient(64,32,0,64,32,60);gr.addColorStop(0,'rgba(0,0,0,.45)');gr.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=gr;x.fillRect(0,0,128,64);return new m.CanvasTexture(c)})(),transparent:true,depthWrite:false}));shadow.rotation.x=-Math.PI/2;shadow.position.y=-1.75;scene.add(shadow);
  scene.add(new m.AmbientLight(0xffffff,1.0));const key=new m.DirectionalLight(0xfff1d6,2.6);key.position.set(-3,4,5);scene.add(key);const rim=new m.DirectionalLight(0x9fc4ff,.9);rim.position.set(4,1,-3);scene.add(rim);
  let yaw=-.42,pitch=.08,vy=0,vx=0;
  return{scene,camera,drag(dx,dy){yaw+=dx*.012;pitch=Math.max(-.5,Math.min(.5,pitch+dy*.008));vy=dx*.012},
   update(t,dt,it){if(!it.drag){yaw+=vy;vy*=.93}const base=it.drag?0:-.42+Math.sin(t*.7)*.1;const target=it.drag?yaw:(Math.abs(vy)>1e-3?yaw:base+it.px*.55*it.hoverT);if(!it.drag&&Math.abs(vy)<=1e-3)yaw+=(target-yaw)*.12;g.rotation.y=yaw;g.rotation.x=pitch+it.py*.2*it.hoverT+Math.sin(t*.9)*.015;g.position.y=Math.sin(t*1.1)*.08+it.hoverT*.12;shadow.material.opacity=.9-it.hoverT*.2}}}

 /* ---------- mounting ---------- */
 function mountAtlas(){
  document.querySelectorAll('.atlas-tile').forEach(tile=>{
   if(tile.querySelector('.tile-3d'))return;const art=tile.querySelector('.subject-art'),i=Number((tile.className.match(/atlas-(\d)/)||[])[1]);if(!art||!ATLAS[i])return;
   const cv=document.createElement('canvas');cv.className='tile-3d';cv.setAttribute('aria-hidden','true');art.appendChild(cv);
   const col=(getComputedStyle(tile).getPropertyValue('--atlas-light')||'#d9bd8a').trim();
   register(cv,(m)=>{try{return ATLAS[i](m,null,new m.Color(col))}catch{return null}},{host:tile,onReady:()=>art.classList.add('has-3d')})})}
 function mountShelf(){
  document.querySelectorAll('.spotlight-card').forEach(card=>{
   if(card.querySelector('.shelf-3d'))return;const rec=(typeof records!=='undefined')&&records.find(r=>r.id===card.dataset.detail),cover=card.querySelector('.catalog-cover');if(!rec||!cover)return;
   const cv=document.createElement('canvas');cv.className='shelf-3d';cv.setAttribute('aria-hidden','true');card.appendChild(cv);
   const place=()=>{const cr=cover.getBoundingClientRect(),kr=card.getBoundingClientRect();cv.style.left=(cr.left-kr.left-cr.width*.12)+'px';cv.style.top=(cr.top-kr.top-cr.height*.08)+'px';cv.style.width=cr.width*1.24+'px';cv.style.height=cr.height*1.16+'px'};
   place();if(typeof ResizeObserver==='function')new ResizeObserver(place).observe(card);
   (document.fonts&&document.fonts.load?Promise.all([document.fonts.load('400 44px Fraunces'),document.fonts.load('400 24px Inter'),document.fonts.load('600 22px "IBM Plex Mono"')]).catch(()=>{}):Promise.resolve()).then(()=>
    register(cv,(m)=>{try{return bookScene(m,null,rec)}catch{return null}},{host:card,drag:true,onReady:()=>card.classList.add('has-3d')}))})}
 /* Record page: the animated cover can be swapped for a real, draggable 3D book (button on the cover). */
 function mountRecord(){
  const art=document.querySelector('#recordSheet .rv-art');if(!art||art.querySelector('.rv-3d-toggle'))return;
  const r=typeof window.recordCurrent==='function'?window.recordCurrent():null;if(!r)return;
  const btn=document.createElement('button');btn.type='button';btn.className='rv-3d-toggle';btn.setAttribute('aria-pressed','false');btn.textContent='3D';btn.title=typeof t==='function'?t('rv3d'):'3D';btn.setAttribute('aria-label',btn.title);
  art.appendChild(btn);let cv=null;
  btn.addEventListener('click',e=>{e.stopPropagation();const on=btn.getAttribute('aria-pressed')!=='true';btn.setAttribute('aria-pressed',String(on));art.classList.toggle('has-3d',on);
   if(on&&!cv){cv=document.createElement('canvas');cv.className='rec-3d';cv.setAttribute('aria-hidden','true');art.appendChild(cv);
    (document.fonts&&document.fonts.load?Promise.all([document.fonts.load('400 44px Fraunces'),document.fonts.load('400 24px Inter'),document.fonts.load('600 22px "IBM Plex Mono"')]).catch(()=>{}):Promise.resolve()).then(()=>
     register(cv,(m)=>{try{return bookScene(m,null,r)}catch{return null}},{host:art,drag:true,onReady:()=>art.classList.add('rec-ready')}))}})}
 function mountAll(){mountAtlas();mountShelf()}
 const start=()=>{mountAll();if(typeof MutationObserver==='function')for(const id of ['collectionGrid','spotlightGrid']){const el=document.getElementById(id);if(el)new MutationObserver(()=>{clearTimeout(start.t);start.t=setTimeout(mountAll,60)}).observe(el,{childList:true})}};
 const go=()=>{if(typeof requestIdleCallback==='function')requestIdleCallback(start,{timeout:1800});else setTimeout(start,400)};
 {const sh=document.getElementById('recordSheet');if(sh&&typeof MutationObserver==='function')new MutationObserver(()=>setTimeout(mountRecord,80)).observe(sh,{childList:true})}
 document.addEventListener('library:ready',()=>setTimeout(go,300));if(typeof records!=='undefined'&&records.length)setTimeout(go,300);
})();
