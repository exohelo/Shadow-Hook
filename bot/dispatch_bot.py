#!/usr/bin/env python3
"""
Shadow Hook · dispatch board bot  (v2 — the three-folder fix, July 2026)

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
import os, sys, json, argparse, datetime, tempfile, urllib.request, urllib.parse
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
       plus a catch-up D for THIS morning in case an evening run was missed."""
    tomo = today + datetime.timedelta(days=1)
    return [
        {"kind": "EARLY",   "letter": "E", "fdate": today, "key": key_for(today, "PM"), "nest": "early",
         "url": FOLDERS["E"] + fname(today, "E")},
        {"kind": "NIGHT",   "letter": "N", "fdate": today, "key": key_for(today, "PM"), "nest": None,
         "url": FOLDERS["N"] + fname(today, "N")},
        {"kind": "MORNING", "letter": "D", "fdate": tomo,  "key": key_for(tomo, "AM"),  "nest": None,
         "url": FOLDERS["D"] + fname(tomo, "D")},
        {"kind": "CATCHUP", "letter": "D", "fdate": today, "key": key_for(today, "AM"), "nest": None,
         "url": FOLDERS["D"] + fname(today, "D")},
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
    f = t["url"].split("/")[-1]
    existing = {}
    try:
        existing = sb_get(t["key"])
    except Exception as e:
        print(f"  ! {f}: supabase read failed ({e})")
    if not force and already_have(existing, t["nest"]):
        print(f"  = {f}: already in dispatch_boards ({t['key']}{'.'+t['nest'] if t['nest'] else ''}) — skip")
        return None
    tmp = os.path.join(tempfile.gettempdir(), f)
    try:
        download(t["url"], tmp)
    except Exception as e:
        print(f"  · {f}: not up yet / unreachable ({getattr(e, 'code', e)})")
        return None
    t = dict(t, tmp=tmp)
    try:
        return process(t, existing=existing)
    except Exception as e:
        print(f"  ! {f}: {e}")
        return None

def run(force=False):
    require_env()
    today = datetime.date.today()   # Action sets TZ=America/Los_Angeles
    print(f"Dispatch bot v2 · {today} ({dow(today)})")
    done = []
    for t in targets(today):
        print(f"[{t['kind']}] {t['url']}")
        k = chase(t, force=force)
        if k:
            done.append(k)
    print("done —", (", ".join(done) if done else "nothing new this run"))

def one_sheet(date_str, letter, force=False):
    """Backfill / repair a single sheet: --date 2026-07-21 --kind N"""
    require_env()
    d = datetime.date.fromisoformat(date_str)
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
    ap.add_argument("--date", help="backfill one sheet: the date YYYY-MM-DD (with --kind)")
    ap.add_argument("--kind", choices=["E", "N", "D"], help="backfill one sheet: the letter")
    ap.add_argument("--force", action="store_true", help="re-ingest even if already in the table")
    a = ap.parse_args()
    if a.test:
        pdf, L, ds = a.test
        if L not in ("E", "N", "D"):
            sys.exit("letter must be E, N or D")
        d = datetime.date.fromisoformat(ds)
        apup = "AM" if L == "D" else "PM"
        t = {"kind": "TEST", "letter": L, "fdate": d, "key": key_for(d, apup),
             "nest": "early" if L == "E" else None, "url": "local/" + os.path.basename(pdf), "tmp": pdf}
        print(f"TEST · file {pdf} · letter {L} · date {d} -> key {t['key']}" + (f" (.{t['nest']})" if t["nest"] else ""))
        process(t, dry=True)
    elif a.date and a.kind:
        one_sheet(a.date, a.kind, force=a.force)
    else:
        run(force=a.force)
