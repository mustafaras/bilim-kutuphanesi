'use strict';
/* Nobel Skyline — 126 years as a lit 3D city of stacked prize-category towers on a reflective floor.
   R9 (docs/tasarim/PREMIUM-R6-R9-SAHNELER.md §R9) turns the flat instanced bars into a data-driven city:
     R9.1 the tower table is an RGBA32F DataTexture — one texel per year × category holding (goal height, height at the last goal
          change, the time of that change, on/off) — and the spring is the closed-form critically damped step response
          h(t) = goal + (h0 − goal)·e^(−ωt)(1 + ωt) evaluated in the vertex shader. No per-frame CPU spring, no render target, and
          the CPU twin heightAt() returns exactly the same number for labels, chips and the morph projection.
     R9.2 a light wave rides the timeline (uYearX): window density and fresnel rise at the front, a slow afterglow trails behind it,
          the selected year's tower lifts and a ≤150-point confetti burst falls for 1.2 s (reduced motion: highlight only).
     R9.3 picking reads a ¼-resolution identity buffer (one pixel, PIXEL_PACK_BUFFER + fenceSync, one frame late) so hover stays
          ≤ 2 frames at 126 years × 2 653 records; without WebGL2 it falls back to the analytic raycast.
     R9.4 selective bloom: the selected year's towers live on layer 1, a second camera renders only that layer into a ¼-resolution
          target and a 16-tap disc blur is composited additively — the rest of the city never blooms.
     R9.5 the camera glides on a Catmull-Rom rail (year → position) with a velocity-smoothed parameter; dragging nudges the rail and
          it springs back to the selected year on release; the look-at leans toward the next decade for a horizon feel.
     R9.6 glass: only ±6 years around the focus use the physical transmission material (the rest stay cheap), a horizon haze plane
          sits behind the city and highlighted towers carry a ≤ 0.5 Hz beacon pulse (photosensitive-safe).
     R9.7 decade labels get a CSS leader line up to their tower and appear staggered.
   Hover a tower → breakdown; click → that year's dossier (same control as the flat chart); legend chips isolate categories and the
   towers re-stack with spring easing; drag to orbit, Ctrl/⌘+wheel or buttons to zoom, ←/→ to walk through the years.
   Dark = glowing glass on deep ground, light = tinted glass on parchment with a soft contact shadow. */
