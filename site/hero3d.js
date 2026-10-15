'use strict';
/* Hero 3D · "Record Galaxy" — every one of the catalog's records is a real star.
   • 8 spiral arms = the 8 discovery fields; colour = field (same spine palette as the cards).
   • Hover a star → its title/author; click → opens that record. Hover/focus a field label → its arm lights up, the rest dims;
     click → filters the catalog to that field.
   • Drag to orbit (inertia), pointer parallax, differential rotation, dust lanes, HII knots, bulge, meteors.
   • Dark = luminous additive sky; light = ink-on-parchment star atlas (same data, different rendering).
   three.js is vendored (vendor/three.module.min.js): no runtime network. 2D fallback in effects.js without WebGL. */
(()=>{
 const sceneEl=document.querySelector('.hero-scene'),root=document.documentElement;
 if(!sceneEl||typeof document.createElement!=='function')return;
 const hero=sceneEl.closest?sceneEl.closest('.hero'):sceneEl.parentElement;
 const reduced=typeof matchMedia==='function'?matchMedia('(prefers-reduced-motion: reduce)'):{matches:false};
 const hasGL=()=>{try{const c=document.createElement('canvas');return!!(c.getContext('webgl2')||c.getContext('webgl'))}catch{return false}};
 if(!hasGL())return;
 const idle=cb=>typeof requestIdleCallback==='function'?requestIdleCallback(cb,{timeout:1500}):setTimeout(cb,250);
 const boot=()=>import('./vendor/three.module.min.js').then(init).catch(()=>{});
 if(document.readyState==='complete')idle(boot);else addEventListener('load',()=>idle(boot),{once:true});

 function init(THREE){
  const canvas=document.createElement('canvas');canvas.id='heroGL';canvas.setAttribute('aria-hidden','true');
  sceneEl.insertBefore(canvas,sceneEl.firstChild);
  let renderer;
  try{renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'high-performance'})}catch{canvas.remove();return}
  renderer.setClearColor(0x000000,0);
  const small=innerWidth<760,FOV=42,camZ=14,scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(FOV,2,.1,200);
  camera.position.set(0,0,camZ);

  let seed=20261015;const rnd=()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296};
  const gauss=()=>{let u=0;for(let i=0;i<4;i++)u+=rnd();return(u-2)*1.7};
  const hex=h=>new THREE.Color(h);
  /* one colour per discovery field — mirrors the card "spines" */
  const FIELD=['#7CC7B7','#8FBF8A','#D69A6B','#B9A7D6','#7FA8D8','#8FA8A0','#D8A05A','#E8CE9E'].map(hex);
  const WARM=hex('#fff0cf'),BRASS=hex('#e8ce9e'),VIOLET=hex('#b9a7d6'),ICE=hex('#cfe0ff'),PINK=hex('#ff8fb0'),BLUE=hex('#8fb4ff');
  const uniforms={uTime:{value:0},uScale:{value:600},uLight:{value:0},uFocus:{value:-1},uPick:{value:-99}};
  const mats=[];                       // point materials whose blending follows the theme

  const vert=rot=>`attribute float aS;attribute vec3 aC;attribute float aT;${rot?'attribute float aR;attribute float aA;attribute float aY;attribute float aG;attribute float aI;':''}
   uniform float uTime,uScale,uFocus,uPick;varying vec3 vC;varying float vA;
   void main(){${rot?`float ang=aA+uTime*.2/(.7+aR*.5);vec3 p=vec3(cos(ang)*aR,aY,sin(ang)*aR);`:'vec3 p=position;'}
    vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;
    float tw=.8+.2*sin(uTime*(.6+aT*2.4)+aT*60.);float f=1.;float pick=0.;
    ${rot?`if(uFocus>-.5){f=aG<-.5?.6:(abs(aG-uFocus)<.5?2.:.32);}
    pick=abs(aI-uPick)<.5?1.:0.;`:''}
    gl_PointSize=max(1.,aS*uScale/-mv.z*tw*(f>1.5?1.4:1.)*(1.+pick*3.2));vC=mix(aC,vec3(1.),pick*.75);vA=tw*min(f,1.5)+pick;}`;
  const frag=`varying vec3 vC;varying float vA;uniform float uGain,uLight;void main(){float d=length(gl_PointCoord-.5);float a=smoothstep(.5,0.,d);a*=a;vec3 c=vC*uGain*mix(1.,.4,uLight);gl_FragColor=vec4(c,clamp(a*vA*mix(1.,2.,uLight),0.,1.));}`;
  const pointMat=(rot,gain)=>{const m=new THREE.ShaderMaterial({vertexShader:vert(rot),fragmentShader:frag,uniforms:{...uniforms,uGain:{value:gain}},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending});mats.push(m);return m};
  const attr=(g,n,a,s)=>g.setAttribute(n,new THREE.BufferAttribute(a,s));

  /* ---------- background stars ---------- */
  const SN=small?900:2400,sp=new Float32Array(SN*3),ss=new Float32Array(SN),sc=new Float32Array(SN*3),st=new Float32Array(SN);
  for(let i=0;i<SN;i++){const layer=i%3;sp[i*3]=(rnd()-.5)*(70+layer*20);sp[i*3+1]=(rnd()-.5)*(44+layer*10);sp[i*3+2]=-8-layer*14-rnd()*10;ss[i]=.03+rnd()*(layer===0?.09:.06);
   const t=rnd(),c=t<.12?VIOLET:t<.3?BRASS:t<.5?BLUE:ICE;sc[i*3]=c.r;sc[i*3+1]=c.g;sc[i*3+2]=c.b;st[i]=rnd()}
  const sg=new THREE.BufferGeometry();attr(sg,'position',sp,3);attr(sg,'aS',ss,1);attr(sg,'aC',sc,3);attr(sg,'aT',st,1);
  scene.add(new THREE.Points(sg,pointMat(false,.9)));

  /* ---------- galaxy rig ---------- */
  const rig=new THREE.Group(),tilt=new THREE.Group();rig.add(tilt);scene.add(rig);
  tilt.rotation.x=-1.08;tilt.rotation.z=.3;
  const RMAX=5.4,TWIST=1.0;

  /* dust + haze (ambient realism, not data) */
  const GN=small?9000:24000,D={r:new Float32Array(GN),a:new Float32Array(GN),y:new Float32Array(GN),s:new Float32Array(GN),c:new Float32Array(GN*3),t:new Float32Array(GN),g:new Float32Array(GN).fill(-1),i:new Float32Array(GN).fill(-1)},tmp=new THREE.Color();
  for(let i=0;i<GN;i++){const bulge=i<GN*.18;let r,a,y;
   if(bulge){r=Math.pow(rnd(),1.6)*1.6;a=rnd()*Math.PI*2;y=gauss()*.55*(1-r/2.2)}
   else{r=.7+Math.pow(rnd(),.7)*(RMAX-.7);const arm=(i%4)*(Math.PI/2);a=arm+r*TWIST+gauss()*(.16+.05*r);y=gauss()*.09*(1-r/(RMAX*1.15))}
   D.r[i]=r;D.a[i]=a;D.y[i]=y;D.s[i]=(bulge?.034:.026)+rnd()*.05*(rnd()<.03?3:1);D.t[i]=rnd();
   const k=r/RMAX;tmp.copy(WARM).lerp(BRASS,Math.min(1,k*1.8));if(k>.3)tmp.lerp(BLUE,Math.min(.8,(k-.3)*1.5));if(k>.6)tmp.lerp(VIOLET,Math.min(.7,(k-.6)*1.6));
   if(!bulge&&rnd()<.025)tmp.copy(PINK);   // HII regions along the arms
   D.c[i*3]=tmp.r*.8;D.c[i*3+1]=tmp.g*.8;D.c[i*3+2]=tmp.b*.8}
  const gg=new THREE.BufferGeometry();attr(gg,'position',new Float32Array(GN*3),3);attr(gg,'aR',D.r,1);attr(gg,'aA',D.a,1);attr(gg,'aY',D.y,1);attr(gg,'aS',D.s,1);attr(gg,'aC',D.c,3);attr(gg,'aT',D.t,1);attr(gg,'aG',D.g,1);attr(gg,'aI',D.i,1);
  gg.boundingSphere=new THREE.Sphere(new THREE.Vector3(),RMAX*3);
  tilt.add(new THREE.Points(gg,pointMat(true,1.1)));

  /* dust lanes: dark absorbing clouds along the inner edge of each arm (dark theme only) */
  const LN=small?900:2600,L={r:new Float32Array(LN),a:new Float32Array(LN),y:new Float32Array(LN),s:new Float32Array(LN),c:new Float32Array(LN*3),t:new Float32Array(LN)};
  for(let i=0;i<LN;i++){const r=1.2+Math.pow(rnd(),.8)*(RMAX-1.6),arm=(i%4)*(Math.PI/2);L.r[i]=r;L.a[i]=arm+r*TWIST-.22+gauss()*.06;L.y[i]=gauss()*.05;L.s[i]=.11+rnd()*.14;L.t[i]=rnd();L.c[i*3]=.012;L.c[i*3+1]=.03;L.c[i*3+2]=.06}
  const lg=new THREE.BufferGeometry();attr(lg,'position',new Float32Array(LN*3),3);attr(lg,'aR',L.r,1);attr(lg,'aA',L.a,1);attr(lg,'aY',L.y,1);attr(lg,'aS',L.s,1);attr(lg,'aC',L.c,3);attr(lg,'aT',L.t,1);attr(lg,'aG',new Float32Array(LN).fill(-1),1);attr(lg,'aI',new Float32Array(LN).fill(-1),1);
  lg.boundingSphere=new THREE.Sphere(new THREE.Vector3(),RMAX*3);
  const lanes=new THREE.Points(lg,new THREE.ShaderMaterial({vertexShader:vert(true),fragmentShader:`varying vec3 vC;varying float vA;void main(){float d=length(gl_PointCoord-.5);float a=smoothstep(.5,0.,d);gl_FragColor=vec4(vC,a*.16);}`,uniforms,transparent:true,depthWrite:false,blending:THREE.NormalBlending}));
  tilt.add(lanes);

  /* core glow */
  const glowTex=(()=>{const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d'),r=g.createRadialGradient(64,64,0,64,64,64);r.addColorStop(0,'rgba(255,236,196,.95)');r.addColorStop(.25,'rgba(232,206,158,.35)');r.addColorStop(1,'rgba(232,206,158,0)');g.fillStyle=r;g.fillRect(0,0,128,128);return new THREE.CanvasTexture(c)})();
  const glow=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,opacity:.55}));glow.scale.set(5.4,5.4,1);rig.add(glow);

  /* ---------- the records: one star each ---------- */
  let recStars=null,rec={n:0,r:null,a:null,y:null,g:null,geo:null};
  function buildRecords(){
   let rows;try{rows=records}catch{return}
   if(!rows||!rows.length)return;
   if(recStars){tilt.remove(recStars);rec.geo.dispose()}
   const n=rows.length;rec={n,r:new Float32Array(n),a:new Float32Array(n),y:new Float32Array(n),g:new Float32Array(n),geo:new THREE.BufferGeometry()};
   const s=new Float32Array(n),c=new Float32Array(n*3),t=new Float32Array(n),idx=new Float32Array(n),sec=2*Math.PI/8;
   rows.forEach((r,i)=>{let g=0;try{g=recordArtIndex(r)}catch{}
    const rr=.55+Math.pow(rnd(),.78)*(RMAX-.55);
    rec.r[i]=rr;rec.a[i]=g*sec+.35+rr*TWIST+gauss()*(.1+.03*rr);rec.y[i]=gauss()*.07*(1-rr/(RMAX*1.2));rec.g[i]=g;
    s[i]=(r.collection==='books'?.075:.06)+rnd()*.05;t[i]=rnd();idx[i]=i;
    const col=FIELD[g];c[i*3]=col.r;c[i*3+1]=col.g;c[i*3+2]=col.b});
   attr(rec.geo,'position',new Float32Array(n*3),3);attr(rec.geo,'aR',rec.r,1);attr(rec.geo,'aA',rec.a,1);attr(rec.geo,'aY',rec.y,1);attr(rec.geo,'aS',s,1);attr(rec.geo,'aC',c,3);attr(rec.geo,'aT',t,1);attr(rec.geo,'aG',rec.g,1);attr(rec.geo,'aI',idx,1);
   rec.geo.boundingSphere=new THREE.Sphere(new THREE.Vector3(),RMAX*3);
   recStars=new THREE.Points(rec.geo,pointMat(true,1.5));tilt.add(recStars);applyTheme();buildLabels()}

  /* ---------- meteors (dark theme) ---------- */
  const meteors=[0,1].map(()=>{const g=new THREE.BufferGeometry(),n=22;g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(n*3),3));g.setAttribute('color',new THREE.BufferAttribute(new Float32Array(n*3),3));
   const l=new THREE.Line(g,new THREE.LineBasicMaterial({vertexColors:true,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false}));l.visible=false;l.frustumCulled=false;scene.add(l);return{l,t:0,life:1.4,x:0,y:0,vx:0,vy:0,next:3+rnd()*5}});

  /* ---------- field labels + tooltip (real DOM: focusable, labelled) ---------- */
  const labelBox=document.createElement('div');labelBox.className='hero-fields';hero.appendChild(labelBox);
  const tip=document.createElement('div');tip.className='hero-tip';tip.setAttribute('aria-hidden','true');tip.hidden=true;hero.appendChild(tip);
  let labels=[],focus=-1;
  function fieldRun(i){try{reset();discoveryIndex=i;populateFilters();render();const el=document.getElementById('catalog');if(el)el.scrollIntoView({block:'start'})}catch{}}
  function buildLabels(){
   labelBox.innerHTML='';labels=[];
   let groups;try{groups=DISCOVERY}catch{return}
   groups.forEach((d,i)=>{let n=0;for(let k=0;k<rec.n;k++)if(rec.g[k]===i)n++;
    const b=document.createElement('button');b.type='button';b.className='hero-field';b.style.setProperty('--fc','#'+FIELD[i].getHexString());
    const nm=d.title[uiLang==='en'?1:0];b.innerHTML=`<i aria-hidden="true"></i><span>${esc(nm)}</span><small>${n.toLocaleString(locale())}</small>`;
    b.setAttribute('aria-label',`${nm} · ${n.toLocaleString(locale())} ${t('records')}`);
    b.addEventListener('pointerenter',()=>{focus=i});b.addEventListener('pointerleave',()=>{focus=-1});b.addEventListener('focus',()=>{focus=i});b.addEventListener('blur',()=>{focus=-1});
    b.addEventListener('click',()=>fieldRun(i));labelBox.appendChild(b);labels.push({b,ang:i*(2*Math.PI/8)+.35+RMAX*.93*TWIST})})}

  /* ---------- layout + theme ---------- */
  let W=24,H=11,portrait=false,quality=1.75;
  function layout(){
   const w=sceneEl.clientWidth||innerWidth,h=sceneEl.clientHeight||innerHeight;
   renderer.setPixelRatio(Math.min(devicePixelRatio||1,quality));renderer.setSize(w,h,false);
   camera.aspect=w/h;camera.updateProjectionMatrix();
   H=2*camZ*Math.tan(FOV*Math.PI/360);W=H*camera.aspect;portrait=camera.aspect<1.05;
   uniforms.uScale.value=renderer.domElement.height/(2*Math.tan(FOV*Math.PI/360));
   const sc=portrait?.64:Math.min(1.02,W/26);
   rig.position.set(portrait?0:(.69-.5)*W,portrait?H*.2:(.5-.4)*H,-1);rig.scale.setScalar(sc);
   labelBox.hidden=portrait}
  function applyTheme(){
   const light=root.dataset.theme==='light';uniforms.uLight.value=light?1:0;
   mats.forEach(m=>{m.blending=light?THREE.NormalBlending:THREE.AdditiveBlending;m.needsUpdate=true});
   lanes.visible=!light;glow.material.blending=light?THREE.NormalBlending:THREE.AdditiveBlending;glow.material.color.set(light?0xffd9a0:0xffffff);glow.material.needsUpdate=true;
   meteors.forEach(m=>{if(light)m.l.visible=false})}

  /* ---------- interaction ---------- */
  let px=0,py=0,tx=0,ty=0,yaw=0,pitch=0,vYaw=0,drag=null,hover=-1,mouse={x:-1,y:-1,in:false},time=0;
  const v3=new THREE.Vector3();
  const interactive=t=>!!(t&&t.closest&&t.closest('a,button,input,select,textarea,summary,.hero-copy,.hero-spectrum,#paletteOverlay,#recordView'));
  function pick(){
   if(!rec.n||!mouse.in){setHover(-1);return}
   const rect=canvas.getBoundingClientRect(),w=rect.width,h=rect.height;let best=-1,bd=18*18;
   tilt.updateMatrixWorld(true);
   for(let i=0;i<rec.n;i++){const ang=rec.a[i]+time*.2/(.7+rec.r[i]*.5);v3.set(Math.cos(ang)*rec.r[i],rec.y[i],Math.sin(ang)*rec.r[i]);tilt.localToWorld(v3);v3.project(camera);
    if(v3.z>1)continue;const sx=(v3.x*.5+.5)*w+rect.left,sy=(-v3.y*.5+.5)*h+rect.top,d=(sx-mouse.x)**2+(sy-mouse.y)**2;if(d<bd){bd=d;best=i}}
   setHover(best)}
  function setHover(i){
   if(i===hover)return;hover=i;uniforms.uPick.value=i<0?-99:i;
   if(i<0){tip.hidden=true;hero.classList.remove('hero-pick');focus=-1;return}
   const r=records[i];if(!r)return;focus=rec.g[i];hero.classList.add('hero-pick');
   tip.innerHTML=`<small style="--fc:#${FIELD[rec.g[i]].getHexString()}">${esc(catalogNo(r))} · ${esc(t(r.collection))}${r.year?' · '+esc(r.year):''}</small><strong>${esc(displayTitle(r))}</strong>${r.author?`<span>${esc(r.author)}</span>`:''}<em>${esc(t('heroOpen'))}</em>`;tip.hidden=false;placeTip()}
  function placeTip(){const r=hero.getBoundingClientRect();tip.style.transform=`translate(${Math.max(8,Math.min(mouse.x-r.left+16,r.width-290))}px,${Math.max(8,Math.min(mouse.y-r.top+18,r.height-120))}px)`}
  let pickQueued=false;const pickSoon=()=>{if(pickQueued)return;pickQueued=true;requestAnimationFrame(()=>{pickQueued=false;pick()})};
  addEventListener('pointermove',e=>{
   const r=hero.getBoundingClientRect();if(r.bottom<0||r.top>innerHeight)return;
   px=(e.clientX/innerWidth-.5)*2;py=(e.clientY/innerHeight-.5)*2;
   const over=hero.contains(e.target)&&!interactive(e.target);mouse={x:e.clientX,y:e.clientY,in:over};
   if(drag){const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.abs(dx)+Math.abs(dy)>4)drag.moved=true;yaw+=dx*.006;pitch=Math.max(-.5,Math.min(.5,pitch+dy*.004));vYaw=dx*.006;drag.x=e.clientX;drag.y=e.clientY;hero.classList.add('hero-drag');setHover(-1);return}
   if(over){pickSoon();if(!tip.hidden)placeTip()}else if(hover>=0)setHover(-1)},{passive:true});
  addEventListener('pointerdown',e=>{if(e.button>0||!hero.contains(e.target)||interactive(e.target))return;drag={x:e.clientX,y:e.clientY,moved:false}});
  addEventListener('pointerup',()=>{const d=drag;drag=null;hero.classList.remove('hero-drag');if(d&&!d.moved&&hover>=0&&window.openRecord){const r=records[hover];if(r)window.openRecord(r.id)}});
  hero.addEventListener('pointerleave',()=>{mouse.in=false;setHover(-1)});

  /* ---------- loop ---------- */
  let running=true,visible=true,tPrev=0,frames=0,acc=0,degraded=false;
  const paused=()=>root.classList.contains('effects-paused');
  function update(dt){
   time+=dt;uniforms.uTime.value=time;
   if(!drag){yaw+=vYaw;vYaw*=.94;if(Math.abs(vYaw)<1e-4)vYaw=0}
   tx+=(px-tx)*Math.min(1,dt*2.4);ty+=(py-ty)*Math.min(1,dt*2.4);
   camera.position.set(tx*.8,-ty*.45,camZ);camera.lookAt(0,0,0);
   rig.rotation.y=yaw+Math.sin(time*.07)*.12;rig.rotation.x=pitch;
   glow.material.opacity=(root.dataset.theme==='light'?.4:.5)+.06*Math.sin(time*.9);
   /* field labels ride the arm tips */
   if(labels.length&&!portrait){const w=sceneEl.clientWidth||innerWidth,h=sceneEl.clientHeight||innerHeight;rig.updateMatrixWorld(true);
    labels.forEach((l,i)=>{const rl=RMAX*.93,ang=l.ang+time*.2/(.7+rl*.5);v3.set(Math.cos(ang)*rl,0,Math.sin(ang)*rl);tilt.localToWorld(v3);v3.project(camera);
     const x=(v3.x*.5+.5)*w,y=(-v3.y*.5+.5)*h,ok=v3.z<1&&x>w*.52&&x<w-190&&y>86&&y<h*.66&&!(x>w*.74&&y>h*.42),on=focus===i;
     l.b.style.transform=`translate(${x.toFixed(1)}px,${y.toFixed(1)}px)`;l.b.style.opacity=ok?(focus<0||on?1:.35):0;l.b.style.pointerEvents=ok?'auto':'none';l.b.tabIndex=ok?0:-1;l.b.classList.toggle('on',on)})}
   if(root.dataset.theme!=='light')meteors.forEach(m=>{m.next-=dt;if(!m.l.visible&&m.next<=0){m.l.visible=true;m.t=0;m.life=1.1+rnd()*.7;m.x=(rnd()-.2)*W*.7;m.y=H*.5-rnd()*H*.25;const a=-.45-rnd()*.3;m.vx=Math.cos(a)*(W*.5);m.vy=Math.sin(a)*(W*.5);m.next=6+rnd()*8}
    if(m.l.visible){m.t+=dt;const k=m.t/m.life,pos=m.l.geometry.attributes.position,col=m.l.geometry.attributes.color,n=pos.count,hx=m.x+m.vx*m.t*.5,hy=m.y+m.vy*m.t*.5;
     for(let i=0;i<n;i++){const f=i/(n-1);pos.setXYZ(i,hx-m.vx*.09*f*(1-k*.4),hy-m.vy*.09*f*(1-k*.4),-4);const b=(1-f)*(1-k)*.95;col.setXYZ(i,b,b*.93,b*.78)}pos.needsUpdate=true;col.needsUpdate=true;if(k>=1)m.l.visible=false}});
   uniforms.uFocus.value=focus}
  function frame(now){
   if(!running)return;requestAnimationFrame(frame);
   const dt=Math.min(.05,(now-tPrev)/1000||0);tPrev=now;
   if(!visible||document.hidden||paused()||reduced.matches)return;
   update(dt);renderer.render(scene,camera);
   if(!degraded&&++frames<=90){acc+=dt;if(frames===90&&acc/90>.024){degraded=true;quality=1;layout()}}}
  function still(){update(0.001);time=3.2;update(0);renderer.render(scene,camera)}

  /* ---------- wiring ---------- */
  layout();applyTheme();buildRecords();
  sceneEl.classList.add('hero-gl');canvas.classList.add('on');
  still();requestAnimationFrame(t=>{tPrev=t;requestAnimationFrame(frame)});
  if(typeof ResizeObserver==='function')new ResizeObserver(()=>{layout();if(reduced.matches||paused())still()}).observe(sceneEl);else addEventListener('resize',()=>layout());
  if(typeof IntersectionObserver==='function')new IntersectionObserver(es=>{visible=es[0].isIntersecting}).observe(sceneEl);
  if(typeof MutationObserver==='function')new MutationObserver(()=>{applyTheme();if(reduced.matches||paused())still()}).observe(root,{attributes:true,attributeFilter:['class','data-theme']});
  if(reduced.addEventListener)reduced.addEventListener('change',()=>{if(reduced.matches)still()});
  document.addEventListener('library:ready',buildRecords);document.addEventListener('library:language',buildLabels);
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();running=false;sceneEl.classList.remove('hero-gl');canvas.remove();labelBox.remove();tip.remove()});
 }
})();
