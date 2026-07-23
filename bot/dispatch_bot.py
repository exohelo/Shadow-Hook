#!/usr/bin/env python3
"""
Shadow Hook · dispatch board bot  (v3 — keep-searching, July 23 2026)

New in v3: --watch MIN. GitHub's shared cron is heavily throttled (a */15
schedule can fire hours apart), so each run can now LINGER: while a sheet's
posting window is open and the sheet still isn't up, the run re-checks every
few minutes instead of exiting — a late sheet lands minutes after it posts,
not hours later on the next lucky cron fire.

Runs on a schedule (GitHub Action). For the current Pacific day it chases the
dispatch sheets on ilwu13.com — tonight's EARLY (E), tonight's final NIGHT (N),
tomorrow's MORNING (D), plus an overnight catch-up for THIS morning's D — parses
each, and upserts the forecast into Supabase `dispatch_boards` in the exact
shape the app reads.

v2 fixes the bug that starved the whole pipeline: v1 fetched all three sheets
from Day-Night-Early/, but only E lives there. Verified against the live site:
    E  → Dispatches/Day-Night-Early/    (072126E.pdf — named for that day)
    N  → Dispatches/Nightside-Final/    (072126N.pdf — named for that day)
    D  → Dispatches/Dayside-Final/      (072226D.pdf — named for the MORNING
                                          it's for, posted the evening before)
(Same three-folder map as the app's #201 comment. Date a board by its FILENAME,
never the fax header — a D sheet's header is the evening before.)

Also new in v2:
  · skips a sheet that's already fully in dispatch_boards (no re-OCR every 15 min)
  · passes flops / ships / generated / serial / pages through to the app
  · fails LOUDLY (red run) if the Supabase env/secret is missing — v1 swallowed
    that as a per-sheet warning and the run stayed green
  · --date/--kind backfill mode for missed days

Env:  SUPABASE_URL, SUPABASE_SERVICE_KEY   (set as GitHub secrets)
Test: python3 dispatch_bot.py --test <local.pdf> <E|N|D> <YYYY-MM-DD>   (no network)
"""
import os, sys, json, time, argparse, datetime, tempfile, urllib.request, urllib.parse
from parse_forecast import parse_pdf

ROOT = os.environ.get("DISPATCH_ROOT",
    "https://ilwu13.com/wp-content/uploads/simple-file-list/Dispatches/")
FOLDERS = {
    "E": os.environ.get("DISPATCH_FOLDER_E", ROOT + "Day-Night-Early/"),
    "N": os.environ.get("DISPATCH_FOLDER_N", ROOT + "Nightside-Final/"),
    "D": os.environ.get("DISPATCH_FOLDER_D", ROOT + "Dayside-Final/"),
}
DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

def dow(d):   return DOW[(d.weekday() + 1) % 7]                      # Mon.. -> Sun-indexed (matches the app)
def fname(d, L): return f"{d.month:02d}{d.day:02d}{str(d.year)[-2:]}{L}.pdf"   # 072126E.pdf
def key_for(d, ap): return f"{d.isoformat()}_{dow(d)}_{ap}"          # 2026-07-21_Tue_PM

def targets(today):
    """Every sheet worth chasing on `today` (skip-if-present makes extras free):
       E/N → today's PM row (E nested under .early) · D → tomorrow's AM row ·
       plus catch-ups: THIS morning's D and YESTERDAY's N, so a run that was
       missed (bot down, sheet late) self-heals on the next plain run — no
       manual backfill needed for a one-day gap."""
    tomo = today + datetime.timedelta(days=1)
    yday = today - datetime.timedelta(days=1)
    return [
        {"kind": "EARLY",     "letter": "E", "fdate": today, "key": key_for(today, "PM"), "nest": "early",
         "url": FOLDERS["E"] + fname(today, "E")},
        {"kind": "NIGHT",     "letter": "N", "fdate": today, "key": key_for(today, "PM"), "nest": None,
         "url": FOLDERS["N"] + fname(today, "N")},
        {"kind": "MORNING",   "letter": "D", "fdate": tomo,  "key": key_for(tomo, "AM"),  "nest": None,
         "url": FOLDERS["D"] + fname(tomo, "D")},
        {"kind": "CATCHUP",   "letter": "D", "fdate": today, "key": key_for(today, "AM"), "nest": None,
         "url": FOLDERS["D"] + fname(today, "D")},
        {"kind": "CATCHUP-N", "letter": "N", "fdate": yday,  "key": key_for(yday, "PM"),  "nest": None,
         "url": FOLDERS["N"] + fname(yday, "N")},
    ]

