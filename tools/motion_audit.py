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
ap.add_argument("--themes", default="dark,light"); ap.add_argument("--quick", action="store_true", help="skip scroll/morph screenshots"); a = ap.parse_args()
out = Path(a.out); out.mkdir(parents=True, exist_ok=True); problems = []
ARGS = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
with sync_playwright() as p:
    exe = os.environ.get("BK_CHROMIUM") or "/opt/pw-browsers/chromium"
    b = p.chromium.launch(executable_path=exe, args=ARGS)
    for theme in a.themes.split(","):
        pg = b.new_context(viewport={"width": 1440, "height": 900}, service_workers="block").new_page()
        pg.add_init_script("try{localStorage.setItem('bk-test','1')}catch(e){}")
        errs = []; pg.on("pageerror", lambda e: errs.append(str(e))); pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
        pg.goto(a.url + "?m=" + str(time.time()), wait_until="load")
        pg.evaluate(f"document.documentElement.dataset.theme='{theme}'")
        pg.wait_for_function("window.BKHero&&window.BKDome", timeout=90000); pg.wait_for_timeout(4000)
        for y in (() if a.quick else (0, 150, 300, 450, 600, 800)):
            pg.evaluate(f"scrollTo(0,{y})"); pg.wait_for_timeout(2500)
            pg.screenshot(path=str(out / f"scroll-{theme}-{y:04d}.png"))
        ai = []
        top = pg.evaluate("document.getElementById('catalog').getBoundingClientRect().top+scrollY")
        for y in (0, top - 900 * 1.2, top - 900 * 0.4):
            pg.evaluate(f"scrollTo(0,{int(max(0, y))})"); pg.wait_for_timeout(1500); ai.append(pg.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--atlas-in')"))
        print(theme, "--atlas-in far/approaching/near the catalogue:", ai)
        if not (float(ai[0]) < 0.05 and float(ai[2]) > float(ai[0]) + 0.3): problems.append(f"{theme}: --atlas-in does not follow scroll {ai}")
        pg.evaluate("scrollTo(0,0)"); pg.wait_for_timeout(2500)
        # in-page sampler (screenshots are far slower than the dive on software GL): ghost rect + record state every frame
        pg.evaluate("""window.__dive=[];(function s(t0){const g=document.querySelector('.fly-ghost'),r=g?g.getBoundingClientRect():null;
          window.__dive.push({t:Math.round(performance.now()-t0),ghost:!!g,w:r?Math.round(r.width):0,h:r?Math.round(r.height):0,x:r?Math.round(r.left+r.width/2):0,rec:!document.getElementById('recordView').hidden});
          if(performance.now()-t0<2600)requestAnimationFrame(()=>s(t0))})(performance.now());BKHero.fly(37)""")
        pg.wait_for_timeout(3000)
        d = pg.evaluate("window.__dive"); gh = [r for r in d if r["ghost"]]
        first_rec = next((r["t"] for r in d if r["rec"]), None)
        print(theme, f"dive: {len(d)} frames, ghost frames {len(gh)}, max ghost {max([r['w'] for r in gh] or [0])}px, record opened at {first_rec}ms")
        if not gh: problems.append(f"{theme}: no ghost cover during the dive")  # (scale progress is not measurable at ~2 fps)
        if first_rec is None: problems.append(f"{theme}: record never opened")
        pg.screenshot(path=str(out / f"dive-{theme}-record.png"))
        pg.evaluate("document.getElementById('recordBack').click()"); pg.wait_for_timeout(2500)
        pg.evaluate("document.getElementById('timeline').scrollIntoView()"); pg.wait_for_timeout(4000)
        names = ["silet", "grafik", "galaksi"]
        for order in (((0, 1), (1, 2), (2, 0)) if not a.quick else ((0, 1),)):
            for i in order:
                pg.locator(".nc-viewswitch button").nth(i).click()
                for k in range(3):
                    pg.wait_for_timeout(450); pg.locator(".nobel-chronicle").screenshot(path=str(out / f"morph-{theme}-{names[order[0]]}-{names[order[1]]}-{k}.png")) if i == order[1] else None
                pg.wait_for_timeout(3500)
                vis = pg.evaluate("""[...document.querySelectorAll('.nc-3d,.nc-chart')].filter(e=>getComputedStyle(e).display!=='none'&&e.getBoundingClientRect().height>20).map(e=>Math.round(e.getBoundingClientRect().height))""")
                if len(vis) != 1: problems.append(f"{theme} view {names[i]}: {len(vis)} stages visible {vis}")
        if errs: problems.append(f"{theme} console errors: {errs[:3]}")
        pg.context.close(); print(theme, "done")
    b.close()
print("FAIL" if problems else "OK: one stage per view, no console errors", *problems, sep="\n - " if problems else "")
sys.exit(1 if problems else 0)
