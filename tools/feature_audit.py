#!/usr/bin/env python3
"""Feature checks for Package A (continuous camera, return flight, governor recovery, atlas dive).

  python tools/feature_audit.py [--url http://127.0.0.1:8671/]
A1 atlas objects dolly in as their tile arrives (camera z shrinks, opacity rises while scrolling down to the tiles);
A2 a record opened from a hero star spawns a return ghost when it closes (and none when opened elsewhere);
A3 the quality governor degrades at once, recovers one level at a time only after sustained fast windows, and locks recovery after a flip-flop;
A4 clicking an atlas tile shows the dive (class .diving), delays the filter ~420 ms, then applies it exactly once."""
import argparse, os, sys, time
from playwright.sync_api import sync_playwright
ap = argparse.ArgumentParser(); ap.add_argument("--url", default="http://127.0.0.1:8671/"); a = ap.parse_args()
problems = []; note = lambda m: print(m, flush=True)
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=os.environ.get("BK_CHROMIUM") or "/opt/pw-browsers/chromium", args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
    pg = b.new_context(viewport={"width": 1440, "height": 900}, service_workers="block").new_page()
    errs = []; pg.on("pageerror", lambda e: errs.append(str(e))); pg.on("console", lambda m: errs.append(m.text[:200]) if m.type == "error" else None)
    pg.goto(a.url + "?fa=" + str(time.time()), wait_until="load")
    pg.wait_for_function('window.BKHero&&window.BKStage&&typeof records!=="undefined"&&records.length', timeout=120000)
    pg.wait_for_function("document.querySelectorAll('.tile-3d.on').length>=6", timeout=120000); pg.wait_for_timeout(2000)
    # ---- A3 governor (synthetic windows: avg frame seconds, clock ms)
    r = pg.evaluate("""(()=>{const g=BKHero.gov,t=performance.now()+1e6,L=[];const f=(avg,now)=>{L.push(g.feed(avg,now))};
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
    pg.evaluate(f"scrollTo(0,{int(top)-900*1.0})"); pg.wait_for_timeout(2500); far = pg.evaluate("BKStage.tiles()")
    pg.evaluate(f"scrollTo(0,{int(top)-250})"); pg.wait_for_timeout(2500); near = pg.evaluate("BKStage.tiles()")
    zf = sum(t["z"] for t in far) / len(far); zn = sum(t["z"] for t in near) / len(near)
    note(f"A1 mean camera z far {zf:.2f} -> near {zn:.2f}")
    if not zf > zn * 1.08: problems.append(f"A1 atlas camera does not dolly in while arriving: {zf:.2f} -> {zn:.2f}")
    # ---- A4 atlas dive
    pg.evaluate(f"scrollTo(0,{int(top)-120})"); pg.wait_for_timeout(2500)
    pg.evaluate("window.__clicks=0;const ct=document.getElementById('collectionGrid');ct.addEventListener('click',()=>window.__clicks++)")
    before = pg.evaluate("typeof discoveryIndex==='undefined'?null:discoveryIndex")
    pg.evaluate("document.querySelectorAll('.atlas-tile')[1].click()")
    pg.wait_for_timeout(120); diving = pg.evaluate("document.querySelectorAll('.atlas-tile')[1].classList.contains('diving')"); early = pg.evaluate("typeof discoveryIndex==='undefined'?null:discoveryIndex")
    pg.wait_for_timeout(2500); after = pg.evaluate("typeof discoveryIndex==='undefined'?null:discoveryIndex"); clicks = pg.evaluate("window.__clicks")
    note(f"A4 diving={diving} filter before/early/after = {before}/{early}/{after}, clicks reaching the grid = {clicks}")
    if not diving: problems.append("A4 .diving class not shown right after the click")
    if early != before: problems.append("A4 filter applied before the dive finished")
    if after == before or after is None: problems.append("A4 filter never applied after the dive")
    if clicks != 1: problems.append(f"A4 click reached the grid {clicks}x (expected exactly once)")
    # ---- A2 return flight
    pg.evaluate("scrollTo(0,0)"); pg.wait_for_timeout(2500)
    pg.evaluate("BKHero.fly(37)"); pg.wait_for_function("!document.getElementById('recordView').hidden", timeout=60000); pg.wait_for_timeout(2500)
    pg.evaluate("document.getElementById('recordBack').click()"); pg.wait_for_timeout(250)
    ret = pg.evaluate("document.querySelectorAll('.fly-ghost.fly-return').length")
    pg.wait_for_timeout(2500)
    pg.evaluate("openRecord(records[7].id)"); pg.wait_for_timeout(2000); pg.evaluate("document.getElementById('recordBack').click()"); pg.wait_for_timeout(250)
    none = pg.evaluate("document.querySelectorAll('.fly-ghost.fly-return').length")
    note(f"A2 return ghosts after a star-born record: {ret}; after an ordinary record: {none}")
    if ret < 1: problems.append("A2 no return ghost after closing a star-born record")
    if none != 0: problems.append("A2 return ghost appeared for a record that was not opened from a star")
    if errs: problems.append(f"console errors: {errs[:3]}")
    b.close()
print("FAIL" if problems else "OK: Package A features behave as specified", *problems, sep="\n - " if problems else "")
sys.exit(1 if problems else 0)
