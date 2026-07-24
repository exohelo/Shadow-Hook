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

# known Boards-table rows (calibrated against real 7/21–7/22 sheets; a sheet lists
# only the boards it has, so this is a superset — missing rows are simply absent)
BOARDS = ["Crane Top Handler", "Key Hold", "Hold", "Crane", "Winch", "UTR", "CY",
          "Jitney", "Lumber", "Swamper", "Casual", "Dock", "Mechanics", "Gear", "Carpenter"]

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
    """8 value-tokens -> {col: int}. Garbled cells -> 0, then Total validates.
    Calibrated fix (7/22): a Total cell OCR'd into junk ('30}' for 301, 'TAT' for
    747, '5]' for 51) used to zero the board out of the count — the missing-Hold
    bug. Now an unreadable Total is REBUILT from the row's own columns
    (Total = Early+MO+EO+MRO+RO+LM by definition), flagged _reconstructed."""
    vals = [clean_num(t) for t in tokens[-8:]]
    while len(vals) < 8:
        vals.insert(0, 0)
    row = {c: (v if v is not None else 0) for c, v in zip(COLS, vals)}
    total = vals[-1]
    if total == 0:
        for c in SUMCOLS:                 # a board whose Total is 0 has every column 0
            row[c] = 0
    s = sum(row[c] for c in SUMCOLS)
    if total is None:                     # garbled Total -> the columns ARE the total
        row["total"] = s
        row["_reconstructed"] = True
        return row, True
    ok = (s == total)
    if not ok:
        # trust the (clean) Total for the headline number; note the mismatch
        row["_total_mismatch"] = {"cols_sum": s, "printed_total": total}
        row["total"] = total
    return row, ok

def find_row(text_lines, name):
    """Find a board's line; return (its 8 value tokens, line index) or (None, -1)."""
    for i, ln in enumerate(text_lines):
        raw = ln.lstrip()                 # tesseract indents table rows — match AND slice the same string,
        low = raw.lower()                 # else an indented board (e.g. "  Hold …") slices wrong and is dropped
        if low.startswith(name.lower()):
            rest = raw[len(name):]
            # the name must END here — 'Crane' must not swallow a 'Crane Top Handler' line
            if rest.lstrip()[:1].isalpha():
                continue
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


# ── ships: the "Allocation List" page(s) ───────────────────────────────────
#    Real layout (calibrated on 072226D p.10 / 072126N):
#      Alc.#  StartTime  OrderType  ShipName        Company  Berth   Tags
#      1      8:00AM     MRO        NORSE NAOSHIMA  SSA      LB 205  GE-
#         1HL                                  <- jobs line (or "Cancelled")
#    Entries continue onto following lines: a jobs string like "6S 2DS 12UTR"
#    (crew = the sum of those leading counts, matching the app), or "Cancelled",
#    or an "Early Dispatch" tag we skip.
ENTRY_RE = re.compile(r"^\s*(\d{1,2})\s+(\d{1,2}[:.]\d{2}\s*[AP]M)\s+([A-Z]{1,5})\b\s*(.*)$")
# a line that WANTS to be an entry (has the order-type anchor) but didn't parse —
# the dotted separators bleed into every other row and destroy order/time. Those
# entries are skipped whole, so their 'Cancelled'/jobs lines can't attach to the
# wrong ship (the bug that marked live vessels as scratched).
ENTRYISH_RE = re.compile(r"\bM\s?RO\b")
JOB_TOK = re.compile(r"^(\d{1,3})[A-Z][A-Z0-9/:.\-]*$")
BERTH_PFX = {"LB", "TI", "TY", "TL", "T1", "LB.", "TI."}

def _norm_job(tok):
    """Common OCR garbles in job tokens: '4§$'->'4SS', 'IAL'->'1AL', '3OSL'->'30SL'."""
    t = tok.replace("§", "S").replace("$", "S")
    t = re.sub(r"^[IlL](?=[A-Z0-9])", "1", t)
    t = re.sub(r"^(\d+)O(?=[A-Z])", r"\g<1>0", t)
    return t

