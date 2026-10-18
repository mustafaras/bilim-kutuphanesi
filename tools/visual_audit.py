#!/usr/bin/env python3
"""R3 visual regression gate (software GL, ?still=1).

  python tools/visual_audit.py [--url URL] [--quick] [--update]
Surfaces (hero, discovery atlas incl. medal, shelf books, record book closed + 3 open spreads, Nobel timeline) are captured in deterministic mode (?still=1: seeded
Math.random, effects paused, tiles at dt 0) at 1440x900 and 1024x768 in dark and light, TR. Checks:
 1 stability: the same code captured twice differs by < 0.1 % of the pixels (1440x900 dark+light; --quick: dark only)
 2 known defects break the gate: hidden atlas canvases and a shelf forced to the CSS fallback must differ by far more than the tolerance
 3 golden images (tools/golden/<config>__<surface>.png, half size): compared when they exist (per-channel tolerance, < 0.5 % changed pixels); --update rewrites them.
    Goldens come from CI (same software GL): download the 'visual-candidates' artifact of a green run and commit its files. Without goldens the gate says so and checks 1 + 2 only.
Captures go to tools/golden/_out/ (git-ignored), differences to tools/golden/_diff/."""
import argparse, os, socket, subprocess, sys, time, shutil
from pathlib import Path
import numpy as np
from PIL import Image
from playwright.sync_api import sync_playwright
ROOT = Path(__file__).resolve().parent.parent; GOLD = ROOT / "tools" / "golden"; OUT = GOLD / "_out"; DIFF = GOLD / "_diff"
ap = argparse.ArgumentParser(); ap.add_argument("--url"); ap.add_argument("--quick", action="store_true", help="1440x900 dark only"); ap.add_argument("--config", help="one configuration, e.g. 1440x900:dark (CI runs the four as parallel jobs)"); ap.add_argument("--update", action="store_true"); a = ap.parse_args()
srv = None
if not a.url:
    s_ = socket.socket(); s_.bind(("127.0.0.1", 0)); port = s_.getsockname()[1]; s_.close()
    srv = subprocess.Popen([sys.executable, "-m", "http.server", str(port), "--directory", str(ROOT / "site")], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    a.url = f"http://127.0.0.1:{port}/"; time.sleep(1)
problems = []; note = lambda m: print(m, flush=True)
TOL, STABLE, GOLDEN = 10, 0.001, 0.005
CONFIGS = [(1440, 900, "dark"), (1440, 900, "light"), (1024, 768, "dark"), (1024, 768, "light")]

def ratio(p1, p2, save=None):
    """share of pixels whose largest channel difference exceeds TOL (0..1); sizes differing = 1"""
    x, y = np.asarray(Image.open(p1).convert("RGB"), dtype=np.int16), np.asarray(Image.open(p2).convert("RGB"), dtype=np.int16)
    if x.shape != y.shape: return 1.0
    m = np.abs(x - y).max(axis=2) > TOL
    if save is not None and m.any():
        DIFF.mkdir(parents=True, exist_ok=True); d = np.zeros(m.shape + (3,), np.uint8); d[...] = (x.mean(axis=2, keepdims=True) * .35).astype(np.uint8); d[m] = (255, 0, 80); Image.fromarray(d).save(save)
    return float(m.mean())

def capture(b, w, h, theme, tag, keep=False):
    """one page load, every surface; returns ({surface: png path}, page-or-None)"""
    ctx = b.new_context(viewport={"width": w, "height": h}, device_scale_factor=1, service_workers="block", locale="tr-TR"); q = ctx.new_page()
    q.add_init_script(f"try{{localStorage.setItem('bk-test','1');localStorage.setItem('bk-theme','{theme}');localStorage.setItem('bk-lang','tr')}}catch(e){{}}")
    q.goto(a.url + f"?still=1&vr={time.time()}", wait_until="load")
    q.wait_for_function('window.BKStage&&window.BKMotion&&typeof records!=="undefined"&&records.length', timeout=180000)
    q.wait_for_function("document.querySelectorAll('.tile-3d.on').length>=8", timeout=180000)
    try: q.wait_for_function("!!document.querySelector('#heroGL.on')", timeout=60000)
    except Exception: pass
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
    q.evaluate("document.querySelector('.atlas-tile').parentElement.setAttribute('data-vr','atlas')"); shot("atlas", "[data-vr=atlas]")
    shot("shelf", "#spotlightGrid")
    if q.evaluate("!!document.querySelector('.timeline-section')"): shot("timeline", ".timeline-section")
    # record page: the 3D book closed and its three open spreads (same steps as feature_audit B5). Effects stay paused: in ?still the book lands exactly on every target
    q.evaluate("openRecord(records[5].id)"); q.wait_for_timeout(2500)
    q.evaluate("document.querySelector('.rv-3d-toggle').click()"); q.wait_for_function("document.querySelector('.rv-book-ctl')", timeout=120000); q.wait_for_timeout(3000)
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
                r = ratio(runA[f.name], f, DIFF / f"unstable-{f.name}"); worst = max(worst, r)
                if r > STABLE: problems.append(f"{f.name} unstable between two runs: {r:.4f} of the pixels changed (limit {STABLE})")
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
            r = ratio(gold[g.name], g, DIFF / f"golden-{g.name}")
            if r > GOLDEN: problems.append(f"{g.name} differs from its golden: {r:.4f} of the pixels (limit {GOLDEN}); see tools/golden/_diff/")
        note(f"goldens compared: {len(list(cand.glob('*.png'))) - miss}, without golden: {miss}")
finally:
    if srv: srv.terminate()
print("FAIL" if problems else "OK: visual gate (stable, sees known defects)", *problems, sep="\n - " if problems else "")
sys.exit(1 if problems else 0)
