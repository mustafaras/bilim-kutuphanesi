'use strict';
/* Hero 3D · "Record Galaxy" v3 — every one of the catalog's records is a real star in a spreading spiral galaxy.
   Techniques (researched): log-spiral particle disc with per-star differential rotation in the vertex shader (Three.js Journey pattern),
   FBM nebula plane warped onto the same spiral, dark dust lanes, HII knots, halo, diffraction spikes on bright stars,
   real UnrealBloomPass (dark theme), GPU pointer gravity + click shock-wave, zoom-to-cursor camera (buttons / Ctrl+wheel / double click),
   cinematic intro fly-in and scroll-linked pull-back.
   • 8 arms of record stars = the 8 discovery fields (colour = card spine). Hover a star → card; click → record; field label → filter.
   • Dark = luminous additive sky + bloom; light = ink-on-parchment star atlas (same data).
   three.js + postprocessing addons are vendored (vendor/): no runtime network. 2D fallback in effects.js without WebGL. */
(()=>{
 const sceneEl=document.querySelector('.hero-scene'),root=document.documentElement;
 if(!sceneEl||typeof document.createElement!=='function')return;
 const hero=sceneEl.closest?sceneEl.closest('.hero'):sceneEl.parentElement;
 const reduced=typeof matchMedia==='function'?matchMedia('(prefers-reduced-motion: reduce)'):{matches:false};
 const hasGL=()=>{try{const c=document.createElement('canvas');return!!(c.getContext('webgl2')||c.getContext('webgl'))}catch{return false}};
 if(!hasGL())return;
 const idle=cb=>typeof requestIdleCallback==='function'?requestIdleCallback(cb,{timeout:1500}):setTimeout(cb,250);
 async function boot(){
  try{
   const THREE=await import('./vendor/three.module.min.js');let post=null;
   try{const [ec,rp,ub,sp]=await Promise.all([import('./vendor/jsm/postprocessing/EffectComposer.js'),import('./vendor/jsm/postprocessing/RenderPass.js'),import('./vendor/jsm/postprocessing/UnrealBloomPass.js'),import('./vendor/jsm/postprocessing/ShaderPass.js')]);post={EffectComposer:ec.EffectComposer,RenderPass:rp.RenderPass,UnrealBloomPass:ub.UnrealBloomPass,ShaderPass:sp.ShaderPass}}catch{post=null}
   init(THREE,post)}catch{}}
 if(document.readyState==='complete')idle(boot);else addEventListener('load',()=>idle(boot),{once:true});

 function init(THREE,post){
  const canvas=document.createElement('canvas');canvas.id='heroGL';canvas.setAttribute('aria-hidden','true');
  sceneEl.insertBefore(canvas,sceneEl.firstChild);
  let renderer;
  try{renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:false,powerPreference:'high-performance'})}catch{canvas.remove();return}
  const small=innerWidth<760,FOV=42,CAMZ=14,scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(FOV,2,.1,200);
  camera.position.set(0,0,CAMZ);

  let seed=20261015;const rnd=()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296};
  const gauss=()=>{let u=0;for(let i=0;i<4;i++)u+=rnd();return(u-2)*1.7};
  const hex=h=>new THREE.Color(h);
  const FIELD=['#7CC7B7','#8FBF8A','#D69A6B','#B9A7D6','#7FA8D8','#8FA8A0','#D8A05A','#E8CE9E'].map(hex);
  const WARM=hex('#fff0cf'),BRASS=hex('#e8ce9e'),VIOLET=hex('#b9a7d6'),ICE=hex('#cfe0ff'),PINK=hex('#ff8fb0'),BLUE=hex('#8fb4ff');
  const uniforms={uTime:{value:0},uScale:{value:600},uLight:{value:0},uFocus:{value:-1},uPick:{value:-99},uFade:{value:0},uMouse:{value:new THREE.Vector3()},uMouseOn:{value:0},uPulse:{value:new THREE.Vector3(0,0,-99)},uWell:{value:0}};
  const mats=[];

  const vert=rot=>`attribute float aS;attribute vec3 aC;attribute float aT;${rot?'attribute float aR;attribute float aA;attribute float aY;attribute float aG;attribute float aI;varying float vBig;':''}
   uniform float uTime,uScale,uFocus,uPick,uMouseOn,uLight,uWell;uniform vec3 uMouse,uPulse;varying vec3 vC;varying float vA;
   void main(){
    float tw=.8+.2*sin(uTime*(.6+aT*2.4)+aT*60.);float f=1.;float pick=0.;float ring=0.;float g=0.;vec4 mv;
    ${rot?`float ang=aA+uTime*.2/(.7+aR*.5);vec4 wp=modelMatrix*vec4(cos(ang)*aR,aY+.022*aR*aR*sin(ang-.6),sin(ang)*aR,1.);
    vec2 dm=uMouse.xy-wp.xy;g=uMouseOn*smoothstep(2.8+uWell*1.6,0.,length(dm));wp.xy+=dm*g*(.34+uWell*.42)+vec2(-dm.y,dm.x)*g*uWell*.32;wp.z+=g*(.7+uWell*1.6);
    float dt=uTime-uPulse.z;if(dt>0.&&dt<1.7){vec2 dp=wp.xy-uPulse.xy;float rd=abs(length(dp)-dt*7.);ring=exp(-rd*rd*.8)*(1.-dt/1.7);wp.xy+=normalize(dp+vec2(1e-4))*ring*.4;}
    mv=viewMatrix*wp;
    if(uFocus>-.5){f=aG<-.5?.6:(abs(aG-uFocus)<.5?2.:.32);}
    pick=abs(aI-uPick)<.5?1.:0.;vBig=smoothstep(.07,.12,aS);`:'mv=modelViewMatrix*vec4(position,1.);'}
    gl_Position=projectionMatrix*mv;
    float sz=mix(1.,.68,uLight)*aS*uScale/-mv.z*tw*(f>1.5?1.4:1.)*(1.+pick*3.2+ring*2.2+g*.7);sz=sz<9.?sz:9.+(sz-9.)*.22;gl_PointSize=clamp(sz,1.,34.);vC=mix(aC,vec3(1.),clamp(pick*.75+ring*.5,0.,1.));vA=tw*min(f,1.5)+pick+ring*1.4+g*.4;}`;
  const frag=rot=>`varying vec3 vC;varying float vA;${rot?'varying float vBig;':''}uniform float uGain,uLight,uFade;void main(){vec2 c=gl_PointCoord-.5;float d=length(c);float a=smoothstep(.5,0.,d);a*=a;
   ${rot?'a=max(a,(exp(-abs(c.x)*46.)*exp(-abs(c.y)*4.)+exp(-abs(c.y)*46.)*exp(-abs(c.x)*4.))*.55*vBig*(1.-d*1.6));':''}
   vec3 col=vC*uGain*mix(1.,.4,uLight);gl_FragColor=vec4(col,clamp(a*vA*uFade*mix(1.,2.,uLight),0.,1.));}`;
  const pointMat=(rot,gain)=>{const m=new THREE.ShaderMaterial({vertexShader:vert(rot),fragmentShader:frag(rot),uniforms:{...uniforms,uGain:{value:gain}},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending});mats.push(m);return m};
  const attr=(g,n,a,s)=>g.setAttribute(n,new THREE.BufferAttribute(a,s));

  /* ---------- background stars ---------- */
  const SN=small?900:3200,sp=new Float32Array(SN*3),ss=new Float32Array(SN),sc=new Float32Array(SN*3),st=new Float32Array(SN);
  for(let i=0;i<SN;i++){const layer=i%3;sp[i*3]=(rnd()-.5)*(80+layer*24);sp[i*3+1]=(rnd()-.5)*(50+layer*12);sp[i*3+2]=-8-layer*14-rnd()*10;ss[i]=.03+rnd()*(layer===0?.09:.06);
   const t=rnd(),c=t<.12?VIOLET:t<.3?BRASS:t<.5?BLUE:ICE;sc[i*3]=c.r;sc[i*3+1]=c.g;sc[i*3+2]=c.b;st[i]=rnd()}
  const sg=new THREE.BufferGeometry();attr(sg,'position',sp,3);attr(sg,'aS',ss,1);attr(sg,'aC',sc,3);attr(sg,'aT',st,1);
  scene.add(new THREE.Points(sg,pointMat(false,.9)));

  /* ---------- galaxy rig ---------- */
  const rig=new THREE.Group(),tilt=new THREE.Group();rig.add(tilt);scene.add(rig);
  tilt.rotation.x=-.98;tilt.rotation.z=.28;
  const RMAX=6.4,TWIST=1.0;

  /* FBM nebula plane warped onto the same log-spiral (volumetric haze between the stars) */
  const NR=RMAX*1.75;
  const nebGeo=new THREE.PlaneGeometry(NR*2,NR*2,1,1);nebGeo.rotateX(-Math.PI/2);
  const nebMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,uniforms:{...uniforms,uR:{value:NR}},
   vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
   fragmentShader:`varying vec2 vUv;uniform float uTime,uR,uLight,uFade;
    float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1.,0.)),f.x),mix(h(i+vec2(0.,1.)),h(i+vec2(1.,1.)),f.x),f.y);}
    float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*n(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return v;}
    void main(){vec2 p=(vUv-.5)*2.*uR;vec2 q=vec2(p.x,-p.y);float r=length(q);float a=atan(q.y,q.x);float w=uTime*.2/(.7+r*.5);
     float ph=r*${TWIST.toFixed(2)}*(1.+.06*sin(r*1.7));
     float arm=pow(.5+.5*cos(2.*(a-ph-w)),1.7)*(.62+.55*sin(a*1.0+r*.35+1.1));
     float cloud=fbm(vec2(r*1.9,(a-w)*1.7)+uTime*.012)*.9+fbm(q*.9+3.1)*.5;
     float lim=uR*(.55+.45*fbm(vec2(a*1.4+4.,r*.12)));float edge=smoothstep(lim,lim*.15,r);float core=exp(-r*r*.5);
     float dens=(arm*cloud*1.25+.12*cloud)*edge+core*.2;
     vec3 warm=vec3(1.,.78,.5),blue=vec3(.30,.46,.95),viol=vec3(.55,.32,.82),pink=vec3(1.,.42,.62);
     vec3 col=mix(warm,blue,smoothstep(.6,3.4,r));col=mix(col,viol,smoothstep(3.2,uR,r)*.8);col=mix(col,pink,smoothstep(.62,.9,fbm(q*1.6+8.))*arm*.5);
     col=mix(col,vec3(.22,.17,.26),uLight);
     gl_FragColor=vec4(col,clamp(dens*mix(.17,.3,uLight)*uFade,0.,1.));}`});
  mats.push(nebMat);
  const neb=new THREE.Mesh(nebGeo,nebMat);neb.renderOrder=-1;tilt.add(neb);

  /* dust + haze (ambient, not data). Irregular on purpose: unequal arms, a spur, star-forming clumps, angle-dependent outer edge,
     a warped outer disc, a tidal bridge to a dwarf companion. A perfect ellipse reads as a diagram, not a galaxy. */
  const phase=r=>r*TWIST*(1+.06*Math.sin(r*1.7));
  const ARMS=[{b:0,w:.36,len:1.0},{b:Math.PI+.12,w:.3,len:.82},{b:Math.PI*.5+.5,w:.12,len:.5},{b:Math.PI*1.5-.2,w:.09,len:.44}];
  const edgeK=a=>.8+.2*Math.sin(2*a+1.3)+.12*Math.sin(3*a+.4);
  const clumps=Array.from({length:150},()=>{const u=rnd();const arm=u<.4?0:u<.75?1:u<.88?2:3;const r=1.2+rnd()*RMAX*ARMS[arm].len*.95;return{r,a:ARMS[arm].b+phase(r)+gauss()*.08,s:.06+rnd()*.16}});
  const GN=small?14000:56000,D={r:new Float32Array(GN),a:new Float32Array(GN),y:new Float32Array(GN),s:new Float32Array(GN),c:new Float32Array(GN*3),t:new Float32Array(GN),g:new Float32Array(GN).fill(-1),i:new Float32Array(GN).fill(-1)},tmp=new THREE.Color();
  const DW={r:RMAX*1.95,a:.95};                                                   // dwarf companion (polar, rotates slowly with the disc)
  const toPolar=(x,z)=>[Math.hypot(x,z),Math.atan2(z,x)];
  for(let i=0;i<GN;i++){const u=rnd();let r,a,y,kind=0;
   if(u<.085){kind=1;r=Math.pow(rnd(),1.9)*1.7;a=rnd()*Math.PI*2;y=gauss()*.6*Math.max(0,1-r/2.6)}                                  // bulge
   else if(u<.2){kind=2;r=1+rnd()*RMAX*1.15;a=rnd()*Math.PI*2;y=gauss()*.12*(1-r/(RMAX*1.5))}                                         // inter-arm haze
   else if(u<.225){kind=3;r=RMAX*(.9+rnd()*1.7);a=rnd()*Math.PI*2;y=gauss()*(1.4+r*.12)}                                              // halo
   else if(u<.25){kind=4;const x=Math.cos(DW.a)*DW.r+gauss()*.5,z=Math.sin(DW.a)*DW.r+gauss()*.4;[r,a]=toPolar(x,z);y=gauss()*.25}  // dwarf
   else if(u<.268){kind=5;const t=rnd(),ax=Math.cos(ARMS[0].b+phase(RMAX*.95))*RMAX*.95,az=Math.sin(ARMS[0].b+phase(RMAX*.95))*RMAX*.95,bx=Math.cos(DW.a)*DW.r,bz=Math.sin(DW.a)*DW.r;
     const x=ax+(bx-ax)*t+gauss()*.3*Math.sin(t*Math.PI),z=az+(bz-az)*t+gauss()*.3*Math.sin(t*Math.PI)+Math.sin(t*3.1)*.7;[r,a]=toPolar(x,z);y=gauss()*.1}   // tidal bridge
   else if(u<.55){kind=6;const c=clumps[(rnd()*clumps.length)|0];r=Math.max(.5,c.r+gauss()*c.s*.9);a=c.a+gauss()*c.s*.35;y=gauss()*.06}                  // star-forming clumps
   else{let k=rnd(),arm=0,acc=0;for(let j=0;j<ARMS.length;j++){acc+=ARMS[j].w;if(k*1.0<=acc/.87){arm=j;break}}
     r=(.8+Math.pow(rnd(),.7)*(RMAX*1.1-.8))*ARMS[arm].len;r*=edgeK(ARMS[arm].b+phase(r))/.8;a=ARMS[arm].b+phase(r)+gauss()*(.13+.08*r);y=gauss()*.1*(1-Math.min(1,r/(RMAX*1.3)))}
   D.r[i]=r;D.a[i]=a;D.y[i]=y;D.s[i]=(kind===1?.024:kind===3?.02:kind===6?.03:.026)+rnd()*.05*(rnd()<.03?3.2:1);D.t[i]=rnd();
   const k=Math.min(1.3,r/RMAX);tmp.copy(WARM).lerp(BRASS,Math.min(1,k*1.8));if(k>.3)tmp.lerp(BLUE,Math.min(.85,(k-.3)*1.6));if(k>.62)tmp.lerp(VIOLET,Math.min(.7,(k-.62)*1.6));
   if(kind===6){tmp.lerp(BLUE,.55);if(rnd()<.2)tmp.copy(PINK)}if(kind===0&&rnd()<.03)tmp.copy(PINK);if(kind===3)tmp.lerp(BRASS,.5);if(kind===4)tmp.copy(BRASS).lerp(WARM,.4);if(kind===5)tmp.copy(ICE);
   const m=kind===3?.55:kind===5?.6:.8;D.c[i*3]=tmp.r*m;D.c[i*3+1]=tmp.g*m;D.c[i*3+2]=tmp.b*m}
  const gg=new THREE.BufferGeometry();attr(gg,'position',new Float32Array(GN*3),3);attr(gg,'aR',D.r,1);attr(gg,'aA',D.a,1);attr(gg,'aY',D.y,1);attr(gg,'aS',D.s,1);attr(gg,'aC',D.c,3);attr(gg,'aT',D.t,1);attr(gg,'aG',D.g,1);attr(gg,'aI',D.i,1);
  gg.boundingSphere=new THREE.Sphere(new THREE.Vector3(),RMAX*6);
  const dust=new THREE.Points(gg,pointMat(true,1.05));dust.frustumCulled=false;tilt.add(dust);

  /* dust lanes: dark absorbing clouds along the inner edge of the arms (dark theme) */
  const LN=small?1200:3600,L={r:new Float32Array(LN),a:new Float32Array(LN),y:new Float32Array(LN),s:new Float32Array(LN),c:new Float32Array(LN*3),t:new Float32Array(LN)};
  for(let i=0;i<LN;i++){const r=1.2+Math.pow(rnd(),.8)*(RMAX-1.4);L.r[i]=r;L.a[i]=(i%2?Math.PI+.12:0)+phase(r)-.24+gauss()*.07;L.y[i]=gauss()*.05;L.s[i]=.12+rnd()*.16;L.t[i]=rnd();L.c[i*3]=.01;L.c[i*3+1]=.025;L.c[i*3+2]=.055}
  const lg=new THREE.BufferGeometry();attr(lg,'position',new Float32Array(LN*3),3);attr(lg,'aR',L.r,1);attr(lg,'aA',L.a,1);attr(lg,'aY',L.y,1);attr(lg,'aS',L.s,1);attr(lg,'aC',L.c,3);attr(lg,'aT',L.t,1);attr(lg,'aG',new Float32Array(LN).fill(-1),1);attr(lg,'aI',new Float32Array(LN).fill(-1),1);
  const lanes=new THREE.Points(lg,new THREE.ShaderMaterial({vertexShader:vert(true),fragmentShader:`varying vec3 vC;varying float vA;varying float vBig;void main(){float d=length(gl_PointCoord-.5);float a=smoothstep(.5,0.,d);gl_FragColor=vec4(vC,a*.17);}`,uniforms,transparent:true,depthWrite:false,blending:THREE.NormalBlending}));
  lanes.frustumCulled=false;tilt.add(lanes);

  /* core glow */
  const glowTex=(()=>{const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d'),r=g.createRadialGradient(64,64,0,64,64,64);r.addColorStop(0,'rgba(255,236,196,.95)');r.addColorStop(.25,'rgba(232,206,158,.35)');r.addColorStop(1,'rgba(232,206,158,0)');g.fillStyle=r;g.fillRect(0,0,128,128);return new THREE.CanvasTexture(c)})();
  const glow=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,opacity:.55}));glow.scale.set(6.2,6.2,1);rig.add(glow);

  /* ---------- the records: one star each ---------- */
  let recStars=null,rec={n:0,r:null,a:null,y:null,g:null,geo:null};
  function buildRecords(){
   let rows;try{rows=records}catch{return}
   if(!rows||!rows.length)return;
   if(recStars){tilt.remove(recStars);rec.geo.dispose()}
   const n=rows.length;rec={n,r:new Float32Array(n),a:new Float32Array(n),y:new Float32Array(n),g:new Float32Array(n),geo:new THREE.BufferGeometry()};
   const s=new Float32Array(n),c=new Float32Array(n*3),t=new Float32Array(n),idx=new Float32Array(n),sec=2*Math.PI/8;
   rows.forEach((r,i)=>{let g=0;try{g=recordArtIndex(r)}catch{}
    const rr=.6+Math.pow(rnd(),.78)*(RMAX*1.02-.6);
    rec.r[i]=rr;rec.a[i]=g*sec+.35+phase(rr)+gauss()*(.12+.04*rr);rec.y[i]=gauss()*.08*(1-rr/(RMAX*1.3));rec.g[i]=g;
    s[i]=(r.collection==='books'?.082:.064)+rnd()*.055;t[i]=rnd();idx[i]=i;
    const col=FIELD[g];c[i*3]=col.r;c[i*3+1]=col.g;c[i*3+2]=col.b});
   attr(rec.geo,'position',new Float32Array(n*3),3);attr(rec.geo,'aR',rec.r,1);attr(rec.geo,'aA',rec.a,1);attr(rec.geo,'aY',rec.y,1);attr(rec.geo,'aS',s,1);attr(rec.geo,'aC',c,3);attr(rec.geo,'aT',t,1);attr(rec.geo,'aG',rec.g,1);attr(rec.geo,'aI',idx,1);
   rec.geo.boundingSphere=new THREE.Sphere(new THREE.Vector3(),RMAX*6);
   recStars=new THREE.Points(rec.geo,pointMat(true,1.5));recStars.frustumCulled=false;tilt.add(recStars);applyTheme();buildLabels()}

  /* ---------- meteors (dark theme) ---------- */
  const meteors=[0,1].map(()=>{const g=new THREE.BufferGeometry(),n=22;g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(n*3),3));g.setAttribute('color',new THREE.BufferAttribute(new Float32Array(n*3),3));
   const l=new THREE.Line(g,new THREE.LineBasicMaterial({vertexColors:true,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false}));l.visible=false;l.frustumCulled=false;scene.add(l);return{l,t:0,life:1.4,x:0,y:0,vx:0,vy:0,next:3+rnd()*5}});

  /* ---------- DOM: field labels, tooltip, zoom controls, hint ---------- */
  const labelBox=document.createElement('div');labelBox.className='hero-fields';hero.appendChild(labelBox);
  const ground=document.createElement('div');ground.className='hero-ground';ground.setAttribute('aria-hidden','true');hero.appendChild(ground);
  const tip=document.createElement('div');tip.className='hero-tip';tip.setAttribute('aria-hidden','true');tip.hidden=true;tip.setAttribute('role','presentation');hero.appendChild(tip);
  const zoomBox=document.createElement('div');zoomBox.className='hero-zoom';zoomBox.setAttribute('role','group');hero.appendChild(zoomBox);
  const hint=document.createElement('p');hint.className='hero-hint';hint.setAttribute('aria-hidden','true');hero.appendChild(hint);
  let labels=[],focus=-1,rdBox=null,chipBox=null,stats=[],lastFocus=-2;
  function setReadout(i){if(!rdBox)return;const k=rdBox.querySelector('.dr-k'),tt=rdBox.querySelector('.dr-t'),m=rdBox.querySelector('.dr-m'),bar=rdBox.querySelector('.dr-bar b');if(!k)return;
   const total=records.length||1;
   if(i<0||!stats[i]){k.textContent=t('deckAll');tt.textContent=total.toLocaleString(locale())+' '+t('records');m.textContent=DISCOVERY.length+' '+t('deckFields');bar.style.width='100%';rdBox.style.removeProperty('--fc');rdBox.classList.remove('has-field')}
   else{const d=DISCOVERY[i],st=stats[i];k.textContent=String(i+1).padStart(2,'0')+' · '+t('deckField');tt.textContent=d.title[uiLang==='en'?1:0];m.textContent=st.n.toLocaleString(locale())+' '+t('records')+' · '+st.l+' '+t('deckLangs')+' · '+st.a.toLocaleString(locale())+' '+t('deckAuthors');bar.style.width=Math.max(4,st.n/total*100*3).toFixed(1)+'%';rdBox.style.setProperty('--fc','#'+FIELD[i].getHexString());rdBox.classList.add('has-field')}
   const lines=rdBox.querySelectorAll('.hs-bar i');lines.forEach((el,j)=>el.classList.toggle('hot',i>=0&&j===i%4))}
  function fieldRun(i){try{reset();discoveryIndex=i;populateFilters();render();const el=document.getElementById('catalog');if(el)el.scrollIntoView({block:'start'})}catch{}}
  function buildLabels(){
   const spec=hero.querySelector('.hero-spectrum');if(spec&&spec.parentNode!==labelBox&&!(rdBox&&rdBox.contains(spec)))spec.dataset.home='1';
   labelBox.innerHTML='';labels=[];
   rdBox=document.createElement('div');rdBox.className='deck-read';rdBox.setAttribute('aria-hidden','true');rdBox.innerHTML='<p class="dr-k"></p><p class="dr-t"></p><p class="dr-m"></p><i class="dr-bar"><b></b></i><div class="dr-spec"></div>';
   chipBox=document.createElement('div');chipBox.className='deck-chips';labelBox.appendChild(rdBox);labelBox.appendChild(chipBox);
   if(spec)rdBox.querySelector('.dr-spec').appendChild(spec);
   stats=DISCOVERY.map((d,i)=>{const set=new Set(),au=new Set();let n=0;for(const r of records){let g=-1;try{g=recordArtIndex(r)}catch{}if(g!==i)continue;n++;if(r.language)set.add(r.language);if(r.author)au.add(r.author)}return{n,l:set.size,a:au.size}});
   setReadout(-1);
   zoomBox.setAttribute('aria-label',t('heroZoom'));
   zoomBox.innerHTML=`<button type="button" data-z="in" aria-label="${esc(t('heroZoomIn'))}">+</button><button type="button" data-z="out" aria-label="${esc(t('heroZoomOut'))}">−</button><button type="button" data-z="reset" aria-label="${esc(t('heroZoomReset'))}">⌂</button>`;
   hint.textContent=t('heroHint');
   let groups;try{groups=DISCOVERY}catch{return}
   groups.forEach((d,i)=>{let n=0;for(let k=0;k<rec.n;k++)if(rec.g[k]===i)n++;
    const b=document.createElement('button');b.type='button';b.className='hero-field';b.style.setProperty('--fc','#'+FIELD[i].getHexString());
    const nm=d.title[uiLang==='en'?1:0];b.innerHTML=`<i aria-hidden="true"></i><span>${esc(nm)}</span><small>${n.toLocaleString(locale())}</small>`;
    b.setAttribute('aria-label',`${nm} · ${n.toLocaleString(locale())} ${t('records')}`);
    b.addEventListener('pointerenter',()=>{focus=i});b.addEventListener('pointerleave',()=>{focus=-1});b.addEventListener('focus',()=>{focus=i});b.addEventListener('blur',()=>{focus=-1});
    b.addEventListener('click',()=>fieldRun(i));chipBox.appendChild(b);labels.push({b,ang:i*(2*Math.PI/8)+.35+phase(RMAX*.66)})})}

  /* ---------- post-processing (bloom, dark theme) ---------- */
  let composer=null,bloom=null,useBloom=false,grade=null,caSpike=0,well=0,wellT=0,lensS=0;
  if(post){try{composer=new post.EffectComposer(renderer);composer.addPass(new post.RenderPass(scene,camera));bloom=new post.UnrealBloomPass(new THREE.Vector2(256,256),.56,.6,.24);composer.addPass(bloom);
   if(post.ShaderPass){grade=new post.ShaderPass({uniforms:{tDiffuse:{value:null},uTime:{value:0},uCA:{value:.3},uMouse:{value:new THREE.Vector2(.5,.5)},uLens:{value:0},uAspect:{value:1.6}},
    vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`uniform sampler2D tDiffuse;uniform float uTime,uCA,uLens,uAspect;uniform vec2 uMouse;varying vec2 vUv;
     float hs(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
     void main(){vec2 uv=vUv;vec2 c=uv-.5;
      vec2 d=uv-uMouse;d.x*=uAspect;float r=length(d);float k=uLens*.011/(r*r+.014);vec2 off=vec2(d.x/uAspect,d.y)/(r+1e-4)*k;uv-=off;
      float ca=uCA*(.0012+.010*dot(c,c))+k*.04;
      vec3 col=vec3(texture2D(tDiffuse,uv+c*ca).r,texture2D(tDiffuse,uv).g,texture2D(tDiffuse,uv-c*ca).b);
      float vg=smoothstep(.28,.98,length(c*vec2(uAspect*.62,1.)));col*=1.-.42*vg;
      col+=(hs(uv*vec2(1731.,973.)+fract(uTime))-.5)*.032;
      gl_FragColor=vec4(col,1.);}`});composer.addPass(grade)}}catch{composer=null}}

  /* ---------- layout + theme ---------- */
  let W=24,H=11,portrait=false,quality=1.6,pr=1,gStart=performance.now();
  function layout(){
   const w=sceneEl.clientWidth||innerWidth,h=sceneEl.clientHeight||innerHeight;
   pr=Math.min(devicePixelRatio||1,quality);renderer.setPixelRatio(pr);renderer.setSize(w,h,false);
   if(composer){composer.setPixelRatio(pr);composer.setSize(w,h);if(grade)grade.uniforms.uAspect.value=w/h}
   camera.aspect=w/h;camera.updateProjectionMatrix();
   H=2*CAMZ*Math.tan(FOV*Math.PI/360);W=H*camera.aspect;portrait=camera.aspect<1.05;
   uniforms.uScale.value=renderer.domElement.height/(2*Math.tan(FOV*Math.PI/360));
   const sc=portrait?.52:Math.min(1.3,W/21);
   rig.position.set(portrait?W*.08:(.68-.5)*W,portrait?-H*.2:(.5-.44)*H,-1);rig.scale.setScalar(sc);
   }
  function applyTheme(){
   const light=root.dataset.theme==='light';uniforms.uLight.value=light?1:0;
   mats.forEach(m=>{m.blending=light?THREE.NormalBlending:THREE.AdditiveBlending;m.needsUpdate=true});
   lanes.visible=!light;glow.material.blending=light?THREE.NormalBlending:THREE.AdditiveBlending;glow.material.color.set(light?0xffd9a0:0xffffff);glow.material.needsUpdate=true;
   meteors.forEach(m=>{if(light)m.l.visible=false});
   useBloom=!light&&!!composer;canvas.classList.toggle('screen',useBloom);renderer.setClearColor(0x000000,useBloom?1:0)}
  const draw=()=>{if(useBloom)composer.render();else renderer.render(scene,camera)};

  /* ---------- camera: zoom-to-cursor, pan, intro, scroll ---------- */
  let zoom=1,zoomT=1,pan=new THREE.Vector2(),panT=new THREE.Vector2(),scrollP=0;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const ndcOf=(cx,cy)=>{const r=canvas.getBoundingClientRect();return{x:((cx-r.left)/r.width)*2-1,y:-((cy-r.top)/r.height)*2+1}};
  function zoomAt(f,cx,cy){const n=ndcOf(cx,cy),old=zoomT;zoomT=clamp(zoomT*f,.8,ZMAX);const k=1/old-1/zoomT;panT.x=clamp(panT.x+n.x*W/2*k,-W,W);panT.y=clamp(panT.y+n.y*H/2*k,-H,H);wake()}
  function zoomReset(){zoomT=1;panT.set(0,0);wake()}
  zoomBox.addEventListener('click',e=>{const b=e.target.closest?e.target.closest('[data-z]'):null;if(!b)return;const r=canvas.getBoundingClientRect(),cx=r.left+r.width*.64,cy=r.top+r.height*.5;
   if(b.dataset.z==='in')zoomAt(1.5,cx,cy);else if(b.dataset.z==='out')zoomAt(1/1.5,cx,cy);else zoomReset()});
  const ZMAX=5;
  /* Wheel never traps the page: Ctrl/pinch always zooms; at the top of the page wheel-up zooms in and wheel-down zooms back out
     until the view is reset, after which the page scrolls normally. Anywhere else the page scrolls. */
  hero.addEventListener('wheel',e=>{if(interactive(e.target))return;const dy=e.deltaY;
   if(e.ctrlKey||e.metaKey){e.preventDefault();zoomAt(Math.exp(-dy*.01),e.clientX,e.clientY);return}
   if(scrollY>4)return;
   if(dy<0&&zoomT<ZMAX-.05){e.preventDefault();zoomAt(Math.exp(-dy*.0018),e.clientX,e.clientY)}
   else if(dy>0&&zoomT>1.04){e.preventDefault();zoomAt(Math.exp(-dy*.0018),e.clientX,e.clientY);if(zoomT<1.04)zoomReset()}},{passive:false});
  hero.addEventListener('dblclick',e=>{if(interactive(e.target)||hover>=0)return;if(zoomT>1.4)zoomReset();else zoomAt(2.6,e.clientX,e.clientY)});
    addEventListener('scroll',()=>{scrollP=clamp(scrollY/Math.max(1,hero.clientHeight*.9),0,1)},{passive:true});

  /* ---------- interaction ---------- */
  let px=0,py=0,tx=0,ty=0,yaw=0,pitch=0,vYaw=0,drag=null,hover=-1,mouse={x:-1,y:-1,in:false},time=0,pulseQueued=null;
  const v3=new THREE.Vector3(),dir=new THREE.Vector3();
  const interactive=t=>!!(t&&t.closest&&t.closest('a,button,input,select,textarea,summary,.hero-description,.hero-foot,.eyebrow,.hero-spectrum,.hero-zoom,#paletteOverlay,#recordView'));
  function worldOnPlane(cx,cy,planeZ){const n=ndcOf(cx,cy);v3.set(n.x,n.y,.5).unproject(camera);dir.copy(v3).sub(camera.position).normalize();const t=(planeZ-camera.position.z)/dir.z;return v3.copy(camera.position).addScaledVector(dir,t).clone()}
  function pick(){
   if(!rec.n||!mouse.in){setHover(-1);return}
   const rect=canvas.getBoundingClientRect(),w=rect.width,h=rect.height;let best=-1,bd=18*18;
   tilt.updateMatrixWorld(true);
   for(let i=0;i<rec.n;i++){const ang=rec.a[i]+time*.2/(.7+rec.r[i]*.5);v3.set(Math.cos(ang)*rec.r[i],rec.y[i]+.022*rec.r[i]*rec.r[i]*Math.sin(ang-.6),Math.sin(ang)*rec.r[i]);tilt.localToWorld(v3);v3.project(camera);
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
   if(drag){const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.abs(dx)+Math.abs(dy)>4)drag.moved=true;yaw+=dx*.006/Math.sqrt(zoom);pitch=clamp(pitch+dy*.004,-.5,.5);vYaw=dx*.006/Math.sqrt(zoom);drag.x=e.clientX;drag.y=e.clientY;hero.classList.add('hero-drag');setHover(-1);return}
   uniforms.uMouseOn.value=over?1:0;
   if(over){const p=worldOnPlane(e.clientX,e.clientY,-1);uniforms.uMouse.value.copy(p);pickSoon();if(!tip.hidden)placeTip()}else if(hover>=0)setHover(-1)},{passive:true});
  const touches=new Map();let pinch=0;
  addEventListener('pointerdown',e=>{if(e.pointerType==='touch'&&hero.contains(e.target)&&!interactive(e.target)){touches.set(e.pointerId,{x:e.clientX,y:e.clientY});if(touches.size===2){const [a,b]=[...touches.values()];pinch=Math.hypot(a.x-b.x,a.y-b.y);drag=null}}
   if(e.button>0||!hero.contains(e.target)||interactive(e.target))return;if(touches.size>1)return;drag={x:e.clientX,y:e.clientY,moved:false,t0:performance.now()}});
  addEventListener('pointermove',e=>{if(!touches.has(e.pointerId))return;touches.set(e.pointerId,{x:e.clientX,y:e.clientY});if(touches.size===2){const [a,b]=[...touches.values()],d=Math.hypot(a.x-b.x,a.y-b.y);if(pinch>0)zoomAt(d/pinch,(a.x+b.x)/2,(a.y+b.y)/2);pinch=d}},{passive:true});
  const endTouch=e=>{touches.delete(e.pointerId);if(touches.size<2)pinch=0};
  addEventListener('pointercancel',endTouch);
  addEventListener('pointerup',e=>{endTouch(e);const d=drag;drag=null;hero.classList.remove('hero-drag');
   if(d&&!d.moved&&well>.35){const p=worldOnPlane(e.clientX,e.clientY,-1);uniforms.uPulse.value.set(p.x,p.y,time);caSpike=2.4;wellT=0;return}
   if(d&&!d.moved){const p=worldOnPlane(e.clientX,e.clientY,-1);uniforms.uPulse.value.set(p.x,p.y,time);caSpike=Math.max(caSpike,1.1);
    if(e.pointerType==='touch'){mouse={x:e.clientX,y:e.clientY,in:true};pick();return}   // touch: first tap previews, tapping the card opens
    if(hover>=0)fly(hover)}});
  tip.addEventListener('click',()=>{if(hover>=0)fly(hover)});
  /* Click a star → the camera dives onto it, then the record opens; closing the record flies back out. */
  function fly(i){const r=records[i];if(!r||!window.openRecord)return;
   if(reduced.matches||paused()){window.openRecord(r.id);return}
   const ang=rec.a[i]+time*.2/(.7+rec.r[i]*.5);tilt.updateMatrixWorld(true);v3.set(Math.cos(ang)*rec.r[i],rec.y[i]+.022*rec.r[i]*rec.r[i]*Math.sin(ang-.6),Math.sin(ang)*rec.r[i]);tilt.localToWorld(v3);v3.project(camera);
   const b=canvas.getBoundingClientRect();zoomAt(3.4,b.left+(v3.x*.5+.5)*b.width,b.top+(-v3.y*.5+.5)*b.height);uniforms.uPulse.value.set(uniforms.uMouse.value.x,uniforms.uMouse.value.y,time);caSpike=3;
   setTimeout(()=>window.openRecord(r.id),560)}
  const rvEl=document.getElementById('recordView');if(rvEl&&typeof MutationObserver==='function')new MutationObserver(()=>{if(rvEl.hidden)zoomReset()}).observe(rvEl,{attributes:true,attributeFilter:['hidden']});
  hero.addEventListener('pointerleave',()=>{mouse.in=false;uniforms.uMouseOn.value=0;setHover(-1)});

  /* ---------- loop ---------- */
  let running=true,visible=true,tPrev=0,frames=0,acc=0,degrade=0,introDone=false;const introT0=performance.now();
  const paused=()=>root.classList.contains('effects-paused');
  const wake=()=>{};
  function update(dt){
   time+=dt;uniforms.uTime.value=time;
   if(!drag){yaw+=vYaw;vYaw*=.94;if(Math.abs(vYaw)<1e-4)vYaw=0}
   const k=Math.min(1,dt*6);zoom+=(zoomT-zoom)*k;pan.x+=(panT.x-pan.x)*k;pan.y+=(panT.y-pan.y)*k;
   tx+=(px-tx)*Math.min(1,dt*2.4);ty+=(py-ty)*Math.min(1,dt*2.4);
   const prog=introDone?1:Math.min(1,(performance.now()-introT0)/3200);if(prog>=1)introDone=true;const intro=1-Math.pow(1-prog,3);
   const zEff=zoom*(.62+.38*intro)/(1+scrollP*.55);
   camera.position.set(pan.x+tx*.8/zoom,pan.y-ty*.45/zoom,CAMZ/zEff);camera.lookAt(pan.x,pan.y,0);
   rig.rotation.y=yaw+Math.sin(time*.07)*.12-(1-intro)*.9+scrollP*.45;rig.rotation.x=pitch;
   uniforms.uFade.value=intro*(1-scrollP*.75);
   glow.material.opacity=(root.dataset.theme==='light'?.3:.1)*uniforms.uFade.value+.03*Math.sin(time*.9);
   uniforms.uMouseOn.value+=((mouse.in&&!drag?1:0)-uniforms.uMouseOn.value)*Math.min(1,dt*5);
   /* hold still on the galaxy = singularity: gravity well + lensing; release = shock + chromatic burst */
   wellT=drag&&!drag.moved&&performance.now()-drag.t0>320?1:0;if(wellT)uniforms.uMouseOn.value=Math.max(uniforms.uMouseOn.value,1);
   well+=(wellT-well)*Math.min(1,dt*(wellT?3.2:5));uniforms.uWell.value=well;hero.classList.toggle('hero-well',well>.15);
   if(grade){caSpike=Math.max(0,caSpike-dt*2.2);const zv=Math.abs(zoomT-zoom)*2.2;const tgt=.28+zv+caSpike+well*.9;grade.uniforms.uCA.value+=(tgt-grade.uniforms.uCA.value)*Math.min(1,dt*10);
    grade.uniforms.uTime.value=time;lensS+=(((mouse.in?1:0)*(.3+well*1.5))-lensS)*Math.min(1,dt*6);grade.uniforms.uLens.value=lensS;
    const b=canvas.getBoundingClientRect();grade.uniforms.uMouse.value.set((mouse.x-b.left)/Math.max(1,b.width),1-(mouse.y-b.top)/Math.max(1,b.height))}
   hint.classList.toggle('show',time>1.2&&time<10);
   if(focus!==lastFocus){lastFocus=focus;setReadout(focus)}
   if(labels.length)labels.forEach((l,i)=>{const on=focus===i;l.b.classList.toggle('on',on);l.b.classList.toggle('dim',focus>=0&&!on)});
   if(root.dataset.theme!=='light')meteors.forEach(m=>{m.next-=dt;if(!m.l.visible&&m.next<=0){m.l.visible=true;m.t=0;m.life=1.1+rnd()*.7;m.x=(rnd()-.2)*W*.7;m.y=H*.5-rnd()*H*.25;const a=-.45-rnd()*.3;m.vx=Math.cos(a)*(W*.5);m.vy=Math.sin(a)*(W*.5);m.next=6+rnd()*8}
    if(m.l.visible){m.t+=dt;const kk=m.t/m.life,pos=m.l.geometry.attributes.position,col=m.l.geometry.attributes.color,n=pos.count,hx=m.x+m.vx*m.t*.5,hy=m.y+m.vy*m.t*.5;
     for(let i=0;i<n;i++){const f=i/(n-1);pos.setXYZ(i,hx-m.vx*.09*f*(1-kk*.4),hy-m.vy*.09*f*(1-kk*.4),-4);const b=(1-f)*(1-kk)*.95;col.setXYZ(i,b,b*.93,b*.78)}pos.needsUpdate=true;col.needsUpdate=true;if(kk>=1)m.l.visible=false}});
   uniforms.uFocus.value=focus}
  function frame(now){
   if(!running)return;requestAnimationFrame(frame);
   const dt=Math.min(.05,(now-tPrev)/1000||0);tPrev=now;
   if(!visible||document.hidden||paused()||reduced.matches)return;
   update(dt);draw();
   /* quality governor: bloom -> resolution -> fewer stars -> fewer still (weak GPUs / software rendering) */
   if(degrade<4&&(++frames>=90||(frames>=4&&performance.now()-gStart>1400))){const avg=acc/frames;gStart=performance.now();if(avg>(degrade<2?.026:.04)){degrade++;if(useBloom&&degrade===1){composer=null;useBloom=false;canvas.classList.remove('screen');renderer.setClearColor(0x000000,0)}else{const f=[1,1,1,.7,.55][degrade];quality=f;if(degrade>=3){const keep=degrade===3?.55:.3;dust.geometry.setDrawRange(0,Math.floor(GN*keep));lanes.geometry.setDrawRange(0,Math.floor(LN*keep))}layout()}}frames=0;acc=0}else acc+=dt}
  function still(){introDone=true;time=3.6;update(0.001);draw()}

  /* ---------- wiring ---------- */
  layout();applyTheme();buildRecords();
  sceneEl.classList.add('hero-gl');canvas.classList.add('on');
  if(reduced.matches){still()}
  requestAnimationFrame(t0=>{tPrev=t0;requestAnimationFrame(frame)});
  if(typeof ResizeObserver==='function')new ResizeObserver(()=>{layout();if(reduced.matches||paused())still()}).observe(sceneEl);else addEventListener('resize',()=>layout());
  if(typeof IntersectionObserver==='function')new IntersectionObserver(es=>{visible=es[0].isIntersecting}).observe(sceneEl);
  if(typeof MutationObserver==='function')new MutationObserver(()=>{applyTheme();if(reduced.matches||paused())still()}).observe(root,{attributes:true,attributeFilter:['class','data-theme']});
  if(reduced.addEventListener)reduced.addEventListener('change',()=>{if(reduced.matches)still()});
  document.addEventListener('library:ready',buildRecords);document.addEventListener('library:language',buildLabels);
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();running=false;sceneEl.classList.remove('hero-gl');canvas.remove();labelBox.remove();tip.remove();zoomBox.remove();hint.remove()});
 }
})();
