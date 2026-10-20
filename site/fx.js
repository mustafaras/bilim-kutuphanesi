'use strict';
/* BKFX — one pooled post-processing chain (A1). Replaces the hero's separate guard / bloom / lens + chromatic aberration + radial blur + grade passes.
   Frame:  scene → HDR target (half float) ┬─ [bloom: bright pass (NaN/Inf guard + threshold) → 5 mip blurs (H+V) → composite], half resolution, skipped when off
                                           └─ UBER pass (ONE full-screen triangle, straight to the canvas): scene + bloom, lens, chromatic aberration, radial blur, 32³ colour LUT (per theme),
                                              vignette, film grain, dithering (IGN). Every branch is a uniform `if`: zero lens / blur / aberration / LUT cost nothing but the branch.
   Why it is cheaper than the old chain: the old one read the full-resolution image three times (guard, bloom bright pass, grade) and wrote it three times (guard, additive bloom blend, grade) plus two
   full-resolution ping-pong targets. Here the guard lives inside the bright pass and inside the uber taps, the bloom is added while the uber reads it (no full-resolution blend), the scene target is the
   only full-resolution target and the bloom targets carry no depth buffer. info() reports the plan of the LAST frame (draws, full-resolution reads, passes, targets) for tools/gpu_budget_audit.py.
   API: BKFX.create(renderer,THREE,{theme}) → {u (uniforms: uTime uCA uLens uBlur uBlurC uMouse uAspect uGrain uVignette uLut), bloom{enabled,strength,radius,threshold}, cone{enabled,strength,steps,angle,len,apex,dir} (R7.e volumetric light cone: 24-step screen-space ray march with an IGN-jittered start, quarter resolution, written into the bloom's idle quarter-resolution mip hs[1] after the streak is done with it — again no extra render target; tier 1-2 use a gradient sprite instead: the governor switches the post chain off there), streak{enabled,strength,threshold} (R7.d anamorphic flare: two horizontal-only wide passes at quarter resolution over the bloom's own bright pass, written into the bloom's now-idle quarter-resolution mip targets — no extra render target), setSize(w,h) device pixels,
        setTheme('dark'|'light'), render(scene,camera), info(), dispose()}. Every GPU object it creates (targets, LUT texture, materials, geometry) is released by dispose().
   Render-target pool: targets of equal size/type are reused (get / release); setSize hands the old ones back and flushes the pool, dispose() flushes it. Flag fxuber (BKGL.flags, default on) selects this chain
   in the hero; off = the old EffectComposer chain, picture for picture (tools/visual_audit.py --legacy). Needs BKShaders (hash, lut3d) loaded first. */
