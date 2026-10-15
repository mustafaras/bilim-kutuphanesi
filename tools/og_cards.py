#!/usr/bin/env python3
"""FAZ-5 build-time OG share cards: one 1200x630 PNG per catalog record -> site/og/<id>.png (+ default.png).

Runs at build time only (Actions step / Guncelle.ps1); the site never requests anything external at runtime.
Cards are rendered with Pillow from the self-hosted fonts in site/fonts (woff2 -> static TTF via fontTools,
cached under .local/og-fonts). Glyphs a font lacks fall back to DejaVu so non-Latin titles still render.

  python tools/og_cards.py                 # all records -> site/og/
  python tools/og_cards.py --limit 20      # quick sample
  python tools/og_cards.py --out /tmp/og   # elsewhere (validate_site.py caps the site/ size)
Needs: pip install pillow fonttools brotli
"""
import argparse
import json
import math
import random
import sys
from functools import lru_cache
from pathlib import Path

from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT / "site"
CACHE = ROOT / ".local" / "og-fonts"
W, H = 1200, 630
BG_TOP, BG_BOT = (6, 10, 18), (16, 26, 42)
TEXT, MUTED, BRASS = (242, 238, 227), (168, 176, 188), (232, 206, 158)
# Same eight "spines" as recordArtIndex() in app.js, brightened for the dark card.
SPINES = [(124, 199, 183), (143, 191, 138), (214, 154, 107), (185, 167, 214),
          (127, 168, 216), (143, 168, 160), (216, 160, 90), (232, 206, 158)]
GROUPS = {"01 - Fizik": 0, "02 - Matematik": 0, "15 - Fields, Abel ve Turing": 7,
          "05 - Biyoloji ve Sağlık": 1, "14 - Psikoloji ve Psikiyatri": 1,
          "06 - Felsefe ve Düşünce": 2, "07 - Tarih, Siyaset ve Hukuk": 2, "08 - Ekonomi ve Çalışma Hayatı": 2, "09 - Sosyal Bilimler": 2,
          "12 - Türkçe Edebiyat": 3, "13 - Dünya Klasikleri": 3,
          "03 - Mühendislik ve Enerji": 4, "04 - Bilgisayar ve Veri": 4,
          "10 - Çevre ve Ekoloji": 5, "17 - Kimya": 5, "18 - Yer Bilimleri": 5,
          "11 - Sanat, Medya ve Mimarlık": 6, "16 - Bilim Tarihi": 6}
COLLECTION_TR = {"books": "KİTAP SEÇKİSİ", "nobel": "NOBEL BELGELERİ", "awards": "NOBEL ÖDÜL KAYDI"}
PREFIX = {"books": "BK", "nobel": "NB", "awards": "AW"}
FALLBACKS = ["/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
             "C:/Windows/Fonts/segoeui.ttf", "/Library/Fonts/Arial Unicode.ttf"]


def art_index(r):
    if r["category"] == "15 - Fields, Abel ve Turing":
        return 7
    return GROUPS.get(r["category"], 3) if r["collection"] == "books" else 7


def static_font(woff2: str, tag: str, axes=None) -> Path:
    """woff2 (possibly variable) -> static TTF in the cache."""
    CACHE.mkdir(parents=True, exist_ok=True)
    out = CACHE / f"{tag}.ttf"
    if not out.exists():
        font = TTFont(SITE / "fonts" / woff2)
        if axes and "fvar" in font:
            font = instancer.instantiateVariableFont(font, axes)
        font.flavor = None
        font.save(out)
    return out


@lru_cache(maxsize=None)
def load_font(path, size):
    return ImageFont.truetype(str(path), size)


@lru_cache(maxsize=None)
def load_cmap(path):
    return TTFont(str(path), lazy=True).getBestCmap()


