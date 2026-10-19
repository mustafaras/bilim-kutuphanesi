#!/usr/bin/env python3
"""A6 GPU budget gate: structural upper limits per 3D surface (software GL is fine, these are counts, not timings).

  python tools/gpu_budget_audit.py [--url URL] [--surfaces hero,ground] [--print] [--scale 1.0] [--flag name=0]
The page is loaded with a counting layer in front of WebGL (every context, no help from the app code): draw calls, triangles, points, full-screen quad draws (indexed 6-index quads and the 3-vertex full-screen triangle of three's passes) and the area they cover
per frame (a frame = one requestAnimationFrame tick), linked programs, live framebuffers (= render targets) and live textures per context. For every surface the WORST frame seen
in the measuring window is compared with its limit (tools table LIMITS); live programs / render targets / textures are read at the end of the window.
Limits are today's measurement plus headroom (see PREMIUM-GORSEL-VIZYON.md §6 for the long-term targets: they are lower and arrive with R7–R9). --print shows the measured values
(use it to set a limit), --scale 0.5 halves every limit (the gate must then fail: proof that it trips), --flag fxuber=0 sets bk-flag-<name> in localStorage before the page loads.
Hero fx mode comparison (--fx-compare, needs BKFX): the same hero is measured with fxuber=0 and fxuber=1; the uber chain must use at most 5 passes and >= 30 % fewer full-resolution reads."""
import argparse, json, os, socket, subprocess, sys, time
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT = Path(__file__).resolve().parent.parent
ap = argparse.ArgumentParser(); ap.add_argument("--url"); ap.add_argument("--surfaces"); ap.add_argument("--print", action="store_true", dest="show")
ap.add_argument("--scale", type=float, default=1.0); ap.add_argument("--flag", action="append", default=[]); ap.add_argument("--fx-compare", action="store_true")
ap.add_argument("--theme", default="dark"); a = ap.parse_args()
srv = None
if not a.url:
    s_ = socket.socket(); s_.bind(("127.0.0.1", 0)); port = s_.getsockname()[1]; s_.close()
    srv = subprocess.Popen([sys.executable, "-m", "http.server", str(port), "--directory", str(ROOT / "site")], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    a.url = f"http://127.0.0.1:{port}/"; time.sleep(1)
problems = []; note = lambda m: print(m, flush=True)

# counting layer: injected before any page script, wraps the WebGL prototypes (WebGL2 and WebGL1)
HOOK = r"""
(()=>{const S=new Map();window.__gb=S;window.__tick=0;
 const st=c=>{let s=S.get(c);if(!s){s={canvas:c.canvas,prog:0,fb:0,tex:0,fr:{},vp:[0,0]};S.set(c,s)}return s};
 const fr=s=>{const t=window.__tick;return s.fr[t]||(s.fr[t]={d:0,t:0,p:0,q:0,qa:0})};
 for(const K of [window.WebGL2RenderingContext,window.WebGLRenderingContext]){if(!K)continue;const P=K.prototype;
  const wrap=(n,f)=>{const o=P[n];if(!o)return;P[n]=function(...a){try{f.call(this,a)}catch(e){}return o.apply(this,a)}};
  const tri=(m,n)=>m===4?n/3:(m===5||m===6)?Math.max(0,n-2):0;
  const quad=(s,f,m,n,inst)=>{if(m===4&&(n===6||n===3)&&inst===1){const W=s.canvas.width*s.canvas.height||1;f.q++;f.qa+=s.vp[0]*s.vp[1]/W}};
  wrap('viewport',function(a){st(this).vp=[a[2],a[3]]});
  wrap('drawElements',function(a){const s=st(this),f=fr(s);f.d++;f.t+=tri(a[0],a[1]);quad(s,f,a[0],a[1],1)});
  wrap('drawArrays',function(a){const s=st(this),f=fr(s);f.d++;if(a[0]===0)f.p+=a[2];else f.t+=tri(a[0],a[2]);quad(s,f,a[0],a[2],1)});
  wrap('drawElementsInstanced',function(a){const f=fr(st(this));f.d++;f.t+=tri(a[0],a[1])*a[4]});
  wrap('drawArraysInstanced',function(a){const f=fr(st(this));f.d++;if(a[0]===0)f.p+=a[2]*a[3];else f.t+=tri(a[0],a[2])*a[3]});
  wrap('linkProgram',function(){st(this).prog++});wrap('deleteProgram',function(){st(this).prog--});
  wrap('createFramebuffer',function(){st(this).fb++});wrap('deleteFramebuffer',function(){st(this).fb--});
  wrap('createTexture',function(){st(this).tex++});wrap('deleteTexture',function(){st(this).tex--});}
 const raf=window.requestAnimationFrame.bind(window);(function l(){window.__tick++;raf(l)})();
 window.__gbRead=(match,t0)=>{for(const s of S.values()){const c=s.canvas;if(!match(c))continue;
   const f=Object.entries(s.fr).filter(([t,v])=>+t>=t0&&v.d>0).map(([t,v])=>v),mx=k=>f.reduce((m,v)=>Math.max(m,v[k]),0);
   return{frames:f.length,draws:mx('d'),tris:mx('t'),points:mx('p'),quads:mx('q'),quadArea:+mx('qa').toFixed(3),programs:s.prog,targets:s.fb,textures:s.tex,w:c.width,h:c.height}}return null};
 window.__gbMatch={hero:c=>c.id==='heroGL',ground:c=>c.classList.contains('hero-ground-gl'),stage:c=>!c.isConnected&&!c.id&&!c.className,
  skyline:c=>!!c.closest&&!!c.closest('.nc-sky'),nobel:c=>!!c.closest&&!!c.closest('.nc-3d:not(.nc-sky)'),constellation:c=>c.classList.contains('rv-gl')};
})();
"""

# Per surface: how to bring it on screen, and the limits (worst frame in the window; live programs / render targets / textures at its end).
# Measured on software GL at 1440x900, dark theme, v121 plus ~25 % headroom, then tightened where a PR removes work (the comment says which).
LIMITS = {
    "hero":          dict(draws=38, tris=14800, points=280000, programs=28, targets=18, textures=30),   # BKFX (v123): 30 draws / 12 targets measured (v122: 32 / 13) · BKSim R7.b (v124): +2 GCR compute draws, +4 float ping-pong targets (16), 26 textures, tier-0 worst frame draws 262144 points · R7.c (v125): +2 programs (HII points + hot-core sprite), +2 textures (black-body LUT, dust/sky map)
    "ground":        dict(draws=1, tris=70000, points=0, programs=2, targets=0, textures=5),
    "stage":         dict(draws=125, tris=44000, points=75, programs=19, targets=1, textures=66),
    "skyline":       dict(draws=12, tris=19200, points=330, programs=8, targets=1, textures=12),
    "nobel":         dict(draws=24, tris=4800, points=1130, programs=5, targets=0, textures=7),
    "constellation": dict(draws=80, tris=100000, points=720, programs=14, targets=0, textures=13),
}
PREP = {
    "hero": "scrollTo(0,0)",
    "ground": "scrollTo(0,0)",
    "stage": "document.getElementById('spotlightGrid').scrollIntoView({block:'center'})",
    "skyline": "document.querySelector('.timeline-section').scrollIntoView({block:'center'})",
    "nobel": "(()=>{const b=document.querySelector('[data-v=galaxy]');if(b)b.click()})()",
    "constellation": "(()=>{openRecord(records[5].id);let k=0;const iv=setInterval(()=>{const c=document.querySelector('.rv-gl');if(c)c.scrollIntoView({block:'center'});if(++k>4)clearInterval(iv)},300)})()",   # the canvas is built async; the box must be in view or its IntersectionObserver parks the render loop and the window sees zero frames (v124)
}
names = [n for n in (a.surfaces.split(",") if a.surfaces else LIMITS)]
flags = "".join(f"localStorage.setItem('bk-flag-{k}','{v}');" for k, v in (f.split("=") for f in a.flag))

def open_page(b, extra="", fresh=True):
    ctx = b.new_context(viewport={"width": 1440, "height": 900}, device_scale_factor=1, service_workers="block"); q = ctx.new_page()
    q.add_init_script(f"try{{localStorage.setItem('bk-test','1');localStorage.setItem('bk-theme','{a.theme}');localStorage.setItem('bk-lang','tr');{flags}}}catch(e){{}}")
    q.add_init_script(HOOK)
    q.goto(a.url + f"?gb={time.time()}{extra}", wait_until="load")
    q.wait_for_function('window.BKStage&&typeof records!=="undefined"&&records.length', timeout=180000)
    q.wait_for_function("document.querySelectorAll('.tile-3d.on').length>=6", timeout=180000)
    try: q.wait_for_function("!!document.querySelector('#heroGL.on')", timeout=90000)
    except Exception: pass
    return ctx, q

def measure(q, name, need=6, timeout=90):
    q.evaluate(PREP[name]); q.wait_for_timeout(2500)
    t0 = q.evaluate("window.__tick"); r = None; end = time.time() + timeout
    while time.time() < end:
        q.wait_for_timeout(2000); r = q.evaluate(f"window.__gbRead(window.__gbMatch.{name},{t0})")
        if r and r["frames"] >= need: break
    return r

def check(name, r):
    lim = LIMITS[name]
    if not r or not r["frames"]: problems.append(f"{name}: no WebGL frames seen (surface did not render)"); return
    for k, v in lim.items():
        cap = int(v * a.scale + .5) if a.scale != 1.0 else v
        if r[k] > cap: problems.append(f"{name}: {k} {r[k]} exceeds the limit {cap}")

try:
    with sync_playwright() as p:
        kw = dict(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"]); exe = os.environ.get("BK_CHROMIUM")
        b = p.chromium.launch(executable_path=exe, **kw) if exe else p.chromium.launch(**kw)
        if a.fx_compare:
            res = {}
            for mode in ("0", "1"):
                ctx = b.new_context(viewport={"width": 1440, "height": 900}, device_scale_factor=1, service_workers="block"); q = ctx.new_page()
                q.add_init_script(f"try{{localStorage.setItem('bk-test','1');localStorage.setItem('bk-theme','dark');localStorage.setItem('bk-lang','tr');localStorage.setItem('bk-flag-fxuber','{mode}')}}catch(e){{}}"); q.add_init_script(HOOK)
                q.goto(a.url + f"?gb={time.time()}", wait_until="load")
                q.wait_for_function('window.BKHero&&typeof records!=="undefined"&&records.length', timeout=180000)
                q.wait_for_function("!!document.querySelector('#heroGL.on')", timeout=120000)
                q.evaluate("BKHero.gov.reset();if(BKHero.gov.pin)BKHero.gov.pin(true)")   # software GL would drop the bloom chain at once; pin the governor so the chain is measured
                r = measure(q, "hero"); info = q.evaluate("BKHero.info?BKHero.info():null"); res[mode] = (r, info); ctx.close()
                note(f"hero fxuber={mode}: GL {r} | info {info}")
            (r0, i0), (r1, i1) = res["0"], res["1"]
            if not i0 or not i1: problems.append("BKHero.info() is missing: the hero must report its pass plan")
            elif not (i0.get("bloom") and i1.get("bloom")): problems.append(f"the bloom chain was not running during the measurement: {i0} / {i1}")
            else:
                if i0.get("fx") != "legacy" or i1.get("fx") != "uber": problems.append(f"fx modes wrong: fxuber=0 -> {i0.get('fx')}, fxuber=1 -> {i1.get('fx')}")
                if i1["passes"] > 5: problems.append(f"uber hero chain uses {i1['passes']} passes (limit 5)")
                if i1["fullReads"] > i0["fullReads"] * 0.7 + 1e-9: problems.append(f"full-resolution reads {i0['fullReads']} -> {i1['fullReads']}: less than 30 % fewer")
                # the scene itself draws a few full-viewport quads (nebula plane, glow and lamp sprites): quads seen by GL minus the chain's declared draws; they must be equal in both modes and are taken out of the area
                sc0, sc1 = r0["quads"] - i0["draws"], r1["quads"] - i1["draws"]
                if sc0 != sc1: problems.append(f"the plan does not match GL: scene quads {sc0} (legacy) vs {sc1} (uber); the chain's declared draws {i0['draws']} / {i1['draws']} vs GL quads {r0['quads']} / {r1['quads']}")
                a0, a1 = r0["quadArea"] - sc0, r1["quadArea"] - sc1; da = (a0 - a1) / max(a0, 1e-9)
                note(f"hero: passes {i0['passes']} -> {i1['passes']}, full-res reads {i0['fullReads']} -> {i1['fullReads']}, render targets {i0['targets']} -> {i1['targets']} (GL {r0['targets']} -> {r1['targets']}), post-chain full-screen draws {i0['draws']} -> {i1['draws']} (GL quads {r0['quads']} -> {r1['quads']}), post-chain area written (screens) {a0:.2f} -> {a1:.2f} ({da:.0%} less), all draws {r0['draws']} -> {r1['draws']}")
                if da < 0.30: problems.append(f"GL-measured post-chain area only {da:.0%} lower (need >= 30 %)")
                if r1["draws"] > r0["draws"] or r1["targets"] > r0["targets"]: problems.append(f"uber must not add draws or render targets: draws {r0['draws']} -> {r1['draws']}, targets {r0['targets']} -> {r1['targets']}")
        else:
            ctx, q = open_page(b)
            rows = []
            for n in names:
                if n != "hero": q.evaluate("window.BKHero&&BKHero.gov&&(BKHero.gov.setLevel(3),BKHero.gov.pin(true))")   # silence the hero (bottom tier, pinned) before another surface's window: on software GL its tier-0 GPGPU frames starve every other canvas for minutes (v124 R7.b); the governor's own behavior is measured by B10/main
                try: r = measure(q, n)
                except Exception as e: r = None; problems.append(f"{n}: measurement failed: {str(e)[:160]}")
                if r is not None: rows.append((n, r)); check(n, r)
                note(f"{n:14s} {json.dumps(r)}")
            ctx.close()
            if a.show: note(json.dumps(dict(rows), indent=1))
        b.close()
finally:
    if srv: srv.terminate()
print("FAIL" if problems else "OK: GPU budgets", *problems, sep="\n - " if problems else "")
sys.exit(1 if problems else 0)
