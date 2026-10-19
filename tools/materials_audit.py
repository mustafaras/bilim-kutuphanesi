#!/usr/bin/env python3
"""R4 static gate for the shared material and light library (site/materials.js, window.BKMaterials). No browser needed.

  python tools/materials_audit.py
1. stage.js has at most 3 `new m.MeshPhysicalMaterial(` (was 12: the factories live in materials.js);
2. exactly ONE `new ...PMREMGenerator(` in the whole site (non-vendor) code: materials.js bakes the studio for every renderer;
3. tone mapping / exposure is assigned only in materials.js; the material-level helper `lighter` is defined there, not in stage.js;
4. materials.js is loaded before stage.js and skyline3d.js, cached by sw.js with the same ?v= as the rest, and passes node --check;
5. the version string agrees between index.html and sw.js."""
import re, subprocess, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT / "site"
problems = []
read = lambda p: p.read_text(encoding="utf-8")

stage = read(SITE / "stage.js")
phys = len(re.findall(r"new \w+\.MeshPhysicalMaterial\(", stage))
if phys > 3: problems.append(f"stage.js has {phys} 'new m.MeshPhysicalMaterial(' (limit 3: use BKMaterials.foil/cloth/glass/brass)")

pm = {f.name: len(re.findall(r"new [\w.]*PMREMGenerator\(", read(f))) for f in sorted(SITE.glob("*.js")) if f.name != "i18n-data.js"}
total = sum(pm.values())
if total != 1: problems.append(f"expected exactly one PMREMGenerator in site/*.js, found {total}: { {k: v for k, v in pm.items() if v} }")
elif pm.get("materials.js") != 1: problems.append("the single PMREMGenerator must live in materials.js")

for f in sorted(SITE.glob("*.js")):
    if f.name in ("materials.js", "i18n-data.js"): continue
    t = read(f)
    if re.search(r"\.toneMapping\w*\s*=[^=]", t): problems.append(f"{f.name}: assigns toneMapping/exposure itself; use BKMaterials.tone(renderer)")
if re.search(r"function lighter\(", stage): problems.append("stage.js still defines lighter(); it belongs to BKMaterials.lighter")

mat = SITE / "materials.js"
if not mat.exists():
    problems.append("site/materials.js is missing")
else:
    r = subprocess.run(["node", "--check", str(mat)], capture_output=True, text=True)
    if r.returncode: problems.append("materials.js fails node --check: " + r.stderr[:200])
    mt = read(mat)
    for api in ("foil", "cloth", "paper", "glass", "brass", "lighter", "env", "tone", "rebake", "leaf", "fiberHeight", "gilt", "edgeHeight"):
        if not re.search(rf"\b{api}\s*[:(]", mt): problems.append(f"materials.js lacks BKMaterials.{api}")
    html = read(SITE / "index.html")
    scripts = re.findall(r'<script src="([^"]+)"', html)
    names = [s.split("?")[0] for s in scripts]
    if "materials.js" not in names: problems.append("index.html does not load materials.js")
    else:
        for later in ("stage.js", "skyline3d.js"):
            if later in names and names.index("materials.js") > names.index(later): problems.append(f"materials.js must load before {later}")
    # R5: page paper goes through BKMaterials.leaf (fibre normal map, back-face bleed); stage.js must not build page materials inline again
    if re.search(r"pageMat=k=>new \w+\.MeshStandardMaterial", stage): problems.append("stage.js builds the page material inline; use BKMaterials.leaf")
    # R5 step 3: the headband and the page block edges come from the library / a curved tube, not the old straight inline cylinder
    if "TubeGeometry" not in stage: problems.append("stage.js has no curved headband tube (R5 step 3)")
    ver = re.search(r"\?v=(\d+)", html).group(1)
    sw = read(SITE / "sw.js")
    if f"'materials.js?v={ver}'" not in sw: problems.append(f"sw.js FILES lacks 'materials.js?v={ver}'")
    if f"bilim-kutuphane-v{ver}" not in sw: problems.append(f"sw.js CACHE is not v{ver} (index.html has ?v={ver})")
    wf = read(ROOT / ".github/workflows/pages.yml")
    if "site/*.js" not in wf or "node --check" not in wf: problems.append("pages.yml must syntax-check every site/*.js (materials.js included)")
    if "tools/materials_audit.py" not in wf: problems.append("pages.yml does not run tools/materials_audit.py")

print("FAIL" if problems else f"OK: material library wired (stage.js physical materials {phys}, PMREMGenerator {total})", *problems, sep="\n - " if problems else "")
sys.exit(1 if problems else 0)
