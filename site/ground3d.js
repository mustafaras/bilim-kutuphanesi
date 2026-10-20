'use strict';
/* The ground band of the hero as a living three.js landscape (R8: a WET landscape).
   A contour-line terrain drifts toward the viewer (height-field in the vertex shader, iso-lines + faint survey grid in the fragment shader),
   glows under the galaxy like a reflection, glitters with sparse star-glints, and answers the pointer with expanding ripples that bend the contours.
   R8 adds, per docs/tasarim/PREMIUM-R6-R9-SAHNELER.md §R8 (all gated on the governor tier BKMotion.quality.level, rebuilt on 'bk:quality'):
     R8.2 wave-equation GPGPU (GPUComputationRenderer, ONE variable: r=h(now) g=h(prev) → only 2 ping-pong targets; 256² at tier 0, 128² at tier 1,
          pointer splashes are stamped as uv-gaussians; the sim SLEEPS ~8 s after the last splash — BKGround.info().simActive),
     R8.1 planar reflection: a mirror camera (VP·scale(1,-1,1)) renders a cheap proxy sky (deterministic spiral Points + lamp quad) into a 512²/256²
          mipped target; the ground samples it with the wave gradient as distortion, mip-blurred, faded toward the viewer; tiers ≥ 2 keep the old streak,
     R8.3 depth fog: exp(-k·d) haze toward the horizon + 3 (tier 0) / 1 (tier 1) additive drifting fog cards,
     R8.4 fwidth contours whose thickness thins where the surface curves hard (wave gradient / ripple energy),
     R8.5 the light pool: an elliptical glow under the dome lamp; its caustics come from the wave Laplacian (tier ≤ 1) or a static pattern below that.
   Deterministic under ?still: the sim never steps (h = 0), the mirror pass draws once, uTime and uLamp snap. Own small WebGL context, paused off-screen, static frame under reduced motion. */
