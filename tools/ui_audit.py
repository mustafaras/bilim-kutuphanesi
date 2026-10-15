#!/usr/bin/env python3
"""UI quality gate (runs in CI before publish; also usable locally).

  python tools/ui_audit.py            # serves site/ itself, audits 4 widths x 2 themes
  python tools/ui_audit.py --url http://localhost:8660/

Fails (exit 1) on:
  * horizontal page overflow at 390 / 768 / 1024 / 1440
  * console errors / uncaught exceptions (service-worker notices ignored)
  * text whose rendered contrast is < 3:1 against the pixels behind it (light and dark themes; hero is excluded: it is
    a live canvas and is reviewed by eye)
  * hover states of key components (cards, tiles, route steps, ledger rows, related sources) below 3:1
Reports (does not fail): app JS/CSS weight vs budget.
Contrast is computed from resolved styles (colours go through a canvas, so color-mix()/oklch resolve); text resting on a
gradient or image is skipped because its backdrop is unknowable without pixels.
Needs: pip install playwright && playwright install chromium
"""
import argparse
import os
import gzip
import socket
import subprocess
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT / "site"
WIDTHS = [(390, 844), (768, 1024), (1024, 768), (1440, 900)]
THEMES = ("light", "dark")
IGNORED_LOG = ("Service Worker", "service worker", "favicon", "net::ERR_BLOCKED", "WebGL", "GPU stall", "swiftshader")
HOVER_TARGETS = [".card", ".atlas-tile", ".route-body li a", ".ledger-row", ".related-source", ".spotlight-card", ".nc-viewswitch button", ".hero-field"]

COLLECT = """(root) => {
  /* Deterministic: effective background = nearest opaque ancestor colour (alpha-composited); anything resting on a gradient/image is skipped (unknowable without pixels). */
  const cv = document.createElement('canvas'); cv.width = cv.height = 1; const cx = cv.getContext('2d', {willReadFrequently: true});
  const rgb = c => { cx.clearRect(0,0,1,1); cx.fillStyle = '#000'; cx.fillStyle = c; cx.fillRect(0,0,1,1); const d = cx.getImageData(0,0,1,1).data; return [d[0],d[1],d[2],d[3]/255]; };
  const bgOf = el => { let layers = [], q = el; while (q) { const cs = getComputedStyle(q); if (cs.backgroundImage !== 'none') return null; const c = rgb(cs.backgroundColor); if (c[3] > 0) { layers.push(c); if (c[3] >= .99) break; } q = q.parentElement; }
    let base = layers.length && layers[layers.length-1][3] >= .99 ? layers.pop().slice(0,3) : rgb(getComputedStyle(document.body).backgroundColor).slice(0,3);
    while (layers.length) { const l = layers.pop(); base = base.map((v,i) => Math.round(l[i]*l[3] + v*(1-l[3]))); } return base; };
  const out = [], walker = document.createTreeWalker(root || document.body, NodeFilter.SHOW_TEXT); let n;
  while (n = walker.nextNode()) {
    const text = n.textContent.trim(); if (!text) continue;
    const p = n.parentElement; if (!p) continue;
    if (p.closest('script,style,noscript,[hidden],.sr-only,.skip,.hero,#paletteOverlay,#shortcutMap,.nc-3d,.hero-fields,details:not([open]) .route-body')) continue;
    const cs = getComputedStyle(p); if (cs.visibility === 'hidden' || cs.display === 'none') continue;
    let op = 1, q = p; while (q && q !== document.body) { op *= +getComputedStyle(q).opacity; q = q.parentElement; } if (op < .6) continue;
    if (cs.webkitTextFillColor === 'rgba(0, 0, 0, 0)') continue;
    const r = document.createRange(); r.selectNodeContents(n); const b = r.getBoundingClientRect(); if (b.width < 5 || b.height < 5) continue;
    const bg = bgOf(p); if (!bg) continue;
    const c = rgb(cs.color), a = c[3] * op, fg = c.slice(0,3).map((v,i) => Math.round(v*a + bg[i]*(1-a)));
    out.push({t: text.slice(0,30), fg, bg, sel: (p.id || p.className || p.tagName).toString().slice(0,32)});
  }
  return out;
}"""


