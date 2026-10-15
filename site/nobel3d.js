'use strict';
/* Nobel Galaxy — the 1901→today archive as one spiral: every non-book record is a star, one turn-and-a-bit per generation,
   colour = prize category. Select a year (click) → the dossier below updates through the same control the chart uses;
   double-click a star → opens that record; drag to orbit; Ctrl+wheel / buttons to zoom. The accessible chart stays the default view. */
(()=>{
 const section=document.getElementById('timeline');
 if(!section||typeof document.createElement!=='function')return;
 const reduced=typeof matchMedia==='function'?matchMedia('(prefers-reduced-motion: reduce)'):{matches:false};
 const root=document.documentElement,CATC=['#e8c58a','#7fcdb4','#d9909f','#b4a1e2','#8fbaf0','#e59a6e','#8fa3ad'];
 const hasGL=()=>{try{const c=document.createElement('canvas');return!!(c.getContext('webgl2')||c.getContext('webgl'))}catch{return false}};
 let mounted=false;
 function mount(){
  if(mounted||!hasGL())return;const chart=section.querySelector('.nc-chart');if(!chart||typeof records==='undefined'||!records.length)return;mounted=true;
  const sw=document.createElement('div');sw.className='nc-viewswitch';sw.setAttribute('role','group');
  const panel=document.createElement('div');panel.className='nc-3d';panel.hidden=true;
  chart.parentNode.insertBefore(sw,chart);chart.parentNode.insertBefore(panel,chart.nextSibling);
  const labelsOf=()=>{sw.setAttribute('aria-label',t('ncViewLabel'));sw.innerHTML=`<button type="button" data-v="chart" aria-pressed="${view==='chart'}">${esc(t('ncViewChart'))}</button><button type="button" data-v="galaxy" aria-pressed="${view==='galaxy'}">${esc(t('ncViewGalaxy'))}</button>`;
   if(ui.hint)ui.hint.textContent=t('ncGalaxyHint');if(ui.note)ui.note.textContent=t('ncGalaxyNote')};
  let view='chart',ui={},booted=false;
  panel.innerHTML=`<canvas aria-hidden="true"></canvas><div class="nc-3d-labels" aria-hidden="true"></div><div class="nc-3d-tip" aria-hidden="true" hidden></div><div class="nc-3d-ctl" role="group"><button type="button" data-z="in">+</button><button type="button" data-z="out">−</button><button type="button" data-z="reset">⌂</button></div><p class="nc-3d-hint"></p><p class="sr-only nc-3d-note"></p>`;
  ui={canvas:panel.querySelector('canvas'),labels:panel.querySelector('.nc-3d-labels'),tip:panel.querySelector('.nc-3d-tip'),hint:panel.querySelector('.nc-3d-hint'),note:panel.querySelector('.nc-3d-note'),ctl:panel.querySelector('.nc-3d-ctl')};
  labelsOf();
  ui.ctl.setAttribute('aria-label',t('heroZoom'));[['in','heroZoomIn'],['out','heroZoomOut'],['reset','heroZoomReset']].forEach(([k,key])=>ui.ctl.querySelector(`[data-z=${k}]`).setAttribute('aria-label',t(key)));
  sw.addEventListener('click',e=>{const b=e.target.closest?e.target.closest('[data-v]'):null;if(!b)return;view=b.dataset.v;chart.hidden=view==='galaxy';panel.hidden=view!=='galaxy';labelsOf();if(view==='galaxy'){if(!booted){booted=true;boot()}else if(api)api.wake()}});
  document.addEventListener('library:language',labelsOf);
  let api=null;
  async function boot(){
   let THREE;try{THREE=await import('./vendor/three.module.min.js')}catch{return}
   const canvas=ui.canvas,renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true});renderer.setClearColor(0,0);
   const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(40,2,.1,100),grp=new THREE.Group();scene.add(grp);grp.rotation.x=-.95;
   let seed=1901;const rnd=()=>{seed=(seed*16807)%2147483647;return seed/2147483647},gauss=()=>{let u=0;for(let i=0;i<4;i++)u+=rnd();return(u-2)*1.7};
   const rows=records.filter(r=>r.collection!=='books'&&/^\d{4}$/.test(r.year||'')),N=rows.length,pos=new Float32Array(N*3),col=new Float32Array(N*3),siz=new Float32Array(N),yr=new Float32Array(N),idx=new Float32Array(N),tw=new Float32Array(N);
   const MIN=1901,SPAN=125,TURNS=1.7,anchor=y=>{const t=(y-MIN)/SPAN,th=t*Math.PI*2*TURNS,rad=1.3+t*4.2;return new THREE.Vector3(Math.cos(th)*rad,0,Math.sin(th)*rad)};
   const color=new THREE.Color();
   rows.forEach((r,i)=>{const y=Number(r.year),t=(y-MIN)/SPAN,th=t*Math.PI*2*TURNS+gauss()*.05,rad=1.3+t*4.2+gauss()*(.17+.07*t);pos[i*3]=Math.cos(th)*rad;pos[i*3+1]=gauss()*.14;pos[i*3+2]=Math.sin(th)*rad;
    color.set(CATC[typeof nobelCat==='function'?nobelCat(r):6]);col[i*3]=color.r;col[i*3+1]=color.g;col[i*3+2]=color.b;siz[i]=r.collection==='awards'?.15:.095;yr[i]=y;idx[i]=i;tw[i]=rnd()});
   const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(pos,3));geo.setAttribute('aC',new THREE.BufferAttribute(col,3));geo.setAttribute('aS',new THREE.BufferAttribute(siz,1));geo.setAttribute('aYr',new THREE.BufferAttribute(yr,1));geo.setAttribute('aI',new THREE.BufferAttribute(idx,1));geo.setAttribute('aT',new THREE.BufferAttribute(tw,1));
   const U={uTime:{value:0},uScale:{value:600},uSel:{value:0},uPick:{value:-99}};
   const mat=new THREE.ShaderMaterial({uniforms:U,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
    vertexShader:`attribute vec3 aC;attribute float aS,aYr,aI,aT;uniform float uTime,uScale,uSel,uPick;varying vec3 vC;varying float vA;void main(){vec4 mv=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mv;float sel=abs(aYr-uSel)<.5?1.:0.;float pk=abs(aI-uPick)<.5?1.:0.;float tw=.82+.18*sin(uTime*(.7+aT*2.)+aT*50.);gl_PointSize=clamp(aS*uScale/-mv.z*tw*(1.+sel*1.1+pk*2.6),1.,26.);vC=mix(aC,vec3(1.),pk*.7);vA=tw*(uSel>0.?(.55+sel*1.6):1.)+pk;}`,
    fragmentShader:`varying vec3 vC;varying float vA;void main(){float d=length(gl_PointCoord-.5);float a=smoothstep(.5,0.,d);a*=a;gl_FragColor=vec4(vC*1.25,clamp(a*vA,0.,1.));}`});
   const stars=new THREE.Points(geo,mat);stars.frustumCulled=false;grp.add(stars);
   /* spiral guide + selected-year ring */
   const guide=[];for(let i=0;i<=240;i++){const t=i/240,th=t*Math.PI*2*TURNS;guide.push(new THREE.Vector3(Math.cos(th)*(1.3+t*4.2),0,Math.sin(th)*(1.3+t*4.2)))}
   grp.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(guide),new THREE.LineBasicMaterial({color:0x9fb8c8,transparent:true,opacity:.16,blending:THREE.AdditiveBlending})));
   const ringPts=Array.from({length:65},(_,i)=>new THREE.Vector3(Math.cos(i/64*Math.PI*2)*.5,0,Math.sin(i/64*Math.PI*2)*.5)),ring=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(ringPts),new THREE.LineBasicMaterial({color:0xfff0cf,transparent:true,opacity:.85,blending:THREE.AdditiveBlending}));grp.add(ring);
   const glow=(()=>{const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d'),r=g.createRadialGradient(32,32,0,32,32,32);r.addColorStop(0,'rgba(255,240,200,.9)');r.addColorStop(1,'rgba(255,240,200,0)');g.fillStyle=r;g.fillRect(0,0,64,64);return new THREE.CanvasTexture(c)})();
   const core=new THREE.Sprite(new THREE.SpriteMaterial({map:glow,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,opacity:.55}));core.scale.set(1.5,1.5,1);grp.add(core);
   /* decade labels */
   const decs=[1900,1920,1940,1960,1980,2000,2020].filter(d=>d<=2026);ui.labels.innerHTML=decs.map(d=>`<span>${d}</span>`).join('');const lab=[...ui.labels.children];
   /* camera / interaction state */
   let yaw=0,pitch=0,vYaw=0,zoom=1,zoomT=1,pan=new THREE.Vector3(),panT=new THREE.Vector3(),sel=0,drag=null,hover=-1,mouse={x:0,y:0,in:false},visible=true,raf=0,t0=performance.now(),time=0;
   const v=new THREE.Vector3(),wake=()=>{if(!raf)raf=requestAnimationFrame(frame)};
   function size(){const w=canvas.clientWidth||600,h=canvas.clientHeight||400,dpr=Math.min(devicePixelRatio||1,1.6);renderer.setPixelRatio(dpr);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();U.uScale.value=renderer.domElement.height/(2*Math.tan(20*Math.PI/180))}
   function select(){const y=typeof nobelYear!=='undefined'?Number(nobelYear):0;if(y===sel)return;sel=y;U.uSel.value=y;if(y){const a=anchor(y);ring.position.copy(a);ring.visible=true;panT.copy(a).multiplyScalar(.45);zoomT=Math.max(zoomT,1.25)}else ring.visible=false}
   function pick(){if(!mouse.in||drag){set(-1);return}const rect=canvas.getBoundingClientRect();let best=-1,bd=13*13;grp.updateMatrixWorld(true);
    for(let i=0;i<N;i++){v.set(pos[i*3],pos[i*3+1],pos[i*3+2]);grp.localToWorld(v);v.project(camera);if(v.z>1)continue;const sx=(v.x*.5+.5)*rect.width+rect.left,sy=(-v.y*.5+.5)*rect.height+rect.top,d=(sx-mouse.x)**2+(sy-mouse.y)**2;if(d<bd){bd=d;best=i}}set(best)}
   function set(i){if(i===hover)return;hover=i;U.uPick.value=i<0?-99:i;const tip=ui.tip;if(i<0){tip.hidden=true;return}const r=rows[i],c=typeof nobelCat==='function'?nobelCat(r):6;tip.innerHTML=`<small style="--c:${CATC[c]}">${esc(r.year)} · ${esc(typeof nobelCatLabel==='function'?nobelCatLabel(c):'')}</small><strong>${esc(r.collection==='awards'?r.author:displayTitle(r))}</strong>${r.collection==='awards'?`<span>${esc(displayTitle(r))}</span>`:`<span>${esc(r.author||'')}</span>`}`;tip.hidden=false;place()}
   function place(){const r=panel.getBoundingClientRect();ui.tip.style.transform=`translate(${Math.max(8,Math.min(mouse.x-r.left+14,r.width-250))}px,${Math.max(8,Math.min(mouse.y-r.top+16,r.height-90))}px)`}
   const pointer=e=>{mouse={x:e.clientX,y:e.clientY,in:true}};
   canvas.parentNode.addEventListener('pointermove',e=>{pointer(e);if(drag){const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.abs(dx)+Math.abs(dy)>4)drag.moved=true;yaw+=dx*.006;pitch=Math.max(-.45,Math.min(.45,pitch+dy*.004));vYaw=dx*.006;drag.x=e.clientX;drag.y=e.clientY;set(-1)}else{pick();if(!ui.tip.hidden)place()}wake()},{passive:true});
   canvas.parentNode.addEventListener('pointerleave',()=>{mouse.in=false;set(-1)});
   canvas.parentNode.addEventListener('pointerdown',e=>{if(e.button>0||e.target.closest('.nc-3d-ctl'))return;drag={x:e.clientX,y:e.clientY,moved:false}});
   addEventListener('pointerup',()=>{const d=drag;drag=null;if(d&&!d.moved&&hover>=0){const y=rows[hover].year;if(typeof selectNobelYear==='function')selectNobelYear(String(y));else{const btn=section.querySelector(`.nc-year[data-year="${y}"]`);if(btn&&!btn.disabled)btn.click()}wake()}});
   canvas.parentNode.addEventListener('dblclick',()=>{if(hover>=0&&window.openRecord)window.openRecord(rows[hover].id)});
   canvas.parentNode.addEventListener('wheel',e=>{if(!(e.ctrlKey||e.metaKey))return;e.preventDefault();zoomT=Math.max(.7,Math.min(5,zoomT*Math.exp(-e.deltaY*.01)));wake()},{passive:false});
   ui.ctl.addEventListener('click',e=>{const b=e.target.closest?e.target.closest('[data-z]'):null;if(!b)return;if(b.dataset.z==='in')zoomT=Math.min(5,zoomT*1.4);else if(b.dataset.z==='out')zoomT=Math.max(.7,zoomT/1.4);else{zoomT=1;panT.set(0,0,0);yaw=0;pitch=0}wake()});
   function draw(dt){time+=dt;U.uTime.value=time;select();if(!drag){yaw+=vYaw;vYaw*=.94;if(Math.abs(vYaw)<1e-4)vYaw=0}
    const k=Math.min(1,dt*5);zoom+=(zoomT-zoom)*k;pan.lerp(panT,k);
    /* scroll-linked entrance: the galaxy dollies in and swings round as the section arrives (continuity with the hero galaxy) */
    const pr=panel.getBoundingClientRect(),sp=Math.max(0,Math.min(1,(innerHeight-pr.top)/(innerHeight*.85))),se=sp*sp*(3-2*sp),dolly=.6+.4*se;
    camera.position.set(pan.x,pan.y+1.4/(zoom*dolly),13.5/(zoom*dolly)+pan.z*.2);camera.lookAt(pan.x*.6,0,pan.z*.6);
    grp.rotation.y=yaw+(1-se)*1.25+(reduced.matches||root.classList.contains('effects-paused')?0:time*.045);grp.rotation.x=-.95+pitch;core.material.opacity=.3+.06*Math.sin(time*.8);
    const w=canvas.clientWidth,h=canvas.clientHeight;grp.updateMatrixWorld(true);lab.forEach((el,i)=>{const a=anchor(decs[i]);v.copy(a);grp.localToWorld(v);v.project(camera);el.style.transform=`translate(${((v.x*.5+.5)*w).toFixed(1)}px,${((-v.y*.5+.5)*h).toFixed(1)}px)`;el.style.opacity=v.z<1?1:0});
    renderer.render(scene,camera)}
   function frame(now){raf=0;const dt=Math.min(.05,(now-(frame.l||now))/1000||0);frame.l=now;if(view!=='galaxy'||!visible||document.hidden)return;draw(dt);const still=reduced.matches||root.classList.contains('effects-paused');if(!still||drag||Math.abs(vYaw)>1e-4||Math.abs(zoomT-zoom)>.002)raf=requestAnimationFrame(frame)}
   size();new ResizeObserver(()=>{size();wake()}).observe(panel);addEventListener('scroll',()=>{if(visible&&view==='galaxy')wake()},{passive:true});if(typeof IntersectionObserver==='function')new IntersectionObserver(es=>{visible=es[0].isIntersecting;if(visible)wake()}).observe(panel);
   new MutationObserver(wake).observe(root,{attributes:true,attributeFilter:['class','data-theme']});
   api={wake};draw(.016);wake();canvas.classList.add('on')}
 }
 const go=()=>setTimeout(mount,400);document.addEventListener('library:ready',go);if(typeof records!=='undefined'&&records.length)go();
})();
