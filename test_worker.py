import datetime as dt
import fetch_dispatch as w

LA = w.LA
fails = 0
def ck(name, got, want):
    global fails
    ok = got == want
    print(f"  {'OK ' if ok else 'XX '} {name} = {got!r}" + ("" if ok else f"  want {want!r}"))
    if not ok: fails += 1

print("=== filename / key building ===")
ck("E name Jul20", w.fname(dt.date(2026,7,20), "E"), "072026E.pdf")
ck("N name Jul20", w.fname(dt.date(2026,7,20), "N"), "072026N.pdf")
ck("D name Jul21 (morning it's for)", w.fname(dt.date(2026,7,21), "D"), "072126D.pdf")
ck("PM key Jul20", w.key_for(dt.date(2026,7,20), "PM"), "2026-07-20_Mon_PM")
ck("AM key Jul21", w.key_for(dt.date(2026,7,21), "AM"), "2026-07-21_Tue_AM")

print("\n=== what's in season (targets) ===")
def urls(now): return {t["kind"]: (t["url"].split("Dispatches/")[1], t["key"]) for t in w.targets(now)}

t1330 = urls(dt.datetime(2026,7,20,13,47, tzinfo=LA))
ck("13:47 → EARLY only", sorted(t1330), ["EARLY"])
ck("13:47 EARLY url+key", t1330["EARLY"], ("Day-Night-Early/072026E.pdf", "2026-07-20_Mon_PM"))

t1715 = urls(dt.datetime(2026,7,20,17,15, tzinfo=LA))
ck("17:15 → NIGHT + MORNING", sorted(t1715), ["MORNING","NIGHT"])
ck("17:15 NIGHT url+key", t1715["NIGHT"], ("Nightside-Final/072026N.pdf", "2026-07-20_Mon_PM"))
ck("17:15 MORNING url+key (tomorrow D)", t1715["MORNING"], ("Dayside-Final/072126D.pdf", "2026-07-21_Tue_AM"))

t0700 = urls(dt.datetime(2026,7,20,7,0, tzinfo=LA))
ck("07:00 → overnight D catch", sorted(t0700), ["MORNING"])
ck("07:00 MORNING url+key (last night's D, this morning)", t0700["MORNING"],
   ("Dayside-Final/072026D.pdf", "2026-07-20_Mon_AM"))

print("\n=== header parse (the PDF top line) ===")
h = w.parse_header("Jul. 19. 2026   4:17PM     No. 9120    P. 1/21")
ck("generated", h.get("generated"), "2026-07-19 4:17PM")
ck("serial", h.get("serial"), "9120")
ck("pages", h.get("pages"), 21)

print("\n=== isFound mirror ===")
ck("EARLY found when .early present", w.already_have({"early":{"total":{}}}, "EARLY"), True)
ck("NIGHT not found when only .early", w.already_have({"early":{}}, "NIGHT"), False)
ck("NIGHT found when .total present", w.already_have({"total":{"total":9}}, "NIGHT"), True)

print("\n" + ("ALL WORKER LOGIC TESTS PASSED ✔" if fails==0 else f"{fails} FAILED ✘"))
raise SystemExit(1 if fails else 0)