def already_have(existing, nest):
    """Mirrors the app's isFound(): EARLY needs .early; N/D need total/boards."""
    if not existing:
        return False
    if nest == "early":
        return bool(existing.get("early"))
    return bool(existing.get("total") or existing.get("boards"))

def payload_from(parsed, src):
    """The forecast slice the app stores/reads. flops/ships/header ride along
    when the parser found them — the app renders all of them."""
    out = {"total": parsed["total"], "boards": parsed["boards"]}
    for k in ("shift", "flops", "ships", "generated", "serial", "pages"):
        v = parsed.get(k)
        if v not in (None, [], {}):
            out[k] = v
    out["src"] = src
    return out

# ---- Supabase REST (service key bypasses RLS; read-merge-write preserves siblings) ----
def _req(url, data=None, method="GET"):
    key = os.environ["SUPABASE_SERVICE_KEY"]
    h = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    if method == "POST":
        h["Prefer"] = "resolution=merge-duplicates,return=minimal"
    r = urllib.request.Request(url, data=data, method=method, headers=h)
    with urllib.request.urlopen(r, timeout=45) as resp:
        return resp.read()

def sb_get(key):
    base = os.environ["SUPABASE_URL"].rstrip("/")
    url = f"{base}/rest/v1/dispatch_boards?key=eq.{urllib.parse.quote(key)}&select=data"
    arr = json.loads(_req(url) or b"[]")
    return arr[0]["data"] if arr else {}

def sb_upsert(key, data):
    base = os.environ["SUPABASE_URL"].rstrip("/")
    body = json.dumps([{"key": key, "data": data}]).encode()
    _req(f"{base}/rest/v1/dispatch_boards?on_conflict=key", data=body, method="POST")

def download(url, dest):
    req = urllib.request.Request(url, headers={"User-Agent": "shadowhook-dispatch-bot"})
    with urllib.request.urlopen(req, timeout=90) as r, open(dest, "wb") as f:
        f.write(r.read())

def merge(existing, payload, nest):
    out = dict(existing or {})
    if nest:
        out[nest] = payload
    else:
        out.update(payload)
    return out

def require_env():
    missing = [k for k in ("SUPABASE_URL", "SUPABASE_SERVICE_KEY") if not os.environ.get(k)]
    if missing:
        sys.exit(f"FATAL: missing env {', '.join(missing)} — add the repo secret "
                 f"(Settings → Secrets and variables → Actions → SUPABASE_SERVICE_KEY).")

def process(t, dry=False, existing=None):
    """Parse the downloaded sheet at t['tmp'] and upsert it under t['key']."""
    parsed = parse_pdf(t["tmp"])
    if parsed.get("error") or not parsed.get("boards"):
        print(f"  · {os.path.basename(t['tmp'])}: no forecast page ({parsed.get('error','')})")
        return None
    if parsed.get("workdate") and parsed["workdate"] != t["fdate"].isoformat():
        print(f"  ! workdate in sheet ({parsed['workdate']}) != file date ({t['fdate']}); using file date for the key")
    payload = payload_from(parsed, t["url"].split("/")[-1])
    # 'Shift: Day/Night' OCRs unreliably off the scan; the sheet letter is definitive
    if not payload.get("shift"):
        payload["shift"] = "Day" if t["letter"] == "D" else "Night"
    if parsed.get("warnings"):
        print(f"  ~ ocr notes: {parsed['warnings']}")
    if dry:
        print(json.dumps({"key": t["key"], "nest": t["nest"], "data": merge({}, payload, t["nest"])},
                         indent=2, ensure_ascii=False))
        return t["key"]
    merged = merge(existing if existing is not None else sb_get(t["key"]), payload, t["nest"])
    sb_upsert(t["key"], merged)
    tot = payload.get("total") or {}
    print(f"  ✓ {t['key']}{'.'+t['nest'] if t['nest'] else ''}  total={tot.get('total','?')} jobs"
          + (f", flops={payload['flops']}" if 'flops' in payload else "")
          + (f", ships={len(payload['ships'])}" if 'ships' in payload else "")
          + (f", shift={payload.get('shift')}" if payload.get('shift') else ""))
    return t["key"]

