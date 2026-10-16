#!/usr/bin/env python3
"""Local motion check: captures frame sequences (SwiftShader, so timing is slow but the ORDER of states is real).

  python tools/motion_audit.py --out docs/tasarim/ekran/v98 [--url http://127.0.0.1:8671/]
Sequences: hero scroll path (6 stops), star dive (blur + ghost cover -> record), Nobel view switches (3x3), both themes.
Also asserts: exactly one Nobel stage visible per view, no console errors.
Needs BK_CHROMIUM=/path/to/chromium when playwright has no browser of its own."""
import argparse, os, sys, time
from pathlib import Path
from playwright.sync_api import sync_playwright
ap = argparse.ArgumentParser(); ap.add_argument("--out", required=True); ap.add_argument("--url", default="http://127.0.0.1:8671/")
ap.add_argument("--themes", default="dark,light"); a = ap.parse_args()
out = Path(a.out); out.mkdir(parents=True, exist_ok=True); problems = []
ARGS = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
with sync_playwright() as p:
    exe = os.environ.get("BK_CHROMIUM") or "/opt/pw-browsers/chromium"
    b = p.chromium.launch(executable_path=exe, args=ARGS)
    for theme in a.themes.split(","):
        pg = b.new_context(viewport={"width": 1440, "height": 900}, service_workers="block").new_page()
        errs = []; pg.on("pageerror", lambda e: errs.append(str(e))); pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
        pg.goto(a.url + "?m=" + str(time.time()), wait_until="load")
        pg.evaluate(f"document.documentElement.dataset.theme='{theme}'")
        pg.wait_for_function("window.BKHero&&window.BKDome", timeout=90000); pg.wait_for_timeout(4000)
        for y in (0, 150, 300, 450, 600, 800):
            pg.evaluate(f"scrollTo(0,{y})"); pg.wait_for_timeout(2500)
            pg.screenshot(path=str(out / f"scroll-{theme}-{y:04d}.png"))
        pg.evaluate("scrollTo(0,0)"); pg.wait_for_timeout(2500)
        pg.evaluate("BKHero.fly(37)")
        for i in range(9):
            pg.wait_for_timeout(260); pg.screenshot(path=str(out / f"dive-{theme}-{i}.png"))
        pg.wait_for_timeout(2500); pg.screenshot(path=str(out / f"dive-{theme}-record.png"))
        pg.evaluate("document.getElementById('recordBack').click()"); pg.wait_for_timeout(2500)
        pg.evaluate("document.getElementById('timeline').scrollIntoView()"); pg.wait_for_timeout(4000)
        names = ["silet", "grafik", "galaksi"]
        for order in ((0, 1), (1, 2), (2, 0)):
            for i in order:
                pg.locator(".nc-viewswitch button").nth(i).click()
                for k in range(3):
                    pg.wait_for_timeout(450); pg.locator(".nobel-chronicle").screenshot(path=str(out / f"morph-{theme}-{names[order[0]]}-{names[order[1]]}-{k}.png")) if i == order[1] else None
                pg.wait_for_timeout(3500)
                vis = pg.evaluate("""[...document.querySelectorAll('.nc-3d,.nc-chart')].filter(e=>getComputedStyle(e).display!=='none'&&e.getBoundingClientRect().height>20).map(e=>Math.round(e.getBoundingClientRect().height))""")
                if len(vis) != 1: problems.append(f"{theme} view {names[i]}: {len(vis)} stages visible {vis}")
        if errs: problems.append(f"{theme} console errors: {errs[:3]}")
        print(theme, "done")
    b.close()
print("FAIL" if problems else "OK: one stage per view, no console errors", *problems, sep="\n - " if problems else "")
sys.exit(1 if problems else 0)
