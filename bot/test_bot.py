#!/usr/bin/env python3
"""Offline logic tests for dispatch_bot v2 — no network, no OCR, no Supabase.
Run:  python3 test_bot.py     (from the bot/ folder)"""
import datetime as dt
import dispatch_bot as b

fails = 0
def ck(name, got, want):
    global fails
    ok = got == want
    print(f"  {'OK ' if ok else 'XX '} {name} = {got!r}" + ("" if ok else f"  want {want!r}"))
    if not ok:
        fails += 1

print("=== filenames / keys (must match the app) ===")
ck("E name Jul 21", b.fname(dt.date(2026, 7, 21), "E"), "072126E.pdf")
ck("N name Jul 21", b.fname(dt.date(2026, 7, 21), "N"), "072126N.pdf")
ck("D name Jul 22 (the morning it's for)", b.fname(dt.date(2026, 7, 22), "D"), "072226D.pdf")
ck("PM key Mon Jul 20", b.key_for(dt.date(2026, 7, 20), "PM"), "2026-07-20_Mon_PM")
ck("AM key Tue Jul 21", b.key_for(dt.date(2026, 7, 21), "AM"), "2026-07-21_Tue_AM")
ck("Sun dow", b.dow(dt.date(2026, 7, 19)), "Sun")
ck("Wed dow", b.dow(dt.date(2026, 7, 22)), "Wed")

print("\n=== targets: the THREE-FOLDER map (the v1 bug) ===")
ts = {t["kind"]: t for t in b.targets(dt.date(2026, 7, 21))}
ck("5 targets", sorted(ts), ["CATCHUP", "CATCHUP-N", "EARLY", "MORNING", "NIGHT"])
ck("CATCHUP-N url (yesterday's night final)", ts["CATCHUP-N"]["url"].split("Dispatches/")[1], "Nightside-Final/072026N.pdf")
ck("CATCHUP-N key", (ts["CATCHUP-N"]["key"], ts["CATCHUP-N"]["nest"]), ("2026-07-20_Mon_PM", None))
ck("EARLY url", ts["EARLY"]["url"].split("Dispatches/")[1], "Day-Night-Early/072126E.pdf")
ck("NIGHT url (Nightside-Final!)", ts["NIGHT"]["url"].split("Dispatches/")[1], "Nightside-Final/072126N.pdf")
ck("MORNING url (Dayside-Final, tomorrow's file)", ts["MORNING"]["url"].split("Dispatches/")[1], "Dayside-Final/072226D.pdf")
ck("CATCHUP url (today's D)", ts["CATCHUP"]["url"].split("Dispatches/")[1], "Dayside-Final/072126D.pdf")
ck("EARLY key+nest", (ts["EARLY"]["key"], ts["EARLY"]["nest"]), ("2026-07-21_Tue_PM", "early"))
ck("NIGHT key top-level", (ts["NIGHT"]["key"], ts["NIGHT"]["nest"]), ("2026-07-21_Tue_PM", None))
ck("MORNING key", (ts["MORNING"]["key"], ts["MORNING"]["nest"]), ("2026-07-22_Wed_AM", None))
ck("CATCHUP key", (ts["CATCHUP"]["key"], ts["CATCHUP"]["nest"]), ("2026-07-21_Tue_AM", None))

print("\n=== merge: early + night live on the SAME _PM row ===")
early_payload = {"total": {"total": 700}, "boards": {"Hold": {"total": 200}}, "src": "072126E.pdf"}
row = b.merge({}, early_payload, "early")
ck("early nests", ("early" in row and row["early"]["total"]["total"]), 700)
night_payload = {"total": {"total": 920}, "boards": {"Hold": {"total": 245}}, "flops": 91, "src": "072126N.pdf"}
row2 = b.merge(row, night_payload, None)
ck("night lands top-level", row2["total"]["total"], 920)
ck("early sibling preserved", row2["early"]["total"]["total"], 700)
ck("flops rides along", row2.get("flops"), 91)

