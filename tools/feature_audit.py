#!/usr/bin/env python3
"""Feature checks for Package A (continuous camera, return flight, governor recovery, atlas dive).

  python tools/feature_audit.py [--url http://127.0.0.1:8671/]
A1 atlas objects dolly in as their tile arrives (camera z shrinks, opacity rises while scrolling down to the tiles);
A2 a record opened from a hero star spawns a return ghost when it closes (and none when opened elsewhere);
A3 the quality governor degrades at once, recovers one level at a time only after sustained fast windows, and locks recovery after a flip-flop;
B8 context loss, B9 broken GPU, B10 quality tiers reach the stage (DPR cap, idle frame rate) and one ?diag panel; B11 GPU timing, ?perf panel and shader warm-up (Long Tasks, zero cost when ?perf is off); B12 shared material/light library (one studio bake per renderer and preset, ACES + exposure in one place and off by default, material levels, kill-switch flag); B5 the 3D book opens into a centred reading stage, pages turn and Escape closes it; B6 the medal uses a normal-map relief with a reeded rim; B7 the dome/telescope follows the pointer.
A4 clicking an atlas tile shows the dive (class .diving), delays the filter ~420 ms, then applies it exactly once."""
import json, argparse, os, socket, subprocess, sys, time
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT = Path(__file__).resolve().parent.parent
ap = argparse.ArgumentParser(); ap.add_argument("--url"); ap.add_argument("--only", choices=["main", "b9", "b10", "b11", "b12"], help="run one slice (CI runs the slices as parallel jobs); default runs everything"); a = ap.parse_args()
srv = None
if not a.url:
    s_ = socket.socket(); s_.bind(("127.0.0.1", 0)); port = s_.getsockname()[1]; s_.close()
    srv = subprocess.Popen([sys.executable, "-m", "http.server", str(port), "--directory", str(ROOT / "site")], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
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
    on, off = min(on1, on2), min(off1, off2)
    note(f"B11 long tasks >50 ms in the first 5 s: warm-up on {on1},{on2} · flag off {off1},{off2} (off states {st1})")
    if lerr: note("B11 note: Long Task API unavailable in this browser")
    if on > off + 2: problems.append(f"B11 warm-up added long tasks in the first 5 s ({on} with, {off} without)")
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

if a.only in ("b9", "b10", "b11", "b12"):
    with sync_playwright() as p:
        kw = dict(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"]); exe = os.environ.get("BK_CHROMIUM")
        b = p.chromium.launch(executable_path=exe, **kw) if exe else p.chromium.launch(**kw)
        {"b9": b9, "b10": b10, "b11": b11, "b12": b12}[a.only](b); b.close()
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
        pg.evaluate("BKStage.forceLevel(2)"); pg.wait_for_timeout(1500); pr2 = pg.evaluate("BKStage.book.pageRes()"); pg.evaluate("BKStage.forceLevel(0)"); pg.wait_for_timeout(1500)
        note(f"R5 page texture at level 2 {pr2}")
        if pr2["w"] != 768: problems.append(f"R5 page textures must go back to 768x1080 at level 2: {pr2}")
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
        for n in ("hero", "stage"):
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
    b.close()
if srv: srv.terminate()
print("FAIL" if problems else "OK: Package A features behave as specified", *problems, sep="\n - " if problems else "")
sys.exit(1 if problems else 0)
