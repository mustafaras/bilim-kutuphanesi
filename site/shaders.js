'use strict';
/* BKShaders — the one shared GLSL part library (A3). Versioned chunks, injected as strings; every function carries the bk_ prefix and exists ONCE (tools/shaders_audit.py).
   • use('hash','noise',...) → GLSL text of those chunks and everything they depend on, each once, dependencies first (the include mechanism: three's ShaderMaterial and onBeforeCompile both take plain strings)
   • inject(src,...names) → src with the chunks placed after `#include <common>` (for onBeforeCompile on built-in materials)
   • key(tag,...names) / hook(material,tag,fn,...names) → program cache key discipline: a material that patches its shader (onBeforeCompile) ALWAYS sets customProgramCacheKey with it; hook() does both.
     Without a key three derives it from the function text, so two materials with different captured data but the same source would silently share one program.
   • chunks: hash (hash11/12/13/33 + IGN dithering) · noise (simplex 2D/3D, curl, fbm) · lut3d (3D LUT sampling with half-texel correction) · blackbody (Planck colour, B-V → temperature → colour)
   • js: CPU twins for tests and for baking 1D tables (bakeBlackbody → the stars' temperature LUT texture; the caller makes the texture and disposes it)
   • selfTest(gl?): compiles every chunk in one fragment shader on a real context (the audit's B12 does it; nothing else would notice a typo in a part nobody uses yet) */
