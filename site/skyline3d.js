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
  const env=(()=>{try{const es=new THREE.Scene();es.background=new THREE.Color(0x06080d);const bx=(w,h,x,y,z,c,k)=>{const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({color:new THREE.Color(c).multiplyScalar(k),side:THREE.DoubleSide}));m.position.set(x,y,z);m.lookAt(0,0,0);es.add(m)};
   bx(10,5,-5,6,6,0xfff0d6,5);bx(4,9,8,1,3,0xd6e4ff,3);bx(14,2,0,-6,2,0xffdca8,1.2);bx(7,4,0,7,-6,0xffffff,2.4);bx(8,5,0,2,9,0xfff4dc,2.4);const pm=new THREE.PMREMGenerator(renderer),t=pm.fromScene(es,.03).texture;pm.dispose();return t}catch{return null}})();
  if(env)scene.environment=env;
  /* towers + mirrored reflections */
  const geo=new THREE.BoxGeometry(1,1,1);
  const mat=new THREE.MeshStandardMaterial({metalness:.28,roughness:.22,envMapIntensity:1.25});
  const towers=new THREE.InstancedMesh(geo,mat,K),refl=new THREE.InstancedMesh(geo,new THREE.MeshBasicMaterial({transparent:true,opacity:.16,depthWrite:false,side:THREE.DoubleSide}),K);
  towers.frustumCulled=refl.frustumCulled=false;grp.add(towers,refl);
  const col=new THREE.Color(),base=CATC.map(h=>new THREE.Color(h)),M=new THREE.Matrix4(),Q=new THREE.Quaternion(),P=new THREE.Vector3(),S=new THREE.Vector3();
  const colorsDirty={v:true};let hoverYear=-1,selYear=-1;
  function recolor(){const light=root.dataset.theme==='light';for(let k=0;k<K;k++){const {i,c}=keys[k];col.copy(base[c]);const hot=i===hoverYear,sel=i===selYear;if(light)col.multiplyScalar(hot||sel?1.0:.88);else col.multiplyScalar(hot?1.45:sel?1.3:.82);if(selYear>=0&&!sel&&!hot)col.lerp(new THREE.Color(light?0xdad2c0:0x1b2a36),light?.28:.32);towers.setColorAt(k,col);refl.setColorAt(k,col)}towers.instanceColor.needsUpdate=true;refl.instanceColor.needsUpdate=true;colorsDirty.v=false}
  /* floor, rulers, glow of the selected year */
  const floorMat=new THREE.MeshBasicMaterial({transparent:true,depthWrite:false,opacity:1}),floor=new THREE.Mesh(new THREE.PlaneGeometry(N*DX+6,7),floorMat);floor.rotation.x=-Math.PI/2;floor.position.y=-.004;grp.add(floor);
  const floorTex=(()=>{const c=document.createElement('canvas');c.width=512;c.height=128;const x=c.getContext('2d'),g=x.createRadialGradient(256,64,10,256,64,256);g.addColorStop(0,'rgba(255,255,255,.34)');g.addColorStop(.6,'rgba(255,255,255,.08)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,512,128);return new THREE.CanvasTexture(c)})();floorMat.map=floorTex;
  const lineMat=new THREE.LineBasicMaterial({transparent:true,opacity:.22,color:0x9fb8c8}),pts=[];
  for(let d=Math.ceil(Y0/10)*10;d<=Y1;d+=10){const x=X0+(d-Y0)*DX;pts.push(new THREE.Vector3(x,0,.3),new THREE.Vector3(x,0,-.3))}
  const rulers=[10,20,30,40].filter(v=>v<=maxTotal+4);rulers.forEach(v=>{const y=v*HS;pts.push(new THREE.Vector3(X0-.2,y,-.34),new THREE.Vector3(-X0+.2,y,-.34))});
  grp.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts),lineMat));
  const beam=new THREE.Mesh(new THREE.PlaneGeometry(DX*2.6,6),new THREE.MeshBasicMaterial({map:(()=>{const c=document.createElement('canvas');c.width=16;c.height=128;const x=c.getContext('2d'),g=x.createLinearGradient(0,128,0,0);g.addColorStop(0,'rgba(255,240,200,.55)');g.addColorStop(1,'rgba(255,240,200,0)');x.fillStyle=g;x.fillRect(0,0,16,128);return new THREE.CanvasTexture(c)})(),transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide}));beam.position.y=3;beam.visible=false;grp.add(beam);
  const key=new THREE.DirectionalLight(0xfff0d6,2.0);key.position.set(-4,8,7);scene.add(key);const rim=new THREE.DirectionalLight(0x9fc4ff,.9);rim.position.set(6,3,-5);scene.add(rim);scene.add(new THREE.AmbientLight(0xffffff,.35));
  /* labels (decades + rulers) */
  const decs=[];for(let d=Math.ceil(Y0/10)*10;d<=Y1;d+=10)decs.push(d);
  labels.innerHTML=decs.map(d=>`<span data-d="${d}">${d}</span>`).join('')+rulers.map(v=>`<span class="r" data-r="${v}">${v}</span>`).join('');const lab=[...labels.children];let labFrame=0;
  /* camera state */
  let yaw=0,pitch=.2,dist=18.6,distT=18.6,tx=0,txT=0,vy=0,drag=null,mouse={x:0,y:0,in:false},visible=true,raf=0,t0=performance.now(),time=0;
  const ray=new THREE.Raycaster(),ndc=new THREE.Vector2(),v3=new THREE.Vector3();
  function size(){const w=canvas.clientWidth||800,h=canvas.clientHeight||460,dpr=Math.min(devicePixelRatio||1,1.5);renderer.setPixelRatio(dpr);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix()}
  const wake=()=>{if(!raf&&visible)raf=requestAnimationFrame(frame)};
  function syncSel(){const y=typeof nobelYear!=='undefined'&&nobelYear?Number(nobelYear):-1,i=y>0?y-Y0:-1;if(i!==selYear){selYear=i;colorsDirty.v=true;if(i>=0){txT=X0+i*DX}beam.visible=i>=0}}
  /* tooltip */
  function showTip(i,c){if(i<0){tip.hidden=true;return}const e=idx.get(String(Y0+i));if(!e){tip.hidden=true;return}
   tip.innerHTML=`<small style="--c:${CATC[c>=0?c:0]}">${Y0+i} · ${e.total} ${esc(t('records'))}</small>`+e.cats.map((n,k)=>n?`<span class="row" style="--c:${CATC[k]}"><i></i>${esc(catName(k))}<b>${n}</b></span>`:'').join('')+`<em>${esc(t('nsClick'))}</em>`;tip.hidden=false;placeTip()}
  function placeTip(){const r=panel.getBoundingClientRect();tip.style.transform=`translate(${Math.max(8,Math.min(mouse.x-r.left+16,r.width-230))}px,${Math.max(8,Math.min(mouse.y-r.top+16,r.height-190))}px)`}
  function pick(){if(!mouse.in||drag){if(hoverYear!==-1){hoverYear=-1;colorsDirty.v=true;showTip(-1)}return}
   const r=canvas.getBoundingClientRect();ndc.set(((mouse.x-r.left)/r.width)*2-1,-(((mouse.y-r.top)/r.height)*2-1));ray.setFromCamera(ndc,camera);const hit=ray.intersectObject(towers,false)[0];
   let i=-1,c=-1;if(hit&&hit.instanceId!=null){const k=keys[hit.instanceId];i=k.i;c=k.c}
   if(i!==hoverYear){hoverYear=i;colorsDirty.v=true;showTip(i,c);document.dispatchEvent(new CustomEvent('nobel:hover',{detail:i>=0?Y0+i:0}))}else if(i>=0)placeTip();canvas.style.cursor=i>=0?'pointer':'grab'}
  /* interaction */
  panel.addEventListener('pointermove',e=>{mouse={x:e.clientX,y:e.clientY,in:true};if(drag){const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.abs(dx)+Math.abs(dy)>4)drag.moved=true;yaw=Math.max(-1.15,Math.min(1.15,yaw+dx*.005));pitch=Math.max(.08,Math.min(.95,pitch+dy*.004));vy=dx*.005;drag.x=e.clientX;drag.y=e.clientY;if(hoverYear!==-1){hoverYear=-1;colorsDirty.v=true;showTip(-1)}}else pick();wake()},{passive:true});
  panel.addEventListener('pointerleave',()=>{mouse.in=false;pick()});
  panel.addEventListener('pointerdown',e=>{if(e.button>0||(e.target.closest&&e.target.closest('.nc-3d-ctl,.nc-sky-legend')))return;drag={x:e.clientX,y:e.clientY,moved:false};try{panel.setPointerCapture(e.pointerId)}catch{}});
  addEventListener('pointerup',()=>{const d=drag;drag=null;if(d&&!d.moved&&hoverYear>=0&&typeof selectNobelYear==='function'){selectNobelYear(String(Y0+hoverYear),true);syncSel()}wake()});
  panel.addEventListener('wheel',e=>{if(!(e.ctrlKey||e.metaKey))return;e.preventDefault();distT=Math.max(10,Math.min(42,distT*Math.exp(e.deltaY*.0016)));wake()},{passive:false});
  ctl.addEventListener('click',e=>{const b=e.target.closest?e.target.closest('[data-z]'):null;if(!b)return;if(b.dataset.z==='in')distT=Math.max(10,distT/1.3);else if(b.dataset.z==='out')distT=Math.min(42,distT*1.3);else{distT=18.6;yaw=0;pitch=.2}wake()});
  canvas.tabIndex=0;canvas.setAttribute('role','application');canvas.setAttribute('aria-label',t('nsLabel'));
  canvas.addEventListener('keydown',e=>{const y=typeof nobelYear!=='undefined'&&nobelYear?Number(nobelYear):Y1;let ny=y;if(e.key==='ArrowRight')ny=Math.min(Y1,y+1);else if(e.key==='ArrowLeft')ny=Math.max(Y0,y-1);else if(e.key==='Home')ny=Y0;else if(e.key==='End')ny=Y1;else if(e.key==='PageUp')ny=Math.min(Y1,y+10);else if(e.key==='PageDown')ny=Math.max(Y0,y-10);else return;e.preventDefault();if(typeof selectNobelYear==='function'&&idx.has(String(ny)))selectNobelYear(String(ny),true);syncSel();wake()});
  /* frame */
  function layout(dt){const light=root.dataset.theme==='light',since=(performance.now()-t0)/1000;let moving=false;
   const per=new Array(N).fill(0);
   for(let k=0;k<K;k++){const {i,c}=keys[k],tgt=catOn[c]?counts[i][c]*HS:0,delay=reduced.matches?0:i*.007,g=since>delay?1:0,goal=g?tgt:0;const d=goal-cur[k];if(Math.abs(d)>.0008){cur[k]+=d*Math.min(1,dt*7.5);moving=true}else cur[k]=goal}
   /* stacking order: bottom → top = category order */
   const acc=new Float32Array(N);
   for(let k=0;k<K;k++){const {i}=keys[k],h=Math.max(cur[k],.0001),x=X0+i*DX,y0=acc[i];acc[i]+=cur[k];
    P.set(x,y0+h/2,0);S.set(BW,h,BD);M.compose(P,Q,S);towers.setMatrixAt(k,M);P.set(x,-(y0+h/2)*.5-.01,0);S.set(BW,h*.5,BD);M.compose(P,Q,S);refl.setMatrixAt(k,M)}
   towers.instanceMatrix.needsUpdate=true;refl.instanceMatrix.needsUpdate=true;return moving}
  function theme(){const light=root.dataset.theme==='light';floorMat.color.setHex(light?0x2a3a46:0xffe6b0);floorMat.opacity=light?.10:.5;lineMat.color.setHex(light?0x13283a:0x9fb8c8);lineMat.opacity=light?.28:.22;refl.material.opacity=light?.05:.11;mat.envMapIntensity=light?1.0:1.3;mat.metalness=light?.15:.3;mat.roughness=light?.3:.2;key.intensity=light?2.4:2.0;rim.intensity=light?.5:.95;beam.material.opacity=light?.55:1;beam.material.color.setHex(light?0xb07a38:0xffffff);colorsDirty.v=true;theme.l=light}
  function frame(now){raf=0;if(!visible||document.hidden)return;const dt=Math.min(.05,(now-(frame.l||now))/1000||0);frame.l=now;time+=dt;
   if((root.dataset.theme==='light')!==theme.l)theme();syncSel();
   const moving=layout(dt);if(colorsDirty.v)recolor();
   if(!drag){yaw+=vy;vy*=.92}
   const sway=(reduced.matches||root.classList.contains('effects-paused'))?0:Math.sin(time*.35)*.045;
   tx+=(txT-tx)*Math.min(1,dt*3.2);dist+=(distT-dist)*Math.min(1,dt*5);
   const tgtX=0,ang=yaw+sway;camera.position.set(tgtX+Math.sin(ang)*dist*Math.cos(pitch),Math.sin(pitch)*dist+1.4,Math.cos(ang)*dist*Math.cos(pitch));camera.lookAt(tgtX,1.15,0);
   if(selYear>=0){const e=idx.get(String(Y0+selYear));beam.position.set(X0+selYear*DX,3,0);beam.lookAt(camera.position.x,3,camera.position.z);if(chip&&e){chip.hidden=false;chip.textContent=(Y0+selYear)+' · '+e.total}}else if(chip)chip.hidden=true;
   const w=canvas.clientWidth,h=canvas.clientHeight;grp.updateMatrixWorld(true);
   lab.forEach(el=>{if(el.dataset.d){v3.set(X0+(Number(el.dataset.d)-Y0)*DX,0,.55)}else{v3.set(X0-.35,Number(el.dataset.r)*HS,-.34)}v3.project(camera);el.style.transform=`translate(${((v3.x*.5+.5)*w).toFixed(1)}px,${((-v3.y*.5+.5)*h).toFixed(1)}px)`;el.style.opacity=v3.z<1?1:0});
   if(window.BKText&&++labFrame%6===0){const L=lab.filter(el=>el.style.opacity==='1').map(el=>{const b=el.getBoundingClientRect();return{el,x:b.left+b.width/2,y:b.top,w:b.width,h:b.height,prio:el.dataset.d?2:1}});lab.forEach(el=>{el.style.visibility=''});window.BKText.declutter(L,2)}
   if(chip&&selYear>=0){const e=idx.get(String(Y0+selYear));v3.set(X0+selYear*DX,(e?e.total:0)*HS*0+Math.min(1,cur.length?1:0)*0+(()=>{let s=0;for(let k=0;k<K;k++)if(keys[k].i===selYear)s+=cur[k];return s})()+.5,0);v3.project(camera);chip.style.transform=`translate(${((v3.x*.5+.5)*w).toFixed(1)}px,${((-v3.y*.5+.5)*h).toFixed(1)}px)`}
   renderer.render(scene,camera);
   const still=reduced.matches||root.classList.contains('effects-paused');if(!still||moving||drag||Math.abs(vy)>1e-4||Math.abs(distT-dist)>.01||Math.abs(txT-tx)>.002)raf=requestAnimationFrame(frame)}
  size();new ResizeObserver(()=>{size();wake()}).observe(panel);
  if(typeof IntersectionObserver==='function')new IntersectionObserver(es=>{visible=es[0].isIntersecting;if(visible)wake()}).observe(panel);
  new MutationObserver(()=>{theme();wake()}).observe(root,{attributes:true,attributeFilter:['data-theme','class']});
  document.addEventListener('library:language',()=>{canvas.setAttribute('aria-label',t('nsLabel'))});
  theme();syncSel();recolor();canvas.classList.add('on');wake();
  inst={wake,sync:()=>{syncSel();wake()}};return inst}
 return{init,get inst(){return inst}}
})();
