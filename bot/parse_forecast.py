#!/usr/bin/env python3
"""
Shadow Hook · dispatch-sheet parser  (v2 — July 2026)
Reads an ILWU Local 13 dispatch PDF (a scanned fax bundle), finds the
"Job Forecast Report" page, OCRs its Boards/Gangs table, and returns the
forecast in the exact shape the app stores in Supabase `dispatch_boards`.

New in v2 (matches what the app actually renders):
  · header stamp  → generated / serial / pages   ("Jul. 19. 2026 4:17PM No. 9120 P. 1/21")
  · flops         → UTR orders still open (UTR − UTRWork summary lines; best-effort)
  · ships         → the vessel-lineup page(s), best-effort until calibrated on a
                    real OCR dump (every miss is reported in `warnings`)
  · printed TOTAL → prefers the sheet's own totals row over summing the boards,
                    so one garbled board row can't silently shrink the headline

Self-correcting: OCR turns some zeros into stray symbols; the Total column
(Total = Early+MO+EO+MRO+RO+LM) lets us validate and repair each row.
Needs poppler-utils (pdfinfo/pdftoppm) + tesseract-ocr on the box. Stdlib only.
"""
import subprocess, re, json, sys, os, tempfile

COLS = ["shorted", "early", "mo", "eo", "mro", "ro", "lm", "total"]
SUMCOLS = ["early", "mo", "eo", "mro", "ro", "lm"]  # these sum to total

# known Boards-table rows (longest first so multi-word names match before short ones)
BOARDS = ["Crane Top Handler", "Hold", "Crane", "Winch", "UTR", "CY", "Jitney",
          "Swamper", "Casual", "Dock", "Mechanics", "Gear", "Carpenter"]