def chase(t, force=False):
    """Chase one sheet. Returns (status, key):
       'ingested'  — parsed + upserted this run
       'have'      — already in dispatch_boards, skipped
       'not_up'    — the PDF isn't posted yet (or unreachable)
       'no_page'   — downloaded but no forecast page found
       'error'     — read/parse/upsert blew up"""
    f = t["url"].split("/")[-1]
    existing = {}
    try:
        existing = sb_get(t["key"])
    except Exception as e:
        print(f"  ! {f}: supabase read failed ({e})")
    if not force and already_have(existing, t["nest"]):
        print(f"  = {f}: already in dispatch_boards ({t['key']}{'.'+t['nest'] if t['nest'] else ''}) — skip")
        return ("have", t["key"])
    tmp = os.path.join(tempfile.gettempdir(), f)
    try:
        download(t["url"], tmp)
    except Exception as e:
        print(f"  · {f}: not up yet / unreachable ({getattr(e, 'code', e)})")
        return ("not_up", None)
    t = dict(t, tmp=tmp)
    try:
        k = process(t, existing=existing)
        return ("ingested", k) if k else ("no_page", None)
    except Exception as e:
        print(f"  ! {f}: {e}")
        return ("error", None)

# ── #jul23 — KEEP SEARCHING. GitHub's cron is throttled hard (a */15 schedule
# can fire hours apart), and a sheet that posted inside one of those gaps used
# to sit missing until somebody force-ran the bot. A run no longer gives up:
# while a sheet is IN SEASON (its posting window is open) and still missing,
# the run stays alive and re-checks every few minutes, up to --watch minutes.
# Extra passes are nearly free: already-ingested sheets skip on one Supabase GET.
WATCH_WINDOWS = {           # minutes-of-LA-day when a missing sheet is worth re-chasing
    "EARLY":     (9*60+25,  16*60+30),   # E posts ~9:30 after morning dispatch
    "NIGHT":     (14*60+25, 24*60),      # N posts ~2:30 PM
    "MORNING":   (16*60+40, 24*60),      # tomorrow's D posts ~5 PM the evening before
    "CATCHUP":   (0,        9*60+30),    # this morning's D, overnight until its board runs
    "CATCHUP-N": (0,        0),          # yesterday's N: chase once, never hold the run open for it
}

def in_season(kind, now=None):
    now = now or datetime.datetime.now()      # Action sets TZ=America/Los_Angeles
    m = now.hour * 60 + now.minute
    lo, hi = WATCH_WINDOWS.get(kind, (0, 0))
    return lo <= m < hi

def one_pass(force=False):
    """Chase every target once. Returns (done_keys, kinds_still_worth_watching)."""
    today = datetime.date.today()
    done, watching = [], []
    for t in targets(today):
        print(f"[{t['kind']}] {t['url']}")
        status, k = chase(t, force=force)
        if status == "ingested":
            done.append(k)
        elif status in ("not_up", "error", "no_page") and in_season(t["kind"]):
            watching.append(t["kind"])
    return done, watching

