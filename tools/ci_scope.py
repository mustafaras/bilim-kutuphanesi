#!/usr/bin/env python3
"""CI scope: which browser slices a pull request needs. Prints GITHUB_OUTPUT lines (hero=, stage=, extras=, all=).

  python tools/ci_scope.py [BASE_REF]      (default origin/main; diff = BASE...HEAD)
A slice that cannot see the change is skipped instead of re-run: a stage.js-only PR does not need the 8 hero-galaxy audits (and vice versa). The UI, text-fit and features always run (they
look at the whole page and cost little). The four visual jobs run when ANY site/** file changed (or when everything runs): a tools-only or CI-only PR cannot move a pixel. Anything in
tools/, the workflow or a shared engine file (gl, shaders, materials, motion) runs everything. A push to main never gets here (the heavy jobs are pull_request-only), so deploys are unaffected."""
import re, subprocess, sys
base = sys.argv[1] if len(sys.argv) > 1 else "origin/main"
try: files = subprocess.run(["git", "diff", "--name-only", f"{base}...HEAD"], capture_output=True, text=True, check=True).stdout.split()
except Exception: files = None   # cannot tell: run everything
SHARED = re.compile(r"^(tools/|\.github/|site/(gl|shaders|materials|motion)\.js$|site/vendor/)")
HERO = re.compile(r"^site/(hero3d|fx|sim|effects|ground3d)\.js$")
STAGE = re.compile(r"^site/(stage|textfit|record)\.js$")
EXTRAS = re.compile(r"^site/(skyline3d|nobel3d|constellation3d|empty3d)\.js$")
SITE = re.compile(r"^site/")
def any_(rx): return files is None or any(rx.search(f) for f in files)
allr = files is None or any(SHARED.search(f) for f in files)
print(f"all={str(allr).lower()}"); print(f"hero={str(allr or any_(HERO)).lower()}"); print(f"stage={str(allr or any_(STAGE)).lower()}"); print(f"extras={str(allr or any_(EXTRAS)).lower()}")
print(f"visual={str(allr or any_(SITE)).lower()}")