(()=>{
 const N=32,NM=5,KS=[3,5,7,9,11],BLOOM_F=[1,.8,.6,.4,.2];
 /* ---------- procedural colour grade: 32³ RGBA8, x = red fastest, then green, then blue (the layout of a Data3DTexture) ---------- */
 const lutCache={};
 function lutData(theme){
  if(lutCache[theme])return lutCache[theme];
  const d=new Uint8Array(N*N*N*4),dark=theme!=='light',k=dark?.35:.1,sat=dark?1.06:1.02,ss=x=>x*x*(3-2*x),cl=x=>x<0?0:x>1?1:x;
  for(let b=0;b<N;b++)for(let g=0;g<N;g++)for(let r=0;r<N;r++){
   let c=[r,g,b].map(v=>v/(N-1));
   c=c.map(v=>v+k*(ss(v)-v));                                            // gentle S-curve
   const L=.2126*c[0]+.7152*c[1]+.0722*c[2];
   if(dark){const sh=(1-L)*(1-L)*.5,hi=L*L*.6;                           // shadows: deep blue-violet · highlights: brass (the archive's palette, not teal & amber)
    c[0]+=-.012*sh+.034*hi;c[1]+=-.010*sh+.018*hi;c[2]+=.034*sh-.030*hi}
   const L2=.2126*c[0]+.7152*c[1]+.0722*c[2];
   c=c.map(v=>cl(L2+(v-L2)*sat));
   const i=((b*N+g)*N+r)*4;d[i]=Math.round(c[0]*255);d[i+1]=Math.round(c[1]*255);d[i+2]=Math.round(c[2]*255);d[i+3]=255}
  return lutCache[theme]=d}

 const VERT='varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}';
 const BRIGHT=`uniform sampler2D tScene;uniform float uThr,uSmooth;varying vec2 vUv;
  void main(){vec4 c=texture2D(tScene,vUv);if(any(isnan(c)))c=vec4(0.);c=min(c,vec4(48.));   /* Inf/NaN guard: a pile of additive points overflows the half-float target and the blur would spread it over the frame */
   float v=dot(c.rgb,vec3(.299,.587,.114));float a=smoothstep(uThr,uThr+uSmooth,v);gl_FragColor=mix(vec4(0.),c,a);}`;
 const BLUR=k=>`#define KERNEL_RADIUS ${k}\n#define SIGMA ${k}\nvarying vec2 vUv;uniform sampler2D colorTexture;uniform vec2 invSize;uniform vec2 direction;
  float gaussianPdf(in float x,in float sigma){return .39894*exp(-.5*x*x/(sigma*sigma))/sigma;}
  void main(){float fSigma=float(SIGMA);float weightSum=gaussianPdf(0.,fSigma);vec3 sum=texture2D(colorTexture,vUv).rgb*weightSum;
   for(int i=1;i<KERNEL_RADIUS;i++){float x=float(i);float w=gaussianPdf(x,fSigma);vec2 o=direction*invSize*x;sum+=(texture2D(colorTexture,vUv+o).rgb+texture2D(colorTexture,vUv-o).rgb)*w;weightSum+=2.*w;}
   gl_FragColor=vec4(sum/weightSum,1.);}`;
 const COMPOSITE=`varying vec2 vUv;uniform sampler2D blurTexture1,blurTexture2,blurTexture3,blurTexture4,blurTexture5;uniform float bloomStrength,bloomRadius;uniform float bloomFactors[${NM}];uniform vec3 bloomTintColors[${NM}];
  float lerpBloomFactor(const in float f){return mix(f,1.2-f,bloomRadius);}
  void main(){gl_FragColor=bloomStrength*(lerpBloomFactor(bloomFactors[0])*vec4(bloomTintColors[0],1.)*texture2D(blurTexture1,vUv)+lerpBloomFactor(bloomFactors[1])*vec4(bloomTintColors[1],1.)*texture2D(blurTexture2,vUv)
   +lerpBloomFactor(bloomFactors[2])*vec4(bloomTintColors[2],1.)*texture2D(blurTexture3,vUv)+lerpBloomFactor(bloomFactors[3])*vec4(bloomTintColors[3],1.)*texture2D(blurTexture4,vUv)
   +lerpBloomFactor(bloomFactors[4])*vec4(bloomTintColors[4],1.)*texture2D(blurTexture5,vUv));}`;

 /* R7.d anamorphic flare: the bloom's bright pass (half resolution) feeds ONE more threshold (only the very brightest sources) and two horizontal-only wide blurs at quarter resolution (a tight pass then a very wide one);
    the result is added in the uber pass with a cold-blue tint — the long cinematic streak through every hot star and the core. Same bright-pass input as the bloom: no extra bright pass. */
 const STREAK=(taps,stride,first)=>`varying vec2 vUv;uniform sampler2D colorTexture;uniform vec2 invSize;uniform float uThr;
  void main(){float sg=${(taps/2.2).toFixed(2)};vec3 sum=vec3(0.);float ws=0.;
   for(int i=-${taps};i<=${taps};i++){float x=float(i);float w=exp(-.5*x*x/(sg*sg));vec3 c=texture2D(colorTexture,vUv+vec2(x*${stride.toFixed(1)}*invSize.x,0.)).rgb;
    ${first?'float l=dot(c,vec3(.299,.587,.114));c*=smoothstep(uThr,uThr+.7,l);':''}sum+=c*w;ws+=w;}
   gl_FragColor=vec4(sum/ws,1.);}`;
 /* R7.e volumetric light cone: for every pixel march 24 (or 12) steps from the cone's apex towards the pixel, accumulating the in-cone density (an angular soft edge, a fade along the axis) modulated by a drifting simplex noise (dust in the beam). The start of the march is jittered by interleaved gradient noise, so 24 steps show no banding.
    Aspect-corrected: apex and axis are in uv, the maths in a square space. */
 const CONE=()=>BKShaders.use('hash','noise')+`
  varying vec2 vUv;uniform vec2 uApex,uDir;uniform float uAng,uLen,uTime,uAspect,uSteps;
  void main(){vec2 A=uApex*vec2(uAspect,1.),P=vUv*vec2(uAspect,1.),d=normalize(uDir);float jit=bk_ign(gl_FragCoord.xy+fract(uTime)*vec2(17.,31.)),acc=0.,tg=tan(uAng);
   for(int i=0;i<24;i++){if(float(i)>=uSteps)break;
    float s=(float(i)+jit)/uSteps;vec2 v=mix(A,P,s)-A;float t=dot(v,d);if(t<=0.)continue;float w=length(v-d*t),hw=t*tg+.004;
    float inside=1.-smoothstep(hw*.3,hw,w),fade=smoothstep(0.,.04,t)*(1.-smoothstep(uLen*.5,uLen,t))*(1.-.55*t/uLen);
    float n=.6+.4*bk_snoise2(vec2(t*7.,w/hw*2.4)+vec2(uTime*.06,uTime*.02));acc+=inside*fade*n;}
   acc/=max(uSteps,1.);gl_FragColor=vec4(vec3(1.,.86,.62)*acc*2.4,1.);}`;
 const UBER=()=>BKShaders.use('hash','lut3d')+`
  uniform sampler2D tScene,tBloom,tStreak,tCone;uniform sampler3D tLut;uniform float uTime,uCA,uLens,uAspect,uBlur,uGrain,uVignette,uLut,uBloomOn,uStreak,uCone;uniform vec2 uMouse,uBlurC;varying vec2 vUv;
  vec3 fxTap(vec2 uv){vec3 c=texture2D(tScene,uv).rgb;if(any(isnan(c)))c=vec3(0.);c=min(c,vec3(48.));
   if(uBloomOn>.5){vec4 b=texture2D(tBloom,uv);c+=b.rgb*b.a;if(uStreak>.001)c+=texture2D(tStreak,uv).rgb*uStreak*vec3(.42,.66,1.);if(uCone>.001)c+=texture2D(tCone,uv).rgb*uCone;}   /* bloom is added here, while the image is read: no full-resolution blend pass (b.a carries the composite weight, as UnrealBloom's additive blend did) */
   return c;}
  void main(){vec2 uv=vUv;vec2 c=uv-.5;float k=0.;
   if(uLens>.001){vec2 d=uv-uMouse;d.x*=uAspect;float r=length(d);k=uLens*.008/(r*r+.02);uv-=vec2(d.x/uAspect,d.y)/(r+1e-4)*k;}
   float ca=uCA*(.0012+.010*dot(c,c))+k*.04;
   vec3 col;
   if(ca>1e-5)col=vec3(fxTap(uv+c*ca).r,fxTap(uv).g,fxTap(uv-c*ca).b);else col=fxTap(uv);
   if(uBlur>.004){vec2 bd=uv-uBlurC;vec3 acc=col;for(int i=1;i<7;i++){acc+=fxTap(uv-bd*(float(i)/7.)*uBlur*.16);}col=mix(col,acc/7.,smoothstep(0.,.08,uBlur));}
   float lm=max(col.r,max(col.g,col.b));if(lm>.7)col*=(.7+.3*(1.-exp(-(lm-.7)/.3)))/lm;   /* R7.d filmic shoulder on the brightest channel: hot cores roll off in their own hue instead of every channel clipping to white */
   float vg=smoothstep(.28,.98,length(c*vec2(uAspect*.62,1.)));col*=1.-.42*uVignette*vg;
   if(uLut>.001)col=mix(col,bk_lut3d(tLut,col,${N}.),uLut);
   if(uGrain>0.)col+=(bk_ign(gl_FragCoord.xy+fract(uTime)*vec2(137.,91.))-.5)*.032*uGrain;     /* film grain, time-seeded */
   col+=(bk_ign(gl_FragCoord.xy+vec2(71.3,29.7))-.5)/255.;                                        /* dithering: breaks 8-bit banding in the dark gradients */
   gl_FragColor=vec4(col,1.);}`;

 function create(renderer,T,o){
  o=o||{};let theme=o.theme||'dark',dead=false,W=2,H=2,last={draws:0,fullReads:0,passes:0,streak:false,cone:false};
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.BufferAttribute(new Float32Array([-1,-1,0,3,-1,0,-1,3,0]),3));geo.setAttribute('uv',new T.BufferAttribute(new Float32Array([0,0,2,0,0,2]),2));
  const cam=new T.OrthographicCamera(-1,1,1,-1,0,1),mesh=new T.Mesh(geo,null),scn=new T.Scene();mesh.frustumCulled=false;scn.add(mesh);
  const sm=(frag,uniforms)=>new T.ShaderMaterial({uniforms,vertexShader:VERT,fragmentShader:frag,depthTest:false,depthWrite:false});
  const bloom={enabled:true,strength:.56,radius:.6,threshold:.24},streak={enabled:true,strength:.55,threshold:.85},cone={enabled:false,strength:.3,steps:24,angle:.15,len:.8,apex:new T.Vector2(.5,.4),dir:new T.Vector2(0,1)};
  /* ----- render-target pool ----- */
  const free=new Map(),used=new Set(),key=(w,h,d)=>w+'x'+h+(d?'d':'');
  const pool={get(w,h,depth){const k=key(w,h,depth),l=free.get(k);let rt=l&&l.pop();if(!rt){rt=new T.WebGLRenderTarget(w,h,{type:T.HalfFloatType,depthBuffer:!!depth});rt.texture.generateMipmaps=false;rt._k=k}used.add(rt);return rt},
   release(rt){if(!rt||!used.delete(rt))return;let l=free.get(rt._k);if(!l)free.set(rt._k,l=[]);l.push(rt)},
   flush(){for(const l of free.values())l.forEach(r=>r.dispose());free.clear()},
   get live(){let n=used.size;for(const l of free.values())n+=l.length;return n}};
  let rtS=null,rtB=null,hs=[],vs=[];
  /* ----- materials ----- */
  const mBright=sm(BRIGHT,{tScene:{value:null},uThr:{value:bloom.threshold},uSmooth:{value:.01}});
  const mBlur=KS.map(k=>sm(BLUR(k),{colorTexture:{value:null},invSize:{value:new T.Vector2(.5,.5)},direction:{value:new T.Vector2(1,0)}}));
  const mStrA=sm(STREAK(12,1.6,true),{colorTexture:{value:null},invSize:{value:new T.Vector2(.5,.5)},uThr:{value:streak.threshold}}),mStrB=sm(STREAK(14,5,false),{colorTexture:{value:null},invSize:{value:new T.Vector2(.5,.5)},uThr:{value:0}});
  const mCone=sm(CONE(),{uApex:{value:cone.apex},uDir:{value:cone.dir},uAng:{value:cone.angle},uLen:{value:cone.len},uTime:{value:0},uAspect:{value:1.6},uSteps:{value:24}});
  const mComp=sm(COMPOSITE,{blurTexture1:{value:null},blurTexture2:{value:null},blurTexture3:{value:null},blurTexture4:{value:null},blurTexture5:{value:null},bloomStrength:{value:bloom.strength},bloomRadius:{value:bloom.radius},
   bloomFactors:{value:BLOOM_F.slice()},bloomTintColors:{value:BLOOM_F.map(()=>new T.Vector3(1,1,1))}});
  const lutTex=th=>{const t=new T.Data3DTexture(lutData(th),N,N,N);t.format=T.RGBAFormat;t.type=T.UnsignedByteType;t.minFilter=t.magFilter=T.LinearFilter;t.wrapS=t.wrapT=t.wrapR=T.ClampToEdgeWrapping;t.unpackAlignment=1;t.needsUpdate=true;return t};
  let lut=lutTex(theme);
  const uni={tScene:{value:null},tBloom:{value:null},tStreak:{value:null},uStreak:{value:0},tCone:{value:null},uCone:{value:0},tLut:{value:lut},uTime:{value:0},uCA:{value:.3},uLens:{value:0},uAspect:{value:1.6},uBlur:{value:0},uGrain:{value:1},uVignette:{value:1},uLut:{value:1},uBloomOn:{value:0},uMouse:{value:new T.Vector2(.5,.5)},uBlurC:{value:new T.Vector2(.5,.5)}};
  const mUber=sm(UBER(),uni);
  const u={};for(const n of Object.keys(uni)){if(n[0]==='t')continue;Object.defineProperty(u,n,{enumerable:true,get:()=>uni[n].value,set:v=>{uni[n].value=v}})}
  /* ----- sizes ----- */
  function alloc(w,h){
   W=Math.max(2,w|0);H=Math.max(2,h|0);
   if(rtS)pool.release(rtS);if(rtB)pool.release(rtB);hs.forEach(r=>pool.release(r));vs.forEach(r=>pool.release(r));hs=[];vs=[];   // hand the old ones back first: equal sizes are reused, the rest is flushed below
   rtS=pool.get(W,H,true);let bw=Math.round(W/2),bh=Math.round(H/2);rtB=pool.get(bw,bh,false);
   for(let i=0;i<NM;i++){hs.push(pool.get(bw,bh,false));vs.push(pool.get(bw,bh,false));mBlur[i].uniforms.invSize.value.set(1/bw,1/bh);bw=Math.round(bw/2);bh=Math.round(bh/2)}
   for(let i=0;i<NM;i++)mComp.uniforms['blurTexture'+(i+1)].value=vs[i].texture;
   pool.flush();
   uni.tScene.value=rtS.texture;uni.tBloom.value=hs[0].texture;uni.tStreak.value=vs[1].texture;uni.tCone.value=hs[1].texture;   // the streak reuses the bloom's idle quarter-resolution mip pair (hs[1] -> vs[1]) once the composite has read it: no extra render target
   mStrA.uniforms.invSize.value.set(1/Math.round(W/2),1/Math.round(H/2));mStrB.uniforms.invSize.value.set(1/Math.round(W/4),1/Math.round(H/4))}
  function pass(m,rt){mesh.material=m;renderer.setRenderTarget(rt);renderer.render(scn,cam)}
  function render(scene,camera){
   if(dead||!rtS)return;
   const ac=renderer.autoClear,fl=!!bloom.enabled;
   renderer.setRenderTarget(rtS);renderer.render(scene,camera);                  // the scene (autoClear on: the renderer's clear colour)
   renderer.autoClear=false;                                                     // every pass below overwrites its whole target: no clears
   if(fl){
    mBright.uniforms.tScene.value=rtS.texture;mBright.uniforms.uThr.value=bloom.threshold;pass(mBright,rtB);
    let src=rtB;for(let i=0;i<NM;i++){const m=mBlur[i];m.uniforms.colorTexture.value=src.texture;m.uniforms.direction.value.set(1,0);pass(m,hs[i]);
     m.uniforms.colorTexture.value=hs[i].texture;m.uniforms.direction.value.set(0,1);pass(m,vs[i]);src=vs[i]}
    mComp.uniforms.bloomStrength.value=bloom.strength;mComp.uniforms.bloomRadius.value=bloom.radius;pass(mComp,hs[0])}
   const st=fl&&!!streak.enabled&&streak.strength>.001;
   if(st){mStrA.uniforms.colorTexture.value=rtB.texture;mStrA.uniforms.uThr.value=streak.threshold;pass(mStrA,hs[1]);mStrB.uniforms.colorTexture.value=hs[1].texture;pass(mStrB,vs[1])}   // R7.d anamorphic flare
   const cn=fl&&!!cone.enabled&&cone.strength>.001;
   if(cn){const cu=mCone.uniforms;cu.uTime.value=uni.uTime.value;cu.uAspect.value=uni.uAspect.value;cu.uSteps.value=Math.max(1,Math.min(24,cone.steps|0));cu.uAng.value=cone.angle;cu.uLen.value=cone.len;pass(mCone,hs[1])}   // R7.e light cone (hs[1] is free again: the streak's second pass has read it)
   uni.uCone.value=cn?cone.strength:0;uni.uStreak.value=st?streak.strength:0;uni.uBloomOn.value=fl?1:0;pass(mUber,null);
   renderer.autoClear=ac;
   last={draws:fl?1+2*NM+1+1+(st?2:0)+(cn?1:0):1,fullReads:fl?2:1,passes:fl?3+(st?1:0)+(cn?1:0):2,streak:st,cone:cn}}
  function dispose(){
   if(dead)return;dead=true;
   if(rtS)pool.release(rtS);if(rtB)pool.release(rtB);hs.forEach(r=>pool.release(r));vs.forEach(r=>pool.release(r));rtS=rtB=null;hs=[];vs=[];pool.flush();
   [mBright,mComp,mUber,mStrA,mStrB,mCone,...mBlur].forEach(m=>m.dispose());geo.dispose();lut.dispose();lut=null;uni.tLut.value=null}
  const fx={u,bloom,streak,cone,theme:()=>theme,
   setSize(w,h){if(!dead)alloc(w,h)},
   setTheme(th){if(dead||th===theme)return;theme=th;const old=lut;lut=lutTex(th);uni.tLut.value=lut;old.dispose()},
   render,dispose,
   info(){return{fx:'uber',...last,targets:dead?0:pool.live,pool:{free:[...free.values()].reduce((n,l)=>n+l.length,0),used:used.size},size:[W,H],bloom:!!bloom.enabled}}};
  alloc(o.width||2,o.height||2);
  return fx}

 window.BKFX={create,lutData,N,diag:()=>({lutThemes:Object.keys(lutCache)})};
})();