(()=>{
 if(typeof document==='undefined')return;
 const hero=document.getElementById('hero');if(!hero)return;
 const root=document.documentElement,reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const hasGL=()=>{try{const c=document.createElement('canvas');return!!(c.getContext('webgl2')||c.getContext('webgl'))}catch{return false}};
 const level=()=>{try{return window.BKMotion?Math.max(0,BKMotion.quality.level|0):0}catch{return 0}};
 const mulberry=s=>()=>{s|=0;s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296};
 const GCR_PATH='./vendor/jsm/misc/GPUComputationRenderer.js';
 /* one wave variable reads its own texel: r = h(t), g = h(t-dt); explicit Euler on the 2-D wave equation with a per-step damping.
    uC2 = (c·dt/dx)² ≈ 0.098 — CFL ≤ 0.5 per axis holds at both 256² and 128². Splashes live in a small uniform ring, applied
    on the first step at or after their stamp time, and the CPU clears the ring right after that compute, so the compute stays stateless and every stamp lands exactly once at any frame rate (the CI software GL runs the page at ~1 fps). */
 const WAVE_FRAG=`uniform float uC2,uDamp,uTime,uDT;uniform vec4 uS[8];
  void main(){vec2 uv=gl_FragCoord.xy/resolution.xy;vec2 e=1./resolution.xy;
   vec4 s=texture2D(textureWave,uv);
   float l=texture2D(textureWave,uv+vec2(e.x,0.)).r+texture2D(textureWave,uv-vec2(e.x,0.)).r+texture2D(textureWave,uv+vec2(0.,e.y)).r+texture2D(textureWave,uv-vec2(0.,e.y)).r;
   float nh=(s.r*2.-s.g+uC2*(l-4.*s.r))*uDamp;
   for(int i=0;i<8;i++){vec4 st=uS[i];float age=uTime-st.z;
    if(age>=0.){vec2 d=uv-st.xy;nh+=st.w*exp(-dot(d,d)*2200.)*.012;}}   // a one-step kick rings the (low-frequency) bump at ~8x — measured on SwiftShader; keep the raw impulse that far below the wanted ripple height. Stamps stay active until the CPU clears them right after the compute that applied them — frame-rate independent exactly-once on slow GPUs
   gl_FragColor=vec4(clamp(nh,-1.,1.),s.r,0.,1.);}`;
 const WS=30;                                    // the wave grid covers the world square [-15,15]² under the viewer
 async function boot(){
  if(!hasGL())return;
  let THREE;try{THREE=await import('./vendor/three.module.min.js')}catch{return}
  const old=hero.querySelector('.hero-ground');if(old)old.remove();
  const canvas=document.createElement('canvas');canvas.className='hero-ground-gl';canvas.setAttribute('aria-hidden','true');hero.appendChild(canvas);
  let renderer;try{renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'high-performance'})}catch{canvas.remove();return}
  renderer.setClearColor(0,0);
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(46,2,.1,120);camera.position.set(0,2.4,7.5);camera.lookAt(0,-1.7,-5);
  const R=6,uniforms={uTime:{value:0},uLight:{value:0},uRes:{value:new THREE.Vector2(1,1)},uGlow:{value:.68},uDomeX:{value:.62},uLamp:{value:0},uR:{value:Array.from({length:R},()=>new THREE.Vector4(0,0,-99,0))},uEnergy:{value:0},
   uWave:{value:null},uWaveOn:{value:0},uWaveAmp:{value:.62},uWaveTexel:{value:new THREE.Vector2(1/256,1/256)},
   uRefl:{value:null},uReflOn:{value:0},uReflVP:{value:new THREE.Matrix4()},
   uLwMin:{value:.016},uLwCurv:{value:.45},uCaustK:{value:1}};
  const mat=new THREE.ShaderMaterial({uniforms,transparent:true,depthWrite:false,
   vertexShader:`uniform float uTime;uniform vec4 uR[${R}];uniform mat4 uReflVP;varying vec2 vP;varying float vH;varying float vRip;varying vec4 vR;
    void main(){vec3 p=position;vec2 q=p.xy;
     float t=uTime;
     float h=.5*sin(q.x*.33+t*.14)*cos(q.y*.27-t*.11)+.28*sin(q.x*.78+q.y*.55+t*.22)+.14*sin(q.x*1.7-q.y*1.3-t*.3);
     float rip=0.;
     for(int i=0;i<${R};i++){vec4 r=uR[i];float dt=t-r.z;if(dt>0.&&dt<4.){float d=length(q-r.xy);float w=d-dt*3.4;rip+=r.w*exp(-w*w*1.4)*exp(-dt*.9);}}
     h+=rip*.8;vRip=rip;
     vec3 pos=vec3(q.x,h,-q.y);vP=q;vH=h;vR=uReflVP*vec4(pos,1.);
     gl_Position=projectionMatrix*modelViewMatrix*vec4(pos,1.);}`,
   fragmentShader:`uniform float uTime,uLight,uGlow,uEnergy,uDomeX,uLamp,uWaveOn,uWaveAmp,uReflOn,uLwMin,uLwCurv,uCaustK;uniform vec2 uRes,uWaveTexel;
    uniform sampler2D uWave,uRefl;varying vec2 vP;varying float vH;varying float vRip;varying vec4 vR;
    float hs(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    float wH(vec2 uvw){return texture2D(uWave,uvw).r*uWaveOn*uWaveAmp;}
    void main(){
     vec2 sc=gl_FragCoord.xy/uRes;
     /* R8.2: the sampled wave height joins the analytic terrain; contours, caustics and reflection distortion all read it */
     vec2 wuv=(vec2(vP.x,-vP.y)+vec2(${WS/2}.))/${WS}.;
     float wh=wH(wuv),H=vH+wh;
     float c=abs(fract(H*3.4+uTime*.02)-.5);float fw=fwidth(H*3.4);
     vec2 gW=(vec2(wH(wuv+vec2(uWaveTexel.x,0.))-wH(wuv-vec2(uWaveTexel.x,0.)),wH(wuv+vec2(0.,uWaveTexel.y))-wH(wuv-vec2(0.,uWaveTexel.y))))/(2.*uWaveTexel.x*float(${WS}));
     float lap=wH(wuv+vec2(uWaveTexel.x,0.))+wH(wuv-vec2(uWaveTexel.x,0.))+wH(wuv+vec2(0.,uWaveTexel.y))+wH(wuv-vec2(0.,uWaveTexel.y))-4.*wh;
     /* R8.4: pixel-constant lines that thin where the surface curves hard (wave gradient or live ripple energy) */
     float curv=clamp(length(gW)*2.4+abs(vRip)*1.4,0.,1.);
     float lw=max(uLwMin,fw*1.2*(1.-uLwCurv*curv));   // tiers >= 2: uLwMin returns to .045 and uLwCurv=0 — the pre-R8 fixed-thickness line
     float line=1.-smoothstep(0.,lw,c);
     vec2 g=abs(fract(vP*.5)-.5);float gfw=fwidth(vP.x*.5);float grid=1.-smoothstep(0.,max(.03,gfw*1.1),min(g.x,g.y));
     float dist=smoothstep(26.,2.,length(vP-vec2(0.,6.)));
     float glow=exp(-pow(max(abs((sc.x-uGlow)*2.1),1e-4),2.))*(.35+.65*(1.-sc.y));
     vec3 brass=vec3(.93,.82,.6),ink=vec3(.16,.27,.37);
     /* palette light-waves: the survey lines carry the discovery-field colours as slow bands rolling toward the viewer */
     vec3 teal=mix(vec3(.49,.78,.72),vec3(.1,.34,.4),uLight),violet=mix(vec3(.73,.65,.84),vec3(.3,.24,.5),uLight),rose=mix(vec3(.84,.6,.42),vec3(.5,.26,.14),uLight);
     float w1=smoothstep(.45,.95,.5+.5*sin(vP.y*.38-uTime*.42+vP.x*.06)),w2=smoothstep(.55,1.,.5+.5*sin(vP.y*.23-uTime*.3-vP.x*.09+2.1));
     vec3 col=mix(brass,ink,uLight);col=mix(col,teal,w1*.7);col=mix(col,mix(violet,rose,.5+.5*sin(vP.x*.2+uTime*.1)),w2*.6);
     /* dome reflection: the observatory lamp's streak laid on the ground below it, broken up by the contour lines */
     float dx=(sc.x-uDomeX)/(.011+.028*(1.-sc.y));float streak=exp(-dx*dx)*smoothstep(0.,.85,sc.y)*uLamp;
     /* R8.5 light pool: the elliptical glow of the lamp on the wet ground */
     float pdx=(sc.x-uDomeX)/.16;float pool=exp(-pdx*pdx)*smoothstep(.05,.5,sc.y)*(.25+.75*uLamp);
     vec3 warm=mix(vec3(1.,.82,.52),vec3(.72,.4,.14),uLight);
     /* caustics: light concentrated by the wave curvature; static soft bands where the sim is off (tiers >= 2) */
     float caust=clamp(1.-lap*3.2,0.,1.85);caust=caust*caust*caust*pool*uWaveOn*1.15;
     float stat=(.5+.5*sin(vP.x*6.2-uTime*1.3)*sin(vP.y*4.7+uTime*.9+1.3));stat=smoothstep(.72,1.,stat)*pool*.35*(1.-uWaveOn)*uCaustK;
     float a=(line*.62+grid*.07)*(.5+glow*1.2)*dist+vRip*.9*line;
     /* star glints: sparse hashed cells that twinkle, stronger under the galaxy */
     vec2 cell=floor(vP*3.2);float hh=hs(cell);float tw=smoothstep(.985,1.,hh)*(.5+.5*sin(uTime*(1.4+hh*3.)+hh*40.));
     float glint=tw*smoothstep(.45,.5,1.-length(fract(vP*3.2)-.5))*(.4+glow);
     a+=glint*.9*dist;
     a+=glow*.07*(1.-uLight*.4)*dist;
     /* R8.1 planar reflection: the mirror-rendered proxy sky, distorted by the wave gradient, mip-blurred with distance, wettest under the lamp */
     float band=smoothstep(5.,-5.,vP.y);
     vec2 rr=vR.xy/max(abs(vR.w),1e-4)*.5+.5;rr=clamp(rr+gW*.55*uReflOn,0.,1.);
     float fogT=1.-exp(-max(0.,-vP.y-5.)*.05);
     vec3 rc=texture2D(uRefl,rr,2.3+2.2*fogT).rgb;
     rc=mix(rc,vec3(dot(rc,vec3(.33,.5,.17))),uLight*.8);   // the light theme reflects grey
     float rlum=max(rc.r,max(rc.g,rc.b));
     float rw=rlum*band*uReflOn*(.35+.85*pool)*mix(1.,.6,uLight);
     col=mix(col,rc*1.3,clamp(rw,0.,.55));a+=rw*.5*dist;
     a+=clamp(caust+stat,0.,1.)*.45*dist;col=mix(col,warm,clamp((caust+stat)*.5,0.,1.));
     a+=streak*(.16+.85*line+.3*grid)*(.75+.25*sin(vP.y*2.6-uTime*1.8))*dist*2.6;col=mix(col,warm,clamp(streak*2.2,0.,1.));
     /* R8.3 depth fog: everything washes into the horizon haze */
     vec3 fogc=mix(vec3(.06,.085,.15),vec3(.62,.67,.73),uLight);
     col=mix(col,fogc,fogT*(.4+.25*uLight));a=mix(a*(1.-fogT*.35),.15*(1.-uLight*.4),fogT*.5);
     a*=1.+uEnergy*.5;
     gl_FragColor=vec4(col,clamp(a,0.,1.)*(uLight>.5?.9:1.));}`});
  mat.extensions={derivatives:true};
  const geo=new THREE.PlaneGeometry(46,30,230,120);const mesh=new THREE.Mesh(geo,mat);mesh.frustumCulled=false;scene.add(mesh);
  const resize=()=>{const r=canvas.getBoundingClientRect(),w=Math.max(2,r.width),h=Math.max(2,r.height),pr=Math.max(.6,Math.min(devicePixelRatio||1,1.6)*([1,1,.85,.7,.55][window.BKMotion?BKMotion.quality.level:0]||1));renderer.setPixelRatio(pr);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();uniforms.uRes.value.set(w*pr,h*pr);camera.updateMatrixWorld(true);buildReflVP();reflDirty=true};
  document.addEventListener('bk:quality',()=>{resize();applyLevel();frame.done=false;kick()});
  const ro=typeof ResizeObserver==='function'?new ResizeObserver(resize):null;if(ro)ro.observe(canvas);

  /* ---------- R8.1 mirror camera + proxy sky (rendered ONCE per dirty flag: the proxy is static, the waves distort the SAMPLE, not the source) ---------- */
  const MIRROR=new THREE.Matrix4().makeScale(1,-1,1);
  function buildReflVP(){uniforms.uReflVP.value.copy(camera.projectionMatrix).multiply(camera.matrixWorldInverse).multiply(MIRROR)}
  const mirrorScene=new THREE.Scene(),mc=new THREE.PerspectiveCamera(46,2,.1,240);mc.matrixAutoUpdate=false;
  function syncMirrorCamera(){const mw=new THREE.Matrix4().multiplyMatrices(MIRROR,camera.matrixWorld);mc.matrixWorld.copy(mw);mc.matrixWorldInverse.copy(mw).invert();
   mc.projectionMatrix.copy(camera.projectionMatrix);mc.projectionMatrixInverse.copy(camera.projectionMatrixInverse)}
  let reflRT=null,reflSize=0,proxy,lampQuad;
  const PN=28000;
  {const rnd=mulberry(20261018),pos=new Float32Array(PN*3),col=new Float32Array(PN*3),sz=new Float32Array(PN);
   const WARM=[.93,.8,.55],BLU=[.5,.63,1.],VIO=[.72,.6,.9];
   for(let i=0;i<PN;i++){const u=rnd();let x,y,z,br;
    if(u<.22){const r=Math.pow(rnd(),1.7)*2.2,a=rnd()*6.2832;x=Math.cos(a)*r*1.6;z=-24+Math.sin(a)*r*.9;y=3.4+(rnd()+rnd()+rnd()-1.5)*.5*(1-r*.3);br=1.}
    else if(u<.82){const arm=(rnd()*4|0)*1.5708,t=Math.pow(rnd(),.65),r=1.6+t*11,a=arm+r*.42+(rnd()+rnd()-1)*.22;x=Math.cos(a)*r*1.7;z=-24+Math.sin(a)*r*.85;y=3.2-r*.13+(rnd()+rnd()-1)*.4;br=.55+.45*(1-t)}
    else{x=(rnd()-.5)*40;z=-24+(rnd()-.5)*26;y=1+rnd()*8;br=.3}
   pos[i*3]=x;pos[i*3+1]=y;pos[i*3+2]=z;
   const k=Math.min(1,Math.hypot(x,z+24)/16);let cr=WARM[0]+(BLU[0]-WARM[0])*k,cg=WARM[1]+(BLU[1]-WARM[1])*k,cb=WARM[2]+(BLU[2]-WARM[2])*k;
   if(rnd()<.08){cr=VIO[0];cg=VIO[1];cb=VIO[2]}
   col[i*3]=cr*br;col[i*3+1]=cg*br;col[i*3+2]=cb*br;sz[i]=1.2+rnd()*rnd()*3.4}
   const pg=new THREE.BufferGeometry();pg.setAttribute('position',new THREE.BufferAttribute(pos,3));pg.setAttribute('aC',new THREE.BufferAttribute(col,3));pg.setAttribute('aS',new THREE.BufferAttribute(sz,1));
   pg.boundingSphere=new THREE.Sphere(new THREE.Vector3(0,3,-24),60);
   proxy=new THREE.Points(pg,new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
    vertexShader:'attribute vec3 aC;attribute float aS;varying vec3 vC;void main(){vC=aC;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_PointSize=aS;}',
    fragmentShader:'varying vec3 vC;void main(){float d=length(gl_PointCoord-.5);gl_FragColor=vec4(vC,smoothstep(.5,0.,d));}'}));
   proxy.frustumCulled=false;mirrorScene.add(proxy);
   lampQuad=new THREE.Mesh(new THREE.PlaneGeometry(2.6,1.3),new THREE.MeshBasicMaterial({color:new THREE.Color(1,.82,.5),transparent:true,opacity:.85,blending:THREE.AdditiveBlending,depthWrite:false}));
   lampQuad.position.set(0,4.6,-25);mirrorScene.add(lampQuad)}
  let reflDirty=true;
  function ensureRefl(size){if(reflRT&&reflSize===size)return;
   if(reflRT)reflRT.dispose();reflRT=null;reflSize=size;
   if(!size){uniforms.uRefl.value=null;return}
   reflRT=new THREE.WebGLRenderTarget(size,size>>1,{minFilter:THREE.LinearMipmapLinearFilter,magFilter:THREE.LinearFilter,generateMipmaps:true});
   proxy.geometry.setDrawRange(0,level()<=0?PN:14000);uniforms.uRefl.value=reflRT.texture;reflDirty=true}
  function drawMirror(){if(!reflRT)return;syncMirrorCamera();renderer.setRenderTarget(reflRT);renderer.setClearAlpha(1);renderer.render(mirrorScene,mc);renderer.setClearAlpha(0);renderer.setRenderTarget(null);reflDirty=false}

  /* ---------- R8.2 wave-equation GPGPU (one variable → two ping-pong targets) ---------- */
  let wave=null,wt=0,si=0,awakeUntil=0,stamps=null;
  const pending=()=>{if(!stamps)return 0;let n=0;for(const s of stamps)if(s.z>=0)n++;return n};
  const asleep=()=>performance.now()/1000>awakeUntil&&!pending();
  async function ensureWave(size){
   if(wave&&wave.size===size)return;
   if(wave){try{wave.gl.dispose()}catch{}wave=null;uniforms.uWave.value=null;uniforms.uWaveOn.value=0}
   if(!size)return;
   const p=window.BKGL&&BKGL.probe(renderer);if(!(p&&p.floatRT))return;
   let GCR=null;try{GCR=(await import(GCR_PATH)).GPUComputationRenderer}catch{return}
   let gl=null;try{gl=new GCR(size,size,renderer)}catch{return}
   const init=gl.createTexture();
   const varW=gl.addVariable('textureWave',WAVE_FRAG,init);
   gl.setVariableDependencies(varW,[varW]);
   const u=varW.material.uniforms;
   u.uC2={value:.098};u.uDamp={value:.9965};u.uTime={value:0};u.uDT={value:1/60};u.uS={value:Array.from({length:8},()=>new THREE.Vector4(0,0,-99,0))};
   if(gl.init()){try{gl.dispose()}catch{}return}
   wt=0;si=0;stamps=u.uS.value;   // the splash ring IS the compute uniform: writes reach the GPU without a per-frame copy
   wave={gl,varr:varW,size,uniforms:u};
   uniforms.uWaveTexel.value.set(1/size,1/size);
   try{u.uDT.value=0;gl.compute();renderer.setRenderTarget(null);u.uDT.value=1/60}catch{}   // upload both ping targets once (?still readback finds real texels)
   uniforms.uWave.value=gl.getCurrentRenderTarget(varW).texture;
   if(awakeUntil>performance.now()/1000)uniforms.uWaveOn.value=1}
  function stepWave(){
   if(!wave){uniforms.uWaveOn.value=0;return}
   if(asleep()){   // calm (wall clock): compute stops at once; the frozen contribution FADES out over a few frames instead of popping
    uniforms.uWaveOn.value=uniforms.uWaveOn.value>.002?uniforms.uWaveOn.value*.88:0;info.simActive=false;return}
   wt+=1/60;const u=wave.uniforms;u.uTime.value=wt;u.uDT.value=1/60;
   wave.gl.compute();renderer.setRenderTarget(null);info.simSteps++;
   for(const s of u.uS.value)if(s.z>=0&&wt>=s.z){s.z=-99;s.w=0}   // the compute that just ran was the one that saw this stamp — clear it (exactly-once, any fps); w=0 keeps the inactive ring harmless under age>=0
   uniforms.uWave.value=wave.gl.getCurrentRenderTarget(wave.varr).texture;uniforms.uWaveOn.value=1;info.simActive=true}
  function splash(x,y,amp){if(level()>1||!wave)return false;
   const u=(x+WS/2)/WS,v=(y+WS/2)/WS;if(!(u>=0&&u<=1&&v>=0&&v<=1))return false;
   stamps[si%8].set(u,v,wt+.02,amp);si++;awakeUntil=performance.now()/1000+8;info.simActive=true;return true}

  /* ---------- R8.3 fog cards (additive quads drifting slowly near the horizon) ---------- */
  const GADD='vec4 gAdd(vec3 c){float a=clamp(max(c.r,max(c.g,c.b)),0.,1.);return vec4(c/max(a,1e-4),a);}\n';   // additive light into the transparent canvas (the bk_ prefix belongs to BKShaders alone; this is ground3d's local twin of hero3d's hAdd)
  const NOISE=window.BKShaders?BKShaders.use('noise'):'';
  const cards=[];
  if(NOISE){const cm=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,uniforms:{uTime:uniforms.uTime,uLight:uniforms.uLight},
   vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
   fragmentShader:'uniform float uTime,uLight;varying vec2 vUv;\n'+NOISE+'\n'+GADD+`
    void main(){vec2 p=vUv*vec2(4.,1.7)+vec2(uTime*.02,uTime*.004);
     vec2 cu=bk_curl2d(p*.8+uTime*.01)*.12;
     float n=clamp(bk_fbm2((p+cu)*1.8)*.5+.5,0.,1.);
     float v=smoothstep(.42,.85,n)*smoothstep(0.,.3,vUv.y)*smoothstep(1.,.35,vUv.y);
     vec3 c=mix(vec3(.45,.55,.75),vec3(.95,.97,1.),uLight);
     gl_FragColor=gAdd(c*v*(.17-.09*uLight));}`});
   for(let i=0;i<3;i++){const q=new THREE.Mesh(new THREE.PlaneGeometry(46,4.4),cm);q.position.set(i===1?-6:i===2?7:0,1.9,-10.5-i*1.7);q.frustumCulled=false;scene.add(q);cards.push(q)}}

  /* tier → feature switch (allocations happen on demand; a software-GL tier-3 run never builds the sim or the mirror target) */
  function applyLevel(){const s=level();
   ensureWave(s<=0?256:s<=1?128:0);
   ensureRefl(s<=0?512:s<=1?256:0);
   uniforms.uReflOn.value=s<=1?1:0;
   if(s<=1)reflDirty=true;
   uniforms.uLwMin.value=s<=1?.016:.045;uniforms.uLwCurv.value=s<=1?.45:0;uniforms.uCaustK.value=s<=1?1:0;   // level table: contours "sabit" and no caustic band at tiers >= 2
   const n=s<=0?3:s<=1?1:0;cards.forEach((q,i)=>{q.visible=i<n})}
  resize();applyLevel();

  let visible=true,raf=0,t0=performance.now(),ri=0,lastRip=0,energy=0;
  const info={built:true,lvl:0,simSize:0,simSteps:0,simActive:false,targets:0,refl:false,reflSize:0,cards:0,frames:0};
  function syncInfo(){info.lvl=level();info.simSize=wave?wave.size:0;info.simActive=!!wave&&!asleep()&&level()<=1;
   info.si=si;info.pending=pending();info.awake=Math.max(0,Math.round((awakeUntil-performance.now()/1000)*10)/10);
   info.targets=(wave?2:0)+(reflRT?1:0);info.refl=!!reflRT&&uniforms.uReflOn.value>.5;info.reflSize=reflRT?reflRT.width:0;
   info.cards=cards.filter(c=>c.visible).length}
  window.BKGround={info(){syncInfo();return{...info}},splash(x,y,a){return splash(x,y,a==null?1:a)},
   /* test hook (B20): the largest |height| in the live wave texture — proves a splash actually carries energy, not just steps */
   sample(){if(!wave)return null;try{const rt=wave.gl.getCurrentRenderTarget(wave.varr),S=wave.size,buf=new Float32Array(S*S*4);
    renderer.readRenderTargetPixels(rt,0,0,S,S,buf);let mx=0;for(let i=0;i<buf.length;i+=4){const v=Math.abs(buf[i]);if(v>mx)mx=v}return +mx.toFixed(4)}catch{return null}}};
  window.BKGL&&BKGL.report('ground',()=>{syncInfo();return{lvl:info.lvl,sim:info.simSize+'@'+info.simSteps+(info.simActive?'*':''),targets:info.targets,cards:info.cards}});
  const io=typeof IntersectionObserver==='function'?new IntersectionObserver(es=>{visible=es[0].isIntersecting;if(visible)kick()},{threshold:0}):null;if(io)io.observe(hero);
  const ray=new THREE.Raycaster(),ndc=new THREE.Vector2(),plane=new THREE.Plane(new THREE.Vector3(0,1,0),0),hit=new THREE.Vector3();
  function ripple(cx,cy,amp){const b=canvas.getBoundingClientRect();if(cy<b.top||cy>b.bottom||cx<b.left||cx>b.right)return false;
   ndc.set(((cx-b.left)/b.width)*2-1,-(((cy-b.top)/b.height)*2-1));ray.setFromCamera(ndc,camera);if(!ray.ray.intersectPlane(plane,hit))return false;
   if(!splash(hit.x,-hit.z,amp*.6)){const now=(performance.now()-t0)/1000;uniforms.uR.value[ri%R].set(hit.x,-hit.z,now,amp);ri++}
   energy=Math.min(1,energy+.35);return true}
  addEventListener('pointermove',e=>{const now=performance.now();if(now-lastRip<110)return;if(ripple(e.clientX,e.clientY,.55))lastRip=now},{passive:true});
  addEventListener('pointerdown',e=>{ripple(e.clientX,e.clientY,1.1)},{passive:true});
  /* a hero shock-wave (click on the galaxy) also rings the ground */
  hero.addEventListener('pointerup',e=>{const b=canvas.getBoundingClientRect();if(e.clientY<b.top){uniforms.uR.value[ri%R].set((e.clientX/innerWidth-.5)*16,5,(performance.now()-t0)/1000,.7);ri++;energy=Math.min(1,energy+.3)}},{passive:true});
  function frame(now){raf=0;if(!visible||document.hidden)return;
   const paused=root.classList.contains('effects-paused'),still=window.BKGL&&BKGL.still;
   if(!paused&&!reduced.matches||!frame.done){
    if(still)uniforms.uTime.value=3.6;else uniforms.uTime.value=(now-t0)/1000;
    energy*=.965;uniforms.uEnergy.value=energy;uniforms.uLight.value=root.dataset.theme==='light'?1:0;
    const hz=window.BKHorizon;
    if(hz&&hz.w){uniforms.uDomeX.value=hz.ox/hz.w;const tgt=hz.live?(.35+.65*(hz.lamp==null?.7:hz.lamp)):.25;
     if(still||reduced.matches)uniforms.uLamp.value=tgt;else uniforms.uLamp.value+=(tgt-uniforms.uLamp.value)*.08}
    if(!still&&!reduced.matches&&!paused)stepWave();else if(!wave)uniforms.uWaveOn.value=0;
    if(reflDirty&&reflRT)drawMirror();
    renderer.render(scene,camera);frame.done=true;info.frames++}
   if(!reduced.matches&&!paused)raf=requestAnimationFrame(frame)}
  function kick(){if(!raf)raf=requestAnimationFrame(frame)}
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)kick()});
  new MutationObserver(()=>{frame.done=false;reflDirty=true;kick()}).observe(root,{attributes:true,attributeFilter:['data-theme','class']});
  /* GPU context loss: three re-initialises itself on restore but nothing repaints a static frame (or the mirror target), so ask for one. */
  window.BKGL&&BKGL.watch(canvas,{name:'ground',onRestore(){resize();frame.done=false;reflDirty=true;kick()}});
  canvas.classList.add('on');kick();
 }
 const idle=f=>window.requestIdleCallback?requestIdleCallback(f,{timeout:1200}):setTimeout(f,200);
 if(document.readyState==='complete')idle(boot);else addEventListener('load',()=>idle(boot),{once:true});
})();
