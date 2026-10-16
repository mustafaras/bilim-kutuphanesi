'use strict';
/* Record-page constellation as a live 3D scene (v2).
   The DOM buttons (.rv-node) stay the accessible, clickable layer; this file draws the sky behind them with three.js:
   shader stars + drifting nebulae, a procedural corona star at the centre, banded glowing planets for every related record
   (fresnel atmosphere, orbit ring on hover), relation-coloured energy tubes with travelling pulses and particles, a cinematic
   dolly-in, hover focus (the camera leans toward the node, the rest dims) and drag-to-orbit with inertia.
   Labels are re-projected each frame. Dark = additive glow on deep space, light = ink and matte planets on parchment.
   Falls back to the static SVG when WebGL / motion is unavailable. */
(()=>{
 if(typeof document==='undefined'||typeof MutationObserver!=='function')return;
 const sheet=document.getElementById('recordSheet');if(!sheet)return;
 const root=document.documentElement,reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const hasGL=()=>{try{const c=document.createElement('canvas');return!!(c.getContext('webgl2')||c.getContext('webgl'))}catch{return false}};
 const REL={author:[232,206,158],year:[185,167,214],lang:[124,199,183],field:[159,184,200]};
 const REL_INK={author:[150,96,40],year:[104,82,160],lang:[26,128,108],field:[64,92,116]};
 let THREE=null,loading=null,cur=null;
 const load=()=>loading||(loading=import('./vendor/three.module.min.js').then(m=>{THREE=m;return m}).catch(()=>null));
 const rgb=a=>a.map(v=>v/255);
 const ease=x=>1-Math.pow(1-Math.min(1,Math.max(0,x)),3);
 const easeIO=x=>{x=Math.min(1,Math.max(0,x));return x<.5?4*x*x*x:1-Math.pow(-2*x+2,3)/2};
 const DIVE_MS=1250;

 function glowTexture(m,inner){const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d'),r=g.createRadialGradient(64,64,0,64,64,64);r.addColorStop(0,'rgba(255,255,255,1)');r.addColorStop(inner||.18,'rgba(255,255,255,.55)');r.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=r;g.fillRect(0,0,128,128);const t=new m.CanvasTexture(c);t.colorSpace=m.SRGBColorSpace;return t}
 /* cloudy nebula puff: many soft blobs on one canvas */
 function cloudTexture(m,seed){const c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d');let s=seed*9301+49297;const R=()=>{s=(s*9301+49297)%233280;return s/233280};
  for(let i=0;i<46;i++){const x=64+R()*128,y=64+R()*128,r=22+R()*58,a=.05+R()*.1,gr=g.createRadialGradient(x,y,0,x,y,r);gr.addColorStop(0,`rgba(255,255,255,${a})`);gr.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=gr;g.fillRect(0,0,256,256)}
  const t=new m.CanvasTexture(c);t.colorSpace=m.SRGBColorSpace;return t}
 /* planet bands tinted by the record's spine colour */
 function planetTexture(m,hex,seed){const c=document.createElement('canvas');c.width=256;c.height=128;const g=c.getContext('2d');let s=seed*7919+13;const R=()=>{s=(s*9301+49297)%233280;return s/233280};
  const base=new m.Color(hex);const rr=base.r*255|0,gg=base.g*255|0,bb=base.b*255|0;
  const gr=g.createLinearGradient(0,0,0,128);gr.addColorStop(0,`rgb(${rr*.55|0},${gg*.55|0},${bb*.55|0})`);gr.addColorStop(.5,`rgb(${Math.min(255,rr*1.15)|0},${Math.min(255,gg*1.15)|0},${Math.min(255,bb*1.15)|0})`);gr.addColorStop(1,`rgb(${rr*.5|0},${gg*.5|0},${bb*.5|0})`);g.fillStyle=gr;g.fillRect(0,0,256,128);
  for(let i=0;i<22;i++){const y=R()*128,h=2+R()*9;g.fillStyle=`rgba(${R()<.5?'255,255,255':'0,0,0'},${(.05+R()*.14).toFixed(3)})`;g.fillRect(0,y,256,h)}
  for(let i=0;i<30;i++){g.fillStyle=`rgba(255,255,255,${(R()*.12).toFixed(3)})`;g.beginPath();g.ellipse(R()*256,R()*128,6+R()*18,1+R()*3,0,0,7);g.fill()}
  const t=new m.CanvasTexture(c);t.colorSpace=m.SRGBColorSpace;t.wrapS=m.RepeatWrapping;return t}

 const STAR_V=`attribute float aS,aT;attribute vec3 aC;uniform float uTime,uPx;varying vec3 vC;varying float vA;
  void main(){vec4 mv=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mv;float tw=.55+.45*sin(uTime*(.6+aT*2.2)+aT*40.);gl_PointSize=aS*uPx*(300./-mv.z)*(.7+.5*tw);vC=aC;vA=tw;}`;
 const STAR_F=`uniform float uLight,uOpacity;varying vec3 vC;varying float vA;void main(){vec2 p=gl_PointCoord-.5;float d=length(p);float core=smoothstep(.5,0.,d);float spike=max(0.,1.-abs(p.x)*14.)*max(0.,1.-abs(p.y)*1.4)+max(0.,1.-abs(p.y)*14.)*max(0.,1.-abs(p.x)*1.4);float a=(core*core+spike*.25*step(.62,vA))*vA*uOpacity;if(a<.01)discard;gl_FragColor=vec4(vC,a);}`;
 const CORE_V=`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
 const CORE_F=`uniform float uTime,uLight,uHot;uniform vec3 uColor;varying vec2 vUv;
  void main(){vec2 p=(vUv-.5)*2.;float r=length(p),a=atan(p.y,p.x);
   float glow=exp(-r*4.2)*.75+exp(-r*11.)*1.0;
   float rays=(.5+.5*cos(a*7.+uTime*.35))*(.5+.5*cos(a*3.-uTime*.22))*exp(-r*2.6)*.9;
   float ring=exp(-pow((r-.46-.02*sin(uTime*1.3))*14.,2.))*(uLight>.5?.08:.35);
   float flick=1.+.07*sin(uTime*2.1)+.04*sin(uTime*5.3);
   float v=(glow+rays*(uLight>.5?.0:.8)+ring)*flick*(1.+uHot*.3);float alpha=clamp(v,0.,1.)*smoothstep(1.,.78,r);
   vec3 col=mix(vec3(1.,.96,.86),uColor,clamp(r*1.1,0.,1.))*(1.+glow*.3);
   if(uLight>.5){col=mix(vec3(.45,.27,.1),uColor*.55,clamp(r,0.,1.));alpha*=.55;}
   gl_FragColor=vec4(col,alpha);}`;
 const FRES_V=`varying vec3 vN,vV;void main(){vec4 mv=modelViewMatrix*vec4(position,1.);vN=normalize(normalMatrix*normal);vV=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}`;
 const FRES_F=`uniform vec3 uColor;uniform float uPow,uAmp;varying vec3 vN,vV;void main(){float f=pow(1.-max(0.,dot(vN,vV)),uPow);gl_FragColor=vec4(uColor,f*uAmp);}`;
 const TUBE_V=`varying float vU;varying float vF;void main(){vU=uv.x;vec4 mv=modelViewMatrix*vec4(position,1.);vF=pow(1.-abs(dot(normalize(normalMatrix*normal),normalize(-mv.xyz))),1.);gl_Position=projectionMatrix*mv;}`;
 const TUBE_F=`uniform float uTime,uHot,uDim,uLight,uPh;uniform vec3 uColor;varying float vU;varying float vF;
  void main(){float pulse=smoothstep(.0,.16,fract(vU*1.+uPh-uTime*.18))*smoothstep(.34,.16,fract(vU*1.+uPh-uTime*.18));
   float base=.16+.2*uHot;float a=(base+pulse*(.55+.5*uHot))*(.35+.65*vF)*uDim*(1.-.35*smoothstep(.85,1.,vU));
   gl_FragColor=vec4(uColor,clamp(a,0.,1.)*(uLight>.5?.9:1.));}`;


 /* Procedural planets lit by the central star. Four families (gas giant, terran world with oceans / continents / clouds / night-side city lights, desert, ice) are told apart by hashing the record, tinted by its spine colour. */
 const PLN_V=`varying vec3 vP,vN,vV;void main(){vP=position;vN=normalize(normalMatrix*normal);vec4 mv=modelViewMatrix*vec4(position,1.);vV=mv.xyz;gl_Position=projectionMatrix*mv;}`;
 const PLN_F=`uniform float uTime,uLight,uType,uSeed,uRot,uHot;uniform vec3 uSun,uC1,uC2,uC3,uAtm;varying vec3 vP,vN,vV;
  float h3(vec3 p){p=fract(p*.3183099+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
  float n3(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);
   return mix(mix(mix(h3(i),h3(i+vec3(1,0,0)),f.x),mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x),f.y),mix(mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x),mix(h3(i+vec3(0,1,1)),h3(i+vec3(1,1,1)),f.x),f.y),f.z);}
  float fbm(vec3 p){float a=.5,s=0.;for(int i=0;i<5;i++){s+=a*n3(p);p=p*2.03+7.1;a*=.5;}return s;}
  vec3 rotY(vec3 p,float a){float c=cos(a),s=sin(a);return vec3(c*p.x+s*p.z,p.y,-s*p.x+c*p.z);}
  void main(){
   vec3 N=normalize(vN),V=normalize(-vV),L=normalize(uSun-vV);
   vec3 q=normalize(rotY(normalize(vP),uTime*uRot));float lat=q.y;
   vec3 col=uC1;float land=0.,cloud=0.;
   if(uType<.5){
    float w=fbm(vec3(q.x*2.,lat*5.,q.z*2.)+uSeed);
    float band=sin(lat*(9.+fract(uSeed)*9.)+w*3.4)*.5+.5;
    float fine=fbm(vec3(q.x*8.,lat*30.,q.z*8.)+uSeed*2.);
    col=mix(uC1,uC2,band);col=mix(col,uC3,smoothstep(.55,.85,fine)*.55);col*=.84+.3*fine;
    vec3 sd=normalize(vec3(.62,-.3,.72));float st=smoothstep(.985,.996,dot(q,sd));col=mix(col,uC3*1.25,st*.75);
   }else if(uType<1.5){
    float e=fbm(q*2.4+uSeed);land=smoothstep(.5,.545,e);
    vec3 ocean=mix(uC1*.5,uC1*1.25,smoothstep(.28,.5,e));
    vec3 ground=mix(uC2,uC3,smoothstep(.54,.78,fbm(q*5.+uSeed)));ground*=.8+.4*fbm(q*14.+uSeed);
    col=mix(ocean,ground,land);float ice=smoothstep(.74,.9,abs(lat)+(e-.5)*.28);col=mix(col,vec3(.93,.96,1.),ice);land*=1.-ice;
    cloud=smoothstep(.5,.82,fbm(rotY(q,uTime*.012)*3.3+uSeed*5.))*.88;
   }else if(uType<2.5){
    float e=fbm(q*3.+uSeed);float r=abs(n3(q*7.+uSeed)-.5);
    col=mix(uC1,uC2,e);col=mix(col,uC3,smoothstep(.16,0.,r)*.65);col*=.78+.4*fbm(q*16.+uSeed);
   }else{
    float e=fbm(q*4.+uSeed);float r=abs(fbm(q*6.+uSeed*3.)-.5);
    col=mix(uC1,uC2,e);col=mix(col,uC3*.55,smoothstep(.06,0.,r)*.75);col+=.08*fbm(q*20.+uSeed);
   }
   float nl=dot(N,L),day=smoothstep(-.1,.42,nl);
   vec3 amb=mix(vec3(.055,.07,.12),vec3(.24,.24,.27),uLight);
   vec3 lit=col*(amb+day*vec3(1.08,1.0,.9)*1.3);
   if(uType>.5&&uType<1.5){
    lit=mix(lit,(amb*3.+day*vec3(1.1,1.08,1.04)),cloud);
    float cities=step(.735,fbm(q*24.+uSeed))*land*(1.-cloud)*smoothstep(.18,-.22,nl);lit+=cities*vec3(1.,.78,.42)*1.1;
    vec3 R=reflect(-L,N);float sp=pow(max(dot(R,V),0.),52.)*(1.-land)*day*(1.-cloud);lit+=sp*.8;
   }
   float f=pow(1.-max(dot(N,V),0.),3.2),term=exp(-nl*nl*9.);vec3 atm=mix(uAtm,vec3(1.,.52,.26),term*.55);
   lit+=atm*f*(.12+day*.95);
   lit*=1.+uHot*.16;
   gl_FragColor=vec4(lit,1.);}`;
 const RING_V=`varying vec2 vR;varying vec3 vV;void main(){vR=position.xy;vec4 mv=modelViewMatrix*vec4(position,1.);vV=mv.xyz;gl_Position=projectionMatrix*mv;}`;
 const RING_F=`uniform float uIn,uOut,uSeed,uLight;uniform vec3 uC,uSun;varying vec2 vR;varying vec3 vV;
  float hh(float x){return fract(sin(x*127.1+uSeed*31.7)*43758.5453);}
  float nz(float x){float i=floor(x),f=fract(x);f=f*f*(3.-2.*f);return mix(hh(i),hh(i+1.),f);}
  void main(){float r=(length(vR)-uIn)/(uOut-uIn);if(r<0.||r>1.)discard;
   float b=.6*nz(r*26.)+.3*nz(r*70.)+.1*nz(r*150.);
   float gap=1.-smoothstep(.05,0.,abs(r-.62))*.9;
   float a=smoothstep(0.,.06,r)*smoothstep(1.,.86,r)*(.2+.62*b)*gap;
   vec3 col=uC*(.6+.7*b);col=mix(col*.55,col,smoothstep(-.4,.4,dot(normalize(uSun-vV),vec3(0.,1.,.0))+.4));
   gl_FragColor=vec4(col,a*mix(.95,.8,uLight));}`;

 function mount(box){
  if(cur&&cur.box===box)return;if(cur)cur.destroy();
  if(!hasGL()||reduced.matches)return;
  const nodes=[...box.querySelectorAll('.rv-node')];if(!nodes.length)return;
  load().then(m=>{
   if(!m||!box.isConnected||(cur&&cur.box===box))return;
   const W=1000,H=560,CX=500,CY=284;
   const canvas=document.createElement('canvas');canvas.className='rv-gl';canvas.setAttribute('aria-hidden','true');box.insertBefore(canvas,box.firstChild);
   let renderer;try{renderer=new m.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'high-performance'})}catch{canvas.remove();return}
   renderer.setClearColor(0,0);const PR=Math.min(devicePixelRatio||1,1.75);renderer.setPixelRatio(PR);
   const scene=new m.Scene(),camera=new m.PerspectiveCamera(38,1,10,4000),world=new m.Group(),sky=new m.Group();scene.add(sky,world);
   const glow=glowTexture(m);
   const light=()=>root.dataset.theme==='light';
   const items=nodes.map((el,i)=>{const kind=(el.className.match(/rel-(author|year|lang|field)/)||[])[1]||'field';
    const lx=parseFloat(el.style.left)/100*W-CX,ly=parseFloat(el.style.top)/100*H-CY;
    const spine=getComputedStyle(el).getPropertyValue('--spine').trim()||'#e8ce9e';
    return{el,kind,i,spine,base:new m.Vector3(lx,-ly,((i*73%11)-5)*30),ph:i*1.7,sc:0,hot:0}});
   box.classList.add('rv-3d');box.dataset.hint=typeof t==='function'?t('rvDragHint'):'';
   const sU={uTime:{value:0},uPx:{value:PR},uLight:{value:0},uOpacity:{value:1}};
   /* stars: three depth shells, colour temperature varies */
   const starN=420,sp=new Float32Array(starN*3),sc=new Float32Array(starN*3),ss=new Float32Array(starN),st=new Float32Array(starN),temp=new Float32Array(starN);
   for(let k=0;k<starN;k++){const shell=k%3;sp[k*3]=(Math.random()-.5)*1500;sp[k*3+1]=(Math.random()-.5)*860;sp[k*3+2]=-80-shell*190-Math.random()*160;ss[k]=(shell===0?2.6:shell===1?1.8:1.2)*(.6+Math.random()*.9);st[k]=Math.random();temp[k]=Math.random()}
   const sg=new m.BufferGeometry();sg.setAttribute('position',new m.BufferAttribute(sp,3));sg.setAttribute('aS',new m.BufferAttribute(ss,1));sg.setAttribute('aT',new m.BufferAttribute(st,1));sg.setAttribute('aC',new m.BufferAttribute(sc,3));
   const starMat=new m.ShaderMaterial({uniforms:sU,vertexShader:STAR_V,fragmentShader:STAR_F,transparent:true,depthWrite:false});
   const stars=new m.Points(sg,starMat);stars.frustumCulled=false;sky.add(stars);
   /* nebulae */
   const neb=[[-300,70,-340,900,[80,120,200],1],[320,-90,-380,860,[200,140,80],2],[0,170,-460,1000,[120,90,180],3],[-120,-160,-300,700,[60,160,150],4]].map(([x,y,z,s,c,sd])=>{const mat=new m.SpriteMaterial({map:cloudTexture(m,sd),transparent:true,depthWrite:false,opacity:.2,color:new m.Color(...rgb(c))});const sp2=new m.Sprite(mat);sp2.position.set(x,y,z);sp2.scale.set(s,s*.7,1);sky.add(sp2);return{s:sp2,c,rot:(sd%2?1:-1)*.012*sd}});
   /* the record itself: a corona star */
   const coreU={uTime:{value:0},uLight:{value:0},uHot:{value:0},uColor:{value:new m.Color(0xe8ce9e)}};
   const core=new m.Mesh(new m.PlaneGeometry(250,250),new m.ShaderMaterial({uniforms:coreU,vertexShader:CORE_V,fragmentShader:CORE_F,transparent:true,depthWrite:false}));world.add(core);
   /* anamorphic lens streak through the star (screen-horizontal, dark theme only) */
   const streak=new m.Sprite(new m.SpriteMaterial({map:glow,transparent:true,depthWrite:false,blending:m.AdditiveBlending,opacity:.3,color:new m.Color(1,.9,.72)}));streak.scale.set(900,20,1);scene.add(streak);
   const rings=[120,205].map((r,i)=>{const pts=[];for(let a=0;a<=96;a++){const tt=a/96*Math.PI*2;pts.push(new m.Vector3(Math.cos(tt)*r,Math.sin(tt)*r*.62,0))}const l=new m.Line(new m.BufferGeometry().setFromPoints(pts),new m.LineBasicMaterial({transparent:true,opacity:.2,depthWrite:false}));l.rotation.x=.5+i*.25;l.rotation.z=i*.6;world.add(l);return l});
   /* planets */
   const planetShared={uTime:{value:0},uLight:{value:0},uSun:{value:new m.Vector3()}};
   const hashStr=str=>{let hh=2166136261;for(let k=0;k<str.length;k++){hh^=str.charCodeAt(k);hh=Math.imul(hh,16777619)}return(hh>>>0)};
   const srgb=c=>c.clone().convertLinearToSRGB();
   const TYPE_OF=[0,1,2,3,1,0,2,3];
   const planets=items.map(it=>{const g=new m.Group();g.position.copy(it.base);world.add(g);
    const hs=hashStr(it.spine+'|'+it.i+'|'+it.kind),type=TYPE_OF[(hs+it.i)%8],r0=19+(it.kind==='author'?3:0)+(it.i%3)*1.6;
    const sp=new m.Color(it.spine),hsl={};sp.getHSL(hsl);const tint=(dh,l,sat)=>new m.Color().setHSL((hsl.h+dh+1)%1,Math.min(1,.35+hsl.s*.4+sat),l);
    let c1,c2,c3,atmC;
    if(type===0){c1=tint(0,.42,.1);c2=tint(.07,.7,.0);c3=tint(-.08,.3,.15);atmC=tint(0,.7,0)}
    else if(type===1){c1=new m.Color().setHSL(.58,.62,.28).lerp(sp,.18);c2=new m.Color().setHSL(.3,.45,.3).lerp(sp,.25);c3=new m.Color().setHSL(.1,.4,.42).lerp(sp,.2);atmC=new m.Color(.35,.6,1)}
    else if(type===2){c1=tint(.02,.5,.1);c2=tint(.05,.66,.0);c3=tint(-.05,.26,.12);atmC=tint(.04,.75,0)}
    else{c1=new m.Color().setHSL(.56,.45,.68).lerp(sp,.12);c2=new m.Color().setHSL(.58,.35,.88);c3=new m.Color().setHSL(.6,.6,.42);atmC=new m.Color(.6,.85,1)}
    const U={...planetShared,uType:{value:type},uSeed:{value:(hs%997)/37},uRot:{value:.05+(hs%7)*.012},uHot:{value:0},uC1:{value:srgb(c1)},uC2:{value:srgb(c2)},uC3:{value:srgb(c3)},uAtm:{value:srgb(atmC)}};
    const body=new m.Mesh(new m.SphereGeometry(r0,64,48),new m.ShaderMaterial({uniforms:U,vertexShader:PLN_V,fragmentShader:PLN_F}));g.add(body);
    /* ring system on some gas giants */
    let ring=null;if(type===0&&(hs%3)!==0){const rgu={uIn:{value:r0*1.38},uOut:{value:r0*2.35},uSeed:{value:(hs%53)/7},uLight:planetShared.uLight,uC:{value:srgb(c2.clone().lerp(new m.Color(1,.95,.85),.35))},uSun:planetShared.uSun};
     ring=new m.Mesh(new m.RingGeometry(r0*1.38,r0*2.35,128,1),new m.ShaderMaterial({uniforms:rgu,vertexShader:RING_V,fragmentShader:RING_F,transparent:true,depthWrite:false,side:m.DoubleSide}));ring.rotation.x=Math.PI/2-.42+(hs%5)*.05;ring.rotation.z=.25+(hs%9)*.1;g.add(ring)}
    const atmoU={uColor:{value:atmC.clone()},uPow:{value:2.6},uAmp:{value:.9}};
    const atmo=new m.Mesh(new m.SphereGeometry(r0*1.16,40,28),new m.ShaderMaterial({uniforms:atmoU,vertexShader:FRES_V,fragmentShader:FRES_F,transparent:true,depthWrite:false,blending:m.AdditiveBlending,side:m.FrontSide}));g.add(atmo);
    const halo=new m.Sprite(new m.SpriteMaterial({map:glow,transparent:true,depthWrite:false,color:atmC.clone()}));halo.scale.set(r0*5,r0*5,1);g.add(halo);
    const op=[];for(let a=0;a<=64;a++){const tt=a/64*Math.PI*2;op.push(new m.Vector3(Math.cos(tt)*r0*1.9,Math.sin(tt)*r0*1.9*.4,0))}
    const orbit=new m.LineLoop(new m.BufferGeometry().setFromPoints(op),new m.LineBasicMaterial({color:atmC.clone(),transparent:true,opacity:0,depthWrite:false}));orbit.rotation.x=.9;orbit.rotation.z=.4+it.i*.5;g.add(orbit);
    /* moons: always orbiting, lit by the same star */
    const moons=[];const mn=1+(hs%3===0?1:0)+(type===1?1:0);for(let k=0;k<mn;k++){const mr=r0*(.14+((hs>>k)%5)*.02),mm=new m.Mesh(new m.SphereGeometry(mr,24,18),new m.MeshStandardMaterial({color:new m.Color().setHSL(.08+k*.05,.08,.62),roughness:.9,metalness:0}));g.add(mm);moons.push({mesh:mm,rad:r0*(1.9+k*.55),sp:.35+((hs>>(k+3))%6)*.08,ph:k*2.1+(hs%7),inc:.35+k*.3})}
    return{g,body,ring,atmo,atmoU,halo,orbit,moons,r0,U}});
   /* energy tubes: base curve + pulses; particles ride the same curve */
   const FLOW=10,edges=items.map(it=>{const mid=it.base.clone().multiplyScalar(.5);mid.z+=44;mid.y+=(it.i%2?1:-1)*Math.min(50,it.base.length()*.17);
    const curve=new m.QuadraticBezierCurve3(new m.Vector3(0,0,0),mid,it.base.clone());
    const tu={uTime:{value:0},uHot:{value:0},uDim:{value:1},uLight:{value:0},uPh:{value:it.i*.21},uColor:{value:new m.Color()}};
    const tube=new m.Mesh(new m.TubeGeometry(curve,56,1.15,6,false),new m.ShaderMaterial({uniforms:tu,vertexShader:TUBE_V,fragmentShader:TUBE_F,transparent:true,depthWrite:false,side:m.DoubleSide}));world.add(tube);
    return{it,curve,tube,tu}});
   const fN=items.length*FLOW,fp=new Float32Array(fN*3),fc=new Float32Array(fN*3),dotT=(()=>{const c=document.createElement('canvas');c.width=c.height=32;const g=c.getContext('2d'),r=g.createRadialGradient(16,16,0,16,16,16);r.addColorStop(0,'rgba(255,255,255,1)');r.addColorStop(.4,'rgba(255,255,255,.8)');r.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=r;g.fillRect(0,0,32,32);return new m.CanvasTexture(c)})();
   const fg=new m.BufferGeometry();fg.setAttribute('position',new m.BufferAttribute(fp,3));fg.setAttribute('color',new m.BufferAttribute(fc,3));
   const fm=new m.PointsMaterial({size:4.6,sizeAttenuation:false,map:dotT,transparent:true,depthWrite:false,vertexColors:true,opacity:.95});world.add(new m.Points(fg,fm));
   /* shooting dust: tiny motes drifting through the scene */
   const dN=70,dp=new Float32Array(dN*3),dv=new Float32Array(dN*3);for(let k=0;k<dN;k++){dp[k*3]=(Math.random()-.5)*900;dp[k*3+1]=(Math.random()-.5)*500;dp[k*3+2]=(Math.random()-.5)*260;dv[k*3]=(Math.random()-.5)*6;dv[k*3+1]=(Math.random()-.5)*3;dv[k*3+2]=0}
   const dg=new m.BufferGeometry();dg.setAttribute('position',new m.BufferAttribute(dp,3));const dm=new m.PointsMaterial({size:2.2,sizeAttenuation:false,map:dotT,transparent:true,depthWrite:false,opacity:.5});world.add(new m.Points(dg,dm));
   /* lights for planets */
   const keyL=new m.DirectionalLight(0xfff0d6,2.2);keyL.position.set(-300,260,420);scene.add(keyL);const rimL=new m.DirectionalLight(0x9fc4ff,.9);rimL.position.set(400,-100,-200);scene.add(rimL);scene.add(new m.AmbientLight(0xffffff,.35));
   const coreLight=new m.PointLight(0xffe2b0,60000,0,2);world.add(coreLight);

   let ptr={x:0,y:0},ptrYaw=0,ptrPitch=0,w=1,h=1,yaw=0,pitch=0,vyaw=0,vpitch=0,tyaw=0,tpitch=0,drag=null,hover=-1,declFrame=0,declHover=-2,raf=0,visible=true,t0=performance.now(),idle=true,lastTheme='',leanX=0,leanY=0,distK=1;
   const resize=()=>{const r=box.getBoundingClientRect();w=Math.max(2,r.width);h=Math.max(2,r.height);renderer.setSize(w,h,false);camera.aspect=w/h;
    const visH=Math.max(H,W/camera.aspect)*1.02,d=(visH/2)/Math.tan(camera.fov*Math.PI/360);camera.userData.d=d;camera.position.set(0,0,d);camera.updateProjectionMatrix();camera.lookAt(0,0,0)};
   const ro=typeof ResizeObserver==='function'?new ResizeObserver(resize):null;if(ro)ro.observe(box);resize();

   const v=new m.Vector3(),tmpC=new m.Color();
   function applyTheme(){const lt=light();lastTheme=lt?'l':'d';const add=lt?m.NormalBlending:m.AdditiveBlending;
    sU.uLight.value=lt?1:0;coreU.uLight.value=lt?1:0;starMat.blending=add;starMat.needsUpdate=true;
    for(let k=0;k<starN;k++){const b=.5+Math.random()*.5,w2=temp[k];const c=lt?[.2*b,.27*b,.36*b]:(w2<.3?[1*b,.82*b,.62*b]:w2<.7?[.9*b,.94*b,1*b]:[.7*b,.8*b,1*b]);sc[k*3]=c[0];sc[k*3+1]=c[1];sc[k*3+2]=c[2]}sg.attributes.aC.needsUpdate=true;
    sU.uOpacity.value=lt?.7:1;
    neb.forEach(n=>{n.s.material.blending=add;n.s.material.opacity=lt?.11:.2;n.s.material.color.setRGB(...rgb(lt?[n.c[0]*.7+60,n.c[1]*.7+50,n.c[2]*.7+30]:n.c));n.s.material.needsUpdate=true});
    rings.forEach(r=>r.material.color.setRGB(...(lt?[.2,.28,.36]:[.98,.96,.92])));
    coreU.uColor.value.setRGB(...(lt?[.62,.38,.18]:[.91,.81,.62]));core.material.blending=add;core.material.needsUpdate=true;
    planets.forEach((p,i)=>{p.atmo.material.blending=add;p.atmo.material.needsUpdate=true;p.atmoU.uAmp.value=lt?.55:1.1;p.halo.material.blending=add;p.halo.material.opacity=lt?.22:.5;p.halo.material.needsUpdate=true;p.U.uLight.value=lt?1:0});planetShared.uLight.value=lt?1:0;
    edges.forEach(e=>{const c=(lt?REL_INK:REL)[e.it.kind];e.tu.uColor.value.setRGB(...rgb(c));e.tu.uLight.value=lt?1:0;e.tube.material.blending=add;e.tube.material.needsUpdate=true});
    fm.blending=add;fm.needsUpdate=true;dm.blending=add;dm.color.setHex(lt?0x13283a:0xffffff);dm.opacity=lt?.35:.5;dm.needsUpdate=true;
    coreLight.intensity=lt?25000:60000;keyL.intensity=lt?2.4:2.0;rimL.intensity=lt?.4:.9}
   function paint(now){
    const time=(now-t0)/1000,lt=light(),dt=Math.min(.05,(now-(paint.l||now))/1000);paint.l=now;
    if(lastTheme!==(lt?'l':'d'))applyTheme();
    const intro=ease(time/2.1);
    sU.uTime.value=time;coreU.uTime.value=time;
    /* orbit: drag + inertia + idle sway */
    if(!drag){tyaw+=vyaw;tpitch+=vpitch;vyaw*=.93;vpitch*=.93;tyaw=Math.max(-.9,Math.min(.9,tyaw));tpitch=Math.max(-.5,Math.min(.5,tpitch));
     if(idle){tyaw+=((Math.sin(time*.22)*.2)-tyaw)*.006;tpitch+=((Math.cos(time*.17)*.07)-tpitch)*.006}}
    yaw+=(tyaw-yaw)*.12;pitch+=(tpitch-pitch)*.12;ptrYaw+=((drag?0:ptr.x*.16)-ptrYaw)*Math.min(1,dt*2.2);ptrPitch+=((drag?0:ptr.y*.09)-ptrPitch)*Math.min(1,dt*2.2);
    world.rotation.y=yaw+ptrYaw;world.rotation.x=pitch+ptrPitch;sky.rotation.y=-(yaw+ptrYaw)*.4;sky.rotation.x=-(pitch+ptrPitch)*.4;
    neb.forEach(n=>{n.s.material.rotation+=n.rot*dt});
    rings.forEach((r,i)=>{r.rotation.z+=.0012*(i?-1:1)});
    /* hover focus: camera leans toward the node, dist eases in */
    const hv=hover>=0?items[hover]:null,tl=hv?hv.base:null;
    const lx=tl?tl.x*.08:0,ly=tl?tl.y*.08:0;leanX+=(lx-leanX)*Math.min(1,dt*3);leanY+=(ly-leanY)*Math.min(1,dt*3);distK+=((hv?.9:1)-distK)*Math.min(1,dt*3);
    const d=camera.userData.d*(1.25-.25*intro)*distK;camera.position.set(leanX,leanY,d);camera.lookAt(leanX*.5,leanY*.5,0);
    let dk=0;
    if(dive){const raw=(now-dive.t)/DIVE_MS;dk=easeIO(raw);v.copy(items[dive.i].base).applyMatrix4(world.matrixWorld);
     /* fly along a gentle arc: ease in-out toward the planet, field of view opens slightly as it fills the frame */
     const tx=v.x,ty=v.y,tz=v.z+64;camera.position.set(camera.position.x+(tx-camera.position.x)*dk,camera.position.y+(ty-camera.position.y)*dk,camera.position.z+(tz-camera.position.z)*dk);
     camera.lookAt(v.x*dk+leanX*.5*(1-dk),v.y*dk+leanY*.5*(1-dk),0);const fov=38+10*dk;if(Math.abs(camera.fov-fov)>.01){camera.fov=fov;camera.updateProjectionMatrix()}
     coreU.uHot.value=1+dk;
     if(raw>.62&&!dive.fade){dive.fade=true;sheet.classList.add('rv-leaving')}
     if(raw>=1)finishDive()}
    const pulse=1+.06*Math.sin(time*2.1);core.scale.set(pulse*(.6+.4*intro),pulse*(.6+.4*intro),1);core.lookAt(camera.position);coreU.uHot.value+=((hv?1:0)-coreU.uHot.value)*Math.min(1,dt*4);
    /* planets */
    planets.forEach((p,i)=>{const it=items[i],on=hover===i,tgt=on?1:0;it.hot+=(tgt-it.hot)*Math.min(1,dt*6);
     const born=ease((time-.35-i*.09)/.9);it.sc=born;const chosen=dive&&dive.i===i,s=born*(1+it.hot*.28)*(chosen?1+dk*.5:1-dk*.65);p.g.scale.setScalar(Math.max(.001,s));
     p.U.uHot.value=it.hot;p.orbit.material.opacity=it.hot*.7;p.orbit.rotation.z+=dt*.5;if(p.ring)p.ring.rotation.z+=dt*.012;
     p.moons.forEach(mo=>{const a=time*mo.sp+mo.ph;mo.mesh.position.set(Math.cos(a)*mo.rad,Math.sin(a)*mo.rad*Math.sin(mo.inc),Math.sin(a)*mo.rad*Math.cos(mo.inc))});
     const dim=hover>=0&&!on?.35:1;p.halo.material.opacity=(lt?.22:.5)*(.7+it.hot*.7)*dim;p.atmoU.uAmp.value=(lt?.55:1.1)*(.8+it.hot*.9);p.g.position.y=it.base.y+Math.sin(time*.8+it.ph)*3;});
    /* energy tubes */
    edges.forEach((e,ei)=>{e.tu.uTime.value=time;e.tu.uHot.value+=((hover===ei?1:0)-e.tu.uHot.value)*Math.min(1,dt*6);e.tu.uDim.value+=((hover>=0&&hover!==ei?.35:1)*intro*(1-dk)-e.tu.uDim.value)*Math.min(1,dt*6)});
    let k=0;edges.forEach((e,ei)=>{const hot=hover===ei,c=(lt?REL_INK:REL)[e.it.kind],spd=.07+(hot?.1:0);
     for(let j=0;j<FLOW;j++){const u=((time*spd+j/FLOW+ei*.13)%1);e.curve.getPoint(u,v);fp[k*3]=v.x;fp[k*3+1]=v.y;fp[k*3+2]=v.z;const a=Math.sin(u*Math.PI)*(hover<0||hot?1:.25)*intro*(1-dk);fc[k*3]=c[0]/255*a;fc[k*3+1]=c[1]/255*a;fc[k*3+2]=c[2]/255*a;k++}});
    fg.attributes.position.needsUpdate=true;fg.attributes.color.needsUpdate=true;
    for(let q=0;q<dN;q++){dp[q*3]+=dv[q*3]*dt;dp[q*3+1]+=dv[q*3+1]*dt;if(dp[q*3]>450)dp[q*3]=-450;if(dp[q*3]<-450)dp[q*3]=450;if(dp[q*3+1]>250)dp[q*3+1]=-250;if(dp[q*3+1]<-250)dp[q*3+1]=250}dg.attributes.position.needsUpdate=true;
    world.updateMatrixWorld(true);camera.updateMatrixWorld();planetShared.uTime.value=time;streak.position.setFromMatrixPosition(core.matrixWorld);streak.material.opacity=(lt?0:.3)*intro*(1+coreU.uHot.value*.5);planetShared.uSun.value.setFromMatrixPosition(core.matrixWorld).applyMatrix4(camera.matrixWorldInverse);
    /* re-project the DOM layer */
    items.forEach((it,i)=>{v.copy(it.base).applyMatrix4(world.matrixWorld).project(camera);const x=(v.x*.5+.5)*100,y=(1-(v.y*.5+.5))*100;it.el.style.left=x.toFixed(2)+'%';it.el.style.top=y.toFixed(2)+'%';it.el.style.zIndex=String(Math.round((1-v.z)*500));it.el.style.opacity=String(Math.min(1,it.sc*1.2)*(hover>=0&&hover!==i?.55:1)*(dive?(dive.i===i?1-Math.max(0,dk-.55)*2.2:1-Math.min(1,dk*1.8)):1))});
    /* label collision avoidance (every 6th frame / on hover change): hovered > nearer to camera; the loser is hidden, never overlapped */
    if(window.BKText&&(++declFrame%6===0||declHover!==hover)){declHover=hover;const bw=box.clientWidth,bh=box.clientHeight,list=[];
     items.forEach((it,i)=>{const lb=it.lab||(it.lab=it.el.querySelector('.rv-node-label'));if(!lb)return;const px=parseFloat(it.el.style.left)/100*bw,py=parseFloat(it.el.style.top)/100*bh;
      list.push({el:lb,x:px,y:py+15+22,w:lb.offsetWidth||80,h:lb.offsetHeight||22,prio:(hover===i||it.el.matches(':hover,:focus-visible')?1e6:0)+parseFloat(it.el.style.zIndex||0)})});
     window.BKText.declutter(list,3)}
    renderer.render(scene,camera)}
   function loop(now){raf=0;if(!visible||document.hidden||!box.isConnected){if(!box.isConnected)destroy();return}paint(now);raf=requestAnimationFrame(loop)}
   const kick=()=>{if(!raf)raf=requestAnimationFrame(loop)};
   const io=typeof IntersectionObserver==='function'?new IntersectionObserver(es=>{visible=es[0].isIntersecting;if(visible)kick()},{threshold:0}):null;if(io)io.observe(box);
   const onVis=()=>{if(!document.hidden)kick()};document.addEventListener('visibilitychange',onVis);

   /* interaction */
   const down=e=>{if(e.target.closest&&e.target.closest('.rv-node'))return;drag={x:e.clientX,y:e.clientY};idle=false;vyaw=vpitch=0;try{box.setPointerCapture(e.pointerId)}catch{}box.classList.add('dragging')};
   const move=e=>{if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;drag.x=e.clientX;drag.y=e.clientY;vyaw=dx*.0035;vpitch=dy*.0028;tyaw+=vyaw;tpitch+=vpitch};
   const up=()=>{if(!drag)return;drag=null;box.classList.remove('dragging');setTimeout(()=>{idle=true},2600)};
   box.addEventListener('pointermove',e=>{if(drag)return;const r=box.getBoundingClientRect();ptr.x=((e.clientX-r.left)/Math.max(1,r.width)-.5)*2;ptr.y=((e.clientY-r.top)/Math.max(1,r.height)-.5)*2},{passive:true});box.addEventListener('pointerleave',()=>{ptr.x=ptr.y=0});
   box.addEventListener('pointerdown',down);box.addEventListener('pointermove',move);box.addEventListener('pointerup',up);box.addEventListener('pointercancel',up);
   box.addEventListener('dblclick',()=>{tyaw=0;tpitch=0;vyaw=vpitch=0});
   let dive=null;
   /* ends the fly-in: hands the click back to the record router, then lets the new record fade in. Also runs from a timer so a hidden tab / offscreen canvas can never leave a click hanging. */
   function finishDive(){if(!dive||dive.go)return;dive.go=true;clearTimeout(dive.timer);const it=items[dive.i];sheet.classList.add('rv-leaving');it.go=true;it.el.click();setTimeout(()=>sheet.classList.remove('rv-leaving'),240)}
   items.forEach((it,i)=>{it.el.addEventListener('click',e=>{if(it.go){it.go=false;return}if(dive||reduced.matches)return;e.preventDefault();e.stopImmediatePropagation();dive={i,t:performance.now(),timer:setTimeout(finishDive,DIVE_MS+450)};box.classList.add('warp')},true)});
   items.forEach((it,i)=>{const on=()=>{hover=i;it.el.classList.add('hot')},off=()=>{if(hover===i)hover=-1;it.el.classList.remove('hot')};it.el.addEventListener('mouseenter',on);it.el.addEventListener('focus',on);it.el.addEventListener('mouseleave',off);it.el.addEventListener('blur',off);
    it.el.addEventListener('pointerdown',()=>{box.classList.add('warp')},{capture:true})});
   const kb=e=>{if(!box.contains(document.activeElement))return;const k=e.key;if(k==='ArrowLeft'&&e.shiftKey)tyaw-=.12;else if(k==='ArrowRight'&&e.shiftKey)tyaw+=.12;else if(k==='ArrowUp'&&e.shiftKey)tpitch-=.1;else if(k==='ArrowDown'&&e.shiftKey)tpitch+=.1;else return;e.preventDefault()};
   box.addEventListener('keydown',kb);

   function destroy(){if(raf)cancelAnimationFrame(raf);raf=0;if(ro)ro.disconnect();if(io)io.disconnect();document.removeEventListener('visibilitychange',onVis);
    scene.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material){(Array.isArray(o.material)?o.material:[o.material]).forEach(x=>{if(x.map)x.map.dispose();x.dispose()})}});glow.dispose();dotT.dispose();
    try{renderer.dispose();renderer.forceContextLoss()}catch{}canvas.remove();sheet.classList.remove('rv-leaving');box.classList.remove('rv-3d','dragging','warp');items.forEach(it=>{it.el.style.zIndex='';it.el.style.opacity=''});if(cur&&cur.box===box)cur=null}
   applyTheme();cur={box,destroy};kick()})}

 function scan(){const box=sheet.querySelector('.rv-constellation');if(box)mount(box);else if(cur&&!cur.box.isConnected){cur.destroy()}}
 new MutationObserver(scan).observe(sheet,{childList:true});scan();
 const rv=document.getElementById('recordView');if(rv)new MutationObserver(()=>{if(rv.hidden&&cur)cur.destroy()}).observe(rv,{attributes:true,attributeFilter:['hidden']});
})();
