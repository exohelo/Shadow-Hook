#!/usr/bin/env python3
"""
ILWU 13 dispatch worker  —  the "hands" for The Shadow Hook's Dispatch Bot.

The app (index.html) only holds the SCHEDULE, the status, and the ingest point.
A browser can't read a cross-origin scanned PDF, so the actual grab runs here,
off-page, and publishes the parsed forecast into Supabase table `dispatch_boards`
(key text, data jsonb). The app's sbLoadDispatch() reads that table on load.

What this does, every run:
  1. Work out the current Long Beach (America/Los_Angeles) time.
  2. Decide which sheets are "in season" right now (same windows as the app's bot):
        EARLY   MMDDYYE  in  Dispatches/Day-Night-Early/   (opens 09:30, today)
        NIGHT   MMDDYYN  in  Dispatches/Nightside-Final/   (opens 14:30, today)
        MORNING MMDDYYD  in  Dispatches/Dayside-Final/     (opens 16:45, for TOMORROW;
                                                             MMDDYY = the morning it's FOR)
  3. Skip any sheet already fully in `dispatch_boards` (idempotent).
  4. Download the PDF, OCR every page, parse header + boards + totals + ships.
  5. Merge into the existing row (early + night live on the SAME _PM key) and upsert.

Filename dates (verified against the live listings):
  E, N  are named for that SAME calendar day.
  D     is named for the MORNING it's for and posted the evening before
        (e.g. 072026D = Mon 07/20 board, generated Sun 07/19 ~4 PM — the header
         stamp is the GENERATION time, NOT the board date; date by FILENAME).

Run modes:
  (default)         fetch what's in season, parse, upsert to Supabase.
  --dump            fetch + OCR + parse but DON'T touch Supabase; write the raw OCR
                    text and the parsed JSON to ./out/ so the parser can be calibrated.
  --date 2026-07-20 --kind D   force one specific sheet (handy for backfill / testing).
  --all             ignore the time windows; try E, N (today) and D (tomorrow) now.

Env / GitHub secrets:
  SUPABASE_URL          e.g. https://ehykqebzkbelwtkgjbml.supabase.co
  SUPABASE_SERVICE_KEY  the service-role key (bypasses RLS; server-side ONLY, never ship to the app)
"""

import os, sys, io, re, json, argparse, datetime as dt
from zoneinfo import ZoneInfo

import requests

LA = ZoneInfo("America/Los_Angeles")
DOWM = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

ROOT = "https://ilwu13.com/wp-content/uploads/simple-file-list/Dispatches/"
FOLDERS = {"E": ROOT + "Day-Night-Early/",   # Early count
           "N": ROOT + "Nightside-Final/",   # Night final count
           "D": ROOT + "Dayside-Final/"}     # Day final (posted the evening before)

# Board names the app recognises (from the app's data schema). Used to anchor OCR rows.
BOARDS = ["Key Hold", "Hold", "Crane", "Winch", "UTR", "CY", "Jitney",
          "Swamper", "Casual", "Dock", "Gear", "Mechanics"]
# Order-category columns, in sheet order (match the app's ORDER_COLS / total.* keys).
ORDER_COLS = ["early", "mo", "eo", "mro", "ro", "lm"]

TIMEOUT = 25


# ── date / target helpers ──────────────────────────────────────────────────
def dowm(d):                       # calendar date -> "Mon" etc. (matches the app)
    return DOWM[(d.weekday() + 1) % 7]

def fname(d, letter):              # date -> "072026E.pdf"
    return f"{d.month:02d}{d.day:02d}{d.year % 100:02d}{letter}.pdf"

def key_for(d, ap):                # date + "AM"/"PM" -> "2026-07-20_Mon_PM"
    return f"{d.isoformat()}_{dowm(d)}_{ap}"

def minutes(t):                    # a time -> minutes since midnight
    return t.hour * 60 + t.minute


def targets(now, force_all=False):
    """Return the sheets worth chasing at Long Beach time `now`."""
    today = now.date()
    tomo = today + dt.timedelta(days=1)
    m = minutes(now.timetz())
    out = []
    # EARLY  — today's early count, window 09:30–16:30
    if force_all or (9 * 60 + 30) <= m < (16 * 60 + 30):
        out.append(dict(kind="EARLY", letter="E", date=today,
                        url=FOLDERS["E"] + fname(today, "E"), key=key_for(today, "PM")))
    # NIGHT  — today's final count, window 14:30–23:59
    if force_all or (14 * 60 + 30) <= m <= (23 * 60 + 59):
        out.append(dict(kind="NIGHT", letter="N", date=today,
                        url=FOLDERS["N"] + fname(today, "N"), key=key_for(today, "PM")))
    # MORNING (D) — TOMORROW's day board, posted this evening; window 16:45 → late.
    if force_all or m >= (16 * 60 + 45):
        out.append(dict(kind="MORNING", letter="D", date=tomo,
                        url=FOLDERS["D"] + fname(tomo, "D"), key=key_for(tomo, "AM")))
    # Overnight catch: before 09:30 the D posted LAST night (for THIS morning) may still be missing.
    if force_all or m < (9 * 60 + 30):
        out.append(dict(kind="MORNING", letter="D", date=today,
                        url=FOLDERS["D"] + fname(today, "D"), key=key_for(today, "AM")))
    return out


