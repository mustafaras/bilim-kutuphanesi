#!/usr/bin/env python3
"""Screen tour (BÖLÜM 4.1): every screen x 2 themes x 3 widths (1440, 1100, 768) -> PNGs + contact sheets, with automatic checks
(horizontal overflow, console errors). Defects that need eyes (overlap, crop, spacing) are read from the contact sheets.

  python tools/screen_tour.py --out docs/tasarim/ekran/v99 [--url http://127.0.0.1:8671/] [--widths 1440,1100,768]
Screens: hero, atlas, shelf, nobel (silhouette/chart/galaxy), catalogue (cards, list, empty), routes, archives, footer,
record (summary, citation, 3D book, constellation), palette (empty, results), shortcut map."""
import argparse, os, sys, time
from pathlib import Path
from playwright.sync_api import sync_playwright
ap = argparse.ArgumentParser(); ap.add_argument("--out", required=True); ap.add_argument("--url", default="http://127.0.0.1:8671/")
ap.add_argument("--widths", default="1440,1100,768"); ap.add_argument("--themes", default="dark,light"); a = ap.parse_args()
out = Path(a.out); out.mkdir(parents=True, exist_ok=True); problems = []
ARGS = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
def goto_sec(pg, sel, wait=2500):
    pg.evaluate(f"(()=>{{const e=document.querySelector({sel!r});if(e)e.scrollIntoView({{block:'start'}})}})()"); pg.wait_for_timeout(wait)
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=os.environ.get("BK_CHROMIUM") or "/opt/pw-browsers/chromium", args=ARGS)
    for w in [int(x) for x in a.widths.split(",")]:
        for theme in a.themes.split(","):
            tag = f"{w}-{theme}"
            pg = b.new_context(viewport={"width": w, "height": 900}, service_workers="block").new_page()
            errs = []; pg.on("pageerror", lambda e: errs.append(str(e))); pg.on("console", lambda m: errs.append(m.text[:200]) if m.type == "error" else None)
            pg.add_init_script("try{localStorage.setItem('bk-test','1')}catch(e){}")
            pg.add_init_script(f"try{{localStorage.setItem('bk-theme','{theme}')}}catch(e){{}}")   # the site's own theme key (setting data-theme directly gets overridden on narrow widths)
            pg.goto(a.url + "?tour=" + str(time.time()), wait_until="load")
            pg.wait_for_function('typeof records!=="undefined"&&records.length', timeout=90000); pg.wait_for_timeout(9000)
            shot = lambda name: pg.screenshot(path=str(out / f"{tag}-{name}.png"))
            shot("01-hero")
            goto_sec(pg, "#collections"); shot("02-atlas")
            goto_sec(pg, ".spotlight-section"); shot("03-shelf")
            goto_sec(pg, "#timeline", 6000); shot("04-nobel-silhouette")
            for i, n in ((1, "chart"), (2, "galaxy")):
                pg.evaluate(f"document.querySelectorAll('.nc-viewswitch button')[{i}].click()"); pg.wait_for_timeout(6000); shot(f"05-nobel-{n}")
            goto_sec(pg, "#catalog"); shot("06-catalog-cards")
            pg.evaluate("document.getElementById('viewList').click()"); pg.wait_for_timeout(1500); shot("07-catalog-list")
            pg.evaluate("document.getElementById('viewGrid').click()")
            pg.evaluate("(()=>{const q=document.getElementById('query');q.value='zzzzqqqxxx';q.dispatchEvent(new Event('input',{bubbles:true}))})()"); pg.wait_for_timeout(2500); shot("08-catalog-empty")
            pg.evaluate("(()=>{const q=document.getElementById('query');q.value='';q.dispatchEvent(new Event('input',{bubbles:true}))})()"); pg.wait_for_timeout(800)
            goto_sec(pg, "#routes"); pg.evaluate("(()=>{const d=document.querySelector('#routeList details');if(d)d.open=true})()"); pg.wait_for_timeout(800); shot("09-routes")
            goto_sec(pg, "#archives"); shot("10-archives")
            pg.evaluate("scrollTo(0,document.body.scrollHeight)"); pg.wait_for_timeout(1500); shot("11-footer")
            ov = pg.evaluate("document.documentElement.scrollWidth-document.documentElement.clientWidth")
            if ov > 1: problems.append(f"{tag}: horizontal overflow {ov}px")
            pg.evaluate("openRecord(records[5].id)"); pg.wait_for_timeout(3500); shot("12-record-summary")
            pg.evaluate("document.querySelectorAll('.rv-tab')[1].click()"); pg.wait_for_timeout(1200); shot("13-record-citation")
            pg.evaluate("document.querySelectorAll('.rv-tab')[0].click()"); pg.evaluate("(()=>{const b=document.querySelector('.rv-3d-toggle');if(b)b.click()})()"); pg.wait_for_timeout(9000); shot("14-record-3d")
            pg.evaluate("document.querySelector('.rv-constellation-wrap')&&document.querySelector('.rv-constellation-wrap').scrollIntoView()"); pg.wait_for_timeout(9000); shot("15-record-constellation")
            pg.evaluate("document.getElementById('recordBack').click()"); pg.wait_for_timeout(1200)
            pg.keyboard.press("Control+k"); pg.wait_for_timeout(1500); shot("16-palette-empty")
            pg.keyboard.type("nobel"); pg.wait_for_timeout(2500); shot("17-palette-results")
            pg.keyboard.press("Escape"); pg.wait_for_timeout(600); pg.keyboard.press("?"); pg.wait_for_timeout(1200); shot("18-shortcuts")
            if errs: problems.append(f"{tag}: console errors {errs[:2]}")
            pg.context.close(); print(tag, "done", flush=True)
    b.close()
try:
    from PIL import Image
    for w in a.widths.split(","):
        for theme in a.themes.split(","):
            fs = sorted(out.glob(f"{w}-{theme}-*.png"))
            if not fs: continue
            ims = [Image.open(f) for f in fs]; cw = 420; ch = int(ims[0].height * cw / ims[0].width); cols = 3; rows = (len(ims) + cols - 1) // cols
            S = Image.new("RGB", (cols * cw, rows * ch))
            for i, im in enumerate(ims): S.paste(im.resize((cw, ch)), ((i % cols) * cw, (i // cols) * ch))
            S.save(out / f"sheet-{w}-{theme}.png")
except Exception as e: print("contact sheets skipped:", e)
print("FAIL" if problems else "OK: tour complete, no overflow / console errors", *problems, sep="\n - " if problems else "")
sys.exit(1 if problems else 0)
