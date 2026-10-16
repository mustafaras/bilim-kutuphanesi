'use strict';
/* TextFit — the single place that decides how text is laid out on a 2D canvas.
   fillText knows nothing about width, wrapping or neighbours, so every canvas that prints a record's title/author
   (3D cover, spine, share card) goes through here: measure, wrap, shrink in steps, ellipsize, never overflow.
   Pure functions over a CanvasRenderingContext2D (only font + measureText are used), so tools/text_fit_audit.py can call them directly. */
(()=>{
 const ELL='…';
 /* one line, cut by characters until it fits maxW (appends … when cut); never returns an empty string for non-empty input */
 function ellipsize(x,text,maxW){
  let s=String(text==null?'':text).replace(/\s+/g,' ').trim();
  if(x.measureText(s).width<=maxW)return s;
  while(s.length>1&&x.measureText(s+ELL).width>maxW)s=s.slice(0,-1);
  return s.trimEnd()+ELL;
 }
 /* wrap into lines no wider than maxW; a single word wider than maxW is broken by characters (with a trailing hyphen-less cut) */
 function wrap(x,text,maxW){
  const words=String(text==null?'':text).split(/\s+/).filter(Boolean),lines=[];let cur='';
  const push=w=>{ /* place a word, breaking it if it can never fit on a line by itself */
   if(x.measureText(w).width<=maxW){cur=w;return}
   let chunk='';for(const ch of w){if(x.measureText(chunk+ch).width>maxW&&chunk){lines.push(chunk);chunk=ch}else chunk+=ch}cur=chunk};
  for(const w of words){
   const t=cur?cur+' '+w:w;
   if(x.measureText(t).width<=maxW)cur=t;
   else{if(cur)lines.push(cur);push(w)}
  }
  if(cur)lines.push(cur);
  return lines;
 }
 /* paragraph fit: largest size in `sizes` whose wrapped text fits maxH (and maxLines); at the smallest size the overflow is cut with …
    → {size, lh, lines, truncated}. font(size) returns the CSS font string. */
 function fitBlock(x,text,o){
  const sizes=o.sizes||[44,40,36,32,28,25,22],lhK=o.lh||1.2,maxLines=o.maxLines||99,font=o.font||(s=>'400 '+s+'px Fraunces,Georgia,serif');
  let best=null;
  for(let i=0;i<sizes.length;i++){
   const size=sizes[i];x.font=font(size);
   const lines=wrap(x,text,o.maxW),lh=size*lhK,cap=Math.max(1,Math.min(maxLines,Math.floor(o.maxH/lh)));
   best={size,lh,lines,truncated:false};
   if(lines.length<=cap)return best;
   if(i===sizes.length-1){ /* smallest size: keep cap lines, fold the rest into the last one and ellipsize */
    const head=lines.slice(0,cap-1),tail=lines.slice(cap-1).join(' ');
    best.lines=[...head,ellipsize(x,tail,o.maxW)];best.truncated=true;
   }
  }
  return best;
 }
 /* single line that shrinks before it truncates: tries each size, then ellipsizes at the smallest → {size, text} */
 function fitLine(x,text,o){
  const sizes=o.sizes||[24,22,20,18],font=o.font||(s=>'400 '+s+'px Inter,sans-serif');
  for(const size of sizes){x.font=font(size);if(x.measureText(String(text)).width<=o.maxW)return{size,text:String(text)}}
  const size=sizes[sizes.length-1];x.font=font(size);return{size,text:ellipsize(x,text,o.maxW)};
 }
 /* does the author duplicate what the title already says? (Nobel documents carry the laureates in the title) */
 function authorInTitle(title,author){
  const a=String(author||'').toLowerCase().replace(/\s+/g,' ').trim(),t=String(title||'').toLowerCase();
  if(!a)return true;
  if(t.includes(a.slice(0,18)))return true;
  const first=a.split(/\s*;\s*/)[0];return first.length>5&&t.includes(first);
 }
 /* DOM label de-cluttering: items = [{el,x,y,w,h,prio}] (screen px; x is the label centre). Higher prio stays; overlapping lower ones are hidden. */
 function declutter(items,pad){
  const p=pad==null?2:pad,shown=[];
  items.slice().sort((a,b)=>b.prio-a.prio).forEach(it=>{
   const b={x:it.x-it.w/2-p,y:it.y-p,w:it.w+2*p,h:it.h+2*p};
   const hit=shown.some(s=>!(b.x>s.x+s.w||b.x+b.w<s.x||b.y>s.y+s.h||b.y+b.h<s.y));
   if(it.el)it.el.style.visibility=hit?'hidden':'';
   it.hidden=hit;if(!hit)shown.push(b);
  });
  return items;
 }
 window.BKText={ellipsize,wrap,fitBlock,fitLine,authorInTitle,declutter};
})();
