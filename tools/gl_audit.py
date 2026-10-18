#!/usr/bin/env python3
"""R1 static gate for the shared GL layer (site/gl.js, window.BKGL). No browser needed.

  python tools/gl_audit.py
1. no module except gl.js listens to webglcontextlost / webglcontextrestored itself (BKGL.watch is the only place);
2. every file that creates a WebGLRenderer registers it with BKGL.watch;
3. gl.js is loaded first among the site scripts, cached by sw.js with the same ?v= as the rest, and syntax-checked by pages.yml;
4. gl.js passes node --check."""
import re, subprocess, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT / "site"
problems = []

for f in sorted(SITE.glob("*.js")):
    if f.name in ("gl.js", "i18n-data.js"): continue
    t = f.read_text(encoding="utf-8")
    n = len(re.findall(r"webglcontext(?:lost|restored)", t))
    if n: problems.append(f"{f.name}: {n} direct webglcontext listener(s); use BKGL.watch")
    if "new THREE.WebGLRenderer(" in t or re.search(r"new \w+\.WebGLRenderer\(", t):
        if "BKGL.watch(" not in t: problems.append(f"{f.name}: creates a WebGLRenderer but never calls BKGL.watch")

gl = SITE / "gl.js"
if not gl.exists():
    problems.append("site/gl.js is missing")
else:
    r = subprocess.run(["node", "--check", str(gl)], capture_output=True, text=True)
    if r.returncode: problems.append("gl.js fails node --check: " + r.stderr[:200])
    html = (SITE / "index.html").read_text(encoding="utf-8")
    scripts = re.findall(r'<script src="([^"]+)"', html)
    if not scripts or not scripts[0].startswith("gl.js"): problems.append(f"gl.js must be the first <script src> in index.html (got {scripts[:2]})")
    ver = re.search(r"\?v=(\d+)", html).group(1)
    sw = (SITE / "sw.js").read_text(encoding="utf-8")
    if f"'gl.js?v={ver}'" not in sw: problems.append(f"sw.js FILES lacks 'gl.js?v={ver}'")
    wf = (ROOT / ".github/workflows/pages.yml").read_text(encoding="utf-8")
    if "node --check site/gl.js" not in wf: problems.append("pages.yml lacks 'node --check site/gl.js'")
    if "tools/gl_audit.py" not in wf: problems.append("pages.yml does not run tools/gl_audit.py")

print("FAIL" if problems else "OK: shared GL layer wired (no direct context listeners, one watch per renderer)", *problems, sep="\n - " if problems else "")
sys.exit(1 if problems else 0)