def looks_like_alloc(text):
    if re.search(r"[Aa]ll?ocat", text):
        return True
    return bool(re.search(r"Ship\s*Name", text, re.I) and re.search(r"Berth", text, re.I))

def _canon_pfx(p):
    p = p.upper().strip(".,")
    return "TI" if p in {"TI", "TY", "TL", "T1"} else "LB"

def _split_entry(rest):
    """rest of an entry line -> (ship, company, berth). Berth anchors the split:
    'LB 205' / 'TI 400' style first (incl. glued 'LB24' and OCR'd 'TY'/'TL'),
    else the rightmost bare 2-4 digit token."""
    toks = rest.split()
    n = len(toks)
    for i in range(n - 1, 0, -1):                      # LB/TI + number, rightmost
        if re.fullmatch(r"\d{1,4}", toks[i]) and toks[i - 1].upper().strip(".,") in {p.strip(".") for p in BERTH_PFX}:
            return (" ".join(toks[: i - 2]).strip(),
                    toks[i - 2] if i >= 2 else "",
                    _canon_pfx(toks[i - 1]) + " " + toks[i])
    for i in range(n - 1, 0, -1):                      # glued berth token: 'LB24', 'TI400'
        m = re.fullmatch(r"(LB|TI|TY|TL|T1)\.?(\d{1,4})", toks[i], re.I)
        if m:
            return (" ".join(toks[: i - 1]).strip(),
                    toks[i - 1] if i >= 1 else "",
                    _canon_pfx(m.group(1)) + " " + m.group(2))
    for i in range(n - 1, 0, -1):                      # bare berth number (e.g. '100', '176')
        if re.fullmatch(r"\d{2,4}", toks[i]):
            return (" ".join(toks[: i - 1]).strip(), toks[i - 1], toks[i])
    return (rest.strip(), "", "")

def parse_ships(text):
    ships, cur, skipped = [], None, 0
    for raw in text.splitlines():
        line = raw.strip()
        if not line:
            continue
        mm = ENTRY_RE.match(line)
        if mm and mm.group(4):
            ship, company, berth = _split_entry(mm.group(4))
            ship = ship.strip(" .,-—~|")
            alnum = sum(1 for c in ship if c.isalnum() or c == " ")
            if (len(ship) < 4 or len(ship) > 40 or alnum < 0.6 * len(ship)
                    or re.search(r"[~«»™=§<]|\.\.", ship)):  # junk/glued name -> not a real entry
                cur = None
                skipped += 1
                continue
            cur = {"order": int(mm.group(1)), "time": mm.group(2).replace(" ", "").replace(".", ":").upper(),
                   "ship": ship, "company": company.strip(" .,"), "berth": berth,
                   "cancelled": False, "crew": 0, "jobs": ""}
            ships.append(cur)
            continue
        if ENTRYISH_RE.search(line):
            # an entry row the OCR destroyed — drop it AND its continuation lines
            cur = None
            skipped += 1
            continue
        if cur is None:
            continue
        if re.search(r"cancel", line, re.I):
            cur["cancelled"] = True
            cur["crew"] = 0
            cur["jobs"] = ""
            continue
        if re.search(r"early\s+dispatch", line, re.I):
            continue
        toks = [_norm_job(t) for t in line.split()]
        hits = [t for t in toks if JOB_TOK.match(t)]
        if hits and len(hits) >= max(1, len(toks) - 1) and not cur["cancelled"] and not cur["jobs"]:
            cur["jobs"] = " ".join(hits)
            cur["crew"] = sum(int(JOB_TOK.match(t).group(1)) for t in hits)
    return ships, skipped


