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
   let lf=null;try{const lm=await import('./vendor/jsm/objects/Lensflare.js');lf={Lensflare:lm.Lensflare,LensflareElement:lm.LensflareElement}}catch{lf=null}   // R7.e: three's own examples/jsm/objects/Lensflare.js (MIT), vendored
   await init(THREE,post,lf)}catch(e){console.error("hero3d",e)}}
 if(document.readyState==='complete')idle(boot);else addEventListener('load',()=>idle(boot),{once:true});

 async function init(THREE,post,lf){
  const canvas=document.createElement('canvas');canvas.id='heroGL';canvas.setAttribute('aria-hidden','true');
  sceneEl.insertBefore(canvas,sceneEl.firstChild);
  let renderer;
  try{renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:false,powerPreference:"high-performance"})}catch(e){console.error("hero renderer",e);canvas.remove();return}
  const PT=window.BKGL?BKGL.perf.track('hero',renderer):null;   // GPU timer for the governor + the ?perf recorder
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
    float sz=mix(1.,.95,uLight)*aS*uScale/-mv.z*tw*(f>1.5?1.4:1.)*(1.+pick*3.2+ring*2.2+g*.7);sz=sz<9.?sz:9.+(sz-9.)*.22;gl_PointSize=clamp(sz,1.,34.);vC=mix(aC,vec3(1.),clamp(pick*.75+ring*.5,0.,1.));vA=tw*min(f,1.5)+pick+ring*1.4+g*.4;}`;
  const frag=rot=>`varying vec3 vC;varying float vA;${rot?'varying float vBig;':''}uniform float uGain,uLight,uFade;void main(){vec2 c=gl_PointCoord-.5;float d=length(c);float a=smoothstep(.5,0.,d);a*=a;
   ${rot?'a=max(a,(exp(-abs(c.x)*46.)*exp(-abs(c.y)*4.)+exp(-abs(c.y)*46.)*exp(-abs(c.x)*4.))*.55*vBig*(1.-d*1.6));':''}
   vec3 base=vC*uGain;float lum=dot(base,vec3(.3,.59,.11));vec3 ink=mix(vec3(lum),base,1.3)*.5;/* light theme: deepened, saturated ink instead of pale additive light */vec3 col=mix(base,ink,uLight);gl_FragColor=vec4(col,clamp(a*vA*uFade*mix(1.,3.2,uLight),0.,1.));}`;
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

  /* ---------- A2 · R7.b GPGPU galaxy (BKSim): the star field lives in 512² position/velocity float textures ----------
     262144 particles — four times the CPU dust layer — with real persistent physics (pointer gravity, click shock, turbulence): the offset from the analytic home is INTEGRATED on the GPU, so a kick deforms the galaxy and it springs back over seconds instead of the old one-frame vertex displacement.
     The home (r, a0, y, twinkle) is a static texture; the vertex shader computes the same log-spiral home as the dust layer and adds the simulated offset — the galaxy can never drift apart and without a kick the picture matches the CPU dust.
     Quality tiers are pure drawRange over the same texture (262144/131072/56000/14000 — no buffer rebuilds). Compute only runs at tiers 0-1; below that the offsets freeze (still a simulated field, just calm) and only the DPR drops.
     The distribution uses its OWN seeded PRNG so the flag-bksim=0 picture (tools/golden/legacy) keeps consuming the exact same rnd() sequence as before. */
  /* R7.f: the 1 048 576-star level. SIMN512 is the classic 512² texture set; SIMN1M the 1024² set (tier 0 = every star, tier 1 = 262 144 with the compute off, then the old counts). The 1024² level opens ONLY with the
     memory signal — a real GPU (not SwiftShader/llvmpipe), navigator.deviceMemory >= 8, a texture limit of 16384+, a desktop pointer and 8+ cores — or when the test flag sim1mforce is set (B17). Unknown signals (Firefox/Safari expose no deviceMemory) stay on 512². */
  const SIMN512=[262144,131072,56000,14000,14000],SIMN1M=[1048576,262144,131072,56000,14000];let SIMN=SIMN512,sim=null;
  function pickSimSize(){
   try{if(!BKGL.flags.get('sim1m'))return 512;
    if(BKGL.flags.get('sim1mforce'))return 1024;
    const p=BKGL.probe(renderer)||{};
    if(/swiftshader|llvmpipe|basic render|software|mesa offscreen/i.test(p.gpu||''))return 512;
    const coarse=typeof matchMedia==='function'&&matchMedia('(pointer: coarse)').matches;
    if(small||coarse)return 512;
    if(!((navigator.deviceMemory||0)>=8&&(p.size||0)>=16384&&(navigator.hardwareConcurrency||0)>=8))return 512;
    return 1024}catch{return 512}}
  /* ---------- R7.c · realistic look, sim path only (the legacy dust layer and its goldens keep the old palette) ----------
     Black-body colour: BKShaders.bakeBlackbody bakes 256 texels of B-V (-.4..2) into a colour ramp; a per-star temperature index aBv
     (an approximate initial mass function per population) picks the texel: hot blue-white O/B stars on the arm ridges and star-forming
     clumps, yellow F/G stars between the arms, orange-red K/M giants in the bulge and halo. The ramp is sRGB-decoded into the linear
     working space exactly like every other hero colour (hex()/THREE.Color does the same).
     Disc-plane pattern uSky (256² RGBA8, built from the SAME arm maths ARMS+phase so it stays glued to the drawn arms): R = dust
     optical depth tau, the lanes hugged to the inner edge of the ridge like the pixel lanes (offset -.24), G = density-wave brightness
     gain (.35 haze .. 1 ridge). The shader applies exp(-tau*k) extinction, reddens beside the lanes and multiplies the density-wave gain.
     The pattern is sampled in the un-rotated disc frame: stars of a kinematic (pure density-wave) galaxy stream through the pattern, but
     the pattern itself must not shear away from the drawn arms. */
  const SKYR=RMAX*1.15,SKUV=+((.5/SKYR).toFixed(8)),HKEEP=[1,1,.75,.5,.3];
  let hotGlow=null,hii=null,hiiN=0,simFxData=null;
  /* ---------- R7.d · the diffuse starlight layer, diffraction beacons and the data-driven field tint (sim path only) ----------
     disc: one plane in the disc frame, shaded analytically — exponential disc, Sersic-2 bulge, a bar, the density-wave arms (uSky.g, the SAME pattern that modulates the stars), fine fbm granularity, star-forming knots, and
     the dust lanes (uSky.r with fbm filaments) absorbing the light beside the ridges. Real galaxy photographs are mostly unresolved light with the resolved stars on top of it; before R7.d only the stars existed.
     MEANING: the glow of each of the library's 8 fields takes that field's colour, scaled by how many records the field holds (fieldFW, 1 = average), and follows the record stars as they stream (same spin as the record layer).
     Hovering a field marker lights its arm and dims the rest (uFocus, the same uniform the record stars use).
     beacons: ~300 of the brightest stars as instanced quads with 4 diffraction spikes (+ faint 45 degree ones on the very brightest) and a PSF core/halo; slow gentle breathing only (photosensitivity: no fast flicker). */
  let disc=null,beacons=null,beaconN=0,grain=null,deepField=null;const BKEEP=[1,.5,0,0,0],fieldFC=Array.from({length:8},()=>new THREE.Vector3()),fieldFW=new Float32Array(8).fill(1);
  /* Additive light into a TRANSPARENT canvas: alpha 1 made every quad an opaque black rectangle wherever the page showed through (black squares round the deep-field galaxies, a hard-edged black slab for the diffuse light plane). Coverage is now the brightest channel and the colour is divided by it, so SRC_ALPHA x colour still adds exactly c. */
  const HADD='vec4 hAdd(vec3 c){float a=clamp(max(c.r,max(c.g,c.b)),0.,1.);return vec4(c/max(a,1e-4),a);}\n';
  const DISC_FRAG=HADD+`varying vec2 vUv;uniform float uTime,uR,uLight,uFade,uFocus,uBar;uniform sampler2D uSky;uniform vec3 uFC[8];uniform float uFW[8];
   float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
   float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1.,0.)),f.x),mix(h(i+vec2(0.,1.)),h(i+vec2(1.,1.)),f.x),f.y);}
   float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*n(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return v;}
   void main(){
    vec2 p=(vUv-.5)*2.*uR;vec2 q=vec2(p.x,-p.y);float r=length(q);float a=atan(q.y,q.x);
    vec2 wq=vec2(fbm(q*1.5+2.),fbm(q*1.5+9.))-.5;   /* domain warp: the ridge wobbles and feathers instead of a clean ribbon */
    vec4 sky=texture2D(uSky,clamp((q+wq*.6)*(.5/uR)+.5,0.,1.));
    float armG=clamp((sky.g-.3)/.7,0.,1.);
    float edge=smoothstep(6.3,4.3,r);
    float disc=exp(-r/3.)*edge;
    float bulge=exp(-3.67*sqrt(sqrt(r*r+.012)/.8));
    float cs=cos(uBar),sn=sin(uBar);float al=dot(q,vec2(cs,sn)),ac=dot(q,vec2(-sn,cs));
    float bar=exp(-pow(abs(al)/1.6,3.)-pow(abs(ac)/.36,2.));
    float g1=fbm(q*2.1+vec2(3.,1.)),g2=fbm(q*5.7+7.);
    float cloud=.62+.7*g1;
    float knot=smoothstep(.6,.86,g2)*armG*smoothstep(1.4,2.4,r)*edge;
    float tauF=sky.r*(.35+1.35*fbm(q*5.2+vec2(1.,4.)));
    float spin=uTime*.2/(.7+r*.5),ph=r*(1.+.06*sin(r*1.7)),sec=.7853982;
    vec3 tint=vec3(0.);float fb=0.;
    for(int j=0;j<8;j++){float d=a-spin-(float(j)*sec+.35+ph);d=atan(sin(d),cos(d));float w=exp(-pow(abs(d/(sec*.45)),2.));
     tint+=uFC[j]*w*uFW[j];if(uFocus>-.5&&abs(float(j)-uFocus)<.5)fb=w;}
    float lum=(disc*(.16+1.7*armG)*cloud*(.75+.5*g2)+bulge*.22+bar*.07)*exp(-tauF*4.6);
    lum=1.-exp(-lum*1.15);   /* soft shoulder: the core and bar roll off instead of clipping to white */
    if(uFocus>-.5)lum*=mix(.78,1.,fb)*(1.+1.4*fb*armG);
    vec3 col=mix(vec3(1.,.8,.52),vec3(1.,.9,.72),smoothstep(.2,1.2,r));
    col=mix(col,vec3(.46,.64,1.),smoothstep(.15,2.2,r)*(.3+.7*armG));
    col=mix(col,vec3(1.,.5,.38),clamp(sky.r*.7,0.,1.)*.5);
    col+=vec3(1.,.38,.55)*knot*1.4;
    col+=tint*armG*.3*smoothstep(.8,2.,r)*(1.-smoothstep(5.2,6.3,r))*(uFocus>-.5?(.4+1.8*fb):1.);
    vec3 outc=col*lum*.2;
    gl_FragColor=mix(hAdd(outc*uFade),vec4(vec3(.22,.17,.26),clamp(lum*.3*uFade,0.,.5)),uLight);}`;
  const BEACON_VERT=`attribute float aR,aA,aY,aM,aT;attribute vec3 aC;uniform float uTime,uScale,uFade;varying vec2 vP;varying vec3 vC;varying float vM,vPx;
   void main(){float ang=aA+uTime*.2/(.7+aR*.5);vec4 wp=modelMatrix*vec4(cos(ang)*aR,aY+.022*aR*aR*sin(ang-.6),sin(ang)*aR,1.);vec4 mv=viewMatrix*wp;
    float tw=.92+.08*sin(uTime*(.35+aT*.9)+aT*60.);float s=(.14+1.25*aM*aM)*tw;
    vPx=uScale*s/-mv.z;vP=position.xy;vC=aC;vM=aM;mv.xy+=position.xy*s;gl_Position=projectionMatrix*mv;}`;
  const BEACON_FRAG=HADD+`varying vec2 vP;varying vec3 vC;varying float vM,vPx;uniform float uFade,uGain,uLight;
   float sp(vec2 c,float k,float w){return exp(-abs(c.x)*k)*exp(-c.y*c.y/(w*w));}
   void main(){vec2 c=vP;float d=length(c);float w=clamp(1.15/vPx,.003,.08);
    float core=exp(-d*d*vPx*vPx*.35);float halo=exp(-d*vPx*.16)*.1+exp(-d*3.4)*.04;
    float spk=sp(c,4.2,w)+sp(c.yx,4.2,w);vec2 e=vec2(c.x+c.y,c.y-c.x)*.7071;spk+=(sp(e,7.,w*1.3)+sp(e.yx,7.,w*1.3))*.4*smoothstep(.6,.9,vM);spk*=smoothstep(.4,.8,vM);
    float edge=1.-smoothstep(.75,1.,max(abs(c.x),abs(c.y)));
    vec3 col=vC*(core*2.4+halo)+mix(vC,vec3(1.),.4)*spk*(.3+.9*vM);
    vec3 dk=col*(.3+.9*vM)*edge*uGain*uFade;
    /* light theme: an atlas star symbol — a small ink dot sized by magnitude and a fine cross on the brighter ones, no halo */
    float dotc=exp(-d*d*vPx*vPx*1.1)*(.55+.45*vM);float crs=(sp(c,9.,w*.7)+sp(c.yx,9.,w*.7))*smoothstep(.4,.8,vM);
    float al=clamp((dotc+crs*.8)*edge*uFade,0.,.92);
    gl_FragColor=mix(hAdd(dk),vec4(.1,.09,.2,al),uLight);}`;
  const simVert=`attribute vec2 aRef;attribute float aS;attribute float aBv;attribute float aT;
   uniform float uTime,uScale,uMouseOn,uLight,uWell,uGain,uArmA,uDust;uniform vec3 uMouse,uPulse;uniform sampler2D tPos,uHome,uSky,uLut;varying vec3 vC;varying float vA;varying float vBig;
   void main(){
    float tw=.8+.2*sin(uTime*(.6+aT*2.4)+aT*60.);
    vec4 hm=texture2D(uHome,aRef);float r=hm.x,a0=hm.y,hy=hm.z;
    float ang=a0+uTime*.2/(.7+r*.5);vec3 off=texture2D(tPos,aRef).xyz;
    vec4 wp=modelMatrix*vec4(cos(ang)*r+off.x,hy+.022*r*r*sin(ang-.6)+off.z,sin(ang)*r+off.y,1.);
    vec2 dm=uMouse.xy-wp.xy;float g=uMouseOn*smoothstep(2.8+uWell*1.6,0.,length(dm));
    float dt=uTime-uPulse.z;float ring=0.;if(dt>0.&&dt<1.7){vec2 dp=wp.xy-uPulse.xy;float rd=abs(length(dp)-dt*7.);ring=exp(-rd*rd*.8)*(1.-dt/1.7);}
    /* R7.c: density wave + dust on the un-rotated disc frame — black-body colour from the LUT, extinction with a reddening shift, arm gain, rim fade */
    vec2 hxy=vec2(cos(a0)*r,sin(a0)*r);
    vec4 sky=texture2D(uSky,clamp(hxy*${SKUV}+.5,0.,1.));
    float tau=sky.r*uDust;vec3 col=texture2D(uLut,vec2(clamp(aBv,0.,1.),.5)).rgb;
    col*=mix(vec3(1.),vec3(1.,.75,.53),smoothstep(.12,.6,sky.r))*exp(-tau*1.1);   /* reddening beside the lanes, then extinction */
    col*=1.+(sky.g-.5)*2.*uArmA;            /* density wave: arms brighter, inter-arm dimmer */
    col*=exp(-max(0.,r-6.1)*.55)*(1.+.22*smoothstep(2.1,0.,r));
    vec4 mv=viewMatrix*wp;gl_Position=projectionMatrix*mv;
    float sz=mix(1.,.95,uLight)*aS*.5*uScale/-mv.z*tw*(1.+ring*2.2+g*.7);sz=sz<9.?sz:9.+(sz-9.)*.22;gl_PointSize=clamp(sz,1.,34.);
    vC=mix(col,vec3(1.),clamp(ring*.5,0.,1.));vA=tw+ring*1.4+g*.4;vBig=smoothstep(.07,.12,aS);}`;
  /* ---------- R7.d2 · the grain: ~600 000 extra faint stars generated PROCEDURALLY in the vertex shader (gl_VertexID → hashed population → the same arm/bulge/haze/halo laws as the sim layer).
     No attribute data (a 1.8 MB dummy position buffer), no compute, no texture: the unresolved powder that makes a galaxy look like one. A power-law magnitude tail: most stars are one pixel, a few are bright.
     Dark: additive black-body stars, dust-extinguished and arm-modulated exactly like the sim stars. Light: STIPPLE ENGRAVING — the same stars as indigo→sepia ink dots on the parchment; density alone draws the tones (dense arms dark, dust lanes paper-light). */
  /* R7.d2 deep field: ~90 distant galaxies fixed behind the scene (one instanced draw). Dark: soft additive ellipses, warm ellipticals and blue spirals with a faint twist.
     Light: the symbols of an engraved atlas — a fine ink ellipse with a faint wash. Pure decoration of depth: they never move with the galaxy, only with the camera parallax. */
  const DF_N=small?40:90,DF_VERT=`attribute vec3 aP;attribute vec4 aQ;attribute vec3 aC;varying vec2 vP;varying vec4 vQ;varying vec3 vC;uniform float uTime;
   void main(){vec4 mv=viewMatrix*modelMatrix*vec4(aP,1.);float sz=aQ.x;vP=position.xy;vQ=aQ;vC=aC;mv.xy+=position.xy*sz;gl_Position=projectionMatrix*mv;}`,
  DF_FRAG=HADD+`varying vec2 vP;varying vec4 vQ;varying vec3 vC;uniform float uFade,uLight;
   void main(){float cr=cos(vQ.z),sr=sin(vQ.z);vec2 q=vec2(cr*vP.x+sr*vP.y,-sr*vP.x+cr*vP.y);q.y/=vQ.y;float d=length(q);
    float tw=vQ.w*d*5.;q=vec2(cos(tw)*q.x-sin(tw)*q.y,sin(tw)*q.x+cos(tw)*q.y);
    float core=exp(-pow(d*3.4,.5)*2.1)*(.7+.3*cos(2.*atan(q.y,q.x+1e-5)*step(.001,vQ.w)));float edge=1.-smoothstep(.8,1.,d);
    float dk=core*edge;
    float ring=exp(-((d-.42)/.045)*((d-.42)/.045))*.55+exp(-d*d*9.)*.28;float al=clamp((ring+dk*.18)*edge,0.,.7);
    gl_FragColor=mix(hAdd(vC*dk*1.7*uFade),vec4(.14,.12,.24,al*uFade*.5),uLight);}`;
  const GRAIN_N=small?150000:600000,GKEEP=[1,.5,.15,0,0];
  const GRAIN_VERT=`
   uniform float uTime,uScale,uLight,uFade,uDust,uArmA;uniform sampler2D uSky,uLut;varying vec3 vC;varying float vA;
   uint grPcg(uint v){uint st=v*747796405u+2891336453u;uint w=((st>>((st>>28u)+4u))^st)*277803737u;return(w>>22u)^w;}
   float grHash(float id,float s){return float(grPcg(grPcg(uint(id))+uint(s*10.+.5)*2246822519u))*(1./4294967296.);}   /* integer PCG hash: the float fract-hashes (bk_hash12/13) correlated their streams and lined stars up along a diagonal through the core */
   float grGauss(float id,float s){return(grHash(id,s)+grHash(id,s+1.3)+grHash(id,s+2.6)+grHash(id,s+3.9)-2.)*1.7;}
   float grPhase(float r){return r*(1.+.06*sin(r*1.7));}
   void main(){
    float id=float(gl_VertexID)+1.;
    float u=grHash(id,.1),k=grHash(id,1.1),m=grHash(id,2.1),t=grHash(id,3.1);float r,a,y,bv;
    if(u<.08){float rho=pow(k,1.6)*1.9,ct=2.*grHash(id,7.1)-1.;r=rho*sqrt(1.-ct*ct);a=6.2831853*m;y=rho*ct*.5;bv=.6+t*.25;}   /* a flattened SPHERE: the old cylindrical (r,y) pair piled stars into a needle along the disc normal */
    else if(u<.2){r=1.+k*7.36;a=6.2831853*m;y=grGauss(id,5.)*.12*max(0.,1.-r/9.6);bv=.42+t*.28;}
    else if(u<.225){r=6.4*(.9+k*1.7);a=6.2831853*m;y=grGauss(id,5.)*(1.4+r*.12);bv=.65+t*.3;}
    else{float aw=grHash(id,4.1)*.87,b=0.,len=1.;
     if(aw>=.36&&aw<.66){b=3.2615927;len=.82;}else if(aw>=.66&&aw<.78){b=2.0707963;len=.5;}else if(aw>=.78){b=4.512389;len=.44;}
     r=(.8+pow(k,.7)*6.24)*len;float e=(.8+.2*sin(2.*(b+grPhase(r))+1.3)+.12*sin(3.*(b+grPhase(r))+.4))/.8;r*=e;
     a=b+grPhase(r)+grGauss(id,9.)*(.13+.08*r);y=grGauss(id,13.)*.1*max(0.,1.-r/8.32);bv=.1+pow(t,2.2)*.42;}
    float ang=a+uTime*.2/(.7+r*.5);
    vec4 wp=modelMatrix*vec4(cos(ang)*r,y+.022*r*r*sin(ang-.6),sin(ang)*r,1.);
    vec4 mv=viewMatrix*wp;gl_Position=projectionMatrix*mv;
    vec4 sky=texture2D(uSky,clamp(vec2(cos(a)*r,sin(a)*r)*${SKUV}+.5,0.,1.));
    float tau=sky.r*uDust;vec3 col=texture2D(uLut,vec2(clamp(bv,0.,1.),.5)).rgb;
    col*=mix(vec3(1.),vec3(1.,.75,.53),smoothstep(.12,.6,sky.r))*exp(-tau*1.1);
    col*=1.+(sky.g-.5)*2.*uArmA;col*=exp(-max(0.,r-6.1)*.55)*(1.+.22*smoothstep(2.1,0.,r));
    float mg=pow(grHash(id,6.1),7.),tw=.86+.14*sin(uTime*(.5+t*2.)+t*60.);
    gl_PointSize=clamp((1.+mg*2.4)*tw*uScale/1700.,1.,5.);
    vec3 ink=mix(vec3(.08,.11,.26),vec3(.34,.19,.09),smoothstep(.32,.9,bv));
    vC=mix(col,ink,uLight);
    float dens=(.55+.9*sky.g)*exp(-tau*1.5);
    vA=mix((.12+mg*.9)*tw,(.3+mg*.55)*dens,uLight);}`;
  const GRAIN_FRAG=`varying vec3 vC;varying float vA;uniform float uGain,uFade;void main(){float d=length(gl_PointCoord-.5);float a=smoothstep(.5,0.,d);gl_FragColor=vec4(vC*uGain,clamp(a*vA*uFade,0.,1.));}`;
  async function buildSim(){
   if(!(window.BKSim&&window.BKShaders&&window.BKGL))return;
   if(!BKGL.flags.get('bksim'))return;
   if(!BKGL.probe(renderer).floatRT)return;
   try{
    const S=pickSimSize(),N=S*S;SIMN=S===1024?SIMN1M:SIMN512;
    let s2=77142693;const srnd=()=>{s2|=0;s2=s2+0x6D2B79F5|0;let t=Math.imul(s2^s2>>>15,1|s2);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296};
    const sgauss=()=>{let u=0;for(let i=0;i<4;i++)u+=srnd();return(u-2)*1.7};
    const home=new Float32Array(N*4),aS=new Float32Array(N),aBv=new Float32Array(N),aT=new Float32Array(N);
    for(let i=0;i<N;i++){if(S>512&&(i&65535)===0&&i)await new Promise(ok=>setTimeout(ok,0));   /* 1024²: the seeded distribution is generated in 65 536-star slices so the main thread never stalls for the ~1 s it takes (the canvas is not shown until buildSim returns) */
     const u=srnd();let r,a,y,kind=0;
     if(u<.085){kind=1;r=Math.pow(srnd(),1.9)*1.7;a=srnd()*Math.PI*2;y=sgauss()*.6*Math.max(0,1-r/2.6)}
     else if(u<.2){kind=2;r=1+srnd()*RMAX*1.15;a=srnd()*Math.PI*2;y=sgauss()*.12*(1-r/(RMAX*1.5))}
     else if(u<.225){kind=3;r=RMAX*(.9+srnd()*1.7);a=srnd()*Math.PI*2;y=sgauss()*(1.4+r*.12)}
     else if(u<.25){kind=4;const x=Math.cos(DW.a)*DW.r+sgauss()*.5,z=Math.sin(DW.a)*DW.r+sgauss()*.4;[r,a]=toPolar(x,z);y=sgauss()*.25}
     else if(u<.268){kind=5;const t=srnd(),ax=Math.cos(ARMS[0].b+phase(RMAX*.95))*RMAX*.95,az=Math.sin(ARMS[0].b+phase(RMAX*.95))*RMAX*.95,bx=Math.cos(DW.a)*DW.r,bz=Math.sin(DW.a)*DW.r;
       const x=ax+(bx-ax)*t+sgauss()*.3*Math.sin(t*Math.PI),z=az+(bz-az)*t+sgauss()*.3*Math.sin(t*Math.PI)+Math.sin(t*3.1)*.7;[r,a]=toPolar(x,z);y=sgauss()*.1}
     else if(u<.55){kind=6;const c=clumps[(srnd()*clumps.length)|0];r=Math.max(.5,c.r+sgauss()*c.s*.9);a=c.a+sgauss()*c.s*.35;y=sgauss()*.06}
     else{let k=srnd(),arm=0,acc=0;for(let j=0;j<ARMS.length;j++){acc+=ARMS[j].w;if(k*1.0<=acc/.87){arm=j;break}}
       r=(.8+Math.pow(srnd(),.7)*(RMAX*1.1-.8))*ARMS[arm].len;r*=edgeK(ARMS[arm].b+phase(r))/.8;a=ARMS[arm].b+phase(r)+sgauss()*(.13+.08*r);y=sgauss()*.1*(1-Math.min(1,r/(RMAX*1.3)))}
     home[i*4]=r;home[i*4+1]=a;home[i*4+2]=y;home[i*4+3]=srnd();
     aS[i]=(kind===1?.024:kind===3?.02:kind===6?.03:.026)+srnd()*.05*(srnd()<.03?3.2:1);aT[i]=srnd();
     /* R7.c temperature (B-V index on the 256-texel LUT ramp) per population — an approximate IMF: arms and clumps young (heavy tail),
        the inter-arm haze and bulge old and warm, the halo red. Pink knots are no longer per-star colours (they moved to the HII sprites). */
     aBv[i]=kind===0?.1+Math.pow(srnd(),2.2)*.42:kind===1?.6+srnd()*.25:kind===2?.42+srnd()*.28:kind===3?.65+srnd()*.3:kind===4?.45+srnd()*.2:kind===5?.1+srnd()*.2:.02+Math.pow(srnd(),1.5)*.3}
    /* black-body LUT (A3 bakeBlackbody) -> linearized like every hero colour */
    let lutTex=null,skyTex=null;
    const LUTN=256,lutData=BKShaders.bakeBlackbody(LUTN),raw=lutData.slice();   /* raw = the canonical sRGB ramp the LUT report shows; on the texture the values are decoded into the linear working space like every hero colour */
     for(let i=0;i<LUTN*4;i++)if(i%4!==3){const v=lutData[i]/255;lutData[i]=Math.round(255*Math.pow(v,2.2))}
     lutTex=new THREE.DataTexture(lutData,LUTN,1,THREE.RGBAFormat);
     lutTex.minFilter=lutTex.magFilter=THREE.LinearFilter;lutTex.wrapS=lutTex.wrapT=THREE.ClampToEdgeWrapping;lutTex.needsUpdate=true;
     /* disc-plane pattern: tau (R), density-wave gain (G) — same arm maths as the drawn arms, deterministic sin-hash noise */
     const SK=256,skyData=new Uint8Array(SK*SK*4),smm=(e,f,x)=>{x=Math.max(0,Math.min(1,(x-e)/(f-e)));return x*x*(3-2*x)},h2=(x,z)=>{const n=Math.sin(x*127.1+z*311.7)*43758.5453;return n-Math.floor(n)};
     let tauMax=0,gMin=1,gMax=0;
     for(let py=0;py<SK;py++)for(let px=0;px<SK;px++){
      const x=((px+.5)/SK*2-1)*SKYR,z=((py+.5)/SK*2-1)*SKYR,r=Math.hypot(x,z),a=Math.atan2(z,x),n1=h2(x*.53+7.1,z*.53),n2=h2(x*1.7+3.7,z*1.7);
      let lane=0,gain=0;
      for(let j=0;j<ARMS.length;j++){const d=Math.atan2(Math.sin(a-(ARMS[j].b+phase(r))),Math.cos(a-(ARMS[j].b+phase(r))));
       const off=.24+.07*Math.sin(r*2.6+a*1.3),ld=(d+off)/(.09+.05*n1);lane=Math.max(lane,Math.exp(-ld*ld));
       const gd=d/(.19+.05*Math.sin(r*1.3));gain=Math.max(gain,Math.exp(-gd*gd))}
      {const al=x*Math.cos(.95)+z*Math.sin(.95),ac=-x*Math.sin(.95)+z*Math.cos(.95);gain=Math.max(gain,.9*Math.exp(-Math.pow(Math.abs(al)/1.6,3)-Math.pow(ac/.36,2)))}   // R7.d the bar: the stars are brighter along it (the glow layer draws the same bar)
      const wD=smm(.7,1.5,r)*(1-smm(5.4,6.05,r)),wG=smm(.25,.9,r)*(1-smm(5.8,6.35,r));
      const tau=lane*wD*(.55+.45*n2)*.95,g=wG*(.35+.65*gain);
      const o=(py*SK+px)*4;skyData[o]=Math.max(0,Math.min(255,Math.round(tau*255)));skyData[o+1]=Math.round(g*255);skyData[o+3]=255;
      if(r>1.5&&r<5.5){if(tau>tauMax)tauMax=tau;if(g<gMin)gMin=g;if(g>gMax)gMax=g}}
     skyTex=new THREE.DataTexture(skyData,SK,SK,THREE.RGBAFormat);skyTex.minFilter=skyTex.magFilter=THREE.LinearFilter;skyTex.wrapS=skyTex.wrapT=THREE.ClampToEdgeWrapping;skyTex.needsUpdate=true;
     sim=await BKSim.create(THREE,renderer,{size:S,home,radius:RMAX,attrs:{aS,aBv,aT},attrSize:{aS:1,aBv:1,aT:1},
      uniforms:{...uniforms,uGain:{value:1.35},uSky:{value:skyTex},uLut:{value:lutTex},uDust:{value:.85},uArmA:{value:.32}},material:{vertexShader:simVert,fragmentShader:frag(true),blending:THREE.AdditiveBlending}});
     if(!sim){try{lutTex.dispose();skyTex.dispose()}catch{}return}
     window.__bkSim=sim;mats.push(sim.material);dust.visible=false;setLevel(degrade,0);
     /* R7.c HII regions: pink emission sprites on the arm ridges, one soft-hot core sprite. Both only exist in the sim branch. */
     hiiN=small?90:150;const H={r:new Float32Array(hiiN),a:new Float32Array(hiiN),y:new Float32Array(hiiN),s:new Float32Array(hiiN),t:new Float32Array(hiiN),c:new Float32Array(hiiN*3),g:new Float32Array(hiiN).fill(-1),i:new Float32Array(hiiN).fill(-1)};
     for(let i=0;i<hiiN;i++){const u=srnd(),arm=u<.4?0:u<.75?1:u<.88?2:3;const r=1.3+Math.pow(srnd(),.75)*RMAX*.92*ARMS[arm].len,p=.75+srnd()*.35;
      H.r[i]=r;H.a[i]=ARMS[arm].b+phase(r)+sgauss()*.05;H.y[i]=sgauss()*.05;H.s[i]=.1+srnd()*.09;H.t[i]=srnd();
      H.c[i*3]=PINK.r*p;H.c[i*3+1]=PINK.g*p;H.c[i*3+2]=PINK.b*p}
     const hb=new THREE.BufferGeometry();attr(hb,'position',new Float32Array(hiiN*3),3);attr(hb,'aR',H.r,1);attr(hb,'aA',H.a,1);attr(hb,'aY',H.y,1);attr(hb,'aS',H.s,1);attr(hb,'aC',H.c,3);attr(hb,'aT',H.t,1);attr(hb,'aG',H.g,1);attr(hb,'aI',H.i,1);
     hii=new THREE.Points(hb,new THREE.ShaderMaterial({vertexShader:vert(true),fragmentShader:`varying vec3 vC;varying float vA;void main(){vec2 c=gl_PointCoord-.5;float d=length(c);float a=(smoothstep(.5,0.,d)+exp(-d*d*5.)*.55)*.5;gl_FragColor=vec4(vC*1.3,a*vA*.42);}`,uniforms:{...uniforms},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));
     hii.frustumCulled=false;mats.push(hii.material);tilt.add(hii);hii.geometry.setDrawRange(0,hiiN);
     const hotTex=(()=>{const c=document.createElement('canvas');c.width=c.height=128;const g2=c.getContext('2d'),r0=g2.createRadialGradient(64,64,0,64,64,64);r0.addColorStop(0,'rgba(255,246,224,1)');r0.addColorStop(.18,'rgba(255,224,170,.5)');r0.addColorStop(1,'rgba(255,200,140,0)');g2.fillStyle=r0;g2.fillRect(0,0,128,128);return new THREE.CanvasTexture(c)})();
     hotGlow=new THREE.Sprite(new THREE.SpriteMaterial({map:hotTex,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,opacity:.5}));hotGlow.scale.set(3.4,3.4,1);rig.add(hotGlow);
     /* R7.d: glow plane + diffraction beacons + field tint colours */
     FIELD.forEach((c,j)=>fieldFC[j].set(c.r,c.g,c.b));
     const discMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,
      uniforms:{uTime:uniforms.uTime,uFade:uniforms.uFade,uLight:uniforms.uLight,uFocus:uniforms.uFocus,uSky:{value:skyTex},uR:{value:SKYR},uFC:{value:fieldFC},uFW:{value:fieldFW},uBar:{value:.95}},
      vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:DISC_FRAG});
     const dg=new THREE.PlaneGeometry(SKYR*2,SKYR*2,1,1);dg.rotateX(-Math.PI/2);
     disc=new THREE.Mesh(dg,discMat);disc.renderOrder=-1;disc.frustumCulled=false;tilt.add(disc);neb.visible=false;mats.push(discMat);
     beaconN=small?120:300;const B={r:new Float32Array(beaconN),a:new Float32Array(beaconN),y:new Float32Array(beaconN),m:new Float32Array(beaconN),t:new Float32Array(beaconN),c:new Float32Array(beaconN*3)},ORANGE=hex('#ffb070');
     for(let i=0;i<beaconN;i++){const u=srnd();let r,a,y,inner=false;
      if(u<.2){inner=true;r=Math.pow(srnd(),1.6)*1.8;a=srnd()*Math.PI*2;y=sgauss()*.25*Math.max(0,1-r/2.4)}
      else{const k=srnd(),arm=k<.55?0:k<.85?1:k<.93?2:3;r=(1.1+Math.pow(srnd(),.8)*RMAX*.95)*ARMS[arm].len;a=ARMS[arm].b+phase(r)+sgauss()*(.1+.05*r);y=sgauss()*.05}
      B.r[i]=r;B.a[i]=a;B.y[i]=y;B.m[i]=Math.pow(srnd(),3.2);B.t[i]=srnd();
      const k=srnd(),c=inner?(k<.7?ORANGE:WARM):(k<.45?ICE:k<.75?BLUE:k<.9?WARM:ORANGE);B.c[i*3]=c.r;B.c[i*3+1]=c.g;B.c[i*3+2]=c.b}
     const bg=new THREE.InstancedBufferGeometry(),pq=new THREE.PlaneGeometry(2,2);bg.index=pq.index;bg.setAttribute('position',pq.attributes.position);
     const ia=(n,a,sz)=>bg.setAttribute(n,new THREE.InstancedBufferAttribute(a,sz));ia('aR',B.r,1);ia('aA',B.a,1);ia('aY',B.y,1);ia('aM',B.m,1);ia('aT',B.t,1);ia('aC',B.c,3);bg.instanceCount=beaconN;
     const bmat=new THREE.ShaderMaterial({vertexShader:BEACON_VERT,fragmentShader:BEACON_FRAG,uniforms:{uTime:uniforms.uTime,uScale:uniforms.uScale,uFade:uniforms.uFade,uLight:uniforms.uLight,uGain:{value:.7}},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending});
     beacons=new THREE.Mesh(bg,bmat);beacons.frustumCulled=false;beacons.renderOrder=3;tilt.add(beacons);mats.push(bmat);
     /* deep field: instanced quads in the scene (not the tilt group) */
     {const n=DF_N,P=new Float32Array(n*3),Q=new Float32Array(n*4),C=new Float32Array(n*3),WARMG=hex('#ffd9a0'),BLUEG=hex('#9fb8ff');
      for(let i=0;i<n;i++){P[i*3]=(srnd()-.5)*58;P[i*3+1]=(srnd()-.5)*30;P[i*3+2]=-12-srnd()*14;
       const spiral=srnd()<.55;Q[i*4]=.25+Math.pow(srnd(),2.2)*1.3;Q[i*4+1]=spiral?.35+srnd()*.6:.55+srnd()*.4;Q[i*4+2]=srnd()*Math.PI;Q[i*4+3]=spiral?(srnd()<.5?-1:1)*(1.2+srnd()*1.6):0;
       const c=spiral?BLUEG:WARMG,m=.6+srnd()*.4;C[i*3]=c.r*m;C[i*3+1]=c.g*m;C[i*3+2]=c.b*m}
      const dg2=new THREE.InstancedBufferGeometry(),pq2=new THREE.PlaneGeometry(2,2);dg2.index=pq2.index;dg2.setAttribute('position',pq2.attributes.position);
      dg2.setAttribute('aP',new THREE.InstancedBufferAttribute(P,3));dg2.setAttribute('aQ',new THREE.InstancedBufferAttribute(Q,4));dg2.setAttribute('aC',new THREE.InstancedBufferAttribute(C,3));dg2.instanceCount=n;
      const dmat=new THREE.ShaderMaterial({vertexShader:DF_VERT,fragmentShader:DF_FRAG,uniforms:{uTime:uniforms.uTime,uFade:uniforms.uFade,uLight:uniforms.uLight},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending});
      deepField=new THREE.Mesh(dg2,dmat);deepField.frustumCulled=false;deepField.renderOrder=-2;scene.add(deepField);mats.push(dmat)}
     const gg2=new THREE.BufferGeometry();gg2.setAttribute('position',new THREE.Int8BufferAttribute(new Int8Array(GRAIN_N*3),3));gg2.setDrawRange(0,GRAIN_N);
     const gmat=new THREE.ShaderMaterial({vertexShader:GRAIN_VERT,fragmentShader:GRAIN_FRAG,uniforms:{uTime:uniforms.uTime,uScale:uniforms.uScale,uLight:uniforms.uLight,uFade:uniforms.uFade,uDust:{value:1.15},uArmA:{value:.4},uSky:{value:skyTex},uLut:{value:lutTex},uGain:{value:.8}},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending});
     grain=new THREE.Points(gg2,gmat);grain.frustumCulled=false;tilt.add(grain);mats.push(gmat);
     simFxData={disc:true,beacons:beaconN,grain:GRAIN_N,deepField:DF_N,armA:.32,tau:+tauMax.toFixed(3),gain:[+gMin.toFixed(3),+gMax.toFixed(3)],hii:hiiN,lut:{blue:[raw[0]/255,raw[1]/255,raw[2]/255],mid:[raw[112*4]/255,raw[112*4+1]/255,raw[112*4+2]/255],red:[raw[255*4]/255,raw[255*4+1]/255,raw[255*4+2]/255]}};
     /* software GL (CI, audit tools): the governor needs four 3-8 s frames to leave tier 0 — by then it has starved every other surface on the page. Start at tier 3 there (compute off, 14 000 points: the v123 frame cost). NOT in ?still (the visual goldens must show what a real GPU renders) and NOT for the B14 tier test (it sets levels explicitly). */
     if(!BKGL.still&&/swiftshader|llvmpipe|basic render|software/i.test((BKGL.probe(renderer).gpu||'')))setLevel(3,0);
    }catch(e){console.warn('BKSim:',e);if(sim){try{sim.dispose()}catch{}}sim=null;window.__bkSim=null;try{lutTex&&lutTex.dispose();skyTex&&skyTex.dispose()}catch{}dust.visible=true;neb.visible=true;if(grain){tilt.remove(grain);grain=null}if(deepField){scene.remove(deepField);deepField=null}if(disc){tilt.remove(disc);disc=null}if(beacons){tilt.remove(beacons);beacons=null}}}

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
    s[i]=((r.collection==='books'?.082:.064)+rnd()*.055)*(sim?.6:1);t[i]=rnd();idx[i]=i;
    const col=FIELD[g];c[i*3]=col.r;c[i*3+1]=col.g;c[i*3+2]=col.b});
   attr(rec.geo,'position',new Float32Array(n*3),3);attr(rec.geo,'aR',rec.r,1);attr(rec.geo,'aA',rec.a,1);attr(rec.geo,'aY',rec.y,1);attr(rec.geo,'aS',s,1);attr(rec.geo,'aC',c,3);attr(rec.geo,'aT',t,1);attr(rec.geo,'aG',rec.g,1);attr(rec.geo,'aI',idx,1);
   rec.geo.boundingSphere=new THREE.Sphere(new THREE.Vector3(),RMAX*6);
   recStars=new THREE.Points(rec.geo,pointMat(true,1.5));recStars.frustumCulled=false;tilt.add(recStars);/* R7.d meaning: each field's glow strength = its share of the library (1 = an average field, square-root compressed: the library is lopsided and a linear map would paint one colour) */
   const cnt=new Float32Array(8);for(let i=0;i<n;i++)cnt[rec.g[i]]++;for(let j=0;j<8;j++)fieldFW[j]=Math.max(.45,Math.min(1.6,Math.sqrt(cnt[j]/(n/8))));
   applyTheme();buildLabels()}

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
  /* a field marker rides on its own spiral arm; pressing it dives the camera into that arm, then opens the field */
  function flyField(i){const l=labels[i];if(!l)return;
   if(reduced.matches||paused()){fieldRun(i);return}
   const rr=hero.getBoundingClientRect();zoomAt(2.5,rr.left+l.x,rr.top+l.y);caSpike=2.2;uniforms.uPulse.value.set(uniforms.uMouse.value.x,uniforms.uMouse.value.y,time);
   setTimeout(()=>{fieldRun(i);setTimeout(zoomReset,500)},620)}
  function placeMarkers(){if(!labels.length)return;const rr=hero.getBoundingClientRect(),w=rr.width,h=rr.height;tilt.updateMatrixWorld(true);
   for(const l of labels){const r=RMAX*.62+(l.i%2?.5:-.3),ang=l.i*(2*Math.PI/8)+.35+phase(r)+time*.2/(.7+r*.5);v3.set(Math.cos(ang)*r,.022*r*r*Math.sin(ang-.6),Math.sin(ang)*r);tilt.localToWorld(v3);v3.project(camera);
    l.vis=v3.z<1;l.x=(v3.x*.5+.5)*w;l.y=(-v3.y*.5+.5)*h;l.b.style.transform=`translate3d(${l.x.toFixed(1)}px,${l.y.toFixed(1)}px,0)`;l.b.style.opacity=l.vis?String(Math.max(0,Math.min(1,uniforms.uFade.value*1.2))):'0'}}
  function fieldRun(i){try{reset();discoveryIndex=i;populateFilters();render();const el=document.getElementById('catalog');if(el)el.scrollIntoView({block:'start'})}catch{}}
  function buildLabels(){
   labelBox.innerHTML='';labels=[];rdBox=null;
   zoomBox.setAttribute('aria-label',t('heroZoom'));
   zoomBox.innerHTML=`<button type="button" data-z="in" aria-label="${esc(t('heroZoomIn'))}">+</button><button type="button" data-z="out" aria-label="${esc(t('heroZoomOut'))}">−</button><button type="button" data-z="reset" aria-label="${esc(t('heroZoomReset'))}">⌂</button><button type="button" data-z="lens" class="hero-lens-btn" aria-pressed="${lensOn}" aria-label="${esc(t('heroLens'))}" title="${esc(t('heroLens'))}">◎</button>`;
   hint.textContent=t('heroHint');
   let groups;try{groups=DISCOVERY}catch{return}
   groups.forEach((d,i)=>{let n=0;for(let k=0;k<rec.n;k++)if(rec.g[k]===i)n++;
    const b=document.createElement('button');b.type='button';b.className='hero-field';b.style.setProperty('--fc','#'+FIELD[i].getHexString());
    const nm=d.title[uiLang==='en'?1:0];b.innerHTML=`<i aria-hidden="true"></i><span>${esc(nm)}</span>`;
    b.setAttribute('aria-label',`${nm} · ${n.toLocaleString(locale())} ${t('records')}`);
    b.addEventListener('pointerenter',()=>{focus=i});b.addEventListener('pointerleave',()=>{focus=-1});b.addEventListener('focus',()=>{focus=i});b.addEventListener('blur',()=>{focus=-1});
    b.addEventListener('click',()=>flyField(i));labelBox.appendChild(b);labels.push({b,i,ang:i*(2*Math.PI/8)+.35+phase(RMAX*.62),x:0,y:0,vis:false})})}

  /* ---------- post-processing (bloom, dark theme) ---------- */
  let bloomOff=false,composer=null,bloom=null,useBloom=false,grade=null,fx=null,pinned=false,caSpike=0,well=0,wellT=0,lensS=0;
  /* gravity lens / singularity is opt-in (default off): the toggle lives in the zoom dock and is remembered */
  let lensOn=false;try{lensOn=localStorage.getItem('bk-hero-lens')==='on'}catch{}
  /* flag fxuber (default on): ONE BKFX chain (scene → half-resolution bloom → uber pass: guard, lens, CA, radial blur, 32³ LUT, vignette, grain, dithering). Off, or if it cannot be built: the old EffectComposer chain below, unchanged. */
  if(window.BKFX&&window.BKShaders&&(!window.BKGL||BKGL.flags.get('fxuber'))){try{fx=BKFX.create(renderer,THREE,{theme:root.dataset.theme==='light'?'light':'dark'})}catch(e){fx=null}}
  if(!fx&&post){try{composer=new post.EffectComposer(renderer);composer.addPass(new post.RenderPass(scene,camera));
   /* Guard against Inf/NaN before bloom: seen on edge-on / zoomed views, thousands of additive points pile into a few pixels, the half-float target overflows to Inf and the bloom blur turns it into NaN,
      which blanks the whole galaxy (dark theme only; the dome drawn afterwards survives). Clamp every pixel to a large finite value and zero NaN. */
   if(post.ShaderPass)composer.addPass(new post.ShaderPass({uniforms:{tDiffuse:{value:null}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:'uniform sampler2D tDiffuse;varying vec2 vUv;void main(){vec4 c=texture2D(tDiffuse,vUv);if(any(isnan(c)))c=vec4(0.);gl_FragColor=min(c,vec4(48.));}'}));
   bloom=new post.UnrealBloomPass(new THREE.Vector2(256,256),.56,.6,.24);composer.addPass(bloom);
   if(post.ShaderPass){grade=new post.ShaderPass({uniforms:{tDiffuse:{value:null},uTime:{value:0},uCA:{value:.3},uMouse:{value:new THREE.Vector2(.5,.5)},uLens:{value:0},uAspect:{value:1.6},uBlur:{value:0},uBlurC:{value:new THREE.Vector2(.5,.5)}},
    vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`uniform sampler2D tDiffuse;uniform float uTime,uCA,uLens,uAspect,uBlur;uniform vec2 uMouse,uBlurC;varying vec2 vUv;
     float hs(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
     void main(){vec2 uv=vUv;vec2 c=uv-.5;
      vec2 d=uv-uMouse;d.x*=uAspect;float r=length(d);float k=uLens*.008/(r*r+.02);vec2 off=vec2(d.x/uAspect,d.y)/(r+1e-4)*k;uv-=off;
      float ca=uCA*(.0012+.010*dot(c,c))+k*.04;
      vec3 col=vec3(texture2D(tDiffuse,uv+c*ca).r,texture2D(tDiffuse,uv).g,texture2D(tDiffuse,uv-c*ca).b);
      if(uBlur>.004){/* dive: radial blur streaming away from the chosen star */vec2 bd=uv-uBlurC;vec3 acc=col;for(int i=1;i<7;i++){acc+=texture2D(tDiffuse,uv-bd*(float(i)/7.)*uBlur*.16).rgb;}col=mix(col,acc/7.,smoothstep(0.,.08,uBlur));}
      float vg=smoothstep(.28,.98,length(c*vec2(uAspect*.62,1.)));col*=1.-.42*vg;
      col+=(hs(uv*vec2(1731.,973.)+fract(uTime))-.5)*.032;
      gl_FragColor=vec4(col,1.);}`});composer.addPass(grade)}}catch{composer=null}}

  /* ---------- observatory dome: real 3D (replaces the 2D silhouette) ----------
     Own tiny orthographic scene drawn over the galaxy, positioned from the horizon coordinates effects.js publishes (BKHorizon).
     Lit hemisphere shell with a slit that tracks the sky, a warm interior, a brass rim; the lamp pulse is published back for the ground reflection. */
  const dome=(()=>{
   try{
    const sc=new THREE.Scene(),cam=new THREE.OrthographicCamera(0,2,2,0,0,1400),g=new THREE.Group();cam.position.set(0,0,700);sc.add(g);   /* the camera sits at z=+700 (frustum z -700..+700, the same scene): Lensflare culls anything with view-space z>0, which is where the lamp is when the slit faces the viewer */
    const body=new THREE.MeshStandardMaterial({color:0x0a1220,roughness:.58,metalness:.4}),brass=new THREE.MeshStandardMaterial({color:0xceac76,roughness:.3,metalness:.92,emissive:0x4a3410,emissiveIntensity:.5});
    const inner=new THREE.MeshBasicMaterial({color:0x8a6228,side:THREE.BackSide}),GAP=.36;
    const base=new THREE.Mesh(new THREE.CylinderGeometry(.74,.9,.95,48,1),body);base.position.y=.475;
    const shell=new THREE.Mesh(new THREE.SphereGeometry(1,64,32,GAP/2,Math.PI*2-GAP,0,Math.PI/2),body);shell.position.y=.95;
    const core=new THREE.Mesh(new THREE.SphereGeometry(.975,48,24,0,Math.PI*2,0,Math.PI/2),inner);core.position.y=.95;
    const rim=new THREE.Mesh(new THREE.TorusGeometry(1,.032,12,96),brass);rim.rotation.x=Math.PI/2;rim.position.y=.95;
    const foot=new THREE.Mesh(new THREE.TorusGeometry(.9,.025,10,96),brass);foot.rotation.x=Math.PI/2;foot.position.y=.04;
    const dom=new THREE.Group();dom.add(shell,core,rim);dom.position.y=0;g.add(base,foot,dom);
    /* B7: the telescope. It sits in the dome's own frame, so it always lies in the slit's meridian plane (tube pitch = elevation); a brass tube with bands and a small blue lens. */
    const tel=new THREE.Group();tel.position.y=.95;dom.add(tel);
    const tube=new THREE.Mesh(new THREE.CylinderGeometry(.05,.068,2.2,20),brass);tube.position.y=.7;tel.add(tube);
    [-.1,.65,1.5].forEach(y=>{const r=new THREE.Mesh(new THREE.TorusGeometry(.07,.013,8,20),brass);r.rotation.x=Math.PI/2;r.position.y=y;tel.add(r)});
    const lens=new THREE.Mesh(new THREE.CircleGeometry(.05,20),new THREE.MeshStandardMaterial({color:0x9fd0ff,emissive:0x4a86c0,emissiveIntensity:.6,metalness:.2,roughness:.05}));lens.position.y=1.81;lens.rotation.x=-Math.PI/2;tel.add(lens);
    /* slit lamp: additive soft sprite at the slit's mid height */
    const lc=document.createElement('canvas');lc.width=lc.height=64;const lx=lc.getContext('2d'),gr=lx.createRadialGradient(32,32,0,32,32,32);gr.addColorStop(0,'rgba(255,226,170,1)');gr.addColorStop(.4,'rgba(255,200,120,.35)');gr.addColorStop(1,'rgba(255,200,120,0)');lx.fillStyle=gr;lx.fillRect(0,0,64,64);
    const lamp=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(lc),blending:THREE.AdditiveBlending,depthWrite:false,transparent:true,opacity:.7}));lamp.scale.setScalar(1.1);g.add(lamp);
    sc.add(new THREE.AmbientLight(0x6f84ad,.55));const key=new THREE.DirectionalLight(0xcfe0ff,1.5);key.position.set(-1.2,1.4,1.6);sc.add(key);
    const warm=new THREE.PointLight(0xffc27a,0,0,2);sc.add(warm);
    /* R7.e Lensflare (three's own): ONE source — the dome lamp. Glare + a ring, two hexagonal ghosts and a violet dot along the line through the frame centre; its occlusion query makes the dome body hide it when the slit turns away. Intensity follows the lamp's breathing and the slit's facing (domeFrame). */
    let flare=null;const fEls=[];
    if(lf&&(!window.BKGL||BKGL.flags.get('flare'))){try{
     const tex=draw=>{const c=document.createElement('canvas');c.width=c.height=128;draw(c.getContext('2d'));return new THREE.CanvasTexture(c)};
     const rad=(x,stops)=>{const r=x.createRadialGradient(64,64,0,64,64,64);stops.forEach(t=>r.addColorStop(t[0],t[1]));x.fillStyle=r;x.fillRect(0,0,128,128)};
     const glowT=tex(x=>rad(x,[[0,'rgba(255,240,210,1)'],[.18,'rgba(255,205,140,.55)'],[1,'rgba(255,190,120,0)']]));
     const ringT=tex(x=>{const r=x.createRadialGradient(64,64,34,64,64,62);r.addColorStop(0,'rgba(140,200,255,0)');r.addColorStop(.55,'rgba(140,200,255,.6)');r.addColorStop(1,'rgba(140,200,255,0)');x.fillStyle=r;x.fillRect(0,0,128,128)});
     const hexT=tex(x=>{x.beginPath();for(let i=0;i<6;i++){const t=i/6*Math.PI*2+Math.PI/6;x.lineTo(64+Math.cos(t)*52,64+Math.sin(t)*52)}x.closePath();const r=x.createRadialGradient(64,64,8,64,64,58);r.addColorStop(0,'rgba(255,200,120,.08)');r.addColorStop(1,'rgba(255,180,100,.36)');x.fillStyle=r;x.fill()});
     const dotT=tex(x=>rad(x,[[0,'rgba(190,160,255,.95)'],[1,'rgba(190,160,255,0)']]));
     flare=new lf.Lensflare();
     [[glowT,420,0,[1,.82,.58]],[ringT,150,.38,[.55,.78,1]],[hexT,80,.62,[1,.78,.5]],[dotT,60,.8,[.75,.62,1]],[hexT,170,1.05,[.5,.85,.8]]].forEach(([t,sz,d,c])=>{const col=new THREE.Color(c[0],c[1],c[2]).multiplyScalar(.36),el=new lf.LensflareElement(t,sz,d,col.clone());el.base=col;el.sz=sz;fEls.push(el);flare.addElement(el)});
     g.add(flare)}catch{flare=null}}
    /* tiers 1-2: the volumetric cone becomes ONE static gradient sprite, in the dome scene behind the dome body */
    let coneS=null;
    try{const c=document.createElement('canvas');c.width=64;c.height=128;const x=c.getContext('2d'),gr=x.createLinearGradient(0,128,0,0);gr.addColorStop(0,'rgba(255,220,160,.55)');gr.addColorStop(.5,'rgba(255,210,150,.18)');gr.addColorStop(1,'rgba(255,200,140,0)');
     x.fillStyle=gr;x.beginPath();x.moveTo(32,128);x.lineTo(2,0);x.lineTo(62,0);x.closePath();x.fill();
     const pg=new THREE.PlaneGeometry(1,1);pg.translate(0,.5,0);coneS=new THREE.Mesh(pg,new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(c),transparent:true,blending:THREE.AdditiveBlending,depthWrite:false}));coneS.visible=false;coneS.position.z=-200;sc.add(coneS)}catch{coneS=null}
    return{sc,cam,g,dom,tel,body,brass,inner,lamp,warm,flare,fEls,coneS,light:false,ready:false,lampK:.7,ry:2.62,fa:0,fe:.95,va:0,ve:0}
   }catch{return null}})();
  function domeTheme(light){if(!dome)return;dome.body.color.set(light?0x2a4054:0x0a1220);dome.brass.color.set(light?0x9a6a3a:0xceac76);dome.inner.color.set(light?0xc78a3c:0x8a6228);dome.light=light;if(dome.flare)dome.flare.visible=!light&&degrade<=1;if(dome.coneS&&light)dome.coneS.visible=false}
  let domeDt=0,domeAim=null,aimDolly=0,introCutT=0,introP=0;const domeCone={u:.5,v:.4},vLamp=new THREE.Vector3(),INTRO_MS=2400,flag=n=>!window.BKGL||BKGL.flags.get(n);
  /* R7.e: the dome is a second-order spring (natural frequency wn, damping ratio .8 → ~1.5 % overshoot, a real telescope drive settling), not exponential smoothing; sub-stepped so it is exact at the 50 ms frame cap */
  function domeSpring(d,ta,te,dt,wn){const z=.8,n=Math.max(1,Math.ceil(dt/.008)),h=dt/n;for(let i=0;i<n;i++){d.va+=(wn*wn*(ta-d.fa)-2*z*wn*d.va)*h;d.fa+=d.va*h;d.ve+=(wn*wn*(te-d.fe)-2*z*wn*d.ve)*h;d.fe+=d.ve*h}}
  function domeFrame(dt,cw,ch){
   if(!dome)return false;const hz=window.BKHorizon;if(!hz||!hz.w||!cw)return false;
   dome.cam.right=cw;dome.cam.top=ch;dome.cam.updateProjectionMatrix();
   const s=clamp(hz.w/1440,.8,1.35)*56;dome.g.scale.setScalar(s);dome.g.position.set(hz.ox,ch-hz.oy-s*.12,0);
   /* the slit slowly tracks across the sky (a real dome follows its target), the lamp breathes */
   /* B7: the dome follows the pointer (slit turns toward it) and the telescope lifts or lowers with it; idle, it tracks the sky slowly */
   /* the aim: a clicked star (fly) overrides the pointer for ~1.8 s — the telescope slews onto it with the snappier drive (wn 9.5 vs 6) */
   const sr=sceneEl.getBoundingClientRect(),aim=domeAim&&time<domeAim.until?domeAim:null,px0=aim?aim.x:mouse.x,py0=aim?aim.y:mouse.y,inHero=aim?true:(mouse&&mouse.x>=0&&mouse.in),tx=inHero?clamp((px0-sr.left-hz.ox)/(hz.w*.5),-1,1):0,ty=inHero?clamp((py0-sr.top-hz.oy)/(sr.height*.8),-1,1):0;
   domeSpring(dome,tx*.42,.95-ty*.4,Math.min(.05,domeDt||.016),aim?9.5:6);
   dome.dom.rotation.y=dome.ry+dome.fa+Math.sin(time*.045)*(inHero?.05:.3);
   dome.tel.rotation.z=Math.PI/2-clamp(dome.fe,.45,1.5);if(window.BKDome)window.BKDome.state={ry:+dome.dom.rotation.y.toFixed(3),el:+dome.fe.toFixed(3)};
   const breathe=.62+.38*Math.sin(time*1.4+1.2);dome.lampK=breathe;
   const a=dome.dom.rotation.y;/* slit direction in the group's frame = -x rotated by a about y */
   dome.lamp.position.set(-Math.cos(a)*.93*.84,.95+.62,Math.sin(a)*.93*.84);dome.lamp.material.opacity=(dome.light?.85:.7)*(.55+.45*breathe)*(Math.cos(a)<0?1:.25);
   dome.warm.position.set(hz.ox-Math.cos(a)*s*.9,ch-hz.oy+s*1.5,Math.sin(a)*s*.9+s*.8);dome.warm.intensity=(dome.light?1.1:1.6)*s*s*(.6+.4*breathe);
   hz.lamp=breathe*(Math.cos(a)<0?1:.35);hz.live=true;
   /* R7.e: the lamp in screen space drives the light cone (apex, axis = the telescope's line of sight: (-cos el·cos az, sin el)), the Lensflare and the slew blur */
   const facing=Math.cos(a)<0?1:.35,fe=clamp(dome.fe,.45,1.5),fade=uniforms.uFade.value;
   dome.g.updateMatrixWorld(true);dome.lamp.getWorldPosition(vLamp);domeCone.u=vLamp.x/cw;domeCone.v=vLamp.y/ch;
   if(fx){const c=fx.cone;c.apex.set(domeCone.u,domeCone.v);c.dir.set(-Math.cos(fe)*Math.cos(a),Math.sin(fe));c.strength=.3*(.6+.4*breathe)*facing*fade;c.steps=24;c.enabled=!dome.light&&degrade<=0&&flag('cone')&&fade>.04}   /* the governor switches the whole post chain off at tier >= 1, so the 24-step cone lives at tier 0 only; tiers 1-2 get the gradient sprite below */
   if(dome.flare){dome.flare.position.copy(dome.lamp.position);const f=(.6+.4*breathe)*facing*fade;for(const e of dome.fEls){e.color.copy(e.base).multiplyScalar(f);e.size=e.sz*pr}}
   if(dome.coneS){const on=!dome.light&&degrade>=1&&degrade<=2&&flag('cone')&&fade>.04;dome.coneS.visible=on;
    if(on){const L=ch*.8,W=L*Math.tan(.15)*2;dome.coneS.position.set(vLamp.x,vLamp.y,-200);dome.coneS.scale.set(W,L,1);dome.coneS.rotation.z=Math.atan2(Math.sin(fe),-Math.cos(fe)*Math.cos(a))-Math.PI/2;dome.coneS.material.opacity=.7*(.6+.4*breathe)*facing*fade}}
   return true}
  function domeDraw(){
   if(!dome)return;const cw=renderer.domElement.clientWidth||sceneEl.clientWidth,ch=renderer.domElement.clientHeight||sceneEl.clientHeight;
   if(!domeFrame(0,cw,ch)){if(window.BKHorizon)window.BKHorizon.live=false;return}
   const a=renderer.autoClear;renderer.autoClear=false;renderer.clearDepth();renderer.render(dome.sc,dome.cam);renderer.autoClear=a;
   if(!dome.ready){dome.ready=true;window.BKDome={on:true};document.dispatchEvent(new CustomEvent('bk:dome'))}}

  /* ---------- scroll camera path: a CatmullRom spline for the eye and one for its target, sampled by eased scroll progress ---------- */
  let camPath=null,lookPath=null;const cp=new THREE.Vector3(0,0,14),cl=new THREE.Vector3();
  function buildPath(){const V=(x,y,z)=>new THREE.Vector3(x,y,z);
   camPath=new THREE.CatmullRomCurve3([V(0,0,CAMZ),V(W*.012,H*.025,CAMZ*1.13),V(W*.04,H*.085,CAMZ*1.36),V(W*.075,H*.18,CAMZ*1.55)],false,'centripetal');
   lookPath=new THREE.CatmullRomCurve3([V(0,0,0),V(W*.008,H*.02,0),V(W*.025,H*.065,0),V(W*.045,H*.13,0)],false,'centripetal')}
  /* ---------- layout + theme ---------- */
  let W=24,H=11,portrait=false,quality=1.6,pr=1,gStart=performance.now();
  function layout(){
   const w=sceneEl.clientWidth||innerWidth,h=sceneEl.clientHeight||innerHeight;
   pr=Math.min(devicePixelRatio||1,quality);renderer.setPixelRatio(pr);renderer.setSize(w,h,false);
   if(composer){composer.setPixelRatio(pr);composer.setSize(w,h);if(grade)grade.uniforms.uAspect.value=w/h}
   if(fx){fx.setSize(renderer.domElement.width,renderer.domElement.height);fx.u.uAspect=w/h}
   camera.aspect=w/h;camera.updateProjectionMatrix();
   H=2*CAMZ*Math.tan(FOV*Math.PI/360);W=H*camera.aspect;portrait=camera.aspect<1.05;
   uniforms.uScale.value=renderer.domElement.height/(2*Math.tan(FOV*Math.PI/360));
   buildPath();
   const sc=portrait?.52:Math.min(1.3,W/21);
   rig.position.set(portrait?W*.08:(.68-.5)*W,portrait?-H*.2:(.5-.44)*H,-1);rig.scale.setScalar(sc);
   }
  function applyTheme(){
   const light=root.dataset.theme==='light';uniforms.uLight.value=light?1:0;domeTheme(light);if(fx)fx.setTheme(light?'light':'dark');
   mats.forEach(m=>{m.blending=light?THREE.NormalBlending:THREE.AdditiveBlending;m.needsUpdate=true});
   lanes.visible=!light;if(beacons)beacons.visible=beacons.geometry.instanceCount>0;glow.material.blending=light?THREE.NormalBlending:THREE.AdditiveBlending;glow.material.color.set(light?0xffd9a0:0xffffff);glow.material.needsUpdate=true;
   if(hotGlow){hotGlow.material.blending=light?THREE.NormalBlending:THREE.AdditiveBlending;hotGlow.material.color.set(light?0xffb86e:0xffffff);hotGlow.material.needsUpdate=true}
   meteors.forEach(m=>{if(light)m.l.visible=false});
   syncBloom()}
  /* bloom is used on the dark theme while the composer exists and the governor has not suspended it */
  function syncBloom(){useBloom=root.dataset.theme!=='light'&&!!(composer||fx)&&!bloomOff;canvas.classList.toggle('screen',useBloom);renderer.setClearColor(0x000000,useBloom?1:0)}
  const draw=()=>{if(useBloom){if(fx){fx.bloom.enabled=uniforms.uFade.value>.02;fx.render(scene,camera)}else composer.render()}else renderer.render(scene,camera);domeDraw()};

  /* ---------- camera: zoom-to-cursor, pan, intro, scroll ---------- */
  let zoom=1,zoomT=1,pan=new THREE.Vector2(),panT=new THREE.Vector2(),scrollP=0,scrollS=NaN,blurK=0,blurT=0;const blurC=new THREE.Vector2(.5,.5);
  const MO=window.BKMotion,dmp=MO?MO.damp:(c,t,l,d)=>t+(c-t)*Math.exp(-l*d);
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const ndcOf=(cx,cy)=>{const r=canvas.getBoundingClientRect();return{x:((cx-r.left)/r.width)*2-1,y:-((cy-r.top)/r.height)*2+1}};
  function zoomAt(f,cx,cy){const n=ndcOf(cx,cy),old=zoomT;zoomT=clamp(zoomT*f,.8,ZMAX);const k=1/old-1/zoomT;panT.x=clamp(panT.x+n.x*W/2*k,-W,W);panT.y=clamp(panT.y+n.y*H/2*k,-H,H);wake()}
  function zoomReset(){zoomT=1;panT.set(0,0);wake()}
  zoomBox.addEventListener('click',e=>{const b=e.target.closest?e.target.closest('[data-z]'):null;if(!b)return;const r=canvas.getBoundingClientRect(),cx=r.left+r.width*.64,cy=r.top+r.height*.5;
   if(b.dataset.z==='lens'){lensOn=!lensOn;try{localStorage.setItem('bk-hero-lens',lensOn?'on':'off')}catch{}b.setAttribute('aria-pressed',String(lensOn));return}
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
  const readScroll=()=>{scrollP=clamp(scrollY/Math.max(1,hero.clientHeight*.9),0,1)};addEventListener('scroll',readScroll,{passive:true});readScroll();

  /* ---------- interaction ---------- */
  let px=0,py=0,tx=0,ty=0,yaw=0,pitch=0,vYaw=0,drag=null,hover=-1,mouse={x:-1,y:-1,in:false},time=0,pulseQueued=null;
  const v3=new THREE.Vector3(),dir=new THREE.Vector3();
  const interactive=t=>!!(t&&t.closest&&t.closest('a,button,input,select,textarea,summary,.hero-description,.hero-foot,.eyebrow,.hero-spectrum,.hero-zoom,#paletteOverlay,#recordView'));
  function worldOnPlane(cx,cy,planeZ){const n=ndcOf(cx,cy);v3.set(n.x,n.y,.5).unproject(camera);dir.copy(v3).sub(camera.position).normalize();const t=(planeZ-camera.position.z)/dir.z;return v3.copy(camera.position).addScaledVector(dir,t).clone()}
  /* pointer → the galaxy disc's OWN plane in tilt-local coords: BKSim integrates in the disc's frame, so the pointer's gravity must live there too */
  const simP=new THREE.Vector3(),simO=new THREE.Vector3(),simQ=new THREE.Vector3();
  function simPoint(cx,cy){tilt.updateMatrixWorld(true);const n=ndcOf(cx,cy);simP.set(n.x,n.y,.5).unproject(camera);
   simO.copy(camera.position);tilt.worldToLocal(simO);tilt.worldToLocal(simP);simP.sub(simO);
   if(Math.abs(simP.y)<1e-6)return null;const t=-simO.y/simP.y;if(t<0)return null;return simQ.copy(simO).addScaledVector(simP,t)}
  const simPulse=new THREE.Vector3(0,0,-99);let simPulseT=-99;
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
   const b=canvas.getBoundingClientRect(),sx=b.left+(v3.x*.5+.5)*b.width,sy=b.top+(-v3.y*.5+.5)*b.height;
   domeAim={x:sx,y:sy,until:time+1.8};   // R7.e: the telescope slews onto the star (spring), the camera pushes in 3 %
   zoomAt(3.4,sx,sy);uniforms.uPulse.value.set(uniforms.uMouse.value.x,uniforms.uMouse.value.y,time);caSpike=3;
   blurC.set(v3.x*.5+.5,v3.y*.5+.5);blurT=1;
   /* ghost cover: the star becomes a book that grows toward the reader; the record then morphs out of it (view transition 'bk-cover') */
   let ghost=null;
   try{ghost=document.createElement('div');ghost.className='fly-ghost';ghost.setAttribute('aria-hidden','true');ghost.style.cssText=`--fc:#${FIELD[rec.g[i]].getHexString()};left:${sx}px;top:${sy}px`;ghost.innerHTML='<div class="card-illustration"></div>';document.body.appendChild(ghost);
    const tx0=innerWidth*.5-sx,ty0=innerHeight*.46-sy;
    if(ghost.animate)ghost.animate([{transform:'translate(-50%,-50%) scale(.2)',opacity:0},{transform:'translate(-50%,-50%) scale(1)',opacity:1,offset:.25},{transform:`translate(calc(-50% + ${tx0*.55}px),calc(-50% + ${ty0*.55}px)) scale(5.2)`,opacity:1}],{duration:560,easing:'cubic-bezier(.45,0,.2,1)',fill:'forwards'})}catch{ghost=null}
   flyBack={id:r.id,sx,sy,col:'#'+FIELD[rec.g[i]].getHexString(),t:performance.now()};
   setTimeout(()=>{window.openRecord(r.id,ghost);blurT=0;if(ghost)setTimeout(()=>ghost.remove(),1100)},560)}
  /* A2: closing a record that was opened from a star flies its cover back into that star (mirror of the dive) */
  let flyBack=null;
  document.addEventListener('bk:record-closing',e=>{const fb=flyBack,d=e.detail;flyBack=null;
   if(!fb||!d||d.id!==fb.id||performance.now()-fb.t>6e5||reduced.matches||paused()||!d.rect||!d.rect.width)return;
   try{const g=document.createElement('div');g.className='fly-ghost fly-return';g.setAttribute('aria-hidden','true');g.style.cssText=`--fc:${fb.col};left:${fb.sx}px;top:${fb.sy}px;opacity:1`;g.innerHTML='<div class="card-illustration"></div>';document.body.appendChild(g);
    const cx=d.rect.left+d.rect.width/2,cy=d.rect.top+d.rect.height/2,k=Math.max(1,d.rect.width/34);
    const an=g.animate([{transform:`translate(calc(-50% + ${cx-fb.sx}px),calc(-50% + ${cy-fb.sy}px)) scale(${k})`,opacity:1},{transform:'translate(-50%,-50%) scale(.22)',opacity:.9,offset:.82},{transform:'translate(-50%,-50%) scale(.1)',opacity:0}],{duration:560,easing:'cubic-bezier(.45,0,.2,1)',fill:'forwards'});
    an.onfinish=()=>g.remove();setTimeout(()=>g.remove(),900);
    setTimeout(()=>{caSpike=Math.max(caSpike,1.4)},470)}catch{}});
  /* test hook: only exposed when localStorage bk-test=1 (the audit tools set it) */
  if((()=>{try{return localStorage.getItem('bk-test')==='1'}catch{return false}})())window.BKHero={aim:(x,y)=>{domeAim={x,y,until:time+4};return true},introRestart:()=>{introDone=false;introCutT=0;introT0=performance.now();return true},dome:()=>dome?{fa:+dome.fa.toFixed(4),fe:+dome.fe.toFixed(4),va:+dome.va.toFixed(4),ve:+dome.ve.toFixed(4),aiming:!!(domeAim&&time<domeAim.until),cone:!!(fx&&fx.cone.enabled),coneSteps:fx?fx.cone.steps:0,coneStrength:fx?+fx.cone.strength.toFixed(3):0,flare:!!(dome.flare&&dome.flare.visible),flareReady:!!dome.flare,coneSprite:!!(dome.coneS&&dome.coneS.visible)}:null,fly:i=>fly(i),count:()=>rec.n,info:()=>heroInfo(),simSample:()=>sim?sim.sample():null,layer:(k,v)=>{const o={disc,beacons,hot:hotGlow,glow,hii,neb,grain,deep:deepField,flare:dome&&dome.flare,sim:sim&&sim.points}[k];if(!o)return false;o.visible=!!v;draw();return true},simFx:()=>simFxData&&{...simFxData,grainShown:grain?grain.geometry.drawRange.count:0,deepShown:!!(deepField&&deepField.visible),fieldW:Array.from(fieldFW),beaconsShown:beacons?beacons.geometry.instanceCount:0,discShown:!!(disc&&disc.visible)},simKick:()=>{if(!sim)return false;tilt.updateMatrixWorld(true);const p=tilt.localToWorld(new THREE.Vector3(0,0,0));uniforms.uPulse.value.set(p.x,p.y,time);return true},gov:{pin:v=>{pinned=!!v},level:()=>degrade,setLevel:l=>{setLevel(l,performance.now());return degrade},feed:(avg,now,gpu)=>govern(avg,now,gpu),lock:()=>recLock,reset:()=>{good=0;recLock=0;lastRec=-1e9;if(degrade!==0)setLevel(0,0);lastChange=-1e9;return degrade}}};/* test hook (tools/motion_audit.py, tools/feature_audit.py B14) */
  /* what the post chain costs, from the objects that run (tools/gpu_budget_audit.py --fx-compare): logical passes, full-screen draws, full-resolution reads, render targets */
  function heroInfo(){const o={fx:fx?'uber':composer?'legacy':'none',bloom:useBloom,level:degrade,flare:!!(dome&&dome.flare&&dome.flare.visible),intro:{p:+introP.toFixed(3),done:introDone,cut:!!introCutT},sim:sim?'gpu':'cpu',simSize:sim?sim.size:0,particles:sim?SIMN[Math.min(degrade,4)]:GN,drawn:sim?sim.drawn:Math.floor(GN*QKEEP[degrade])};
   if(fx){const i=fx.info();return{...o,passes:useBloom?i.passes:1,draws:useBloom?i.draws:0,fullReads:useBloom?i.fullReads:0,targets:i.targets,streak:!!(useBloom&&i.streak),cone:!!(useBloom&&i.cone)}}
   if(composer){let passes=0,draws=0,fullReads=0,targets=2;   // the composer's two full-resolution ping-pong targets
    if(!useBloom)return{...o,passes:1,draws:0,fullReads:0,targets}
    for(const p of composer.passes){if(p.enabled===false)continue;passes++;
     if(p===bloom){draws+=1+2*bloom.nMips+1+1;fullReads+=1;targets+=1+2*bloom.nMips}   // bright pass reads the full image; blurs, composite and the additive blend work at half size or below
     else if(p.fsQuad){draws++;fullReads++}}
    return{...o,passes,draws,fullReads,targets}}
   return{...o,passes:1,draws:0,fullReads:0,targets:0}}
  const rvEl=document.getElementById('recordView');if(rvEl&&typeof MutationObserver==='function')new MutationObserver(()=>{if(rvEl.hidden)zoomReset()}).observe(rvEl,{attributes:true,attributeFilter:['hidden']});
  hero.addEventListener('pointerleave',()=>{mouse.in=false;uniforms.uMouseOn.value=0;setHover(-1)});

  /* ---------- loop ---------- */
  let running=true,visible=true,tPrev=0,frames=0,acc=0,degrade=0,introDone=false,introT0=performance.now();
  const paused=()=>root.classList.contains('effects-paused');
  const wake=()=>{};
  function update(dt){
   time+=dt;domeDt=dt;uniforms.uTime.value=time;
   if(!drag){yaw+=vYaw;vYaw*=.94;if(Math.abs(vYaw)<1e-4)vYaw=0}
   zoom=dmp(zoom,zoomT,6.5,dt);pan.x=dmp(pan.x,panT.x,6.5,dt);pan.y=dmp(pan.y,panT.y,6.5,dt);
   tx=dmp(tx,px,2.4,dt);ty=dmp(ty,py,2.4,dt);
   if(scrollS!==scrollS)scrollS=scrollP;scrollS=dt>0.002?dmp(scrollS,scrollP,4.2,dt):scrollS;const sp=MO?MO.ease.smooth(scrollS):scrollS;
   /* R7.e cinematic entrance: 2.4 s dolly-in from 6 units back along a slight spiral (the yaw swing and the fade ride the same eased progress); ANY deliberate input (press, wheel, key, touch, scroll) cancels it — the remainder is blended out over 350 ms, never a jump; reduced-motion never starts it (still()) */
   const nowI=performance.now();let prog=introDone?1:Math.min(1,(nowI-introT0)/INTRO_MS);
   if(introCutT&&prog<1){const k=Math.min(1,(nowI-introCutT)/350);prog+=(1-prog)*k*k*(3-2*k);if(k>=1)prog=1}
   if(prog>=1)introDone=true;introP=prog;const intro=1-Math.pow(1-prog,3),ip=1-intro;
   aimDolly=dmp(aimDolly,(domeAim&&time<domeAim.until)?1:0,5,dt);
   const zEff=zoom*(1+.03*aimDolly);
   camPath.getPoint(sp,cp);lookPath.getPoint(sp,cl);
   camera.position.set(pan.x+cp.x+tx*.8/zoom+Math.sin(ip*2.6)*ip*1.6,pan.y+cp.y-ty*.45/zoom+(1-Math.cos(ip*2.6))*ip*.7,cp.z/zEff+ip*6);camera.lookAt(pan.x+cl.x,pan.y+cl.y,0);
   rig.rotation.y=yaw+Math.sin(time*.07)*.12-(1-intro)*.9+sp*.45;rig.rotation.x=pitch;
   uniforms.uFade.value=intro*(1-sp*.75);
   glow.material.opacity=(root.dataset.theme==='light'?.3:.1)*uniforms.uFade.value+.03*Math.sin(time*.9);
   if(hotGlow)hotGlow.material.opacity=(root.dataset.theme==='light'?.14:(disc?.2:.5))*uniforms.uFade.value+.02*Math.sin(time*1.3);
   uniforms.uMouseOn.value+=((mouse.in&&!drag?1:0)-uniforms.uMouseOn.value)*Math.min(1,dt*5);
   /* hold still on the galaxy = singularity: gravity well + lensing; release = shock + chromatic burst */
   wellT=lensOn&&drag&&!drag.moved&&performance.now()-drag.t0>320?1:0;if(wellT)uniforms.uMouseOn.value=Math.max(uniforms.uMouseOn.value,1);
   well+=(wellT-well)*Math.min(1,dt*(wellT?3.2:5));uniforms.uWell.value=well;hero.classList.toggle('hero-well',well>.15);
   /* the GPGPU galaxy: one compute pass per animation frame (tier 0 only — the GPU work is what the governor exists to shed; dt<=0.01 = still() → the sim never moves in a captured frame) */
   if(sim&&dt>.01&&degrade<=0){
    if(uniforms.uPulse.value.z!==simPulseT){simPulseT=uniforms.uPulse.value.z;simPulse.set(0,0,simPulseT);
     if(simPulseT>0){simQ.set(uniforms.uPulse.value.x,uniforms.uPulse.value.y,-1);tilt.updateMatrixWorld(true);tilt.worldToLocal(simQ);simPulse.set(simQ.x,simQ.z,simPulseT)}}
    const mp=mouse.in?simPoint(mouse.x,mouse.y):null;
    sim.step(dt,{time,mouse:mp&&[mp.x,mp.z],mouseOn:uniforms.uMouseOn.value,pulse:[simPulse.x,simPulse.z,simPulseT],well})}
   if(grade||fx){const gv=n=>fx?fx.u[n]:grade.uniforms[n].value,gs=(n,v)=>{if(fx)fx.u[n]=v;else grade.uniforms[n].value=v};   // the uber chain and the legacy grade pass take the same uniforms
    caSpike=Math.max(0,caSpike-dt*2.2);const zv=Math.abs(zoomT-zoom)*2.2;const tgt=.28+zv+caSpike+well*.9;gs('uCA',gv('uCA')+(tgt-gv('uCA'))*Math.min(1,dt*10));
    gs('uTime',time);const slewB=dome?Math.min(.3,Math.max(0,Math.hypot(dome.va,dome.ve)*.8-.14)*.5):0;if(!blurT&&slewB>.002)blurC.set(domeCone.u,domeCone.v);   // R7.e speed-based radial blur while the telescope slews
    blurK=dmp(blurK,Math.max(blurT,slewB),blurT?7:4.5,dt);gs('uBlur',blurK);gv('uBlurC').copy(blurC);lensS+=(((lensOn&&mouse.in?1:0)*(.22+well*1.1))-lensS)*Math.min(1,dt*6);gs('uLens',lensS);
    const b=canvas.getBoundingClientRect();gv('uMouse').set((mouse.x-b.left)/Math.max(1,b.width),1-(mouse.y-b.top)/Math.max(1,b.height))}
   hint.classList.toggle('show',time>1.2&&time<10);
   if(focus!==lastFocus){lastFocus=focus;setReadout(focus)}
   placeMarkers();
   if(labels.length)labels.forEach((l,i)=>{const on=focus===i;l.b.classList.toggle('on',on);l.b.classList.toggle('dim',focus>=0&&!on)});
   if(root.dataset.theme!=='light')meteors.forEach(m=>{m.next-=dt;if(!m.l.visible&&m.next<=0){m.l.visible=true;m.t=0;m.life=1.1+rnd()*.7;m.x=(rnd()-.2)*W*.7;m.y=H*.5-rnd()*H*.25;const a=-.45-rnd()*.3;m.vx=Math.cos(a)*(W*.5);m.vy=Math.sin(a)*(W*.5);m.next=6+rnd()*8}
    if(m.l.visible){m.t+=dt;const kk=m.t/m.life,pos=m.l.geometry.attributes.position,col=m.l.geometry.attributes.color,n=pos.count,hx=m.x+m.vx*m.t*.5,hy=m.y+m.vy*m.t*.5;
     for(let i=0;i<n;i++){const f=i/(n-1);pos.setXYZ(i,hx-m.vx*.09*f*(1-kk*.4),hy-m.vy*.09*f*(1-kk*.4),-4);const b=(1-f)*(1-kk)*.95;col.setXYZ(i,b,b*.93,b*.78)}pos.needsUpdate=true;col.needsUpdate=true;if(kk>=1)m.l.visible=false}});
   uniforms.uFocus.value=focus}
  function frame(now){
   if(!running)return;requestAnimationFrame(frame);
   const dt=Math.min(.05,(now-tPrev)/1000||0);tPrev=now;
   if(!visible||document.hidden||paused()||reduced.matches)return;
   if(PT)PT.begin();update(dt);draw();if(MO)MO.tick(dt*1000);if(PT)PT.end();
   /* quality governor (see govern): one measurement window = 90 frames or 1.4 s */
   if(++frames>=90||(frames>=4&&performance.now()-gStart>1400)){const avg=acc/frames,now=performance.now(),gp=PT&&PT.timer?PT.timer.take():null;gStart=now;frames=0;acc=0;govern(avg,now,gp&&gp.n>=8?gp.ms/1000:undefined)}else acc+=dt}
  /* Quality governor with hysteresis. Slow windows step DOWN at once (bloom -> resolution -> fewer stars -> fewer still).
     Fast windows step back UP one level at a time, only after 4 consecutive fast windows and 20 s since the last change;
     a recovery that is undone within 15 s locks recovery for 2 minutes, so a borderline GPU never flip-flops. */
  const QPX=[1.6,1.6,1,.7,.55],QKEEP=[1,1,1,.55,.3];let lastChange=-1e9,lastRec=-1e9,recLock=0,good=0;
  function setLevel(l,now){degrade=l;bloomOff=l>=1;quality=QPX[l];dust.geometry.setDrawRange(0,Math.floor(GN*QKEEP[l]));lanes.geometry.setDrawRange(0,Math.floor(LN*QKEEP[l]));  if(sim){sim.setDrawRange(SIMN[Math.min(l,4)]);sim.setActive(l<=0);hii&&hii.geometry.setDrawRange(0,Math.floor(hiiN*HKEEP[Math.min(l,4)]));if(beacons){beacons.geometry.instanceCount=Math.floor(beaconN*BKEEP[Math.min(l,4)]);beacons.visible=beacons.geometry.instanceCount>0}if(disc)disc.visible=l<=2;if(deepField)deepField.visible=l<=1;if(grain){const gn=Math.floor(GRAIN_N*GKEEP[Math.min(l,4)]);grain.geometry.setDrawRange(0,gn);grain.visible=gn>0}   /* hidden, not just empty: three compiles a visible Points program even for a zero draw range, and that compile is what B11's first-5-seconds long-task budget caught */}
   if(fx)fx.streak.enabled=l<=0&&flag('streak');if(dome&&dome.flare)dome.flare.visible=!dome.light&&l<=1;
lastChange=now;if(MO)MO.quality.set(l);syncBloom();layout()}
  /* GPU ms first (EXT_disjoint_timer_query_webgl2: the real cost of the frame, vsync and CPU noise excluded), rAF time only where the GPU has no timer.
     GPU thresholds: slow above 13 ms (20 ms from level 2), fast below 5 ms; rAF thresholds as before. */
  function govern(avg,now,gpu){if(pinned)return degrade;const G=gpu!=null,v=G?gpu:avg;
   if(degrade<4&&v>(G?(degrade<2?.013:.02):(degrade<2?.026:.04))){good=0;if(now-lastRec<15000)recLock=now+120000;setLevel(degrade+1,now);return degrade}
   if(degrade>0&&v<(G?.005:.0115)&&now>recLock&&now-lastChange>20000){if(++good>=4){good=0;lastRec=now;setLevel(degrade-1,now)}}else good=0;
   return degrade}
  function still(){introDone=true;time=3.6;scrollS=scrollP;update(0.001);draw()}

  /* ---------- wiring ---------- */
  await buildSim();
  introT0=performance.now();   // the entrance starts when the canvas does (the 1024² build can take ~1 s)
  {const cancel=()=>{if(!introDone&&!introCutT)introCutT=performance.now()};for(const ev of['pointerdown','wheel','keydown','touchstart'])addEventListener(ev,cancel,{passive:true,capture:true});addEventListener('scroll',()=>{if(scrollY>4)cancel()},{passive:true})}
  layout();applyTheme();buildRecords();
  sceneEl.classList.add('hero-gl');canvas.classList.add('on');
  if(reduced.matches||paused())still();
  requestAnimationFrame(t0=>{tPrev=t0;requestAnimationFrame(frame)});
  if(typeof ResizeObserver==='function')new ResizeObserver(()=>{layout();if(reduced.matches||paused())still()}).observe(sceneEl);else addEventListener('resize',()=>layout());
  if(typeof IntersectionObserver==='function')new IntersectionObserver(es=>{visible=es[0].isIntersecting}).observe(sceneEl);
  if(typeof MutationObserver==='function')new MutationObserver(()=>{applyTheme();if(reduced.matches||paused())still()}).observe(root,{attributes:true,attributeFilter:['class','data-theme']});
  if(reduced.addEventListener)reduced.addEventListener('change',()=>{if(reduced.matches)still()});
  /* GPU context loss: three re-initialises itself on restore but nothing repaints a static frame, so ask for one. */

  document.addEventListener('library:ready',buildRecords);document.addEventListener('library:language',buildLabels);
  /* While the GPU context is gone the 3D hero steps aside for the 2D fallback; when the context comes back it returns (nothing is torn down, so it can). */
  const heroUi=[labelBox,tip,zoomBox,hint,canvas];
  window.BKGL&&BKGL.watch(canvas,{name:'hero',
   onLost(){running=false;sceneEl.classList.remove('hero-gl');canvas.classList.remove('on');heroUi.forEach(n=>{n.style.display='none'})},
   onRestore(){heroUi.forEach(n=>{n.style.display=''});sceneEl.classList.add('hero-gl');canvas.classList.add('on');running=true;layout();
    if(reduced.matches||paused())still();requestAnimationFrame(t=>{tPrev=t;requestAnimationFrame(frame)})}});
  if(window.BKGL){BKGL.probe(renderer);BKGL.report('hero',()=>({degrade,running,pr:+pr.toFixed(2),gov:PT&&PT.timer&&PT.timer.n>=8?'gpu':'raf'}));
   BKGL.warm('hero',renderer,()=>[[scene,camera],()=>dome?[dome.sc,dome.cam]:null],{now:true})}   // start the shader compile before the first frame needs it
 }
})();
