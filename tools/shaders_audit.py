#!/usr/bin/env python3
"""A3 static gate for the shared GLSL part library (site/shaders.js, window.BKShaders). No browser needed (node runs shaders.js for the API checks).

  python tools/shaders_audit.py
1. no shader text outside shaders.js defines a function that BKShaders already provides (same name without the bk_ prefix for hash / noise / fbm / lut / blackbody style helpers,
   or any bk_ name): a second copy is forbidden;
2. a GLSL function name defined in more than one place of site/*.js is a duplicate; the ones that existed before A3 are listed in LEGACY (a ratchet: new duplicates fail, a listed one
   that no longer exists fails too so the list can only shrink);
3. every `x.onBeforeCompile = ...` has a matching `x.customProgramCacheKey` in the same file (or goes through BKShaders.hook): without a key two patched materials can share a program;
4. shaders.js: passes node --check, its chunks resolve (dependencies first, each once), every function is bk_-prefixed and defined once across chunks, use()/key() are stable and versioned;
5. shaders.js is loaded after gl.js and before the scenes that will use it, cached by sw.js with the same ?v=, and pages.yml runs this audit."""
import json, re, subprocess, sys
from collections import defaultdict
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT / "site"
problems = []
read = lambda p: p.read_text(encoding="utf-8")

# GLSL function definitions that already lived in several places before A3 (name -> files). New ones are not allowed; entries go away as the code moves to BKShaders.
LEGACY = {
    "hs": {"ground3d.js", "hero3d.js"},      # value-hash one-liner (ground contours, hero grain)
    "fbm": {"constellation3d.js", "hero3d.js"},
}
DEF = re.compile(r"\b(?:float|vec[234]|mat[234]|int|bool|void)\s+([A-Za-z_]\w*)\s*\([^()]*\)\s*\{")
# helpers BKShaders owns, in the short names other files tend to give them
SHORT = re.compile(r"^(?:hash\w*|ign|snoise\w*|simplex\w*|curl\w*|fbm\w*|lut3d\w*|blackbody\w*|bvcolor\w*)$", re.I)

files = [f for f in sorted(SITE.glob("*.js")) if f.name not in ("i18n-data.js",)]
defs = defaultdict(set)
for f in files:
    t = read(f)
    for m in DEF.finditer(t):
        defs[m.group(1)].add(f.name)

# 1. no second copy of what shaders.js provides
sh = SITE / "shaders.js"
if not sh.exists():
    problems.append("site/shaders.js is missing")
else:
    own = {n for n, fs in defs.items() if "shaders.js" in fs}
    for n, fs in sorted(defs.items()):
        others = fs - {"shaders.js"}
        if not others: continue
        if n in own: problems.append(f"{n}: defined in shaders.js and again in {sorted(others)}")
        elif n.startswith("bk_"): problems.append(f"{n}: a bk_ function outside shaders.js ({sorted(others)})")

# 2. duplicates across files (ratchet)
for n, fs in sorted(defs.items()):
    if len(fs) < 2 or n in ("main",): continue
    if n in LEGACY and fs == LEGACY[n]: continue
    if n in LEGACY: problems.append(f"{n}: duplicate list changed ({sorted(fs)} vs listed {sorted(LEGACY[n])}); update LEGACY")
    else: problems.append(f"{n}: GLSL function defined in several files {sorted(fs)}; move it to BKShaders")
for n in LEGACY:
    if len(defs.get(n, ())) < 2: problems.append(f"LEGACY lists {n} but it is no longer duplicated: remove it from the list")
# a hash-like helper outside shaders.js under a short name is reported as information when it is new (not in LEGACY, single file): keep it visible
extra = sorted((n, sorted(fs)) for n, fs in defs.items() if SHORT.match(n) and "shaders.js" not in fs and n not in LEGACY)
for n, fs in extra: print(f"note: {n} defined in {fs} (a candidate for BKShaders)")

# 3. onBeforeCompile without a cache key
for f in files:
    if f.name == "shaders.js": continue
    t = read(f)
    for m in re.finditer(r"([A-Za-z_][\w.]*)\.onBeforeCompile\s*=(?!=)", t):
        v = re.escape(m.group(1))
        if not re.search(rf"{v}\.customProgramCacheKey\s*=", t): problems.append(f"{f.name}: {m.group(1)}.onBeforeCompile is set without {m.group(1)}.customProgramCacheKey (use BKShaders.hook or set both)")

