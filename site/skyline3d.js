'use strict';
/* Nobel Skyline — 126 years as a lit 3D city of stacked prize-category towers on a reflective floor.
   Hover a tower → breakdown; click → that year's dossier (same control as the flat chart); legend chips isolate categories and the
   towers re-stack with spring easing; drag to orbit, Ctrl/⌘+wheel or buttons to zoom, ←/→ to walk through the years.
   Dark = glowing glass on deep ground, light = tinted glass on parchment with a soft contact shadow. */
window.NobelSkyline=(()=>{
 const root=document.documentElement,CATC=['#e8c58a','#7fcdb4','#d9909f','#b4a1e2','#8fbaf0','#e59a6e','#8fa3ad'];
 const reduced=typeof matchMedia==='function'?matchMedia('(prefers-reduced-motion: reduce)'):{matches:false};
 let inst=null;
 async function init(panel){
  if(inst)return inst;
  let THREE;try{THREE=await import('./vendor/three.module.min.js')}catch{return null}
  const idx=typeof nobelIndex!=='undefined'&&nobelIndex?nobelIndex:(typeof buildNobelIndex==='function'?buildNobelIndex():null);if(!idx||!idx.size)return null;
  const years=[...idx.keys()].sort(),Y0=Number(years[0]),Y1=Number(years.at(-1)),N=Y1-Y0+1,CAT=7;
  const catName=i=>typeof nobelCatLabel==='function'?nobelCatLabel(i):String(i);
  const canvas=panel.querySelector('canvas'),labels=panel.querySelector('.nc-3d-labels'),tip=panel.querySelector('.nc-3d-tip'),ctl=panel.querySelector('.nc-3d-ctl'),chip=panel.querySelector('.nc-sky-chip');
  const renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'high-performance'});renderer.setClearColor(0,0);
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(30,2,.1,120),grp=new THREE.Group();scene.add(grp);
  /* data */
  const maxTotal=Math.max(...years.map(y=>idx.get(y).total)),HS=4.4/maxTotal,DX=.16,BW=.118,BD=.5,X0=-(N-1)*DX/2;
  const counts=[],catTotal=new Array(CAT).fill(0);
  for(let i=0;i<N;i++){const e=idx.get(String(Y0+i));counts.push(e?e.cats.slice():new Array(CAT).fill(0));if(e)e.cats.forEach((c,k)=>catTotal[k]+=c)}
  const keys=[];for(let i=0;i<N;i++)for(let c=0;c<CAT;c++)if(counts[i][c]>0)keys.push({i,c});
  const K=keys.length,cur=new Float32Array(K),catOn=(window.NobelFilter&&window.NobelFilter.on)||new Array(CAT).fill(true);document.addEventListener('nobel:filter',()=>wake());
  /* studio environment (soft boxes → PMREM) so the glass towers reflect something */
  const bakeEnv=()=>{try{const es=new THREE.Scene();es.background=new THREE.Color(0x06080d);const bx=(w,h,x,y,z,c,k)=>{const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({color:new THREE.Color(c).multiplyScalar(k),side:THREE.DoubleSide}));m.position.set(x,y,z);m.lookAt(0,0,0);es.add(m)};
   bx(10,5,-5,6,6,0xfff0d6,5);bx(4,9,8,1,3,0xd6e4ff,3);bx(14,2,0,-6,2,0xffdca8,1.2);bx(7,4,0,7,-6,0xffffff,2.4);bx(8,5,0,2,9,0xfff4dc,2.4);const pm=new THREE.PMREMGenerator(renderer),t=pm.fromScene(es,.03).texture;pm.dispose();return t}catch{return null}};
  let env=bakeEnv();if(env)scene.environment=env;
  /* towers + mirrored reflections */
  const geo=new THREE.BoxGeometry(1,1,1);
  const mat=new THREE.MeshStandardMaterial({metalness:.28,roughness:.22,envMapIntensity:1.25});
  /* every tower face carries a grid of windows that flicker on and off (hash per window), tinted by the category colour, plus a fresnel edge: the stacked bars read as a lit glass city */
  const winU={uTime:{value:0},uWin:{value:1.5},uRim:{value:.5}};
  const windows=sh=>{sh.uniforms.uTime=winU.uTime;sh.uniforms.uWin=winU.uWin;sh.uniforms.uRim=winU.uRim;
   sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vWP;').replace('#include <project_vertex>','#include <project_vertex>\nvWP=(modelMatrix*instanceMatrix*vec4(transformed,1.0)).xyz;');
   sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vWP;uniform float uTime,uWin,uRim;').replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
    {vec2 g=vec2((vWP.x+vWP.z*1.37)/.045,vWP.y/.105);vec2 c=floor(g),f=fract(g);
     float win=step(.2,f.y)*step(f.y,.8)*step(.18,f.x)*step(f.x,.84);
     float hh=fract(sin(dot(c,vec2(12.9898,78.233)))*43758.5453);
     float on=step(.42,hh)*(.55+.45*sin(uTime*.55+hh*40.));
     totalEmissiveRadiance+=diffuseColor.rgb*win*on*uWin;
     float fr=pow(1.-abs(dot(normalize(vNormal),normalize(vViewPosition))),2.6);
     totalEmissiveRadiance+=diffuseColor.rgb*fr*uRim;}`)};
  mat.onBeforeCompile=windows;
  /* optional glass towers: real transmission + clearcoat (heavier, so it is a toggle) */
  const glassMat=new THREE.MeshPhysicalMaterial({metalness:0,roughness:.12,transmission:.62,thickness:.45,ior:1.45,clearcoat:1,clearcoatRoughness:.08,iridescence:.35,iridescenceIOR:1.3,envMapIntensity:1.5,attenuationDistance:.7});glassMat.onBeforeCompile=windows;
  const towers=new THREE.InstancedMesh(geo,mat,K),reflMat=new THREE.MeshStandardMaterial({metalness:.1,roughness:.35,transparent:true,opacity:.2,depthWrite:false,envMapIntensity:.8}),refl=new THREE.InstancedMesh(geo,reflMat,K);
  /* floor reflection = an exact mirror of the city (same lit windows, fading with depth below the floor) */
  reflMat.onBeforeCompile=sh=>{sh.uniforms.uTime=winU.uTime;sh.uniforms.uWin=winU.uWin;sh.uniforms.uRim=winU.uRim;
   sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vWP;').replace('#include <project_vertex>','#include <project_vertex>\nvWP=(modelMatrix*instanceMatrix*vec4(transformed,1.0)).xyz;');
   sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vWP;uniform float uTime,uWin,uRim;').replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
    {vec2 g=vec2((vWP.x+vWP.z*1.37)/.045,abs(vWP.y)/.105);vec2 c=floor(g),f=fract(g);float win=step(.2,f.y)*step(f.y,.8)*step(.18,f.x)*step(f.x,.84);float hh=fract(sin(dot(c,vec2(12.9898,78.233)))*43758.5453);float on=step(.42,hh)*(.55+.45*sin(uTime*.55+hh*40.));totalEmissiveRadiance+=diffuseColor.rgb*win*on*uWin*.8;}`).replace('#include <dithering_fragment>','#include <dithering_fragment>\ngl_FragColor.a*=exp(vWP.y*.62)*smoothstep(.0,.25,-vWP.y+.02);')};
  towers.frustumCulled=refl.frustumCulled=false;grp.add(towers,refl);
  const col=new THREE.Color(),base=CATC.map(h=>new THREE.Color(h)),M=new THREE.Matrix4(),Q=new THREE.Quaternion(),P=new THREE.Vector3(),S=new THREE.Vector3();
  const colorsDirty={v:true};let hoverYear=-1,selYear=-1,cmpYear=-1,cmpOn=false;
  function recolor(){const light=root.dataset.theme==='light';for(let k=0;k<K;k++){const {i,c}=keys[k];col.copy(base[c]);const hot=i===hoverYear,sel=i===selYear||i===cmpYear;if(light)col.multiplyScalar(hot||sel?1.0:.88);else col.multiplyScalar(hot?1.45:sel?1.3:.82);if(selYear>=0&&!sel&&!hot)col.lerp(new THREE.Color(light?0xdad2c0:0x1b2a36),light?.28:.32);towers.setColorAt(k,col);refl.setColorAt(k,col)}towers.instanceColor.needsUpdate=true;refl.instanceColor.needsUpdate=true;colorsDirty.v=false}
  /* floor, rulers, glow of the selected year */
  const floorMat=new THREE.MeshBasicMaterial({transparent:true,depthWrite:false,opacity:1}),floor=new THREE.Mesh(new THREE.PlaneGeometry(N*DX+6,7),floorMat);floor.rotation.x=-Math.PI/2;floor.position.y=-.004;grp.add(floor);
  const floorTex=(()=>{const c=document.createElement('canvas');c.width=512;c.height=128;const x=c.getContext('2d'),g=x.createRadialGradient(256,64,10,256,64,256);g.addColorStop(0,'rgba(255,255,255,.34)');g.addColorStop(.6,'rgba(255,255,255,.08)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,512,128);x.globalCompositeOperation='destination-in';const vf=x.createLinearGradient(0,0,0,128);vf.addColorStop(0,'rgba(0,0,0,0)');vf.addColorStop(.32,'rgba(0,0,0,1)');vf.addColorStop(.68,'rgba(0,0,0,1)');vf.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=vf;x.fillRect(0,0,512,128);return new THREE.CanvasTexture(c)})();floorMat.map=floorTex;
  const lineMat=new THREE.LineBasicMaterial({transparent:true,opacity:.22,color:0x9fb8c8}),pts=[];
  for(let d=Math.ceil(Y0/10)*10;d<=Y1;d+=10){const x=X0+(d-Y0)*DX;pts.push(new THREE.Vector3(x,0,.3),new THREE.Vector3(x,0,-.3))}
  const rulers=[10,20,30,40].filter(v=>v<=maxTotal+4);rulers.forEach(v=>{const y=v*HS;pts.push(new THREE.Vector3(X0-.2,y,-.34),new THREE.Vector3(-X0+.2,y,-.34))});
  grp.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts),lineMat));
  const beam=new THREE.Mesh(new THREE.PlaneGeometry(DX*2.6,6),new THREE.MeshBasicMaterial({map:(()=>{const c=document.createElement('canvas');c.width=16;c.height=128;const x=c.getContext('2d'),g=x.createLinearGradient(0,128,0,0);g.addColorStop(0,'rgba(255,240,200,.55)');g.addColorStop(1,'rgba(255,240,200,0)');x.fillStyle=g;x.fillRect(0,0,16,128);return new THREE.CanvasTexture(c)})(),transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide}));beam.position.y=3;beam.visible=false;grp.add(beam);
  const beam2=beam.clone();beam2.material=beam.material.clone();beam2.visible=false;grp.add(beam2);
  const chip2=document.createElement('div');chip2.className='nc-sky-chip nc-sky-chip2';chip2.hidden=true;chip2.setAttribute('aria-hidden','true');panel.appendChild(chip2);
  /* coloured light pooling on the floor under the towers: every year bleeds its dominant prize colours into the reflective ground */
  const bleedC=document.createElement('canvas');bleedC.width=N;bleedC.height=32;const bleedX=bleedC.getContext('2d'),bleedTex=new THREE.CanvasTexture(bleedC);bleedTex.minFilter=bleedTex.magFilter=THREE.LinearFilter;
  const bleed=new THREE.Mesh(new THREE.PlaneGeometry(N*DX,BD*2.6),new THREE.MeshBasicMaterial({map:bleedTex,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,opacity:.55}));bleed.rotation.x=-Math.PI/2;bleed.position.set(0,.004,.05);grp.add(bleed);
  function paintBleed(){const im=bleedX.createImageData(N,32),d=im.data;for(let i=0;i<N;i++){let r=0,g=0,b=0,w=0;for(let c=0;c<CAT;c++){const n=catOn[c]?counts[i][c]:0;if(!n)continue;r+=base[c].r*n;g+=base[c].g*n;b+=base[c].b*n;w+=n}const tot=w?Math.min(1,w/(maxTotal*.55)):0;
    for(let y=0;y<32;y++){const a=Math.exp(-Math.pow((y-16)/7.5,2))*(.2+.8*tot),k=(y*N+i)*4;d[k]=w?r/w*255:0;d[k+1]=w?g/w*255:0;d[k+2]=w?b/w*255:0;d[k+3]=a*255}}bleedX.putImageData(im,0,0);bleedTex.needsUpdate=true}
  paintBleed();document.addEventListener('nobel:filter',paintBleed);
  /* sparks rising out of the selected year's tower + slow ambient motes in the volume */
  const dotTex=(()=>{const c=document.createElement('canvas');c.width=c.height=32;const g=c.getContext('2d'),r=g.createRadialGradient(16,16,0,16,16,16);r.addColorStop(0,'rgba(255,255,255,1)');r.addColorStop(.35,'rgba(255,255,255,.7)');r.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=r;g.fillRect(0,0,32,32);return new THREE.CanvasTexture(c)})();
  const RN=110,rainP=new Float32Array(RN*3),rainS=Float32Array.from({length:RN*3},()=>Math.random());
  const rainGeo=new THREE.BufferGeometry();rainGeo.setAttribute('position',new THREE.BufferAttribute(rainP,3));
  const rainMat=new THREE.PointsMaterial({size:.06,map:dotTex,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,opacity:.9,color:0xffe6b0}),rain=new THREE.Points(rainGeo,rainMat);rain.frustumCulled=false;rain.visible=false;grp.add(rain);
  const DN=150,dustP=new Float32Array(DN*3),dustS=Float32Array.from({length:DN*4},()=>Math.random());
  const dustGeo=new THREE.BufferGeometry();dustGeo.setAttribute('position',new THREE.BufferAttribute(dustP,3));
  const dustMat=new THREE.PointsMaterial({size:.045,map:dotTex,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,opacity:.5,color:0xffe9c0}),dust=new THREE.Points(dustGeo,dustMat);dust.frustumCulled=false;grp.add(dust);
  const key=new THREE.DirectionalLight(0xfff0d6,2.0);key.position.set(-4,8,7);scene.add(key);const rim=new THREE.DirectionalLight(0x9fc4ff,.9);rim.position.set(6,3,-5);scene.add(rim);scene.add(new THREE.AmbientLight(0xffffff,.35));
  /* labels (decades + rulers) */
  const decs=[];for(let d=Math.ceil(Y0/10)*10;d<=Y1;d+=10)decs.push(d);
  labels.innerHTML=decs.map(d=>`<span data-d="${d}">${d}</span>`).join('')+rulers.map(v=>`<span class="r" data-r="${v}">${v}</span>`).join('');const lab=[...labels.children];let labFrame=0;
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
  glassBtn.addEventListener('click',()=>{const on=glassBtn.getAttribute('aria-pressed')!=='true';glassBtn.setAttribute('aria-pressed',String(on));towers.material=on?glassMat:mat;towers.material.needsUpdate=true;colorsDirty.v=true;wake()});
  tl.addEventListener('pointerdown',e=>e.stopPropagation());cmpCard.addEventListener('pointerdown',e=>e.stopPropagation());
  /* camera state */
  let yaw=0,pitch=.2,dist=18.6,distT=18.6,tx=0,txT=0,vy=0,drag=null,mouse={x:0,y:0,in:false},visible=true,raf=0,t0=performance.now(),time=0;
  const ray=new THREE.Raycaster(),ndc=new THREE.Vector2(),v3=new THREE.Vector3();
  function size(){const w=canvas.clientWidth||800,h=canvas.clientHeight||460,dpr=Math.max(.6,Math.min(devicePixelRatio||1,1.5)*([1,1,.85,.7,.55][window.BKMotion?BKMotion.quality.level:0]||1));renderer.setPixelRatio(dpr);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix()}
  const wake=()=>{if(!raf&&visible)raf=requestAnimationFrame(frame)};document.addEventListener('bk:quality',()=>{size();wake()});
  /* GPU context loss: the baked studio map is a render target whose pixels are gone; bake it again and repaint. */
  window.BKGL&&BKGL.watch(canvas,{name:'skyline',onRestore(){try{env=bakeEnv();if(env)scene.environment=env}catch{}size();wake()}});
  function syncSel(){const y=typeof nobelYear!=='undefined'&&nobelYear?Number(nobelYear):-1,i=y>0?y-Y0:-1;if(i!==selYear){selYear=i;colorsDirty.v=true;if(i>=0){txT=X0+i*DX}beam.visible=i>=0;updateCompare();if(i>=0){slider.value=Y0+i;paintSlider();const e=idx.get(String(Y0+i));if(e)srTab.innerHTML=`<caption>${Y0+i}</caption>`+e.cats.map((n,k)=>n?`<tr><th>${esc(catName(k))}</th><td>${n}</td></tr>`:'').join('')}}}
  /* tooltip */
  function showTip(i,c){if(i<0){tip.hidden=true;return}const e=idx.get(String(Y0+i));if(!e){tip.hidden=true;return}
   let ps=0,pn=0;for(let k=1;k<=10;k++){const e2=idx.get(String(Y0+i-k));if(e2){ps+=e2.total;pn++}}const dp=pn?Math.round((e.total-ps/pn)/(ps/pn)*100):null;
   const dl=dp==null?'':`<em class="dlt ${dp>=0?'up':'dn'}">Δ ${dp>=0?'+':''}${dp}% · ${esc(t('nsVsDecade'))}</em>`;
   tip.innerHTML=`<small style="--c:${CATC[c>=0?c:0]}">${Y0+i} · ${e.total} ${esc(t('records'))}</small>`+e.cats.map((n,k)=>n?`<span class="row" style="--c:${CATC[k]}"><i></i>${esc(catName(k))}<b>${n}</b></span>`:'').join('')+dl+`<em>${esc(cmpOn?t('nsCmpPick'):t('nsClick'))}</em>`;tip.hidden=false;placeTip()}
  function placeTip(){const r=panel.getBoundingClientRect();tip.style.transform=`translate(${Math.max(8,Math.min(mouse.x-r.left+16,r.width-230))}px,${Math.max(8,Math.min(mouse.y-r.top+16,r.height-190))}px)`}
  function pick(){if(!mouse.in||drag){if(hoverYear!==-1){hoverYear=-1;colorsDirty.v=true;showTip(-1)}return}
   const r=canvas.getBoundingClientRect();ndc.set(((mouse.x-r.left)/r.width)*2-1,-(((mouse.y-r.top)/r.height)*2-1));ray.setFromCamera(ndc,camera);const hit=ray.intersectObject(towers,false)[0];
   let i=-1,c=-1;if(hit&&hit.instanceId!=null){const k=keys[hit.instanceId];i=k.i;c=k.c}
   if(i!==hoverYear){hoverYear=i;colorsDirty.v=true;showTip(i,c);document.dispatchEvent(new CustomEvent('nobel:hover',{detail:i>=0?Y0+i:0}))}else if(i>=0)placeTip();canvas.style.cursor=i>=0?'pointer':'grab'}
  /* interaction */
  panel.addEventListener('pointermove',e=>{mouse={x:e.clientX,y:e.clientY,in:true};if(drag){const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.abs(dx)+Math.abs(dy)>4)drag.moved=true;yaw=Math.max(-1.15,Math.min(1.15,yaw+dx*.005));pitch=Math.max(.08,Math.min(.95,pitch+dy*.004));vy=dx*.005;drag.x=e.clientX;drag.y=e.clientY;if(hoverYear!==-1){hoverYear=-1;colorsDirty.v=true;showTip(-1)}}else pick();wake()},{passive:true});
  panel.addEventListener('pointerleave',()=>{mouse.in=false;pick()});
  panel.addEventListener('pointerdown',e=>{if(e.button>0||(e.target.closest&&e.target.closest('.nc-3d-ctl,.nc-sky-legend')))return;drag={x:e.clientX,y:e.clientY,moved:false};try{panel.setPointerCapture(e.pointerId)}catch{}});
  addEventListener('pointerup',()=>{const d=drag;drag=null;if(d&&!d.moved&&hoverYear>=0&&typeof selectNobelYear==='function'){if(cmpOn&&selYear>=0&&hoverYear!==selYear){cmpYear=hoverYear;updateCompare()}else{selectNobelYear(String(Y0+hoverYear),true);syncSel()}}wake()});
  panel.addEventListener('wheel',e=>{if(!(e.ctrlKey||e.metaKey))return;e.preventDefault();distT=Math.max(10,Math.min(42,distT*Math.exp(e.deltaY*.0016)));wake()},{passive:false});
  ctl.addEventListener('click',e=>{const b=e.target.closest?e.target.closest('[data-z]'):null;if(!b)return;if(b.dataset.z==='in')distT=Math.max(10,distT/1.3);else if(b.dataset.z==='out')distT=Math.min(42,distT*1.3);else{distT=18.6;yaw=0;pitch=.2}wake()});
  canvas.tabIndex=0;canvas.setAttribute('role','application');canvas.setAttribute('aria-label',t('nsLabel'));
  canvas.addEventListener('keydown',e=>{const y=typeof nobelYear!=='undefined'&&nobelYear?Number(nobelYear):Y1;let ny=y;const step=(e.ctrlKey||e.metaKey)?10:1;
   if(e.key==='Escape'&&cmpOn){e.preventDefault();setCmp(false);return}
   if(e.shiftKey&&cmpOn&&(e.key==='ArrowRight'||e.key==='ArrowLeft')){e.preventDefault();const base0=cmpYear>=0?cmpYear:(selYear>=0?selYear:N-1);cmpYear=Math.max(0,Math.min(N-1,base0+(e.key==='ArrowRight'?1:-1)*step));updateCompare();wake();return}
   if(e.key==='ArrowRight')ny=Math.min(Y1,y+step);else if(e.key==='ArrowLeft')ny=Math.max(Y0,y-step);else if(e.key==='Home')ny=Y0;else if(e.key==='End')ny=Y1;else if(e.key==='PageUp')ny=Math.min(Y1,y+10);else if(e.key==='PageDown')ny=Math.max(Y0,y-10);else if(e.key==='c'||e.key==='C'){e.preventDefault();setCmp(!cmpOn);return}else return;e.preventDefault();if(typeof selectNobelYear==='function'&&idx.has(String(ny)))selectNobelYear(String(ny),true);syncSel();wake()});
  /* frame */
  function layout(dt){const light=root.dataset.theme==='light',since=(performance.now()-t0)/1000;let moving=false;
   const per=new Array(N).fill(0);
   for(let k=0;k<K;k++){const {i,c}=keys[k],tgt=catOn[c]?counts[i][c]*HS:0,delay=reduced.matches?0:i*.007,g=since>delay?1:0,goal=g?tgt:0;const d=goal-cur[k];if(Math.abs(d)>.0008){cur[k]+=d*Math.min(1,dt*7.5);moving=true}else cur[k]=goal}
   /* stacking order: bottom → top = category order */
   const acc=new Float32Array(N);
   for(let k=0;k<K;k++){const {i}=keys[k],h=Math.max(cur[k],.0001),x=X0+i*DX,y0=acc[i];acc[i]+=cur[k];
    P.set(x,y0+h/2,0);S.set(BW,h,BD);M.compose(P,Q,S);towers.setMatrixAt(k,M);P.set(x,-(y0+h/2)-.004,0);S.set(BW,h,BD);M.compose(P,Q,S);refl.setMatrixAt(k,M)}
   towers.instanceMatrix.needsUpdate=true;refl.instanceMatrix.needsUpdate=true;return moving}
  function theme(){const light=root.dataset.theme==='light';floorMat.color.setHex(light?0x2a3a46:0xffe6b0);floorMat.opacity=light?.10:.5;lineMat.color.setHex(light?0x13283a:0x9fb8c8);lineMat.opacity=light?.28:.22;refl.material.opacity=light?.1:.22;mat.envMapIntensity=light?1.0:1.3;mat.metalness=light?.15:.3;mat.roughness=light?.3:.2;key.intensity=light?2.4:2.0;rim.intensity=light?.5:.95;winU.uWin.value=light?.5:1.5;winU.uRim.value=light?.18:.55;rainMat.blending=dustMat.blending=light?THREE.NormalBlending:THREE.AdditiveBlending;rainMat.color.setHex(light?0x8a5a22:0xffe6b0);dustMat.color.setHex(light?0x2a3a46:0xffe9c0);dustMat.opacity=light?.3:.5;rainMat.needsUpdate=dustMat.needsUpdate=true;beam.material.opacity=light?.55:1;beam2.material.opacity=beam.material.opacity;beam2.material.color.setHex(light?0x3a62a8:0x9ec6ff);bleed.material.blending=light?THREE.NormalBlending:THREE.AdditiveBlending;bleed.material.opacity=light?.22:.55;bleed.material.needsUpdate=true;beam.material.color.setHex(light?0xb07a38:0xffffff);colorsDirty.v=true;theme.l=light}
  function frame(now){raf=0;if(!visible||document.hidden)return;const dt=Math.min(.05,(now-(frame.l||now))/1000||0);frame.l=now;time+=dt;
   if((root.dataset.theme==='light')!==theme.l)theme();syncSel();
   const moving=layout(dt);if(colorsDirty.v)recolor();
   winU.uTime.value=time;
   {const calm=reduced.matches||root.classList.contains('effects-paused');let selTop=0;if(selYear>=0)for(let k=0;k<K;k++)if(keys[k].i===selYear)selTop+=cur[k];
    rain.visible=selYear>=0;if(selYear>=0){const cx=X0+selYear*DX;for(let r=0;r<RN;r++){const sp=.14+rainS[r*3]*.2,u=calm?rainS[r*3+1]:((time*sp+rainS[r*3+1])%1);rainP[r*3]=cx+(rainS[r*3+2]-.5)*BW*1.5;rainP[r*3+1]=selTop+.05+u*2.4;rainP[r*3+2]=(rainS[(r*3+1)%rainS.length]-.5)*BD*.8}rainGeo.attributes.position.needsUpdate=true}
    for(let d=0;d<DN;d++){const a=dustS[d*4],b=dustS[d*4+1],c2=dustS[d*4+2],sp=.05+dustS[d*4+3]*.12,ph=time*(calm?0:sp);dustP[d*3]=X0*1.15+(-X0*2.3)*a+Math.sin(ph+b*20)*.25;dustP[d*3+1]=.15+b*4.3+Math.sin(ph*1.3+a*30)*.12;dustP[d*3+2]=-1.7+c2*3.4+Math.cos(ph+c2*20)*.2}dustGeo.attributes.position.needsUpdate=true}
   if(!drag){yaw+=vy;vy*=.92}
   const sway=(reduced.matches||root.classList.contains('effects-paused'))?0:Math.sin(time*.35)*.045;
   tx+=(txT-tx)*Math.min(1,dt*3.2);dist+=(distT-dist)*Math.min(1,dt*5);
   const tgtX=0,ang=yaw+sway,arrK=window.BKMotion?BKMotion.arrival(panel):1,dd=dist*(1+.42*(1-arrK));/* A1: dollies in as the section arrives */camera.position.set(tgtX+Math.sin(ang)*dd*Math.cos(pitch),Math.sin(pitch)*dd+1.4,Math.cos(ang)*dd*Math.cos(pitch));camera.lookAt(tgtX,1.15,0);
   if(cmpYear>=0&&beam2.visible){beam2.position.set(X0+cmpYear*DX,3,0);beam2.lookAt(camera.position.x,3,camera.position.z);let st=0;for(let k=0;k<K;k++)if(keys[k].i===cmpYear)st+=cur[k];const e2=idx.get(String(Y0+cmpYear));chip2.textContent=(Y0+cmpYear)+' · '+(e2?e2.total:0);v3.set(X0+cmpYear*DX,st+.5,0);v3.project(camera);const w2=canvas.clientWidth,h2=canvas.clientHeight,cw2=(chip2.offsetWidth||90)/2+8;chip2.style.transform=`translate(${Math.max(cw2,Math.min(w2-cw2,(v3.x*.5+.5)*w2)).toFixed(1)}px,${((-v3.y*.5+.5)*h2).toFixed(1)}px)`}
   if(selYear>=0){const e=idx.get(String(Y0+selYear));beam.position.set(X0+selYear*DX,3,0);beam.lookAt(camera.position.x,3,camera.position.z);if(chip&&e){chip.hidden=false;chip.textContent=(Y0+selYear)+' · '+e.total}}else if(chip)chip.hidden=true;
   const w=canvas.clientWidth,h=canvas.clientHeight;grp.updateMatrixWorld(true);
   lab.forEach(el=>{if(el.dataset.d){v3.set(X0+(Number(el.dataset.d)-Y0)*DX,0,.55)}else{v3.set(X0-.35,Number(el.dataset.r)*HS,-.34)}v3.project(camera);el.style.transform=`translate(${((v3.x*.5+.5)*w).toFixed(1)}px,${((-v3.y*.5+.5)*h).toFixed(1)}px)`;el.style.opacity=v3.z<1?1:0});
   if(window.BKText&&++labFrame%6===0){const pr=labels.getBoundingClientRect(),L=lab.filter(el=>el.style.opacity==='1').map(el=>{const b=el.getBoundingClientRect();if(b.left<pr.left+4||b.right>pr.right-4||b.top<pr.top+2||b.bottom>pr.bottom-2)el.dataset.edge='1';else delete el.dataset.edge;return{el,x:b.left+b.width/2,y:b.top,w:b.width,h:b.height,prio:el.dataset.d?2:1}});lab.forEach(el=>{el.style.visibility=''});window.BKText.declutter(L,2);lab.forEach(el=>{if(el.dataset.edge)el.style.visibility='hidden'})}
   if(chip&&selYear>=0){const e=idx.get(String(Y0+selYear));v3.set(X0+selYear*DX,(e?e.total:0)*HS*0+Math.min(1,cur.length?1:0)*0+(()=>{let s=0;for(let k=0;k<K;k++)if(keys[k].i===selYear)s+=cur[k];return s})()+.5,0);v3.project(camera);const cw=(chip.offsetWidth||90)/2+8,cx=Math.max(cw,Math.min(w-cw,(v3.x*.5+.5)*w));chip.style.transform=`translate(${cx.toFixed(1)}px,${((-v3.y*.5+.5)*h).toFixed(1)}px)`;anchorLocal={x:(v3.x*.5+.5)*w,y:(-v3.y*.5+.5)*h}}
   renderer.render(scene,camera);
   const still=reduced.matches||root.classList.contains('effects-paused');if(!still||moving||drag||Math.abs(vy)>1e-4||Math.abs(distT-dist)>.01||Math.abs(txT-tx)>.002)raf=requestAnimationFrame(frame)}
  size();new ResizeObserver(()=>{size();wake()}).observe(panel);
  if(typeof IntersectionObserver==='function')new IntersectionObserver(es=>{visible=es[0].isIntersecting;if(visible)wake()}).observe(panel);
  new MutationObserver(()=>{theme();wake()}).observe(root,{attributes:true,attributeFilter:['data-theme','class']});
  document.addEventListener('library:language',()=>{canvas.setAttribute('aria-label',t('nsLabel'))});
  theme();syncSel();recolor();canvas.classList.add('on');wake();
  /* morph support: where would each record sit in the city? (one block per record, stacked inside its year × category segment) */
  const keyAt=new Int32Array(N*CAT).fill(-1);for(let k=0;k<K;k++)keyAt[keys[k].i*CAT+keys[k].c]=k;
  function projectRecords(list,out){const r=canvas.getBoundingClientRect(),acc=new Float32Array(N),baseOf=new Float32Array(N*CAT);
   for(let k=0;k<K;k++){const i=keys[k].i;baseOf[i*CAT+keys[k].c]=acc[i];acc[i]+=cur[k]}
   grp.updateMatrixWorld(true);camera.updateMatrixWorld();const alpha=new Float32Array(list.length);
   for(let j=0;j<list.length;j++){const e=list[j],yi=Math.max(0,Math.min(N-1,e.year-Y0)),id=yi*CAT+e.c,k=keyAt[id],h=k>=0?cur[k]:0,y=baseOf[id]+(e.n?((e.l+.5)/e.n)*h:0);
    v3.set(X0+yi*DX+(e.jx||0)*BW*.4,y,(e.jz||0)*BD*.35);grp.localToWorld(v3);v3.project(camera);out[j*2]=r.left+(v3.x*.5+.5)*r.width;out[j*2+1]=r.top+(-v3.y*.5+.5)*r.height;alpha[j]=(catOn[e.c]&&h>0)?1:.12}
   return alpha}
  let anchorLocal=null;
  inst={wake,projectRecords,get Y0(){return Y0},sync:()=>{syncSel();wake()},enter(){if(reduced.matches)return;dist=distT*1.34;pitch=Math.min(.95,pitch+.18);wake()},anchor(){if(selYear<0||!anchorLocal)return null;const r=canvas.getBoundingClientRect();return{x:r.left+anchorLocal.x,y:r.top+anchorLocal.y}}};return inst}
 return{init,get inst(){return inst}}
})();