class Face:
    """Font stack: draws each run with the first font whose cmap has the glyph."""

    def __init__(self, paths, size):
        self.fonts, self.cmaps = [], []
        for p in paths:
            if Path(p).exists():
                self.fonts.append(load_font(str(p), size))
                self.cmaps.append(load_cmap(str(p)))

    def pick(self, ch):
        for i, cmap in enumerate(self.cmaps):
            if ord(ch) in cmap:
                return i
        return 0

    def runs(self, text):
        out = []
        for ch in text:
            i = self.pick(ch)
            if out and out[-1][0] == i:
                out[-1][1] += ch
            else:
                out.append([i, ch])
        return out

    def width(self, text, tracking=0):
        return sum(self.fonts[i].getlength(s) for i, s in self.runs(text)) + tracking * len(text)

    def draw(self, d, xy, text, fill, tracking=0):
        x, y = xy
        for i, s in self.runs(text):
            if tracking:
                for ch in s:
                    d.text((x, y), ch, font=self.fonts[i], fill=fill)
                    x += self.fonts[i].getlength(ch) + tracking
            else:
                d.text((x, y), s, font=self.fonts[i], fill=fill)
                x += self.fonts[i].getlength(s)


def wrap(face, text, max_w):
    lines, cur = [], ""
    for word in text.split():
        trial = (cur + " " + word).strip()
        if face.width(trial) <= max_w:
            cur = trial
            continue
        if cur:
            lines.append(cur)
        cur = ""
        while face.width(word) > max_w:  # very long token: hard-break
            cut = len(word)
            while cut > 1 and face.width(word[:cut]) > max_w:
                cut -= 1
            lines.append(word[:cut])
            word = word[cut:]
        cur = word
    if cur:
        lines.append(cur)
    return lines