window.NobelSkyline=(()=>{
 const root=document.documentElement,CATC=['#e8c58a','#7fcdb4','#d9909f','#b4a1e2','#8fbaf0','#e59a6e','#8fa3ad'];
 const reduced=typeof matchMedia==='function'?matchMedia('(prefers-reduced-motion: reduce)'):{matches:false};
 const lvl=()=>{try{return window.BKMotion?Math.max(0,Math.min(4,BKMotion.quality.level|0)):0}catch{return 0}};
 let inst=null;
 async function init(panel){
  if(inst)return inst;
  let THREE;try{THREE=await import('./vendor/three.module.min.js')}catch{return null}
  const idx=typeof nobelIndex!=='undefined'&&nobelIndex?nobelIndex:(typeof buildNobelIndex==='function'?buildNobelIndex():null);if(!idx||!idx.size)return null;
  const years=[...idx.keys()].sort(),Y0=Number(years[0]),Y1=Number(years.at(-1)),N=Y1-Y0+1,CAT=7;
  const catName=i=>typeof nobelCatLabel==='function'?nobelCatLabel(i):String(i);
  const STLM=!!(window.BKGL&&BKGL.still);   // ?still (visual gate): towers stand at their final height, camera at rest, clock frozen
  const canvas=panel.querySelector('canvas'),labels=panel.querySelector('.nc-3d-labels'),tip=panel.querySelector('.nc-3d-tip'),ctl=panel.querySelector('.nc-3d-ctl'),chip=panel.querySelector('.nc-sky-chip');
  const renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'high-performance'});renderer.setClearColor(0,0);renderer.info.autoReset=false;BKMaterials.tone(renderer,'skyline');
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(30,2,.1,120),grp=new THREE.Group();scene.add(grp);
  camera.layers.set(0);   // R9.4: the main camera never sees the bloom layer
  const GL2=!!(renderer.capabilities&&renderer.capabilities.isWebGL2);
  /* data */
  const maxTotal=Math.max(...years.map(y=>idx.get(y).total)),HS=4.4/maxTotal,DX=.16,BW=.118,BD=.5,X0=-(N-1)*DX/2,WN=7.5;
  const counts=[],catTotal=new Array(CAT).fill(0);
  for(let i=0;i<N;i++){const e=idx.get(String(Y0+i));counts.push(e?e.cats.slice():new Array(CAT).fill(0));if(e)e.cats.forEach((c,k)=>catTotal[k]+=c)}
  const keys=[];for(let i=0;i<N;i++)for(let c=0;c<CAT;c++)if(counts[i][c]>0)keys.push({i,c});
  const K=keys.length,TEX=N*CAT,catOn=(window.NobelFilter&&window.NobelFilter.on)||new Array(CAT).fill(true);
  let time=0,settleAt=0;
  /* R9.1 — the tower table as a texture + the analytic spring. Texel (i·7+c) = (goal, h0, t0, on). */
  const tdata=new Float32Array(TEX*4),goal=new Float32Array(TEX),h0=new Float32Array(TEX),t0=new Float32Array(TEX),onv=new Float32Array(TEX);
  const towerTex=new THREE.DataTexture(tdata,TEX,1,THREE.RGBAFormat,THREE.FloatType);
  towerTex.minFilter=towerTex.magFilter=THREE.NearestFilter;towerTex.generateMipmaps=false;towerTex.needsUpdate=true;
  const keyAt=new Int32Array(TEX).fill(-1);for(let k=0;k<K;k++)keyAt[keys[k].i*CAT+keys[k].c]=k;
  const heightAt=(i,c,t)=>{const k=i*CAT+c;if(!onv[k])return 0;const g=goal[k],a=h0[k],dt=Math.max(0,t-t0[k]);return g+(a-g)*Math.exp(-WN*dt)*(1+WN*dt)};
  const yearTop=(i,t)=>{let s=0;for(let c=0;c<CAT;c++)s+=heightAt(i,c,t);return s};
  function setGoal(i,c,v,tv,snap){const k=i*CAT+c,o=v>0?1:0;if(goal[k]===v&&onv[k]===o)return false;
   h0[k]=snap?v:heightAt(i,c,tv);goal[k]=v;t0[k]=tv;onv[k]=o;
   tdata[k*4]=v;tdata[k*4+1]=h0[k];tdata[k*4+2]=tv;tdata[k*4+3]=o;return true}
  function refreshGoals(t,snap,stagger){let ch=false;
   for(let i=0;i<N;i++)for(let c=0;c<CAT;c++){const v=catOn[c]?counts[i][c]*HS:0;if(setGoal(i,c,v,snap?t:t+(stagger?i*.007:0),snap))ch=true}
   if(ch){towerTex.needsUpdate=true;if(!snap)settleAt=t+1.4+(stagger?(N-1)*.007:0)}return ch}
  refreshGoals(0,STLM,!STLM);
  /* studio environment: BKMaterials bakes it once per renderer (soft boxes → PMREM) so the glass towers reflect something */
  let env=BKMaterials.env(renderer,THREE,'city');if(env)scene.environment=env;
  /* towers + mirrored reflections */
  const geo=new THREE.BoxGeometry(1,1,1);
  const aId=new THREE.InstancedBufferAttribute(new Float32Array(K),1);
  for(let k=0;k<K;k++)aId.array[k]=keys[k].i*CAT+keys[k].c;
  geo.setAttribute('aId',aId);
  /* every tower face carries a grid of windows that flicker on and off (hash per window), tinted by the category colour, plus a
     fresnel edge: the stacked bars read as a lit glass city. R9.2 adds the light wave + beacon, R9.1 the texture-driven height. */
  const U={time:{value:0},win:{value:1.5},rim:{value:.5},h:{value:towerTex},texOn:{value:GL2?1:0},texW:{value:TEX},yearX:{value:1e6},waveOn:{value:0},selX:{value:1e6},beacon:{value:0}};
  const TEXCHUNK=`attribute float aId;uniform sampler2D uH;uniform float uTexOn,uTexW,uMirror;
vec3 bkSkyPos(vec3 p,float id){if(uTexOn<.5)return p;
 float iy=floor(id/7.0+1e-4),ic=id-iy*7.0;
 float h=max(texture2D(uH,vec2((id+.5)/uTexW,.5)).r,.0001);
 float y0=0.0;
 for(int j=0;j<7;j++){if(float(j)<ic)y0+=texture2D(uH,vec2((iy*7.0+float(j)+.5)/uTexW,.5)).r;}
 float y=(p.y+.5)*h+y0;
 return vec3(p.x,mix(y,-y-.004,uMirror),p.z);}`;
  const WINFRAG=`#include <emissivemap_fragment>
    {vec2 g=vec2((vWP.x+vWP.z*1.37)/.045,abs(vWP.y)/.105);vec2 c=floor(g),f=fract(g);
     float win=step(.2,f.y)*step(f.y,.8)*step(.18,f.x)*step(f.x,.84);
     float hh=fract(sin(dot(c,vec2(12.9898,78.233)))*43758.5453);
     float on=step(.42,hh)*(.55+.45*sin(uTime*.55+hh*40.));
     float wv=0.0;
     if(uWaveOn>.5){float d=abs(vWP.x-uYearX);wv=smoothstep(.62,0.,d);float tr=smoothstep(2.4,0.,max(0.,uYearX-vWP.x));wv=max(wv,tr*.42);}
     totalEmissiveRadiance+=diffuseColor.rgb*win*on*uWin*uWinK*(1.+wv*1.7);
     float fr=pow(1.-abs(dot(normalize(vNormal),normalize(vViewPosition))),2.6);
     float sel=smoothstep(.1,0.,abs(vWP.x-uSelX));
     float bc=sel*uBeacon*(.5+.5*sin(uTime*3.1416));
     totalEmissiveRadiance+=diffuseColor.rgb*(fr*uRim*(1.+wv*1.5)+bc*.6);}`;
  function wire(sh,mirror,winK,isRefl){
   sh.uniforms.uTime=U.time;sh.uniforms.uWin=U.win;sh.uniforms.uRim=U.rim;sh.uniforms.uH=U.h;sh.uniforms.uTexOn=U.texOn;sh.uniforms.uTexW=U.texW;
   sh.uniforms.uYearX=U.yearX;sh.uniforms.uWaveOn=U.waveOn;sh.uniforms.uSelX=U.selX;sh.uniforms.uBeacon=U.beacon;
   sh.uniforms.uMirror=mirror;sh.uniforms.uWinK={value:winK};
   sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vWP;\n'+TEXCHUNK)
    .replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed=bkSkyPos(transformed,aId);')
    .replace('#include <project_vertex>','#include <project_vertex>\nvWP=(modelMatrix*instanceMatrix*vec4(transformed,1.0)).xyz;');
   sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vWP;uniform float uTime,uWin,uRim,uWinK,uYearX,uWaveOn,uSelX,uBeacon;')
    .replace('#include <emissivemap_fragment>',WINFRAG);
   if(isRefl)sh.fragmentShader=sh.fragmentShader.replace('#include <dithering_fragment>','#include <dithering_fragment>\ngl_FragColor.a*=exp(vWP.y*.62)*smoothstep(.0,.25,-vWP.y+.02);');
  }
  const mat=new THREE.MeshStandardMaterial({metalness:.28,roughness:.22,envMapIntensity:1.25});
  mat.customProgramCacheKey=()=>'bk-sky-windows';mat.onBeforeCompile=sh=>wire(sh,{value:0},1,false);
  /* R9.6 glass: real transmission + clearcoat, but only the ±6-year window around the focus (see syncGlass) */
  const glassMat=new THREE.MeshPhysicalMaterial({metalness:0,roughness:.12,transmission:.62,thickness:.45,ior:1.45,clearcoat:1,clearcoatRoughness:.08,iridescence:.35,iridescenceIOR:1.3,envMapIntensity:1.5,attenuationDistance:.7});
  glassMat.customProgramCacheKey=()=>'bk-sky-windows-glass';glassMat.onBeforeCompile=sh=>wire(sh,{value:0},1,false);
  const reflMat=new THREE.MeshStandardMaterial({metalness:.1,roughness:.35,transparent:true,opacity:.2,depthWrite:false,envMapIntensity:.8});
  reflMat.customProgramCacheKey=()=>'bk-sky-refl';reflMat.onBeforeCompile=sh=>wire(sh,{value:1},.8,true);
  const towers=new THREE.InstancedMesh(geo,mat,K),refl=new THREE.InstancedMesh(geo,reflMat,K);
  towers.frustumCulled=refl.frustumCulled=false;grp.add(towers,refl);
  const glassGeo=geo.clone(),glassTowers=new THREE.InstancedMesh(glassGeo,glassMat,K);
  glassTowers.frustumCulled=false;glassTowers.count=0;grp.add(glassTowers);
  const col=new THREE.Color(),base=CATC.map(h=>new THREE.Color(h)),M=new THREE.Matrix4(),Q=new THREE.Quaternion(),P=new THREE.Vector3(),S=new THREE.Vector3();
  const colorsDirty={v:true};let hoverYear=-1,selYear=-1,cmpYear=-1,cmpOn=false,glassOn=false,glassN=0,idRaw=-1;
  const texOn=GL2;
  /* with the texture path the instance matrices are static: translate(x,0,0)·scale(BW,1,BD) — the shader supplies the height */
  function staticMatrices(){for(let k=0;k<K;k++){const x=X0+keys[k].i*DX;P.set(x,0,0);S.set(BW,1,BD);M.compose(P,Q,S);towers.setMatrixAt(k,M);refl.setMatrixAt(k,M)}
   towers.instanceMatrix.needsUpdate=true;refl.instanceMatrix.needsUpdate=true}
  function recolor(){const light=root.dataset.theme==='light';for(let k=0;k<K;k++){const {i,c}=keys[k];col.copy(base[c]);const hot=i===hoverYear,sel=i===selYear||i===cmpYear;if(light)col.multiplyScalar(hot||sel?1.0:.88);else col.multiplyScalar(hot?1.45:sel?1.3:.82);if(selYear>=0&&!sel&&!hot)col.lerp(new THREE.Color(light?0xdad2c0:0x1b2a36),light?.28:.32);towers.setColorAt(k,col);refl.setColorAt(k,col)}towers.instanceColor.needsUpdate=true;refl.instanceColor.needsUpdate=true;colorsDirty.v=false;if(glassN)syncGlass()}
  /* R9.6 — the ±6-year glass window: a second instanced mesh with the physical material, the same towers hidden in the opaque city */
  function syncGlass(){
   const on=glassOn&&GL2&&lvl()<=1&&selYear>=0;
   if(!on){if(glassN){glassTowers.count=0;glassN=0;staticMatrices()}return}
   const a=Math.max(0,selYear-6),b=Math.min(N-1,selYear+6),ai=glassGeo.attributes.aId.array;let n=0;
   for(let i=a;i<=b;i++)for(let c=0;c<CAT;c++){const k=keyAt[i*CAT+c];if(k<0)continue;
    ai[n]=i*CAT+c;P.set(X0+i*DX,0,0);S.set(BW,1,BD);M.compose(P,Q,S);glassTowers.setMatrixAt(n,M);
    if(towers.instanceColor)towers.getColorAt(k,col);else col.copy(base[c]);glassTowers.setColorAt(n,col);n++}
   glassGeo.attributes.aId.needsUpdate=true;glassTowers.instanceMatrix.needsUpdate=true;
   if(glassTowers.instanceColor)glassTowers.instanceColor.needsUpdate=true;
   glassTowers.count=n;glassN=n;
   for(let k=0;k<K;k++){const i=keys[k].i,hide=i>=a&&i<=b;P.set(X0+i*DX,0,0);S.set(BW,hide?0:1,hide?0:BD);M.compose(P,Q,S);towers.setMatrixAt(k,M);refl.setMatrixAt(k,M)}
   towers.instanceMatrix.needsUpdate=true;refl.instanceMatrix.needsUpdate=true;
  }
  /* floor, rulers, glow of the selected year */
  const floorMat=new THREE.MeshBasicMaterial({transparent:true,depthWrite:false,opacity:1}),floor=new THREE.Mesh(new THREE.PlaneGeometry(N*DX+6,7),floorMat);floor.rotation.x=-Math.PI/2;floor.position.y=-.004;grp.add(floor);
  const floorTex=(()=>{const c=document.createElement('canvas');c.width=512;c.height=128;const x=c.getContext('2d'),g=x.createRadialGradient(256,64,10,256,64,256);g.addColorStop(0,'rgba(255,255,255,.34)');g.addColorStop(.6,'rgba(255,255,255,.08)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,512,128);x.globalCompositeOperation='destination-in';const vf=x.createLinearGradient(0,0,0,128);vf.addColorStop(0,'rgba(0,0,0,0)');vf.addColorStop(.32,'rgba(0,0,0,1)');vf.addColorStop(.68,'rgba(0,0,0,1)');vf.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=vf;x.fillRect(0,0,512,128);return new THREE.CanvasTexture(c)})();
  floorMat.map=floorTex;floorMat.needsUpdate=true;
  const lineMat=new THREE.LineBasicMaterial({transparent:true,opacity:.22,color:0x9fb8c8}),pts=[];
  for(let d=Math.ceil(Y0/10)*10;d<=Y1;d+=10){const x=X0+(d-Y0)*DX;pts.push(new THREE.Vector3(x,0,.3),new THREE.Vector3(x,0,-.3))}
  const rulers=[10,20,30,40].filter(v=>v<=maxTotal+4);rulers.forEach(v=>{const y=v*HS;pts.push(new THREE.Vector3(X0-.2,y,-.34),new THREE.Vector3(-X0+.2,y,-.34))});
  grp.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts),lineMat));
  const beam=new THREE.Mesh(new THREE.PlaneGeometry(DX*2.6,6),new THREE.MeshBasicMaterial({map:(()=>{const c=document.createElement('canvas');c.width=16;c.height=128;const x=c.getContext('2d'),g=x.createLinearGradient(0,128,0,0);g.addColorStop(0,'rgba(255,240,200,.55)');g.addColorStop(1,'rgba(255,240,200,0)');x.fillStyle=g;x.fillRect(0,0,16,128);return new THREE.CanvasTexture(c)})(),transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));beam.position.y=3;beam.visible=false;grp.add(beam);
  const beam2=beam.clone();beam2.material=beam.material.clone();beam2.visible=false;grp.add(beam2);
  const chip2=document.createElement('div');chip2.className='nc-sky-chip nc-sky-chip2';chip2.hidden=true;chip2.setAttribute('aria-hidden','true');panel.appendChild(chip2);
  /* R9.6 horizon haze: a soft gradient card behind the city (cheaper and safer than scene fog on a transparent canvas) */
  const hazeMat=new THREE.MeshBasicMaterial({transparent:true,depthWrite:false,opacity:.5,blending:THREE.AdditiveBlending,map:(()=>{const c=document.createElement('canvas');c.width=8;c.height=128;const x=c.getContext('2d'),g=x.createLinearGradient(0,128,0,0);g.addColorStop(0,'rgba(255,255,255,.55)');g.addColorStop(.45,'rgba(255,255,255,.16)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,8,128);return new THREE.CanvasTexture(c)})()});
  const haze=new THREE.Mesh(new THREE.PlaneGeometry(N*DX+14,9),hazeMat);haze.position.set(0,3.2,-3.4);grp.add(haze);
  /* coloured light pooling on the floor under the towers: every year bleeds its dominant prize colours into the reflective ground */
  const bleedC=document.createElement('canvas');bleedC.width=N;bleedC.height=32;const bleedX=bleedC.getContext('2d'),bleedTex=new THREE.CanvasTexture(bleedC);bleedTex.minFilter=bleedTex.magFilter=THREE.LinearFilter;
  const bleed=new THREE.Mesh(new THREE.PlaneGeometry(N*DX,BD*2.6),new THREE.MeshBasicMaterial({map:bleedTex,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,opacity:.55}));bleed.rotation.x=-Math.PI/2;bleed.position.set(0,.004,.05);grp.add(bleed);
  function paintBleed(){const im=bleedX.createImageData(N,32),d=im.data;for(let i=0;i<N;i++){let r=0,g=0,b=0,w=0;for(let c=0;c<CAT;c++){const n=catOn[c]?counts[i][c]:0;if(!n)continue;r+=base[c].r*n;g+=base[c].g*n;b+=base[c].b*n;w+=n}const tot=w?Math.min(1,w/(maxTotal*.55)):0;
    for(let y=0;y<32;y++){const a=Math.exp(-Math.pow((y-16)/7.5,2))*(.2+.8*tot),k=(y*N+i)*4;d[k]=w?r/w*255:0;d[k+1]=w?g/w*255:0;d[k+2]=w?b/w*255:0;d[k+3]=a*255}}bleedX.putImageData(im,0,0);bleedTex.needsUpdate=true}
  paintBleed();document.addEventListener('nobel:filter',()=>{paintBleed();refreshGoals(time,STLM);wake()});
  /* sparks rising out of the selected year's tower + slow ambient motes in the volume */
  const dotTex=(()=>{const c=document.createElement('canvas');c.width=c.height=32;const g=c.getContext('2d'),r=g.createRadialGradient(16,16,0,16,16,16);r.addColorStop(0,'rgba(255,255,255,1)');r.addColorStop(.35,'rgba(255,255,255,.7)');r.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=r;g.fillRect(0,0,32,32);return new THREE.CanvasTexture(c)})();
  const RN=110,rainP=new Float32Array(RN*3),rainS=Float32Array.from({length:RN*3},()=>Math.random());
  const rainGeo=new THREE.BufferGeometry();rainGeo.setAttribute('position',new THREE.BufferAttribute(rainP,3));
  const rainMat=new THREE.PointsMaterial({size:.06,map:dotTex,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,opacity:.9,color:0xffe6b0}),rain=new THREE.Points(rainGeo,rainMat);rain.frustumCulled=false;rain.visible=false;grp.add(rain);
  const DN=150,dustP=new Float32Array(DN*3),dustS=Float32Array.from({length:DN*4},()=>Math.random());
  const dustGeo=new THREE.BufferGeometry();dustGeo.setAttribute('position',new THREE.BufferAttribute(dustP,3));
  const dustMat=new THREE.PointsMaterial({size:.045,map:dotTex,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,opacity:.5,color:0xffe9c0}),dust=new THREE.Points(dustGeo,dustMat);dust.frustumCulled=false;grp.add(dust);
  /* R9.2 confetti: ≤150 GPU-positioned points, 1.2 s damped fall, only on a year change and never under reduced motion */
  const CN=150,confGeo=new THREE.BufferGeometry(),confSeed=new Float32Array(CN*4),confStart=new Float32Array(CN*3);
  for(let i=0;i<CN;i++){const a=Math.random()*6.2832,s=.5+Math.random()*1.5;
   confSeed[i*4]=Math.cos(a)*s*.55;confSeed[i*4+1]=.9+Math.random()*1.5;confSeed[i*4+2]=Math.sin(a)*s*.55;confSeed[i*4+3]=.5+Math.random();
   confStart[i*3]=(Math.random()-.5)*BW*1.4;confStart[i*3+1]=0;confStart[i*3+2]=(Math.random()-.5)*BD*.9}
  confGeo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(CN*3),3));
  confGeo.setAttribute('aSeed',new THREE.BufferAttribute(confSeed,4));
  confGeo.setAttribute('aStart',new THREE.BufferAttribute(confStart,3));
  const confMat=new THREE.ShaderMaterial({uniforms:{uT:{value:0},uOrigin:{value:new THREE.Vector3()},uColor:{value:new THREE.Color(0xffe6b0)},uSize:{value:1}},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
   vertexShader:`attribute vec4 aSeed;attribute vec3 aStart;uniform float uT,uSize;uniform vec3 uOrigin;varying float vA;
    void main(){float t=uT;vec3 p=uOrigin+aStart+vec3(aSeed.x,aSeed.y,aSeed.z)*t+vec3(0.0,-1.9,0.0)*t*t*.5;
     vA=smoothstep(1.2,.8,t)*step(.0001,t);
     vec4 mv=modelViewMatrix*vec4(p,1.0);gl_PointSize=uSize*(.6+aSeed.w)*(9.0/max(.1,-mv.z));gl_Position=projectionMatrix*mv;}`,
   fragmentShader:`uniform vec3 uColor;varying float vA;void main(){float d=length(gl_PointCoord-.5);gl_FragColor=vec4(uColor,smoothstep(.5,0.0,d)*vA);}`});
  const conf=new THREE.Points(confGeo,confMat);conf.frustumCulled=false;conf.visible=false;grp.add(conf);
  let confT=9;
  const key=new THREE.DirectionalLight(0xfff0d6,2.0);key.position.set(-4,8,7);scene.add(key);const rim=new THREE.DirectionalLight(0x9fc4ff,.9);rim.position.set(6,3,-5);scene.add(rim);scene.add(new THREE.AmbientLight(0xffffff,.35));
  /* R9.3 identity buffer: a ¼-resolution pass that writes the texel index, read back one pixel at a time */
  const idRT=GL2?new THREE.WebGLRenderTarget(2,2,{minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter,depthBuffer:true,stencilBuffer:false}):null;
  if(idRT)idRT.texture.generateMipmaps=false;
  const idScene=new THREE.Scene(),idCam=new THREE.PerspectiveCamera(30,2,.1,120);idCam.layers.set(0);idCam.matrixWorldAutoUpdate=false;
  const idMat=new THREE.ShaderMaterial({uniforms:{uH:U.h,uTexOn:U.texOn,uTexW:U.texW},
   vertexShader:`attribute float aId;uniform sampler2D uH;uniform float uTexOn,uTexW;varying float vId;
    void main(){vId=aId;vec3 p=position;
     if(uTexOn>.5){float iy=floor(aId/7.0+1e-4),ic=aId-iy*7.0;
      float h=max(texture2D(uH,vec2((aId+.5)/uTexW,.5)).r,.0001);float y0=0.0;
      for(int j=0;j<7;j++){if(float(j)<ic)y0+=texture2D(uH,vec2((iy*7.0+float(j)+.5)/uTexW,.5)).r;}
      p.y=(p.y+.5)*h+y0;}
     gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(p,1.0);}`,
   fragmentShader:`varying float vId;void main(){float id=vId+1.0;gl_FragColor=vec4(mod(id,256.0)/255.0,mod(floor(id/256.0),256.0)/255.0,0.0,1.0);}`});
  const idTowers=new THREE.InstancedMesh(geo,idMat,K);idTowers.instanceMatrix=towers.instanceMatrix;idTowers.frustumCulled=false;idScene.add(idTowers);
  let idDirty=false,idPending=false,idSync=null,idPBO=null,idPx=0,idPy=0,idWait=0,idAsyncOk=true,idPath='sync';const idBuf=new Uint8Array(4);
  /* synchronous fallback: one pixel from a quarter-res target, only on hover, and only when the fence path is unusable */
  function idReadSync(){renderer.readRenderTargetPixels(idRT,idPx,idPy,1,1,idBuf);idPending=false;idPath='sync';applyId(idBuf[0]+idBuf[1]*256-1)}
  function idRender(){
   if(!idRT||!idDirty)return;idDirty=false;
   idCam.position.copy(camera.position);idCam.quaternion.copy(camera.quaternion);
   idCam.projectionMatrix.copy(camera.projectionMatrix);idCam.projectionMatrixInverse.copy(camera.projectionMatrixInverse);
   idCam.matrixWorld.copy(camera.matrixWorld);idCam.matrixWorldInverse.copy(camera.matrixWorldInverse);
   renderer.setRenderTarget(idRT);renderer.render(idScene,idCam);
   const r=canvas.getBoundingClientRect();
   idPx=Math.max(0,Math.min(idRT.width-1,Math.floor((mouse.x-r.left)/Math.max(1,r.width)*idRT.width)));
   idPy=Math.max(0,Math.min(idRT.height-1,Math.floor((1-(mouse.y-r.top)/Math.max(1,r.height))*idRT.height)));
   const gl=renderer.getContext();
   if(idAsyncOk&&gl&&gl.readPixels&&gl.fenceSync){
    if(!idPBO){idPBO=gl.createBuffer();gl.bindBuffer(gl.PIXEL_PACK_BUFFER,idPBO);gl.bufferData(gl.PIXEL_PACK_BUFFER,4,gl.STREAM_READ);gl.bindBuffer(gl.PIXEL_PACK_BUFFER,null)}
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER,idPBO);gl.readPixels(idPx,idPy,1,1,gl.RGBA,gl.UNSIGNED_BYTE,0);gl.bindBuffer(gl.PIXEL_PACK_BUFFER,null);
    if(idSync){gl.deleteSync(idSync);idSync=null}
    idSync=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);
    if(idSync){gl.flush();idPending=true;idWait=0;idPath='async'}else idReadSync()   /* no fence on this driver: read now, never leave idPending stuck */
   }else idReadSync();
   renderer.setRenderTarget(null);
  }
  function idPoll(){
   if(!idPending)return;
   if(!idSync){idPending=false;return}
   const gl=renderer.getContext();let st;
   try{st=gl.clientWaitSync(idSync,0,0)}catch{st=gl.WAIT_FAILED}
   if(st===gl.ALREADY_SIGNALED||st===gl.CONDITION_SATISFIED){
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER,idPBO);gl.getBufferSubData(gl.PIXEL_PACK_BUFFER,0,idBuf);gl.bindBuffer(gl.PIXEL_PACK_BUFFER,null);
    gl.deleteSync(idSync);idSync=null;idPending=false;idPath='async';applyId(idBuf[0]+idBuf[1]*256-1);
   }else if(st===gl.WAIT_FAILED||++idWait>4){
    /* SwiftShader can leave the fence unsignalled forever; a stuck fence must never mean a dead hover, so read synchronously from now on */
    gl.deleteSync(idSync);idSync=null;idPending=false;idAsyncOk=false;idReadSync();
   }
  }
  function applyId(t){idRaw=t;const k=t>=0&&t<TEX?keyAt[t]:-1,i=k>=0?keys[k].i:-1,c=k>=0?keys[k].c:-1;
   if(i!==hoverYear){hoverYear=i;colorsDirty.v=true;showTip(i,c);document.dispatchEvent(new CustomEvent('nobel:hover',{detail:i>=0?Y0+i:0}))}else if(i>=0)placeTip();
   canvas.style.cursor=i>=0?'pointer':'grab'}
  /* R9.4 selective bloom: the selected year's towers on layer 1 → ¼-res target → 16-tap disc blur composited additively */
  const bloomRT=GL2?new THREE.WebGLRenderTarget(2,2,{minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,depthBuffer:true,stencilBuffer:false}):null;
  if(bloomRT)bloomRT.texture.generateMipmaps=false;
  const bloomCam=new THREE.PerspectiveCamera(30,2,.1,120);bloomCam.layers.set(1);bloomCam.matrixWorldAutoUpdate=false;
  const glowGeo=geo.clone();glowGeo.setAttribute('aId',new THREE.InstancedBufferAttribute(new Float32Array(CAT),1));
  const glowMat=new THREE.ShaderMaterial({uniforms:{uH:U.h,uTexOn:U.texOn,uTexW:U.texW,uColor:{value:new THREE.Color(0xffe6b0)},uAmt:{value:1}},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,
   vertexShader:`attribute float aId;uniform sampler2D uH;uniform float uTexOn,uTexW;varying vec3 vWP;varying vec3 vN;
    void main(){vec3 p=position;
     if(uTexOn>.5){float iy=floor(aId/7.0+1e-4),ic=aId-iy*7.0;
      float h=max(texture2D(uH,vec2((aId+.5)/uTexW,.5)).r,.0001);float y0=0.0;
      for(int j=0;j<7;j++){if(float(j)<ic)y0+=texture2D(uH,vec2((iy*7.0+float(j)+.5)/uTexW,.5)).r;}
      p.y=(p.y+.5)*h*1.02+y0-.01;}
     vec4 wp=modelMatrix*instanceMatrix*vec4(p,1.0);vWP=wp.xyz;vN=normalize(mat3(modelMatrix)*normal);
     gl_Position=projectionMatrix*viewMatrix*wp;}`,
   fragmentShader:`uniform vec3 uColor;uniform float uAmt;varying vec3 vWP;varying vec3 vN;
    void main(){vec3 V=normalize(cameraPosition-vWP);float f=pow(1.-abs(dot(normalize(vN),V)),1.6);
     gl_FragColor=vec4(uColor*(.22+f*1.5)*uAmt,1.0);}`});
  const glow=new THREE.InstancedMesh(glowGeo,glowMat,CAT);glow.layers.set(1);glow.frustumCulled=false;glow.count=0;grp.add(glow);
  function syncGlow(){
   const on=GL2&&selYear>=0&&!reduced.matches&&lvl()<=1;
   if(!on){glow.count=0;return}
   const ai=glowGeo.attributes.aId.array;let n=0;
   for(let c=0;c<CAT;c++){if(!counts[selYear][c])continue;ai[n]=selYear*CAT+c;
    P.set(X0+selYear*DX,0,0);S.set(BW*1.12,1,BD*1.12);M.compose(P,Q,S);glow.setMatrixAt(n,M);n++}
   glowGeo.attributes.aId.needsUpdate=true;glow.instanceMatrix.needsUpdate=true;glow.count=n;
  }
  const quadScene=new THREE.Scene(),quadCam=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
  const quadMat=new THREE.ShaderMaterial({uniforms:{uTex:{value:null},uAmt:{value:1}},transparent:true,depthTest:false,depthWrite:false,blending:THREE.AdditiveBlending,
   vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}',
   fragmentShader:`uniform sampler2D uTex;uniform float uAmt;varying vec2 vUv;
    void main(){vec3 c=vec3(0.0);
     for(int i=0;i<16;i++){float a=float(i)*2.39996;float r=.0035+float(i)*.0016;c+=texture2D(uTex,vUv+vec2(cos(a),sin(a))*r).rgb;}
     gl_FragColor=vec4(c/16.0*uAmt,1.0);}`});
  quadScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),quadMat));
  /* labels (decades + rulers) */
  const decs=[];for(let d=Math.ceil(Y0/10)*10;d<=Y1;d+=10)decs.push(d);
  labels.innerHTML=decs.map(d=>`<span data-d="${d}">${d}</span>`).join('')+rulers.map(v=>`<span class="r" data-r="${v}">${v}</span>`).join('');const lab=[...labels.children];let labFrame=0;
  lab.forEach((el,i)=>{el.style.transitionDelay=(i*45)+'ms';el.style.opacity='0'});
  /* the stagger is a one-shot entrance: after it plays, drop the delay so later opacity changes (declutter, camera) stay instant */
  setTimeout(()=>lab.forEach(el=>{el.style.transitionDelay=''}),lab.length*45+700);
  /* year slider (drag = year changes, camera follows, tower lights up) + a screen-reader table of the selected year */
  const tl=document.createElement('div');tl.className='nc-sky-time';tl.innerHTML=`<button type="button" class="nc-tgl nc-cmp-btn" aria-pressed="false">⇄ ${esc(t('nsCompare'))}</button><span>${Y0}</span><input type="range" min="${Y0}" max="${Y1}" step="1" value="${Y1}" aria-label="${esc(t('nsSlider'))}"><span>${Y1}</span><button type="button" class="nc-tgl nc-glass-btn" aria-pressed="false">◇ ${esc(t('nsGlass'))}</button>`;panel.appendChild(tl);
  const cmpBtn=tl.querySelector('.nc-cmp-btn'),glassBtn=tl.querySelector('.nc-glass-btn'),cmpCard=document.createElement('aside');cmpCard.className='nc-cmp';cmpCard.hidden=true;cmpCard.setAttribute('aria-live','polite');panel.appendChild(cmpCard);
  const slider=tl.querySelector('input'),srTab=document.createElement('table');srTab.className='sr-only';panel.appendChild(srTab);
  const paintSlider=()=>{const lo=(Number(slider.value)-Y0)/(Y1-Y0)*100;slider.style.setProperty('--p',lo+'%')};
  slider.addEventListener('input',()=>{const y=String(slider.value);paintSlider();if(idx.has(y)&&typeof selectNobelYear==='function'){selectNobelYear(y,true);syncSel();wake()}else{/* years without prizes: snap to the nearest year that has data */let best=null;for(const k of years){if(best===null||Math.abs(Number(k)-Number(y))<Math.abs(Number(best)-Number(y)))best=k}if(best&&typeof selectNobelYear==='function'){selectNobelYear(best,true);syncSel();wake()}}});
  slider.addEventListener('pointerdown',e=>e.stopPropagation());
  /* compare mode: pick a second year → side-by-side panel with per-category differences */
  function pctTxt(a,b){if(!a)return b?'+∞':'0%';const p=Math.round((b-a)/a*100);return(p>0?'+':'')+p+'%'}
  function updateCompare(){const on=cmpOn&&selYear>=0&&cmpYear>=0&&selYear!==cmpYear;cmpCard.hidden=!on;beam2.visible=on;chip2.hidden=!on;if(!on){colorsDirty.v=true;return}
   const A=idx.get(String(Y0+selYear)),B=idx.get(String(Y0+cmpYear));if(!A||!B){cmpCard.hidden=true;return}
   const mx=Math.max(...A.cats.slice(0,6),...B.cats.slice(0,6),1);
   cmpCard.innerHTML=`<div class="hd"><b>${Y0+selYear}</b><i aria-hidden="true">⇄</i><b class="b">${Y0+cmpYear}</b><button type="button" class="x" aria-label="${esc(t('nsCmpOff'))}">×</button></div>
    <p class="tot"><span>${A.total}</span><em class="${B.total>=A.total?'up':'dn'}">${pctTxt(A.total,B.total)}</em><span>${B.total}</span></p>`+
    A.cats.slice(0,6).map((n,k)=>{const m=B.cats[k],d=m-n;return`<div class="r" style="--c:${CATC[k]}"><span class="n">${esc(catName(k))}</span><span class="bar a"><i style="width:${n/mx*100}%"></i></span><span class="v">${n}</span><span class="d ${d>0?'up':d<0?'dn':''}">${d>0?'▲':d<0?'▼':'•'}${Math.abs(d)}</span><span class="v">${m}</span><span class="bar b"><i style="width:${m/mx*100}%"></i></span></div>`}).join('');
   colorsDirty.v=true}
  function setCmp(on){cmpOn=on;cmpBtn.setAttribute('aria-pressed',String(on));if(!on){cmpYear=-1}updateCompare();wake()}
  cmpBtn.addEventListener('click',()=>setCmp(!cmpOn));cmpCard.addEventListener('click',e=>{if(e.target.closest&&e.target.closest('.x'))setCmp(false)});
  glassBtn.addEventListener('click',()=>{glassOn=glassBtn.getAttribute('aria-pressed')!=='true';glassBtn.setAttribute('aria-pressed',String(glassOn));syncGlass();colorsDirty.v=true;wake()});
  tl.addEventListener('pointerdown',e=>e.stopPropagation());cmpCard.addEventListener('pointerdown',e=>e.stopPropagation());
  /* camera state + R9.5 rail */
  let yaw=0,pitch=.2,dist=18.6,distT=18.6,vy=0,drag=null,mouse={x:0,y:0,in:false},visible=true,onscreen=true,raf=0,time0=performance.now();
  const railPts=[];for(let d=Math.ceil(Y0/10)*10;d<=Y1;d+=10){const u=(d-Y0)/Math.max(1,N-1);railPts.push(new THREE.Vector3(X0+(d-Y0)*DX,1.15+Math.sin(u*6.2832)*.16,Math.sin(u*9.4248)*.4))}
  if(railPts.length<2)railPts.push(new THREE.Vector3(X0+(N-1)*DX,1.15,0));
  const rail=new THREE.CatmullRomCurve3(railPts,false,'catmullrom',.5),railT=new THREE.Vector3(),railA=new THREE.Vector3(),lookAt=new THREE.Vector3();
  let railOff=0,railOffT=0;
  const ray=new THREE.Raycaster(),ndc=new THREE.Vector2(),v3=new THREE.Vector3();
  function size(){const w=canvas.clientWidth||800,h=canvas.clientHeight||460,dpr=Math.max(.6,Math.min(devicePixelRatio||1,1.5)*([1,1,.85,.7,.55][lvl()]||1));renderer.setPixelRatio(dpr);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();
   const iw=Math.max(2,Math.ceil(w*dpr/4)),ih=Math.max(2,Math.ceil(h*dpr/4));
   if(idRT&&(idRT.width!==iw||idRT.height!==ih))idRT.setSize(iw,ih);
   if(bloomRT&&(bloomRT.width!==iw||bloomRT.height!==ih))bloomRT.setSize(iw,ih)}
  /* wake() re-derives visibility from the DOM instead of trusting the last IntersectionObserver entry: a view switch, a theme flip or a
     hover can all arrive while the observer's cached state is stale, and a parked loop would then never repaint. It must re-derive on
     every call — not only when no frame is pending — because a pending frame that returns early leaves raf=0 and nothing reschedules it. */
  const wake=()=>{visible=!panel.hidden&&panel.getClientRects().length>0;if(!raf)raf=requestAnimationFrame(frame)};document.addEventListener('bk:quality',()=>{size();syncGlass();syncGlow();wake()});
  /* GPU context loss: the baked studio map is a render target whose pixels are gone; bake it again and repaint. */
  window.BKGL&&BKGL.watch(canvas,{name:'skyline',onRestore(){try{const r=BKMaterials.rebake(renderer,THREE,'city');if(r){env=r.fresh;scene.environment=env}}catch{}size();wake()}});
  function syncSel(){const y=typeof nobelYear!=='undefined'&&nobelYear?Number(nobelYear):-1,i=y>0?y-Y0:-1;
   if(i!==selYear){selYear=i;colorsDirty.v=true;beam.visible=i>=0;updateCompare();
    if(i>=0){slider.value=Y0+i;paintSlider();const e=idx.get(String(Y0+i));if(e)srTab.innerHTML=`<caption>${Y0+i}</caption>`+e.cats.map((n,k)=>n?`<tr><th>${esc(catName(k))}</th><td>${n}</td></tr>`:'').join('');
     if(!reduced.matches&&lvl()<=1){confT=0;confMat.uniforms.uOrigin.value.set(X0+i*DX,yearTop(i,1e3)+.12,0);conf.visible=true}}
    syncGlass();syncGlow()}}
  /* tooltip */
  function showTip(i,c){if(i<0){tip.hidden=true;return}const e=idx.get(String(Y0+i));if(!e){tip.hidden=true;return}
   let ps=0,pn=0;for(let k=1;k<=10;k++){const e2=idx.get(String(Y0+i-k));if(e2){ps+=e2.total;pn++}}const dp=pn?Math.round((e.total-ps/pn)/(ps/pn)*100):null;
   const dl=dp==null?'':`<em class="dlt ${dp>=0?'up':'dn'}">Δ ${dp>=0?'+':''}${dp}% · ${esc(t('nsVsDecade'))}</em>`;
   tip.innerHTML=`<small style="--c:${CATC[c>=0?c:0]}">${Y0+i} · ${e.total} ${esc(t('records'))}</small>`+e.cats.map((n,k)=>n?`<span class="row" style="--c:${CATC[k]}"><i></i>${esc(catName(k))}<b>${n}</b></span>`:'').join('')+dl+`<em>${esc(cmpOn?t('nsCmpPick'):t('nsClick'))}</em>`;tip.hidden=false;placeTip()}
  function placeTip(){const r=panel.getBoundingClientRect();tip.style.transform=`translate(${Math.max(8,Math.min(mouse.x-r.left+16,r.width-230))}px,${Math.max(8,Math.min(mouse.y-r.top+16,r.height-190))}px)`}
  /* R9.3: the identity buffer answers the hover; the analytic raycast is the WebGL1 fallback */
  function pick(){if(!mouse.in||drag){if(hoverYear!==-1){hoverYear=-1;colorsDirty.v=true;showTip(-1)}return}
   if(idRT){idDirty=true;return}
   const r=canvas.getBoundingClientRect();ndc.set(((mouse.x-r.left)/r.width)*2-1,-(((mouse.y-r.top)/r.height)*2-1));ray.setFromCamera(ndc,camera);const hit=ray.intersectObject(towers,false)[0];
   let i=-1,c=-1;if(hit&&hit.instanceId!=null){const k=keys[hit.instanceId];i=k.i;c=k.c}
   if(i!==hoverYear){hoverYear=i;colorsDirty.v=true;showTip(i,c);document.dispatchEvent(new CustomEvent('nobel:hover',{detail:i>=0?Y0+i:0}))}else if(i>=0)placeTip();canvas.style.cursor=i>=0?'pointer':'grab'}
  /* interaction */
  panel.addEventListener('pointermove',e=>{mouse={x:e.clientX,y:e.clientY,in:true};if(drag){const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.abs(dx)+Math.abs(dy)>4)drag.moved=true;yaw=Math.max(-1.15,Math.min(1.15,yaw+dx*.005));pitch=Math.max(.08,Math.min(.95,pitch+dy*.004));vy=dx*.005;railOffT=Math.max(-14,Math.min(14,railOffT-dx*.05));drag.x=e.clientX;drag.y=e.clientY;if(hoverYear!==-1){hoverYear=-1;colorsDirty.v=true;showTip(-1)}}else pick();wake()},{passive:true});
  panel.addEventListener('pointerleave',()=>{mouse.in=false;pick()});
  panel.addEventListener('pointerdown',e=>{if(e.button>0||(e.target.closest&&e.target.closest('.nc-3d-ctl,.nc-sky-legend')))return;drag={x:e.clientX,y:e.clientY,moved:false};try{panel.setPointerCapture(e.pointerId)}catch{}});
  addEventListener('pointerup',()=>{const d=drag;drag=null;railOffT=0;if(d&&!d.moved&&hoverYear>=0&&typeof selectNobelYear==='function'){if(cmpOn&&selYear>=0&&hoverYear!==selYear){cmpYear=hoverYear;updateCompare()}else{selectNobelYear(String(Y0+hoverYear),true);syncSel()}}wake()});
  panel.addEventListener('wheel',e=>{if(!(e.ctrlKey||e.metaKey))return;e.preventDefault();distT=Math.max(10,Math.min(42,distT*Math.exp(e.deltaY*.0016)));wake()},{passive:false});
  ctl.addEventListener('click',e=>{const b=e.target.closest?e.target.closest('[data-z]'):null;if(!b)return;if(b.dataset.z==='in')distT=Math.max(10,distT/1.3);else if(b.dataset.z==='out')distT=Math.min(42,distT*1.3);else{distT=18.6;yaw=0;pitch=.2;railOffT=0}wake()});
  canvas.tabIndex=0;canvas.setAttribute('role','application');canvas.setAttribute('aria-label',t('nsLabel'));
  canvas.addEventListener('keydown',e=>{const y=typeof nobelYear!=='undefined'&&nobelYear?Number(nobelYear):Y1;let ny=y;const step=(e.ctrlKey||e.metaKey)?10:1;
   if(e.key==='Escape'&&cmpOn){e.preventDefault();setCmp(false);return}
   if(e.shiftKey&&cmpOn&&(e.key==='ArrowRight'||e.key==='ArrowLeft')){e.preventDefault();const base0=cmpYear>=0?cmpYear:(selYear>=0?selYear:N-1);cmpYear=Math.max(0,Math.min(N-1,base0+(e.key==='ArrowRight'?1:-1)*step));updateCompare();wake();return}
   if(e.key==='ArrowRight')ny=Math.min(Y1,y+step);else if(e.key==='ArrowLeft')ny=Math.max(Y0,y-step);else if(e.key==='Home')ny=Y0;else if(e.key==='End')ny=Y1;else if(e.key==='PageUp')ny=Math.min(Y1,y+10);else if(e.key==='PageDown')ny=Math.max(Y0,y-10);else if(e.key==='c'||e.key==='C'){e.preventDefault();setCmp(!cmpOn);return}else return;e.preventDefault();if(typeof selectNobelYear==='function'&&idx.has(String(ny)))selectNobelYear(String(ny),true);syncSel();wake()});
  /* frame */
  function layout(){if(texOn)return;   // matrices are static; the vertex shader supplies the height
   const acc=new Float32Array(N);
   for(let k=0;k<K;k++){const {i,c}=keys[k],h=Math.max(heightAt(i,c,time),.0001),x=X0+i*DX,y0=acc[i];acc[i]+=h;
    P.set(x,y0+h/2,0);S.set(BW,h,BD);M.compose(P,Q,S);towers.setMatrixAt(k,M);
    P.set(x,-(y0+h/2)-.004,0);M.compose(P,Q,S);refl.setMatrixAt(k,M)}
   towers.instanceMatrix.needsUpdate=true;refl.instanceMatrix.needsUpdate=true}
  function theme(){const light=root.dataset.theme==='light';floorMat.color.setHex(light?0x2a3a46:0xffe6b0);floorMat.opacity=light?.10:.5;lineMat.color.setHex(light?0x13283a:0x9fb8c8);lineMat.opacity=light?.28:.22;refl.material.opacity=light?.1:.22;mat.envMapIntensity=light?1.0:1.3;mat.metalness=light?.15:.3;mat.roughness=light?.3:.2;key.intensity=light?2.4:2.0;rim.intensity=light?.5:.95;U.win.value=light?.5:1.5;U.rim.value=light?.18:.55;rainMat.blending=dustMat.blending=light?THREE.NormalBlending:THREE.AdditiveBlending;rainMat.color.setHex(light?0x8a5a22:0xffe6b0);dustMat.color.setHex(light?0x2a3a46:0xffe9c0);dustMat.opacity=light?.3:.5;rainMat.needsUpdate=dustMat.needsUpdate=true;beam.material.opacity=light?.55:1;beam2.material.opacity=beam.material.opacity;beam2.material.color.setHex(light?0x3a62a8:0x9ec6ff);bleed.material.blending=light?THREE.NormalBlending:THREE.AdditiveBlending;bleed.material.opacity=light?.22:.55;bleed.material.needsUpdate=true;beam.material.color.setHex(light?0xb07a38:0xffffff);
   hazeMat.color.setHex(light?0x2a3a46:0x9fc4ff);hazeMat.opacity=light?.16:.42;hazeMat.blending=light?THREE.NormalBlending:THREE.AdditiveBlending;hazeMat.needsUpdate=true;
   glowMat.uniforms.uColor.value.setHex(light?0x3a62a8:0xffe6b0);confMat.uniforms.uColor.value.setHex(light?0x3a62a8:0xffe6b0);
   colorsDirty.v=true;theme.l=light}
  function frame(now){raf=0;if(!visible||!onscreen||document.hidden)return;const dt=Math.min(.05,(now-(frame.l||now))/1000||0);frame.l=now;if(!STLM)time+=dt;
   if((root.dataset.theme==='light')!==theme.l)theme();syncSel();
   if(colorsDirty.v)recolor();
   U.time.value=time;
   const calm=reduced.matches||root.classList.contains('effects-paused');
   U.waveOn.value=(!calm&&selYear>=0&&lvl()<=1)?1:0;
   U.yearX.value=selYear>=0?X0+selYear*DX:1e6;
   U.selX.value=selYear>=0?X0+selYear*DX:1e6;
   U.beacon.value=calm?0:1;
   layout();
   const moving=!STLM&&time<settleAt;
   {let selTop=0;if(selYear>=0)selTop=yearTop(selYear,time);
    rain.visible=selYear>=0;if(selYear>=0){const cx=X0+selYear*DX;for(let r=0;r<RN;r++){const sp=.14+rainS[r*3]*.2,u=calm?rainS[r*3+1]:((time*sp+rainS[r*3+1])%1);rainP[r*3]=cx+(rainS[r*3+2]-.5)*BW*1.5;rainP[r*3+1]=selTop+.05+u*2.4;rainP[r*3+2]=(rainS[(r*3+1)%rainS.length]-.5)*BD*.8}rainGeo.attributes.position.needsUpdate=true}
    for(let d=0;d<DN;d++){const a=dustS[d*4],b=dustS[d*4+1],c2=dustS[d*4+2],sp=.05+dustS[d*4+3]*.12,ph=time*(calm?0:sp);dustP[d*3]=X0*1.15+(-X0*2.3)*a+Math.sin(ph+b*20)*.25;dustP[d*3+1]=.15+b*4.3+Math.sin(ph*1.3+a*30)*.12;dustP[d*3+2]=-1.7+c2*3.4+Math.cos(ph+c2*20)*.2}dustGeo.attributes.position.needsUpdate=true}
   if(confT<1.2){confT+=dt;confMat.uniforms.uT.value=confT;conf.visible=true}else conf.visible=false;
   if(!drag){yaw+=vy;vy*=.92}
   const sway=calm?0:Math.sin(time*.35)*.045;
   if(STLM){dist=distT;railOff=railOffT}else{dist+=(distT-dist)*Math.min(1,dt*5);railOff+=(railOffT-railOff)*Math.min(1,dt*4)}
   const ru=Math.max(0,Math.min(1,((selYear>=0?selYear:N-1)+railOff)/Math.max(1,N-1)));
   rail.getPoint(ru,railT);rail.getPoint(Math.min(1,ru+10/Math.max(1,N-1)),railA);
   lookAt.set(railT.x+(railA.x-railT.x)*.3,railT.y+(railA.y-railT.y)*.3,railT.z+(railA.z-railT.z)*.3);
   const ang=yaw+sway,arrK=window.BKMotion?BKMotion.arrival(panel):1,dd=dist*(1+.42*(1-arrK));/* A1: dollies in as the section arrives */
   camera.position.set(railT.x*.34+Math.sin(ang)*dd*Math.cos(pitch),Math.sin(pitch)*dd+1.4,Math.cos(ang)*dd*Math.cos(pitch));camera.lookAt(lookAt);
   if(cmpYear>=0&&beam2.visible){beam2.position.set(X0+cmpYear*DX,3,0);beam2.lookAt(camera.position.x,3,camera.position.z);const e2=idx.get(String(Y0+cmpYear));chip2.textContent=(Y0+cmpYear)+' · '+(e2?e2.total:0);v3.set(X0+cmpYear*DX,yearTop(cmpYear,time)+.5,0);v3.project(camera);const w2=canvas.clientWidth,h2=canvas.clientHeight,cw2=(chip2.offsetWidth||90)/2+8;chip2.style.transform=`translate(${Math.max(cw2,Math.min(w2-cw2,(v3.x*.5+.5)*w2)).toFixed(1)}px,${((-v3.y*.5+.5)*h2).toFixed(1)}px)`}
   if(selYear>=0){const e=idx.get(String(Y0+selYear));beam.position.set(X0+selYear*DX,3,0);beam.lookAt(camera.position.x,3,camera.position.z);if(chip&&e){chip.hidden=false;chip.textContent=(Y0+selYear)+' · '+e.total}}else if(chip)chip.hidden=true;
   const w=canvas.clientWidth,h=canvas.clientHeight;grp.updateMatrixWorld(true);
   lab.forEach(el=>{if(el.dataset.d){v3.set(X0+(Number(el.dataset.d)-Y0)*DX,0,.55)}else{v3.set(X0-.35,Number(el.dataset.r)*HS,-.34)}v3.project(camera);
    const sx=(v3.x*.5+.5)*w,sy=(-v3.y*.5+.5)*h;el.style.transform=`translate(${sx.toFixed(1)}px,${sy.toFixed(1)}px)`;el.style.opacity=v3.z<1?1:0;
    if(el.dataset.d){const i=Number(el.dataset.d)-Y0;v3.set(X0+i*DX,yearTop(i,time),0);v3.project(camera);el.style.setProperty('--h',Math.max(0,Math.min(240,sy-(-v3.y*.5+.5)*h)).toFixed(0)+'px')}});
   if(window.BKText&&++labFrame%6===0){const pr=labels.getBoundingClientRect(),L=lab.filter(el=>el.style.opacity==='1').map(el=>{const b=el.getBoundingClientRect();if(b.left<pr.left+4||b.right>pr.right-4||b.top<pr.top+2||b.bottom>pr.bottom-2)el.dataset.edge='1';else delete el.dataset.edge;return{el,x:b.left+b.width/2,y:b.top,w:b.width,h:b.height,prio:el.dataset.d?2:1}});lab.forEach(el=>{el.style.visibility=''});window.BKText.declutter(L,2);lab.forEach(el=>{if(el.dataset.edge)el.style.visibility='hidden'})}
   if(chip&&selYear>=0){v3.set(X0+selYear*DX,yearTop(selYear,time)+.5,0);v3.project(camera);const cw=(chip.offsetWidth||90)/2+8,cx=Math.max(cw,Math.min(w-cw,(v3.x*.5+.5)*w));chip.style.transform=`translate(${cx.toFixed(1)}px,${((-v3.y*.5+.5)*h).toFixed(1)}px)`;anchorLocal={x:(v3.x*.5+.5)*w,y:(-v3.y*.5+.5)*h}}
   renderer.info.reset();
   if(bloomRT&&glow.count>0){bloomCam.position.copy(camera.position);bloomCam.quaternion.copy(camera.quaternion);bloomCam.projectionMatrix.copy(camera.projectionMatrix);bloomCam.projectionMatrixInverse.copy(camera.projectionMatrixInverse);bloomCam.matrixWorld.copy(camera.matrixWorld);bloomCam.matrixWorldInverse.copy(camera.matrixWorldInverse);
    renderer.setRenderTarget(bloomRT);renderer.render(scene,bloomCam);renderer.setRenderTarget(null)}
   idRender();
   renderer.render(scene,camera);
   if(bloomRT&&glow.count>0){renderer.autoClear=false;quadMat.uniforms.uTex.value=bloomRT.texture;renderer.render(quadScene,quadCam);renderer.autoClear=true}
   idPoll();
   const still=calm;/* the identity readback is one frame late (fenceSync), so a calm scene must keep ticking until the hover resolves */
   if(!still||moving||drag||idDirty||idPending||confT<1.2||Math.abs(vy)>1e-4||Math.abs(distT-dist)>.01||Math.abs(railOffT-railOff)>.01)raf=requestAnimationFrame(frame)}
  size();new ResizeObserver(()=>{size();wake()}).observe(panel);
  if(typeof IntersectionObserver==='function')new IntersectionObserver(es=>{onscreen=es[0].isIntersecting;if(onscreen)wake()}).observe(panel);
  new MutationObserver(()=>{theme();wake()}).observe(root,{attributes:true,attributeFilter:['data-theme','class']});
  document.addEventListener('library:language',()=>{canvas.setAttribute('aria-label',t('nsLabel'))});
  staticMatrices();theme();syncSel();recolor();canvas.classList.add('on');wake();
  /* morph support: where would each record sit in the city? (one block per record, stacked inside its year × category segment) */
  function projectRecords(list,out){const r=canvas.getBoundingClientRect(),acc=new Float32Array(N),baseOf=new Float32Array(N*CAT);
   for(let k=0;k<K;k++){const i=keys[k].i;baseOf[i*CAT+keys[k].c]=acc[i];acc[i]+=heightAt(i,keys[k].c,time)}
   grp.updateMatrixWorld(true);camera.updateMatrixWorld();const alpha=new Float32Array(list.length);
   for(let j=0;j<list.length;j++){const e=list[j],yi=Math.max(0,Math.min(N-1,e.year-Y0)),id=yi*CAT+e.c,k=keyAt[id],h=k>=0?heightAt(yi,e.c,time):0,y=baseOf[id]+(e.n?((e.l+.5)/e.n)*h:0);
    v3.set(X0+yi*DX+(e.jx||0)*BW*.4,y,(e.jz||0)*BD*.35);grp.localToWorld(v3);v3.project(camera);out[j*2]=r.left+(v3.x*.5+.5)*r.width;out[j*2+1]=r.top+(-v3.y*.5+.5)*r.height;alpha[j]=(catOn[e.c]&&h>0)?1:.12}
   return alpha}
  let anchorLocal=null;
  /* R9 test hook: ?diag + tools/feature_audit.py B21 read this */
  const info={built:true,source:texOn?'texture':'uniform',spring:texOn?'gpu':'cpu',K,N,CAT,texels:TEX,picking:idRT?'id':'analytic',idSize:0,idRaw:-1,idPath:'sync',wave:0,confetti:0,bloom:0,rail:1,glass:0,targets:0,draws:0,frames:0,tier:0,vis:1};
  window.BKSkyline={info(){info.idSize=idRT?idRT.width:0;info.idRaw=idRaw;info.idPath=idPath;info.wave=U.waveOn.value?1:0;info.confetti=conf.visible?CN:0;info.bloom=glow.count;info.glass=glassN;info.tier=lvl();info.vis=visible&&onscreen?1:0;
    info.targets=(scene.environment?1:0)+(idRT?1:0)+(bloomRT?1:0);info.draws=renderer.info.render.calls;info.frames=renderer.info.render.frame;return info},
   /* the hero's frame-time governor owns the tier and would immediately undo a bare BKMotion.quality.set on software GL, so pin it */
   tier(n){try{if(window.BKMotion&&BKMotion.quality&&typeof BKMotion.quality.pin==='function')BKMotion.quality.pin(n);else if(window.BKMotion&&BKMotion.quality)BKMotion.quality.set(n)}catch{}size();syncGlass();syncGlow();wake();return lvl()},
   sample(i,c){return heightAt(i,c,time)},rail(){return{u:railOff,sel:selYear}},id(){return hoverYear}};
  inst={wake,projectRecords,get Y0(){return Y0},sync:()=>{syncSel();wake()},enter(){if(reduced.matches)return;dist=distT*1.34;pitch=Math.min(.95,pitch+.18);wake()},anchor(){if(selYear<0||!anchorLocal)return null;const r=canvas.getBoundingClientRect();return{x:r.left+anchorLocal.x,y:r.top+anchorLocal.y}}};return inst}
 return{init,get inst(){return inst}}
})();