print("\n=== already_have (skip-if-present mirrors the app's isFound) ===")
ck("EARLY found when .early present", b.already_have({"early": {"total": {}}}, "early"), True)
ck("NIGHT not found when only .early", b.already_have({"early": {}}, None), False)
ck("NIGHT found when .total present", b.already_have({"total": {"total": 9}}, None), True)
ck("empty row", b.already_have({}, None), False)

print("\n=== payload shaping ===")
parsed = {"total": {"total": 920, "early": 394}, "boards": {"Hold": {"total": 245}},
          "shift": "Night", "flops": 91, "ships": [{"ship": "GALA"}],
          "generated": "2026-07-21 2:41PM", "serial": "9155", "pages": 21,
          "warnings": [], "workdate": "2026-07-21"}
p = b.payload_from(parsed, "072126N.pdf")
ck("total kept", p["total"]["total"], 920)
ck("flops kept", p["flops"], 91)
ck("ships kept", len(p["ships"]), 1)
ck("header kept", (p["generated"], p["serial"], p["pages"]), ("2026-07-21 2:41PM", "9155", 21))
ck("src recorded", p["src"], "072126N.pdf")
ck("workdate/warnings NOT shipped", ("workdate" in p or "warnings" in p), False)

print("\n=== forgiving backfill inputs ===")
ck("ISO date", b.parse_date_arg("2026-07-21"), dt.date(2026, 7, 21))
ck("slash date", b.parse_date_arg("7/21/2026"), dt.date(2026, 7, 21))
ck("short year", b.parse_date_arg("07/21/26"), dt.date(2026, 7, 21))
ck("padded + comma", b.parse_date_arg(" 2026-07-21, "), dt.date(2026, 7, 21))


print("\n=== #jul23 keep-searching windows ===")
import datetime as _dt
def _at(h,m): return _dt.datetime(2026,7,23,h,m)
ck("EARLY in season at 10:00 AM",  b.in_season("EARLY",   _at(10,0)),  True)
ck("EARLY out of season at 5 PM",  b.in_season("EARLY",   _at(17,0)),  False)
ck("NIGHT in season at 3:00 PM",   b.in_season("NIGHT",   _at(15,0)),  True)
ck("NIGHT out of season at 9 AM",  b.in_season("NIGHT",   _at(9,0)),   False)
ck("MORNING in season at 7 PM",    b.in_season("MORNING", _at(19,0)),  True)
ck("CATCHUP in season at 2 AM",    b.in_season("CATCHUP", _at(2,0)),   True)
ck("CATCHUP done after 9:30",      b.in_season("CATCHUP", _at(10,0)),  False)
ck("CATCHUP-N never holds a run",  b.in_season("CATCHUP-N",_at(12,0)), False)

print("\n=== parser internals (no OCR needed) ===")
import parse_forecast as pf
ck("header stamp", pf.parse_header("Jul. 19. 2026   4:17PM     No. 9120    P. 1/21"),
   {"generated": "2026-07-19 4:17PM", "serial": "9120", "pages": 21})
row, ok = pf.parse_row(["0", "44", "154", ")", "43", "4", "0", "245"])
ck("garbled cell repaired to 0", row["eo"], 0)
ck("row sums to printed total", (ok, row["total"]), (True, 245))
w = []
ck("flops = UTR − UTRWork", pf.parse_flops(["UTR 201", "UTRWork 110"], w), 91)
ck("flops absent -> None + warning", (pf.parse_flops(["nothing here"], w2 := []), len(w2)), (None, 1))
ck("board row NOT mistaken for UTR summary",
   pf.parse_flops(["UTR 0 126 91 18 51 0 0 286", "no summary"], w3 := []), None)

print("\n" + ("ALL BOT LOGIC TESTS PASSED ✔" if fails == 0 else f"{fails} FAILED ✘"))
raise SystemExit(1 if fails else 0)
