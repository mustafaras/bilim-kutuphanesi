'use strict';
/* BKMaterials — the one place for materials, studio light and tone mapping of every PBR scene (shelf / record stage, Nobel skyline).
   • foil / cloth / glass / brass (MeshPhysicalMaterial) and paper (MeshStandardMaterial): factories take the three namespace first, then overrides — BKMaterials.glass(THREE,{color,opacity,...}).
     Defaults only hold what is shared; every call site states what differs, so a material looks exactly as it did when it was declared inline.
   • env(renderer,THREE,preset): the studio (soft boxes → PMREM). One bake per renderer and preset ('book' for the stage, 'city' for the skyline), cached; a PMREM is a render target of ONE
     GL context, so two renderers can never share a texture, but they share this one bake routine (the only PMREMGenerator in the code base). rebake() after a context loss, swapEnv() moves the scenes over.
   • tone(renderer): tone mapping and exposure in one place. Default NoToneMapping / exposure 1 (what the R3 visual goldens were captured with); flag acestone = ACES with an exposure per theme.
   • lighter(THREE,material,level) + LEVELS: the material levels full / standard / lambert / basic (0–3) the quality ladder of the stage steps down through.
   • flags (BKGL.flags): matlib (default on; off = every factory returns the plain standard level), acestone (default off). diag() feeds ?diag and the B8 / B12 audits. */
