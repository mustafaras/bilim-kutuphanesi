#!/usr/bin/env python3
"""Leak gate (Paket I4, A6 slope test): open/close a record N times (3D book toggled on every other round) and check that nothing accumulates.

  python tools/leak_audit.py [--url http://127.0.0.1:8671/] [--rounds 40]
Checks: <canvas> count back to baseline; shared-renderer geometries and textures (BKStage.info()) must not GROW LINEARLY: the least-squares slope over the second half of the
rounds must stay <= 0.1 per round (a fixed +24 limit missed the v121 shadow-map leak: ~0.45 textures per round, 21 after 40 rounds); no console errors.
Needs >= 16 rounds for the slope test. Software GL is fine: these are counts, not timings."""
import argparse, os, socket, subprocess, sys, time
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT = Path(__file__).resolve().parent.parent
ap = argparse.ArgumentParser(); ap.add_argument("--url"); ap.add_argument("--rounds", type=int, default=40); ap.add_argument("--slope", type=float, default=0.1, help="largest allowed growth per round in the second half")
ap.add_argument("--cross", action="store_true", help="R10.a: cycle skyline <-> galaxy N times instead of opening records, and check that the transition's canvas, render target and program are released every round"); a = ap.parse_args()
srv = None; url = a.url
if not url:
    s = socket.socket(); s.bind(("127.0.0.1", 0)); port = s.getsockname()[1]; s.close()
    srv = subprocess.Popen([sys.executable, str(ROOT / "tools" / "_serve.py"), str(port), "--directory", str(ROOT / "site")], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    url = f"http://127.0.0.1:{port}/"; time.sleep(1)
problems = []
try:
    with sync_playwright() as p:
        exe = os.environ.get("BK_CHROMIUM")
        kw = dict(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
        b = p.chromium.launch(executable_path=exe, **kw) if exe else p.chromium.launch(**kw)
        pg = b.new_context(viewport={"width": 1280, "height": 900}, service_workers="block").new_page()
        pg.add_init_script("try{localStorage.setItem('bk-test','1')}catch(e){}")
        errs = []; pg.on("pageerror", lambda e: errs.append(str(e))); pg.on("console", lambda m: errs.append(m.text[:200]) if m.type == "error" else None)
        pg.goto(url + "?leak=" + str(time.time()), wait_until="load")
        pg.wait_for_function('typeof records!=="undefined"&&records.length&&window.BKStage', timeout=90000); pg.wait_for_timeout(6000)
        count = lambda: pg.evaluate("document.querySelectorAll('canvas').length")
        pg.wait_for_function("document.querySelectorAll('.tile-3d.on').length>=4", timeout=90000)   # atlas tiles mount lazily: baseline only after they exist
        def cycle(i):
            """one open / (3D book on every other round) / close round; waits for the state it needs instead of a fixed time, so a fast machine does not idle and a slow one is still correct"""
            pg.evaluate(f"openRecord(records[{3 + i % 6}].id)"); pg.wait_for_function("(()=>{const v=document.getElementById('recordView');return !!v&&!v.hidden&&!!document.getElementById('recordBack')})()", timeout=60000); pg.wait_for_timeout(500)
            if i % 2 == 0:
                pg.evaluate("(()=>{const b=document.querySelector('.rv-3d-toggle');if(b)b.click()})()")
                try: pg.wait_for_function("!!document.querySelector('.rv-book-ctl')", timeout=60000)
                except Exception: pass
                pg.wait_for_timeout(600)
            pg.evaluate("document.getElementById('recordBack').click()")
            pg.wait_for_function("document.getElementById('recordView').hidden", timeout=60000); pg.wait_for_timeout(400)
        if a.cross:
            # R11: every switch builds ONE program in the field's own context and must release it on exit. The canvas is persistent (it is
            # created once and reused), so a leak shows up as a growing canvas count and a growing BKContinuum.info().programs, and the same
            # slope test applies.
            missed = []
            def cross(i):
                pg.evaluate("(()=>{const b=document.querySelector('[data-v=%s]');if(b)b.click()})()" % ("galaxy" if i % 2 == 0 else "skyline"))
                try: pg.wait_for_function("!!document.querySelector('canvas.nc-field.on')", timeout=60000)
                except Exception: missed.append(i)
                pg.wait_for_function("!document.querySelector('canvas.nc-field.on')", timeout=120000); pg.wait_for_timeout(300)
            # the continuum is off by design at tier 3, and the hero's governor drops to tier 3 within seconds on software GL: without this pin
            # the gate would "pass" while never running a single field frame (it used to swallow the timeout and measure nothing).
            pg.evaluate("window.BKHero&&BKHero.gov&&(BKHero.gov.pin(true),BKHero.gov.setLevel(0))")
            pg.evaluate("document.querySelector('.nc-sky').scrollIntoView({block:'center'})"); pg.wait_for_timeout(1500)
            for i in range(2): cross(i)      # warm-up: the first switch loads three.js and builds the skyline
            missed.clear()                   # switch 0 is a plain cut by design: three.js is still loading, so can() is false
            base = count(); snaps = []
            for i in range(a.rounds):
                cross(i); snaps.append(pg.evaluate("({geometries:0,textures:0,targets:BKContinuum.info().targets,programs:BKContinuum.info().programs,canvases:document.querySelectorAll('canvas').length,exit:BKContinuum.info().exit,points:BKContinuum.info().last&&BKContinuum.info().last.points})"))
            end = count()
            print(f"canvases: baseline {base} -> end {end}")
            print("transition after last switch", snaps[-1])
            if missed: problems.append(f"the field never ran on switch(es) {missed[:5]}: the gate would be measuring a plain cut")
            if any(s_["exit"] != "done" or s_["points"] != 1895 for s_ in snaps): problems.append(f"a switch did not finish a full 1895-record field: {[s_ for s_ in snaps if s_['exit'] != 'done' or s_['points'] != 1895][:3]}")
            if end > base: problems.append(f"canvas count grew {base} -> {end} over {a.rounds} switches")
            if any(s_["targets"] or s_["programs"] for s_ in snaps): problems.append(f"a switch left its render target / program alive: {[s_ for s_ in snaps if s_['targets'] or s_['programs']][:3]}")
            if errs: problems.append(f"console errors: {errs[:3]}")
            b.close()
            if srv: srv.terminate()
            print("FAIL" if problems else "OK: no leaks over %d crosses" % a.rounds, *problems, sep="\n - " if problems else "")
            sys.exit(1 if problems else 0)
        for i in range(2): cycle(i)          # warm-up: first record opens create the per-session helpers
        base = count(); snaps = []
        for i in range(a.rounds):
            cycle(i); snaps.append(pg.evaluate("window.BKStage.info()"))
        end = count()
        warm = snaps[len(snaps) // 2]; last = snaps[-1]
        print(f"canvases: baseline {base} -> end {end}")
        print("renderer memory after round", len(snaps) // 2, warm, "| after last", last)
        if end > base + 1: problems.append(f"canvas count grew {base} -> {end}")
        def slope(v):
            n = len(v); mx = (n - 1) / 2; my = sum(v) / n
            return sum((x - mx) * (y - my) for x, y in zip(range(n), v)) / sum((x - mx) ** 2 for x in range(n))
        if len(snaps) >= 16 and all(snaps):
            for k in ("geometries", "textures"):
                series = [s_[k] for s_ in snaps]; sl = slope(series[len(series) // 2:])
                print(f"{k}: first {series[0]}, middle {series[len(series) // 2]}, last {series[-1]}; slope over the second half {sl:+.3f} per round (limit {a.slope})")
                if sl > a.slope: problems.append(f"{k} grow linearly: slope {sl:+.3f} per round over the last {len(series) - len(series) // 2} rounds (limit {a.slope}); series {series}")
        else: print(f"slope test skipped: needs >= 16 rounds (got {len(snaps)})")
        if errs: problems.append(f"console errors: {errs[:3]}")
        b.close()
finally:
    if srv: srv.terminate()
print("FAIL" if problems else "OK: no leaks over %d open/close rounds" % a.rounds, *problems, sep="\n - " if problems else "")
sys.exit(1 if problems else 0)
