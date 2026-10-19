#!/usr/bin/env python3
"""Command palette gate: light theme, size, action commands, frequent items, match highlight.

  python tools/palette_audit.py        # serves site/ itself
Fails (exit 1) when
  * the palette is not light in the light theme (mean luminance of the panel < 0.7) or its label text has < 4.5:1 contrast on the panel pixels, in either theme;
  * the panel is smaller than 1100 x 640 px at 1440 x 900 (or narrower than 900 px at 1024 x 768);
  * the action source offers fewer than 18 commands, or the new ones (perf panel, 3D quality, shortcut map, clear filters, nobel timeline, light / dark) do not do what they say;
  * an item picked three times does not come back in the empty palette under "frequent";
  * a typed query does not mark its matching letters.
Needs: pip install playwright pillow numpy (+ a chromium; BK_CHROMIUM)."""
import io, os, socket, subprocess, sys, time
from pathlib import Path
import numpy as np
from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
problems = []


def lum(c):
    f = lambda v: (v / 255 / 12.92) if v / 255 <= .03928 else (((v / 255) + .055) / 1.055) ** 2.4
    return .2126 * f(c[0]) + .7152 * f(c[1]) + .0722 * f(c[2])


def contrast(a, b):
    la, lb = lum(a), lum(b)
    return (max(la, lb) + .05) / (min(la, lb) + .05)


with socket.socket() as s:
    s.bind(("127.0.0.1", 0)); port = s.getsockname()[1]
