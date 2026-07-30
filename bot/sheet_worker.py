#!/usr/bin/env python3
"""
SHADOW HOOK — sheet_worker.py
Pulls the community dispatch sheet and upserts finished rows into Supabase
`sheet_log`, so every phone's prediction engine trains on current data with
no app re-ship. Run it on a schedule (GitHub Action / cron), e.g. hourly
09:00–20:00 PT.

── SETUP (one time) ──────────────────────────────────────────────────────────
1. In Google Sheets: File → Share → Publish to web → the LOG tab → CSV.
   Paste that URL below as SHEET_CSV_URL.
2. In Supabase: Settings → API → copy the URL and the *service_role* key
   (the service key bypasses RLS — that's why sheet_log has no client write
   policy). Set them as environment variables or paste below.
3. Run `python3 sheet_worker.py --dry` once and eyeball the parsed rows.
   If your published CSV's column ORDER differs, fix the COLS mapping.
4. Remove --dry, schedule it. Done — the app picks rows up automatically.

── GitHub Action (drop in .github/workflows/sheet.yml) ───────────────────────
  on:
    schedule: [{cron: "0 16-23 * * *"}]   # hourly 9AM–4PM PT (PDT = UTC-7)
  jobs:
    pull:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v4
        - run: pip install requests
        - run: python3 sheet_worker.py
          env:
            SHEET_CSV_URL: ${{ secrets.SHEET_CSV_URL }}
            SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
            SUPABASE_SERVICE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}
──────────────────────────────────────────────────────────────────────────────
"""
import os, sys, csv, io, re, json, datetime
import requests

SHEET_CSV_URL = os.environ.get("SHEET_CSV_URL", "PASTE_PUBLISHED_CSV_URL_HERE")
SUPABASE_URL  = os.environ.get("SUPABASE_URL",  "PASTE_SUPABASE_URL_HERE")
SERVICE_KEY   = os.environ.get("SUPABASE_SERVICE_KEY", "PASTE_SERVICE_ROLE_KEY_HERE")

# ── column mapping: index (0-based) of each field in the published CSV row.
#    Defaults match the sheet's left table as of Jul 2026:
#    date · shift ("Tue PM") · Total Jobs · Casual Hall Final · Start · Pred Mvmt · Actual Mvmt
COLS = { "date": 0, "shift": 1, "total": 2, "ch": 3, "act": 6 }
NAILED_COL = 8   # "Nailed It!" — empty means the movement is not graded yet
SHIFT_RE = re.compile(r"(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s*(AM|PM)")
DOW = {"Mon":0,"Tue":1,"Wed":2,"Thu":3,"Fri":4,"Sat":5,"Sun":6}

def num(s):
    s = str(s or "").replace(",", "").strip()
    if not s or s in ("???", "-", "Wait"): return None
    try: return int(float(s))
    except ValueError: return None

def infer_year(mm, dd, today):
    """Sheet dates are M/D with no year — assume the most recent occurrence."""
    for y in (today.year, today.year - 1):
        try: d = datetime.date(y, mm, dd)
        except ValueError: continue
        if d <= today + datetime.timedelta(days=3): return d
    return None

def parse(csv_text):
    """Verified against the sheet's real CSV export (Jul 2026):
       Date(0) Shift(1) Total Jobs(2) Casual Hall Final(3) Start(4) Pred(5) Actual(6) ... Nailed It!(8).
       Quirks handled: the date cell is MERGED per day (blank on the AM row → forward-fill);
       a shift that has counts but no grade yet must stay out (Nailed It! empty = ungraded);
       only the newest ~100 shift rows are read, so old rows can never mis-year into the feed."""
    today = datetime.date.today()
    out, last_date, seen_rows = [], None, 0
    for row in csv.reader(io.StringIO(csv_text)):
        if len(row) <= NAILED_COL: continue
        m = SHIFT_RE.search(str(row[COLS["shift"]]))
        if not m: continue
        seen_rows += 1
        if seen_rows > 100: break                                  # newest-first sheet: 100 rows ≈ 50 days, one year guaranteed
        dm = re.match(r"^\s*(\d{1,2})/(\d{1,2})", str(row[COLS["date"]]))
        if dm:
            last_date = infer_year(int(dm.group(1)), int(dm.group(2)), today)
        d = last_date                                              # merged cell: AM row inherits the PM row's date
        if d is None or d.weekday() != DOW[m.group(1)]: continue   # weekday sanity
        if d > today + datetime.timedelta(days=3) or d < today - datetime.timedelta(days=70): continue
        tot, ch, act = num(row[COLS["total"]]), num(row[COLS["ch"]]), num(row[COLS["act"]])
        nailed = num(row[NAILED_COL])
        if tot is None or ch is None or act is None: continue      # unfinished rows stay out
        if nailed is None: continue                                # counts in but movement UNGRADED — not final yet
        if tot == 0: continue                                      # hard-shutdown days stay out (engine handles them by rule)
        out.append({"id": f"{d.isoformat()}_{m.group(2)}", "date": d.isoformat(),
                    "ampm": m.group(2), "ch": ch, "tot": tot, "act": act})
    return out

def upsert(rows):
    r = requests.post(
        f"{SUPABASE_URL}/rest/v1/sheet_log",
        params={"on_conflict": "id"},
        headers={"apikey": SERVICE_KEY, "Authorization": f"Bearer {SERVICE_KEY}",
                 "Content-Type": "application/json", "Prefer": "resolution=merge-duplicates"},
        data=json.dumps(rows), timeout=30)
    r.raise_for_status()

if __name__ == "__main__":
    text = requests.get(SHEET_CSV_URL, timeout=30).text
    rows = parse(text)
    # only ship the recent tail — the app ignores anything older than its embedded logs anyway
    rows = [x for x in rows if x["date"] >= (datetime.date.today() - datetime.timedelta(days=45)).isoformat()]
    print(f"parsed {len(rows)} finished rows in the 45-day window")
    for x in rows[-6:]: print("  ", x)
    if "--dry" in sys.argv:
        print("dry run — nothing written"); sys.exit(0)
    if rows:
        upsert(rows)
        print("upserted to sheet_log ✓")
