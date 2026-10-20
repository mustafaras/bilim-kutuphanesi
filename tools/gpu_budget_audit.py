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
    "hero":          dict(draws=58, tris=18500, points=1900000, programs=40, targets=18, textures=40),   # BKFX (v123): 30 draws / 12 targets measured (v122: 32 / 13) · BKSim R7.b (v124): +2 GCR compute draws, +4 float ping-pong targets (16), 26 textures, tier-0 worst frame draws 262144 points · R7.c (v125): +2 programs (HII points + hot-core sprite), +2 textures (black-body LUT, dust/sky map) · R7.d (v126): +2 programs (diffuse glow plane, beacon quads), tier-0 worst frame +2 draws (glow plane, 300 instanced beacons = ONE draw), +~600 tris, anamorphic streak +2 post draws and 0 targets (reuses the bloom quarter-resolution mips); R7.d2 (v127): +3 programs (procedural grain points, deep-field quads; the light-theme symbols share them), tier-0 worst frame +2 draws and +600 000 procedural points (gl_VertexID: no attribute data, no compute, no texture); R7.e/R7.f (v128): +1 post draw (light cone, tier 0; 0 targets: it reuses hs[1]), the Lensflare adds ~8 small quad draws + 5 canvas textures + 2 framebuffer textures + 3 programs, the cone sprite +1 program, the 1024² level draws up to 1 048 576 sim points (tier 0 worst frame ~1.65 M points with the 600 000 grain) and 4 x 16 MB float targets; software GL runs tier 3 (and 512²) where all of it is off
    "ground":        dict(draws=9, tris=58000, points=30000, programs=8, targets=3, textures=10),   # R8 (v133): +6 draws worst frame (3 fog cards + the 2-draw mirror pass + the one-off wave upload compute), +2 programs (cards, mirror points), targets 0 -> 3 (wave ping-pong 2 + mirror 512² 1), textures 5 -> 8; PREP now pins tier 0 so the gate measures the FULL wet ground (measured 7 draws / 6 programs / 3 targets / 8 textures / 55 212 tris on software GL)
    "stage":         dict(draws=125, tris=44000, points=75, programs=19, targets=2, textures=66),   # R6 (v129): targets 1 -> 2 = the second baked studio ('medal' PMREM, the rectangular softbox); measured 86 draws / 27.5 k tris / 14 programs / 59 textures. The medal tile itself stays <= 14 draws, <= 40 k tris (B19 pins the object counts)
    "skyline":       dict(draws=12, tris=19200, points=330, programs=8, targets=1, textures=12),
    "nobel":         dict(draws=24, tris=4800, points=1130, programs=5, targets=0, textures=7),
    "constellation": dict(draws=80, tris=100000, points=720, programs=14, targets=0, textures=13),
}
PREP = {
    "hero": "scrollTo(0,0)",
    "ground": "scrollTo(0,0);BKHero&&BKHero.gov.pin&&BKHero.gov.pin(true);BKHero&&BKHero.gov.setLevel&&BKHero.gov.setLevel(0)",   # R8: pin tier 0 so the gate measures the FULL wet ground (256² wave sim + 512² mirror target + 3 fog cards); auto-sensing on software GL would sit at tier 3 where R8 is off
    "stage": "document.getElementById('spotlightGrid').scrollIntoView({block:'center'})",
    "skyline": "document.querySelector('.timeline-section').scrollIntoView({block:'center'})",
    "nobel": "(()=>{const b=document.querySelector('[data-v=galaxy]');if(b)b.click()})()",
    "constellation": "openRecord(records[5].id)",
}
# Surfaces whose render loop parks while the canvas is out of view (IntersectionObserver): the window then sees zero frames.
# A single early centering loses the race against the async canvas build (v124–v131 flakes, reproduced on v131 locally): measure() re-asserts visibility before every read.
ENSURE = {
    "constellation": "(()=>{const c=document.querySelector('.rv-gl');if(c)c.scrollIntoView({block:'center'})})()",
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
        if name in ENSURE: q.evaluate(ENSURE[name])   # parked loop: center the (async built) canvas again before reading; a no-op once it stays in view
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
                q.add_init_script(f"try{{localStorage.setItem('bk-test','1');localStorage.setItem('bk-theme','dark');localStorage.setItem('bk-lang','tr');localStorage.setItem('bk-flag-fxuber','{mode}');localStorage.setItem('bk-flag-streak','0');localStorage.setItem('bk-flag-cone','0')}}catch(e){{}}"); q.add_init_script(HOOK)   # the gate measures the CHAIN: the anamorphic streak and the light cone are features the legacy chain never had (B13 pins their exact cost)
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