# 4. shaders.js itself
if sh.exists():
    r = subprocess.run(["node", "--check", str(sh)], capture_output=True, text=True)
    if r.returncode: problems.append("shaders.js fails node --check: " + r.stderr[:200])
    js = r"""
const fs=require('fs');global.window={};global.document={createElement(){return{}}};
eval(fs.readFileSync(process.argv[1],'utf8'));const S=window.BKShaders,out={};
out.names=S.chunks();out.versions=S.versions();
const all=S.use(...out.names);out.bytes=all.length;
const defs=[...all.matchAll(/\b(?:float|vec[234]|mat[234])\s+(\w+)\s*\([^()]*\)\s*\{/g)].map(m=>m[1]);
out.defs=defs;out.dupDefs=defs.filter((n,i)=>defs.indexOf(n)!==i);out.unprefixed=defs.filter(n=>!n.startsWith('bk_'));
out.once=out.names.every(n=>(all.match(new RegExp('// bk:'+n+'@','g'))||[]).length===1);
out.same=S.use('noise','hash','noise')===S.use('noise','hash');out.k1=S.key('t','hash','noise');out.k2=S.key('t','hash','noise');
out.inj=S.inject('a\n#include <common>\nb','hash').indexOf('#include <common>\n// bk:hash@')>=0;
let thrown=false;try{S.use('nope')}catch(e){thrown=true}out.throws=thrown;
const m={};S.hook(m,'tag',()=>1,'hash');out.hooked=typeof m.customProgramCacheKey==='function'&&m.customProgramCacheKey()===S.key('tag','hash')&&typeof m.onBeforeCompile==='function';
const bb=S.bakeBlackbody(64);out.bbLen=bb.length;out.warm=S.js.blackbody(2700);out.sun=S.js.blackbody(5800);out.blue=S.js.blackbody(15000);out.vega=S.js.bvColor(0);out.red=S.js.bvColor(1.6);
let mean=0,lo=1,hi=0;for(let y=0;y<64;y++)for(let x=0;x<64;x++){const v=S.js.ign(x,y);mean+=v;lo=Math.min(lo,v);hi=Math.max(hi,v)}out.ign={mean:mean/4096,lo,hi};
console.log(JSON.stringify(out));"""
    r = subprocess.run(["node", "-e", js, str(sh)], capture_output=True, text=True)
    if r.returncode or not r.stdout.strip(): problems.append("shaders.js did not run under node: " + (r.stderr or r.stdout)[:300])
    else:
        o = json.loads(r.stdout)
        for want in ("hash", "noise", "lut3d", "blackbody", "pom"):
            if want not in o["names"]: problems.append(f"BKShaders lacks the '{want}' chunk")
        if o["dupDefs"]: problems.append(f"BKShaders chunks define a function twice: {o['dupDefs']}")
        if o["unprefixed"]: problems.append(f"BKShaders functions without the bk_ prefix: {o['unprefixed']}")
        if not o["once"]: problems.append("BKShaders.use() must place each chunk exactly once")
        if not o["same"] or o["k1"] != o["k2"] or "hash@" not in o["k1"]: problems.append(f"BKShaders.use()/key() are not stable or versioned: {o['k1']}")
        if not o["inj"]: problems.append("BKShaders.inject() does not place the chunks after #include <common>")
        if not o["throws"]: problems.append("BKShaders.use() must throw on an unknown chunk")
        if not o["hooked"]: problems.append("BKShaders.hook() must set customProgramCacheKey and onBeforeCompile together")
        if o["bbLen"] != 256: problems.append(f"bakeBlackbody(64) should give 64 RGBA texels (256 bytes), got {o['bbLen']}")
        w, s, bl, v, rd = o["warm"], o["sun"], o["blue"], o["vega"], o["red"]
        if not (w[0] > w[2] + .5 and bl[2] > bl[0] + .05 and s[0] >= s[2] and rd[0] > rd[2] + .4 and v[2] >= v[0] - .02): problems.append(f"blackbody colours are off: 2700K {w}, 5800K {s}, 15000K {bl}, B-V 0 {v}, B-V 1.6 {rd}")
        g = o["ign"]
        if not (.45 < g["mean"] < .55 and g["lo"] >= 0 and g["hi"] < 1): problems.append(f"IGN twin is not a uniform [0,1) pattern: {g}")
        print(f"BKShaders {o['names']} ({o['bytes']} bytes of GLSL, {len(o['defs'])} functions)")

# 5. wiring
html = read(SITE / "index.html")
scripts = [s.split("?")[0] for s in re.findall(r'<script src="([^"]+)"', html)]
if "shaders.js" not in scripts: problems.append("index.html does not load shaders.js")
else:
    i = scripts.index("shaders.js")
    if "gl.js" in scripts and scripts.index("gl.js") > i: problems.append("shaders.js must load after gl.js")
    for later in ("hero3d.js", "skyline3d.js", "stage.js", "fx.js"):
        if later in scripts and scripts.index(later) < i: problems.append(f"shaders.js must load before {later}")
ver = re.search(r"\?v=(\d+)", html).group(1)
sw = read(SITE / "sw.js")
if f"'shaders.js?v={ver}'" not in sw: problems.append(f"sw.js FILES lacks 'shaders.js?v={ver}'")
wf = read(ROOT / ".github/workflows/pages.yml")
if "tools/shaders_audit.py" not in wf: problems.append("pages.yml does not run tools/shaders_audit.py")
if "site/*.js" not in wf or "node --check" not in wf: problems.append("pages.yml must syntax-check every site/*.js (shaders.js included)")

print("FAIL" if problems else "OK: shared shader library wired (no copies, program keys set)", *problems, sep="\n - " if problems else "")
sys.exit(1 if problems else 0)
