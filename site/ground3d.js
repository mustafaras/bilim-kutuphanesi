'use strict';
/* The ground band of the hero as a living three.js landscape.
   A contour-line terrain drifts toward the viewer (height-field in the vertex shader, iso-lines + faint survey grid in the
   fragment shader), glows under the galaxy like a reflection, glitters with sparse star-glints, and answers the pointer with
   expanding ripples that bend the contours. Dark = brass light on deep ground, light = ink survey lines on the blue-grey ground.
   Own small WebGL context, paused off-screen, static frame under reduced motion. */
(()=>{
 if(typeof document==='undefined')return;
 const hero=document.getElementById('hero');if(!hero)return;
 const root=document.documentElement,reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const hasGL=()=>{try{const c=document.createElement('canvas');return!!(c.getContext('webgl2')||c.getContext('webgl'))}catch{return false}};
 async function boot(){
  if(!hasGL())return;
  let THREE;try{THREE=await import('./vendor/three.module.min.js')}catch{return}
  const old=hero.querySelector('.hero-ground');if(old)old.remove();
  const canvas=document.createElement('canvas');canvas.className='hero-ground-gl';canvas.setAttribute('aria-hidden','true');hero.appendChild(canvas);
  let renderer;try{renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'high-performance'})}catch{canvas.remove();return}
  renderer.setClearColor(0,0);
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(46,2,.1,120);camera.position.set(0,2.4,7.5);camera.lookAt(0,-1.7,-5);
  const R=6,uniforms={uTime:{value:0},uLight:{value:0},uRes:{value:new THREE.Vector2(1,1)},uGlow:{value:.68},uDomeX:{value:.62},uLamp:{value:0},uR:{value:Array.from({length:R},()=>new THREE.Vector4(0,0,-99,0))},uEnergy:{value:0}};
  const mat=new THREE.ShaderMaterial({uniforms,transparent:true,depthWrite:false,
   vertexShader:`uniform float uTime;uniform vec4 uR[${R}];varying vec2 vP;varying float vH;varying float vRip;
    void main(){vec3 p=position;vec2 q=p.xy;
     float t=uTime;
     float h=.5*sin(q.x*.33+t*.14)*cos(q.y*.27-t*.11)+.28*sin(q.x*.78+q.y*.55+t*.22)+.14*sin(q.x*1.7-q.y*1.3-t*.3);
     float rip=0.;
     for(int i=0;i<${R};i++){vec4 r=uR[i];float dt=t-r.z;if(dt>0.&&dt<4.){float d=length(q-r.xy);float w=d-dt*3.4;rip+=r.w*exp(-w*w*1.4)*exp(-dt*.9);}}
     h+=rip*.8;vRip=rip;
     vec3 pos=vec3(q.x,h,-q.y);vP=q;vH=h;
     gl_Position=projectionMatrix*modelViewMatrix*vec4(pos,1.);}`,
   fragmentShader:`uniform float uTime,uLight,uGlow,uEnergy,uDomeX,uLamp;uniform vec2 uRes;varying vec2 vP;varying float vH;varying float vRip;
    float hs(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    void main(){
     vec2 sc=gl_FragCoord.xy/uRes;
     float c=abs(fract(vH*3.4+uTime*.02)-.5);float fw=fwidth(vH*3.4);
     float line=1.-smoothstep(0.,max(.045,fw*1.2),c);
     vec2 g=abs(fract(vP*.5)-.5);float gfw=fwidth(vP.x*.5);float grid=1.-smoothstep(0.,max(.03,gfw*1.1),min(g.x,g.y));
     float dist=smoothstep(26.,2.,length(vP-vec2(0.,6.)));
     float glow=exp(-pow((sc.x-uGlow)*2.1,2.))*(.35+.65*(1.-sc.y));
     vec3 brass=vec3(.93,.82,.6),ink=vec3(.16,.27,.37);
     /* palette light-waves: the survey lines carry the discovery-field colours as slow bands rolling toward the viewer */
     vec3 teal=mix(vec3(.49,.78,.72),vec3(.1,.34,.4),uLight),violet=mix(vec3(.73,.65,.84),vec3(.3,.24,.5),uLight),rose=mix(vec3(.84,.6,.42),vec3(.5,.26,.14),uLight);
     float w1=smoothstep(.45,.95,.5+.5*sin(vP.y*.38-uTime*.42+vP.x*.06)),w2=smoothstep(.55,1.,.5+.5*sin(vP.y*.23-uTime*.3-vP.x*.09+2.1));
     vec3 col=mix(brass,ink,uLight);col=mix(col,teal,w1*.7);col=mix(col,mix(violet,rose,.5+.5*sin(vP.x*.2+uTime*.1)),w2*.6);
     /* dome reflection: the observatory lamp's streak laid on the ground below it, broken up by the contour lines */
     float dx=(sc.x-uDomeX)/(.011+.028*(1.-sc.y));float streak=exp(-dx*dx)*smoothstep(0.,.85,sc.y)*uLamp;
     vec3 warm=mix(vec3(1.,.82,.52),vec3(.72,.4,.14),uLight);
     float a=(line*.62+grid*.07)*(.5+glow*1.2)*dist+vRip*.9*line;
     /* star glints: sparse hashed cells that twinkle, stronger under the galaxy */
     vec2 cell=floor(vP*3.2);float hh=hs(cell);float tw=smoothstep(.985,1.,hh)*(.5+.5*sin(uTime*(1.4+hh*3.)+hh*40.));
     float glint=tw*smoothstep(.45,.5,1.-length(fract(vP*3.2)-.5))*(.4+glow);
     a+=glint*.9*dist;
     a+=glow*.07*(1.-uLight*.4)*dist;
     a+=streak*(.16+.85*line+.3*grid)*(.75+.25*sin(vP.y*2.6-uTime*1.8))*dist*1.6;col=mix(col,warm,clamp(streak*1.4,0.,1.));
     a*=1.+uEnergy*.5;
     gl_FragColor=vec4(col,clamp(a,0.,1.)*(uLight>.5?.9:1.));}`});
  mat.extensions={derivatives:true};
  const geo=new THREE.PlaneGeometry(46,30,230,120);const mesh=new THREE.Mesh(geo,mat);mesh.frustumCulled=false;scene.add(mesh);
  const resize=()=>{const r=canvas.getBoundingClientRect(),w=Math.max(2,r.width),h=Math.max(2,r.height),pr=Math.max(.6,Math.min(devicePixelRatio||1,1.6)*([1,1,.85,.7,.55][window.BKMotion?BKMotion.quality.level:0]||1));renderer.setPixelRatio(pr);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();uniforms.uRes.value.set(w*pr,h*pr)};
  document.addEventListener('bk:quality',()=>{resize();frame.done=false;kick()});
  const ro=typeof ResizeObserver==='function'?new ResizeObserver(resize):null;if(ro)ro.observe(canvas);resize();
  let visible=true,raf=0,t0=performance.now(),ri=0,lastRip=0,energy=0;
  const io=typeof IntersectionObserver==='function'?new IntersectionObserver(es=>{visible=es[0].isIntersecting;if(visible)kick()},{threshold:0}):null;if(io)io.observe(hero);
  const ray=new THREE.Raycaster(),ndc=new THREE.Vector2(),plane=new THREE.Plane(new THREE.Vector3(0,1,0),0),hit=new THREE.Vector3();
  function ripple(cx,cy,amp){const b=canvas.getBoundingClientRect();if(cy<b.top||cy>b.bottom||cx<b.left||cx>b.right)return false;
   ndc.set(((cx-b.left)/b.width)*2-1,-(((cy-b.top)/b.height)*2-1));ray.setFromCamera(ndc,camera);if(!ray.ray.intersectPlane(plane,hit))return false;
   const now=(performance.now()-t0)/1000;uniforms.uR.value[ri%R].set(hit.x,-hit.z,now,amp);ri++;energy=Math.min(1,energy+.35);return true}
  addEventListener('pointermove',e=>{const now=performance.now();if(now-lastRip<110)return;if(ripple(e.clientX,e.clientY,.55))lastRip=now},{passive:true});
  addEventListener('pointerdown',e=>{ripple(e.clientX,e.clientY,1.1)},{passive:true});
  /* a hero shock-wave (click on the galaxy) also rings the ground */
  hero.addEventListener('pointerup',e=>{const b=canvas.getBoundingClientRect();if(e.clientY<b.top){uniforms.uR.value[ri%R].set((e.clientX/innerWidth-.5)*16,5,(performance.now()-t0)/1000,.7);ri++;energy=Math.min(1,energy+.3)}},{passive:true});
  function frame(now){raf=0;if(!visible||document.hidden)return;
   const paused=root.classList.contains('effects-paused');
   if(!paused&&!reduced.matches||!frame.done){uniforms.uTime.value=(now-t0)/1000;energy*=.965;uniforms.uEnergy.value=energy;uniforms.uLight.value=root.dataset.theme==='light'?1:0;const hz=window.BKHorizon;if(hz&&hz.w){uniforms.uDomeX.value=hz.ox/hz.w;uniforms.uLamp.value+=((hz.live?(.35+.65*(hz.lamp==null?.7:hz.lamp)):.25)-uniforms.uLamp.value)*.08}renderer.render(scene,camera);frame.done=true}
   if(!reduced.matches&&!paused)raf=requestAnimationFrame(frame)}
  function kick(){if(!raf)raf=requestAnimationFrame(frame)}
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)kick()});
  new MutationObserver(()=>{frame.done=false;kick()}).observe(root,{attributes:true,attributeFilter:['data-theme','class']});
  canvas.classList.add('on');kick();
 }
 const idle=f=>window.requestIdleCallback?requestIdleCallback(f,{timeout:1200}):setTimeout(f,200);
 if(document.readyState==='complete')idle(boot);else addEventListener('load',()=>idle(boot),{once:true});
})();