def already_have(existing, kind):
    """Mirror the app's isFound(): EARLY needs `early`; others need `total`/`boards`."""
    if not existing:
        return False
    if kind == "EARLY":
        return bool(existing.get("early"))
    return bool(existing.get("total") or existing.get("boards"))


# ── fetch + OCR ────────────────────────────────────────────────────────────
def fetch_pdf(url):
    try:
        r = requests.get(url, timeout=TIMEOUT, headers={"User-Agent": "shadowhook-dispatch-bot/1.0"})
    except requests.RequestException as e:
        print(f"    fetch error: {e}")
        return None
    if r.status_code == 404:
        print("    not posted yet (404)")
        return None
    if r.status_code != 200 or not r.content:
        print(f"    unexpected status {r.status_code}")
        return None
    if b"%PDF" not in r.content[:1024]:
        print("    response is not a PDF")
        return None
    return r.content


def ocr_pages(pdf_bytes):
    """Scanned sheet -> list of per-page OCR text. Needs poppler + tesseract."""
    from pdf2image import convert_from_bytes
    import pytesseract
    images = convert_from_bytes(pdf_bytes, dpi=300)   # 300dpi reads the small print
    return [pytesseract.image_to_string(img) for img in images]


# ── parsing ────────────────────────────────────────────────────────────────
MONTHS = {m: i + 1 for i, m in enumerate(
    ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"])}

def parse_header(text):
    """
    The top line reads e.g. 'Jul. 19. 2026  4:17PM  No. 9120  P. 1/21'.
    That stamp is the GENERATION time (for a D sheet, the evening before the board),
    a running sheet serial, and the page count. Solid, and doable without calibration.
    """
    out = {}
    md = re.search(r"([A-Z][a-z]{2})\.?\s*(\d{1,2})\.?\s*(\d{4})", text)
    tm = re.search(r"(\d{1,2}:\d{2}\s*[AP]M)", text, re.I)
    if md:
        mo = MONTHS.get(md.group(1), 0)
        gen = f"{md.group(3)}-{mo:02d}-{int(md.group(2)):02d}"
        if tm:
            gen += " " + tm.group(1).upper().replace(" ", "")
        out["generated"] = gen
    sn = re.search(r"No\.?\s*(\d{3,6})", text)
    if sn:
        out["serial"] = sn.group(1)
    pg = re.search(r"P\.?\s*\d+\s*/\s*(\d+)", text)
    if pg:
        out["pages"] = int(pg.group(1))
    return out


def ints_on_line(line):
    return [int(x) for x in re.findall(r"\d+", line)]


def parse_forecast(pages):
    """
    Turn the OCR pages into {total, boards, flops, ships}.

    ⚠️  CALIBRATION NEEDED: the board/ship column layout comes from a REAL data page,
    and page 1 of the sample was a community flyer — so the heuristics below are a
    first pass. Run `--dump` on a live sheet and send me ./out/*_ocr.txt and I'll
    lock the column mapping exactly. Header parsing above is already solid.
    """
    text = "\n".join(pages)
    forecast = {}

    # boards: find each known board name, read the integers on its line.
    boards = {}
    for line in text.splitlines():
        for name in BOARDS:                      # "Key Hold" before "Hold" (longest first)
            if re.match(rf"\s*{re.escape(name)}\b", line, re.I):
                nums = ints_on_line(line)
                if nums:
                    # last integer = board total; the rest map onto ORDER_COLS in order
                    row = {"total": nums[-1]}
                    for col, v in zip(ORDER_COLS, nums[:-1]):
                        if v:
                            row[col] = v
                    boards[name] = row
                break
    if boards:
        forecast["boards"] = boards

    # grand total row (labelled TOTAL / TOTALS)
    for line in text.splitlines():
        if re.match(r"\s*TOTAL", line, re.I):
            nums = ints_on_line(line)
            if nums:
                tot = {"total": nums[-1]}
                for col, v in zip(ORDER_COLS, nums[:-1]):
                    tot[col] = v
                forecast["total"] = tot
            break
    if "total" not in forecast and boards:       # fall back: sum the boards
        forecast["total"] = {"total": sum(b["total"] for b in boards.values())}

    # UTR still open ("flops")
    fl = re.search(r"(?:UTR|FLOP)[^0-9]{0,20}(\d+)", text, re.I)
    if fl:
        forecast["flops"] = int(fl.group(1))

    # ships / vessel lineup — heuristic; calibrate against a real page.
    ships = []
    ship_re = re.compile(
        r"^\s*(\d{1,2})\s+(\d{1,2}:\d{2}\s*[AP]M)\s+(.+?)\s{2,}([A-Z0-9]+)\s+(.+?)\s{2,}(\d+)\s+(\S+)\s*$",
        re.I)
    for line in text.splitlines():
        mm = ship_re.match(line)
        if mm:
            ships.append(dict(order=int(mm.group(1)), time=mm.group(2).replace(" ", ""),
                              ship=mm.group(3).strip(), company=mm.group(4).strip(),
                              berth=mm.group(5).strip(), cancelled=False,
                              crew=int(mm.group(6)), jobs=mm.group(7).strip()))
    if ships:
        forecast["ships"] = ships

    return forecast


def parse_sheet(pages, kind, src):
    """Wrap the forecast the way the app expects for each sheet type."""
    header = parse_header(pages[0] if pages else "")
    forecast = parse_forecast(pages)
    if kind == "EARLY":
        # the early count nests under `early` on the PM key
        early = dict(forecast)
        early["src"] = src
        return {"early": early, **header, "src": src}
    return {**forecast, **header, "src": src}


# ── Supabase (PostgREST) ───────────────────────────────────────────────────
def sb_headers(service_key):
    return {"apikey": service_key, "Authorization": f"Bearer {service_key}",
            "Content-Type": "application/json"}

def sb_get(url, service_key, key):
    try:
        r = requests.get(f"{url}/rest/v1/dispatch_boards",
                         params={"key": f"eq.{key}", "select": "data"},
                         headers=sb_headers(service_key), timeout=TIMEOUT)
        if r.ok and r.json():
            return r.json()[0].get("data") or {}
    except (requests.RequestException, ValueError) as e:
        print(f"    supabase read error: {e}")
    return {}

def sb_upsert(url, service_key, key, data):
    h = sb_headers(service_key)
    h["Prefer"] = "resolution=merge-duplicates,return=minimal"
    r = requests.post(f"{url}/rest/v1/dispatch_boards",
                      params={"on_conflict": "key"},
                      headers=h, data=json.dumps([{"key": key, "data": data}]), timeout=TIMEOUT)
    r.raise_for_status()
    return True


def merge(existing, new):
    """Same shallow merge as the app's addDispatchData (Object.assign)."""
    out = dict(existing or {})
    out.update(new)
    return out


# ── main ───────────────────────────────────────────────────────────────────
def process(t, args, url, key):
    print(f"  {t['kind']:<8} {t['url'].split('/')[-1]}  ->  {t['key']}")
    existing = {} if (args.dump or not url) else sb_get(url, key, t["key"])
    if not args.force and already_have(existing, t["kind"]):
        print("    already in dispatch_boards — skip")
        return
    pdf = fetch_pdf(t["url"])
    if not pdf:
        return
    try:
        pages = ocr_pages(pdf)
    except Exception as e:
        print(f"    OCR failed ({e}). Is poppler + tesseract installed?")
        return
    data = parse_sheet(pages, t["kind"], t["url"].split("/")[-1])

    if args.dump:
        os.makedirs("out", exist_ok=True)
        stem = t["url"].split("/")[-1].replace(".pdf", "")
        with open(f"out/{stem}_ocr.txt", "w") as f:
            f.write("\n\n----- PAGE BREAK -----\n\n".join(pages))
        with open(f"out/{stem}_parsed.json", "w") as f:
            json.dump({"key": t["key"], "data": data}, f, indent=2)
        print(f"    dumped out/{stem}_ocr.txt + out/{stem}_parsed.json")
        return

    merged = merge(existing, data)
    sb_upsert(url, key, t["key"], merged)
    print(f"    upserted ({', '.join(k for k in data if k not in ('src','generated'))})")


def main():
    ap = argparse.ArgumentParser(description="ILWU 13 dispatch fetch/OCR/publish worker")
    ap.add_argument("--dump", action="store_true", help="OCR + parse to ./out/, don't write Supabase")
    ap.add_argument("--all", action="store_true", help="ignore time windows; try all sheets now")
    ap.add_argument("--force", action="store_true", help="re-ingest even if already present")
    ap.add_argument("--date", help="force a single sheet date YYYY-MM-DD (with --kind)")
    ap.add_argument("--kind", choices=["E", "N", "D"], help="force a single sheet letter")
    args = ap.parse_args()

    url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    key = os.environ.get("SUPABASE_SERVICE_KEY", "")
    if not args.dump and (not url or not key):
        sys.exit("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set (or use --dump).")

    now = dt.datetime.now(LA)
    print(f"Long Beach time: {now:%Y-%m-%d %H:%M %Z}")

    if args.date and args.kind:
        d = dt.date.fromisoformat(args.date)
        ap_slot = "AM" if args.kind == "D" else "PM"
        ts = [dict(kind={"E": "EARLY", "N": "NIGHT", "D": "MORNING"}[args.kind], letter=args.kind,
                   date=d, url=FOLDERS[args.kind] + fname(d, args.kind), key=key_for(d, ap_slot))]
    else:
        ts = targets(now, force_all=args.all)

    if not ts:
        print("nothing in season right now.")
        return
    for t in ts:
        process(t, args, url, key)


if __name__ == "__main__":
    main()
