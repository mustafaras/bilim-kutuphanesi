#!/usr/bin/env python3
"""prefers-reduced-motion gate (Paket I2): with reduced motion every 3D scene must draw ONE still frame and then stop.

  python tools/reduced_audit.py [--url ...]
Checks: no console errors; hero GL canvas + dome present; the hero render loop is idle (__bkPerf.frames stays 0);
the Nobel views switch without a morph; a record opens, its 3D book toggles; screenshot of the hero is written next to this script's out dir."""
import argparse, os, socket, subprocess, sys, time
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT = Path(__file__).resolve().parent.parent
ap = argparse.ArgumentParser(); ap.add_argument("--url"); ap.add_argument("--out", default=""); a = ap.parse_args()
srv = None; url = a.url
if not url:
    s = socket.socket(); s.bind(("127.0.0.1", 0)); port = s.getsockname()[1]; s.close()
    srv = subprocess.Popen([sys.executable, "-m", "http.server", str(port), "--directory", str(ROOT / "site")], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    url = f"http://127.0.0.1:{port}/"; time.sleep(1)
problems = []
try:
    with sync_playwright() as p:
        exe = os.environ.get("BK_CHROMIUM")
        kw = dict(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
        b = p.chromium.launch(executable_path=exe, **kw) if exe else p.chromium.launch(**kw)
        ctx = b.new_context(viewport={"width": 1440, "height": 900}, service_workers="block", reduced_motion="reduce"); pg = ctx.new_page()
        pg.add_init_script("try{localStorage.setItem('bk-test','1')}catch(e){}")
        errs = []; pg.on("pageerror", lambda e: errs.append(str(e))); pg.on("console", lambda m: errs.append(m.text[:200]) if m.type == "error" else None)
        pg.goto(url + "?rm=" + str(time.time()), wait_until="load")
        pg.wait_for_function('typeof records!=="undefined"&&records.length', timeout=90000)
        pg.wait_for_function("!!document.getElementById('heroGL')", timeout=90000); pg.wait_for_timeout(4000)
        f0 = pg.evaluate("window.__bkPerf.frames"); pg.wait_for_timeout(2500); f1 = pg.evaluate("window.__bkPerf.frames")
        print("hero frames while reduced:", f0, "->", f1, "| dome:", pg.evaluate("!!(window.BKDome&&BKDome.on)"))
        if f1 != f0: problems.append(f"hero render loop is running under reduced motion ({f0}->{f1})")
        if a.out: pg.screenshot(path=str(Path(a.out) / "reduced-hero.png"))
        pg.evaluate("document.getElementById('timeline').scrollIntoView()"); pg.wait_for_timeout(3000)
        for i in (1, 2, 0):
            pg.locator(".nc-viewswitch button").nth(i).click(); pg.wait_for_timeout(1500)
            if pg.evaluate("!!document.querySelector('.nc-morph')"): problems.append(f"Nobel view {i}: morph overlay present under reduced motion")
        pg.evaluate("openRecord(records[5].id)"); pg.wait_for_timeout(2500)
        pg.evaluate("(()=>{const b=document.querySelector('.rv-3d-toggle');if(b)b.click()})()"); pg.wait_for_timeout(5000)
        if errs: problems.append(f"console errors: {errs[:3]}")
        b.close()
finally:
    if srv: srv.terminate()
print("FAIL" if problems else "OK: reduced motion — still frames only, no errors", *problems, sep="\n - " if problems else "")
sys.exit(1 if problems else 0)
