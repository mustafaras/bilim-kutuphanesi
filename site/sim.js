'use strict';
/* BKSim — A2: particle simulation on the GPU (GPGPU), the one place that runs ping-pong float-texture compute in this code base.
   Pattern: three's GPUComputationRenderer (vendored). Two RGBA32F variables ping-pong:
     off — the particle's OFFSET from its analytic home (the hero still computes the log-spiral home in the vertex shader, so the galaxy NEVER drifts apart)
     vel — the offset's velocity: pointer gravity, click shock ring, curl turbulence, a return spring and damping
   Every particle's texel is its identity: the caller's Points geometry carries aRef (the texel uv), reads the offset texture in its vertex shader, and drawRange sets how many of the N particles draw (quality tiers with no rebuild).
   The caller owns the point material (its own shader, its own theme): it only needs a tPos uniform, which step() keeps pointing at the live texture.
   No float render target (BKGL.probe().floatRT false), no WebGL2 or a failed init → create() returns null and the caller keeps its CPU path.
   Determinism (?still): the visual gate's still mode never steps the simulation (the hero skips step at dt<=0.01), so the captured frame is the seeded initial state — identical between runs.
   Dispose contract (A5, v121 lesson): dispose() releases every render target, the initial textures, the compute materials and the home texture; leak_audit's slope test watches it. */
