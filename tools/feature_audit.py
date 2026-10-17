#!/usr/bin/env python3
"""Feature checks for Package A (continuous camera, return flight, governor recovery, atlas dive).

  python tools/feature_audit.py [--url http://127.0.0.1:8671/]
A1 atlas objects dolly in as their tile arrives (camera z shrinks, opacity rises while scrolling down to the tiles);
A2 a record opened from a hero star spawns a return ghost when it closes (and none when opened elsewhere);
A3 the quality governor degrades at once, recovers one level at a time only after sustained fast windows, and locks recovery after a flip-flop;
B5 the 3D book opens into a centred reading stage, pages turn and Escape closes it; B6 the medal uses a normal-map relief with a reeded rim; B7 the dome/telescope follows the pointer.
A4 clicking an atlas tile shows the dive (class .diving), delays the filter ~420 ms, then applies it exactly once."""
import argparse, os, socket, subprocess, sys, time
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT = Path(__file__).resolve().parent.parent
ap = argparse.ArgumentParser(); ap.add_argument("--url"); a = ap.parse_args()
srv = None
if not a.url:
    s_ = socket.socket(); s_.bind(("127.0.0.1", 0)); port = s_.getsockname()[1]; s_.close()
    srv = subprocess.Popen([sys.executable, "-m", "http.server", str(port), "--directory", str(ROOT / "site")], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    a.url = f"http://127.0.0.1:{port}/"; time.sleep(1)
problems = []; note = lambda m: print(m, flush=True)
with sync_playwright() as p:
    kw = dict(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
    exe = os.environ.get("BK_CHROMIUM")      # CI uses Playwright's own browser; locally set BK_CHROMIUM when it has none
    b = p.chromium.launch(executable_path=exe, **kw) if exe else p.chromium.launch(**kw)
    pg = b.new_context(viewport={"width": 1440, "height": 900}, service_workers="block").new_page()
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
    # the book must never touch the canvas border (a cut-off cover/page was visible mid-turn): sample the outer 3px frame of the stage
    EDGE = "(()=>{const c=document.querySelector('.rec-3d'),x=c.getContext('2d'),w=c.width,h=c.height;let n=0;for(const [a,b,cw,ch] of [[0,0,w,3],[0,h-3,w,3],[0,0,3,h],[w-3,0,3,h]]){const d=x.getImageData(a,b,cw,ch).data;for(let i=3;i<d.length;i+=4)if(d[i]>200)n++}return n})()"
    edge = [pg.evaluate(EDGE)]
    for _ in range(2):
        pg.evaluate("document.querySelector('.rv-book-ctl [data-a=next]').click()")
        for _ in range(4): pg.wait_for_timeout(120); edge.append(pg.evaluate(EDGE))
    pg.wait_for_timeout(300)
    note(f"B5 pixels touching the stage border (open + mid-turn samples): {edge}")
    if any(edge): problems.append(f"B5 the open book is cut off at the stage edge: {edge}")
    st2 = pg.evaluate("BKStage.book.state()")
    pg.evaluate("document.querySelector('.rv-book-ctl [data-a=prev]').click()"); st3 = pg.evaluate("BKStage.book.state()")
    for _ in range(3): pg.evaluate("document.querySelector('.rv-book-ctl [data-a=next]').click()")
    st4 = pg.evaluate("BKStage.book.state()"); next_dis = pg.evaluate("document.querySelector('.rv-book-ctl [data-a=next]').disabled")
    pg.keyboard.press("Escape"); pg.wait_for_timeout(600)
    closed = pg.evaluate("!document.querySelector('.rv-art.book-open')&&!BKStage.book.state().open")
    note(f"B5 closed {st0['open']}, opened {st1['open']} (coverK {st1['coverK']}), stage centred {stage_ok}, leaf after 2x next {st2['leaf']}, after prev {st3['leaf']}, after 3x more {st4['leaf']} (next disabled {next_dis}), Esc closes {closed}")
    if st0["open"] or not st1["open"] or not stage_ok or not prev_dis: problems.append(f"B5 open/close state wrong: {st0} {st1} stage {stage_ok} prev-disabled {prev_dis}")
    if st2["leaf"] != 2 or st3["leaf"] != 1 or st4["leaf"] != 3 or not next_dis: problems.append(f"B5 page turning wrong: {st2['leaf']},{st3['leaf']},{st4['leaf']} next-disabled {next_dis}")
    if not closed: problems.append("B5 Escape did not close the open book")
    if errs: problems.append(f"console errors: {errs[:3]}")
    b.close()
if srv: srv.terminate()
print("FAIL" if problems else "OK: Package A features behave as specified", *problems, sep="\n - " if problems else "")
sys.exit(1 if problems else 0)
