'use strict';
/* Record-page constellation as a live 3D scene.
   The DOM buttons (.rv-node) stay the accessible, clickable layer; this file draws the sky behind them with three.js
   (depth-layered stars, nebula, glowing core + orbit rings, relation-coloured edges with flowing particles) and
   re-projects every button each frame so labels follow when you drag to orbit. Dark = additive glow on deep space,
   light = ink on parchment. Falls back to the static SVG when WebGL / motion is unavailable. */
(()=>{
 if(typeof document==='undefined'||typeof MutationObserver!=='function')return;
 const sheet=document.getElementById('recordSheet');if(!sheet)return;
 const root=document.documentElement,reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const hasGL=()=>{try{const c=document.createElement('canvas');return!!(c.getContext('webgl2')||c.getContext('webgl'))}catch{return false}};
 const REL={author:[232,206,158],year:[185,167,214],lang:[124,199,183],field:[159,184,200]};
 const REL_INK={author:[150,96,40],year:[104,82,160],lang:[26,128,108],field:[64,92,116]};
 let THREE=null,loading=null,cur=null;
 const load=()=>loading||(loading=import('./vendor/three.module.min.js').then(m=>{THREE=m;return m}).catch(()=>null));

 function glowTexture(m,inner){const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d'),r=g.createRadialGradient(64,64,0,64,64,64);r.addColorStop(0,'rgba(255,255,255,1)');r.addColorStop(inner||.18,'rgba(255,255,255,.55)');r.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=r;g.fillRect(0,0,128,128);const t=new m.CanvasTexture(c);t.colorSpace=m.SRGBColorSpace;return t}
 function dotTexture(m){const c=document.createElement('canvas');c.width=c.height=32;const g=c.getContext('2d'),r=g.createRadialGradient(16,16,0,16,16,16);r.addColorStop(0,'rgba(255,255,255,1)');r.addColorStop(.4,'rgba(255,255,255,.8)');r.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=r;g.fillRect(0,0,32,32);return new m.CanvasTexture(c)}
 const rgb=a=>a.map(v=>v/255);

 function mount(box){
  if(cur&&cur.box===box)return;if(cur)cur.destroy();
  if(!hasGL()||reduced.matches)return;
  const nodes=[...box.querySelectorAll('.rv-node')];if(!nodes.length)return;
  load().then(m=>{
   if(!m||!box.isConnected||(cur&&cur.box===box))return;
   const W=1000,H=560,CX=500,CY=284;
   const canvas=document.createElement('canvas');canvas.className='rv-gl';canvas.setAttribute('aria-hidden','true');box.insertBefore(canvas,box.firstChild);
   let renderer;try{renderer=new m.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'high-performance'})}catch{canvas.remove();return}
   renderer.setClearColor(0,0);renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.75));
   const scene=new m.Scene(),camera=new m.PerspectiveCamera(38,1,10,4000),world=new m.Group(),sky=new m.Group();scene.add(sky,world);
   const glow=glowTexture(m),dot=dotTexture(m);
   const light=()=>root.dataset.theme==='light';
   const items=nodes.map((el,i)=>{const kind=(el.className.match(/rel-(author|year|lang|field)/)||[])[1]||'field';
    const lx=parseFloat(el.style.left)/100*W-CX,ly=parseFloat(el.style.top)/100*H-CY;
    return{el,kind,i,base:new m.Vector3(lx,-ly,((i*73%11)-5)*26),ph:i*1.7}});
   box.classList.add('rv-3d');box.dataset.hint=typeof t==='function'?t('rvDragHint'):'';

   /* stars in three depth shells (parallax when orbiting) */
   const starN=240,sp=new Float32Array(starN*3),sc=new Float32Array(starN*3),sh=new Float32Array(starN);
   for(let k=0;k<starN;k++){sp[k*3]=(Math.random()-.5)*1300;sp[k*3+1]=(Math.random()-.5)*760;sp[k*3+2]=-120-Math.random()*520;sh[k]=Math.random()}
   const sg=new m.BufferGeometry();sg.setAttribute('position',new m.BufferAttribute(sp,3));sg.setAttribute('color',new m.BufferAttribute(sc,3));
   const sm=new m.PointsMaterial({size:3.4,sizeAttenuation:false,map:dot,transparent:true,depthWrite:false,vertexColors:true,opacity:.9});
   sky.add(new m.Points(sg,sm));
   /* nebula wash */
   const neb=[[-260,60,-300,820,[90,120,190]],[300,-80,-340,760,[190,140,90]],[0,160,-420,900,[110,90,170]]].map(([x,y,z,s,c])=>{const sp2=new m.Sprite(new m.SpriteMaterial({map:glow,transparent:true,depthWrite:false,opacity:.2,color:new m.Color(...rgb(c))}));sp2.position.set(x,y,z);sp2.scale.set(s,s*.62,1);sky.add(sp2);return{s:sp2,c}});

   /* core, rings */
   const core=new m.Sprite(new m.SpriteMaterial({map:glow,transparent:true,depthWrite:false}));core.scale.set(120,120,1);world.add(core);
   const core2=new m.Sprite(new m.SpriteMaterial({map:glow,transparent:true,depthWrite:false}));core2.scale.set(44,44,1);world.add(core2);
   const ringGeo=r=>{const pts=[];for(let a=0;a<=96;a++){const t=a/96*Math.PI*2;pts.push(new m.Vector3(Math.cos(t)*r,Math.sin(t)*r*.62,0))}return new m.BufferGeometry().setFromPoints(pts)};
   const rings=[120,205].map((r,i)=>{const l=new m.Line(ringGeo(r),new m.LineBasicMaterial({transparent:true,opacity:.22,depthWrite:false}));l.rotation.x=.5+i*.25;l.rotation.z=i*.6;world.add(l);return l});

   /* edges + flowing particles */
   const FLOW=12,edges=items.map(it=>{
    const mid=it.base.clone().multiplyScalar(.5);mid.z+=40;mid.y+=(it.i%2?1:-1)*Math.min(46,it.base.length()*.16);
    const curve=new m.QuadraticBezierCurve3(new m.Vector3(0,0,0),mid,it.base.clone());
    const line=new m.Line(new m.BufferGeometry().setFromPoints(curve.getPoints(40)),new m.LineBasicMaterial({transparent:true,opacity:.34,depthWrite:false}));world.add(line);
    return{it,curve,line}});
   const fN=items.length*FLOW,fp=new Float32Array(fN*3),fc=new Float32Array(fN*3);
   const fg=new m.BufferGeometry();fg.setAttribute('position',new m.BufferAttribute(fp,3));fg.setAttribute('color',new m.BufferAttribute(fc,3));
   const fm=new m.PointsMaterial({size:4.2,sizeAttenuation:false,map:dot,transparent:true,depthWrite:false,vertexColors:true,opacity:.95});
   world.add(new m.Points(fg,fm));
   /* node halos */
   const halos=items.map(it=>{const s=new m.Sprite(new m.SpriteMaterial({map:glow,transparent:true,depthWrite:false}));s.position.copy(it.base);world.add(s);return s});

   let w=1,h=1,yaw=0,pitch=0,vyaw=0,vpitch=0,tyaw=0,tpitch=0,drag=null,hover=-1,raf=0,visible=true,t0=performance.now(),idle=true,lastTheme='';
   const resize=()=>{const r=box.getBoundingClientRect();w=Math.max(2,r.width);h=Math.max(2,r.height);renderer.setSize(w,h,false);camera.aspect=w/h;
    /* the 1000x560 design box must stay fully visible, even when min-height makes the panel taller than 1000:560 */
    const visH=Math.max(H,W/camera.aspect)*1.02,d=(visH/2)/Math.tan(camera.fov*Math.PI/360);camera.position.set(0,0,d);camera.updateProjectionMatrix();camera.lookAt(0,0,0)};
   const ro=typeof ResizeObserver==='function'?new ResizeObserver(resize):null;if(ro)ro.observe(box);resize();

   const v=new m.Vector3();
   function paint(now){
    const time=(now-t0)/1000,lt=light();
    if(lastTheme!==(lt?'l':'d')){lastTheme=lt?'l':'d';
     const add=lt?m.NormalBlending:m.AdditiveBlending;
     [sm,fm,core.material,core2.material,...halos.map(s=>s.material),...neb.map(n=>n.s.material)].forEach(mt=>{mt.blending=add;mt.needsUpdate=true});
     rings.forEach(r=>r.material.color.setRGB(...(lt?[.2,.28,.36]:[.98,.96,.92])));
     core.material.color.setRGB(...(lt?[.62,.38,.18]:[.91,.81,.62]));core2.material.color.setRGB(...(lt?[.25,.15,.08]:[1,.96,.86]));
     neb.forEach(n=>{n.s.material.opacity=lt?.1:.2;n.s.material.color.setRGB(...rgb(lt?[n.c[0]*.7+60,n.c[1]*.7+50,n.c[2]*.7+30]:n.c))});
     for(let k=0;k<starN;k++){const b=.45+sh[k]*.55,c=lt?[.2*b,.27*b,.36*b]:[.85*b,.9*b,1*b];sc[k*3]=c[0];sc[k*3+1]=c[1];sc[k*3+2]=c[2]}sg.attributes.color.needsUpdate=true;
     edges.forEach(e=>{const c=(lt?REL_INK:REL)[e.it.kind];e.line.material.color.setRGB(...rgb(c));e.line.material.blending=add;e.line.material.needsUpdate=true});
     items.forEach((it,i)=>{halos[i].material.color.setRGB(...rgb((lt?REL_INK:REL)[it.kind]))});
     sm.opacity=lt?.55:.9}
    /* orbit: drag + inertia + gentle idle sway */
    if(!drag){tyaw+=vyaw;tpitch+=vpitch;vyaw*=.93;vpitch*=.93;tyaw=Math.max(-.85,Math.min(.85,tyaw));tpitch=Math.max(-.45,Math.min(.45,tpitch));
     if(idle){tyaw+=((Math.sin(time*.22)*.18)-tyaw)*.006;tpitch+=((Math.cos(time*.17)*.06)-tpitch)*.006}}
    yaw+=(tyaw-yaw)*.12;pitch+=(tpitch-pitch)*.12;
    world.rotation.y=yaw;world.rotation.x=pitch;sky.rotation.y=-yaw*.35;sky.rotation.x=-pitch*.35;
    rings.forEach((r,i)=>{r.rotation.z+=.0012*(i?-1:1)});
    const pulse=1+.08*Math.sin(time*2.1);core.scale.set(120*pulse,120*pulse,1);core.material.opacity=lt?.55:.8;core2.material.opacity=lt?.9:1;
    /* flowing particles */
    let k=0;edges.forEach((e,ei)=>{const hot=hover===ei,c=(lt?REL_INK:REL)[e.it.kind],sp=.07+(hot?.09:0);e.line.material.opacity=hover<0?(lt?.4:.34):(hot?.9:.1);
     for(let j=0;j<FLOW;j++){const u=((time*sp+j/FLOW+ei*.13)%1);e.curve.getPoint(u,v);fp[k*3]=v.x;fp[k*3+1]=v.y;fp[k*3+2]=v.z;const a=Math.sin(u*Math.PI)*(hover<0||hot?1:.25);fc[k*3]=c[0]/255*a;fc[k*3+1]=c[1]/255*a;fc[k*3+2]=c[2]/255*a;k++}});
    fg.attributes.position.needsUpdate=true;fg.attributes.color.needsUpdate=true;
    halos.forEach((s,i)=>{const hot=hover===i,p=1+.12*Math.sin(time*1.6+items[i].ph),sz=(hot?84:52)*p;s.scale.set(sz,sz,1);s.material.opacity=lt?(hot?.8:.45):(hot?1:.7)});
    world.updateMatrixWorld(true);
    /* re-project the DOM layer */
    items.forEach(it=>{v.copy(it.base).applyMatrix4(world.matrixWorld).project(camera);const x=(v.x*.5+.5)*100,y=(1-(v.y*.5+.5))*100;
     it.el.style.left=x.toFixed(2)+'%';it.el.style.top=y.toFixed(2)+'%';it.el.style.zIndex=String(Math.round((1-v.z)*500))});
    renderer.render(scene,camera)}
   function loop(now){raf=0;if(!visible||document.hidden||!box.isConnected){if(!box.isConnected)destroy();return}paint(now);raf=requestAnimationFrame(loop)}
   const kick=()=>{if(!raf)raf=requestAnimationFrame(loop)};
   const io=typeof IntersectionObserver==='function'?new IntersectionObserver(es=>{visible=es[0].isIntersecting;if(visible)kick()},{threshold:0}):null;if(io)io.observe(box);
   const onVis=()=>{if(!document.hidden)kick()};document.addEventListener('visibilitychange',onVis);

   /* interaction */
   const down=e=>{if(e.target.closest&&e.target.closest('.rv-node'))return;drag={x:e.clientX,y:e.clientY,id:e.pointerId};idle=false;vyaw=vpitch=0;try{box.setPointerCapture(e.pointerId)}catch{}box.classList.add('dragging')};
   const move=e=>{if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;drag.x=e.clientX;drag.y=e.clientY;vyaw=dx*.0035;vpitch=dy*.0028;tyaw+=vyaw;tpitch+=vpitch};
   const up=()=>{if(!drag)return;drag=null;box.classList.remove('dragging');setTimeout(()=>{idle=true},2600)};
   box.addEventListener('pointerdown',down);box.addEventListener('pointermove',move);box.addEventListener('pointerup',up);box.addEventListener('pointercancel',up);
   box.addEventListener('dblclick',()=>{tyaw=0;tpitch=0;vyaw=vpitch=0});
   items.forEach((it,i)=>{const on=()=>{hover=i;it.el.classList.add('hot')},off=()=>{if(hover===i)hover=-1;it.el.classList.remove('hot')};it.el.addEventListener('mouseenter',on);it.el.addEventListener('focus',on);it.el.addEventListener('mouseleave',off);it.el.addEventListener('blur',off)});
   const kb=e=>{if(!box.contains(document.activeElement))return;const k=e.key;if(k==='ArrowLeft'&&e.shiftKey)tyaw-=.12;else if(k==='ArrowRight'&&e.shiftKey)tyaw+=.12;else if(k==='ArrowUp'&&e.shiftKey)tpitch-=.1;else if(k==='ArrowDown'&&e.shiftKey)tpitch+=.1;else return;e.preventDefault()};
   box.addEventListener('keydown',kb);

   function destroy(){if(raf)cancelAnimationFrame(raf);raf=0;if(ro)ro.disconnect();if(io)io.disconnect();document.removeEventListener('visibilitychange',onVis);
    scene.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material){(Array.isArray(o.material)?o.material:[o.material]).forEach(x=>x.dispose())}});glow.dispose();dot.dispose();
    try{renderer.dispose();renderer.forceContextLoss()}catch{}canvas.remove();box.classList.remove('rv-3d','dragging');items.forEach(it=>{it.el.style.zIndex=''});if(cur&&cur.box===box)cur=null}
   cur={box,destroy};kick()})}

 function scan(){const box=sheet.querySelector('.rv-constellation');if(box)mount(box);else if(cur&&!cur.box.isConnected){cur.destroy()}}
 new MutationObserver(scan).observe(sheet,{childList:true});scan();
 const rv=document.getElementById('recordView');if(rv)new MutationObserver(()=>{if(rv.hidden&&cur)cur.destroy()}).observe(rv,{attributes:true,attributeFilter:['hidden']});
})();