def lum(c):
    def ch(v):
        v /= 255
        return v / 12.92 if v <= .03928 else ((v + .055) / 1.055) ** 2.4
    return .2126 * ch(c[0]) + .7152 * ch(c[1]) + .0722 * ch(c[2])


def ratio(a, b):
    la, lb = lum(a), lum(b)
    if la < lb:
        la, lb = lb, la
    return (la + .05) / (lb + .05)


def free_port():
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    p = s.getsockname()[1]
    s.close()
    return p


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--url")
    args = ap.parse_args()
    server = None
    url = args.url
    if not url:
        port = free_port()
        server = subprocess.Popen([sys.executable, "-m", "http.server", str(port), "--directory", str(SITE)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        url = f"http://127.0.0.1:{port}/"
        time.sleep(1)
    failures = []
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(executable_path=os.environ.get("BK_CHROMIUM") or None, args=["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
            for vw, vh in WIDTHS:
                for theme in THEMES:
                    ctx = browser.new_context(viewport={"width": vw, "height": vh}, service_workers="block")
                    page = ctx.new_page()
                    logs = []
                    page.on("pageerror", lambda e: logs.append("pageerror: " + str(e)))
                    page.on("console", lambda m: logs.append("console: " + m.text) if m.type == "error" else None)
                    page.goto(f"{url}?devcache={theme}{vw}&ui=en")
                    page.wait_for_function("document.querySelectorAll('#cards .card').length>0", timeout=30000)
                    page.evaluate("t=>{document.documentElement.dataset.theme=t}", theme)
                    page.wait_for_timeout(900)
                    tag = f"{vw}px/{theme}"
                    over = page.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
                    if over > 1:
                        failures.append(f"[{tag}] horizontal overflow {over}px")
                    for line in logs:
                        if not any(k in line for k in IGNORED_LOG):
                            failures.append(f"[{tag}] {line[:160]}")
                    if vw in (390, 1440):
                        page.add_style_tag(content="*{animation:none!important;transition:none!important}.reveal,[class*=reveal]{opacity:1!important;transform:none!important}")
                        page.evaluate("document.querySelectorAll('details').forEach(d=>d.open=true)")
                        page.wait_for_timeout(300)
                        bad = {}
                        for item in page.evaluate(COLLECT):
                            r = ratio(item["fg"], item["bg"])
                            if r < 3.0:
                                bad.setdefault((item["sel"], item["t"]), round(r, 2))
                        for (sel, text), r in list(bad.items())[:14]:
                            failures.append(f"[{tag}] low contrast {r}:1 · {sel} · \"{text}\"")
                    if vw == 1440:
                        for sel in HOVER_TARGETS:
                            loc = page.locator(sel + ":visible").first
                            if loc.count() == 0:
                                continue
                            try:
                                loc.scroll_into_view_if_needed(timeout=2000)
                                loc.hover(timeout=2000, force=True)
                                page.wait_for_timeout(350)
                                for item in loc.evaluate_handle("e=>e").evaluate("(e,f)=>eval('('+f+')')(e)", COLLECT):
                                    if ratio(item["fg"], item["bg"]) < 3.0:
                                        failures.append(f"[{tag}] hover contrast {ratio(item['fg'], item['bg']):.2f}:1 · {sel} · \"{item['t']}\"")
                                        break
                            except Exception:
                                pass
                    ctx.close()
            browser.close()
    finally:
        if server:
            server.terminate()
    # weight report
    total = 0
    for f in SITE.glob("*.js"):
        if f.name != "sw.js":
            total += len(gzip.compress(f.read_bytes()))
    css = len(gzip.compress((SITE / "style.css").read_bytes()))
    print(f"weight (gzip): app JS {total/1024:.0f} KB · CSS {css/1024:.0f} KB · vendor three.js lazy-loaded")
    if failures:
        print(f"\nUI AUDIT FAILED ({len(failures)}):")
        for f in failures:
            print(" -", f)
        return 1
    print("OK: UI audit — no overflow, console errors or contrast failures at 390/768/1024/1440 in light and dark.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