# ── the forecast page ──────────────────────────────────────────────────────
def parse_page(text):
    lines = [l for l in text.splitlines() if l.strip()]
    # workdate + shift + the printed generation timestamp
    date_iso, shift, generated = None, None, None
    joined = " ".join(lines)
    dm = re.search(r"(\d{1,2})[/\s]?(\d{2})[/\s]?(\d{4})", joined.replace("WorkDate", "WorkDate "))
    if dm:
        mo, dy, yr = dm.group(1), dm.group(2), dm.group(3)
        date_iso = f"{yr}-{int(mo):02d}-{int(dy):02d}"
    # the sheet prints its own clean timestamp next to WorkDate ('7/21/2026 3:18:57PM')
    # — far more reliable than the fax stamp, which OCRs badly ('Jul 24' for Jul 21)
    gm = re.search(r"(\d{1,2})/(\d{1,2})/(\d{4})\s+(\d{1,2}):(\d{2})(?::\d{2})?\s*([AP]M)", joined, re.I)
    if gm:
        generated = f"{gm.group(3)}-{int(gm.group(1)):02d}-{int(gm.group(2)):02d} {int(gm.group(4))}:{gm.group(5)}{gm.group(6).upper()}"
    if re.search(r"\bnight\b", joined, re.I): shift = "Night"
    elif re.search(r"\bday\b", joined, re.I): shift = "Day"
    # (shift is OCR-fragile — 'Shift: Day' scans as junk; the bot fills it from the
    #  sheet letter when missing, which is always right)

    boards, warnings, last_row_i = {}, [], -1
    for name in BOARDS:
        nums, li = find_row(lines, name)
        if nums is None:
            continue
        row, ok = parse_row(nums)
        if row.pop("_reconstructed", None):
            warnings.append(f"{name}: total cell unreadable — rebuilt {row['total']} from the row's columns")
        boards[name] = {k: row[k] for k in COLS}
        last_row_i = max(last_row_i, li)
        if not ok and "_total_mismatch" in row:
            warnings.append(f"{name}: cols summed {row['_total_mismatch']['cols_sum']} but printed total {row['_total_mismatch']['printed_total']}")

    # grand total — reconcile the sheet's own totals row against the sum of the boards.
    # A correctly-read grand total corroborates the board sum; a totals row that reads
    # many times higher (a period/cumulative row, a serial, or glued cells) is a mis-grab,
    # not the headline. Anchor to the boards so it can't post a wild number — e.g. 7,181
    # on a ~1,300-job sheet.
    total = None
    if boards:
        summed = {c: sum(b[c] for b in boards.values()) for c in COLS}
        summed["total"] = sum(b["total"] for b in boards.values())
        printed = _printed_total(lines, last_row_i, summed["total"], warnings)
        if printed:
            total = printed
            if printed["total"] != summed["total"]:
                warnings.append(f"boards summed {summed['total']} but using the sheet's totals row {printed['total']}")
        else:
            total = summed

    flops = parse_flops(lines, warnings) if boards else None
    out = {"workdate": date_iso, "shift": shift, "boards": boards, "total": total, "warnings": warnings}
    if generated:
        out["generated"] = generated
    if flops is not None:
        out["flops"] = flops
    return out

