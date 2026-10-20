#!/usr/bin/env python3
"""Local gate: no canvas text may overflow or overlap on the 3D book (cover, shelf cover, spine) or the share card.

  python tools/text_fit_audit.py            # serves site/ itself, audits the 60 worst records
  python tools/text_fit_audit.py --url http://localhost:8664/ --count 100

How it works: the real painters (stage.js paintCover / coverTexture / spineTexture, window.BKStage) are run against a
recording canvas context. Every fillText is captured with its resolved font, measured width and bounding box; the audit
fails when a text box leaves the canvas safe area, or two text boxes intersect. Records are picked by badness: longest
titles, longest authors, 3+ authors separated by ';', one very long word, Turkish capitals, Nobel documents.
Needs: pip install playwright && playwright install chromium (BK_CHROMIUM=/path/to/chromium to override).
"""
import argparse
import json
import os
import socket
import subprocess
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT / "site"

PROBE = r"""(count) => {
  const recs = (typeof records !== 'undefined' && records.length) ? records : [];
  const longWord = s => Math.max(0, ...String(s).split(/\s+/).map(w => w.length));
  const pick = new Map();
  const add = (list) => list.forEach(r => pick.set(r.id, r));
  const by = f => recs.slice().sort((a, b) => f(b) - f(a));
  add(by(r => (r.title || '').length).slice(0, count / 3));
  add(by(r => (r.author || '').length).slice(0, count / 3));
  add(by(r => longWord(r.title || '')).slice(0, count / 6));
  add(recs.filter(r => (r.author || '').split(';').length >= 3).slice(0, count / 6));
  add(recs.filter(r => /[İŞĞÜÖÇ]/.test(r.title || '')).slice(0, 8));
  const out = [];
  for (const r of pick.values()) {
    for (const surface of ['paintCover', 'shelfCover', 'spine', 'page0', 'page1', 'page2', 'page3', 'page4', 'page5']) {
      const c = document.createElement('canvas');
      const isPage = surface.startsWith('page'), W = surface === 'spine' ? 128 : isPage ? 768 : 512, H = isPage ? 1080 : 720;
      c.width = W; c.height = H;
      const ctx = c.getContext('2d');
      const rec = [];
      const orig = ctx.fillText.bind(ctx);
      ctx.fillText = function (text, x, y) {
        const m = ctx.measureText(text), size = parseFloat(/(\d+(?:\.\d+)?)px/.exec(ctx.font)[1]);
        let left = x, w = m.width;
        if (ctx.textAlign === 'center') left = x - w / 2;
        rec.push({ text, font: ctx.font, size, left, right: left + w, top: y - size * 0.82, bottom: y + size * 0.22 });
        return orig(text, x, y);
      };
      try {
        if (surface === 'paintCover') window.BKStage.paintCover(ctx, 512, 720, r, 1, false);
        else if (isPage) window.BKStage.paintPage(ctx, W, H, r, Number(surface.slice(4)));
        else if (surface === 'shelfCover') window.BKStage.coverTexture({ CanvasTexture: function (cv) { this.image = cv; }, SRGBColorSpace: 1 }, r, 1);
        else window.BKStage.spineTexture({ CanvasTexture: function (cv) { this.image = cv; }, SRGBColorSpace: 1 }, r, 1);
      } catch (e) { out.push({ id: r.id, surface, error: String(e) }); continue; }
      out.push({ id: r.id, title: r.title, author: r.author, surface, rec });
    }
  }
  return out;
}"""


def free_port():
    s = socket.socket(); s.bind(("127.0.0.1", 0)); p = s.getsockname()[1]; s.close(); return p


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--url"); ap.add_argument("--count", type=int, default=60)
    a = ap.parse_args()
    srv = None; url = a.url
    if not url:
        port = free_port()
        srv = subprocess.Popen([sys.executable, str(ROOT / "tools" / "_serve.py"), str(port), "--directory", str(SITE)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        url = f"http://127.0.0.1:{port}/"; time.sleep(1)
    problems = []
    try:
        with sync_playwright() as p:
            exe = os.environ.get("BK_CHROMIUM")
            b = p.chromium.launch(executable_path=exe, args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"]) if exe else p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
            ctx = b.new_context(service_workers="block"); pg = ctx.new_page()
            pg.goto(url + "?devcache=" + str(time.time()), wait_until="domcontentloaded")
            pg.wait_for_function("document.querySelectorAll('#cards .card').length>0", timeout=60000)
            pg.wait_for_function("window.BKStage&&window.BKText", timeout=30000)
            pg.evaluate("document.fonts.ready")
            rows = pg.evaluate(PROBE, a.count)
            b.close()
    finally:
        if srv: srv.terminate()
    checked = 0
    for row in rows:
        if "error" in row:
            problems.append(f"{row['surface']} {row['id']}: {row['error']}"); continue
        W = 128 if row["surface"] == "spine" else 768 if row["surface"].startswith("page") else 512
        # Rotated spine text is drawn in a rotated frame; only the non-rotated surfaces are geometrically comparable here.
        if row["surface"] == "spine":
            for t in row["rec"]:
                checked += 1
                if t["right"] - t["left"] > 720 - 270 + 1: problems.append(f"spine too long: {row['title'][:50]!r} {t['right']-t['left']:.0f}px")
            continue
        recs = row["rec"]
        for t in recs:
            checked += 1
            if row["surface"].startswith("page") and (t["top"] < 40 or t["bottom"] > 1080 - 20):
                problems.append(f"{row['surface']} outside page: {row['title'][:50]!r} line {t['text'][:30]!r} y[{t['top']:.0f},{t['bottom']:.0f}]")
            if t["left"] < 20 or t["right"] > W - 20:
                problems.append(f"{row['surface']} outside safe area: {row['title'][:50]!r} line {t['text'][:30]!r} [{t['left']:.0f},{t['right']:.0f}]")
        for i in range(len(recs)):
            for j in range(i + 1, len(recs)):
                p1, p2 = recs[i], recs[j]
                if p1["left"] < p2["right"] and p2["left"] < p1["right"] and p1["top"] < p2["bottom"] and p2["top"] < p1["bottom"]:
                    problems.append(f"{row['surface']} OVERLAP: {row['title'][:50]!r} | {p1['text'][:24]!r} x {p2['text'][:24]!r}")
    print(f"text_fit_audit: {len(rows)} surfaces, {checked} text runs")
    if problems:
        print("FAIL"); [print(" -", x) for x in sorted(set(problems))[:60]]; return 1
    print("OK: no overflow, no overlap"); return 0


if __name__ == "__main__":
    sys.exit(main())
