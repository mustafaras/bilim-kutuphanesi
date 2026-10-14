#!/usr/bin/env python3
"""FAZ-0 font budget and coverage validator.

Checks:
  1. Total size of site/fonts/*.woff2 stays within the performance budget.
  2. Every @font-face in site/style.css declares font-display and unicode-range
     and points at a file that exists.
  3. The declared unicode-range union per font family covers every character
     the Turkish UI needs (both cases).
Exit code is non-zero on any failure so CI blocks publication.
"""
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT / "site"
BUDGET_KB = 170.0
TURKISH_CP = [
    0xE7, 0xC7, 0xF6, 0xD6, 0xFC, 0xDC,        # ç Ç ö Ö ü Ü
    0x11E, 0x11F, 0x130, 0x131, 0x15E, 0x15F,  # Ğ ğ İ ı Ş ş
]
FAMILY_SUBSETS = {"Fraunces", "Inter", "IBM Plex Mono"}


def parse_ranges(spec: str):
    points = set()
    for part in spec.split(","):
        part = part.strip()
        if not part:
            continue
        m = re.fullmatch(r"U\+([0-9A-Fa-f]{4,6})(?:-([0-9A-Fa-f]{4,6}))?", part)
        if not m:
            raise ValueError(f"bad unicode-range entry: {part}")
        lo = int(m.group(1), 16)
        hi = int(m.group(2), 16) if m.group(2) else lo
        points.update(range(lo, hi + 1))
    return points


def main() -> int:
    failures = []

    fonts = sorted((SITE / "fonts").glob("*.woff2"))
    if not fonts:
        failures.append("site/fonts contains no woff2 files")
    else:
        total_kb = sum(f.stat().st_size for f in fonts) / 1024
        print(f"OK: {len(fonts)} font files, {total_kb:.1f} KB total (budget {BUDGET_KB:.0f} KB)")
        if total_kb > BUDGET_KB:
            failures.append(f"font budget exceeded: {total_kb:.1f} KB > {BUDGET_KB:.0f} KB")

    css = (SITE / "style.css").read_text(encoding="utf-8")
    faces = re.findall(r"@font-face\s*\{(.*?)\}", css, re.S)
    if not faces:
        failures.append("no @font-face rules found in style.css")

    coverage = {}
    for i, body in enumerate(faces, 1):
        family = re.search(r"font-family:\s*'([^']+)'", body)
        if not family:
            failures.append(f"@font-face #{i} has no quoted font-family")
            continue
        name = family.group(1)
        if "font-display:" not in body:
            failures.append(f"@font-face {name} #{i} missing font-display")
        rng = re.search(r"unicode-range:\s*([^;]+);", body)
        if not rng:
            failures.append(f"@font-face {name} #{i} missing unicode-range")
        else:
            coverage.setdefault(name, set()).update(parse_ranges(rng.group(1)))
        src = re.search(r"url\(([^)]+)\)", body)
        if not src:
            failures.append(f"@font-face {name} #{i} missing src url")
        elif not (SITE / src.group(1)).exists():
            failures.append(f"@font-face {name} #{i} points at missing file {src.group(1)}")

    for name in sorted(FAMILY_SUBSETS):
        have = coverage.get(name)
        if not have:
            failures.append(f"font family {name} not declared in style.css")
            continue
        missing = [hex(cp) for cp in TURKISH_CP if cp not in have]
        if missing:
            failures.append(f"font family {name} unicode-range misses Turkish codepoints: {missing}")
        else:
            print(f"OK: {name} covers all Turkish UI codepoints")

    if failures:
        for f in failures:
            print(f"FAIL: {f}")
        return 1
    print("OK: font budget, declarations and Turkish coverage all pass.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