(()=>{
 const VERSION='1.0',C={},order=[];
 const add=(name,v,deps,src,probe)=>{C[name]={name,v,deps,src:src.trim(),probe};order.push(name)};

 add('hash',1,[],`
float bk_hash11(float p){p=fract(p*.1031);p*=p+33.33;p*=p+p;return fract(p);}
float bk_hash12(vec2 p){vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
float bk_hash13(vec3 q){q=fract(q*.1031);q+=dot(q,q.zyx+31.32);return fract((q.x+q.y)*q.z);}
vec3 bk_hash33(vec3 q){q=fract(q*vec3(.1031,.1030,.0973));q+=dot(q,q.yxz+33.33);return fract((q.xxy+q.yxx)*q.zyx);}
float bk_ign(vec2 px){return fract(52.9829189*fract(dot(px,vec2(.06711056,.00583715))));}`,'bk_hash12(vec2(1.5))+bk_hash11(2.)+bk_hash13(vec3(1.))+bk_hash33(vec3(2.)).x+bk_ign(vec2(3.))');

 add('noise',2,[],`
vec2 bk_m289v2(vec2 x){return x-floor(x*(1./289.))*289.;}
vec3 bk_m289v3(vec3 x){return x-floor(x*(1./289.))*289.;}
vec4 bk_m289v4(vec4 x){return x-floor(x*(1./289.))*289.;}
vec3 bk_perm3(vec3 x){return bk_m289v3(((x*34.)+1.)*x);}
vec4 bk_perm4(vec4 x){return bk_m289v4(((x*34.)+1.)*x);}
float bk_snoise2(vec2 v){
 const vec4 C=vec4(.211324865405187,.366025403784439,-.577350269189626,.024390243902439);
 vec2 i=floor(v+dot(v,C.yy));vec2 x0=v-i+dot(i,C.xx);
 vec2 i1=(x0.x>x0.y)?vec2(1.,0.):vec2(0.,1.);
 vec4 x12=x0.xyxy+C.xxzz;x12.xy-=i1;i=bk_m289v2(i);
 vec3 p=bk_perm3(bk_perm3(i.y+vec3(0.,i1.y,1.))+i.x+vec3(0.,i1.x,1.));
 vec3 m=max(.5-vec3(dot(x0,x0),dot(x12.xy,x12.xy),dot(x12.zw,x12.zw)),0.);m=m*m;m=m*m;
 vec3 x=2.*fract(p*C.www)-1.;vec3 h=abs(x)-.5;vec3 ox=floor(x+.5);vec3 a0=x-ox;
 m*=1.79284291400159-.85373472095314*(a0*a0+h*h);
 vec3 g;g.x=a0.x*x0.x+h.x*x0.y;g.yz=a0.yz*x12.xz+h.yz*x12.yw;
 return 130.*dot(m,g);}
float bk_snoise3(vec3 v){
 const vec2 C=vec2(1./6.,1./3.);const vec4 D=vec4(0.,.5,1.,2.);
 vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);
 vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.-g;vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);
 vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;
 i=bk_m289v3(i);
 vec4 p=bk_perm4(bk_perm4(bk_perm4(i.z+vec4(0.,i1.z,i2.z,1.))+i.y+vec4(0.,i1.y,i2.y,1.))+i.x+vec4(0.,i1.x,i2.x,1.));
 vec3 ns=.142857142857*D.wyz-D.xzx;
 vec4 j=p-49.*floor(p*ns.z*ns.z);
 vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.*x_);
 vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.-abs(x)-abs(y);
 vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);
 vec4 s0=floor(b0)*2.+1.;vec4 s1=floor(b1)*2.+1.;vec4 sh=-step(h,vec4(0.));
 vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
 vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);
 vec4 nr=1.79284291400159-.85373472095314*vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3));
 p0*=nr.x;p1*=nr.y;p2*=nr.z;p3*=nr.w;
 vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.);m=m*m;
 return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));}
vec3 bk_snoiseVec3(vec3 p){return vec3(bk_snoise3(p),bk_snoise3(p+vec3(31.416,-47.853,12.793)),bk_snoise3(p+vec3(-233.34,5.52,63.82)));}
vec3 bk_curl(vec3 p){const float e=.1;vec3 dx=vec3(e,0.,0.),dy=vec3(0.,e,0.),dz=vec3(0.,0.,e);
 vec3 x0=bk_snoiseVec3(p-dx),x1=bk_snoiseVec3(p+dx),y0=bk_snoiseVec3(p-dy),y1=bk_snoiseVec3(p+dy),z0=bk_snoiseVec3(p-dz),z1=bk_snoiseVec3(p+dz);
 return vec3(y1.z-y0.z-z1.y+z0.y,z1.x-z0.x-x1.z+x0.z,x1.y-x0.y-y1.x+y0.x)/(2.*e);}
float bk_fbm2(vec2 p){float s=0.,a=.5;for(int i=0;i<5;i++){s+=a*bk_snoise2(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return s;}
float bk_fbm3(vec3 p){float s=0.,a=.5;for(int i=0;i<5;i++){s+=a*bk_snoise3(p);p=p*2.03+vec3(1.7,9.2,4.3);a*=.5;}return s;}
vec2 bk_curl2d(vec2 p){float e=.08;float px1=bk_snoise2(p+vec2(e,0.)),px0=bk_snoise2(p-vec2(e,0.)),py1=bk_snoise2(p+vec2(0.,e)),py0=bk_snoise2(p-vec2(0.,e));return vec2(py1-py0,-(px1-px0))/(2.*e);}`,
  'bk_snoise2(vec2(1.2,3.4))+bk_snoise3(vec3(1.2,3.4,5.6))+bk_curl(vec3(.3)).x+bk_curl2d(vec2(2.)).y+bk_fbm2(vec2(2.))+bk_fbm3(vec3(2.))');

 add('lut3d',2,[],`
precision highp sampler3D;   /* three r160 declares no default precision for sampler3D in a ShaderMaterial fragment shader */
vec3 bk_lut3d(sampler3D lut,vec3 c,float size){return texture(lut,clamp(c,0.,1.)*((size-1.)/size)+.5/size).rgb;}`,'bk_lut3d(uLut,vec3(.5),32.).x');

 add('blackbody',1,[],`
vec3 bk_blackbody(float kelvin){float t=clamp(kelvin,1000.,40000.)/100.;
 float r=t<=66.?1.:clamp(1.292936186062745*pow(max(t-60.,1e-3),-.1332047592),0.,1.);
 float g=t<=66.?clamp(.390081578769*log(t)-.631841443788,0.,1.):clamp(1.129890860895*pow(max(t-60.,1e-3),-.0755148492),0.,1.);
 float b=t>=66.?1.:(t<=19.?0.:clamp(.54320678911*log(max(t-10.,1e-3))-1.196254089,0.,1.));
 return vec3(r,g,b);}
float bk_bvToKelvin(float bv){bv=clamp(bv,-.4,2.);return 4600.*(1./(.92*bv+1.7)+1./(.92*bv+.62));}
vec3 bk_bvColor(float bv){return bk_blackbody(bk_bvToKelvin(bv));}`,'bk_bvColor(.65).x+bk_blackbody(5800.).y');

 /* ---------- composition ---------- */
 function resolve(names){const out=[],seen=new Set(),visit=n=>{const c=C[n];if(!c)throw new Error('BKShaders: no chunk "'+n+'"');if(seen.has(n))return;seen.add(n);c.deps.forEach(visit);out.push(c)};names.forEach(visit);return out}
 const use=(...names)=>resolve(names).map(c=>'// bk:'+c.name+'@'+c.v+'\n'+c.src).join('\n');
 const key=(tag,...names)=>'bk:'+tag+':'+resolve(names).map(c=>c.name+'@'+c.v).join(',');
 const inject=(src,...names)=>{const g=use(...names);return src.indexOf('#include <common>')>=0?src.replace('#include <common>','#include <common>\n'+g):g+'\n'+src};
 function hook(material,tag,fn,...names){const k=key(tag,...names);material.customProgramCacheKey=()=>k;material.onBeforeCompile=fn;return material}

 /* ---------- CPU twins ---------- */
 const fract=x=>x-Math.floor(x),clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
 const js={
  fract,
  ign:(x,y)=>fract(52.9829189*fract(x*.06711056+y*.00583715)),
  hash11:p=>{p=fract(p*.1031);p*=p+33.33;p*=p+p;return fract(p)},
  blackbody(K){const t=clamp(K,1000,40000)/100,r=t<=66?1:clamp(1.292936186062745*Math.pow(Math.max(t-60,1e-3),-.1332047592),0,1),
   g=t<=66?clamp(.390081578769*Math.log(t)-.631841443788,0,1):clamp(1.129890860895*Math.pow(Math.max(t-60,1e-3),-.0755148492),0,1),
   b=t>=66?1:(t<=19?0:clamp(.54320678911*Math.log(Math.max(t-10,1e-3))-1.196254089,0,1));return[r,g,b]},
  bvToKelvin(bv){bv=clamp(bv,-.4,2);return 4600*(1/(.92*bv+1.7)+1/(.92*bv+.62))},
  bvColor(bv){return js.blackbody(js.bvToKelvin(bv))}};
 /* n RGBA8 texels, B-V from -0.4 (blue-white) to 2.0 (deep red); the caller wraps it in a DataTexture(n,1) and disposes it */
 const bakeBlackbody=(n=256)=>{const d=new Uint8Array(n*4);for(let i=0;i<n;i++){const c=js.bvColor(-.4+2.4*i/(n-1));d[i*4]=Math.round(c[0]*255);d[i*4+1]=Math.round(c[1]*255);d[i*4+2]=Math.round(c[2]*255);d[i*4+3]=255}return d};

 /* ---------- compile test ---------- */
 function selfTest(gl0){
  let gl=gl0,own=null;
  try{if(!gl){own=document.createElement('canvas');gl=own.getContext('webgl2')}
   if(!gl||!gl.createShader)return{ok:false,log:'no WebGL2 context',chunks:order.slice()};
   const names=order.slice(),calls=names.map(n=>C[n].probe).join('+'),
    fs='#version 300 es\nprecision highp float;precision highp sampler3D;uniform sampler3D uLut;out vec4 o;\n'+use(...names)+'\nvoid main(){o=vec4(vec3(('+calls+')*.001),1.);}',
    vs='#version 300 es\nvoid main(){gl_Position=vec4(0.,0.,0.,1.);}',
    sh=(t,s)=>{const x=gl.createShader(t);gl.shaderSource(x,s);gl.compileShader(x);return x},
    v=sh(gl.VERTEX_SHADER,vs),f=sh(gl.FRAGMENT_SHADER,fs),p=gl.createProgram();gl.attachShader(p,v);gl.attachShader(p,f);gl.linkProgram(p);
   const ok=!!gl.getProgramParameter(p,gl.LINK_STATUS),log=ok?'':String(gl.getShaderInfoLog(f)||gl.getProgramInfoLog(p)).slice(0,400);
   gl.deleteProgram(p);gl.deleteShader(v);gl.deleteShader(f);
   return{ok,log,chunks:names}}
  catch(e){return{ok:false,log:String(e).slice(0,200),chunks:order.slice()}}
  finally{if(own){try{const x=gl.getExtension('WEBGL_lose_context');x&&x.loseContext()}catch{}}}}

 window.BKShaders={version:VERSION,chunks:()=>order.slice(),versions:()=>Object.fromEntries(order.map(n=>[n,C[n].v])),get:n=>C[n]&&C[n].src,use,key,inject,hook,js,bakeBlackbody,selfTest,diag:()=>({version:VERSION,chunks:order.length})};
})();