(()=>{
 const LEVELS=['full','standard','lambert','basic'];
 const flag=n=>{try{return window.BKGL?BKGL.flags.get(n):n==='matlib'}catch{return n==='matlib'}};
 const root=typeof document!=='undefined'?document.documentElement:null;

 /* ---------- studio light: soft boxes [w,h,x,y,z,colour,intensity] ---------- */
 const PRESETS={
  book:{bg:0x07090f,sigma:.035,boxes:[[9,5,-6,5,6,0xfff0d6,6],[4,9,8,1,3,0xd6e4ff,3.4],[12,2,0,-6,1,0xffdca8,1.3],[7,3,0,7,-6,0xffffff,2.6],[3,6,-8,-1,-2,0xffe6c4,1.4],[7,5,0,1,9,0xfff4dc,3.2]]},
  city:{bg:0x06080d,sigma:.03,boxes:[[10,5,-5,6,6,0xfff0d6,5],[4,9,8,1,3,0xd6e4ff,3],[14,2,0,-6,2,0xffdca8,1.2],[7,4,0,7,-6,0xffffff,2.4],[8,5,0,2,9,0xfff4dc,2.4]]}};
 const cache=new WeakMap(),ids=new WeakMap(),baked=[];let nid=0,bakes=0,rebakes=0;   // baked: weak list of the renderers we hold a bake for (a WeakMap cannot be iterated)
 const slot=r=>{let s=cache.get(r);if(!s){s={};cache.set(r,s);ids.set(r,++nid);baked.push(new WeakRef(r))}return s};
 function bake(r,m,preset){
  const P=PRESETS[preset]||PRESETS.book,es=new m.Scene(),made=[];
  try{es.background=new m.Color(P.bg);
   for(const[w,h,x,y,z,c,k]of P.boxes){const g=new m.PlaneGeometry(w,h),mt=new m.MeshBasicMaterial({color:new m.Color(c).multiplyScalar(k),side:m.DoubleSide}),mm=new m.Mesh(g,mt);mm.position.set(x,y,z);mm.lookAt(0,0,0);es.add(mm);made.push(g,mt)}
   const sc=r.getScissorTest(),pm=new m.PMREMGenerator(r);r.setScissorTest(false);   // the stage keeps scissor on for its tiles; the bake must cover the whole target
   try{return pm.fromScene(es,P.sigma).texture}finally{r.setScissorTest(sc);pm.dispose()}}
  catch{return null}
  finally{made.forEach(o=>o.dispose())}}
 function env(r,m,preset='book'){const s=slot(r);if(s[preset])return s[preset];const t=bake(r,m,preset);if(t){s[preset]=t;bakes++}return s[preset]||null}
 /* after a GL context loss the baked map has no pixels left: bake again and hand back {old,fresh} so the caller can move its scenes over (swapEnv) */
 function rebake(r,m,preset='book'){const s=slot(r),old=s[preset];if(!old)return null;delete s[preset];const fresh=env(r,m,preset);if(!fresh){s[preset]=old;return null}rebakes++;return{old,fresh}}
 function swapEnv(scene,old,fresh){if(!scene||!old||!fresh)return;if(scene.environment===old)scene.environment=fresh;
  scene.traverse(o=>{const ms=Array.isArray(o.material)?o.material:o.material?[o.material]:[];ms.forEach(mt=>{if(mt.envMap===old){mt.envMap=fresh;mt.needsUpdate=true}})})}

 /* ---------- tone mapping + exposure (THREE.NoToneMapping 0, THREE.ACESFilmicToneMapping 4) ---------- */
 const EXPOSURE={dark:1.1,light:.95};   // used only with the acestone flag (not tuned on a real display yet)
 const tracked=[];let watching=false;
 function applyTone(r){const ace=flag('acestone'),light=root&&root.dataset.theme==='light';r.toneMapping=ace?4:0;r.toneMappingExposure=ace?(light?EXPOSURE.light:EXPOSURE.dark):1}
 function applyAll(){for(let i=tracked.length-1;i>=0;i--){const r=tracked[i].deref();if(!r)tracked.splice(i,1);else applyTone(r)}}
 function tone(r,name){tracked.push(new WeakRef(r));r.__bkTone=name||'';applyTone(r);
  if(!watching&&root){watching=true;document.addEventListener('bk:flag',applyAll);try{new MutationObserver(applyAll).observe(root,{attributes:true,attributeFilter:['data-theme']})}catch{}}
  return r}

 /* ---------- material levels ---------- */
 /* the quality ladder: 0 full (as built) · 1 plain standard, no bump / clearcoat / sheen · 2 lambert (no PBR) · 3 flat basic colours, no textures */
 function lighter(m,mt,level){
  if(!mt||mt.isShaderMaterial||mt.isShadowMaterial||!(level>0))return mt;const o={side:mt.side,transparent:mt.transparent,opacity:mt.opacity,depthWrite:mt.depthWrite};
  if(mt.color)o.color=mt.color.clone();if(level<3&&mt.map)o.map=mt.map;
  if(level>=3&&mt.map&&mt.map.image){try{const c=document.createElement('canvas');c.width=c.height=1;const x=c.getContext('2d');x.drawImage(mt.map.image,0,0,1,1);const d=x.getImageData(0,0,1,1).data;o.color=new m.Color().setRGB(d[0]/255,d[1]/255,d[2]/255,m.SRGBColorSpace)}catch{}}
  if(level===1){o.roughness=mt.roughness!=null?mt.roughness:.8;o.metalness=Math.min(mt.metalness||0,1);o.envMapIntensity=mt.envMapIntensity!=null?mt.envMapIntensity:1}
  if(mt.emissive){o.emissive=mt.emissive.clone();o.emissiveIntensity=mt.emissiveIntensity}
  const M=level>=3?m.MeshBasicMaterial:level===2?m.MeshLambertMaterial:m.MeshStandardMaterial;if(level>=3)delete o.emissive,delete o.emissiveIntensity;return new M(o)}

 /* ---------- factories ---------- */
 const physical=(m,base,o)=>{const mt=new m.MeshPhysicalMaterial(Object.assign({},base,o));return flag('matlib')?mt:lighter(m,mt,1)};
 const BASE={
  foil:{},                                                 // metal stamping / struck metal: the caller states metalness, roughness, clearcoat, iridescence, maps
  cloth:{roughness:.8,sheen:.8,sheenColor:0x8fa3b8},       // binding cloth, spine, ribbon: sheen instead of a specular lobe
  glass:{transparent:true,clearcoat:1},                    // tinted translucent glass with a clearcoat shell
  brass:{color:0xe3c17a,metalness:.95,roughness:.24,iridescence:.25,iridescenceIOR:1.3,iridescenceThicknessRange:[150,380],envMapIntensity:2}};   // the medal's rim metal
 const paper=(m,o)=>new m.MeshStandardMaterial(Object.assign({roughness:.92},o));
 /* paper fibre height field (tileable, seeded so every load is identical): two octaves of short pale / dark strokes; the caller turns it into a normal map */
 function fiberHeight(S=256){const c=document.createElement('canvas');c.width=c.height=S;const x=c.getContext('2d');x.fillStyle='#808080';x.fillRect(0,0,S,S);x.lineCap='round';
  let a=0x9e3779b1;const R=()=>((a=Math.imul(a^a>>>15,1|a)+0x6D2B79F5|0,(a^a>>>7)>>>0)/4294967296);
  for(const[n,len,w,al]of[[S*3,S*.1,1.4,.2],[S*8,S*.04,.9,.14]])for(let i=0;i<n;i++){const px=R()*S,py=R()*S,an=R()*Math.PI,dx=Math.cos(an)*len,dy=Math.sin(an)*len;x.strokeStyle=R()<.5?`rgba(255,255,255,${al})`:`rgba(0,0,0,${al})`;x.lineWidth=w;
   for(let ox=-1;ox<=1;ox++)for(let oy=-1;oy<=1;oy++){x.beginPath();x.moveTo(px+ox*S,py+oy*S);x.lineTo(px+ox*S+dx,py+oy*S+dy);x.stroke()}}
  return c}
 /* a book leaf: paper with the fibre normal map and a faint show-through of the ink on its other side (the other face's map sampled at the mirrored u, darkening the paper by bleed x ink). Flag paperfiber off = plain paper, as before. */
 function leaf(m,o){o=Object.assign({},o);const fiber=o.fiber,bleedMap=o.bleedMap,bleed=o.bleed==null?.07:o.bleed;delete o.fiber;delete o.bleedMap;delete o.bleed;
  if(!flag('paperfiber'))return paper(m,o);
  if(fiber){o.normalMap=fiber;o.normalScale=new m.Vector2(.5,.5)}
  const mt=paper(m,o);
  if(bleedMap){mt.userData.bleed=true;mt.customProgramCacheKey=()=>'bk-leaf-bleed';
   mt.onBeforeCompile=sh=>{sh.uniforms.bleedMap={value:bleedMap};sh.uniforms.bleedK={value:bleed};
    sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nuniform sampler2D bleedMap;uniform float bleedK;')
     .replace('#include <map_fragment>','#include <map_fragment>\n#ifdef USE_MAP\n diffuseColor.rgb*=1.0-bleedK*(1.0-dot(texture2D(bleedMap,vec2(1.0-vMapUv.x,vMapUv.y)).rgb,vec3(.299,.587,.114)));\n#endif')}}
  return mt}
 const foil=(m,o)=>physical(m,BASE.foil,o),cloth=(m,o)=>physical(m,BASE.cloth,o),glass=(m,o)=>physical(m,BASE.glass,o),brass=(m,o)=>physical(m,BASE.brass,o);

 function diag(){const envs=[];
  for(let i=baked.length-1;i>=0;i--){const r=baked[i].deref();if(!r){baked.splice(i,1);continue}for(const p in cache.get(r))envs.push(ids.get(r)+'#'+p)}
  return{bakes,rebakes,envs:envs.sort(),tone:tracked.map(w=>w.deref()).filter(Boolean).map(r=>({name:r.__bkTone,mapping:r.toneMapping,exposure:r.toneMappingExposure})),flags:{matlib:flag('matlib'),acestone:flag('acestone'),paperfiber:flag('paperfiber')}}}

 window.BKMaterials={LEVELS,PRESETS,foil,cloth,paper,leaf,fiberHeight,glass,brass,lighter,env,rebake,swapEnv,tone,diag};
 if(window.BKGL)BKGL.report('materials',()=>{const d=diag();return 'bakes '+d.bakes+' (re-bakes '+d.rebakes+') · envs '+d.envs.join(',')+' · tone '+d.tone.map(t=>t.name+':'+t.mapping+'/'+t.exposure).join(' ')+' · matlib '+d.flags.matlib+' acestone '+d.flags.acestone});
})();
