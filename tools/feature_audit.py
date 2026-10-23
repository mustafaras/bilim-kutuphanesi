#!/usr/bin/env python3
"""Feature checks for Package A (continuous camera, return flight, governor recovery, atlas dive).

  python tools/feature_audit.py [--url http://127.0.0.1:8671/]
A1 atlas objects dolly in as their tile arrives (camera z shrinks, opacity rises while scrolling down to the tiles);
A2 a record opened from a hero star spawns a return ghost when it closes (and none when opened elsewhere);
A3 the quality governor degrades at once, recovers one level at a time only after sustained fast windows, and locks recovery after a flip-flop;
B8 context loss, B9 broken GPU, B10 quality tiers reach the stage (DPR cap, idle frame rate) and one ?diag panel; B11 GPU timing, ?perf panel and shader warm-up (Long Tasks, zero cost when ?perf is off); B12 shared material/light library (one studio bake per renderer and preset, ACES + exposure in one place and off by default, material levels, kill-switch flag) and the BKShaders chunks compiling; B5 the 3D book opens into a centred reading stage, pages turn and Escape closes it; B6 the medal uses a normal-map relief with a reeded rim; B7 the dome/telescope follows the pointer.
A4 clicking an atlas tile shows the dive (class .diving), delays the filter ~420 ms, then applies it exactly once."""
import json, argparse, os, re, socket, subprocess, sys, time
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT = Path(__file__).resolve().parent.parent
ap = argparse.ArgumentParser(); ap.add_argument("--url"); ap.add_argument("--only", choices=["main", "b9", "b10", "b11", "b12", "b13", "b14", "b15", "b16", "b17", "b18", "b19", "b20", "b21", "b22"], help="run one slice (CI runs the slices as parallel jobs); default runs everything"); a = ap.parse_args()
srv = None
if not a.url:
    s_ = socket.socket(); s_.bind(("127.0.0.1", 0)); port = s_.getsockname()[1]; s_.close()
    srv = subprocess.Popen([sys.executable, str(ROOT / "tools" / "_serve.py"), str(port), "--directory", str(ROOT / "site")], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    a.url = f"http://127.0.0.1:{port}/"; time.sleep(1)
problems = []; note = lambda m: print(m, flush=True)

def b10(b):
    """B10 quality tiers reach the 3D stage: DPR cap 1.5 -> 1.0 from level 2, idle tiles 30 -> 15 fps at level 3, only the hovered tile alive at level 4,
    switchable through BKGL.flags, and ?diag shows a single panel for every scene. Rates are render/frame ratios (software GL is slow but the ratio is not)."""
    ctx = b.new_context(viewport={"width": 1440, "height": 900}, device_scale_factor=2, service_workers="block"); q = ctx.new_page()
    q.add_init_script("try{localStorage.setItem('bk-test','1');localStorage.setItem('bk-theme','dark')}catch(e){}")
    q.goto(a.url + "?diag&b10=" + str(time.time()), wait_until="load")
    q.wait_for_function('window.BKStage&&window.BKMotion&&typeof records!=="undefined"&&records.length', timeout=120000)
    q.wait_for_function("document.querySelectorAll('.tile-3d.on').length>=6", timeout=120000)
    q.evaluate("document.getElementById('collectionGrid').scrollIntoView({block:'start'})"); q.wait_for_timeout(2500)
    try: q.wait_for_function("(()=>{const p=document.querySelector('pre[data-bkgl-diag]');return !!p&&['hero','stage','ground','skyline'].every(n=>p.textContent.includes('\\n'+n+' '))})()", timeout=30000)
    except Exception: pass
    panels = q.evaluate("[...document.querySelectorAll('pre')].filter(e=>getComputedStyle(e).position==='fixed'&&e.style.zIndex==='9999').map(e=>e.textContent)")
    scenes = q.evaluate("window.BKGL?Object.keys(BKGL.diag().scenes):[]")
    note(f"B10 ?diag panels {len(panels)}, scenes {scenes}")
    if len(panels) != 1: problems.append(f"B10 ?diag must show exactly one panel (found {len(panels)})")
    elif not all(f"\n{n} " in panels[0] for n in ("hero", "stage", "ground", "skyline")): problems.append(f"B10 ?diag panel lacks hero/stage/ground/skyline lines: {panels[0][:600]!r}")
    q.evaluate("window.__setQ=BKMotion.quality.set;BKMotion.quality.set=()=>{}")   # pin the tier: the hero's frame-time governor would otherwise move it while we measure
    def measure(level, ms=4000, hover=False, need=0):
        q.evaluate(f"__setQ({level})"); q.wait_for_timeout(2500)
        if hover:
            r = q.evaluate("(()=>{const c=[...document.querySelectorAll('.tile-3d.on')].find(c=>{const r=c.getBoundingClientRect();return r.top>0&&r.bottom<innerHeight});const r=c.getBoundingClientRect();return[r.left+r.width/2,r.top+r.height/2]})()")
            q.mouse.move(r[0], r[1]); q.wait_for_timeout(800)
        else: q.mouse.move(2, 2); q.wait_for_timeout(1200)
        d0 = q.evaluate("BKStage.diag()"); q.wait_for_timeout(ms); d1 = q.evaluate("BKStage.diag()")
        s0, s1 = d0["stats"], d1["stats"]
        # each tile counts its own frames, so a handful of frames quantises the rate (CI runners are slow): keep sampling until there are enough
        for _ in range(12 if need else 0):
            if s1["idleFrames"] - s0["idleFrames"] >= need: break
            q.wait_for_timeout(2500); d1 = q.evaluate("BKStage.diag()"); s1 = d1["stats"]
        ratio = q.evaluate("(()=>{const cs=[...document.querySelectorAll('.tile-3d.on')].filter(c=>{const r=c.getBoundingClientRect();return r.bottom>0&&r.top<innerHeight});return cs.length?cs.reduce((a,c)=>a+c.width/c.clientWidth,0)/cs.length:0})()")
        idle_f = s1["idleFrames"] - s0["idleFrames"]; idle_r = s1["idleRenders"] - s0["idleRenders"]
        return dict(level=q.evaluate("BKMotion.quality.level"), ql=d1["ql"], dpr=round(ratio, 2), idleFrames=idle_f, idleRate=round(idle_r / idle_f, 2) if idle_f else 0.0, idleRenders=idle_r, hoverRenders=s1["hoverRenders"] - s0["hoverRenders"])
    try:
        m0 = measure(0, need=80); m2 = measure(2); m3 = measure(3, need=80); m4 = measure(4); m4h = measure(4, ms=3000, hover=True)
        BKGL_off = q.evaluate("BKGL.flags.set('stagequality',false)")
        mf = measure(3, need=80); q.evaluate("BKGL.flags.set('stagequality',true)")
    except Exception as e:
        problems.append(f"B10 measurement failed: {str(e)[:200]}"); ctx.close(); return
    for k, m in (("L0", m0), ("L2", m2), ("L3", m3), ("L4", m4), ("L4+hover", m4h), ("L3 flag off", mf)): note(f"B10 {k}: {m}")
    if m0["level"] != 0 or m3["level"] != 3: problems.append("B10 quality level did not hold (the hero governor changed it during the measurement)")
    if not (m0["dpr"] >= 1.4): problems.append(f"B10 level 0 should render tiles at DPR 1.5 (got {m0['dpr']})")
    if not (m2["dpr"] <= 1.05 and m3["dpr"] <= 1.05): problems.append(f"B10 level >= 2 must cap tile DPR at 1.0 (L2 {m2['dpr']}, L3 {m3['dpr']})")
    if m0["idleFrames"] < 60 or not (.4 <= m0["idleRate"] <= .6): problems.append(f"B10 level 0 idle tiles should render every 2nd frame (rate {m0['idleRate']} over {m0['idleFrames']} frames)")
    if m3["idleFrames"] < 60 or not (m3["idleRate"] <= .36 and m3["idleRate"] < m0["idleRate"] * .75): problems.append(f"B10 level 3 idle tiles should render every 4th frame (rate {m3['idleRate']} vs L0 {m0['idleRate']})")
    if m4["idleRenders"] > 0: problems.append(f"B10 level 4 must freeze idle tiles ({m4['idleRenders']} idle renders)")
    if m4h["hoverRenders"] < 2 or m4h["idleRenders"] > 0: problems.append(f"B10 level 4 must keep only the hovered tile live (hover renders {m4h['hoverRenders']}, idle renders {m4h['idleRenders']})")
    if not (mf["dpr"] >= 1.4 and .4 <= mf["idleRate"] <= .6): problems.append(f"B10 BKGL.flags stagequality=off must restore the full-quality stage (dpr {mf['dpr']}, rate {mf['idleRate']})")
    q.evaluate("__setQ(0)"); ctx.close()

def b11(b):
    """B11 (R2): GPU timer queries, the ?perf panel and idle shader warm-up.
    1 ?perf off: no panel, the recorder never ran (BKGL.perf.work == 0); long tasks > 50 ms in the first 5 s with warm-up on are not more than with the flag off (warm-up starts after 5 s).
    2 the warm-up really ran (programs compiled) when the browser has KHR_parallel_shader_compile.  3 ?perf on: the panel opens, the hero numbers flow (>= 20 frames sampled), the copy button puts the text on the clipboard.
    4 the GPU timer works against a mock context (result, disjoint discard, no extension -> null) and the hero governor looks at GPU ms before rAF time. Software GL is slow: counts and ratios, not milliseconds."""
    LT = "window.__lt=[];try{new PerformanceObserver(l=>{for(const e of l.getEntries())window.__lt.push([Math.round(e.startTime),Math.round(e.duration)])}).observe({type:'longtask',buffered:true})}catch(e){window.__ltErr=1}"
    def open_page(url, extra="", perms=None):
        ctx = b.new_context(viewport={"width": 1440, "height": 900}, device_scale_factor=1, service_workers="block", permissions=perms or [])
        q = ctx.new_page(); q.add_init_script("try{localStorage.setItem('bk-test','1');localStorage.setItem('bk-theme','dark')}catch(e){}" + extra + LT)
        errs = []; q.on("pageerror", lambda e: errs.append(str(e)))
        q.goto(url, wait_until="load"); return ctx, q, errs
    # 1 + 2: normal load (?perf off), warm-up on. warmforce: software GL has no KHR_parallel_shader_compile, where the warm-up is skipped on purpose; forcing it exercises the whole path
    FORCE = "try{localStorage.setItem('bk-flag-warmforce','1')}catch(e){}"
    ctx, q, errs = open_page(a.url + "?b11=" + str(time.time()), FORCE)
    try:
        q.wait_for_function('window.BKGL&&BKGL.perf&&window.BKStage&&typeof records!=="undefined"&&records.length', timeout=120000)
    except Exception: problems.append("B11 BKGL.perf is missing"); ctx.close(); return
    q.wait_for_timeout(5500)
    on1 = q.evaluate("window.__lt.filter(e=>e[0]<5000&&e[1]>50).length")
    off_state = q.evaluate("({on:BKGL.perf.on,work:BKGL.perf.work,panel:!!document.querySelector('[data-bkgl-perf]')})")
    note(f"B11 ?perf off: {off_state}, long tasks >50 ms in first 5 s (warm-up forced on): {on1}")
    if off_state["on"] or off_state["work"] != 0 or off_state["panel"]: problems.append(f"B11 ?perf off must cost nothing (no panel, recorder idle): {off_state}")
    try: q.wait_for_function("(()=>{const w=BKGL.diag().warm;return w&&w.stage&&w.hero&&['done','skipped','failed'].includes(w.stage.state)&&['done','skipped','failed'].includes(w.hero.state)})()", timeout=120000)
    except Exception: pass
    w = q.evaluate("BKGL.diag().warm"); par = q.evaluate("!!(BKGL.info&&BKGL.info.parallelCompile)")
    note(f"B11 warm-up {w}, parallelCompile {par}")
    if not w or w.get("hero", {}).get("state") != "done" or w.get("stage", {}).get("state") != "done": problems.append(f"B11 warm-up did not finish: {w}")
    elif w["stage"].get("start", 0) < 5000: problems.append(f"B11 warm-up of the books/medal must wait until after the first 5 s (started at {w['stage'].get('start')} ms)")
    elif w["stage"].get("programs", 0) < 3: problems.append(f"B11 warm-up compiled no programs: {w['stage']}")
    ltall = q.evaluate("window.__lt.filter(e=>e[1]>50).map(e=>e.join('@'))"); note(f"B11 all long tasks >50 ms so far (ms@start): {ltall[:14]}")
    ctx.close()
    # the default (no forcing) must not warm without the extension, and the flag must switch it off. Long tasks in the first 5 s: warm-up forced on vs flag off, two loads each (best of two: page-load jitter is large)
    OFF = "try{localStorage.setItem('bk-flag-warm','0')}catch(e){}"
    def first5(extra, tag):
        ctx, q, _ = open_page(a.url + f"?b11{tag}=" + str(time.time()), extra); q.wait_for_timeout(6000)
        n = q.evaluate("window.__lt.filter(e=>e[0]<5000&&e[1]>50).length"); st = q.evaluate("(()=>{const w=BKGL.diag().warm;return w?Object.values(w).map(x=>x.state):[]})()")
        lt_err = q.evaluate("window.__ltErr||0"); ctx.close(); return n, st, lt_err
    on2, _, lerr = first5(FORCE, "on2"); off1, st1, _ = first5(OFF, "off1"); off2, _, _ = first5(OFF, "off2")
    on3, _, _ = first5(FORCE, "on3"); off3, _, _ = first5(OFF, "off3")
    def med(v): v = sorted(v); return v[len(v) // 2]
    on, off = med([on1, on2, on3]), med([off1, off2, off3])
    note(f"B11 long tasks >50 ms in the first 5 s: warm-up on {on1},{on2},{on3} · flag off {off1},{off2},{off3} (off states {st1})")
    if lerr: note("B11 note: Long Task API unavailable in this browser")
    # The deterministic gate is the warm-up start time below (it must be >= 5000 ms). This count is a coarse sanity bound on top of it:
    # on software GL the first 5 s are dominated by page-load work (the skyline, atlas and medal all boot there), so the count swings by
    # several tasks between identical loads. Median of three plus a generous ratio keeps the check meaningful without chasing jitter.
    if on > off * 2 + 3: problems.append(f"B11 warm-up added long tasks in the first 5 s ({on} with, {off} without)")
    if any(x != "off" for x in st1): problems.append(f"B11 warm flag off must not warm anything: {st1}")
    ctx, q, _ = open_page(a.url + "?b11d=" + str(time.time()))
    try: q.wait_for_function("(()=>{const w=BKGL.diag().warm;return !!(w&&w.hero)})()", timeout=120000)   # the hero boots late on software GL
    except Exception: problems.append("B11 the hero never reported a warm-up state")
    dflt = q.evaluate("(()=>{const w=BKGL.diag().warm;return{par:!!(BKGL.info&&BKGL.info.parallelCompile),states:w?Object.values(w).map(x=>x.state):[]}})()"); ctx.close()
    note(f"B11 default config {dflt}")
    if not dflt["par"] and any(x in ("running", "done") for x in dflt["states"]): problems.append(f"B11 without KHR_parallel_shader_compile the warm-up must be skipped (compiling would block the main thread): {dflt}")
    # 3: ?perf on
    ctx, q, errs = open_page(a.url + "?perf&b11p=" + str(time.time()), perms=["clipboard-read", "clipboard-write"])
    try:
        q.wait_for_selector("[data-bkgl-perf]", timeout=60000)
        q.wait_for_function("(()=>{const s=BKGL.perf.stats('hero');return !!s&&s.n>=20})()", timeout=180000)
    except Exception as e:
        problems.append(f"B11 ?perf panel did not open / hero numbers did not flow: {str(e)[:160]}"); ctx.close(); return
    s1 = q.evaluate("BKGL.perf.stats('hero')"); q.wait_for_timeout(3000); s2 = q.evaluate("BKGL.perf.stats('hero')")
    note(f"B11 ?perf hero stats {s1} -> {s2}")
    if s2["frames"] <= s1["frames"]: problems.append(f"B11 ?perf numbers do not flow ({s1['frames']} -> {s2['frames']} frames)")
    for k in ("cpuAvg", "fps", "draws", "tris", "programs"):
        if not (s2[k] > 0): problems.append(f"B11 ?perf hero {k} should be > 0, got {s2[k]}")
    if s2["level"] is None: problems.append("B11 ?perf lacks the quality level")
    ptxt = q.evaluate("document.querySelector('[data-bkgl-perf]').textContent")
    for k in ("GPU", "hero", "draws", "tris", "programs", "L"):
        if k not in ptxt: problems.append(f"B11 ?perf panel text lacks '{k}': {ptxt[:300]!r}")
    q.click("[data-bkgl-perf] button"); q.wait_for_timeout(600)
    clip = None
    try: clip = q.evaluate("navigator.clipboard.readText()")
    except Exception as e: note(f"B11 clipboard read unavailable: {str(e)[:100]}")
    last = q.evaluate("BKGL.perf.lastCopy||''")
    note(f"B11 copy button: lastCopy {len(last)} chars, clipboard {len(clip) if clip is not None else 'n/a'} chars")
    if "BK PERF" not in last or "hero" not in last: problems.append(f"B11 copy button produced no report text: {last[:200]!r}")
    if clip is not None and clip != last: problems.append("B11 copy button did not put the report on the clipboard")
    # 4: timer against a mock context + governor preference
    r = q.evaluate("""(()=>{let cur=null,disj=false;const ext={TIME_ELAPSED_EXT:1,GPU_DISJOINT_EXT:2};
      const g={QUERY_RESULT_AVAILABLE:3,QUERY_RESULT:4,getExtension:n=>n==='EXT_disjoint_timer_query_webgl2'?ext:null,createQuery:()=>({ready:false,ns:0}),beginQuery(t,o){o.ready=false;cur=o},endQuery(){},
       getQueryParameter:(o,p)=>p===3?o.ready:o.ns,getParameter(){const d=disj;disj=false;return d}};
      const T=BKGL.gpuTimer(g);if(!T)return{err:'timer null'};
      const done=ns=>{cur.ns=ns;cur.ready=true};                                     // the GPU finishes the query that is in flight
      T.begin();T.end();done(4e6);T.begin();T.end();const a=T.last;                  // the next begin polls the finished one: 4 ms
      done(9e6);disj=true;T.begin();T.end();const b=T.last,dj=T.disjoint;           // a disjoint event discards the result: still 4, counted
      done(6e6);T.begin();T.end();const c=T.last;
      const none=BKGL.gpuTimer({getExtension:()=>null,createQuery(){}});
      const G=BKHero.gov;G.reset();const t=performance.now()+2e6;
      const fastGpu=G.feed(.05,t,.004);             // rAF says slow (vsync / CPU), the GPU says fine -> stays
      G.reset();const slowGpu=G.feed(.012,t+10,.03); // rAF says fine, the GPU is slow -> degrades
      G.reset();const noGpu=G.feed(.05,t+20);       // no GPU number -> the old rAF rule
      G.reset();return{a,b,dj,c,none,fastGpu,slowGpu,noGpu}})()""")
    note(f"B11 mock timer + governor: {r}")
    if r.get("err") or abs(r["a"] - 4) > .01 or abs(r["b"] - 4) > .01 or r["dj"] != 1 or abs(r["c"] - 6) > .01 or r["none"] is not None: problems.append(f"B11 GPU timer misbehaves: {r}")
    elif not (r["fastGpu"] == 0 and r["slowGpu"] == 1 and r["noGpu"] == 1): problems.append(f"B11 governor must look at GPU ms before rAF time: {r}")
    ctx.close()

def b12(b):
    """B12 shared material and light library (site/materials.js): every renderer gets ONE studio bake per preset (no duplicate PMREMs), tone mapping lives in BKMaterials.tone
    (default NoToneMapping so the R3 goldens stay put; flag acestone = ACES + exposure per theme), the material levels full/standard/lambert/basic are defined there, flag matlib=off degrades to plain standard materials."""
    ctx = b.new_context(viewport={"width": 1440, "height": 900}, service_workers="block"); q = ctx.new_page()
    q.add_init_script("try{localStorage.setItem('bk-test','1');localStorage.setItem('bk-theme','dark')}catch(e){}")
    errs12 = []; q.on("pageerror", lambda e: errs12.append(str(e)[:160]))
    q.goto(a.url + "?b12=" + str(time.time()), wait_until="load")
    q.wait_for_function('window.BKStage&&typeof records!=="undefined"&&records.length', timeout=120000)
    q.wait_for_function("window.BKMaterials&&document.querySelectorAll('.tile-3d.on').length>=6", timeout=120000)
    d = q.evaluate("BKMaterials.diag()"); note(f"B12 diag {d}")
    # A3: every BKShaders chunk compiles in one fragment shader on a real WebGL2 context (nothing else uses the parts yet, so a typo would go unseen)
    st = q.evaluate("window.BKShaders?BKShaders.selfTest():null"); note(f"B12 shaders {st}")
    if not st or not st["ok"]: problems.append(f"B12 BKShaders chunks do not compile: {st}")
    elif not {"hash", "noise", "lut3d", "blackbody"} <= set(st["chunks"]): problems.append(f"B12 BKShaders is missing chunks: {st['chunks']}")
    if not d["envs"] or not any(k.endswith("#book") for k in d["envs"]): problems.append(f"B12 the stage has no 'book' studio bake: {d}")
    if d["bakes"] != len(d["envs"]): problems.append(f"B12 duplicate studio bakes (bakes {d['bakes']} vs {len(d['envs'])} renderer/preset pairs): {d}")
    if any(t["mapping"] != 0 or t["exposure"] != 1 for t in d["tone"]): problems.append(f"B12 default tone mapping must stay NoToneMapping / exposure 1 (R3 goldens): {d['tone']}")
    T = "import('./vendor/three.module.min.js')"
    r = q.evaluate("""async()=>{const T=await %s,M=window.BKMaterials,F=BKGL.flags,out={};
      const kind=m=>m.isMeshPhysicalMaterial?'physical':m.isMeshStandardMaterial?'standard':m.isMeshLambertMaterial?'lambert':m.isMeshBasicMaterial?'basic':'?';
      out.factories=Object.fromEntries(['foil','cloth','glass','brass'].map(n=>[n,kind(M[n](T,{}))]));out.paper=kind(M.paper(T,{}));
      const ph=M.glass(T,{color:0x88aaff,opacity:.5});out.levels=[0,1,2,3].map(l=>kind(M.lighter(T,ph,l)));out.level3Opacity=M.lighter(T,ph,3).opacity;out.names=M.LEVELS;
      F.set('matlib',false);out.off=Object.fromEntries(['foil','cloth','glass','brass'].map(n=>[n,kind(M[n](T,{}))]));F.set('matlib',true);
      F.set('acestone',true);await new Promise(r=>setTimeout(r,50));out.ace=M.diag().tone.map(t=>[t.mapping,t.exposure]);
      document.documentElement.dataset.theme='light';await new Promise(r=>setTimeout(r,80));out.aceLight=M.diag().tone.map(t=>[t.mapping,t.exposure]);
      document.documentElement.dataset.theme='dark';F.set('acestone',false);await new Promise(r=>setTimeout(r,80));out.back=M.diag().tone.map(t=>[t.mapping,t.exposure]);
      const dm=document.createElement('canvas');dm.width=dm.height=8;const tx=new T.CanvasTexture(dm),lf=o=>{const m=M.leaf(T,Object.assign({map:tx,bleedMap:tx,fiber:tx},o||{}));return[kind(m),!!m.normalMap,m.userData.bleed===true,typeof m.onBeforeCompile==='function'&&m.onBeforeCompile!==T.Material.prototype.onBeforeCompile]};
      out.leafOn=lf();F.set('paperfiber',false);out.leafOff=lf();F.set('paperfiber',true);out.fiberH=!!(M.fiberHeight&&M.fiberHeight(64).getContext);
      const gl=o=>{const m=M.gilt?M.gilt(T,Object.assign({color:0xe3c17a},o||{})):null;return m?[kind(m),m.metalness,!!m.normalMap]:null};out.giltOn=gl({normalMap:tx});F.set('gilt',false);out.giltOff=gl({normalMap:tx});F.set('gilt',true);out.edgeH=!!(M.edgeHeight&&M.edgeHeight(64,8,true).getContext);return out}""" % T)
    note(f"B12 {r}")
    if r["factories"] != {"foil": "physical", "cloth": "physical", "glass": "physical", "brass": "physical"} or r["paper"] != "standard": problems.append(f"B12 factory material types wrong: {r['factories']} paper {r['paper']}")
    if r["levels"] != ["physical", "standard", "lambert", "basic"] or r["names"] != ["full", "standard", "lambert", "basic"]: problems.append(f"B12 material levels wrong: {r['levels']} {r['names']}")
    if any(v != "standard" for v in r["off"].values()): problems.append(f"B12 flag matlib=off must degrade every factory to a standard material: {r['off']}")
    if not r["ace"] or any(m != 4 for m, _ in r["ace"]): problems.append(f"B12 flag acestone must switch every renderer to ACES (4): {r['ace']}")
    elif r["ace"][0][1] == r["aceLight"][0][1]: problems.append(f"B12 exposure must differ per theme: dark {r['ace']} light {r['aceLight']}")
    if any(m != 0 or e != 1 for m, e in r["back"]): problems.append(f"B12 acestone off must restore NoToneMapping / exposure 1: {r['back']}")
    if r["leafOn"] != ["standard", True, True, True]: problems.append(f"B12 BKMaterials.leaf must give a standard paper with fibre normal map and back-face bleed shader: {r['leafOn']}")
    if r["leafOff"] != ["standard", False, False, False] or not r["fiberH"]: problems.append(f"B12 flag paperfiber=off must give the plain paper (and fiberHeight must exist): {r['leafOff']} {r['fiberH']}")
    if not r["giltOn"] or r["giltOn"][0] != "physical" or r["giltOn"][1] < .8 or not r["giltOn"][2]: problems.append(f"B12 BKMaterials.gilt must give metallic foil with the ridge normal map: {r['giltOn']}")
    if not r["giltOff"] or r["giltOff"][0] != "standard" or r["giltOff"][2] or not r["edgeH"]: problems.append(f"B12 flag gilt=off must give the plain paper edge (and edgeHeight must exist): {r['giltOff']} {r['edgeH']}")
    if errs12: problems.append(f"B12 page errors: {errs12[:3]}")
    ctx.close()

def b13(b):
    """B13 BKFX (site/fx.js): the single uber post-processing chain. On a private 64x64 renderer: neutral settings reproduce the input (+-2/255), the LUT grade shifts colours subtly (and half
    strength lies in between), the vignette darkens the corner, bloom lights pixels next to a bright quad (and nothing when off), a frame without bloom costs ONE full-screen draw and with
    bloom 13 (1 bright + 10 blur + 1 composite + 1 uber) in at most 5 logical passes, the render-target pool reuses targets, and dispose() gives every texture back."""
    ctx = b.new_context(viewport={"width": 1200, "height": 800}, service_workers="block"); q = ctx.new_page()
    q.add_init_script("try{localStorage.setItem('bk-test','1');localStorage.setItem('bk-theme','dark')}catch(e){}")
    errs = []; q.on("pageerror", lambda e: errs.append(str(e)[:160]))
    q.goto(a.url + "?b13=" + str(time.time()), wait_until="load")
    try: q.wait_for_function("window.BKFX&&window.BKShaders&&window.BKGL", timeout=30000)
    except Exception: problems.append("B13 window.BKFX does not exist (site/fx.js not loaded)"); ctx.close(); return
    r = q.evaluate("""async()=>{const T=await import('./vendor/three.module.min.js'),F=window.BKFX,out={};
      const cv=document.createElement('canvas');cv.width=64;cv.height=64;const rd=new T.WebGLRenderer({canvas:cv,antialias:false,alpha:false}),gl=rd.getContext();rd.setPixelRatio(1);rd.setSize(64,64,false);
      const tex0=rd.info.memory.textures;
      let fb=0;const cf=gl.createFramebuffer.bind(gl),df=gl.deleteFramebuffer.bind(gl);gl.createFramebuffer=()=>{fb++;return cf()};gl.deleteFramebuffer=f=>{fb--;return df(f)};   // live framebuffers = render targets, counted at GL level
      const fx=F.create(rd,T,{theme:'dark'});fx.setSize(64,64);
      const cam=new T.OrthographicCamera(-1,1,1,-1,-1,1);
      const quad=(col,w,h,x,y)=>{const m=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({color:col}));m.position.set(x||0,y||0,0);return m};
      const px=(x,y)=>{const p=new Uint8Array(4);gl.readPixels(x,63-y,1,1,gl.RGBA,gl.UNSIGNED_BYTE,p);return Array.from(p).slice(0,3)};
      const neutral=()=>{Object.assign(fx.u,{uCA:0,uLens:0,uBlur:0,uGrain:0,uVignette:0,uLut:0});fx.bloom.enabled=false};
      const flat=new T.Scene();flat.add(quad(new T.Color(.25,.5,.75),2.2,2.2));      // mid colour, linear values written as they are
      const want=[.25,.5,.75].map(v=>Math.round(v*255));
      neutral();fx.render(flat,cam);out.neutral=px(32,32);out.want=want;out.drawsNeutral=fx.info().draws;
      neutral();fx.u.uLut=1;fx.render(flat,cam);out.lut1=px(32,32);
      neutral();fx.u.uLut=.5;fx.render(flat,cam);out.lut05=px(32,32);
      neutral();fx.u.uVignette=1;fx.render(flat,cam);out.vigC=px(32,32);out.vigE=px(1,1);
      const bright=new T.Scene();bright.add(quad(new T.Color(8,8,8),.12,.12,0,0));
      neutral();fx.render(bright,cam);out.bloomOffNear=px(32+5,32);
      neutral();fx.bloom.enabled=true;fx.streak.enabled=false;fx.render(bright,cam);out.bloomOnNear=px(32+5,32);out.bloomOnFar=px(60,60);out.drawsBloom=fx.info().draws;out.infoBloom=fx.info();
      fx.streak.enabled=true;fx.render(bright,cam);out.infoStreak=fx.info();
      fx.cone.enabled=true;fx.render(bright,cam);out.infoCone=fx.info();fx.cone.enabled=false;fx.streak.enabled=false;   /* R7.e: the volumetric light cone adds exactly 1 draw and 1 pass on top of the streak */   /* R7.d: the anamorphic streak adds exactly 2 draws and 1 pass, no render target */
      neutral();fx.u.uGrain=1;fx.u.uTime=1.25;fx.render(flat,cam);const g1=px(20,20).concat(px(40,11));fx.render(flat,cam);const g2=px(20,20).concat(px(40,11));out.grainStable=JSON.stringify(g1)===JSON.stringify(g2);
      neutral();fx.render(flat,cam);out.infoNeutral=fx.info();
      const t1=fx.info().targets;fx.bloom.enabled=true;fx.render(flat,cam);fx.setSize(96,96);fx.render(flat,cam);fx.setSize(64,64);fx.render(flat,cam);out.targetsAfterResize=fx.info().targets;out.pool=fx.info().pool;
      const live=rd.info.memory.textures;out.fbLive=fb;fx.dispose();out.fbAfter=fb;out.texLive=live;out.texAfter=rd.info.memory.textures;out.tex0=tex0;out.targetsDisposed=fx.info().targets;
      let thrown=false;try{fx.render(flat,cam)}catch(e){thrown=true}out.rendersAfterDispose=!thrown;
      rd.dispose();return out}""")
    note(f"B13 {r}")
    d = lambda p, c: max(abs(x - y) for x, y in zip(p, c))
    if d(r["neutral"], r["want"]) > 2: problems.append(f"B13 neutral uber settings must reproduce the input: got {r['neutral']} want {r['want']}")
    if r["drawsNeutral"] != 1: problems.append(f"B13 a frame without bloom must cost exactly one full-screen draw (got {r['drawsNeutral']})")
    lg = d(r["lut1"], r["neutral"]); lh = d(r["lut05"], r["neutral"])
    if not (3 <= lg <= 40): problems.append(f"B13 dark LUT must shift mid colours subtly (3..40 levels), shifted {lg}: {r['neutral']} -> {r['lut1']}")
    if not (0 < lh < lg): problems.append(f"B13 half LUT strength must lie between none and full ({lh} vs {lg})")
    if not (sum(r["vigE"]) < sum(r["vigC"]) * 0.8): problems.append(f"B13 vignette must darken the corner: centre {r['vigC']} corner {r['vigE']}")
    if max(r["bloomOffNear"]) > 3: problems.append(f"B13 bloom off must leave pixels beside the bright quad dark: {r['bloomOffNear']}")
    if max(r["bloomOnNear"]) < 8 or max(r["bloomOnNear"]) <= max(r["bloomOnFar"]) + 4: problems.append(f"B13 bloom must light pixels beside the bright quad, more than far away: near {r['bloomOnNear']} far {r['bloomOnFar']}")
    if r["drawsBloom"] != 13 or r["infoBloom"]["fullReads"] != 2 or r["infoBloom"]["passes"] > 5: problems.append(f"B13 bloom frame must be 13 full-screen draws / 2 full-resolution reads / <= 5 passes: {r['infoBloom']}")
    cn = r.get("infoCone") or {}
    if cn.get("draws") != 16 or cn.get("passes") != 5 or cn.get("fullReads") != 2 or cn.get("targets") != r["infoBloom"]["targets"] or not cn.get("cone"): problems.append(f"B13 the light cone must add exactly 1 draw and 1 pass on top of the streak (16 / 5 passes), 0 render targets, no extra full-resolution read: {cn} vs {r['infoBloom']}")
    sk = r.get("infoStreak") or {}
    if sk.get("draws") != 15 or sk.get("passes") != 4 or sk.get("fullReads") != 2 or sk.get("targets") != r["infoBloom"]["targets"] or not sk.get("streak"): problems.append(f"B13 the anamorphic streak must add exactly 2 draws and 1 pass (15 / 4 passes), 0 render targets, no extra full-resolution read: {sk} vs {r['infoBloom']}")
    if r["infoNeutral"]["draws"] != 1 or r["infoNeutral"]["fullReads"] != 1: problems.append(f"B13 neutral frame plan wrong: {r['infoNeutral']}")
    if not r["grainStable"]: problems.append("B13 grain must be deterministic for a fixed time (visual gate)")
    if r["targetsAfterResize"] != 12: problems.append(f"B13 chain must hold 12 render targets (scene + bright + 5 + 5), got {r['targetsAfterResize']} after resizing back")
    if r["texAfter"] > r["tex0"]: problems.append(f"B13 dispose() leaked textures: before {r['tex0']}, with the chain {r['texLive']}, after {r['texAfter']}")
    if r["fbLive"] < 12 or r["fbAfter"] != 0: problems.append(f"B13 GL-level render targets: {r['fbLive']} live with the chain (expected >= 12), {r['fbAfter']} left after dispose()")
    if r["targetsDisposed"] != 0: problems.append(f"B13 dispose() must drop every render target ({r['targetsDisposed']} left)")
    if errs: problems.append(f"B13 page errors: {errs[:3]}")
    ctx.close()

def b14(b, extra="", want=512, only_main=False):
    """B14 R7.b GPGPU galaxy (site/sim.js, window.BKSim + vendored GPUComputationRenderer): the hero's star field is simulated in position/velocity float textures.
    Checks: BKHero.info() reports sim 'gpu' with the tier particle counts (262144 / 131072 / 56000 / 14000, drawRange — drawn count must match); a shock-wave kick
    actually moves particles on the GPU (float readback of the position texture, |offset| grows); flag bksim=0 falls back to the CPU dust layer (sim 'cpu', 56000);
    in ?still=1 the simulation never steps and readback stays frozen (the visual gate's determinism).
    R7.f: the default run pins the 512² set (flag sim1m=0, so a real GPU with the memory signal cannot change what this gate measures); B17 runs the same tier/kick checks on the 1024² set (sim1mforce, only_main)."""
    ctx = b.new_context(viewport={"width": 1440, "height": 900}, service_workers="block"); q = ctx.new_page()
    q.add_init_script("try{localStorage.setItem('bk-test','1');localStorage.setItem('bk-theme','dark');" + (extra or "localStorage.setItem('bk-flag-sim1m','0');") + "}catch(e){}")
    errs14 = []; q.on("pageerror", lambda e: errs14.append(str(e)[:160]))
    q.goto(a.url + "?b14=" + str(time.time()), wait_until="load")
    try: q.wait_for_function("window.BKHero&&BKHero.info&&BKHero.info().sim!==undefined&&!!document.querySelector('#heroGL.on')", timeout=180000)
    except Exception: problems.append("B14 the hero never reported a sim mode (BKHero.info().sim missing or hero GL off)"); ctx.close(); return
    q.evaluate("BKHero.gov.pin(true)")   # hold tier 0: the governor on software GL would drop to tier 3 in seconds
    probe = q.evaluate("window.BKGL?BKGL.probe():null") or {}
    if not probe.get("floatRT"):
        note(f"B14 this GL has no float render targets ({probe.get('gpu')}) — the CPU fallback is the correct mode here")
    i0 = q.evaluate("BKHero.info()"); note(f"B14 tier 0: {i0}")
    if probe.get("floatRT"):
        if i0.get("sim") != "gpu": problems.append(f"B14 a float-RT GL must run the GPU sim: {i0}")
        if i0.get("simSize") != want: problems.append(f"B14 the sim must run on the {want}x{want} texture set: {i0}")
        tiers = {512: (262144, 131072, 56000, 14000), 1024: (1048576, 262144, 131072, 56000)}[want]
        for lvl, n in enumerate(tiers):
            info = q.evaluate(f"BKHero.gov.setLevel({lvl}),BKHero.info()")
            note(f"B14 tier {lvl}: {info}")
            if info.get("sim") != "gpu" or info.get("particles") != n or info.get("drawn") != n:
                problems.append(f"B14 tier {lvl} must draw {n} GPU particles via drawRange: {info}")
        q.evaluate("BKHero.gov.setLevel(0)")
        s0 = q.evaluate("window.BKHero.simSample?BKHero.simSample():null")
        if not s0: problems.append("B14 BKHero.simSample() missing or float readback of the position texture failed")
        else:
            note(f"B14 before kick: {s0}")
            q.evaluate("BKHero.simKick()")
            s1 = None
            for _ in range(60):   # software GL: the ring takes many slow frames to sweep the disc
                q.wait_for_timeout(2000); s1 = q.evaluate("BKHero.simSample()")
                if s1 and s1.get("steps", 0) > s0.get("steps", 0) and s1.get("maxAbs", 0) > 0.1: break
            note(f"B14 after kick: {s1}")
            if not s1 or s1.get("steps", 0) <= s0.get("steps", 0): problems.append(f"B14 the GPGPU compute loop never advanced (steps {s0.get('steps')} -> {s1 and s1.get('steps')})")
            elif s1.get("maxAbs", 0) <= 0.1: problems.append(f"B14 the shock kick did not move particles on the GPU (maxAbs {s1.get('maxAbs')})")
    ctx.close()
    if only_main: return
    # ?still=1 — the visual gate captures one frozen frame: the sim must never step there
    ctx2 = b.new_context(viewport={"width": 1440, "height": 900}, service_workers="block"); q2 = ctx2.new_page()
    q2.add_init_script("try{localStorage.setItem('bk-test','1');localStorage.setItem('bk-theme','dark')}catch(e){}")
    q2.goto(a.url + "?still=1&b14s=" + str(time.time()), wait_until="load")
    try:
        q2.wait_for_function("window.BKHero&&BKHero.info&&BKHero.info().sim!==undefined&&!!document.querySelector('#heroGL.on')", timeout=180000)
        a1 = q2.evaluate("BKHero.simSample?BKHero.simSample():null"); q2.wait_for_timeout(4000); a2 = q2.evaluate("BKHero.simSample?BKHero.simSample():null")
        note(f"B14 still: steps {a1 and a1.get('steps')}->{a2 and a2.get('steps')}, maxAbs {a1 and round(a1.get('maxAbs', 0), 5)}->{a2 and round(a2.get('maxAbs', 0), 5)}")
        if not a1: problems.append("B14 BKHero.simSample() missing in ?still")
        else:
            if a1.get("steps", 0) != 0 or a2.get("steps", 0) != 0: problems.append(f"B14 the sim must never step in ?still=1 (steps {a1.get('steps')} -> {a2.get('steps')})")
            if json.dumps(a1) != json.dumps(a2): problems.append("B14 the position texture changed between two samples in ?still=1 (the visual gate would not be deterministic)")
    except Exception as e: problems.append(f"B14 still check failed: {str(e)[:160]}")
    ctx2.close()
    # kill switch: flag bksim=0 restores the CPU dust layer
    ctx3 = b.new_context(viewport={"width": 1440, "height": 900}, service_workers="block"); q3 = ctx3.new_page()
    q3.add_init_script("try{localStorage.setItem('bk-test','1');localStorage.setItem('bk-theme','dark');localStorage.setItem('bk-flag-bksim','0')}catch(e){}")
    q3.goto(a.url + "?b14c=" + str(time.time()), wait_until="load")
    try:
        q3.wait_for_function("window.BKHero&&BKHero.info&&BKHero.info().sim!==undefined&&!!document.querySelector('#heroGL.on')", timeout=180000)
        i3 = q3.evaluate("BKHero.info()"); note(f"B14 flag bksim=0: {i3}")
        if i3.get("sim") != "cpu" or i3.get("particles") != 56000 or i3.get("drawn") != 56000:
            problems.append(f"B14 flag bksim=0 must run the CPU dust path with 56000 stars: {i3}")
    except Exception as e: problems.append(f"B14 CPU fallback check failed: {str(e)[:160]}")
    ctx3.close()
    if errs14: problems.append(f"B14 page errors: {errs14[:3]}")

def b17(b):
    """B17 R7.f: the 1 048 576-star level. With the test flag sim1mforce the sim runs on the 1024x1024 float textures: simSize 1024, tier 0 draws every one of the 1 048 576 stars via drawRange,
    tier 1 draws 262 144, 2 draws 131 072, 3 draws 56 000 (same checks as B14 on the bigger set), a shock kick moves particles through a float readback of the 1024² position texture; the memory signal itself is
    checked by a second page WITHOUT the force flag on this (software) GL: it must stay on 512² — the 1M level never opens on SwiftShader/llvmpipe."""
    b14(b, "localStorage.setItem('bk-flag-sim1mforce','1');", 1024, True)
    ctx = b.new_context(viewport={"width": 1440, "height": 900}, service_workers="block"); q = ctx.new_page()
    q.add_init_script("try{localStorage.setItem('bk-test','1');localStorage.setItem('bk-theme','dark')}catch(e){}")
    q.goto(a.url + "?b17s=" + str(time.time()), wait_until="load")
    try:
        q.wait_for_function("window.BKHero&&BKHero.info&&BKHero.info().sim!==undefined&&!!document.querySelector('#heroGL.on')", timeout=180000)
        i = q.evaluate("BKHero.info()"); probe = q.evaluate("window.BKGL?BKGL.probe():null") or {}
        note(f"B17 default flags on this GL ({probe.get('gpu')}): {i}")
        if probe.get("floatRT") and i.get("sim") == "gpu" and i.get("simSize") != 512 and re.search(r"swiftshader|llvmpipe|basic render|software", probe.get("gpu", ""), re.I):
            problems.append(f"B17 a software GL must never open the 1M level (memory signal): {i}")
    except Exception as e: problems.append(f"B17 memory-signal check failed: {str(e)[:160]}")
    ctx.close()

def b18(b):
    """B18 R7.e dome cinematics: (1) the damped spring maths (BKMotion.springZ): zeta .8 overshoots 0.3-4 % (theory 1.5 %), settles inside 1 s, is frame-step independent (50 ms vs 1/60 s agree), critical damping does not overshoot;
    (2) tier 0, dark: the 24-step light cone and the Lensflare run (info(): cone, flare, passes == 5, draws == 16, 12 render targets); tiers 1-2: the cone becomes the gradient sprite and the Lensflare stays only at tier 1;
    tier 3: none of them; (3) a clicked star aims the dome (BKHero.aim): the azimuth spring moves toward the target and converges; (4) the entrance: running 2.4 s, a deliberate press cancels it (a 350 ms blend, never a jump),
    pointer movement does NOT cancel it, and reduced-motion never starts it."""
    # 1 the spring maths
    ctx = b.new_context(viewport={"width": 1000, "height": 700}, service_workers="block"); q = ctx.new_page(); q.goto(a.url + "?b18m=" + str(time.time()), wait_until="load")
    try: q.wait_for_function("window.BKMotion&&BKMotion.springZ", timeout=60000)
    except Exception: problems.append("B18 BKMotion.springZ is missing"); ctx.close(); return
    sp = q.evaluate("""(()=>{const run=(wn,z,dt,T)=>{const s=BKMotion.springZ(0,wn,z);s.to=1;let mx=0,settle=-1;for(let t=0;t<T;t+=dt){s.step(dt);if(s.x>mx)mx=s.x;if(settle<0&&Math.abs(s.x-1)<.01&&Math.abs(s.v)<.05)settle=t}return{final:s.x,over:mx-1,settle}};
      return{a:run(9.5,.8,1/60,3),c:run(9.5,.8,.05,3),crit:run(9.5,1,1/60,3),slow:run(6,.8,1/60,3)}})()""")
    note(f"B18 spring maths: {sp}")
    A, C, K, SL = sp["a"], sp["c"], sp["crit"], sp["slow"]
    if abs(A["final"] - 1) > .002 or not (.003 < A["over"] < .04): problems.append(f"B18 zeta .8 must settle at the target with a 0.3-4 % overshoot: {A}")
    if not (0 <= A["settle"] < 1.0) or not (0 <= SL["settle"] < 1.4): problems.append(f"B18 the dome spring must settle inside 1 s (aim) / 1.4 s (follow): {A} {SL}")
    if abs(C["over"] - A["over"]) > .01 or abs(C["final"] - 1) > .002: problems.append(f"B18 the spring must not depend on the frame step (1/60 s vs 50 ms): {A} vs {C}")
    if K["over"] > .001: problems.append(f"B18 critical damping must not overshoot: {K}")
    ctx.close()
    # 2-3 the hero
    ctx = b.new_context(viewport={"width": 1440, "height": 900}, service_workers="block"); q = ctx.new_page()
    q.add_init_script("try{localStorage.setItem('bk-test','1');localStorage.setItem('bk-theme','dark');localStorage.setItem('bk-flag-sim1m','0')}catch(e){}")
    errs = []; q.on("pageerror", lambda e: errs.append(str(e)[:160]))
    q.goto(a.url + "?b18=" + str(time.time()), wait_until="load")
    try: q.wait_for_function("window.BKHero&&BKHero.dome&&BKHero.info&&!!document.querySelector('#heroGL.on')", timeout=180000)
    except Exception: problems.append("B18 the hero never came up"); ctx.close(); return
    q.evaluate("BKHero.gov.pin(true)"); q.evaluate("BKHero.gov.setLevel(0)")
    try: q.wait_for_function("(()=>{const d=BKHero.dome(),i=BKHero.info();return !!(d&&d.flareReady&&d.cone&&d.flare&&i.cone&&i.passes===5)})()", timeout=180000)   # info() reports the LAST rendered chain: it shows the cone one frame after dome().cone turned on
    except Exception: problems.append(f"B18 the cone and the Lensflare never started at tier 0: {q.evaluate('BKHero.dome()')} {q.evaluate('BKHero.info()')}")
    i0 = q.evaluate("BKHero.info()"); d0 = q.evaluate("BKHero.dome()"); note(f"B18 tier 0: {i0} | {d0}")
    if not (i0.get("cone") and i0.get("flare") and i0.get("streak")) : problems.append(f"B18 tier 0 must run the cone, the streak and the Lensflare: {i0}")
    if i0.get("passes") != 5 or i0.get("draws") != 16 or i0.get("targets") != 12: problems.append(f"B18 the full chain must be 5 passes / 16 draws / 12 render targets: {i0}")
    if d0.get("coneSteps") != 24 or d0.get("coneStrength", 0) <= 0: problems.append(f"B18 the tier-0 cone is a 24-step march with a positive strength: {d0}")
    for lvl, want_cone, want_sprite, want_flare in ((1, False, True, True), (2, False, True, False), (3, False, False, False)):
        q.evaluate(f"BKHero.gov.setLevel({lvl})")
        cond = "(()=>{const d=BKHero.dome();return d&&d.cone===false&&d.coneSprite===" + ("true" if want_sprite else "false") + "})()"
        try: q.wait_for_function(cond, timeout=120000)
        except Exception: pass
        d = q.evaluate("BKHero.dome()"); note(f"B18 tier {lvl}: {d}")
        if d["cone"] != want_cone or d["coneSprite"] != want_sprite or d["flare"] != want_flare: problems.append(f"B18 tier {lvl} must show cone {want_cone}, gradient sprite {want_sprite}, Lensflare {want_flare}: {d}")
    # 3 aim at tier 3 (cheap frames): the azimuth spring moves toward the aimed star and converges
    q.evaluate("BKHero.gov.setLevel(3)")
    f0 = q.evaluate("BKHero.dome().fa"); hz = q.evaluate("(()=>{const r=document.querySelector('.hero-scene').getBoundingClientRect(),h=window.BKHorizon;return h&&h.w?{left:r.left,ox:h.ox,w:h.w}:null})()")
    if not hz: problems.append("B18 BKHorizon is missing"); ctx.close(); return
    ax = 1300; tx = max(-1, min(1, (ax - hz["left"] - hz["ox"]) / (hz["w"] * .5))); tgt = tx * .42
    q.evaluate(f"BKHero.aim({ax}, 300)"); moved = False; vmax = 0; conv = None
    for _ in range(90):
        q.wait_for_timeout(1000); d = q.evaluate("BKHero.dome()"); vmax = max(vmax, abs(d["va"]))
        if abs(d["fa"] - f0) > .03: moved = True
        if abs(d["fa"] - tgt) < .03 and abs(d["va"]) < .05: conv = d; break
    note(f"B18 aim: start {f0}, target {round(tgt, 3)}, peak |velocity| {round(vmax, 3)}, converged {conv}")
    if abs(tgt - f0) > .06 and not moved: problems.append(f"B18 the aimed dome never turned toward the star (start {f0}, target {tgt})")
    if abs(tgt - f0) > .06 and conv is None: problems.append(f"B18 the dome azimuth never converged on the aimed star (target {tgt}): {q.evaluate('BKHero.dome()')}")
    ctx.close()
    # 4 the entrance
    ctx = b.new_context(viewport={"width": 1440, "height": 900}, service_workers="block"); q = ctx.new_page()
    q.add_init_script("try{localStorage.setItem('bk-test','1');localStorage.setItem('bk-theme','dark');localStorage.setItem('bk-flag-sim1m','0')}catch(e){}")
    q.goto(a.url + "?b18i=" + str(time.time()), wait_until="load")
    try: q.wait_for_function("window.BKHero&&BKHero.introRestart&&!!document.querySelector('#heroGL.on')", timeout=180000)
    except Exception: problems.append("B18 the hero never came up (entrance)"); ctx.close(); return
    q.evaluate("BKHero.gov.pin(true)"); q.evaluate("BKHero.gov.setLevel(3)")
    r0 = q.evaluate("(()=>{BKHero.introRestart();return BKHero.info().intro})()")   # one task: on slow CI a frame between two evaluates could already outlast the 2.4 s entrance
    if r0.get("done") or r0.get("cut"): problems.append(f"B18 a restarted entrance must be running: {r0}")
    q.mouse.move(700, 400); q.mouse.move(760, 430); q.wait_for_timeout(300)
    r1 = q.evaluate("BKHero.info().intro")
    if r1.get("cut"): problems.append(f"B18 pointer movement must NOT cancel the entrance: {r1}")
    q.mouse.down(); q.mouse.up()
    # On a loaded runner the page can lag seconds behind the input dispatch and a single evaluate can land before the press handler has run:
    # wait for the STATE (the press cut the entrance, or it finished on its own) instead of racing it, then wait for the blend to finish by state too (v132, §77).
    try: q.wait_for_function("(()=>{const i=BKHero.info().intro;return i.cut||i.done})()", timeout=60000)
    except Exception: pass
    cut = q.evaluate("BKHero.info().intro"); ok = False
    try: q.wait_for_function("BKHero.info().intro.done", timeout=120000); ok = True
    except Exception: pass
    note(f"B18 entrance: running {r0}, after move {r1}, after press {cut}, finished {ok}")
    if not cut.get("cut") and not ok: problems.append(f"B18 a deliberate press must cancel the entrance: {cut}")
    if not ok: problems.append("B18 the cancelled entrance never finished (the 350 ms blend)")
    ctx.close()
    ctx = b.new_context(viewport={"width": 1440, "height": 900}, service_workers="block", reduced_motion="reduce"); q = ctx.new_page()
    q.add_init_script("try{localStorage.setItem('bk-test','1');localStorage.setItem('bk-theme','dark')}catch(e){}")
    q.goto(a.url + "?b18r=" + str(time.time()), wait_until="load")
    try:
        q.wait_for_function("window.BKHero&&BKHero.info&&!!document.querySelector('#heroGL.on')", timeout=180000)
        rr = q.evaluate("BKHero.info().intro"); note(f"B18 reduced motion: {rr}")
        if not rr.get("done"): problems.append(f"B18 reduced-motion must never start the entrance (a cut): {rr}")
    except Exception as e: problems.append(f"B18 reduced-motion check failed: {str(e)[:160]}")
    ctx.close()

def b15(b):
    """B15 R7.c realistic galaxy (hero GPGPU sim path only): physically-coloured stars (temperature -> the black-body LUT baked by
    BKShaders.bakeBlackbody), dark dust lanes (optical depth on the disc plane with a reddening colour shift), density-wave arm
    brightness contrast, >100 HII emission sprites and a hotter core.
    Checks: tier 0 still draws all 262144 sim particles; BKHero.simFx() exposes the baked LUT (blue-white at the hot end, near-neutral
    at B-V 0.65, deep red at the cold end), a real dust range (tau >= .3), an arm-gain contrast (>= .45), the HII count and the
    uSky/uLut uniforms actually bound on the sim material; flag bksim=0 leaves the CPU path untouched (sim 'cpu', 56000 stars, no
    simFx object — the legacy look and its goldens stay byte-identical)."""
    ctx = b.new_context(viewport={"width": 1440, "height": 900}, service_workers="block"); q = ctx.new_page()
    q.add_init_script("try{localStorage.setItem('bk-test','1');localStorage.setItem('bk-theme','dark');localStorage.setItem('bk-flag-sim1m','0')}catch(e){}")
    errs15 = []; q.on("pageerror", lambda e: errs15.append(str(e)[:160]))
    q.goto(a.url + "?b15=" + str(time.time()), wait_until="load")
    try: q.wait_for_function("window.BKHero&&BKHero.info&&BKHero.info().sim!==undefined&&!!document.querySelector('#heroGL.on')", timeout=180000)
    except Exception: problems.append("B15 the hero never reported a sim mode (BKHero.info().sim missing or hero GL off)"); ctx.close(); return
    q.evaluate("BKHero.gov.pin(true)")
    # software GL boots into the auto-sensing governor's tier before the pin lands; the tier-0 count is only meaningful for an explicitly pinned tier (B14 covers each tier explicitly)
    q.evaluate("BKHero.gov.setLevel(0)")
    probe = q.evaluate("window.BKGL?BKGL.probe():null") or {}
    if not probe.get("floatRT"):
        note(f"B15 this GL has no float render targets ({probe.get('gpu')}) — only the CPU-fallback branch applies here")
    if probe.get("floatRT"):
        i0 = q.evaluate("BKHero.info()"); note(f"B15 tier 0: {i0}")
        if i0.get("sim") != "gpu": problems.append(f"B15 a float-RT GL must run the GPU sim: {i0}")
        if i0.get("drawn") != 262144: problems.append(f"B15 tier 0 must draw all 262144 sim particles: {i0}")
        m = q.evaluate("(()=>{const s=window.__bkSim;return !!(s&&s.material&&s.material.uniforms&&s.material.uniforms.uSky&&s.material.uniforms.uSky.value&&s.material.uniforms.uLut&&s.material.uniforms.uLut.value)})()")
        if not m: problems.append("B15 the sim material must have uSky (dust/arm pattern) and uLut (black-body LUT) bound to live textures")
        f = q.evaluate("BKHero.simFx?BKHero.simFx():null"); note(f"B15 simFx: {f}")
        if not f: problems.append("B15 BKHero.simFx() missing — the R7.c realism layer is not wired into the test hooks")
        else:
            lut = f.get("lut") or {}; cb, cd, cr = lut.get("blue"), lut.get("mid"), lut.get("red")
            if not cb or not cd or not cr: problems.append(f"B15 the black-body LUT report is incomplete: {lut}")
            else:
                if not (cb[2] > cb[0] + .04): problems.append(f"B15 the LUT hot end must be blue-white (b > r + .04): {cb}")
                if max(cd) - min(cd) > .13 or min(cd) < .7: problems.append(f"B15 the LUT mid (B-V 0.65, sun-like) must be bright and near-neutral: {cd}")
                if not (cr[0] > cr[2] + .15): problems.append(f"B15 the LUT cold end must be deep red (r > b + .15): {cr}")
            if f.get("tau", 0) < .3: problems.append(f"B15 the dust optical-depth texture is too faint (tau peak {f.get('tau')}, expected >= .3)")
            g = f.get("gain") or []; gg = g[1] - g[0] if len(g) == 2 else 0
            if gg < .45: problems.append(f"B15 the arm-gain texture has no density-wave contrast (range {gg}, expected >= .45)")
            if f.get("armA", 0) < .15: problems.append(f"B15 the uniform arm gain strength is too weak (armA {f.get('armA')}, expected >= .15)")
            if f.get("hii", 0) < 100: problems.append(f"B15 the HII emission layer needs at least 100 sprites (got {f.get('hii')})")
    ctx.close()
    # kill switch: flag bksim=0 must show the untouched CPU path with no sim hooks (legacy goldens)
    ctx3 = b.new_context(viewport={"width": 1440, "height": 900}, service_workers="block"); q3 = ctx3.new_page()
    q3.add_init_script("try{localStorage.setItem('bk-test','1');localStorage.setItem('bk-theme','dark');localStorage.setItem('bk-flag-bksim','0')}catch(e){}")
    q3.goto(a.url + "?b15c=" + str(time.time()), wait_until="load")
    try:
        q3.wait_for_function("window.BKHero&&BKHero.info&&BKHero.info().sim!==undefined&&!!document.querySelector('#heroGL.on')", timeout=180000)
        i3 = q3.evaluate("BKHero.info()"); fx3 = q3.evaluate("BKHero.simFx?BKHero.simFx():null"); note(f"B15 flag bksim=0: {i3}, simFx {fx3}")
        if i3.get("sim") != "cpu" or i3.get("particles") != 56000 or i3.get("drawn") != 56000:
            problems.append(f"B15 flag bksim=0 must run the untouched CPU dust path with 56000 stars: {i3}")
        if fx3 is not None: problems.append("B15 flag bksim=0 must not expose BKHero.simFx (the CPU path is excluded from the R7.c layer)")
    except Exception as e: problems.append(f"B15 CPU fallback check failed: {str(e)[:160]}")
    ctx3.close()
    if errs15: problems.append(f"B15 page errors: {errs15[:3]}")


def b16(b):
    """B16 R7.d: the diffuse starlight layer (BKHero layer 'disc'), ~300 diffraction beacons, the anamorphic streak in the BKFX chain and the data-driven field tint.
    Checks (sim path, tier 0, dark): simFx() reports disc + >= 100 beacons all shown; the field weights are 8 finite numbers in [.4, 1.7] that are NOT all equal (the library is lopsided, so a flat tint would mean the data
    never reached the shader); info() reports streak true with passes <= 5 and the render-target count unchanged (the streak reuses the bloom's idle quarter-resolution mips); tier 3 hides the beacons and the disc and switches
    the streak off; bksim=0 leaves the legacy path untouched (no simFx object)."""
    ctx = b.new_context(viewport={"width": 1440, "height": 900}, service_workers="block"); q = ctx.new_page()
    q.add_init_script("try{localStorage.setItem('bk-test','1');localStorage.setItem('bk-theme','dark');localStorage.setItem('bk-flag-sim1m','0')}catch(e){}")
    q.goto(a.url + "?b16=" + str(time.time()), wait_until="load")
    try: q.wait_for_function("window.BKHero&&BKHero.info&&BKHero.info().sim!==undefined&&!!document.querySelector('#heroGL.on')", timeout=180000)
    except Exception: problems.append("B16 the hero never reported a sim mode"); ctx.close(); return
    q.evaluate("BKHero.gov.pin(true)"); q.evaluate("BKHero.gov.setLevel(0)")
    probe = q.evaluate("window.BKGL?BKGL.probe():null") or {}
    if probe.get("floatRT"):
        q.wait_for_function("(()=>{const f=BKHero.simFx&&BKHero.simFx();return !!(f&&f.fieldW&&f.fieldW.some(v=>v!==1))})()", timeout=60000)
        f = q.evaluate("BKHero.simFx()"); i0 = q.evaluate("BKHero.info()"); note(f"B16 tier 0: simFx {f} | info {i0}")
        if not f.get("disc") or not f.get("discShown"): problems.append(f"B16 the diffuse starlight layer is missing or hidden at tier 0: {f}")
        if f.get("beacons", 0) < 100 or f.get("beaconsShown") != f.get("beacons"): problems.append(f"B16 tier 0 must show every diffraction beacon (>= 100): {f}")
        w = f.get("fieldW") or []
        if len(w) != 8 or any((not isinstance(v, (int, float))) or v < .4 or v > 1.7 for v in w): problems.append(f"B16 the 8 field weights must be finite numbers in [.4, 1.7]: {w}")
        elif max(w) - min(w) < .1: problems.append(f"B16 every field has the same glow weight — the record counts never reached the shader: {w}")
        if f.get("grain", 0) < 150000 or f.get("grainShown") != f.get("grain"): problems.append(f"B16 tier 0 must draw the whole procedural grain layer (>= 150000 stars): {f}")
        if f.get("deepField", 0) < 40 or not f.get("deepShown"): problems.append(f"B16 the deep-field galaxies must be present and shown at tier 0: {f}")
        if not i0.get("streak"): problems.append(f"B16 the anamorphic streak must run on the dark bloom chain at tier 0: {i0}")
        if i0.get("passes", 99) > 5: problems.append(f"B16 the chain with the streak must stay within 5 passes: {i0}")
        if i0.get("targets") != 12: problems.append(f"B16 the streak must reuse the bloom's quarter-resolution mips (12 render targets), got {i0.get('targets')}")
        q.evaluate("BKHero.gov.setLevel(3)"); f3 = q.evaluate("BKHero.simFx()"); i3 = q.evaluate("BKHero.info()")
        if f3.get("beaconsShown") != 0 or f3.get("discShown") or f3.get("grainShown") != 0 or f3.get("deepShown"): problems.append(f"B16 tier 3 must hide the beacons, the diffuse layer, the grain and the deep field: {f3}")
        if i3.get("streak"): problems.append(f"B16 tier 3 must switch the streak off: {i3}")
    else:
        note(f"B16 this GL has no float render targets ({probe.get('gpu')}) — only the CPU-fallback branch applies here")
    ctx.close()
    ctx3 = b.new_context(viewport={"width": 1440, "height": 900}, service_workers="block"); q3 = ctx3.new_page()
    q3.add_init_script("try{localStorage.setItem('bk-test','1');localStorage.setItem('bk-theme','dark');localStorage.setItem('bk-flag-bksim','0')}catch(e){}")
    q3.goto(a.url + "?b16c=" + str(time.time()), wait_until="load")
    try:
        q3.wait_for_function("window.BKHero&&BKHero.info&&BKHero.info().sim!==undefined&&!!document.querySelector('#heroGL.on')", timeout=180000)
        if q3.evaluate("BKHero.simFx?BKHero.simFx():null"): problems.append("B16 flag bksim=0 must leave no R7.d objects (simFx must be empty)")
    except Exception: problems.append("B16 bksim=0 hero never came up")
    ctx3.close()

def b19(b):
    """B19 R6 medal and Nobel archive objects: (1) tier 0 (pinned): six faces, 1024² height field, POM 16 steps, iridescence thickness map, laurel = InstancedMesh of ExtrudeGeometry (>= 40 leaves),
    reed teeth >= 150, the pointer-following RectAreaLight (its spring follows the pointer), dust <= 200; (2) tier 1: POM 8, directional key + baked rectangle, dust <= 100; (3) tier 2: no POM, fixed iridescence, ambient only, no dust,
    normal-map laurel and reeding; (4) the spark burst starts on a face change and never under reduced motion; (5) glass: tier 0 + hovered tile = real transmission, ONE tile at a time, tier 1 cheap, tier 2 opaque, no shader error;
    (6) ?still determinism: the dust seeds are a fixed table."""
    ctx = b.new_context(viewport={"width": 1440, "height": 900}, service_workers="block"); q = ctx.new_page()
    q.add_init_script("try{localStorage.setItem('bk-test','1');localStorage.setItem('bk-theme','dark');localStorage.setItem('bk-flag-sim1m','0')}catch(e){}")
    q.goto(a.url + "?b19=" + str(time.time()), wait_until="load")
    q.wait_for_function('window.BKStage&&window.BKHero&&BKHero.gov&&typeof records!=="undefined"&&records.length', timeout=180000)
    q.wait_for_function("document.querySelectorAll('.tile-3d.on').length>=6", timeout=180000)
    q.evaluate("BKHero.gov.pin(true)")
    def lvl(n): q.evaluate(f"BKHero.gov.setLevel({n})"); q.wait_for_timeout(600)
    lvl(0)
    q.evaluate("document.querySelectorAll('.atlas-tile')[7].scrollIntoView({block:'center'})"); q.wait_for_timeout(2500)
    def tile(i):
        # scroll until the tile is fully on screen AND its rect has stopped moving: a mid-smooth-scroll rect still satisfies the
        # viewport test, and hovering a stale centre is exactly how the tile-0 transmission check used to fail on CI
        prev = None
        for _ in range(10):
            q.evaluate(f"document.querySelectorAll('.atlas-tile')[{i}].scrollIntoView({{block:'center'}})"); q.wait_for_timeout(700)
            r = q.evaluate(f"(()=>{{const r=document.querySelectorAll('.atlas-tile')[{i}].getBoundingClientRect();return[r.left,r.top,r.width,r.height]}})()")
            if r[1] >= 0 and r[1] + r[3] <= 900 and prev == r: return r
            prev = r
        return prev
    m0 = q.evaluate("BKStage.medalInfo()"); note(f"B19 tier 0 {m0}")
    if not m0: problems.append("B19 no medal"); ctx.close(); return
    if not (m0["faces"] == 6 and m0["normal"] and not m0["bump"] and m0["height"] == 1024 and m0["pom"]["steps"] == 16 and m0["pom"]["on"] and m0["iri"] == "map"): problems.append(f"B19 tier 0 relief wrong (6 faces, 1024² height, POM 16, thickness map): {m0}")
    if not (m0["laurel"]["count"] >= 40 and m0["laurel"]["geometry"] == "ExtrudeGeometry" and m0["teeth"] >= 150): problems.append(f"B19 tier 0 needs real laurel (>= 40 extruded leaves) and >= 150 reed teeth: {m0}")
    if not (m0["rect"] and m0["light"] == "rect" and m0["rectI"] > 0): problems.append(f"B19 tier 0 must light the medal with the RectAreaLight: {m0}")
    if not (0 < m0["dust"] <= 200 and m0["dustMax"] <= 200 and m0["sparks"] > 0): problems.append(f"B19 tier 0 dust must be 1-200 points including sparks: {m0}")
    # the 6 other faces are built while idle (no hitch at the flip); wait for them so the pointer checks below are not starved of frames
    try: q.wait_for_function("BKStage.medalInfo().builtFaces>=7", timeout=90000)
    except Exception: problems.append("B19 the idle warm-up never built all seven faces")
    # the rect light follows the pointer
    x, y, w, h = tile(7)
    def wait(js):
        try: q.wait_for_function(js, timeout=40000)
        except Exception: pass
    q.mouse.move(x + w * .2, y + h * .5); wait("BKStage.medalInfo().rectPos[0]<-1"); pl = q.evaluate("BKStage.medalInfo().rectPos")
    q.mouse.move(x + w * .8, y + h * .5); wait("BKStage.medalInfo().rectPos[0]>1"); pr = q.evaluate("BKStage.medalInfo().rectPos")
    note(f"B19 rect light follows the pointer: left {pl} right {pr}")
    if not (pr[0] - pl[0] > 1.0): problems.append(f"B19 the RectAreaLight does not follow the pointer: {pl} -> {pr}")
    # spark burst on a face change; none under reduced motion
    q.evaluate("BKStage.medal(2)"); q.wait_for_timeout(300); burst = q.evaluate("BKStage.medalInfo().burst")
    q.mouse.move(5, 5); q.evaluate("document.documentElement.classList.add('effects-paused')"); q.wait_for_timeout(1600)
    q.evaluate("BKStage.medal(3)"); q.wait_for_timeout(300); burst_paused = q.evaluate("BKStage.medalInfo().burst")
    note(f"B19 spark burst: normal {burst}, reduced motion {burst_paused}")
    if not burst: problems.append("B19 a face change must start the spark burst at tier 0")
    if burst_paused: problems.append("B19 reduced motion must not start the spark burst")
    # determinism: the dust is seeded (no Math.random), so ?still always shows the same particles; the seed table has a fixed fingerprint
    dh = q.evaluate("BKStage.medalInfo().dustHash"); note(f"B19 dust seed fingerprint {dh}")
    if dh != 3416825296: problems.append(f"B19 the dust must be seeded (fingerprint 3416825296): {dh}")
    q.evaluate("document.documentElement.classList.remove('effects-paused')")
    # all faces get built (idle warm-up) so no hitch on the flip
    q.wait_for_function("BKStage.medalInfo().builtFaces>=7", timeout=60000)
    # glass: one transmission tile at a time
    modes = {}
    for i in (0, 1, 2):
        g = None
        for _ in range(4):   # re-read the rect and retry: the first hover after a long scroll can land on a stale centre
            x, y, w, h = tile(i); q.mouse.move(x + w / 2, y + h / 2)
            try: q.wait_for_function(f"BKStage.glass().tiles.find(t=>t.i=={i}).mode=='trans'", timeout=15000)
            except Exception: pass
            g = q.evaluate("BKStage.glass()")
            if any(t["i"] == i and t["mode"] == "trans" for t in g["tiles"]): break
        modes[i] = g
    note(f"B19 glass per hovered tile: {modes}")
    for i, g in modes.items():
        want = {t["i"]: t["mode"] for t in g["tiles"]}
        if want.get(i) != "trans" or sum(1 for v in want.values() if v == "trans") != 1: problems.append(f"B19 hovering tile {i} must give exactly that tile real transmission: {g}")
        if not (g["disp"] > 0): problems.append("B19 the glass has no dispersion")
    q.mouse.move(5, 5); q.wait_for_timeout(1500); g = q.evaluate("BKStage.glass()")
    if any(t["mode"] == "trans" for t in g["tiles"]): problems.append(f"B19 transmission must end when the pointer leaves: {g}")
    se = q.evaluate("BKStage.diag().shaderErrors")
    if se: problems.append(f"B19 {se} shader error(s): the POM / dispersion / RectAreaLight programs must compile")
    # tier 1
    lvl(1); m1 = q.evaluate("BKStage.medalInfo()"); note(f"B19 tier 1 {m1}")
    if not (m1["pom"]["steps"] == 8 and m1["light"] == "directional" and m1["dust"] <= 100 and m1["laurel"]["count"] >= 20 and m1["teeth"] >= 150): problems.append(f"B19 tier 1: POM 8, directional key + baked rectangle, dust <= 100, real laurel and reeding: {m1}")
    x, y, w, h = tile(1); q.mouse.move(x + w / 2, y + h / 2); q.wait_for_timeout(1500)
    if any(t["mode"] == "trans" for t in q.evaluate("BKStage.glass().tiles")): problems.append("B19 tier 1 must keep the cheap glass (no transmission)")
    # tier 2
    lvl(2); q.mouse.move(5, 5); q.wait_for_timeout(800); m2 = q.evaluate("BKStage.medalInfo()"); g2 = q.evaluate("BKStage.glass()"); note(f"B19 tier 2 {m2} {g2}")
    if not (m2["pom"]["steps"] == 0 and not m2["pom"]["on"] and m2["iri"] in ("fixed", "none") and m2["light"] == "ambient" and m2["dust"] == 0 and m2["laurel"]["count"] == 0 and m2["teeth"] == 0 and m2["normal"] and m2["reed"]): problems.append(f"B19 tier 2: no POM, fixed iridescence, ambient only, no dust, normal-map laurel and reeding: {m2}")
    if any(t["mode"] != "opaque" for t in g2["tiles"]): problems.append(f"B19 tier 2 glass must be opaque: {g2}")
    ctx.close()

def b20(b):
    """B20 R8 wet ground (ground3d): tier 0 is the full wet ground — the wave-equation GPGPU (256² float texture, two ping-pong targets) + a 512² mirror
    target (proxy sky rendered by the mirror camera) + 3 additive fog cards (total extra render targets <= 3; A6 pins the draw counts);
    a pointer splash wakes the sim (simSteps rises, simActive true) and it falls back asleep after the ~8 s calm window.
    Tier 1: 128² waves / 256² mirror / 1 card. Tier >= 2: no sim, no mirror target, no cards (the analytic streak path). Frames keep painting across a theme flip."""
    ctx = b.new_context(viewport={"width": 1440, "height": 900}, service_workers="block"); q = ctx.new_page()
    q.add_init_script("try{localStorage.setItem('bk-test','1');localStorage.setItem('bk-theme','dark')}catch(e){}")
    errs20 = []; q.on("pageerror", lambda e: errs20.append(str(e)[:160]))
    q.goto(a.url + "?b20=" + str(time.time()), wait_until="load")
    try: q.wait_for_function("window.BKGround&&BKGround.info().built&&window.BKHero&&!!document.querySelector('#heroGL.on')", timeout=180000)
    except Exception: problems.append("B20 the wet ground never booted (BKGround.info().built / hero GL)"); ctx.close(); return
    probe = q.evaluate("window.BKGL?BKGL.probe():null") or {}
    frt = bool(probe.get("floatRT"))
    q.evaluate("BKHero.gov.pin(true)")
    def lvl(n, w="true"):
        q.evaluate(f"BKHero.gov.setLevel({n})")
        try: q.wait_for_function("BKGround.info().built&&(" + w + ")", timeout=60000)
        except Exception: pass
        q.wait_for_timeout(1200)
    lvl(0, "BKGround.info().refl&&(BKGround.info().simSize==256||!window.BKGL||!BKGL.probe().floatRT)")
    i0 = q.evaluate("BKGround.info()"); note(f"B20 tier 0 (idle): {i0} floatRT {frt}")
    want_t = 3 if frt else 1
    if not i0.get("refl") or (i0.get("reflSize") or 0) < 256: problems.append(f"B20 tier 0 must mirror the proxy sky (refl on, >= 256 wide): {i0}")
    if i0.get("cards") != 3: problems.append(f"B20 tier 0 must show 3 fog cards: {i0}")
    if i0.get("targets") != want_t: problems.append(f"B20 tier 0 render targets must be {want_t} (wave 2 + mirror 1; floatRT {frt}): {i0}")
    if frt and i0.get("simSize") != 256: problems.append(f"B20 tier 0 wave sim must be 256²: {i0}")
    if frt:
        for k in range(5): q.evaluate(f"BKGround.splash({-6+k*3},-2,1)"); q.wait_for_timeout(200)
        woke = False
        try: q.wait_for_function("(BKGround.info().simSteps>0&&BKGround.info().simActive&&(BKGround.sample()||0)>.005)", timeout=60000); woke = True
        except Exception: pass
        note(f"B20 tier 0 after splashes: {q.evaluate('BKGround.info()')} sample {q.evaluate('BKGround.sample()')}")
        if not woke: problems.append("B20 a pointer splash never put energy into the wave simulation (sample stayed ~0)")
        else:
            slept = False
            for _ in range(24):
                q.wait_for_timeout(1000)
                if not q.evaluate("BKGround.info().simActive"): slept = True; break
            if not slept: problems.append("B20 the wave sim must sleep again after the ~8 s calm window: " + str(q.evaluate("BKGround.info()")))
    lvl(2, "!BKGround.info().refl&&BKGround.info().targets==0")
    i2 = q.evaluate("BKGround.info()"); note(f"B20 tier 2: {i2}")
    if i2.get("refl") or i2.get("targets") != 0 or i2.get("cards") != 0 or i2.get("simSize") != 0: problems.append(f"B20 tier 2 must drop sim, mirror and cards (analytic streak fallback): {i2}")
    lvl(1, "BKGround.info().refl&&(BKGround.info().simSize==128||!window.BKGL||!BKGL.probe().floatRT)")
    i1 = q.evaluate("BKGround.info()"); note(f"B20 tier 1: {i1}")
    if i1.get("cards") != 1 or not i1.get("refl") or i1.get("targets") != want_t: problems.append(f"B20 tier 1: 128² waves / 256² mirror / 1 card expected (targets {want_t}): {i1}")
    if frt and i1.get("simSize") != 128: problems.append(f"B20 tier 1 wave sim must be 128²: {i1}")
    f0 = q.evaluate("BKGround.info().frames"); q.evaluate("document.documentElement.dataset.theme='light'"); q.wait_for_timeout(2000)
    f1 = q.evaluate("BKGround.info().frames")
    if f1 <= f0: problems.append(f"B20 the ground stopped painting after a theme flip ({f0} -> {f1})")
    if errs20: problems.append(f"B20 page errors: {errs20[:3]}")
    ctx.close()

def b21(b):
    """B21 R9 Nobel skyline (skyline3d): the 126-year city is data-driven — the tower table is an RGBA32F DataTexture (one texel per
    year x category = 882) and the spring is the closed-form critically damped step response in the vertex shader, so the CPU does no
    per-frame spring work and the scene allocates no render target for it. Picking reads a 1/4-resolution identity buffer (one pixel,
    PIXEL_PACK_BUFFER + fenceSync, one frame late) instead of a CPU raycast; the selected year's towers live on layer 1 and bloom
    selectively; the camera rides a Catmull-Rom rail; only +/-6 years around the focus use the physical transmission glass.
    Hover must land within 8 frames on software GL (the spec's <= 2 is a real-GPU number). Reduced motion: no light wave, no confetti.
    Exactly one of chart / skyline / galaxy is ever visible."""
    ctx = b.new_context(viewport={"width": 1440, "height": 900}, service_workers="block"); q = ctx.new_page()
    q.add_init_script("try{localStorage.setItem('bk-test','1');localStorage.setItem('bk-theme','dark')}catch(e){}")
    errs21 = []; q.on("pageerror", lambda e: errs21.append(str(e)[:160]))
    q.goto(a.url + "?b21=" + str(time.time()), wait_until="load")
    try: q.wait_for_function("window.BKSkyline&&BKSkyline.info().built&&!!document.querySelector('.nc-sky canvas.on')", timeout=180000)
    except Exception: problems.append("B21 the skyline never booted (BKSkyline.info().built / .nc-sky canvas.on)"); ctx.close(); return
    q.evaluate("document.querySelector('.nc-sky').scrollIntoView({block:'center'})"); q.wait_for_timeout(1200)
    q.evaluate("BKSkyline.tier(0)")
    try: q.wait_for_function("BKSkyline.info().tier===0", timeout=60000)
    except Exception: pass
    q.wait_for_timeout(1500)
    i0 = q.evaluate("BKSkyline.info()"); note(f"B21 tier 0: {i0}")
    # R9.1 — the texture path, the real tower count and the analytic spring
    if i0.get("source") != "texture" or i0.get("spring") != "gpu": problems.append(f"B21 the tower table must be a DataTexture with the GPU spring (source 'texture', spring 'gpu'): {i0}")
    if i0.get("texels") != i0.get("N", 0) * i0.get("CAT", 0): problems.append(f"B21 one texel per year x category expected: {i0}")
    if (i0.get("K") or 0) < 600: problems.append(f"B21 the city must hold >= 600 non-empty year x category towers (real data: 638): {i0}")
    if i0.get("N") != 126: problems.append(f"B21 1901-2026 is 126 years: {i0}")
    # R9.3 — the identity buffer answers the hover
    if i0.get("picking") != "id" or (i0.get("idSize") or 0) < 64: problems.append(f"B21 picking must read the 1/4-resolution identity buffer: {i0}")
    # R9.4 / R9.6 — selective bloom and the glass window are tier-0 only, and both follow the selection
    cats0 = q.evaluate("(()=>{const e=nobelIndex&&nobelIndex.get(nobelYear);return e?e.cats.filter(c=>c>0).length:-1})()")
    if i0.get("bloom") != cats0: problems.append(f"B21 the bloom layer holds exactly one glow per category present in the selected year ({cats0}): {i0}")
    if i0.get("glass"): problems.append(f"B21 the glass window is opt-in (the button starts off): {i0}")
    if (i0.get("targets") or 0) > 4: problems.append(f"B21 at most 4 render targets (studio + identity 1/4 + bloom 1/4 + transmission): {i0}")
    # R9.5 — the rail reports a parameter and the selected year
    rail = q.evaluate("BKSkyline.rail()") or {}
    if "u" not in rail or "sel" not in rail: problems.append(f"B21 the camera rail must expose {{u, sel}}: {rail}")
    # R9.2 — a year change lights the wave and fires the confetti
    q.evaluate("selectNobelYear('1969',true)"); q.wait_for_timeout(400)
    i1 = q.evaluate("BKSkyline.info()"); note(f"B21 after selecting 1969: {i1}")
    if not i1.get("wave"): problems.append(f"B21 selecting a year must start the light wave: {i1}")
    if not i1.get("bloom"): problems.append(f"B21 tier 0 must bloom the selected year's towers on layer 1: {i1}")
    if i1.get("bloom") and i1["bloom"] > 7: problems.append(f"B21 the bloom layer holds one glow per category (<= 7): {i1}")
    if not i1.get("confetti"): problems.append(f"B21 selecting a year must fire the confetti burst: {i1}")
    if i1.get("confetti") and i1["confetti"] > 150: problems.append(f"B21 the confetti burst is capped at 150 points: {i1}")
    # R9.3 — hover latency: park the pointer over the city and count frames until the identity buffer names a tower.
    # A fixed viewport fraction is not portable: which tower sits under it depends on the camera distance, which depends on the
    # panel's scroll offset and on arrival() — and Linux reserves ~10px for the scrollbar where macOS uses an overlay. So aim at the
    # selected year's tower top (the module already projects it for the chip anchor) and walk down its face, with a coarse grid as
    # a fallback when the anchor is unavailable.
    box = q.evaluate("(()=>{const c=document.querySelector('.nc-sky canvas');const r=c.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height}})()")
    if box["y"] < 0 or box["y"] + box["h"] > 900: problems.append(f"B21 the skyline canvas must sit inside the 900px viewport before hovering: {box}")
    q.evaluate("window.__hf=0;(function l(){window.__hf++;requestAnimationFrame(l)})()")
    anc = q.evaluate("(()=>{const i=window.NobelSkyline&&NobelSkyline.inst;return i&&i.anchor?i.anchor():null})()")
    pts = [(anc["x"], anc["y"] + dy) for dy in (8, 16, 24, 32, 40, 48, 56, 64, 72, 80)] if anc else []
    pts += [(box["x"] + box["w"] * fx, box["y"] + box["h"] * fy) for fy in (.62, .5, .4) for fx in (.5, .42, .58, .34, .66)]
    def sweep(ps):
        # 1.2 s per point: CI runs the skyline at ~4 fps, so a two-frame readback needs ~500 ms and a 480 ms budget was a coin flip
        for px, py in ps:
            q.evaluate("window.__hf=0")
            q.mouse.move(px, py)
            for _ in range(20):
                q.wait_for_timeout(60)
                r = q.evaluate("({id:BKSkyline.id(),f:window.__hf})")
                if r["id"] >= 0: return r["f"]
        return None
    lat = sweep(pts[:10]) if pts else None          # the anchor walk down the selected tower's face
    if lat is None: lat = sweep(pts[10:])           # coarse grid fallback
    inf = q.evaluate("BKSkyline.info()")
    idraw, idpath = inf["idRaw"], inf.get("idPath")
    note(f"B21 hover latency: {lat} frames (anchor {anc}, idRaw {idraw}, idPath {idpath})")
    if lat is None: problems.append(f"B21 the identity buffer never named a tower under the pointer (hover is dead; anchor {anc}, idRaw {idraw}, idPath {idpath})")
    elif lat > 8: problems.append(f"B21 hover must land within 8 frames on software GL (spec: <= 2 on a real GPU), took {lat}")
    # R9.6 — the glass window is a contiguous +/-6-year slice and it hides those towers in the opaque city
    q.evaluate("(()=>{const b=document.querySelector('.nc-glass-btn');if(b)b.click()})()"); q.wait_for_timeout(1200)
    i2 = q.evaluate("BKSkyline.info()"); note(f"B21 glass on: {i2}")
    if not i2.get("glass"): problems.append(f"B21 the glass button must build the +/-6-year transmission window: {i2}")
    elif i2["glass"] > 13 * 7: problems.append(f"B21 the glass window is +/-6 years (<= 91 towers): {i2}")
    q.evaluate("(()=>{const b=document.querySelector('.nc-glass-btn');if(b)b.click()})()"); q.wait_for_timeout(600)
    # tier >= 2 — the cheap path: no bloom, no glass, no identity buffer work
    q.evaluate("BKSkyline.tier(3)"); q.wait_for_timeout(1200)
    i3 = q.evaluate("BKSkyline.info()"); note(f"B21 tier 3: {i3}")
    if i3.get("bloom") or i3.get("glass"): problems.append(f"B21 tier 3 must drop the selective bloom and the glass window: {i3}")
    if i3.get("source") != "texture": problems.append(f"B21 the texture path is cheaper than the CPU spring at every tier: {i3}")
    q.evaluate("BKSkyline.tier(0)"); q.wait_for_timeout(800)
    # exactly one view is ever visible (chart / skyline / galaxy never stack)
    def views():
        return q.evaluate("(()=>{const c=document.querySelector('.nc-chart'),s=document.querySelector('.nc-3d.nc-sky'),g=document.querySelector('.nc-3d:not(.nc-sky)');return[c,s,g].filter(e=>e&&!e.hidden).length})()")
    if views() != 1: problems.append(f"B21 exactly one of chart / skyline / galaxy must be visible, saw {views()}")
    for v in ("chart", "galaxy", "skyline"):
        q.evaluate(f"(()=>{{const b=document.querySelector('[data-v={v}]');if(b)b.click()}})()")
        # a view switch is a 1.6 s particle morph or a ~0.9 s cross, both rAF-driven; software GL runs the page at well under 1 fps,
        # so a fixed sleep leaves `morphing` set and the NEXT click is dropped by the guard. Wait for the switch to actually finish.
        q.wait_for_timeout(400)
        deadline = time.time() + 40
        while time.time() < deadline:
            if q.evaluate("(()=>{const c=document.querySelector('.nobel-chronicle');return !c.classList.contains('nc-morphing')&&!document.querySelector('canvas.nc-morph')&&!document.querySelector('canvas.nc-field.on')})()"):
                break
            q.wait_for_timeout(200)
        else:
            problems.append(f"B21 the switch to {v} never finished (morph/cross still running after 40 s)")
        if views() != 1: problems.append(f"B21 after switching to {v} exactly one view must be visible, saw {views()}")
    # frames keep painting across a theme flip (re-scroll first: the view switches above can leave the panel off-screen, and parking
    # an off-screen panel is correct behaviour, not a stall). The IntersectionObserver that un-parks it is async, so wait for vis.
    q.evaluate("document.querySelector('.nc-sky').scrollIntoView({block:'center'})")
    try: q.wait_for_function("BKSkyline.info().vis===1", timeout=15000)
    except Exception: pass
    f0 = q.evaluate("BKSkyline.info().frames"); q.evaluate("document.documentElement.dataset.theme='light'"); q.wait_for_timeout(2000)
    f1 = q.evaluate("BKSkyline.info().frames")
    if f1 <= f0: problems.append(f"B21 the skyline stopped painting after a theme flip ({f0} -> {f1}, vis {q.evaluate('BKSkyline.info().vis')})")
    if errs21: problems.append(f"B21 page errors: {errs21[:3]}")
    ctx.close()
    # reduced motion: highlight only — no light wave, no confetti
    ctx2 = b.new_context(viewport={"width": 1440, "height": 900}, service_workers="block", reduced_motion="reduce"); q2 = ctx2.new_page()
    q2.add_init_script("try{localStorage.setItem('bk-test','1');localStorage.setItem('bk-theme','dark')}catch(e){}")
    errs2 = []; q2.on("pageerror", lambda e: errs2.append(str(e)[:160]))
    q2.goto(a.url + "?b21r=" + str(time.time()), wait_until="domcontentloaded", timeout=120000)
    try: q2.wait_for_function("window.BKSkyline&&BKSkyline.info().built", timeout=180000)
    except Exception:
        d2 = q2.evaluate("({bk:typeof window.BKSkyline,sky:!!document.querySelector('.nc-sky'),on:!!document.querySelector('.nc-sky canvas.on'),gl:(()=>{try{const c=document.createElement('canvas');return !!(c.getContext('webgl2')||c.getContext('webgl'))}catch(e){return 'x'}})()})")
        problems.append(f"B21 reduced motion: the skyline never booted {d2} {errs2[:3]}"); ctx2.close(); return
    q2.evaluate("document.querySelector('.nc-sky').scrollIntoView({block:'center'})"); q2.wait_for_timeout(1000)
    q2.evaluate("selectNobelYear('1969',true)"); q2.wait_for_timeout(900)
    r2 = q2.evaluate("BKSkyline.info()"); note(f"B21 reduced motion: {r2}")
    if r2.get("wave") or r2.get("confetti"): problems.append(f"B21 reduced motion must keep the highlight only (no light wave, no confetti): {r2}")
    ctx2.close()

def b22(b):
    """B22 R11 "süreklilik" (continuum, transition.js): the three Nobel views are three arrangements of the same records, so a switch
    is the records travelling between arrangements in ONE shared 3D space. BKContinuum owns one persistent canvas on the stage and
    ONE point program (1895 points, one per catalog record, in the galaxy's own index order); the panels crossfade underneath it.
    No frozen frame, no screenshot, no render target, no texture, no rail, no sweep — the R10.a freeze-and-cross is gone.
    Reduced motion builds nothing (0 frames). A context loss mid-transition drops the field and cuts at once. The program and the
    canvas are released when the transition ends, and the field must not collide with record.js withMorph's view-transition-name."""
    ctx = b.new_context(viewport={"width": 1440, "height": 900}, service_workers="block"); q = ctx.new_page()
    q.add_init_script("try{localStorage.setItem('bk-test','1');localStorage.setItem('bk-theme','dark')}catch(e){}")
    q.add_init_script("window.__gls=[];const g=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(t,o){const c=g.call(this,t,o);if(c&&(t==='webgl'||t==='webgl2')&&!window.__gls.includes(c))window.__gls.push(c);return c}")
    # an INDEPENDENT frame count: rAF ticks while the field canvas is RUNNING (.on), not the module's own counter
    q.add_init_script("window.__xf=0;(function l(){if(document.querySelector('canvas.nc-field.on'))window.__xf++;requestAnimationFrame(l)})()")
    errs22 = []; q.on("pageerror", lambda e: errs22.append((e.stack or str(e))[:400]))
    q.goto(a.url + "?b22=" + str(time.time()), wait_until="load")
    try: q.wait_for_function("window.BKContinuum&&BKContinuum.ready&&window.BKSkyline&&BKSkyline.info().built", timeout=180000)
    except Exception:
        problems.append("B22 BKContinuum / the skyline never booted"); ctx.close(); return
    q.evaluate("document.querySelector('.nc-sky').scrollIntoView({block:'center'})"); q.wait_for_timeout(1200)
    q.evaluate("BKSkyline.tier(0)"); q.wait_for_timeout(1200)
    soft = q.evaluate("(()=>{try{const c=document.createElement('canvas'),g=c.getContext('webgl2')||c.getContext('webgl');if(!g)return true;const e=g.getExtension('WEBGL_debug_renderer_info');const r=e?String(g.getParameter(e.UNMASKED_RENDERER_WEBGL)):'';return /swiftshader|llvmpipe|software|basic render/i.test(r)}catch(e){return true}})()")
    # ---- the FIRST switch to the galaxy cannot run the field: the galaxy has to build its sim before it can be projected. Boot it, then cross back.
    q.evaluate("document.querySelector('[data-v=galaxy]').click()")
    try: q.wait_for_function("!!document.querySelector('.nc-3d:not(.nc-sky) canvas.on')", timeout=180000)
    except Exception: problems.append("B22 the galaxy never booted"); ctx.close(); return
    q.wait_for_timeout(2000)
    # the field is built synchronously inside the click, so the canvas is checked in the SAME task: a polling wait_for_function is starved
    # by the field's own rAF loop under software GL (measured: a 1.4 s run is never observed by a 100 ms poll)
    seen1 = q.evaluate("(()=>{document.querySelector('[data-v=skyline]').click();return !!document.querySelector('canvas.nc-field.on')})()")
    if not seen1:
        problems.append(f"B22 galaxy -> skyline never started the field: {q.evaluate('BKContinuum.info()')} {errs22[:3]}"); ctx.close(); return
    q.wait_for_function("!document.querySelector('canvas.nc-field.on')", timeout=120000, polling=100); q.wait_for_timeout(800)
    # ---- the field itself: skyline -> galaxy, frames counted while the field is running
    seen2 = q.evaluate("(()=>{window.__xf=0;document.querySelector('[data-v=galaxy]').click();return !!document.querySelector('canvas.nc-field.on')})()")
    if not seen2:
        problems.append(f"B22 the field never started: {q.evaluate('BKContinuum.info()')} {errs22[:3]}"); ctx.close(); return
    q.wait_for_function("!document.querySelector('canvas.nc-field.on')", timeout=120000, polling=100)
    xf = q.evaluate("window.__xf"); last = q.evaluate("BKContinuum.info().last"); note(f"B22 field frames {xf} (software GL {soft}), last {last}")
    # R11 spec: >= 20 frames on a real GPU, >= 2 on software GL. SwiftShader here runs the whole page (skyline + the live galaxy underneath)
    # at well under 1 fps, so a 720 ms window holds 2 frames — measured, not assumed. The gate therefore asks for 2 on software GL and keeps
    # the spec's 20 for a real GPU; the honest number is printed above and in the PR report.
    need = 2 if soft else 20
    if xf < need: problems.append(f"B22 the field painted {xf} frames, the gate asks for >= {need} on {'software' if soft else 'real'} GL")
    # R11: ZERO render targets, ZERO textures and exactly ONE program (the record field). The field is one point per catalog record, so the
    # count must equal the galaxy's star count — measured, not assumed — and it is what makes the flight meaningful.
    if not last or last.get("targets") != 0 or last.get("programs") != 1: problems.append(f"B22 the field must use ZERO render targets and ONE program: {last}")
    if last and last.get("points") not in (None, 0) and not (1800 <= last["points"] <= 2048): problems.append(f"B22 the record field must hold the catalog's ~1895 points: {last}")
    if last and last.get("textures") not in (None, 0): problems.append(f"B22 the field must use no textures at all: {last}")
    # ---- released on exit: no running canvas, no target, no program
    i1 = q.evaluate("BKContinuum.info()")
    if i1.get("active") or i1.get("targets") or i1.get("programs"): problems.append(f"B22 the field was not released when the run ended: {i1}")
    if q.evaluate("!!document.querySelector('canvas.nc-field.on')"): problems.append("B22 the field canvas is still running after the switch")
    # ---- context loss mid-transition: the field is dropped and the incoming view shows at once
    q.evaluate("document.querySelector('[data-v=skyline]').click()")
    try: q.wait_for_function("!document.querySelector('canvas.nc-field.on')", timeout=120000, polling=100)
    except Exception: pass
    q.wait_for_timeout(1500)
    # the field is built synchronously inside the click, so the context is lost in the SAME task — no round-trip can miss the canvas
    lost = q.evaluate("(()=>{document.querySelector('[data-v=galaxy]').click();const c=document.querySelector('canvas.nc-field');if(!c)return 'no canvas';const g=window.__gls.find(x=>x.canvas===c);if(!g)return 'no context';const e=g.getExtension('WEBGL_lose_context');if(!e)return 'no ext';e.loseContext();return 'ok'})()")
    q.wait_for_timeout(1500)
    gone = q.evaluate("!document.querySelector('canvas.nc-field')"); vis = q.evaluate("(()=>{const g=document.querySelector('.nc-3d:not(.nc-sky)');return !!g&&!g.hidden})()")
    note(f"B22 context loss mid-field: {lost}, field removed {gone}, incoming view visible {vis}")
    if lost != "ok": problems.append(f"B22 could not lose the field's context: {lost}")
    elif not gone: problems.append("B22 a context loss mid-transition must remove the field at once")
    if not vis: problems.append("B22 after a context loss mid-transition the incoming view must be visible")
    # ---- withMorph (record.js) names the cover 'bk-cover' for the view transition: the field must not add a second name or leave one behind.
    # A MutationObserver samples every style change, so the check does not depend on the (very low) software-GL frame rate.
    q.evaluate("""(()=>{window.__vtmax=0;window.__vtlog=[];
      const chk=()=>{const n=[];for(const e of document.querySelectorAll('[style*=view-transition-name],#recordCoverArt')){const v=getComputedStyle(e).viewTransitionName;if(v&&v!=='none')n.push(v)}
       if(n.length>window.__vtmax)window.__vtmax=n.length;if(n.length)window.__vtlog.push(n.join('|'))};
      new MutationObserver(chk).observe(document.documentElement,{subtree:true,attributes:true,attributeFilter:['style']});chk()})()""")
    q.evaluate("document.querySelector('#spotlightGrid .spotlight-card').click()"); q.wait_for_timeout(4000)
    vt = q.evaluate("({max:window.__vtmax,log:window.__vtlog.slice(0,6),open:document.getElementById('recordView').hidden===false})")
    note(f"B22 view-transition-name during withMorph: {vt}")
    if not vt["open"]: problems.append("B22 the card click never opened the record")
    if not vt["log"]: problems.append("B22 withMorph never named the cover 'bk-cover' (the check would be vacuous)")
    if vt["max"] > 1: problems.append(f"B22 withMorph held {vt['max']} view-transition-names at once (the field must not add a second): {vt['log']}")
    q.evaluate("document.getElementById('recordBack').click()"); q.wait_for_timeout(2000)
    left = q.evaluate("(()=>{let n=0;for(const e of document.querySelectorAll('[style*=view-transition-name]')){const v=getComputedStyle(e).viewTransitionName;if(v&&v!=='none')n++}return n})()")
    if left: problems.append(f"B22 withMorph left {left} view-transition-name(s) behind")
    if errs22: problems.append(f"B22 page errors: {errs22[:3]}")
    ctx.close()
    # ---- reduced motion: nothing is built at all (0 frames, 0 ms) — the view switch is already a cut
    ctx2 = b.new_context(viewport={"width": 1440, "height": 900}, service_workers="block", reduced_motion="reduce"); q2 = ctx2.new_page()
    q2.add_init_script("try{localStorage.setItem('bk-test','1');localStorage.setItem('bk-theme','dark')}catch(e){}")
    q2.add_init_script("window.__xf=0;(function l(){if(document.querySelector('canvas.nc-field.on'))window.__xf++;requestAnimationFrame(l)})()")
    q2.goto(a.url + "?b22r=" + str(time.time()), wait_until="load")
    try: q2.wait_for_function("window.BKContinuum&&BKContinuum.ready&&window.BKSkyline&&BKSkyline.info().built", timeout=180000)
    except Exception:
        problems.append("B22 reduced motion: BKContinuum / the skyline never booted"); ctx2.close(); return
    q2.evaluate("document.querySelector('.nc-sky').scrollIntoView({block:'center'})"); q2.wait_for_timeout(1200)
    q2.evaluate("document.querySelector('[data-v=galaxy]').click()"); q2.wait_for_timeout(2500)
    r2 = q2.evaluate("({xf:window.__xf,cv:!!document.querySelector('canvas.nc-field'),last:BKContinuum.info().last})"); note(f"B22 reduced motion: {r2}")
    if r2["cv"] or r2["xf"] > 2: problems.append(f"B22 reduced motion must build no field (<= 2 frames): {r2}")
    ctx2.close()

def b9(b):
    """B9 broken GPU (own contexts, independent of the main page)."""
    # ---- B9 broken GPU: the shelf must never show a broken book. Inject a shader fault (fragment shaders containing the given text get a syntax error appended)
    # and require that the stage steps down until the books paint again (level 2 with no PBR) or, when nothing compiles, falls back to the CSS covers.
    def faulty(pats, done):
        ctx = b.new_context(viewport={"width": 1590, "height": 615}, service_workers="block"); fp = ctx.new_page()
        fp.add_init_script("try{localStorage.setItem('bk-theme','dark')}catch(e){}")
        fp.add_init_script("window.__pats=%s;for(const K of [WebGLRenderingContext,WebGL2RenderingContext]){const P=K.prototype,ss=P.shaderSource;P.shaderSource=function(s,src){if((src.includes('gl_FragColor')||src.includes('pc_fragColor'))&&window.__pats.some(p=>src.includes(p)))src=src+'\\n@@@broken@@@';return ss.call(this,s,src)}}" % json.dumps(pats))
        perrs = []; fp.on("pageerror", lambda e: perrs.append(str(e)[:160])); fp.on("console", lambda m: perrs.append(m.text[:160]) if m.type == "error" else None)
        fp.goto(a.url + "?fault=" + str(time.time()), wait_until="load")
        fp.wait_for_function('typeof records!=="undefined"&&records.length&&window.BKStage', timeout=120000); fp.wait_for_timeout(4000)
        fp.evaluate("document.documentElement.classList.add('effects-paused')")   # still frames: the hero stops competing for the (software) GPU and a tile needs 2 renders per self-check instead of 70, so the step-down chain is deterministic instead of a race against CI speed
        fp.evaluate("document.querySelector('#spotlightGrid').scrollIntoView({block:'start'})")
        Q = "({lvl:BKStage.diag().level,cards:document.querySelectorAll('.spotlight-card.has-3d').length,cover:BKStage.diag().items})"
        out = fp.evaluate(Q)
        for _ in range(150):   # software GL is slow: poll for the settled state instead of a fixed wait
            fp.wait_for_timeout(1000); out = fp.evaluate(Q)
            if done(out): break
        out["errs"] = perrs[:4]; out["diag"] = fp.evaluate("(()=>{const d=BKStage.diag();return{renderErrors:d.renderErrors||0,lastError:d.lastError||'',stats:d.stats,esc:d.escalations}})()")   # tail of the story for CI logs
        ctx.close(); return out
    f_std = faulty(["#define STANDARD"], lambda o: o["lvl"] >= 1 and o["cards"] == 4 and all(c and c != "failed" and c["cover"] >= .1 for c in o["cover"])); note(f"B9 standard/physical shaders broken -> {f_std}")
    if f_std["lvl"] < 1 or f_std["cards"] != 4 or any((not c) or c == "failed" or c["cover"] < .1 for c in f_std["cover"]): problems.append(f"B9 books did not recover when the PBR shaders fail: {f_std}")
    f_all = faulty(["gl_FragColor", "pc_fragColor"], lambda o: o["lvl"] == 4 and o["cards"] == 0); note(f"B9 nothing compiles -> {f_all}")
    if f_all["lvl"] != 4 or f_all["cards"] != 0: problems.append(f"B9 stage did not fall back to the CSS covers when nothing compiles: {f_all}")

if a.only in ("b9", "b10", "b11", "b12", "b13", "b14", "b15", "b16", "b17", "b18", "b19", "b20", "b21", "b22"):
    with sync_playwright() as p:
        kw = dict(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"]); exe = os.environ.get("BK_CHROMIUM")
        b = p.chromium.launch(executable_path=exe, **kw) if exe else p.chromium.launch(**kw)
        {"b9": b9, "b10": b10, "b11": b11, "b12": b12, "b13": b13, "b14": b14, "b15": b15, "b16": b16, "b17": b17, "b18": b18, "b19": b19, "b20": b20, "b21": b21, "b22": b22}[a.only](b); b.close()
    if srv: srv.terminate()
    print("FAIL" if problems else f"OK: {a.only.upper()}", *problems, sep="\n - " if problems else "")
    sys.exit(1 if problems else 0)
with sync_playwright() as p:
    kw = dict(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
    exe = os.environ.get("BK_CHROMIUM")      # CI uses Playwright's own browser; locally set BK_CHROMIUM when it has none
    b = p.chromium.launch(executable_path=exe, **kw) if exe else p.chromium.launch(**kw)
    pg = b.new_context(viewport={"width": 1440, "height": 900}, service_workers="block").new_page()
    pg.add_init_script("try{localStorage.setItem('bk-test','1')}catch(e){}")
    # record every WebGL context so B8 can simulate a GPU context loss
    pg.add_init_script("window.__gls=[];const g=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(t,o){const c=g.call(this,t,o);if(c&&(t==='webgl'||t==='webgl2')&&!window.__gls.includes(c))window.__gls.push(c);return c}")
    errs = []; pg.on("pageerror", lambda e: errs.append(str(e))); pg.on("console", lambda m: errs.append(m.text[:200]) if m.type == "error" else None)
    pg.goto(a.url + "?fa=" + str(time.time()), wait_until="load")
    pg.wait_for_function('window.BKHero&&window.BKStage&&typeof records!=="undefined"&&records.length', timeout=120000)
    pg.wait_for_function("document.querySelectorAll('.tile-3d.on').length>=6", timeout=120000); pg.wait_for_timeout(2000)
    # ---- A3 governor (synthetic windows: avg frame seconds, clock ms)
    r = pg.evaluate("""(()=>{const g=BKHero.gov;g.reset();const t=performance.now()+1e6,L=[];   // start from level 0 whatever the real governor did on this machine
      const f=(avg,now)=>{L.push(g.feed(avg,now))};
      f(.05,t);f(.05,t+10);                          // slow -> 1, 2
      for(let i=0;i<3;i++)f(.005,t+30000+i*10);       // 3 fast windows: not enough yet
      f(.005,t+30040);                                // 4th -> level 1
      for(let i=0;i<4;i++)f(.005,t+60000+i*10);       // 4 more (>20 s later) -> 0
      f(.05,t+65000);                                  // slow again within 15 s of the recovery -> 1, and recovery locks
      for(let i=0;i<8;i++)f(.005,t+100000+i*10);       // fast, but locked
      const locked=L[L.length-1];                      // still 1
      for(let i=0;i<4;i++)f(.005,t+300000+i*10);       // after the lock (>2 min) -> 0
      return {path:L,locked,end:L[L.length-1]}})()""")
    note(f"A3 governor path {r['path']}")
    P = r["path"]    # [1,2, 2,2,2,1 (4th fast window: 2->1), 1,1,1,0 (recovered), 1 (slow again: relapse + lock), 1 x8 (locked), 1,1,1,0 (after the lock)]
    ok = P[:2] == [1, 2] and P[4] == 2 and P[5] == 1 and P[9] == 0 and P[10] == 1 and r["locked"] == 1 and r["end"] == 0
    if not ok: problems.append(f"A3 governor hysteresis wrong: {r}")
    pg.evaluate("BKHero.gov.feed(.005, performance.now()+1e7)")  # keep state sane
    # ---- A1 atlas arrival
    # hold tier 0: the dolly lives in the tile update loop, and on software GL the governor reaches tier 4 within seconds, where
    # only the hovered tile is updated — the first row then never moves and the check measures a frozen camera (z stays at rest)
    pg.evaluate("BKHero.gov.pin(true)"); pg.evaluate("BKHero.gov.setLevel(0)")
    top = pg.evaluate("document.getElementById('collectionGrid').getBoundingClientRect().top+scrollY")
    # tiles off-screen are never rendered (stale camera), so compare the first row just after it enters the viewport vs once it has settled
    first = lambda ts: [t for t in sorted(ts, key=lambda t: t["top"])][:3]
    pg.evaluate(f"scrollTo(0,{int(top)-830})"); pg.wait_for_timeout(3500); far = first(pg.evaluate("BKStage.tiles()"))
    pg.evaluate(f"scrollTo(0,{int(top)-260})"); pg.wait_for_timeout(3500); near = first(pg.evaluate("BKStage.tiles()"))
    zf = sum(t["z"] for t in far) / len(far); zn = sum(t["z"] for t in near) / len(near)
    note(f"A1 first-row camera z entering {zf:.2f} -> settled {zn:.2f}; opacity {[t['op'] for t in far]} -> {[t['op'] for t in near]}")
    if not zf > zn * 1.15: problems.append(f"A1 atlas camera does not dolly in while arriving: {zf:.2f} -> {zn:.2f}")
    # ---- A4 atlas dive
    pg.evaluate(f"scrollTo(0,{int(top)-120})"); pg.wait_for_timeout(2500)
    pg.evaluate("window.__clicks=0;const ct=document.getElementById('collectionGrid');ct.addEventListener('click',()=>window.__clicks++)")
    before = pg.evaluate("typeof discoveryIndex==='undefined'?null:discoveryIndex")
    pg.evaluate("window.__sawDive=false;const t=document.querySelectorAll('.atlas-tile')[1];new MutationObserver(()=>{if(t.classList.contains('diving'))window.__sawDive=true}).observe(t,{attributes:true,attributeFilter:['class']});window.__early=null;window.__t0=performance.now();")
    pg.evaluate("document.querySelectorAll('.atlas-tile')[1].click()")
    pg.evaluate("window.__early=(typeof discoveryIndex==='undefined'?null:discoveryIndex)")   # read synchronously right after the click: the filter must not have applied yet
    pg.wait_for_timeout(300); diving = pg.evaluate("window.__sawDive"); early = pg.evaluate("window.__early")
    pg.wait_for_timeout(2500); after = pg.evaluate("typeof discoveryIndex==='undefined'?null:discoveryIndex"); clicks = pg.evaluate("window.__clicks")
    note(f"A4 diving={diving} filter before/early/after = {before}/{early}/{after}, clicks reaching the grid = {clicks}")
    if not diving: problems.append("A4 .diving class not shown right after the click")
    if early != before: problems.append("A4 filter applied before the dive finished")
    if after == before or after is None: problems.append("A4 filter never applied after the dive")
    if clicks != 1: problems.append(f"A4 click reached the grid {clicks}x (expected exactly once)")
    pg.evaluate("BKHero.gov.pin(false)")   # back to the real governor for the rest of the slice
    # ---- A2 return flight
    pg.evaluate("scrollTo(0,0)"); pg.wait_for_timeout(2500)
    pg.evaluate("BKHero.fly(37)"); pg.wait_for_function("!document.getElementById('recordView').hidden", timeout=60000); pg.wait_for_timeout(2500)
    pg.evaluate("window.__ret=0;window.__retObs&&window.__retObs.disconnect();window.__retObs=new MutationObserver(ms=>ms.forEach(m=>m.addedNodes.forEach(n=>{if(n.classList&&n.classList.contains('fly-return'))window.__ret++})));window.__retObs.observe(document.body,{childList:true})")
    pg.evaluate("document.getElementById('recordBack').click()"); pg.wait_for_timeout(400)
    ret = pg.evaluate("window.__ret")
    pg.wait_for_timeout(2500)
    pg.evaluate("window.__ret=0")
    pg.evaluate("openRecord(records[7].id)"); pg.wait_for_timeout(2000); pg.evaluate("document.getElementById('recordBack').click()"); pg.wait_for_timeout(400)
    none = pg.evaluate("window.__ret")
    note(f"A2 return ghosts after a star-born record: {ret}; after an ordinary record: {none}")
    if ret < 1: problems.append("A2 no return ghost after closing a star-born record")
    if none != 0: problems.append("A2 return ghost appeared for a record that was not opened from a star")
    # ---- B7 the dome follows the pointer (slit turns, telescope lifts)
    pg.evaluate("scrollTo(0,0)"); pg.wait_for_timeout(2000)
    pg.mouse.move(1250, 200); pg.wait_for_timeout(7000); s1 = pg.evaluate("BKDome.state")
    pg.mouse.move(300, 700); pg.wait_for_timeout(7000); s2 = pg.evaluate("BKDome.state")
    note(f"B7 dome state with pointer upper-right {s1} / lower-left {s2}")
    if not (abs(s1["el"] - s2["el"]) > 0.1 and abs(s1["ry"] - s2["ry"]) > 0.2): problems.append(f"B7 dome/telescope does not follow the pointer: {s1} vs {s2}")
    # ---- B6 medal relief: normal map (not a flat bump), reeded rim, six faces
    mi = pg.evaluate("BKStage.medalInfo()"); note(f"B6 medal {mi}")
    if not (mi and mi["normal"] and not mi["bump"] and mi["reed"] and mi["faces"] == 6): problems.append(f"B6 medal relief materials wrong: {mi}")
    # ---- B5 page-turning book
    pg.evaluate("openRecord(records[5].id)"); pg.wait_for_timeout(2500)
    pg.evaluate("document.querySelector('.rv-3d-toggle').click()"); pg.wait_for_function("document.querySelector('.rv-book-ctl')", timeout=120000); pg.wait_for_timeout(3000)
    st0 = pg.evaluate("BKStage.book.state()")
    pg.evaluate("document.querySelector('.rv-book-ctl [data-a=open]').click()")
    pg.wait_for_function("BKStage.book.state().coverK>0.95", timeout=120000)
    st1 = pg.evaluate("BKStage.book.state()"); stage_ok = pg.evaluate("(()=>{const r=document.querySelector('.rec-3d').getBoundingClientRect();return r.width>800&&Math.abs(r.left+r.width/2-innerWidth/2)<6})()")
    prev_dis = pg.evaluate("document.querySelector('.rv-book-ctl [data-a=prev]').disabled")
    # with the cover lying exactly flat (what a fast GPU reaches, slow software GL never does) the left leaf stack must still be in front of the endpaper:
    # scan the row at 55% height leftwards from the gutter and require a long unbroken run of paper-coloured pixels on every spread
    pg.evaluate("document.documentElement.classList.add('effects-paused')"); pg.wait_for_function("BKStage.book.state().coverK>=0.999", timeout=60000)
    RUN = "(()=>{const c=document.querySelector('.rec-3d'),x=c.getContext('2d'),w=c.width,y=Math.round(c.height*.55),d=x.getImageData(0,y,w,1).data;let n=0;for(let i=Math.round(w*.47);i>=0;i--){const r=d[i*4],g=d[i*4+1],b=d[i*4+2];if(r>215&&g>200&&b>150)n++;else break}return n/w})()"
    runs = []
    for _ in range(3):
        pg.evaluate("document.querySelector('.rv-book-ctl [data-a=next]').click()"); pg.wait_for_timeout(1500)
        runs.append(round(pg.evaluate(RUN), 3))
    note(f"B5 left page run (share of stage width, cover flat) per spread: {runs}")
    if min(runs) < 0.1: problems.append(f"B5 the left page is hidden behind the endpaper once the cover lies flat: {runs}")
    pg.evaluate("document.documentElement.classList.remove('effects-paused')")
    for _ in range(3): pg.evaluate("document.querySelector('.rv-book-ctl [data-a=prev]').click()")
    pg.wait_for_timeout(800)
    # the book must never touch the canvas border (a cut-off cover/page was visible mid-turn): sample the outer 3px frame of the stage
    EDGE = "(()=>{const c=document.querySelector('.rec-3d'),x=c.getContext('2d'),w=c.width,h=c.height;let n=0;for(const [a,b,cw,ch] of [[0,0,w,3],[0,h-3,w,3],[0,0,3,h],[w-3,0,3,h]]){const d=x.getImageData(a,b,cw,ch).data;for(let i=3;i<d.length;i+=4)if(d[i]>200)n++}return n})()"
    edge = [pg.evaluate(EDGE)]; ndc = []
    for _ in range(2):
        pg.evaluate("document.querySelector('.rv-book-ctl [data-a=next]').click()")
        for _ in range(4): pg.wait_for_timeout(120); edge.append(pg.evaluate(EDGE)); ndc.append(pg.evaluate("BKStage.book.bounds?BKStage.book.bounds():null"))
    pg.wait_for_timeout(300)
    note(f"B5 pixels touching the stage border (open + mid-turn samples): {edge}")
    if any(edge): problems.append(f"B5 the open book is cut off at the stage edge: {edge}")
    # R5: the page polygons themselves (every vertex of every visible leaf, projected) stay clear of the stage border in every sampled frame, not just the painted pixels
    if any(n is None for n in ndc): problems.append("R5 BKStage.book.bounds() is missing (page polygon edge-contact test)")
    else:
        worst = max(max(abs(n["x0"]), abs(n["x1"]), abs(n["y0"]), abs(n["y1"])) for n in ndc)
        note(f"R5 worst projected page vertex over {len(ndc)} mid-turn frames: {worst:.3f} of the half stage (limit 0.985)")
        if worst >= 0.985: problems.append(f"R5 a page polygon touches the stage edge mid-turn: {worst:.3f}")
    st2 = pg.evaluate("BKStage.book.state()")
    pg.evaluate("document.querySelector('.rv-book-ctl [data-a=prev]').click()"); st3 = pg.evaluate("BKStage.book.state()")
    for _ in range(3): pg.evaluate("document.querySelector('.rv-book-ctl [data-a=next]').click()")
    st4 = pg.evaluate("BKStage.book.state()"); next_dis = pg.evaluate("document.querySelector('.rv-book-ctl [data-a=next]').disabled")
    # ---- R5 step 1: real cylinder bend (arc length kept, strong tip angle, sheet thickness) and flag pagebend; step 2: paper fibre normal map, back-face bleed, leaf shadows
    ps = pg.evaluate("window.BKStage&&BKStage.pageShape?{on:[.25,.5,.75].map(p=>BKStage.pageShape(p,true)),off:BKStage.pageShape(.25,false),rest:BKStage.pageShape(0,true)}:null")
    note(f"R5 page shape {ps}")
    if not ps: problems.append("R5 BKStage.pageShape() is missing")
    else:
        q25 = ps["on"][0]
        if not (q25["tip"] >= .3): problems.append(f"R5 turning page is not bent like a cylinder (tip angle {q25['tip']:.3f} rad at p=.25, need >= 0.3)")
        if not all(abs(o["arc"] - 1) < .003 for o in ps["on"]): problems.append(f"R5 bending must keep the arc length of the sheet: {[o['arc'] for o in ps['on']]}")
        if not all(.0015 <= o["thick"] <= .004 for o in ps["on"] + [ps["rest"]]): problems.append(f"R5 sheet has no thickness while bending: {[o['thick'] for o in ps['on']]}")
        if ps["off"]["thick"] != 0 or ps["off"]["tip"] > .2: problems.append(f"R5 flag pagebend=0 must give the previous parabola shape without thickness: {ps['off']}")
        if ps["rest"]["tip"] > 1e-6: problems.append(f"R5 a resting leaf must be flat: {ps['rest']}")
    lv = pg.evaluate("BKStage.book.leaves?BKStage.book.leaves():null"); note(f"R5 leaf materials {lv}")
    if not lv: problems.append("R5 BKStage.book.leaves() is missing")
    else:
        if not all(l["fiber"] and l["bleed"] and l["recv"] for l in lv): problems.append(f"R5 paper lacks fibre normal map / back-face bleed / shadow receiving at level 0: {lv}")
        pg.evaluate("BKStage.forceLevel(2)"); pg.wait_for_timeout(600); lv2 = pg.evaluate("BKStage.book.leaves()"); pg.evaluate("BKStage.forceLevel(0)"); pg.wait_for_timeout(600)
        note(f"R5 leaf materials at level 2 {lv2}")
        if any(l["fiber"] or l["bleed"] for l in lv2): problems.append(f"R5 heavy paper layers must be off at level 2: {lv2}")
    # ---- R5 step 3: gilt page-block edges (foil with a leaf-ridge normal map) and a curved, striped headband; only the record book (the shelf books stay as they were)
    eg = pg.evaluate("BKStage.book.edges?BKStage.book.edges():null"); note(f"R5 book edges {eg}")
    if not eg: problems.append("R5 BKStage.book.edges() is missing")
    else:
        if not (eg["gilt"] and eg["fore"]["metal"] >= .8 and eg["fore"]["normal"] and eg["head"]["metal"] >= .8 and eg["head"]["normal"]): problems.append(f"R5 page block edges are not gilt foil with a ridge normal map: {eg}")
        if not (eg["band"]["curved"] and eg["band"]["bow"] >= .008 and eg["band"]["striped"]): problems.append(f"R5 headband must be a curved, striped tube (bow >= 8 mm): {eg['band']}")
        pg.evaluate("BKStage.forceLevel(2)"); pg.wait_for_timeout(600); eg2 = pg.evaluate("BKStage.book.edges()"); pg.evaluate("BKStage.forceLevel(0)"); pg.wait_for_timeout(600)
        note(f"R5 book edges at level 2 {eg2}")
        if eg2["fore"]["normal"] or eg2["head"]["normal"]: problems.append(f"R5 edge normal maps must be off at level 2: {eg2}")
        # cover emboss: the foil stamping + binding grain as a normal map derived from the height field (not a bump map)
        if not (eg.get("cover") and eg["cover"]["normal"] and not eg["cover"]["bump"]): problems.append(f"R5 cover relief must be a normal map from the height field (no bump map): {eg.get('cover')}")
        if eg2.get("cover") and eg2["cover"]["normal"]: problems.append(f"R5 cover normal map must be off at level 2: {eg2['cover']}")
    # ---- R5 step 4: page text is repainted at 2x (1536x2160, anisotropy 16) while the book is open at levels 0-1, back to 768x1080 at level 2
    pr = None
    for _ in range(40):
        pr = pg.evaluate("BKStage.book.pageRes?BKStage.book.pageRes():null")
        if pr and pr["w"] >= 1536 and pr["all"]: break
        pg.wait_for_timeout(250)
    note(f"R5 page texture {pr}")
    if not pr: problems.append("R5 BKStage.book.pageRes() is missing")
    else:
        if not (pr["w"] == 1536 and pr["h"] == 2160 and pr["all"] and pr["aniso"] == min(16, pr["maxAniso"])): problems.append(f"R5 open book pages must be repainted at 1536x2160 with anisotropy 16 (or the GPU maximum): {pr}")
        pg.evaluate("BKStage.forceLevel(2)")
        for _ in range(40):
            pg.wait_for_timeout(250); pr2 = pg.evaluate("BKStage.book.pageRes()")
            if pr2["w"] == 768 and pr2["all"]: break
        pg.evaluate("BKStage.forceLevel(0)"); pg.wait_for_timeout(1500)
        note(f"R5 page texture at level 2 {pr2}")
        if pr2["w"] != 768 or not pr2["all"]: problems.append(f"R5 page textures must go back to 768x1080 at level 2: {pr2}")
    # ---- R5 step 5: the ribbon rests on the page (never inside it) and hangs from the page edge; closed again it returns to the block head
    rb = None
    for _ in range(30):
        pg.wait_for_timeout(200); rb = pg.evaluate("BKStage.book.ribbon?BKStage.book.ribbon():null")
        if rb and rb["open"]: break
    note(f"R5 ribbon {rb}")
    if not rb: problems.append("R5 BKStage.book.ribbon() is missing")
    else:
        if not rb["open"]: problems.append(f"R5 ribbon does not know the book is open: {rb}")
        if rb["minClear"] < 0: problems.append(f"R5 ribbon sinks into the page ({rb['minClear']:.4f}): {rb}")
        if rb["maxClear"] > .06: problems.append(f"R5 ribbon floats above the page ({rb['maxClear']:.4f}), it must rest on it: {rb}")
        if rb["speed"] >= .02: problems.append(f"R5 the part of the ribbon lying on the page must be at rest (speed {rb['speed']:.4f})")
        if rb["tail"] >= 1.0: problems.append(f"R5 the ribbon tail below the page swings wildly (speed {rb['tail']:.3f} units/s)")
    pg.keyboard.press("Escape"); pg.wait_for_timeout(600)
    closed = pg.evaluate("!document.querySelector('.rv-art.book-open')&&!BKStage.book.state().open")
    note(f"B5 closed {st0['open']}, opened {st1['open']} (coverK {st1['coverK']}), stage centred {stage_ok}, leaf after 2x next {st2['leaf']}, after prev {st3['leaf']}, after 3x more {st4['leaf']} (next disabled {next_dis}), Esc closes {closed}")
    if st0["open"] or not st1["open"] or not stage_ok or not prev_dis: problems.append(f"B5 open/close state wrong: {st0} {st1} stage {stage_ok} prev-disabled {prev_dis}")
    if st2["leaf"] != 2 or st3["leaf"] != 1 or st4["leaf"] != 3 or not next_dis: problems.append(f"B5 page turning wrong: {st2['leaf']},{st3['leaf']},{st4['leaf']} next-disabled {next_dis}")
    if not closed: problems.append("B5 Escape did not close the open book")
    # ---- B8 GPU context loss: the shelf books must come back with their lighting (the baked studio map is a render target and is lost with the context)
    for _ in range(3): pg.keyboard.press("Escape"); pg.wait_for_timeout(500)
    pg.evaluate("document.querySelector('#spotlightGrid').scrollIntoView({block:'center'})")
    LUM = "(()=>{const cs=[...document.querySelectorAll('.shelf-3d')];let n=0,s=0;for(const c of cs){const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;for(let i=0;i<d.length;i+=4)if(d[i+3]>200){n++;s+=d[i]+d[i+1]+d[i+2]}}return n?s/n/3:0})()"
    pg.wait_for_function(LUM.replace("})()", "})()>10"), timeout=120000); pg.wait_for_timeout(4000)
    base = pg.evaluate(LUM)
    pg.evaluate("for(const c of window.__gls){const e=c.getExtension('WEBGL_lose_context');if(!e)continue;c.canvas.addEventListener('webglcontextlost',()=>setTimeout(()=>e.restoreContext(),400));e.loseContext()}")
    pg.wait_for_timeout(2500)
    after = 0
    for _ in range(30):
        pg.wait_for_timeout(1000); after = pg.evaluate(LUM)
        if base and after >= base * .9: break
    # the 3D hero steps aside for its 2D fallback while the context is gone and must come back with it (it used to be torn down for good)
    hero_back = False
    for _ in range(20):
        pg.wait_for_timeout(1000); hero_back = pg.evaluate("document.querySelector('.hero-gl')!==null&&document.querySelector('.hero-gl canvas.on')!==null")
        if hero_back: break
    note(f"B8 hero 3D back after restore: {hero_back}")
    if not hero_back: problems.append("B8 the 3D hero did not return after a GPU context loss")
    note(f"B8 shelf brightness before context loss {base:.0f}, after restore {after:.0f}")
    if not base or after < base * .9: problems.append(f"B8 shelf books did not recover from a GPU context loss (brightness {base:.0f} -> {after:.0f})")
    gls = pg.evaluate("window.BKGL?BKGL.diag().scenes:null"); note(f"B8 BKGL scenes after restore: {gls}")
    if not gls: problems.append("B8 BKGL.diag() is missing")
    else:
        for n in ("hero", "stage", "ground"):   # R8: the ground's mirror target + wave ping-pong are render targets too — BKGL must ride their loss/restore out (BKGround.info().targets is pinned per tier by B20)
            sc = gls.get(n)
            if not sc or sc["losses"] < 1 or sc["restores"] < 1 or sc["lost"]: problems.append(f"B8 BKGL did not track the context loss of '{n}': {sc}")
        if any(v["lost"] for v in gls.values()): problems.append(f"B8 a scene is still marked lost after restore: {[k for k, v in gls.items() if v['lost']]}")
    mdiag = pg.evaluate("window.BKMaterials?BKMaterials.diag():null"); note(f"B8 BKMaterials after restore: {mdiag}")
    if not mdiag or mdiag["rebakes"] < 1: problems.append(f"B8 the studio light (PMREM) was not re-baked in BKMaterials after the context loss: {mdiag}")
    elif mdiag["bakes"] != len(mdiag["envs"]) + mdiag["rebakes"]: problems.append(f"B8 studio bakes do not add up (first bakes + re-bakes): {mdiag}")
    if a.only is None: b9(b)
    if errs: problems.append(f"console errors: {errs[:3]}")
    if a.only is None: b10(b)
    if a.only is None: b11(b)
    if a.only is None: b12(b)
    if a.only is None: b13(b)
    if a.only is None: b14(b)
    if a.only is None: b15(b); b16(b); b17(b); b18(b); b19(b); b20(b); b21(b)
    b.close()
if srv: srv.terminate()
print("FAIL" if problems else "OK: Package A features behave as specified", *problems, sep="\n - " if problems else "")
sys.exit(1 if problems else 0)