srv = subprocess.Popen([sys.executable, "-m", "http.server", str(port), "--directory", str(ROOT / "site")], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
url = f"http://127.0.0.1:{port}/"; time.sleep(1)
try:
    with sync_playwright() as p:
        kw = dict(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
        exe = os.environ.get("BK_CHROMIUM")
        b = p.chromium.launch(executable_path=exe, **kw) if exe else p.chromium.launch(**kw)
        ctx = b.new_context(viewport={"width": 1440, "height": 900}, service_workers="block")
        pg = ctx.new_page(); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto(url + "?still=1", wait_until="load"); pg.wait_for_function("typeof window.openPalette==='function'&&document.querySelector('.card')", timeout=120000); pg.wait_for_timeout(1500)

        def panel_probe(theme):
            pg.evaluate(f"document.documentElement.dataset.theme='{theme}'"); pg.wait_for_timeout(300)
            pg.evaluate("window.openPalette()"); pg.evaluate("window.paletteQuery('nobel')"); pg.wait_for_timeout(1200)
            box = pg.evaluate("(()=>{const r=document.querySelector('.palette').getBoundingClientRect();return[r.width,r.height]})()")
            img = Image.open(io.BytesIO(pg.locator(".palette").screenshot())).convert("RGB"); a = np.asarray(img).astype(float)
            h, w = a.shape[:2]; body = a[int(h * .25):int(h * .9), int(w * .02):int(w * .55)]
            mean = body.reshape(-1, 3).mean(axis=0); L = lum(mean)
            ink = pg.evaluate("(()=>{const e=document.querySelector('.pk-main strong');return e?getComputedStyle(e).color:null})()")
            nums = [float(x) for x in ink.replace('rgba(', '').replace('rgb(', '').replace(')', '').split(',')[:3]] if ink else [255, 255, 255]
            cr = contrast(nums, mean)
            marks = pg.evaluate("document.querySelectorAll('.pk-main mark, .pk-main .search-match').length")
            print(f"palette {theme}: size {box[0]:.0f}x{box[1]:.0f}, panel luminance {L:.2f}, label contrast {cr:.1f}, marks {marks}")
            if theme == "light" and L < .7: problems.append(f"palette is not light in the light theme (panel luminance {L:.2f}, need >= 0.7)")
            if theme == "dark" and L > .25: problems.append(f"palette lost its dark look in the dark theme (panel luminance {L:.2f})")
            if cr < 4.5: problems.append(f"palette label contrast {cr:.1f}:1 in the {theme} theme (< 4.5)")
            if not marks: problems.append("a typed query does not mark its matching letters")
            pg.evaluate("window.closePalette()")
            return box

        bd = panel_probe("dark"); bl = panel_probe("light")
        for box in (bd, bl):
            if box[0] < 1100 or box[1] < 640: problems.append(f"palette too small at 1440x900: {box[0]:.0f}x{box[1]:.0f} (need >= 1100x640)")

        # action commands
        pg.evaluate("window.openPalette()"); pg.evaluate("window.paletteQuery('>')"); pg.wait_for_timeout(400)
        keys = pg.evaluate("window.paletteResults().map(r=>r.key)"); print("actions", keys)
        if len(set(keys)) < 18: problems.append(f"expected >= 18 palette commands, got {len(set(keys))}")
        for k in ("actPerf", "actQualityLow", "actQualityFull", "actShortcuts", "actClear", "actTimeline", "actLight", "actDark"):
            if k not in keys: problems.append(f"palette lacks the command {k}")
        pick = lambda k: pg.evaluate("k=>{window.openPalette();window.paletteQuery('>');const i=window.paletteResults().findIndex(r=>r.key===k);if(i<0)return false;window.palettePick(i);return true}", k)
        pick("actLight"); pg.wait_for_timeout(200); th = pg.evaluate("document.documentElement.dataset.theme")
        pick("actDark"); pg.wait_for_timeout(200); th2 = pg.evaluate("document.documentElement.dataset.theme")
        if (th, th2) != ("light", "dark"): problems.append(f"light / dark commands must set the theme explicitly: {th}, {th2}")
        was = pg.evaluate("BKGL.flags.get('perf')"); pick("actPerf"); pg.wait_for_timeout(100); now = pg.evaluate("BKGL.flags.get('perf')")
        if was == now: problems.append("the perf command does not toggle the ?perf panel flag"); pick("actPerf")
        else: pick("actPerf")
        if pg.evaluate("window.BKStage&&BKStage.forceLevel")!=None:
            pick("actQualityLow"); pg.wait_for_timeout(300); lo = pg.evaluate("BKStage.diag().level"); pick("actQualityFull"); pg.wait_for_timeout(300); hi = pg.evaluate("BKStage.diag().level")
            if not (lo >= 1 and hi == 0): problems.append(f"3D quality commands must step the stage level (low {lo}, full {hi})")
        pick("actShortcuts"); pg.wait_for_timeout(200)
        if not pg.evaluate("window.shortcutsIsOpen()"): problems.append("the shortcut map command does not open the map")
        pg.keyboard.press("Escape"); pg.wait_for_timeout(200)
        pick("actTimeline"); pg.wait_for_timeout(500)
        if abs(pg.evaluate("document.getElementById('timeline').getBoundingClientRect().top")) > 200: problems.append("the timeline command does not scroll to the Nobel timeline")

        # frequent items: pick one command three times, reopen the empty palette
        pg.evaluate("localStorage.removeItem('bk-palette-recent');localStorage.removeItem('bk-palette-freq')")
        for _ in range(3): pick("actClear"); pg.wait_for_timeout(100)
        pg.evaluate("window.openPalette()"); pg.wait_for_timeout(400)
        top = pg.evaluate("window.paletteResults().map(r=>[r.key,!!r.recent,!!r.freq])"); print("empty palette", top[:6])
        if not any(k == "actClear" and f for k, r, f in top): problems.append(f"an item picked 3 times must appear as frequent in the empty palette: {top[:6]}")
        pg.evaluate("window.closePalette()")

        # narrower window keeps working
        pg.set_viewport_size({"width": 1024, "height": 768}); pg.wait_for_timeout(400)
        pg.evaluate("window.openPalette()"); pg.evaluate("window.paletteQuery('nobel')"); pg.wait_for_timeout(800)
        w = pg.evaluate("document.querySelector('.palette').getBoundingClientRect().width")
        if w < 900: problems.append(f"palette too narrow at 1024x768: {w:.0f}")
        if errs: problems.append(f"page errors: {errs[:3]}")
        b.close()
finally:
    srv.terminate()
print("FAIL" if problems else "OK: command palette", *problems, sep="\n - " if problems else "")
sys.exit(1 if problems else 0)
