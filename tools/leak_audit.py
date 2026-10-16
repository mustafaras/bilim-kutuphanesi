#!/usr/bin/env python3
"""Leak gate (Paket I4): open/close a record 20 times (3D book toggled on every other round) and check that nothing accumulates.

  python tools/leak_audit.py [--url http://127.0.0.1:8671/] [--rounds 20]
Checks: <canvas> count back to baseline, shared-renderer geometries/textures stop growing after warm-up (BKStage.info()),
no console errors. Software GL is fine: these are counts, not timings."""
import argparse, os, socket, subprocess, sys, time
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT = Path(__file__).resolve().parent.parent
ap = argparse.ArgumentParser(); ap.add_argument("--url"); ap.add_argument("--rounds", type=int, default=20); a = ap.parse_args()
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
        pg = b.new_context(viewport={"width": 1280, "height": 900}, service_workers="block").new_page()
        errs = []; pg.on("pageerror", lambda e: errs.append(str(e))); pg.on("console", lambda m: errs.append(m.text[:200]) if m.type == "error" else None)
        pg.goto(url + "?leak=" + str(time.time()), wait_until="load")
        pg.wait_for_function('typeof records!=="undefined"&&records.length&&window.BKStage', timeout=90000); pg.wait_for_timeout(6000)
        count = lambda: pg.evaluate("document.querySelectorAll('canvas').length")
        base = count(); snaps = []
        for i in range(a.rounds):
            pg.evaluate(f"openRecord(records[{3 + i % 6}].id)"); pg.wait_for_timeout(1800)
            if i % 2 == 0:
                pg.evaluate("(()=>{const b=document.querySelector('.rv-3d-toggle');if(b)b.click()})()"); pg.wait_for_timeout(2500)
            pg.evaluate("document.getElementById('recordBack').click()"); pg.wait_for_timeout(900)
            snaps.append(pg.evaluate("window.BKStage.info()"))
        end = count()
        warm = snaps[len(snaps) // 2]; last = snaps[-1]
        print(f"canvases: baseline {base} -> end {end}")
        print("renderer memory after round", len(snaps) // 2, warm, "| after last", last)
        if end > base + 1: problems.append(f"canvas count grew {base} -> {end}")
        if last and warm and (last["geometries"] > warm["geometries"] + 8 or last["textures"] > warm["textures"] + 24):
            problems.append(f"shared renderer memory still growing: {warm} -> {last}")
        if errs: problems.append(f"console errors: {errs[:3]}")
        b.close()
finally:
    if srv: srv.terminate()
print("FAIL" if problems else "OK: no leaks over %d open/close rounds" % a.rounds, *problems, sep="\n - " if problems else "")
sys.exit(1 if problems else 0)
