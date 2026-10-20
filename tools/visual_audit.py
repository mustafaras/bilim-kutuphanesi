#!/usr/bin/env python3
"""R3 visual regression gate (software GL, ?still=1).

  python tools/visual_audit.py [--url URL] [--quick] [--update]
Surfaces (hero, discovery atlas incl. medal, shelf books, record book closed + 3 open spreads, Nobel timeline) are captured in deterministic mode (?still=1: seeded
Math.random, effects paused, tiles at dt 0) at 1440x900 and 1024x768 in dark and light, TR. Checks:
 1 stability: the same code captured twice differs by < 0.1 % of the pixels (1440x900 dark+light; --quick: dark only)
 2 known defects break the gate: hidden atlas canvases and a shelf forced to the CSS fallback must differ by far more than the tolerance
 3 golden images (tools/golden/<config>__<surface>.png, half size): compared when they exist (per-channel tolerance 10, the open-book spreads 3; < 0.5 % changed pixels); --update rewrites them.
    Goldens come from CI (same software GL): download the 'visual-candidates' artifact of a green run and commit its files. Without goldens the gate says so and checks 1 + 2 only.
The server port is fixed (--port, default 8613): the address shows up in the page text, a random port made captures differ by glyph pixels.
Per-surface tolerance / limit table: SURFACES below.
Captures go to tools/golden/_out/ (git-ignored), differences to tools/golden/_diff/."""
import argparse, os, socket, subprocess, sys, time, shutil
from pathlib import Path
import numpy as np
from PIL import Image
from playwright.sync_api import sync_playwright
ROOT = Path(__file__).resolve().parent.parent; GOLD = ROOT / "tools" / "golden"; OUT = GOLD / "_out"; DIFF = GOLD / "_diff"
ap = argparse.ArgumentParser(); ap.add_argument("--url"); ap.add_argument("--quick", action="store_true", help="1440x900 dark only"); ap.add_argument("--config", help="one configuration, e.g. 1440x900:dark (CI runs the four as parallel jobs)"); ap.add_argument("--update", action="store_true"); ap.add_argument("--hero-only", action="store_true", help="capture only the hero (candidates in tools/golden/_out/candidates), no comparison: for before/after pictures on the same GL"); ap.add_argument("--legacy", action="store_true", help="hero only, with the flag fxuber=0, compared with tools/golden/legacy/ (the pre-BKFX hero images): proves the kill switch restores the old picture"); ap.add_argument("--port", type=int, default=8613, help="fixed server port (default 8613)"); a = ap.parse_args()
srv = None
if not a.url:
    # fixed port: the address is part of the page text (permalinks, share card), so a random port makes two captures differ by a few glyph pixels. Two local runs at once need different --port values.
    s_ = socket.socket(); s_.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)   # a previous run's connections linger in TIME_WAIT; http.server reuses the address too
    try: s_.bind(("127.0.0.1", a.port))
    except OSError: sys.exit(f"port {a.port} is busy: stop the other server or pass --port (the port must stay the same between the captures you compare)")
    finally: s_.close()
    srv = subprocess.Popen([sys.executable, "-m", "http.server", str(a.port), "--directory", str(ROOT / "site")], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    a.url = f"http://127.0.0.1:{a.port}/"; time.sleep(1)
problems = []; note = lambda m: print(m, flush=True)
TOL, STABLE, GOLDEN = 10, 0.001, 0.005
# Per-surface limits (surface = the part after "__" in a file name; a key matches by prefix). tol = per-channel tolerance, stable = largest changed-pixel share between two captures of the same code,
# golden = largest share against the committed golden. Defaults: tol 10, stable 0.1 %, golden 0.5 %. A surface appears here for one of two reasons:
#  * loose: procedural particle / label layouts that are not seeded (constellation planets and caption picks, Nobel galaxy stray stars): looser limits, still far below any real defect (a hidden canvas changes > 4 %)
#  * fine: the open book changes in fine detail (paper fibre, edge gilt, page thickness): measured v116 -> v119 on the same GL, only 0.1-0.3 % of its pixels differ by more than 10 levels (under the 0.5 % limit,
#    so the gate was blind to it) but 3-11 % differ by more than 2-4, hence tolerance 3. Every other surface was identical across those versions (0.0000 at any tolerance).
SURFACES = {
    "constellation": dict(stable=0.02, golden=0.03),
    "nobel-galaxy": dict(stable=0.01, golden=0.02),
    "book-open": dict(tol=3),
}
def spec(name, key):
    """limit `key` ('tol' | 'stable' | 'golden') for a file name like 1440x900-dark__hero.png"""
    surf = name.split("__")[1][:-4]
    for pre, o in SURFACES.items():
        if surf.startswith(pre) and key in o: return o[key]
    return {"tol": TOL, "stable": STABLE, "golden": GOLDEN}[key]
def tol_for(name): return spec(name, "tol")
def lim(name, k): return spec(name, ("stable", "golden")[k])
FLAGJS = ";localStorage.setItem('bk-flag-fxuber','0');localStorage.setItem('bk-flag-bksim','0');localStorage.setItem('bk-flag-flare','0')" if a.legacy else ""   # the legacy images predate BKFX, the GPGPU galaxy AND the dome Lensflare (R7.e): the kill-switch proof needs all three old paths (the light cone and the streak live inside BKFX, so fxuber=0 already removes them)
CONFIGS = [(1440, 900, "dark"), (1440, 900, "light"), (1024, 768, "dark"), (1024, 768, "light")]

def ratio(p1, p2, save=None, tol=None):
    """share of pixels whose largest channel difference exceeds the tolerance (0..1); sizes differing = 1"""
    tol = TOL if tol is None else tol
    x, y = np.asarray(Image.open(p1).convert("RGB"), dtype=np.int16), np.asarray(Image.open(p2).convert("RGB"), dtype=np.int16)
    if x.shape != y.shape: return 1.0
    m = np.abs(x - y).max(axis=2) > tol
    if save is not None and m.any():
        DIFF.mkdir(parents=True, exist_ok=True); d = np.zeros(m.shape + (3,), np.uint8); d[...] = (x.mean(axis=2, keepdims=True) * .35).astype(np.uint8); d[m] = (255, 0, 80); Image.fromarray(d).save(save)
    return float(m.mean())

def capture(b, w, h, theme, tag, keep=False):
    """one page load, every surface; returns ({surface: png path}, page-or-None)"""
    ctx = b.new_context(viewport={"width": w, "height": h}, device_scale_factor=1, service_workers="block", locale="tr-TR"); q = ctx.new_page()
    q.add_init_script(f"try{{localStorage.setItem('bk-test','1');localStorage.setItem('bk-theme','{theme}');localStorage.setItem('bk-lang','tr'){FLAGJS}}}catch(e){{}}")
    q.goto(a.url + f"?still=1&vr={time.time()}", wait_until="load")
    q.wait_for_function('window.BKStage&&window.BKMotion&&typeof records!=="undefined"&&records.length', timeout=180000)
    q.wait_for_function("document.querySelectorAll('.tile-3d.on').length>=8", timeout=180000)
    try: q.wait_for_function("!!document.querySelector('#heroGL.on')", timeout=60000)
    except Exception: pass
    # Deterministic preconditions (v132, DEVIR §77): a capture must never race async state that changes pixels.
    try: q.wait_for_function("(()=>{try{return document.fonts.check('400 44px Fraunces')&&document.fonts.check('400 24px Inter')&&document.fonts.check('600 22px \"IBM Plex Mono\"')}catch(e){return true}})()", timeout=90000)   # a web font arriving between the two captures re-lays caption glyphs (the 0.0011 atlas stability flake)
    except Exception: pass
    q.wait_for_function("!!window.BKStage&&!!BKStage.medalInfo()&&BKStage.medalInfo().builtFaces>=7", timeout=120000)   # the medal face chain runs in requestIdleCallback (~100 ms Sobel per face): if the atlas canvas first renders mid-chain (paused mode renders once, when dirtied) its pixels depend on idle timing; B19 pins the 7-face end state
    q.add_style_tag(content='header,.site-header,.topbar,.skip-link{position:static!important;visibility:hidden!important}')   # a sticky header would overlap element shots at different places
    q.wait_for_timeout(4000)
    out = {}; base = OUT / tag; base.mkdir(parents=True, exist_ok=True)
    def shot(name, target=None):
        f = base / f"{w}x{h}-{theme}__{name}.png"
        if target is None: q.screenshot(path=str(f))
        else:
            q.evaluate("(sel)=>{const e=document.querySelector(sel);if(e)e.scrollIntoView({block:'center'})}", target); q.wait_for_timeout(1800); q.locator(target).first.screenshot(path=str(f))
        out[name] = f
    q.evaluate("scrollTo(0,0)"); q.wait_for_timeout(1500); shot("hero", ".hero")
    if a.legacy or a.hero_only: ctx.close(); return out, None
    q.evaluate("document.querySelector('.atlas-tile').parentElement.setAttribute('data-vr','atlas')"); shot("atlas", "[data-vr=atlas]")
    shot("shelf", "#spotlightGrid")
    if q.evaluate("!!document.querySelector('.timeline-section')"): shot("timeline", ".timeline-section")
    if q.evaluate("!!document.querySelector('.nc-view [data-v=galaxy],[data-v=galaxy]')"):
        q.evaluate("document.querySelector('[data-v=galaxy]').click()"); q.wait_for_timeout(3000); shot("nobel-galaxy", ".nc-3d:not(.nc-sky)")
    # record page: the 3D book closed and its three open spreads (same steps as feature_audit B5). Effects stay paused: in ?still the book lands exactly on every target
    q.evaluate("openRecord(records[5].id)"); q.wait_for_timeout(2500)
    if q.evaluate("!!document.querySelector('.rv-constellation')"): q.wait_for_timeout(2500); shot("constellation", ".rv-constellation")
    q.evaluate("document.querySelector('.rv-3d-toggle').click()"); q.wait_for_function("document.querySelector('.rv-book-ctl')", timeout=120000); q.wait_for_timeout(3000)
    q.wait_for_timeout(1500); shot("book-closed", ".rec-3d")
    q.evaluate("document.querySelector('.rv-book-ctl [data-a=open]').click()"); q.wait_for_function("BKStage.book.state().coverK>=0.999", timeout=120000); q.wait_for_timeout(1500)
    for i in range(3):
        q.evaluate("document.querySelector('.rv-book-ctl [data-a=next]').click()"); q.wait_for_function(f"BKStage.book.state().leaf=={i + 1}&&BKStage.book.state().p.every((v,k)=>Math.abs(v-(k<{i + 1}?1:0))<0.001)", timeout=60000); q.wait_for_timeout(1500); shot(f"book-open-{i + 1}", ".rec-3d")
    if keep: return out, (ctx, q)
    ctx.close(); return out, None

try:
    shutil.rmtree(OUT, ignore_errors=True)
    with sync_playwright() as p:
        kw = dict(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"]); exe = os.environ.get("BK_CHROMIUM")
        b = p.chromium.launch(executable_path=exe, **kw) if exe else p.chromium.launch(**kw)
        if a.config:
            sz, th_ = a.config.split(":"); w_, h_ = sz.split("x"); cfgs = [(int(w_), int(h_), th_)]
        else: cfgs = CONFIGS[:1] if a.quick else CONFIGS
        runA = {}; keep_page = None
        if a.legacy or a.hero_only:
            LEG = GOLD / "legacy"; bad = 0
            for (w, h, th) in cfgs:
                out, _ = capture(b, w, h, th, "legacy")
                for name, f in out.items():
                    im = Image.open(f).convert("RGB").resize((max(1, Image.open(f).width // 2), max(1, Image.open(f).height // 2)), Image.LANCZOS); cand = OUT / "candidates"; cand.mkdir(parents=True, exist_ok=True); im.save(cand / f.name, optimize=True)
                    if a.update: LEG.mkdir(parents=True, exist_ok=True); im.save(LEG / f.name, optimize=True); note(f"legacy golden updated: {f.name}")
                    if a.hero_only: note(f"captured {f.name}"); continue
                    g = LEG / f.name if (LEG / f.name).exists() else GOLD / f.name
                    r = ratio(g, cand / f.name, DIFF / f"legacy-{f.name}", tol_for(f.name)); note(f"fxuber=0 {f.name}: {r:.5f} of the pixels differ from {g.relative_to(ROOT)} (limit {lim(f.name, 1)})")
                    if r > lim(f.name, 1): problems.append(f"{f.name}: with fxuber=0 the hero differs from the pre-BKFX image: {r:.4f} (limit {lim(f.name, 1)})")
            b.close(); print("FAIL" if problems else "OK: fxuber=0 restores the old hero", *problems, sep="\n - " if problems else ""); 
            if srv: srv.terminate()
            sys.exit(1 if problems else 0)
        for (w, h, th) in cfgs:
            out, kp = capture(b, w, h, th, "a", keep=(w, h, th) == (1440, 900, "dark"))
            if kp: keep_page = kp
            runA.update({f.name: f for f in out.values()}); note(f"captured {w}x{h} {th}: {sorted(out)}")
        # 2 defects: the gate must see them
        if keep_page:
            ctx, q = keep_page
            q.evaluate("document.querySelector('.record-back,#recordBack')&&document.getElementById('recordBack').click()"); q.wait_for_timeout(1500)
            q.evaluate("document.querySelectorAll('.tile-3d').forEach(c=>c.style.visibility='hidden')"); q.evaluate("document.querySelector('[data-vr=atlas]').scrollIntoView({block:'center'})"); q.wait_for_timeout(1500)
            d1 = OUT / "defect-atlas.png"; q.locator("[data-vr=atlas]").first.screenshot(path=str(d1))
            q.evaluate("document.querySelectorAll('.tile-3d').forEach(c=>c.style.visibility='')"); q.evaluate("BKStage.forceLevel(4)"); q.evaluate("document.getElementById('spotlightGrid').scrollIntoView({block:'center'})"); q.wait_for_timeout(2500)
            d2 = OUT / "defect-shelf.png"; q.locator("#spotlightGrid").first.screenshot(path=str(d2)); ctx.close()
            r1 = ratio(runA["1440x900-dark__atlas.png"], d1, DIFF / "defect-atlas.png"); r2 = ratio(runA["1440x900-dark__shelf.png"], d2, DIFF / "defect-shelf.png")
            note(f"defect check: atlas canvases hidden -> {r1:.3f} changed, shelf on CSS fallback -> {r2:.3f} changed (must exceed {STABLE})")
            if r1 < 0.02: problems.append(f"gate did not see hidden atlas canvases ({r1:.4f})")
            if r2 < 0.02: problems.append(f"gate did not see the shelf falling back to CSS covers ({r2:.4f})")
        # 1 stability: capture again, compare
        worst = 0.0
        for (w, h, th) in cfgs:
            out, _ = capture(b, w, h, th, "b")
            for k, f in out.items():
                r = ratio(runA[f.name], f, DIFF / f"unstable-{f.name}", tol_for(f.name)); worst = max(worst, r)
                if r > lim(f.name, 0): problems.append(f"{f.name} unstable between two runs: {r:.4f} of the pixels changed (limit {lim(f.name, 0)})")
        note(f"stability: worst difference between two captures {worst:.5f} (limit {STABLE})")
        b.close()
    # 3 goldens (half size, PNG)
    GOLD.mkdir(parents=True, exist_ok=True); cand = OUT / "candidates"; cand.mkdir(parents=True, exist_ok=True)
    for name, f in runA.items():
        im = Image.open(f).convert("RGB"); im = im.resize((max(1, im.width // 2), max(1, im.height // 2)), Image.LANCZOS); im.save(cand / name, optimize=True)
    gold = {g.name: g for g in GOLD.glob("*.png")}
    if a.update:
        for g in cand.glob("*.png"): shutil.copy(g, GOLD / g.name)
        note(f"goldens updated: {len(list(cand.glob('*.png')))} files in tools/golden/")
    elif not gold: note("goldens: none committed yet — compared stability and defects only. Download the CI artifact 'visual-candidates' and commit its PNGs to tools/golden/ to arm the golden comparison.")
    else:
        miss = 0
        for g in sorted(cand.glob("*.png")):
            if g.name not in gold: miss += 1; continue
            r = ratio(gold[g.name], g, DIFF / f"golden-{g.name}", tol_for(g.name))
            if r > lim(g.name, 1): problems.append(f"{g.name} differs from its golden: {r:.4f} of the pixels (limit {lim(g.name, 1)}); see tools/golden/_diff/")
        note(f"goldens compared: {len(list(cand.glob('*.png'))) - miss}, without golden: {miss}")
finally:
    if srv: srv.terminate()
print("FAIL" if problems else "OK: visual gate (stable, sees known defects)", *problems, sep="\n - " if problems else "")
sys.exit(1 if problems else 0)
