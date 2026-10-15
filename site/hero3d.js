'use strict';
/* Hero 3D · "Deep Field" — a three.js observatory scene layered under the 2D horizon (effects.js).
   Spiral galaxy with differential rotation, Bohr-style orbitals with travelling electrons, the data constellation
   (8 discovery fields, brightness = record count) with signal pulses, a DNA double helix, an interfering wave
   ribbon, a three-depth starfield and meteors. three.js is vendored (vendor/three.module.min.js): no runtime
   network. Falls back silently to the 2D scene when WebGL is missing; honours reduced-motion and the motion toggle. */
(()=>{
 const sceneEl=document.querySelector('.hero-scene'),root=document.documentElement;
 if(!sceneEl||typeof document.createElement!=='function')return;
 const reduced=typeof matchMedia==='function'?matchMedia('(prefers-reduced-motion: reduce)'):{matches:false};
 const hasGL=()=>{try{const c=document.createElement('canvas');return!!(c.getContext('webgl2')||c.getContext('webgl'))}catch{return false}};
 if(!hasGL())return;

 function boot(){import('./vendor/three.module.min.js').then(init).catch(()=>{})}
 const idle=cb=>typeof requestIdleCallback==='function'?requestIdleCallback(cb,{timeout:1500}):setTimeout(cb,250);
 if(document.readyState==='complete')idle(boot);else addEventListener('load',()=>idle(boot),{once:true});

 function init(THREE){
  const canvas=document.createElement('canvas');canvas.id='heroGL';canvas.setAttribute('aria-hidden','true');
  sceneEl.insertBefore(canvas,sceneEl.firstChild);
  let renderer;
  try{renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'high-performance'})}catch{canvas.remove();return}
  renderer.setClearColor(0x000000,0);
  const small=innerWidth<760,FOV=42,camZ=14,scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(FOV,2,.1,200);
  camera.position.set(0,0,camZ);

  /* seeded rng: the scene is identical on every visit */
  let seed=20261015;const rnd=()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296};
  const gauss=()=>{let u=0;for(let i=0;i<4;i++)u+=rnd();return(u-2)*1.7};
  const BRASS=new THREE.Color(0xe8ce9e),TEAL=new THREE.Color(0x7cc7b7),VIOLET=new THREE.Color(0xb9a7d6),ICE=new THREE.Color(0xcfe0ff),WARM=new THREE.Color(0xfff0cf);
  const uniforms={uTime:{value:0},uScale:{value:600}};

  /* ---------- shared point shaders ---------- */
  const vert=(rot)=>`attribute float aS;attribute vec3 aC;attribute float aT;${rot?'attribute float aR;attribute float aA;attribute float aY;':''}
   uniform float uTime,uScale;varying vec3 vC;varying float vA;
   void main(){${rot?`float ang=aA+uTime*.2/(.7+aR*.5);vec3 p=vec3(cos(ang)*aR,aY,sin(ang)*aR);`:'vec3 p=position;'}
    vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;
    float tw=.72+.28*sin(uTime*(.6+aT*2.4)+aT*60.);gl_PointSize=max(1.,aS*uScale/-mv.z*tw);vC=aC;vA=tw;}`;
  const frag=`varying vec3 vC;varying float vA;uniform float uGain;void main(){float d=length(gl_PointCoord-.5);float a=smoothstep(.5,0.,d);a*=a;gl_FragColor=vec4(vC*uGain,a*vA);}`;
  const pointMat=(rot,gain)=>new THREE.ShaderMaterial({vertexShader:vert(rot),fragmentShader:frag,uniforms:{...uniforms,uGain:{value:gain}},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending});
  const attr=(geo,name,arr,n)=>geo.setAttribute(name,new THREE.BufferAttribute(arr,n));

  /* ---------- starfield: three depths ---------- */
  const starCount=small?900:2400,sp=new Float32Array(starCount*3),ss=new Float32Array(starCount),sc=new Float32Array(starCount*3),st=new Float32Array(starCount);
  for(let i=0;i<starCount;i++){const layer=i%3,z=-8-layer*14-rnd()*10;sp[i*3]=(rnd()-.5)*(70+layer*20);sp[i*3+1]=(rnd()-.5)*(44+layer*10);sp[i*3+2]=z;ss[i]=.03+rnd()*(layer===0?.09:.06);
   const c=rnd()<.12?VIOLET:rnd()<.3?BRASS:ICE;sc[i*3]=c.r;sc[i*3+1]=c.g;sc[i*3+2]=c.b;st[i]=rnd()}
  const starGeo=new THREE.BufferGeometry();attr(starGeo,'position',sp,3);attr(starGeo,'aS',ss,1);attr(starGeo,'aC',sc,3);attr(starGeo,'aT',st,1);
  scene.add(new THREE.Points(starGeo,pointMat(false,.9)));

  /* ---------- rig: galaxy + atom ---------- */
  const rig=new THREE.Group(),tilt=new THREE.Group();rig.add(tilt);scene.add(rig);
  const GN=small?11000:30000,gR=new Float32Array(GN),gA=new Float32Array(GN),gY=new Float32Array(GN),gS=new Float32Array(GN),gC=new Float32Array(GN*3),gT=new Float32Array(GN);
  const ARMS=3,RMAX=5.4,tmp=new THREE.Color();
  for(let i=0;i<GN;i++){const core=i<GN*.16;let r,a;
   if(core){r=Math.pow(rnd(),1.7)*1.5;a=rnd()*Math.PI*2}
   else{r=.6+Math.pow(rnd(),.72)*(RMAX-.6);const arm=(i%ARMS)*(Math.PI*2/ARMS);a=arm+r*1.05+gauss()*(.1+.05*r)}
   gR[i]=r;gA[i]=a;gY[i]=gauss()*(core?.28:.1)*(1-r/(RMAX*1.15));gS[i]=(core?.03:.022)+rnd()*.05*(rnd()<.04?3:1);gT[i]=rnd();
   const k=r/RMAX;tmp.copy(WARM).lerp(BRASS,Math.min(1,k*1.6));if(k>.28)tmp.lerp(TEAL,Math.min(1,(k-.28)*1.5));if(k>.62)tmp.lerp(VIOLET,Math.min(1,(k-.62)*2.2));if(rnd()<.05)tmp.lerp(ICE,.7);
   gC[i*3]=tmp.r*.9;gC[i*3+1]=tmp.g*.9;gC[i*3+2]=tmp.b*.9}
  const galGeo=new THREE.BufferGeometry();attr(galGeo,'position',new Float32Array(GN*3),3);attr(galGeo,'aR',gR,1);attr(galGeo,'aA',gA,1);attr(galGeo,'aY',gY,1);attr(galGeo,'aS',gS,1);attr(galGeo,'aC',gC,3);attr(galGeo,'aT',gT,1);
  galGeo.boundingSphere=new THREE.Sphere(new THREE.Vector3(),RMAX*2);
  const galaxy=new THREE.Points(galGeo,pointMat(true,.85));tilt.add(galaxy);
  tilt.rotation.x=-1.12;tilt.rotation.z=.32;
  /* soft core glow */
  const glowTex=(()=>{const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d'),r=g.createRadialGradient(64,64,0,64,64,64);r.addColorStop(0,'rgba(255,236,196,.95)');r.addColorStop(.25,'rgba(232,206,158,.35)');r.addColorStop(1,'rgba(232,206,158,0)');g.fillStyle=r;g.fillRect(0,0,128,128);return new THREE.CanvasTexture(c)})();
  const glow=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,opacity:.55}));glow.scale.set(5,5,1);rig.add(glow);
  /* Bohr orbitals */
  const orbitals=[];
  [[1.7,.42,0],[2.5,.5,Math.PI/3],[3.4,.58,-Math.PI/3]].forEach(([rad,ecc,rot],i)=>{
   const pts=[];for(let k=0;k<=128;k++){const a=k/128*Math.PI*2;pts.push(new THREE.Vector3(Math.cos(a)*rad,Math.sin(a)*rad*ecc,0))}
   const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:i===1?TEAL:BRASS,transparent:true,opacity:.5,blending:THREE.AdditiveBlending,depthWrite:false}));
   const g=new THREE.Group();g.rotation.set(1.0+i*.45,0,rot);g.add(line);rig.add(g);orbitals.push({g,rad,ecc,speed:1.1+i*.55,phase:i*2.1})});
  /* electrons live in each orbital's group so they inherit its plane */
  const eMarks=orbitals.map((o,i)=>{const m=new THREE.Points(new THREE.BufferGeometry(),pointMat(false,1.3));attr(m.geometry,'position',new Float32Array(3),3);attr(m.geometry,'aS',new Float32Array([.4]),1);attr(m.geometry,'aC',new Float32Array([1,.94,.78]),3);attr(m.geometry,'aT',new Float32Array([.3+i*.2]),1);m.frustumCulled=false;o.g.add(m);return m});

  /* ---------- data constellation ---------- */
  const cons=new THREE.Group();scene.add(cons);
  const hash=(i,s)=>{let x=Math.imul(i^s,2654435761)>>>0;x^=x>>>13;x=Math.imul(x,1597334677)>>>0;return((x>>>8)&0xffffff)/16777216};
  let nodes=[],nodeGeo=null,lineObj=null,pulseGeo=null,reticle=null;
  function buildConstellation(){
   if(nodeGeo){cons.clear();nodeGeo.dispose()}
   let counts=[];try{const groups=DISCOVERY,stat=(catalog&&catalog.stats)||{};counts=groups.map(d=>d.nobel?Number(stat.nobelDocuments)||0:records.filter(r=>r.collection==='books'&&(d.categories||[]).includes(r.category)).length)}catch{}
   if(!counts.length)counts=[9,7,8,6,5,6,4,8];const top=Math.max(1,...counts),n=counts.length;
   nodes=counts.map((c,i)=>{const angle=-Math.PI*.94+i*(Math.PI*1.88/Math.max(1,n-1)),rad=.36+.54*hash(i,88);return{x:Math.cos(angle)*rad,y:Math.sin(angle)*rad*1.42,z:(hash(i,19)-.5)*1.2,b:.3+.7*c/top}});
   const pos=new Float32Array(n*3),sz=new Float32Array(n),col=new Float32Array(n*3),tw=new Float32Array(n);
   nodes.forEach((o,i)=>{sz[i]=.34+.5*o.b;const c=i%3===1?TEAL:WARM;col[i*3]=c.r;col[i*3+1]=c.g;col[i*3+2]=c.b;tw[i]=hash(i,5)});
   nodeGeo=new THREE.BufferGeometry();attr(nodeGeo,'position',pos,3);attr(nodeGeo,'aS',sz,1);attr(nodeGeo,'aC',col,3);attr(nodeGeo,'aT',tw,1);
   const np=new THREE.Points(nodeGeo,pointMat(false,1.1));np.frustumCulled=false;cons.add(np);
   const lg=new THREE.BufferGeometry();lg.setAttribute('position',new THREE.BufferAttribute(new Float32Array(n*3),3));
   lineObj=new THREE.Line(lg,new THREE.LineBasicMaterial({color:BRASS,transparent:true,opacity:.4,blending:THREE.AdditiveBlending,depthWrite:false}));lineObj.frustumCulled=false;cons.add(lineObj);
   pulseGeo=new THREE.BufferGeometry();attr(pulseGeo,'position',new Float32Array((n-1)*3*2),3);attr(pulseGeo,'aS',new Float32Array((n-1)*2).fill(.1),1);attr(pulseGeo,'aC',(()=>{const a=new Float32Array((n-1)*2*3);for(let i=0;i<a.length;i+=3){a[i]=1;a[i+1]=.95;a[i+2]=.8}return a})(),3);attr(pulseGeo,'aT',new Float32Array((n-1)*2).map((_,i)=>hash(i,31)),1);
   const pp=new THREE.Points(pulseGeo,pointMat(false,1.3));pp.frustumCulled=false;cons.add(pp);
   let peak=0;nodes.forEach((o,i)=>{if(o.b>nodes[peak].b)peak=i});
   const rp=[];for(let k=0;k<=64;k++){const a=k/64*Math.PI*2;rp.push(new THREE.Vector3(Math.cos(a),Math.sin(a),0))}
   reticle=new THREE.Line(new THREE.BufferGeometry().setFromPoints(rp),new THREE.LineBasicMaterial({color:WARM,transparent:true,opacity:.5,blending:THREE.AdditiveBlending,depthWrite:false}));reticle.userData.peak=peak;cons.add(reticle);
   layout();
  }

  /* ---------- DNA helix ---------- */
  const HN=small?0:120,helix=new THREE.Group();scene.add(helix);let hGeo=null,rungs=null;
  if(HN){const pos=new Float32Array(HN*2*3),sz=new Float32Array(HN*2).fill(.16),col=new Float32Array(HN*2*3),tw=new Float32Array(HN*2).map((_,i)=>hash(i,77));
   for(let i=0;i<HN*2;i++){const c=i%2?TEAL:BRASS;col[i*3]=c.r;col[i*3+1]=c.g;col[i*3+2]=c.b}
   hGeo=new THREE.BufferGeometry();attr(hGeo,'position',pos,3);attr(hGeo,'aS',sz,1);attr(hGeo,'aC',col,3);attr(hGeo,'aT',tw,1);
   const hp=new THREE.Points(hGeo,pointMat(false,.9));hp.frustumCulled=false;helix.add(hp);
   const rg=new THREE.BufferGeometry();rg.setAttribute('position',new THREE.BufferAttribute(new Float32Array(HN/2*2*3),3));
   rungs=new THREE.LineSegments(rg,new THREE.LineBasicMaterial({color:ICE,transparent:true,opacity:.16,blending:THREE.AdditiveBlending,depthWrite:false}));rungs.frustumCulled=false;helix.add(rungs)}

  /* ---------- interfering wave ribbon ---------- */
  const WN=360,waves=[0,1].map(k=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(WN*3),3));const l=new THREE.Line(g,new THREE.LineBasicMaterial({color:k?TEAL:BRASS,transparent:true,opacity:k?.34:.45,blending:THREE.AdditiveBlending,depthWrite:false}));l.frustumCulled=false;scene.add(l);return l});

  /* ---------- meteors ---------- */
  const meteors=[0,1].map(()=>{const g=new THREE.BufferGeometry(),n=22;g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(n*3),3));g.setAttribute('color',new THREE.BufferAttribute(new Float32Array(n*3),3));
   const l=new THREE.Line(g,new THREE.LineBasicMaterial({vertexColors:true,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false}));l.visible=false;l.frustumCulled=false;scene.add(l);return{l,t:0,life:1.4,x:0,y:0,vx:0,vy:0,next:3+rnd()*5}});

  /* ---------- layout ---------- */
  let W=24,H=11,portrait=false;
  function layout(){
   const w=sceneEl.clientWidth||innerWidth,h=sceneEl.clientHeight||innerHeight;
   renderer.setPixelRatio(Math.min(devicePixelRatio||1,quality));renderer.setSize(w,h,false);
   camera.aspect=w/h;camera.updateProjectionMatrix();
   H=2*camZ*Math.tan(FOV*Math.PI/360);W=H*camera.aspect;portrait=camera.aspect<1.05;
   uniforms.uScale.value=renderer.domElement.height/(2*Math.tan(FOV*Math.PI/360));
   const cx=portrait?0:(.66-.5)*W,cy=portrait?H*.2:(.5-.36)*H,sc=portrait?.62:Math.min(1.15,W/24);
   rig.position.set(cx,cy,-1);rig.scale.setScalar(sc);
   const R=Math.min(W*.27,H*.32)*(portrait?.8:1);cons.position.set(portrait?0:(.66-.5)*W,portrait?H*.2:(.5-.33)*H,.6);cons.scale.set(R,R,R);
   helix.position.set(W*.44,H*.2,-3);helix.visible=!portrait&&!!HN;
   if(reticle&&nodes.length){const o=nodes[reticle.userData.peak];reticle.position.set(o.x,o.y,o.z);reticle.scale.setScalar(.14)}
  }

  /* ---------- loop ---------- */
  let quality=1.75,running=true,visible=true,tPrev=0,time=0,px=0,py=0,tx=0,ty=0,frames=0,acc=0,degraded=false;
  const paused=()=>root.classList.contains('effects-paused');
  function update(dt){
   time+=dt;uniforms.uTime.value=time;
   tx+=(px-tx)*Math.min(1,dt*2.4);ty+=(py-ty)*Math.min(1,dt*2.4);
   camera.position.set(tx*.9,-ty*.5,camZ);camera.lookAt(0,0,0);
   rig.rotation.y=Math.sin(time*.07)*.18+tx*.08;
   orbitals.forEach((o,i)=>{const a=time*o.speed+o.phase,m=eMarks[i].geometry.attributes.position;m.setXYZ(0,Math.cos(a)*o.rad,Math.sin(a)*o.rad*o.ecc,0);m.needsUpdate=true;o.g.rotation.z+=dt*.05*(i%2?-1:1)});
   glow.material.opacity=.5+.08*Math.sin(time*.9);
   if(nodes.length&&nodeGeo){const np=nodeGeo.attributes.position,lp=lineObj.geometry.attributes.position;
    nodes.forEach((o,i)=>{const dz=Math.sin(time*.5+i*1.7)*.04;np.setXYZ(i,o.x,o.y,o.z+dz);lp.setXYZ(i,o.x,o.y,o.z+dz)});np.needsUpdate=true;lp.needsUpdate=true;
    const pp=pulseGeo.attributes.position;for(let i=0;i<nodes.length-1;i++){for(let k=0;k<2;k++){const f=(time*.18+i*.37+k*.5)%1,a=nodes[i],b=nodes[i+1],j=i*2+k;pp.setXYZ(j,a.x+(b.x-a.x)*f,a.y+(b.y-a.y)*f,a.z+(b.z-a.z)*f)}}pp.needsUpdate=true;
    if(reticle){const o=nodes[reticle.userData.peak],s=.13+.025*Math.sin(time*1.4);reticle.position.set(o.x,o.y,o.z);reticle.scale.setScalar(s);reticle.rotation.z=time*.4}}
   if(hGeo){const hp=hGeo.attributes.position,L=H*.5,rr=.55;for(let i=0;i<HN;i++){const t=i/(HN-1),y=(t-.5)*L,a=t*Math.PI*6+time*.9;hp.setXYZ(i*2,Math.cos(a)*rr,y,Math.sin(a)*rr);hp.setXYZ(i*2+1,Math.cos(a+Math.PI)*rr,y,Math.sin(a+Math.PI)*rr)}hp.needsUpdate=true;
    const rp=rungs.geometry.attributes.position;for(let r=0;r<HN/2;r++){const i=r*2;rp.setXYZ(r*2,hp.getX(i*2),hp.getY(i*2),hp.getZ(i*2));rp.setXYZ(r*2+1,hp.getX(i*2+1),hp.getY(i*2+1),hp.getZ(i*2+1))}rp.needsUpdate=true;helix.rotation.z=.18}
   waves.forEach((w,k)=>{const p=w.geometry.attributes.position,y0=-H*.2-k*.12;for(let i=0;i<WN;i++){const u=i/(WN-1),x=(u-.5)*W*1.1,env=Math.sin(u*Math.PI),y=y0+env*(.34*Math.sin(u*9+time*(.8+k*.3))+.22*Math.sin(u*23-time*1.3+k*2)+.14*Math.sin(u*41+time*.6));p.setXYZ(i,x,y,-2)}p.needsUpdate=true});
   meteors.forEach(m=>{m.next-=dt;if(!m.l.visible&&m.next<=0){m.l.visible=true;m.t=0;m.life=1.1+rnd()*.7;m.x=(rnd()-.2)*W*.7;m.y=H*.5-rnd()*H*.25;const a=-.45-rnd()*.3;m.vx=Math.cos(a)*(W*.5);m.vy=Math.sin(a)*(W*.5);m.next=6+rnd()*8}
    if(m.l.visible){m.t+=dt;const k=m.t/m.life,pos=m.l.geometry.attributes.position,col=m.l.geometry.attributes.color,n=pos.count,hx=m.x+m.vx*m.t*.5,hy=m.y+m.vy*m.t*.5;
     for(let i=0;i<n;i++){const f=i/(n-1);pos.setXYZ(i,hx-m.vx*.09*f*(1-k*.4),hy-m.vy*.09*f*(1-k*.4),-4);const b=(1-f)*(1-k)*.95;col.setXYZ(i,b,b*.93,b*.78)}pos.needsUpdate=true;col.needsUpdate=true;if(k>=1)m.l.visible=false}});
  }
  function frame(now){
   if(!running)return;requestAnimationFrame(frame);
   const dt=Math.min(.05,(now-tPrev)/1000||0);tPrev=now;
   if(!visible||document.hidden||paused()||reduced.matches)return;
   update(dt);renderer.render(scene,camera);
   /* quality governor: drop resolution if the first second is slow */
   if(!degraded&&++frames<=90){acc+=dt;if(frames===90&&acc/90>.024){degraded=true;quality=1;galGeo.setDrawRange(0,Math.floor(GN*.6));layout()}}
  }
  function still(){update(0.001);time=3.2;update(0);renderer.render(scene,camera)}

  /* ---------- wiring ---------- */
  layout();buildConstellation();
  sceneEl.classList.add('hero-gl');canvas.classList.add('on');
  still();requestAnimationFrame(t=>{tPrev=t;requestAnimationFrame(frame)});
  if(typeof ResizeObserver==='function')new ResizeObserver(()=>{layout();if(reduced.matches||paused())still()}).observe(sceneEl);else addEventListener('resize',()=>layout());
  if(typeof IntersectionObserver==='function')new IntersectionObserver(es=>{visible=es[0].isIntersecting}).observe(sceneEl);
  addEventListener('pointermove',e=>{const r=sceneEl.getBoundingClientRect();if(r.bottom<0||r.top>innerHeight)return;px=(e.clientX/innerWidth-.5)*2;py=(e.clientY/innerHeight-.5)*2},{passive:true});
  if(typeof MutationObserver==='function')new MutationObserver(()=>{if(reduced.matches||paused())still()}).observe(root,{attributes:true,attributeFilter:['class']});
  if(reduced.addEventListener)reduced.addEventListener('change',()=>{if(reduced.matches)still()});
  document.addEventListener('library:ready',buildConstellation);
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();running=false;sceneEl.classList.remove('hero-gl');canvas.remove()});
 }
})();
