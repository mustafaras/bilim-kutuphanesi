'use strict';
/* G3 — the "no results" state gets a small dim galaxy inside an empty wireframe box.
   Lazy: nothing is loaded until an .empty-state exists; own tiny WebGL context that is released with the element; static frame under reduced motion. */
(()=>{
 const root=document.documentElement,reduced=matchMedia('(prefers-reduced-motion: reduce)');
 let THREE=null,loading=null;
 const load=()=>loading||(loading=import('./vendor/three.module.min.js').then(m=>(THREE=m)).catch(()=>null));
 function mount(el){
  if(el.querySelector('.empty3d'))return;
  const cv=document.createElement('canvas');cv.className='empty3d';cv.setAttribute('aria-hidden','true');el.insertBefore(cv,el.firstChild);
  load().then(m=>{
   if(!m||!cv.isConnected)return;
   let r;try{r=new m.WebGLRenderer({canvas:cv,alpha:true,antialias:true})}catch{cv.remove();return}
   r.setClearColor(0,0);const scene=new m.Scene(),camera=new m.PerspectiveCamera(32,1.34,.1,30);camera.position.set(0,.25,5.4);camera.lookAt(0,0,0);
   const g=new m.Group();scene.add(g);g.rotation.x=.5;
   const N=1500,pos=new Float32Array(N*3),col=new Float32Array(N*3);let sd=11;const rnd=()=>{sd=(sd*16807)%2147483647;return sd/2147483647};
   for(let i=0;i<N;i++){const arm=i%3,t=Math.pow(rnd(),.7),a=t*5.2+arm*2.094,rr=.1+t*1.5,j=(rnd()-.5)*.18*(1+t);pos[i*3]=Math.cos(a)*rr+j;pos[i*3+1]=(rnd()-.5)*.1*(1-t*.5);pos[i*3+2]=Math.sin(a)*rr+j}
   const geo=new m.BufferGeometry();geo.setAttribute('position',new m.BufferAttribute(pos,3));geo.setAttribute('color',new m.BufferAttribute(col,3));
   const pm=new m.PointsMaterial({size:.035,vertexColors:true,transparent:true,opacity:.55,depthWrite:false,sizeAttenuation:true});const stars=new m.Points(geo,pm);g.add(stars);
   const box=new m.LineSegments(new m.EdgesGeometry(new m.BoxGeometry(2.25,2.25,2.25)),new m.LineBasicMaterial({transparent:true,opacity:.42}));scene.add(box);
   let lastTheme='';const theme=()=>{const lt=root.dataset.theme==='light';if(lastTheme===(lt?'l':'d'))return;lastTheme=lt?'l':'d';
    for(let i=0;i<N;i++){const b=.35+.65*Math.pow(1-Math.hypot(pos[i*3],pos[i*3+2])/1.7,1.3),c=lt?[.16*b+.1,.3*b+.14,.4*b+.2]:[.95*b,.82*b,.62*b];col[i*3]=c[0];col[i*3+1]=c[1];col[i*3+2]=c[2]}
    geo.attributes.color.needsUpdate=true;pm.blending=lt?m.NormalBlending:m.AdditiveBlending;pm.opacity=lt?.8:.55;pm.needsUpdate=true;box.material.color.set(lt?0x8a5a2c:0xe8ce9e)};
   const size=()=>{const w=cv.clientWidth||200,h=cv.clientHeight||150;r.setPixelRatio(Math.min(devicePixelRatio||1,1.5));r.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix()};
   size();let raf=0,t0=performance.now(),visible=true;
   const io=typeof IntersectionObserver==='function'?new IntersectionObserver(es=>{visible=es[0].isIntersecting;if(visible&&!raf&&!reduced.matches)raf=requestAnimationFrame(loop)}):null;if(io)io.observe(cv);
   function draw(t){theme();g.rotation.y=t*.12;box.rotation.y=t*.05+.4;box.rotation.x=.3;r.render(scene,camera)}
   function loop(now){raf=0;if(!cv.isConnected){try{r.dispose();r.forceContextLoss()}catch{}return}if(!visible||document.hidden){return}draw((now-t0)/1000);raf=requestAnimationFrame(loop)}
   if(reduced.matches){draw(3);cv.classList.add('on')}else{raf=requestAnimationFrame(loop);cv.classList.add('on')}
  });
 }
 const scan=()=>document.querySelectorAll('.empty-state').forEach(mount);
 const target=document.getElementById('cards')||document.body;
 if(typeof MutationObserver==='function')new MutationObserver(()=>{clearTimeout(scan.t);scan.t=setTimeout(scan,80)}).observe(target,{childList:true,subtree:true});
 scan();
})();