def run(force=False, watch_min=0):
    require_env()
    today = datetime.date.today()
    print(f"Dispatch bot v3 · {today} ({dow(today)})"
          + (f" · will watch up to {watch_min} min for late sheets" if watch_min else ""))
    deadline = time.time() + watch_min * 60
    all_done, passes = [], 0
    while True:
        passes += 1
        done, watching = one_pass(force=(force and passes == 1))
        all_done += done
        if not watching:
            break                       # everything in season is in — no reason to linger
        if time.time() >= deadline:
            if watch_min:
                print(f"…watch budget spent — {', '.join(watching)} still not posted; the next run picks them up.")
            break
        wait = min(300, max(60, int(deadline - time.time())))
        print(f"…{', '.join(watching)} not posted yet — checking again in {wait//60} min (pass {passes}).")
        time.sleep(wait)
    print("done —", (", ".join(all_done) if all_done else "nothing new this run"))

def parse_date_arg(s):
    """Forgiving date reader: 2026-07-21, 7/21/2026, 07/21/26, 7-21-2026 all work."""
    s = (s or "").strip().strip(",.;'\"")
    for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%m/%d/%y", "%Y/%m/%d", "%m-%d-%Y", "%m-%d-%y"):
        try:
            return datetime.datetime.strptime(s, fmt).date()
        except ValueError:
            pass
    sys.exit(f"FATAL: couldn't read the date '{s}' — type it like 2026-07-21")

def one_sheet(date_str, letter, force=False):
    """Backfill / repair a single sheet: --date 2026-07-21 --kind N"""
    require_env()
    d = parse_date_arg(date_str)
    ap = "AM" if letter == "D" else "PM"
    t = {"kind": {"E": "EARLY", "N": "NIGHT", "D": "MORNING"}[letter], "letter": letter,
         "fdate": d, "key": key_for(d, ap), "nest": "early" if letter == "E" else None,
         "url": FOLDERS[letter] + fname(d, letter)}
    print(f"Backfill · {t['url']} -> {t['key']}" + (f" (.{t['nest']})" if t["nest"] else ""))
    chase(t, force=force)

if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="Shadow Hook dispatch board bot")
    ap.add_argument("--test", nargs=3, metavar=("PDF", "LETTER", "DATE"),
                    help="parse a local PDF as E|N|D for YYYY-MM-DD and print JSON (no network)")
    ap.add_argument("--date", help="backfill one sheet: the date (YYYY-MM-DD; slashes fine too)")
    ap.add_argument("--kind", type=lambda s: s.strip().strip(",.;'\"").upper(),
                    choices=["E", "N", "D"], help="backfill one sheet: the letter (any case)")
    ap.add_argument("--force", action="store_true", help="re-ingest even if already in the table")
    ap.add_argument("--watch", type=int, default=0, metavar="MIN",
                    help="stay alive up to MIN minutes, re-checking every few minutes for sheets "
                         "that are in season but not posted yet (survives GitHub's cron gaps)")
    a, stray = ap.parse_known_args()
    if stray:
        print(f"note: ignoring stray input {stray}")
    if bool(a.date) != bool(a.kind):
        sys.exit("FATAL: a backfill needs BOTH boxes — the date (like 2026-07-21) AND the letter (E, N or D).")
    if a.test:
        pdf, L, ds = a.test
        L = L.strip().upper()
        if L not in ("E", "N", "D"):
            sys.exit("letter must be E, N or D")
        d = parse_date_arg(ds)
        apup = "AM" if L == "D" else "PM"
        t = {"kind": "TEST", "letter": L, "fdate": d, "key": key_for(d, apup),
             "nest": "early" if L == "E" else None, "url": "local/" + os.path.basename(pdf), "tmp": pdf}
        print(f"TEST · file {pdf} · letter {L} · date {d} -> key {t['key']}" + (f" (.{t['nest']})" if t["nest"] else ""))
        process(t, dry=True)
    elif a.date and a.kind:
        one_sheet(a.date, a.kind, force=a.force)
    else:
        run(force=a.force, watch_min=max(0, a.watch))
