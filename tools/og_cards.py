#!/usr/bin/env python3
"""FAZ-5 OG/share card generator — offline, build-time.

Produces 1200x630 share cards matching the observatory identity:
  python tools/og_cards.py --default        -> site/og/default.png (committed)
  python tools/og_cards.py --all            -> site/og/<id>.png for every record
  python tools/og_cards.py --ids id1,id2    -> selected records only

No network access; Pillow + a locally available serif/mono/sans TTF only.
Run --all only when you intend to ship per-record cards (adds ~40 KB/record);
the runtime site never depends on this output beyond the default card.
"""
from pathlib import Path
import argparse
import json
import sys

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / "site"
OUT = SITE / "og"
W, H = 1200, 630

FONT_CANDIDATES = {
    "serif": [r"C:\Windows\Fonts\georgia.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf"],
    "sans": [r"C:\Windows\Fonts\inter-Regular.ttf", r"C:\Windows\Fonts\segoeui.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"],
    "mono": [r"C:\Windows\Fonts\Cascadia Mono.ttf", r"C:\Windows\Fonts\consola.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"],
}
SPINE = ["#528584", "#729c7d", "#6b8aab", "#967b9b", "#729c7d", "#6b8aab", "#967b9b", "#b49767"]
SCIENCE = {"01 - Fizik", "02 - Matematik", "15 - Fields, Abel ve Turing"}


def font(kind: str, size: int):
    from PIL import ImageFont
    for path in FONT_CANDIDATES[kind]:
        p = Path(path)
        if p.exists():
            return ImageFont.truetype(str(p), size)
    return ImageFont.load_default()


def seed_of(record_id: str) -> int:
    s = 0
    for ch in str(record_id):
        s = (s * 31 + ord(ch)) & 0xFFFFFFFF
    return s or 7


def wrap(draw, text, fnt, max_w):
    lines, line = [], ""
    for word in str(text).split():
        test = (line + " " + word).strip()
        if draw.textlength(test, font=fnt) > max_w and line:
            lines.append(line)
            line = word
        else:
            line = test
    if line:
        lines.append(line)
    return lines


def render(record, catalog, path):
    from PIL import Image, ImageDraw
    img = Image.new("RGB", (W, H))
    d = ImageDraw.Draw(img)
    # vertical night gradient (scene-0 -> scene-1 -> scene-2)
    top, mid, bot = (4, 7, 14), (8, 23, 42), (19, 50, 74)
    for y in range(H):
        t = y / H
        a, b, k = (top, mid, 0.65) if t < 0.65 else (mid, bot, (t - 0.65) / 0.35)
        if t < 0.65:
            k = t / 0.65
        d.line([(0, y), (W, y)], fill=tuple(int(a[i] + (b[i] - a[i]) * k) for i in range(3)))
    rng = seed_of(record["id"])
    def rnd():
        nonlocal rng
        rng = (rng * 1103515245 + 12345) & 0x7FFFFFFF
        return rng / 0x7FFFFFFF
    for _ in range(130):
        x, y, r = rnd() * W, rnd() * 430, 1 + rnd() * 2
        d.ellipse([x, y, x + r, y + r], fill=(250, 246, 236))
    d.ellipse([1004, 144, 1016, 156], fill=(232, 206, 158))
    d.arc([930, 105, 1090, 195], 0, 360, fill=(232, 206, 158), width=1)
    art = 7 if record.get("category") == "15 - Fields, Abel ve Turing" else 3
    coll = record.get("collection", "books")
    cat = record.get("category", "")
    groups = [["01 - Fizik", "02 - Matematik"], ["05 - Biyoloji ve Sağlık", "14 - Psikoloji ve Psikiyatri"],
              ["06 - Felsefe ve Düşünce", "07 - Tarih, Siyaset ve Hukuk", "08 - Ekonomi ve Çalışma Hayatı", "09 - Sosyal Bilimler"],
              ["12 - Türkçe Edebiyat", "13 - Dünya Klasikleri"], ["03 - Mühendislik ve Enerji", "04 - Bilgisayar ve Veri"],
              ["10 - Çevre ve Ekoloji", "17 - Kimya", "18 - Yer Bilimleri"], ["11 - Sanat, Medya ve Mimarlık", "16 - Bilim Tarihi"]]
    for i, g in enumerate(groups):
        if cat in g:
            art = i
            break
    if coll != "books":
        art = 7
    spine = SPINE[art]
    no = {"books": "BK", "nobel": "NB", "awards": "AW"}.get(coll, "BK") + "-" + str(record["id"])[-4:].upper()
    mono_s = font("mono", 21)
    serif_l = font("serif", 54)
    sans_m = font("sans", 26)
    serif_b = font("serif", 30)
    mono_s2 = font("mono", 17)
    d.rectangle([84, 148, 92, 344], fill=spine)
    d.text((122, 152), (no + " · " + str(record.get("year") or "BILIM KUTUPHANEM")).upper(), font=mono_s, fill=(232, 206, 158))
    y = 238
    for line in wrap(d, record.get("title", ""), serif_l, 880)[:4]:
        d.text((122, y), line, font=serif_l, fill=(250, 246, 236))
        y += 68
    d.text((124, min(y + 20, 460)), str(record.get("author", ""))[:70], font=sans_m, fill=(159, 184, 200))
    d.text((84, 540), "Bilim Kütüphanem", font=serif_b, fill=(250, 246, 236))
    d.text((360, 552), "DEC +41°16′ · RA 12h 30m", font=mono_s2, fill=(159, 184, 200))
    OUT.mkdir(exist_ok=True)
    img.save(path, "PNG", optimize=True)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--default", action="store_true", help="write site/og/default.png")
    ap.add_argument("--all", action="store_true", help="write a card per record")
    ap.add_argument("--ids", help="comma-separated record ids")
    args = ap.parse_args()
    try:
        from PIL import Image  # noqa: F401
    except ImportError:
        print("Pillow is required: pip install pillow", file=sys.stderr)
        return 1
    catalog = json.loads((SITE / "data" / "catalog.json").read_text(encoding="utf-8"))
    by_id = {r["id"]: r for r in catalog["records"]}
    if args.all:
        targets = list(by_id.values())
    elif args.ids:
        targets = [by_id[i] for i in args.ids.split(",") if i in by_id]
    elif args.default:
        targets = None
    else:
        ap.print_help()
        return 1
    OUT.mkdir(exist_ok=True)
    if targets is not None:
        for r in targets:
            render(r, catalog, OUT / (r["id"] + ".png"))
        print(f"OK: {len(targets)} share cards -> {OUT}")
    if args.default or targets is None:
        hero = by_id.get("f1e533fac4fc119031a8") or next(iter(by_id.values()))
        render(hero, catalog, OUT / "default.png")
        print(f"OK: default card -> {OUT / 'default.png'}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
