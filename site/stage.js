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
 const load=()=>loading||(loading=import('./vendor/three.module.min.js').then(m=>{THREE=m;renderer=new m.WebGLRenderer({alpha:true,antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(1);renderer.shadowMap.enabled=true;renderer.shadowMap.type=m.PCFSoftShadowMap;renderer.setClearColor(0x000000,0);renderer.setScissorTest(true);return m}).catch(()=>null));
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
   const faceMaskOf=k=>canvasTex(m,512,512,(x,W,H)=>{x.fillStyle='#000';x.fillRect(0,0,W,H);x.translate(W/2,H/2);x.strokeStyle='#fff';x.fillStyle='#fff';x.lineWidth=7;x.beginPath();x.arc(0,0,236,0,7);x.stroke();x.lineWidth=2.5;x.beginPath();x.arc(0,0,218,0,7);x.stroke();x.beginPath();x.arc(0,0,150,0,7);x.stroke();
    for(let s2=-1;s2<=1;s2+=2){for(let i=0;i<13;i++){const a=Math.PI*.58+i*.17,rr=190;x.save();x.scale(s2,1);x.rotate(a);x.translate(rr,0);x.rotate(.9);x.beginPath();x.ellipse(0,0,26,9,0,0,7);x.fill();x.restore()}}
    emblem(x,k);arcText(x,k<6?'· NOBEL · '+CATS[k]+' · 1901 – 2026 ·':'· BİLİM KÜTÜPHANEM ·',188,30)},false);
   const faceCol=canvasTex(m,512,512,(x,W,H)=>{const gr=x.createRadialGradient(W*.4,H*.35,20,W/2,H/2,W*.62);gr.addColorStop(0,'#f6e3ad');gr.addColorStop(.55,'#d9b46c');gr.addColorStop(1,'#a67c34');x.fillStyle=gr;x.fillRect(0,0,W,H)},true);
   const faceOf=k=>{const mk=faceMaskOf(k),rf=canvasTex(m,512,512,(x,W,H)=>{x.fillStyle='#8a8a8a';x.fillRect(0,0,W,H);x.drawImage(mk.image,0,0);x.globalCompositeOperation='multiply';x.fillStyle='#cfcfcf';x.fillRect(0,0,W,H)},false);
    return new m.MeshPhysicalMaterial({map:faceCol,bumpMap:mk,bumpScale:5.5,metalness:.9,roughness:.34,roughnessMap:rf,clearcoat:.5,clearcoatRoughness:.12,iridescence:.35,iridescenceIOR:1.35,iridescenceThicknessRange:[180,420],envMapIntensity:2.2})};
   const edge=new m.MeshPhysicalMaterial({color:0xe3c17a,metalness:.95,roughness:.24,iridescence:.25,iridescenceIOR:1.3,iridescenceThicknessRange:[150,380],envMapIntensity:2.0});
   const disc=new m.Mesh(new m.CylinderGeometry(1.45,1.45,.16,96),[edge,edge,edge]);disc.rotation.x=Math.PI/2;g.add(disc);
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
   return{scene,camera,face(i){faces[cur].visible=false;cur=((i%faces.length)+faces.length)%faces.length;faces[cur].visible=true},update(t,dt,it){hold+=dt;if(flipT<0&&hold>5.5&&!paused()){flipT=0}
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

 window.BKStage={paintCover,coverTexture,spineTexture}; /* test hook for tools/text_fit_audit.py */

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
 /* B1: edge wear (worn tan speckle along the edges / corners; `rough` mode paints rougher, i.e. lighter, pixels) and a fingerprint smudge as clearcoat normal */
 function wearEdges(x,W,H,seed,mode){let s=seed|0;const rnd=()=>{s=(s*1664525+1013904223)|0;return((s>>>8)&0xffff)/65536};
  x.save();for(let i=0;i<1100;i++){const side=(rnd()*4)|0,t=rnd(),d=Math.pow(rnd(),3.4)*20;let px,py;
   if(side===0){px=t*W;py=d}else if(side===1){px=t*W;py=H-d}else if(side===2){px=d;py=t*H}else{px=W-d;py=t*H}
   const corner=Math.min(Math.min(px,W-px),Math.min(py,H-py));const k=1-Math.min(1,corner/46)*.6,r=.5+rnd()*1.7;
   x.fillStyle=mode==='rough'?`rgba(255,255,255,${(.25+.4*rnd())*k})`:`rgba(${216+rnd()*24|0},${196+rnd()*22|0},${150+rnd()*30|0},${(.06+.16*rnd())*k})`;x.beginPath();x.arc(px,py,r,0,7);x.fill()}x.restore()}
 function smudgeNormal(m,seed){const N=256,c=document.createElement('canvas');c.width=c.height=N;const x=c.getContext('2d');x.fillStyle='#000';x.fillRect(0,0,N,N);
  let s=seed|0;const rnd=()=>{s=(s*1664525+1013904223)|0;return((s>>>8)&0xffff)/65536};
  x.strokeStyle='#fff';for(let f=0;f<3;f++){const cx=rnd()*N,cy=rnd()*N,rx=22+rnd()*26,ry=rx*(1.25+rnd()*.35),rot=rnd()*3.14;x.save();x.translate(cx,cy);x.rotate(rot);x.globalAlpha=.55;x.lineWidth=1.5;for(let r=3;r<1;r++);for(let k=2;k<rx;k+=3.2){x.beginPath();x.ellipse(0,0,k,k*ry/rx,0,0,6.283);x.stroke()}x.restore()}
  const src=x.getImageData(0,0,N,N).data,out=x.createImageData(N,N),h=(i,j)=>src[(((j+N)%N)*N+((i+N)%N))*4]/255;
  for(let j=0;j<N;j++)for(let i=0;i<N;i++){const dx=(h(i+1,j)-h(i-1,j))*2.2,dy=(h(i,j+1)-h(i,j-1))*2.2,l=Math.hypot(dx,dy,1),o=(j*N+i)*4;out.data[o]=(-dx/l*.5+.5)*255;out.data[o+1]=(dy/l*.5+.5)*255;out.data[o+2]=(1/l*.5+.5)*255;out.data[o+3]=255}
  x.putImageData(out,0,0);const t=new m.CanvasTexture(c);t.wrapS=t.wrapT=m.RepeatWrapping;return t}
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
  const rg=new m.PlaneGeometry(.07,1.05,1,14),RN=6,RL=1.05/RN,AX=xL+.55,AY=-Hh/2+.145,AZ=.02,chain=[];for(let i=0;i<=RN;i++)chain.push({x:AX,y:AY-i*RL,z:AZ,px:AX,py:AY-i*RL,pz:AZ});
  const rpos=rg.attributes.position,rrow=new Float32Array(rpos.count),rside=new Float32Array(rpos.count);for(let i=0;i<rpos.count;i++){rrow[i]=(.525-rpos.getY(i))/1.05*RN;rside[i]=rpos.getX(i)}
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
   for(let i=0;i<rpos.count;i++){const f=Math.min(RN-1e-4,rrow[i]),k=Math.floor(f),u=f-k,a=chain[k],b=chain[k+1];rpos.setXYZ(i,a.x+(b.x-a.x)*u+rside[i],a.y+(b.y-a.y)*u,a.z+(b.z-a.z)*u)}
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
  let yaw=BASE,pitch=.08,vy=0,mode='auto',snapYaw=BASE,idle=0,open=0,zoom=1;const dark=()=>root.dataset.theme!=='light';
  return{scene,camera,
   drag(dx,dy){mode='drag';yaw+=dx*.012;pitch=Math.max(-.5,Math.min(.5,pitch+dy*.008));vy=dx*.012},
   release(){if(mode!=='drag')return;const k=Math.round((yaw+vy*10-BASE)/QP);snapYaw=BASE+k*QP;vy=0;mode='snap';idle=0},
   dbl(){if(mode==='read'){mode='auto';yaw=wrap(yaw,BASE)}else{mode='read';yaw=wrap(yaw,-.12)}},
   update(t,dt,it){const hov=it.hoverT,k7=Math.min(1,dt*7);
    if(it.drag){mode='drag'}
    if(mode==='drag'){/* yaw driven by drag() */}
    else if(mode==='snap'){yaw+=(snapYaw+it.px*.12*hov-yaw)*k7;pitch+=(.08-pitch)*k7;if(hov<.02){idle+=dt;if(idle>2.2){mode='auto';yaw=wrap(yaw,BASE)}}else idle=0}
    else if(mode==='read'){yaw+=(-.12-yaw)*k7;pitch+=(.04-pitch)*k7}
    else{yaw+=((BASE+Math.sin(t*.7)*.1)+it.px*.55*hov-yaw)*.12}
    const calm=mode==='read'?0:1,openT=mode==='read'||mode==='drag'?0:hov*.21;open+=(openT-open)*k7;zoom+=((mode==="read"?1.06:1)-zoom)*k7;
    hinge.rotation.y=-open;g.scale.setScalar(zoom);
    g.rotation.y=yaw;g.rotation.x=pitch+(mode==='auto'?it.py*.2*hov:0)+Math.sin(t*.9)*.015*calm;g.position.y=Math.sin(t*1.1)*.08*calm+hov*.12*calm;g.position.z=hov*.3*calm;
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
  const up0=made.update;made.update=(t,dt,it2)=>{if(up0)up0(t,dt,it2);made.camera.position.x=it2.px*.45*it2.hoverT;made.camera.position.y=-it2.py*.28*it2.hoverT;made.camera.lookAt(0,0,0)};
  return made}});

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
     register(cv,(m)=>{try{return bookScene(m,null,r,true)}catch{return null}},{host:art,drag:true,dbl:true,onReady:()=>art.classList.add('rec-ready')}))}})}
 function mountAll(){mountAtlas();mountShelf()}
 const start=()=>{mountAll();if(typeof MutationObserver==='function')for(const id of ['collectionGrid','spotlightGrid']){const el=document.getElementById(id);if(el)new MutationObserver(()=>{clearTimeout(start.t);start.t=setTimeout(mountAll,60)}).observe(el,{childList:true})}};
 const go=()=>{if(typeof requestIdleCallback==='function')requestIdleCallback(start,{timeout:1800});else setTimeout(start,400)};
 {const sh=document.getElementById('recordSheet');if(sh&&typeof MutationObserver==='function')new MutationObserver(()=>setTimeout(mountRecord,80)).observe(sh,{childList:true})}
 document.addEventListener('library:ready',()=>setTimeout(go,300));if(typeof records!=='undefined'&&records.length)setTimeout(go,300);
})();