def _printed_total(lines, last_row_i, board_sum=None, warnings=None):
    """The sheet's own totals row: either labelled TOTAL(S), or the cell row right
    after the last board row (on the real sheets it's unlabelled: '0 280 327 49 91
    0 0 747'). Cells can be OCR junk ('747' scans as 'TAT') — keep every cell-ish
    token and let parse_row repair/rebuild.

    board_sum (the summed board totals) anchors the choice, because a correctly-read
    grand total is approximately the sum of the boards. Among the candidates we pick the
    one CLOSEST to that sum, prefer a row whose checksum holds, and REJECT any that read
    implausibly high — a cumulative/period row, a serial, or glued cells otherwise lands
    a wild headline (the 7,181-on-a-1,300-job-sheet bug). If nothing plausible remains,
    return None and the caller uses the board sum, which every board row corroborates."""
    cands = []
    for i, ln in enumerate(lines):
        if re.match(r"\s*(grand\s+)?totals?\b", ln, re.I):
            toks = re.findall(r"[^\s]+", re.sub(r"^\s*(grand\s+)?totals?\b", "", ln, flags=re.I))
            cells = [t for t in toks if re.search(r"[A-Za-z0-9)|]", t)]
            if len(cells) >= 6:
                cands.append(cells)
    if last_row_i >= 0:
        for ln in lines[last_row_i + 1: last_row_i + 4]:
            toks = re.findall(r"[^\s]+", ln)
            cells = [t for t in toks if re.search(r"[A-Za-z0-9)|]", t)]
            digitish = [t for t in cells if re.search(r"\d", t)]
            if len(cells) >= 7 and len(digitish) >= len(cells) - 1:   # a cells-only line
                cands.append(cells)
                break

    scored = []                                   # (row, checksum_ok, total)
    for cells in cands:
        row, ok = parse_row(cells)
        if row.get("total", 0) > 0:
            scored.append((row, ok, row["total"]))
    if not scored:
        return None

    if board_sum and board_sum > 0:
        cap = board_sum * 1.5 + 100               # a real grand total is the boards plus, at most, a few unlisted rows
        plausible = [s for s in scored if s[2] <= cap]
        if not plausible:
            if warnings is not None:
                highs = sorted({s[2] for s in scored})
                warnings.append(f"ignored totals row(s) {highs} — implausibly high vs the {board_sum} jobs on "
                                f"the boards; using the board sum")
            return None
        plausible.sort(key=lambda s: (abs(s[2] - board_sum), 0 if s[1] else 1))   # closest to boards, clean checksum breaks ties
        row, ok, _t = plausible[0]
        if not ok and "_total_mismatch" in row and warnings is not None:
            mm = row["_total_mismatch"]
            warnings.append(f"totals row: columns summed {mm['cols_sum']} but printed total {mm['printed_total']} "
                            f"— trusting the printed total (a column mis-OCR'd)")
        return {c: row[c] for c in COLS}

    # no anchor available — prefer a checksum-clean row, then a clean printed total
    for row, ok, _t in scored:
        if ok:
            return {c: row[c] for c in COLS}
    for row, ok, _t in scored:
        if "_total_mismatch" in row:
            return {c: row[c] for c in COLS}
    return None


# ── whole document ─────────────────────────────────────────────────────────
def parse_pdf(pdf):
    n = npages(pdf)
    result, ships, header, ships_skipped = None, [], {}, 0
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
        elif looks_like_alloc(txt):
            # the Allocation List can run across several pages — collect them all
            sharp = render(pdf, p, dpi=300)
            got, skp = parse_ships(ocr(sharp) if sharp else txt)
            ships_skipped += skp
            if got:
                ships.extend(got)
    if result is None:
        return {"error": "no Job Forecast Report page found", "pages_scanned": n}
    # fax-stamp header is a fallback only; the forecast page's printed timestamp wins,
    # and a stamp date that disagrees wildly with the sheet's WorkDate is an OCR
    # misread ('Jul 24' for Jul 21) — drop it rather than store a wrong date.
    for k, v in header.items():
        result.setdefault(k, v)
    try:
        if result.get("generated") and result.get("workdate"):
            import datetime as _dt
            g = _dt.date.fromisoformat(result["generated"][:10])
            w = _dt.date.fromisoformat(result["workdate"])
            if not (-1 <= (w - g).days <= 4):
                result.pop("generated", None)
    except Exception:
        pass
    if ships:
        # de-dup (same Alc.# from an overlapping OCR pass) keeping first sighting
        seen, uniq = set(), []
        for s in ships:
            k = (s["order"], s["ship"])
            if k in seen:
                continue
            seen.add(k)
            uniq.append(s)
        result["ships"] = uniq
        if ships_skipped:
            result.setdefault("warnings", []).append(
                f"allocation list: {ships_skipped} entries unreadable (dotted-rule bleed) — kept the {len(uniq)} clean ones")
    else:
        result.setdefault("warnings", []).append("no Allocation List page recognized — ships omitted")
    return result


if __name__ == "__main__":
    pdf = sys.argv[1] if len(sys.argv) > 1 else "sample.pdf"
    print(json.dumps(parse_pdf(pdf), indent=2, ensure_ascii=False))