MONTHS = {m: i + 1 for i, m in enumerate(
    ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"])}


def sh(args):
    return subprocess.run(args, capture_output=True, text=True).stdout

def npages(pdf):
    out = sh(["pdfinfo", pdf])
    m = re.search(r"Pages:\s+(\d+)", out)
    return int(m.group(1)) if m else 1

def render(pdf, page, dpi=300):
    d = tempfile.mkdtemp()
    base = os.path.join(d, "pg")
    sh(["pdftoppm", "-f", str(page), "-l", str(page), "-r", str(dpi), "-png", pdf, base])
    for f in os.listdir(d):
        if f.endswith(".png"):
            return os.path.join(d, f)
    return None

def ocr(png):
    return sh(["tesseract", png, "stdout", "--psm", "6"])


# ── numbers ────────────────────────────────────────────────────────────────
def clean_num(tok):
    """A single OCR token -> int, or None if it's unrecoverable garble."""
    t = tok.strip().strip(".,:;")
    if re.fullmatch(r"\d+", t):
        return int(t)
    t2 = (t.replace("l", "1").replace("I", "1").replace("|", "1")
           .replace("O", "0").replace("o", "0").replace("Q", "0")
           .replace("S", "5").replace("B", "8"))
    if re.fullmatch(r"\d+", t2):
        return int(t2)
    return None  # e.g. ")", "A)", "tt)", "m0)" — almost always a zero

def parse_row(tokens):
    """8 value-tokens -> {col: int}. Garbled cells -> 0, then Total validates."""
    vals = [clean_num(t) for t in tokens[-8:]]
    while len(vals) < 8:
        vals.insert(0, 0)
    row = {c: (v if v is not None else 0) for c, v in zip(COLS, vals)}
    total = vals[-1]
    if total == 0:
        for c in SUMCOLS:                 # a board whose Total is 0 has every column 0
            row[c] = 0
    s = sum(row[c] for c in SUMCOLS)
    ok = (total is not None and s == total)
    if total is not None and not ok:
        # trust the (clean) Total for the headline number; note the mismatch
        row["_total_mismatch"] = {"cols_sum": s, "printed_total": total}
        row["total"] = total
    return row, ok

def find_row(text_lines, name):
    """Find a board's line; return (its 8 value tokens, line index) or (None, -1)."""
    for i, ln in enumerate(text_lines):
        low = ln.lower()
        if low.strip().startswith(name.lower()):
            rest = ln[len(name):]
            toks = re.findall(r"[^\s]+", rest)
            nums = [t for t in toks if re.search(r"[\d)lIQOoSB]", t)]
            if len(nums) >= 6:
                return nums, i
    return None, -1


# ── header stamp ("Jul. 19. 2026  4:17PM  No. 9120  P. 1/21") ─────────────
def parse_header(text):
    """The fax stamp: GENERATION time (a D sheet's stamp is the evening BEFORE the
    board it's for — never date a board by it), a running serial, a page count."""
    out = {}
    md = re.search(r"([A-Z][a-z]{2})\.?\s*(\d{1,2})\.?,?\s*(\d{4})", text)
    tm = re.search(r"(\d{1,2}:\d{2}\s*[AP]M)", text, re.I)
    if md:
        mo = MONTHS.get(md.group(1), 0)
        if mo:
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


# ── flops: UTR orders not yet covered when the sheet printed ───────────────
def parse_flops(lines, warnings):
    """The app shows flops = UTR − UTRWork (summary lines, NOT the 8-column UTR
    board row — that row has 6+ numbers, these have one). Best-effort; a miss is
    reported so the heuristic can be calibrated off a real OCR dump."""
    utr = utrwork = None
    for ln in lines:
        low = ln.strip().lower()
        m = re.match(r"^utr\s*work\b[^0-9]*(\d+)\s*$", low)
        if m and utrwork is None:
            utrwork = int(m.group(1)); continue
        m = re.match(r"^utr\b[^0-9]*(\d+)\s*$", low)      # one lone number → summary, not the board row
        if m and utr is None:
            utr = int(m.group(1)); continue
        m = re.search(r"\bflops?\b[^0-9]{0,12}(\d+)", low)
        if m:
            return int(m.group(1))
    if utr is not None and utrwork is not None and utr >= utrwork:
        return utr - utrwork
    warnings.append("flops (UTR still open) not found on the forecast page — send an _ocr dump to calibrate")
    return None


# ── ships: the vessel-lineup page(s) ───────────────────────────────────────
SHIP_LINE = re.compile(
    r"^\s*(\d{1,2})\s+(\d{1,2}:\d{2}\s*[AP]M)\s+(.+?)\s{2,}([A-Z0-9&/.\-]{2,})\s+(\S+)\s{2,}(\d+)\s+(\S+)\s*$",
    re.I)
SHIP_LOOSE = re.compile(r"^\s*(\d{1,2})\s+(\d{1,2}:\d{2}\s*[AP]M)\s+(.+)$", re.I)

def looks_like_ships(text):
    times = re.findall(r"\d{1,2}:\d{2}\s*[AP]M", text, re.I)
    return len(times) >= 3 and bool(re.search(r"vessel|berth|ship|lineup", text, re.I))

def parse_ships(text):
    ships = []
    for line in text.splitlines():
        mm = SHIP_LINE.match(line)
        if mm:
            ships.append({"order": int(mm.group(1)), "time": mm.group(2).replace(" ", "").upper(),
                          "ship": mm.group(3).strip(), "company": mm.group(4).strip(),
                          "berth": mm.group(5).strip(), "cancelled": False,
                          "crew": int(mm.group(6)), "jobs": mm.group(7).strip()})
            continue
        mm = SHIP_LOOSE.match(line)
        if mm:
            rest = re.split(r"\s{2,}", mm.group(3).strip())
            ship = rest[0].strip() if rest else ""
            if len(ship) < 3 or ship.isdigit():
                continue
            rec = {"order": int(mm.group(1)), "time": mm.group(2).replace(" ", "").upper(),
                   "ship": ship, "company": rest[1].strip() if len(rest) > 1 else "",
                   "berth": rest[2].strip() if len(rest) > 2 else "", "cancelled": False,
                   "crew": 0, "jobs": ""}
            tail_nums = re.findall(r"\d+", " ".join(rest[3:])) if len(rest) > 3 else []
            if tail_nums:
                rec["crew"] = int(tail_nums[0])
            ships.append(rec)
    return ships


# ── the forecast page ──────────────────────────────────────────────────────
def parse_page(text):
    lines = [l for l in text.splitlines() if l.strip()]
    # workdate + shift
    date_iso, shift = None, None
    joined = " ".join(lines)
    dm = re.search(r"(\d{1,2})[/\s]?(\d{2})[/\s]?(\d{4})", joined.replace("WorkDate", "WorkDate "))
    if dm:
        mo, dy, yr = dm.group(1), dm.group(2), dm.group(3)
        date_iso = f"{yr}-{int(mo):02d}-{int(dy):02d}"
    if re.search(r"\bnight\b", joined, re.I): shift = "Night"
    elif re.search(r"\bday\b", joined, re.I): shift = "Day"

    boards, warnings, last_row_i = {}, [], -1
    for name in BOARDS:
        nums, li = find_row(lines, name)
        if nums is None:
            continue
        row, ok = parse_row(nums)
        boards[name] = {k: row[k] for k in COLS}
        last_row_i = max(last_row_i, li)
        if not ok and "_total_mismatch" in row:
            warnings.append(f"{name}: cols summed {row['_total_mismatch']['cols_sum']} but printed total {row['_total_mismatch']['printed_total']}")

    # grand total — prefer the sheet's own totals row over summing the boards
    total = None
    if boards:
        summed = {c: sum(b[c] for b in boards.values()) for c in COLS}
        summed["total"] = sum(b["total"] for b in boards.values())
        printed = _printed_total(lines, last_row_i)
        if printed:
            total = printed
            if printed["total"] != summed["total"]:
                warnings.append(f"boards summed {summed['total']} but the sheet's totals row prints {printed['total']} — using the printed row")
        else:
            total = summed

    flops = parse_flops(lines, warnings) if boards else None
    out = {"workdate": date_iso, "shift": shift, "boards": boards, "total": total, "warnings": warnings}
    if flops is not None:
        out["flops"] = flops
    return out

def _printed_total(lines, last_row_i):
    """The sheet's own totals row: either labelled TOTAL(S), or a numbers-only line
    just after the last board row. Trusted only if its own checksum holds."""
    cands = []
    for i, ln in enumerate(lines):
        if re.match(r"\s*(grand\s+)?totals?\b", ln, re.I):
            toks = re.findall(r"[^\s]+", re.sub(r"^\s*(grand\s+)?totals?\b", "", ln, flags=re.I))
            nums = [t for t in toks if re.search(r"[\d)lIQOoSB]", t)]
            if len(nums) >= 6:
                cands.append(nums)
    if not cands and last_row_i >= 0:
        for ln in lines[last_row_i + 1: last_row_i + 4]:
            toks = re.findall(r"[^\s]+", ln)
            nums = [t for t in toks if re.search(r"[\d)lIQOoSB]", t)]
            if len(nums) >= 7 and len(nums) >= len(toks) - 1:   # numbers-only line
                cands.append(nums)
                break
    for nums in cands:
        row, ok = parse_row(nums)
        if ok and row["total"] > 0:
            return {c: row[c] for c in COLS}
    return None


# ── whole document ─────────────────────────────────────────────────────────
def parse_pdf(pdf):
    n = npages(pdf)
    result, ships, header = None, [], {}
    for p in range(1, n + 1):
        png = render(pdf, p, dpi=150)          # fast low-res scan just to locate pages
        if not png:
            continue
        txt = ocr(png)
        if p == 1:
            header = parse_header(txt) or {}
        if result is None and ("Job Forecast" in txt or ("Boards" in txt and "Shorted" in txt and "Total" in txt)):
            sharp = render(pdf, p, dpi=300)     # re-render the matched page sharp for parsing
            result = parse_page(ocr(sharp) if sharp else txt)
            result["source_page"] = p
        elif not ships and looks_like_ships(txt):
            sharp = render(pdf, p, dpi=300)
            ships = parse_ships(ocr(sharp) if sharp else txt)
            if ships:
                result_ships_page = p
        if result is not None and ships:
            break                               # got everything — stop burning OCR time
    if result is None:
        return {"error": "no Job Forecast Report page found", "pages_scanned": n}
    for k, v in header.items():
        result.setdefault(k, v)
    if ships:
        result["ships"] = ships
    else:
        result.setdefault("warnings", []).append("no vessel-lineup page recognized — ships omitted (calibrate off an _ocr dump)")
    return result


if __name__ == "__main__":
    pdf = sys.argv[1] if len(sys.argv) > 1 else "sample.pdf"
    print(json.dumps(parse_pdf(pdf), indent=2, ensure_ascii=False))