(()=>{
 const version=1;
 const GCR_PATH='./vendor/jsm/misc/GPUComputationRenderer.js';   // resolved by the import map's THREE import inside it (same module instance as the scene's)

 /* velocity: pointer gravity (short range, like the old vertex-shader pull but persistent), shock ring sweeping out from a click,
    ambient curl turbulence (cheap 2D curl of a simplex potential), a spring back to the home and damping. */
 const VEL_FRAG=/* glsl */`
uniform float uTime,uDT,uMouseOn,uWell;uniform vec3 uMouse,uPulse;uniform sampler2D uHome;
void main(){vec2 uv=gl_FragCoord.xy/resolution.xy;
 vec4 hm=texture2D(uHome,uv);float r=hm.x,a0=hm.y,hy=hm.z,t=hm.w;
 float ang=a0+uTime*.2/(.7+r*.5);
 vec2 hxy=vec2(cos(ang)*r,sin(ang)*r);float hz=hy+.022*r*r*sin(ang-.6);
 vec3 off=texture2D(texturePos,uv).rgb;vec3 vel=texture2D(textureVel,uv).rgb;
 vec2 dm=uMouse.xy-hxy-off.xy;float dl=length(dm);float g=uMouseOn*smoothstep(2.8+uWell*1.6,0.,dl);
 vec3 acc=vec3(dm.x*g*1.7,dm.y*g*1.7,g*(.7+uWell*1.6)*1.5);
 acc.xy+=vec2(-dm.y,dm.x)*g*uWell*2.2;                                   // the singularity hold swirls the dust around the pointer
 float pd=uTime-uPulse.z;
 if(pd>0.&&pd<1.7){vec2 dp=hxy+off.xy-uPulse.xy;float rd=abs(length(dp)-pd*7.);float ring=exp(-rd*rd*.8)*(1.-pd/1.7);acc.xy+=normalize(dp+vec2(1e-4))*ring*7.;}
 acc.xy+=bk_curl2d(hxy*.55+vec2(uTime*.03,t*23.))*abs(bk_snoise2(hxy*.35-t*31.))*1.3;   // turbulence, per-star phase so it never moves as one sheet
 acc-=off*5.5;acc-=vel*2.6;
 vel+=acc*uDT;
 gl_FragColor=vec4(clamp(vel,vec3(-6.),vec3(6.)),1.);}`;

 /* position: pure Euler integration of the offset, clamped so a violent interaction can never tear a star out of the disc */
 const POS_FRAG=/* glsl */`
uniform float uDT;
void main(){vec2 uv=gl_FragCoord.xy/resolution.xy;
 vec3 off=texture2D(texturePos,uv).rgb+texture2D(textureVel,uv).rgb*uDT;
 float L=length(off);off*=L>1.6?1.6/L:1.;
 gl_FragColor=vec4(off,1.);}`;

 async function create(THREE,renderer,o){
  o=o||{};
  const probe=window.BKGL&&BKGL.probe(renderer),p2=window.BKGL&&BKGL.probe();
  const ok=(probe&&probe.floatRT)||(p2&&p2.floatRT);
  if(!ok)return null;
  if(!THREE.WebGL2RenderTarget&&renderer.capabilities&&!renderer.capabilities.isWebGL2)return null;
  let GCR=null;try{GCR=(await import(GCR_PATH)).GPUComputationRenderer}catch{return null}
  const S=o.size||512,N=S*S;
  if(!o.home||o.home.length!==N*4)return null;
  let gl=null;try{gl=new GCR(S,S,renderer)}catch{return null}
  const glsl=window.BKShaders.use('noise');
  const homeTex=new THREE.DataTexture(o.home,S,S,THREE.RGBAFormat,THREE.FloatType);
  homeTex.magFilter=homeTex.minFilter=THREE.NearestFilter;homeTex.needsUpdate=true;
  const off0=gl.createTexture(),vel0=gl.createTexture();   // both start at zero: the galaxy opens at its seeded home positions
  const velVar=gl.addVariable('textureVel',glsl+'\n'+VEL_FRAG,vel0);
  const posVar=gl.addVariable('texturePos',POS_FRAG,off0);
  gl.setVariableDependencies(velVar,[velVar,posVar]);
  gl.setVariableDependencies(posVar,[velVar,posVar]);
  const vu=velVar.material.uniforms;
  vu.uTime={value:0};vu.uDT={value:1/60};vu.uMouseOn={value:0};vu.uWell={value:0};
  vu.uMouse={value:new THREE.Vector3(0,0,0)};vu.uPulse={value:new THREE.Vector3(0,0,-99)};vu.uHome={value:homeTex};
  posVar.material.uniforms.uDT={value:1/60};
  const err=gl.init();
  if(err){try{gl.dispose()}catch{}homeTex.dispose();console.warn('BKSim: '+err);return null}
  /* one uDT=0 compute renders both ping targets once (three only uploads an RT's texture on first render; the ?still readback must find real texels). Zero dt keeps the state exactly zero → deterministic. */
  try{vu0(0);gl.compute();renderer.setRenderTarget(null)}catch{}vu0(1/60);
  function vu0(v){velVar.material.uniforms.uDT.value=v;posVar.material.uniforms.uDT.value=v}

  /* the Points object: identity = texel (aRef); everything else (home maths, colour, size) is the caller's vertex shader */
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(N*3),3));
  const ref=new Float32Array(N*2);
  for(let i=0;i<N;i++){ref[i*2]=((i%S)+.5)/S;ref[i*2+1]=(Math.floor(i/S)+.5)/S}
  geo.setAttribute('aRef',new THREE.BufferAttribute(ref,2));
  for(const k in(o.attrs||{}))geo.setAttribute(k,new THREE.BufferAttribute(o.attrs[k],o.attrSize&&o.attrSize[k]||1));
  geo.boundingSphere=new THREE.Sphere(new THREE.Vector3(),(o.radius||8)*6);
  const uniforms={...(o.uniforms||{}),tPos:{value:gl.getCurrentRenderTarget(posVar).texture},uHome:{value:homeTex}};
  const material=new THREE.ShaderMaterial(Object.assign({uniforms,transparent:true,depthWrite:false},o.material||{}));
  const points=new THREE.Points(geo,material);points.frustumCulled=false;

  let steps=0,active=true;
  const api={version,size:S,n:N,points,material,
   get active(){return active},get steps(){return steps},
   setActive(v){active=!!v},
   setDrawRange(n){geo.setDrawRange(0,Math.max(0,Math.min(N,n|0)))},get drawn(){const r=geo.drawRange;return r.count===Infinity?N:Math.min(N,r.count)},
   /* env: {dt,time,mouse:[x,z in the caller's home space],mouseOn,pulse:[x,z],well} */
   step(dt,env){if(!active||!(dt>0))return;env=env||{};
    vu.uTime.value=env.time||0;vu.uDT.value=Math.min(dt,.05);vu.uMouseOn.value=env.mouseOn||0;vu.uWell.value=env.well||0;
    if(env.mouse)vu.uMouse.value.set(env.mouse[0],env.mouse[1],0);
    if(env.pulse)vu.uPulse.value.set(env.pulse[0],env.pulse[1],env.pulse[2]);
    gl.compute();renderer.setRenderTarget(null);steps++;   // compute leaves the last ping target bound — hand the canvas back
    uniforms.tPos.value=gl.getCurrentRenderTarget(posVar).texture},
   /* test hook (tools/feature_audit.py B14): read a few blocks of the live offset texture back and report the largest |offset| seen. 5 blocks of 32x32 samples the texel space uniformly (particle order is random). */
   sample(){try{
    const rt=gl.getCurrentRenderTarget(posVar),buf=new Float32Array(32*32*4),blocks=[[0,0],[S-32,0],[0,S-32],[S-32,S-32],[(S-32)>>1,(S-32)>>1]];
    let mx=0;
    for(const b of blocks){renderer.readRenderTargetPixels(rt,b[0],b[1],32,32,buf);
     for(let i=0;i<buf.length;i+=4)for(let k=0;k<3;k++){const v=Math.abs(buf[i+k]);if(v>mx)mx=v}}
    return{steps,maxAbs:+mx.toFixed(6)}}catch{return null}},
   diag(){return{size:S,n:N,steps,active,drawn:api.drawn}},
   dispose(){try{gl.dispose()}catch{}for(const v of gl.variables){try{v.material.dispose()}catch{}}homeTex.dispose();geo.dispose();material.dispose();points.parent&&points.parent.remove(points)}};
  api.setDrawRange(N);
  return api}

 window.BKSim={version,create,probe:()=>window.BKGL?BKGL.probe():null};
 if(window.BKGL)BKGL.report('sim',()=>window.__bkSim?window.__bkSim.diag():'idle');
})();