def fit_title(paths, text, max_w, max_h, min_size=None):
    """Largest size that fits the box; with min_size, returns (None, ...) instead of shrinking/truncating."""
    for size in range(76, (min_size or 34) - 1, -4):
        face = Face(paths, size)
        lines = wrap(face, text, max_w)
        if len(lines) * size * 1.14 <= max_h:
            return face, lines, size
    if min_size:
        return None, [], 0
    face = Face(paths, 34)
    lines = wrap(face, text, max_w)
    room = int(max_h // (34 * 1.14))
    if len(lines) > room:
        lines = lines[:room]
        while lines[-1] and face.width(lines[-1] + "…") > max_w:
            lines[-1] = lines[-1][:-1]
        lines[-1] = lines[-1].rstrip() + "…"
    return face, lines, 34


def background(seed: str, color):
    img = Image.new("RGB", (W, H))
    d = ImageDraw.Draw(img)
    for y in range(H):
        t = y / (H - 1)
        d.line([(0, y), (W, y)], fill=tuple(round(a + (b - a) * t) for a, b in zip(BG_TOP, BG_BOT)))
    rnd = random.Random(seed)
    for _ in range(70):  # quiet star field
        x, y, r = rnd.randrange(W), rnd.randrange(H), rnd.choice((1, 1, 1, 2))
        a = rnd.uniform(.18, .55)
        c = tuple(round(v * a + bg * (1 - a)) for v, bg in zip((235, 230, 215), (10, 16, 28)))
        d.ellipse((x - r, y - r, x + r, y + r), fill=c)
    d.rectangle((0, 0, 14, H), fill=color)  # spine
    return img, d, rnd


def constellation(d, rnd, color, cx=1004, cy=470, scale=1.0):
    pts = []
    n = rnd.randint(5, 8)
    for i in range(n):
        a = -math.pi / 2 + i * 2 * math.pi / n + rnd.uniform(-.2, .2)
        rr = rnd.uniform(70, 118) * scale
        pts.append((cx + rr * math.cos(a) * 1.15, cy + rr * math.sin(a)))
    dim = tuple(round(c * .55 + v * .45) for c, v in zip(color, BG_BOT))
    for p in pts:
        d.line([(cx, cy), p], fill=dim, width=2)
    for x, y in pts:
        d.ellipse((x - 6, y - 6, x + 6, y + 6), fill=color)
    d.ellipse((cx - 17, cy - 17, cx + 17, cy + 17), outline=BRASS, width=3)
    d.ellipse((cx - 7, cy - 7, cx + 7, cy + 7), fill=BRASS)


def fonts():
    serif = static_font("Fraunces-var-latin.woff2", "fraunces-latin", {"wght": 520, "opsz": 72})
    serif_x = static_font("Fraunces-var-latinext.woff2", "fraunces-latinext", {"wght": 520, "opsz": 72})
    sans = static_font("Inter-var-latin.woff2", "inter-latin", {"wght": 450})
    sans_x = static_font("Inter-var-latinext.woff2", "inter-latinext", {"wght": 450})
    mono = static_font("PlexMono-500-latin.woff2", "mono-latin")
    mono_x = static_font("PlexMono-500-latinext.woff2", "mono-latinext")
    return {"serif": [serif, serif_x, *FALLBACKS], "sans": [sans, sans_x, *FALLBACKS[1:]], "mono": [mono, mono_x, *FALLBACKS[1:]]}


def finish(img, path):
    img.quantize(colors=96, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.FLOYDSTEINBERG).save(path, optimize=True)


def card(r, stack, out: Path):
    color = SPINES[art_index(r)]
    img, d, rnd = background(r["id"], color)
    x0 = 74
    mono, sans = Face(stack["mono"], 22), Face(stack["sans"], 32)
    code = PREFIX.get(r["collection"], "BK") + "-" + str(r["id"])[-4:].upper()
    mono.draw(d, (x0, 58), f"BİLİM KÜTÜPHANEM  ·  {code}", BRASS, tracking=3)
    mono.draw(d, (x0, 96), COLLECTION_TR.get(r["collection"], ""), color, tracking=3)
    # Full width while the title stays above the constellation (y<350); otherwise a narrower column beside it.
    face, lines, size = fit_title(stack["serif"], r["title"], 1000, 180, min_size=60)
    if face is None:
        face, lines, size = fit_title(stack["serif"], r["title"], 700, 340)
    y = 160
    for line in lines:
        face.draw(d, (x0, y), line, TEXT)
        y += round(size * 1.14)
    if r.get("author"):
        author = r["author"]
        while sans.width(author) > 760 and len(author) > 4:
            author = author[:-2]
        if author != r["author"]:
            author = author.rstrip() + "…"
        sans.draw(d, (x0, min(y + 14, 500)), author, MUTED)
    d.line([(x0, 556), (W - x0, 556)], fill=(40, 54, 74), width=1)
    meta = "  ·  ".join(str(v) for v in (r.get("year"), r.get("language"), r.get("kind")) if v)
    small = Face(stack["mono"], 20)
    small.draw(d, (x0, 572), meta[:90], MUTED, tracking=1)
    constellation(d, rnd, color)
    finish(img, out)


def default_card(stack, out: Path):
    color = SPINES[7]
    img, d, rnd = background("bilim-kutuphanem", color)
    x0 = 74
    Face(stack["mono"], 22).draw(d, (x0, 58), "THE KNOWLEDGE LIBRARY  ·  KATALOG", BRASS, tracking=3)
    face = Face(stack["serif"], 104)
    face.draw(d, (x0, 190), "Bilim", TEXT)
    face.draw(d, (x0, 300), "Kütüphanem", BRASS)
    Face(stack["sans"], 32).draw(d, (x0, 450), "Bilim, edebiyat ve Nobel keşifleri için çok dilli katalog.", MUTED)
    d.line([(x0, 556), (W - x0, 556)], fill=(40, 54, 74), width=1)
    Face(stack["mono"], 20).draw(d, (x0, 572), "SCIENCE  ·  LITERATURE  ·  DISCOVERY", MUTED, tracking=1)
    constellation(d, rnd, color, cx=980, cy=330, scale=1.8)
    finish(img, out)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--out", type=Path, default=SITE / "og")
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--ids", nargs="*", default=[])
    args = ap.parse_args()
    data = json.loads((SITE / "data" / "catalog.json").read_text(encoding="utf-8"))
    records = [r for r in data["records"] if not args.ids or r["id"] in args.ids]
    if args.limit:
        records = records[: args.limit]
    args.out.mkdir(parents=True, exist_ok=True)
    stack = fonts()
    default_card(stack, args.out / "default.png")
    for i, r in enumerate(records, 1):
        card(r, stack, args.out / f"{r['id']}.png")
        if i % 500 == 0:
            print(f"  {i}/{len(records)}", flush=True)
    size = sum(p.stat().st_size for p in args.out.glob("*.png"))
    print(f"OK: {len(records)} record cards + default.png -> {args.out} ({size / 1e6:.1f} MB)")


if __name__ == "__main__":
    sys.exit(main())
