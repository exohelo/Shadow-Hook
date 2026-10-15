(function() {
    "use strict";
    var LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split(""),
        esc = function(s) {
            return (s == null ? "" : "" + s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;")
        },
        $ = function(id) {
            return document.getElementById(id)
        },
        say = function(m) {
            try {
                toast(m)
            } catch {}
        },
        hum = function(p) {
            try {
                buzz(p || [20])
            } catch {}
        },
        sheetEl = function(id, cls, z) {
            var s = $(id);
            return s || (s = document.createElement("div"), s.className = "sheet " + (cls || ""), s.id = id, z && (s.style.zIndex = String(z)), document.body.appendChild(s), s.addEventListener("click", function(e) {
                e.target === s && s.classList.remove("on")
            })), s
        },
        ago = function(t) {
            var d = Math.max(0, Date.now() - t),
                m = Math.round(d / 6e4);
            if (m < 1) return "just now";
            if (m < 60) return m + "m ago";
            var h = Math.round(m / 60);
            return h < 24 ? h + "h ago" : Math.round(h / 24) + "d ago"
        },
        SC = window.SC = {
            head: {
                handle: "EXO",
                card: "D4928"
            },
            seats: {},
            claims: [],
            table: [],
            motions: [],
            jobs: [],
            line: [],
            inbox: [],
            bans: [],
            teller: null,
            tellerUid: null,
            announce: null,
            succession: null,
            traffic: {
                today: "\u2014",
                week: "\u2014",
                month: "\u2014",
                peak: "",
                dispatch: ""
            },
            lateAfter: 24 * 36e5,
            loaded: !1
        };
    LETTERS.forEach(function(L) {
        SC.seats[L] = null
    });
    var ts = function(x) {
        var t = Date.parse(x || "");
        return isNaN(t) ? Date.now() : t
    };

    function isCrown() {
        try {
            return !!window.__isKM && String((loadAcct() || {}).id || "").toUpperCase().trim() === SC.head.card
        } catch {
            return !1
        }
    }

    function seatOf_uid(u) {
        var r = null;
        return u ? (LETTERS.forEach(function(L) {
            SC.seats[L] && SC.seats[L].holder === u && (r = L)
        }), r) : null
    }

    function council() {
        return !!window.__shkUid && (isCrown() || !!seatOf_uid(window.__shkUid))
    }
    async function loadSeats() {
        var r = await SB.from("sc_seats").select("letter,seated_at");
        if (r.error) throw r.error;
        LETTERS.forEach(function(L) {
            SC.seats[L] = null
        }), (r.data || []).forEach(function(x) {
            x.seated_at && (SC.seats[x.letter] = {
                handle: "",
                since: ts(x.seated_at),
                holder: null
            })
        });
        var f = await SB.rpc("sc_seats_full");
        !f.error && f.data && f.data.length && f.data.forEach(function(x) {
            x.holder && (SC.seats[x.letter] = {
                handle: x.handle || "",
                since: ts(x.seated_at),
                holder: x.holder
            })
        })
    }
    async function loadClaims() {
        var r = await SB.from("sc_claims").select("id,uid,handle,letter,asked_at,window_ends,note").eq("status", "asked").order("asked_at");
        SC.claims = (r.data || []).map(function(c) {
            return {
                id: c.id,
                uid: c.uid,
                letter: c.letter,
                handle: c.handle,
                at: ts(c.asked_at),
                ends: c.window_ends ? ts(c.window_ends) : null,
                note: c.note || ""
            }
        });
        var a = await SB.rpc("sc_applicants");
        SC.applicants = (a.data || []).map(function(x) {
            return {
                id: x.id,
                uid: x.uid,
                handle: x.handle || "",
                letter: x.letter,
                note: x.note || "",
                at: ts(x.asked_at),
                ends: x.window_ends ? ts(x.window_ends) : null,
                hrs: x.hrs,
                since: x.member_since,
                days: x.days_active_30 || 0,
                calls: x.calls_30 || 0,
                seen: x.last_seen ? ts(x.last_seen) : null,
                votes: x.votes || 0,
                mine: !!x.my_vote
            }
        })
    }
    async function loadRoom() {
        if (!council()) {
            SC.table = [], SC.motions = [], SC.jobs = [], SC.line = [], SC.inbox = [], SC.bans = [], SC.succession = null, SC.announce = null;
            return
        }
        var rs = await Promise.all([SB.from("sc_table").select("id,uid,handle,letter,kind,body,media,created_at,edited_at").order("created_at", {
            ascending: !1
        }).limit(200), SB.from("sc_motions").select("*").order("created_at", {
            ascending: !1
        }).limit(60), SB.from("sc_votes").select("motion_id,handle,choice"), SB.from("sc_jobs").select("*").order("created_at", {
            ascending: !1
        }).limit(100), SB.from("sc_line").select("*").is("answered_at", null).order("created_at"), SB.rpc("sc_inbox"), SB.from("sc_bans").select("*").order("created_at", {
            ascending: !1
        }).limit(50), SB.from("sc_house").select("*").eq("id", 1).maybeSingle(), SB.from("sc_succ_votes").select("handle,candidate,candidate_handle"), SB.rpc("sc_traffic"), SB.rpc("sc_names"), SB.rpc("sc_applicant_extras"), SB.from("sc_hall_line").select("*").order("key", {ascending: !1}).limit(12), SB.rpc("sc_card_mine"), SB.rpc("sc_profiles"), SB.rpc("sc_ban_record")]);
        SC.table = (rs[0].data || []).map(function(x) {
            return {
                id: x.id,
                uid: x.uid,
                media: Array.isArray(x.media) ? x.media : [],
                who: x.kind === "house" ? "THE TABLE" : x.handle || "",
                letter: x.letter || "",
                body: esc(x.body),
                raw: x.body || "",
                edited: !!x.edited_at,
                at: ts(x.created_at)
            }
        });
        var votes = {};
        (rs[2].data || []).forEach(function(v) {
            (votes[v.motion_id] = votes[v.motion_id] || {})[v.handle] = v.choice
        }), SC.motions = (rs[1].data || []).map(function(x) {
            return {
                id: x.id,
                kind: x.kind,
                title: x.title,
                body: x.body || "",
                by: x.by_handle || "",
                at: ts(x.created_at),
                closed: x.closed_at ? ts(x.closed_at) : 0,
                votes: votes[x.id] || {},
                state: x.state,
                target: x.target_letter
            }
        }), SC.jobs = (rs[3].data || []).map(function(x) {
            return {
                id: x.id,
                title: x.title,
                body: esc(x.body || ""),
                bucks: x.bucks,
                rawBody: x.body || "",
                by: x.by_handle || "",
                at: ts(x.created_at),
                taker: x.taker_handle || null,
                state: x.state,
                late: !!x.source_line,
                source_line: x.source_line
            }
        }), SC.line = (rs[4].data || []).map(function(x) {
            return {
                id: x.id,
                from: x.from_handle || "",
                letter: x.letter || "",
                body: x.body,
                at: ts(x.created_at)
            }
        });
        var taken = {};
        SC.jobs.forEach(function(j) {
            j.source_line && j.state !== "paid" && (taken[j.source_line] = 1)
        }), SC.inbox = (rs[5].data || []).map(function(x) {
            return {
                id: x.id,
                member: x.member_id,
                letter: x.letter,
                from: x.member_handle || "",
                body: x.body || "",
                at: ts(x.created_at),
                state: x.pushed ? "pushed" : "open",
                taken: !!taken[x.id]
            }
        }), SC.bans = (rs[6].data || []).map(function(x) {
            return {
                id: x.id,
                who: x.who,
                by: x.by_handle || "",
                why: x.why,
                at: ts(x.created_at),
                state: x.state,
                done: x.decided_at ? ts(x.decided_at) : 0,
                note: x.decision_note || ""
            }
        });
        var h = rs[7].data || {};
        if (SC.teller = h.teller_handle || null, SC.tellerUid = h.teller || null, SC.announce = h.announce || null, h.succession_open) {
            var sv = {};
            (rs[8].data || []).forEach(function(v) {
                sv[v.handle] = v.candidate_handle
            }), SC.succession = {
                votes: sv,
                sealed: !!h.succession_sealed_at,
                winner: h.successor_handle || null
            }
        } else SC.succession = null;
        SC.names = {};
        (rs[10].data || []).forEach(function(n) { if (n.full_name) { var nm = properCase(n.full_name); n.uid && (SC.names["u:" + n.uid] = nm); n.handle && (SC.names["h:" + String(n.handle).toLowerCase()] = nm) } });
        SC.extras = {};
        (rs[11].data || []).forEach(function(x) { SC.extras[x.uid] = x });
        SC.hall = {};
        (rs[12].data || []).forEach(function(x) { SC.hall[x.key] = { key: x.key, calls: x.calls || 0, caller: x.caller, caller_handle: x.caller_handle, started_at: x.started_at ? ts(x.started_at) : 0, last_call_at: x.last_call_at ? ts(x.last_call_at) : 0, done_at: x.done_at ? ts(x.done_at) : 0, logged_handle: x.logged_handle } });
        SC.myCard = ((rs[13].data || [])[0]) || null;
        SC.banRecord = rs[15].data || [];
        SC.people = {};
        (rs[14].data || []).forEach(function(p) { SC.people["u:" + p.uid] = p; p.handle && (SC.people["h:" + String(p.handle).toLowerCase()] = p); if (p.full_name && !SC.names["u:" + p.uid]) { var nm2 = properCase(p.full_name); SC.names["u:" + p.uid] = nm2; SC.names["h:" + String(p.handle).toLowerCase()] = nm2 } });
        var tr = (rs[9].data || [])[0];
        tr && (SC.traffic = {
            today: tr.today,
            week: tr.week,
            month: tr.month,
            peak: tr.peak || "",
            dispatch: tr.dispatch || ""
        })
    }
    var loading = null;
    async function reload() {
        if (!(!window.SB || !window.__shkUid)) return loading || (loading = (async function() {
            try {
                await loadSeats(), await loadClaims(), await loadRoom(), SC.loaded = !0, markCheck();
                try {
                    paintDoor()
                } catch {}
                try {
                    paintVoteCall()
                } catch {}
                try {
                    localStorage.setItem("shk_sc_member", atTable(me()) ? "1" : "0")
                } catch {}
                const ss = LETTERS.map(function(L) {
                    return SC.seats[L] ? L : ""
                }).join("");
                if (ss !== SC._seatSig) {
                    var first = SC._seatSig == null;
                    if (SC._seatSig = ss, !first) try {
                        typeof loadCouncil == "function" && loadCouncil()
                    } catch {}
                }
            } catch (e) {
                console.warn("[sc] load", e)
            }
            loading = null
        })(), loading)
    }
    window.scReload = reload;

    function markCheck() {
        try {
            if (seatOf_uid(window.__shkUid) && typeof unlockBadge == "function" && typeof bixLate == "function") {
                var ix = bixLate("Shadow Council");
                ix >= 0 && unlockBadge(ix)
            }
        } catch {}
    }
    async function rpc(fn, args) {
        var r = await SB.rpc(fn, args || {});
        if (r.error) {
            var msg = String(r.error.message || "").replace(/^[A-Z0-9]+:\s*/, "");
            throw say(msg || "The house said no."), hum([30, 30, 30]), r.error
        }
        return r.data
    }

    function me() {
        var a = null;
        try {
            a = loadAcct() || {}
        } catch {
            a = {}
        }
        var handle = a.handle || "",
            letter = null;
        try {
            letter = myLetter()
        } catch {}
        return letter || (letter = String(a.id || "").charAt(0).toUpperCase() || null), {
            handle,
            letter,
            head: isCrown(),
            seat: seatOf_uid(window.__shkUid),
            uid: window.__shkUid
        }
    }

    function seated() {
        return LETTERS.filter(function(L) {
            return !!SC.seats[L]
        })
    }

    function seatOf(h) {
        var r = null;
        return LETTERS.forEach(function(L) {
            SC.seats[L] && SC.seats[L].handle === h && (r = L)
        }), r
    }

    function isCouncil(h) {
        return h = String(h || "").toUpperCase(), h === SC.head.handle || !!seatOf(h)
    }

    function atTable(w) {
        return w.head || !!w.seat
    }
    var css = document.createElement("style");
    css.id = "shadowCouncilCSS", css.textContent = [":root{--sc-velvet:#2a0b14;--sc-velvet2:#3b1020;--sc-velvet3:#4a1527;--sc-gold:#d4b36a;--sc-gold-hi:#f1d58e;--sc-gold-lo:rgba(212,179,106,.35);--sc-ink:#efe3c8;--sc-dim:rgba(239,227,200,.55)}", ".sc-ribbon{flex:none;width:33px;height:33px;padding:0;border-radius:10px;cursor:pointer;overflow:hidden;position:relative;", "  background:radial-gradient(circle at 50% 34%,rgba(241,213,142,.55),var(--sc-velvet) 80%);border:1px solid rgba(212,179,106,.7);", "  box-shadow:0 0 14px rgba(212,179,106,.3),inset 0 1px 0 rgba(241,213,142,.3)}", ":root{--sc-hook:url(data:image/webp;base64,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)}", ".sc-ribbon .sc-crest{position:absolute;inset:0;background:var(--sc-hook) center/cover no-repeat}", "html.daylight .sc-ribbon{box-shadow:none}", ".sc-ribbon:active{transform:translateY(1px)}", ".sc-ribbon{overflow:visible}.sc-ribbon .sc-crest{border-radius:9px;overflow:hidden}", ".sc-ribbon{margin-left:10px}", ".sc-ribbon .sc-open{position:absolute;left:50%;bottom:-8px;transform:translateX(-50%);z-index:2;white-space:nowrap;pointer-events:none;", "  font:800 7.5px/1 Cinzel,serif;letter-spacing:.08em;color:var(--sc-velvet);background:linear-gradient(180deg,var(--sc-gold-hi),var(--sc-gold));border:1px solid var(--sc-velvet);border-radius:99px;padding:3px 5px 2px;box-shadow:0 0 8px rgba(212,179,106,.7)}", ".sc-ribbon .sc-open.full{background:var(--sc-velvet2);color:var(--sc-gold);border-color:var(--sc-gold-lo);box-shadow:none}", ".sc-ribbon.beckon{animation:scBeckon 2.2s ease-in-out infinite}", "@keyframes scBeckon{0%,100%{box-shadow:0 0 14px rgba(212,179,106,.3),inset 0 1px 0 rgba(241,213,142,.3)}50%{box-shadow:0 0 24px rgba(241,213,142,.9),0 0 0 3px rgba(212,179,106,.4),inset 0 1px 0 rgba(241,213,142,.3)}}", "@media (prefers-reduced-motion:reduce){.sc-ribbon.beckon{animation:none;box-shadow:0 0 22px rgba(241,213,142,.8)}}", ".sc-sheet.board .sheet-card{padding:34px 12px calc(12px + env(safe-area-inset-bottom))}", ".sc-sheet.gate{align-items:center;background:radial-gradient(120% 90% at 50% 40%,var(--sc-velvet3),#170509 70%);backdrop-filter:none;-webkit-backdrop-filter:none}", ".sc-sheet.gate{transition:opacity .45s ease, visibility 0s linear .45s}", ".sc-sheet.gate.out .sc-gate{opacity:0;transform:scale(.97);transition:opacity .45s ease,transform .6s ease}", ".sc-gate{text-align:center;padding:0 28px;transition:opacity .6s ease}", ".sc-gate .gseal{position:relative;width:140px;height:140px;margin:0 auto 14px}", ".sc-gate .gseal svg{position:absolute;inset:0;width:100%;height:100%;transform:rotate(-90deg)}", ".sc-gate .gseal circle{fill:none;stroke:var(--sc-gold);stroke-width:.8;stroke-dasharray:420;stroke-dashoffset:420;animation:scDraw 1.4s cubic-bezier(.4,0,.2,1) both}", ".sc-gate .gseal .r2{stroke-width:.5;stroke:var(--sc-gold-hi);animation-delay:.25s;stroke-dasharray:4 3 0 0;stroke-dasharray:370;stroke-dashoffset:370;animation-duration:1.2s}", ".sc-gate .gseal .r3{stroke-width:1.2;stroke:var(--sc-gold-hi);animation-delay:.5s;stroke-dasharray:290;stroke-dashoffset:290;animation-duration:1s}", ".sc-gate .gdisc{position:absolute;left:50%;top:50%;width:76px;height:76px;margin:-38px 0 0 -38px;border-radius:50%;overflow:hidden;background:#120407;border:1.5px solid var(--sc-gold-hi);box-shadow:0 0 0 5px #170509,0 0 0 6px var(--sc-gold-lo),0 0 40px rgba(212,179,106,.25);opacity:0;transform:scale(.6);animation:scDisc .9s cubic-bezier(.2,.9,.3,1.2) 1s both}", ".sc-gate .gdisc .ghook{position:absolute;inset:0;background:var(--sc-hook) center/cover no-repeat;filter:brightness(1.05)}", ".sc-gate .grule{display:flex;align-items:center;justify-content:center;gap:10px;width:220px;margin:0 auto 14px;opacity:0;animation:scRise .7s ease-out 1.35s both}", ".sc-gate .grule i{flex:1;height:1px;background:linear-gradient(90deg,transparent,var(--sc-gold));transform:scaleX(0);transform-origin:right;animation:scRule .8s ease-out 1.4s both}.sc-gate .grule i+b+i{background:linear-gradient(90deg,var(--sc-gold),transparent);transform-origin:left}", ".sc-gate .grule b{color:var(--sc-gold-hi);font-size:13px;line-height:1}", ".sc-gate .k{font-family:Cinzel,serif;font-weight:600;font-size:10.5px;letter-spacing:.5em;color:var(--sc-gold);text-transform:uppercase;opacity:0;animation:scTrack 1s ease-out 1.5s both;padding-left:.5em}", ".sc-gate .t{font-family:Cinzel,serif;font-weight:700;font-size:21px;line-height:1.25;color:var(--sc-gold-hi);margin:10px 0 6px;text-shadow:0 1px 0 #000,0 0 26px rgba(212,179,106,.3);opacity:0;animation:scRise .7s ease-out 1.75s both}", ".sc-gate .s{font-family:Cinzel,serif;font-size:12.5px;letter-spacing:.2em;text-transform:uppercase;color:var(--sc-dim);opacity:0;animation:scRise .7s ease-out 2s both}", "@keyframes scDraw{to{stroke-dashoffset:0}}", "@keyframes scDisc{to{opacity:1;transform:none}}", "@keyframes scRule{to{transform:scaleX(1)}}", "@keyframes scTrack{from{opacity:0;letter-spacing:.9em}to{opacity:1;letter-spacing:.5em}}", "@keyframes scRise{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}", "@media (prefers-reduced-motion:reduce){.sc-gate *{animation-duration:.01s!important;animation-delay:0s!important}}", ".sc-sheet.board .sheet-card:before{display:none}", "#scBoard{margin:0 0 20px;border-radius:17px;padding:14px 14px 13px;position:relative;overflow:hidden;cursor:pointer;", "  background:radial-gradient(120% 90% at 50% 0%,var(--sc-velvet3),var(--sc-velvet) 60%,#1b0710);border:1px solid var(--sc-gold-lo);box-shadow:inset 0 0 0 1px rgba(0,0,0,.35),0 10px 30px rgba(0,0,0,.45)}", '#scBoard:before{content:"";position:absolute;inset:5px;border:1px solid rgba(212,179,106,.22);border-radius:13px;pointer-events:none}', "#scBoard .sc-kind{font-family:Cinzel,serif;font-weight:600;font-size:9.5px;letter-spacing:.3em;color:var(--sc-gold);text-transform:uppercase;margin:0 0 6px}", "#scBoard .sc-ttl{font-family:Cinzel,serif;font-weight:700;font-size:21px;letter-spacing:.06em;color:var(--sc-gold-hi);margin:0 0 2px;text-shadow:0 1px 0 #000,0 0 18px rgba(212,179,106,.25)}", '#scBoard .sc-sub{font-family:"Barlow Condensed",sans-serif;font-size:13px;color:var(--sc-dim);letter-spacing:.03em;margin-bottom:11px}', "#scBoard .sc-grid{display:grid;grid-template-columns:repeat(13,minmax(0,1fr));gap:5px}", ".ch-card.hot{border-color:#f1d58e;box-shadow:0 0 18px rgba(241,213,142,.25)}.ch-card.hot .ch-t b{color:#f1d58e}", ".ch-row{display:flex;align-items:center;gap:10px;justify-content:space-between;padding:9px 0;border-bottom:1px solid rgba(212,179,106,.15)}.ch-row b{display:block;color:#f3e6cf;font-size:14px}.ch-row span{font-size:12px;color:#b9a68a}.ch-row em{font-style:normal;color:#f1d58e;font-weight:700;font-size:13px}.ch-row.dim{opacity:.6}", ".ch-card{border:1px solid rgba(212,179,106,.45);border-radius:14px;padding:12px 14px;margin:0 0 10px;background:linear-gradient(184deg,rgba(212,179,106,.12),rgba(0,0,0,.15))}", ".ch-hd{display:flex;align-items:center;justify-content:space-between;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#d4b36a}.ch-hd em{font-style:normal;font-weight:700;color:#f1d58e}", ".ch-t{font-size:15px;font-weight:600;color:#f3e6cf;margin:4px 0 10px}", ".ch-st{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:0 0 8px}.ch-st i{flex:none;width:24px;height:24px;border-radius:50%;background:#d4b36a;color:#1a0b0f;font:700 13px Inter,system-ui,sans-serif;font-style:normal;display:flex;align-items:center;justify-content:center}.ch-st small{flex-basis:100%;margin-left:34px;font-size:12px;color:#b9a68a}", ".ch-b{flex:1;min-width:0;text-align:center;text-decoration:none;display:block;cursor:pointer}.ch-one{width:100%;padding:16px;font-size:15px}.ch-note{font-size:12px;color:#b9a68a;margin:8px 2px 10px;line-height:1.4}", ".ch-opt{margin:6px 0 4px;padding:10px 0 0;border-top:1px dashed rgba(212,179,106,.3);display:flex;flex-direction:column;gap:7px}.ch-opt span{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#b9a68a;text-align:center}.ch-opt .ch-b{padding:10px 12px;font-size:13px}.ch-opt small{font-size:12px;color:#8f806b;text-align:center}", ".ch-done{width:100%;margin-top:4px;padding:11px;border-radius:10px;border:1px dashed rgba(212,179,106,.6);background:none;color:#f1d58e;font:700 13px Inter,system-ui,sans-serif;letter-spacing:.04em;cursor:pointer}", "#scBoard .sc-grid b{display:flex;align-items:center;justify-content:center;height:24px;border-radius:6px;font-family:Cinzel,serif;font-weight:700;font-size:11.5px;letter-spacing:.02em;", "  color:rgba(239,227,200,.28);border:1px solid rgba(212,179,106,.14);background:rgba(0,0,0,.25)}", "#scBoard .sc-grid b.sc-on{color:#2a0b14;background:linear-gradient(160deg,var(--sc-gold-hi),var(--sc-gold) 60%,#9a7a3a);border-color:var(--sc-gold-hi);box-shadow:0 0 10px rgba(212,179,106,.35),inset 0 1px 0 rgba(255,255,255,.5)}", "#scBoard .sc-grid b.sc-me{outline:2px solid var(--sc-gold-hi);outline-offset:1px}", "#scBoard .sc-grid b.sc-ask{color:var(--sc-gold);border-style:dashed;border-color:var(--sc-gold)}", "#scBoard .sc-foot{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:12px}", '#scBoard .sc-foot .st{font-family:"Barlow Condensed",sans-serif;font-size:12.5px;color:var(--sc-dim)}#scBoard .sc-foot .st b{color:var(--sc-gold-hi);font-weight:700}', "#scBoard .sc-cta{font-family:Cinzel,serif;font-weight:700;font-size:11px;letter-spacing:.14em;text-transform:uppercase;padding:9px 13px;border-radius:9px;color:#2a0b14;", "  background:linear-gradient(160deg,var(--sc-gold-hi),var(--sc-gold));border:1px solid var(--sc-gold-hi);box-shadow:0 2px 0 #6e5424,0 6px 16px rgba(0,0,0,.4);cursor:pointer}", "#scBoard .sc-cta.ghost{background:transparent;color:var(--sc-gold);box-shadow:none}", "#scDemo{display:flex;gap:5px;margin:-8px 0 0;align-items:center;flex-wrap:wrap}#scDemo span{font-family:Inter,system-ui,sans-serif;font-size:8.5px;letter-spacing:.18em;color:var(--steel);text-transform:uppercase;margin-right:3px}", '#scDemo button{font-family:"Barlow Condensed",sans-serif;font-size:11px;letter-spacing:.06em;padding:4px 9px;border-radius:999px;border:1px solid var(--line);background:var(--plate-2);color:var(--steel);cursor:pointer}', "#scDemo button.on{border-color:var(--sc-gold);color:var(--sc-gold-hi);background:var(--sc-velvet)}", ".sc-sheet .sheet-card{background:radial-gradient(130% 70% at 50% -10%,var(--sc-velvet3),var(--sc-velvet) 55%,#170509);border:1px solid var(--sc-gold-lo);color:var(--sc-ink);text-align:left;max-width:520px;position:relative}", "html.daylight .sc-sheet .sheet-card{background:radial-gradient(130% 70% at 50% -10%,var(--sc-velvet3),var(--sc-velvet) 55%,#170509);background-image:radial-gradient(130% 70% at 50% -10%,var(--sc-velvet3),var(--sc-velvet) 55%,#170509);border-color:var(--sc-gold-lo);color:var(--sc-ink);box-shadow:0 -8px 30px rgba(0,0,0,.35)}", "html.daylight .sc-sheet input,html.daylight .sc-sheet textarea,html.daylight .sc-sheet select{color:var(--sc-ink)}html.daylight .sc-sheet input::placeholder,html.daylight .sc-sheet textarea::placeholder{color:#9a8a76}", '.sc-sheet .sheet-card:before{content:"";position:absolute;inset:7px;border:1px solid rgba(212,179,106,.18);border-radius:16px 16px 0 0;pointer-events:none}', ".sc-sheet.full{top:var(--tbH,49px);align-items:stretch;background:transparent;backdrop-filter:none;-webkit-backdrop-filter:none;padding-bottom:0}", ".sc-sheet.full .sheet-card{max-width:none;height:100%;max-height:none;border-radius:0;border-width:0 0 0 0;border-top:1px solid var(--sc-gold-lo);transform:none;", "  display:flex;flex-direction:column;padding:12px 16px calc(10px + env(safe-area-inset-bottom) + var(--kb,0px))}", ".sc-sheet.full .sheet-card:before{inset:6px;border-radius:0}", ".sc-sheet.full{will-change:transform;transform:translateZ(0);backface-visibility:hidden;contain:layout paint}", ".sc-sheet.full .sheet-card{contain:paint;isolation:isolate}", ".sc-sheet.full .sc-h{padding-top:6px}", ".sc-h{text-align:center;padding:14px 0 10px}.sc-h .k{font-family:Inter,system-ui,sans-serif;font-size:8.5px;letter-spacing:.22em;color:var(--sc-gold);text-transform:uppercase;white-space:nowrap}", ".sc-h .o{font-family:Cinzel,serif;font-weight:600;font-size:12.5px;letter-spacing:.14em;color:var(--sc-gold-hi);text-transform:uppercase;white-space:nowrap;margin:0 0 3px}", ".sc-h .t{font-family:Cinzel,serif;font-weight:700;font-size:22px;letter-spacing:.08em;color:var(--sc-gold-hi);text-shadow:0 1px 0 #000,0 0 22px rgba(212,179,106,.3);margin:3px 0 2px}", '.sc-h .s{font-family:"Barlow Condensed",sans-serif;font-size:13px;color:var(--sc-dim);letter-spacing:.03em}', ".sc-rule{height:1px;margin:6px 0 12px;background:linear-gradient(90deg,transparent,var(--sc-gold),transparent);opacity:.7}", ".sc-seal{width:58px;height:58px;border-radius:50%;margin:0 auto 8px;display:flex;align-items:center;justify-content:center;font-family:Cinzel,serif;font-weight:700;font-size:26px;color:#2a0b14;", "  background:radial-gradient(circle at 35% 30%,var(--sc-gold-hi),var(--sc-gold) 55%,#8c6f33);box-shadow:0 0 0 3px var(--sc-velvet),0 0 0 4px var(--sc-gold-lo),0 8px 22px rgba(0,0,0,.5),inset 0 1px 0 rgba(255,255,255,.6)}", ".sc-seal.open{background:transparent;color:var(--sc-gold);border:2px dashed var(--sc-gold-lo);box-shadow:none}", ".sc-elig{display:flex;align-items:center;justify-content:center;gap:9px;margin:2px auto 12px;padding:9px 16px;border-radius:999px;width:max-content;font-family:Cinzel,serif;font-weight:700;font-size:12.5px;letter-spacing:.16em;text-transform:uppercase;color:#ffb3a8;border:1px solid rgba(224,122,110,.6);background:rgba(125,35,32,.35)}", ".sc-elig i{font-style:normal;width:20px;height:20px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:12px;background:#7d2320;color:#fff}", ".sc-elig.ok{color:#2a0b14;border-color:var(--sc-gold-hi);background:linear-gradient(160deg,var(--sc-gold-hi),var(--sc-gold))}.sc-elig.ok i{background:#2a0b14;color:var(--sc-gold-hi)}", '.sc-p{font-family:"Barlow Condensed",sans-serif;font-size:15px;line-height:1.4;color:var(--sc-ink);margin:0 0 10px}.sc-p.dim{color:var(--sc-dim);font-size:13.5px}', ".sc-q{font-family:Cinzel,serif;font-style:normal;font-size:13px;color:var(--sc-gold-hi);text-align:center;padding:8px 14px;margin:0 0 12px;border-left:2px solid var(--sc-gold);border-right:2px solid var(--sc-gold)}", '.sc-in{width:100%;background:rgba(0,0,0,.35);border:1px solid var(--sc-gold-lo);border-radius:10px;padding:10px 12px;color:var(--sc-ink);font-family:"Barlow Condensed",sans-serif;font-size:15px;outline:none;resize:none}', ".sc-in:focus{border-color:var(--sc-gold)}.sc-in::placeholder{color:rgba(239,227,200,.35)}", ".sc-row{display:flex;gap:8px;margin-top:10px}.sc-row>*{flex:1}", ".sc-btn{font-family:Cinzel,serif;font-weight:700;font-size:11.5px;letter-spacing:.12em;text-transform:uppercase;padding:12px 10px;border-radius:10px;cursor:pointer;color:#2a0b14;", "  background:linear-gradient(160deg,var(--sc-gold-hi),var(--sc-gold));border:1px solid var(--sc-gold-hi);box-shadow:0 2px 0 #6e5424,0 6px 16px rgba(0,0,0,.4)}", ".sc-btn.ghost{background:transparent;color:var(--sc-gold);box-shadow:none;border-color:var(--sc-gold-lo)}.sc-btn.red{background:linear-gradient(160deg,#c0453a,#7d2320);color:#ffe9e4;border-color:#d6665a;box-shadow:0 2px 0 #4b1210}", ".sc-btn:disabled{opacity:.45;cursor:default}", ".sc-charterlink{display:inline-block;margin-top:6px;font-family:Cinzel,serif;font-weight:700;font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:var(--sc-gold);text-decoration:none;border:1px solid var(--sc-gold-lo);border-radius:999px;padding:4px 11px}", ".sc-announce{margin:-4px 0 10px;padding:9px 12px;border-radius:10px;text-align:center;font-family:Cinzel,serif;font-weight:700;font-size:12px;letter-spacing:.06em;color:#2a0b14;background:linear-gradient(160deg,var(--sc-gold-hi),var(--sc-gold));border:1px solid var(--sc-gold-hi)}", ".sc-tabs{display:flex;gap:4px;margin:0 0 12px;padding:3px;border-radius:12px;background:rgba(0,0,0,.35);border:1px solid var(--sc-gold-lo)}", ".sc-tabs button{flex:1;font-family:Cinzel,serif;font-weight:700;font-size:10px;letter-spacing:.12em;text-transform:uppercase;padding:9px 4px;border-radius:9px;border:0;background:transparent;color:var(--sc-dim);cursor:pointer;position:relative}", ".sc-tabs button.on{color:#2a0b14;background:linear-gradient(160deg,var(--sc-gold-hi),var(--sc-gold))}", ".sc-tabs button i{position:absolute;top:-4px;right:-3px;min-width:15px;height:15px;padding:0 4px;border-radius:8px;background:#c0453a;color:#fff;font:700 9px/15px Inter,sans-serif;font-style:normal;box-shadow:0 0 0 2px var(--sc-velvet)}", ".sc-body{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;padding:2px 2px 8px;min-height:0}", ".sc-table{display:flex;gap:6px;flex-wrap:wrap;justify-content:center;margin:0 0 12px}", ".sc-floor{display:block;width:100%;max-width:420px;margin:0 auto 6px;font-family:Cinzel,serif;font-weight:700}", ".sc-floor .hs circle{fill:transparent;stroke:rgba(212,179,106,.38);stroke-width:1;stroke-dasharray:3 2.5}", ".sc-floor .hs text{font-size:12px;fill:rgba(212,179,106,.45);text-anchor:middle}", ".sc-floor .hs.on circle{fill:url(#scGold);stroke:var(--sc-gold-hi);stroke-dasharray:none}", ".sc-floor .hs.on text{fill:#2a0b14}", ".sc-floor .hs.me circle{stroke:#fff;stroke-width:2}", ".sc-floor .hs .halo{fill:rgba(127,174,106,.12);stroke:#9fd08a;stroke-width:1.5;stroke-dasharray:none;animation:scHalo 2.2s ease-in-out infinite}", ".sc-floor .hs.in>circle:not(.halo){stroke:#9fd08a}", ".sc-floor .hs.me .halo{stroke:#fff}", "@keyframes scHalo{0%,100%{opacity:.5}50%{opacity:1}}", ".sc-floor .hs{transform-box:fill-box;transform-origin:center}.sc-floor .hs .halo{transform-box:fill-box;transform-origin:center}", '.sc-inroom{display:flex;align-items:center;justify-content:center;gap:6px;margin:2px 0 0;font-family:"Barlow Condensed",sans-serif;font-size:12px;letter-spacing:.06em;color:var(--sc-dim)}', ".sc-inroom i{width:7px;height:7px;border-radius:50%;background:#9fd08a;box-shadow:0 0 8px rgba(159,208,138,.8)}.sc-inroom b{color:#9fd08a}", ".sc-floor .hs.head path{fill:#2a0b14;stroke:var(--sc-gold);stroke-width:1}", ".sc-floor .hs.head circle{fill:url(#scGold);stroke:var(--sc-gold-hi);stroke-dasharray:none;stroke-width:1.5}", ".sc-floor .hs.head text{font-size:17px;fill:#2a0b14}", ".sc-table .ch{width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:Cinzel,serif;font-weight:700;font-size:13px;color:#2a0b14;", "  background:radial-gradient(circle at 35% 30%,var(--sc-gold-hi),var(--sc-gold) 60%,#8c6f33);box-shadow:0 3px 8px rgba(0,0,0,.5),inset 0 1px 0 rgba(255,255,255,.5);position:relative}", ".sc-table .ch.head{width:44px;height:44px;font-size:18px;background:radial-gradient(circle at 35% 30%,#fff2c8,var(--sc-gold-hi) 50%,#9a7a3a)}", ".sc-table .ch.empty{background:transparent;color:rgba(212,179,106,.35);border:1px dashed rgba(212,179,106,.3);box-shadow:none}", ".sc-pvb{margin:8px auto 0;display:block;background:none;border:1px solid rgba(212,179,106,.45);color:#d4b36a;border-radius:999px;padding:4px 14px;font-size:12px;cursor:pointer}.sc-pv{margin:8px 0 0;padding:6px 10px;border-radius:10px;background:rgba(77,226,255,.1);border:1px solid rgba(77,226,255,.4);color:#bfefff;font-size:12px;line-height:1.5}.sc-pv button{margin-left:6px;background:none;border:1px solid rgba(191,239,255,.5);color:#bfefff;border-radius:999px;padding:1px 9px;font-size:11px;cursor:pointer}.sc-msg .sc-mact{display:flex;gap:6px;margin-top:5px}.sc-msg .sc-mact button{background:none;border:1px solid rgba(212,179,106,.35);color:#d4b36a;border-radius:999px;padding:2px 10px;font-size:11px;line-height:1.4;cursor:pointer;opacity:.8}.sc-msg{display:flex;gap:10px;padding:9px 0;border-bottom:1px solid rgba(212,179,106,.12)}", ".sc-msg .av{flex:none;width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:Cinzel,serif;font-weight:700;font-size:12px;color:#2a0b14;background:linear-gradient(160deg,var(--sc-gold-hi),var(--sc-gold))}", ".sc-msg .av.head{background:radial-gradient(circle at 35% 30%,#fff2c8,var(--sc-gold-hi) 50%,#9a7a3a);font-size:15px}", ".sc-msg .who{font-family:Cinzel,serif;font-weight:700;font-size:12px;letter-spacing:.06em;color:var(--sc-gold-hi)}.sc-msg .who span{font-family:Inter,system-ui,sans-serif;font-weight:400;font-size:9px;letter-spacing:.12em;color:var(--sc-dim);margin-left:7px}", '.sc-msg .bd{font-family:"Barlow Condensed",sans-serif;font-size:15px;line-height:1.38;color:var(--sc-ink);margin-top:2px}', ".sc-compose{flex:none;display:flex;gap:8px;margin-top:8px;padding-top:10px;border-top:1px solid var(--sc-gold-lo);align-items:flex-end}.sc-compose .sc-in{flex:1;min-height:44px;max-height:120px}.sc-compose .sc-btn{flex:none;padding:12px 14px}", ".sc-mo{border:1px solid var(--sc-gold-lo);border-radius:13px;padding:12px 13px;margin:0 0 10px;background:rgba(0,0,0,.28)}", ".sc-mo .k{font-family:Inter,system-ui,sans-serif;font-size:8.5px;letter-spacing:.2em;color:var(--sc-gold);text-transform:uppercase;display:flex;justify-content:space-between}", ".sc-mo .k em{font-style:normal;color:var(--sc-dim)}.sc-mo .k em.carried{color:#9fd08a}.sc-mo .k em.failed{color:#e07a6e}.sc-mo .k em.decreed{color:var(--sc-gold-hi)}", '.sc-mo .t{font-family:Cinzel,serif;font-weight:700;font-size:14.5px;color:var(--sc-ink);margin:5px 0 3px}.sc-mo .b{font-family:"Barlow Condensed",sans-serif;font-size:13.5px;line-height:1.35;color:var(--sc-dim)}', ".sc-bar{height:7px;border-radius:4px;background:rgba(0,0,0,.45);margin:10px 0 5px;position:relative;overflow:hidden;border:1px solid rgba(212,179,106,.2)}", ".sc-bar b{position:absolute;left:0;top:0;bottom:0;background:linear-gradient(90deg,#8c6f33,var(--sc-gold-hi));border-radius:4px}.sc-bar i{position:absolute;top:-2px;bottom:-2px;width:2px;background:#e07a6e}", '.sc-tally{display:flex;justify-content:space-between;font-family:"Barlow Condensed",sans-serif;font-size:12px;color:var(--sc-dim)}.sc-tally b{color:var(--sc-gold-hi)}', ".sc-vote{display:flex;gap:6px;margin-top:9px}.sc-vote button{flex:1;font-family:Cinzel,serif;font-weight:700;font-size:10.5px;letter-spacing:.1em;padding:9px 4px;border-radius:8px;border:1px solid var(--sc-gold-lo);background:transparent;color:var(--sc-gold);cursor:pointer}", ".sc-vote button.on{background:linear-gradient(160deg,var(--sc-gold-hi),var(--sc-gold));color:#2a0b14}.sc-vote button.dec{border-color:#d6665a;color:#ffb3a8}.sc-vote button.dec.on{background:#7d2320;color:#fff}", ".sc-ap{border-top:1px solid rgba(212,179,106,.14);padding:10px 0 4px}.sc-ap.mine{background:linear-gradient(90deg,rgba(212,179,106,.06),transparent)}", ".sc-ap .who b{font-family:Cinzel,serif;font-size:13.5px;color:var(--sc-gold-hi)}.sc-ap .who span{font-family:Inter,system-ui,sans-serif;font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:var(--sc-dim);margin-left:8px}", '.sc-ap .note{font-family:"Barlow Condensed",sans-serif;font-size:14px;color:var(--sc-ink);margin:4px 0 2px;font-style:italic}', ".sc-ap .facts{display:grid;grid-template-columns:repeat(5,1fr);gap:4px;margin:8px 0 2px}.sc-ap .facts span{display:flex;flex-direction:column;align-items:center;text-align:center;font-family:Inter,system-ui,sans-serif;font-size:7.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--sc-dim);line-height:1.2}", ".sc-ap .facts b{font-family:Cinzel,serif;font-size:14px;color:var(--sc-gold-hi);margin-bottom:2px}", ".sc-stat{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin:0 0 12px}.sc-stat div{border:1px solid var(--sc-gold-lo);border-radius:11px;padding:9px 6px;text-align:center;background:rgba(0,0,0,.28)}", ".sc-stat b{display:block;font-family:Cinzel,serif;font-weight:700;font-size:19px;color:var(--sc-gold-hi)}.sc-stat span{font-family:Inter,system-ui,sans-serif;font-size:8px;letter-spacing:.16em;color:var(--sc-dim);text-transform:uppercase}", '.sc-sec{font-family:Cinzel,serif;font-weight:700;font-size:11px;letter-spacing:.2em;color:var(--sc-gold);text-transform:uppercase;margin:14px 0 7px;display:flex;align-items:center;gap:9px}.sc-sec:after{content:"";flex:1;height:1px;background:var(--sc-gold-lo)}', '.sc-li{display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(212,179,106,.1);font-family:"Barlow Condensed",sans-serif;font-size:14px;color:var(--sc-ink)}', ".sc-li .L{flex:none;width:26px;height:26px;border-radius:7px;display:flex;align-items:center;justify-content:center;font-family:Cinzel,serif;font-weight:700;font-size:12px;color:#2a0b14;background:linear-gradient(160deg,var(--sc-gold-hi),var(--sc-gold))}", ".sc-li .L.open{background:transparent;color:rgba(212,179,106,.4);border:1px dashed rgba(212,179,106,.3)}.sc-li .d{flex:1;min-width:0}.sc-li .d small{display:block;font-size:11.5px;color:var(--sc-dim)}", ".sc-li .act{display:flex;gap:5px}.sc-li .act button{font-family:Cinzel,serif;font-weight:700;font-size:9.5px;letter-spacing:.08em;padding:6px 9px;border-radius:7px;border:1px solid var(--sc-gold-lo);background:transparent;color:var(--sc-gold);cursor:pointer}", ".sc-li.q{flex-wrap:wrap}.sc-li.q .act{width:100%;justify-content:flex-end;margin-top:4px}.sc-li.q .act button{padding:8px 14px;font-size:10.5px}", ".sc-li .act button.y{background:linear-gradient(160deg,var(--sc-gold-hi),var(--sc-gold));color:#2a0b14}.sc-li .act button.n{border-color:#d6665a;color:#ffb3a8}", ".sc-close{position:absolute;top:-2px;right:12px;width:30px;height:30px;border-radius:50%;border:1px solid var(--sc-gold-lo);background:rgba(0,0,0,.35);color:var(--sc-gold);font-size:15px;cursor:pointer;z-index:2}", "html.daylight #scBoard,html.daylight .sc-sheet .sheet-card{color:var(--sc-ink)}", ".sc-gate .k,.sc-gate .s,#scBoard .sc-kind,#scBoard .sc-grid b,#scBoard .sc-foot .st,#scBoard .sc-cta,#scDemo span,#scDemo button,.sc-h .k,.sc-h .o,.sc-elig,.sc-elig i,.sc-btn,.sc-charterlink,.sc-announce,.sc-tabs button,.sc-inroom,.sc-msg .av,.sc-msg .who,.sc-msg .who span,.sc-mo .k,.sc-tally,.sc-vote button,.sc-ap .who span,.sc-ap .facts span,.sc-stat span,.sc-sec,.sc-li .L,.sc-li .d small,.sc-li .act button,.sc-li.q .act button{font-size:13px}", ".sc-h .k,.sc-gate .k{letter-spacing:.16em}.sc-ap .facts span,.sc-stat span,.sc-mo .k,.sc-msg .who span,.sc-ap .who span{letter-spacing:.06em}"].join(`
`), document.head.appendChild(css);

    function boardHTML() {
        var w = me(),
            n = seated().length,
            mine = SC.seats[w.letter],
            ask = SC.claims.some(function(c) {
                return c.handle === w.handle && c.letter === w.letter
            }),
            cells = LETTERS.map(function(L) {
                var cl = (SC.seats[L] ? "sc-on" : "") + (L === w.letter && !w.head ? " sc-me" : "") + (!SC.seats[L] && SC.claims.some(function(c) {
                    return c.letter === L
                }) && (w.head || ask && L === w.letter) ? " sc-ask" : "");
                return '<b class="' + cl + '" data-sl="' + L + '" title="Seat of ' + L + '">' + L + "</b>"
            }).join(""),
            cta;
        w.head || w.seat ? cta = '<button type="button" class="sc-cta" data-sc="chamber">\u269C Enter the Chamber</button>' : ask ? cta = '<button type="button" class="sc-cta ghost" data-sc="seat">Claim placed \xB7 awaiting the Keymaster</button>' : mine ? cta = '<button type="button" class="sc-cta ghost" data-sc="seat">Seat of ' + w.letter + " is held</button>" : cta = '<button type="button" class="sc-cta" data-sc="seat">Claim the seat of ' + esc(w.letter) + "</button>";
        var demo = "";
        return '<div id="scBoard" data-sc="seat"><div class="sc-ttl">\u269C The Shadow Council</div><div class="sc-kind">Secret Society</div><div class="sc-sub">One seat per letter. Twenty-six seats.</div><div class="sc-grid">' + cells + '</div><div class="sc-foot"><div class="st"><b>' + n + "</b> of 26 seats filled \xB7 <b>" + (26 - n) + "</b> open</div>" + cta + "</div></div>" + demo
    }

    function paintBoard() {
        var sh = $("scBoardSheet");
        sh && (sh.innerHTML = '<div class="sheet-card"><button type="button" class="sc-close" data-scx>\u2715</button>' + boardHTML() + "</div>")
    }

    function fullHouse() {
        return seated().length === 26
    }
    /* #scnotes(oct13) — the ⚜ chip counts what is new FOR YOU, and each thing clears once you've looked at it:
       a vote waiting on your seat · your motion or ban request decided · someone @tagged you at the table · an
       election or succession vote. The Keymaster has no vote, so open motions never count for the Keymaster. */
    function scSeenKey() {
        return "sc_seen_" + (window.__shkUid || "")
    }

    function scSeen() {
        try {
            return JSON.parse(localStorage.getItem(scSeenKey()) || "{}") || {}
        } catch (e) {
            return {}
        }
    }

    function scNotes() {
        var w = me();
        if (!atTable(w) || !SC.loaded) return [];
        var out = [],
            H = String(w.handle || "").toUpperCase(),
            wk = Date.now() - 7 * 864e5,
            day3 = Date.now() - 3 * 864e5;
        if (w.seat && !w.head) SC.motions.forEach(function(x) {
            x.state === "open" && !(x.votes || {})[w.handle] && out.push({
                k: "v:" + x.id,
                tab: "motions"
            })
        });
        SC.motions.forEach(function(x) {
            x.by === w.handle && x.state !== "open" && (x.closed || x.at) > wk && out.push({
                k: "d:" + x.id + ":" + x.state,
                tab: "motions"
            })
        });
        (SC.bans || []).forEach(function(b) {
            b.by === w.handle && b.state !== "asked" && (b.done || b.at) > wk && out.push({
                k: "b:" + b.id + ":" + b.state,
                tab: "table"
            })
        });
        if (H.length > 1) SC.table.forEach(function(m) {
            m.who !== w.handle && m.at > day3 && String(m.raw || "").toUpperCase().indexOf("@" + H) >= 0 && out.push({
                k: "m:" + m.id,
                tab: "table"
            })
        });
        var by = {};
        (SC.applicants || []).forEach(function(a) {
            (by[a.letter] = by[a.letter] || []).push(a)
        });
        Object.keys(by).forEach(function(L) {
            var l = by[L];
            !(l[0].ends && l[0].ends < Date.now()) && !l.some(function(a) {
                return a.mine
            }) && w.seat && out.push({
                k: "e:" + L + ":" + (l[0].ends || 0),
                tab: "desk"
            })
        });
        SC.succession && !SC.succession.sealed && !w.head && !SC.succession.votes[w.handle] && out.push({
            k: "s:succ",
            tab: "desk"
        });
        var seen = scSeen();
        return out.filter(function(i) {
            return !seen[i.k]
        })
    }

    function scMarkSeen(t) {
        if (!SC.loaded || !window.__shkUid || SC._preview) return;
        var seen = scSeen(),
            now = Date.now(),
            ch = !1;
        scNotes().forEach(function(i) {
            i.tab === t && !seen[i.k] && (seen[i.k] = now, ch = !0)
        });
        if (ch) {
            Object.keys(seen).forEach(function(k) {
                now - seen[k] > 30 * 864e5 && delete seen[k]
            });
            try {
                localStorage.setItem(scSeenKey(), JSON.stringify(seen))
            } catch (e) {}
            setTimeout(function() {
                try {
                    paintVoteCall()
                } catch (e) {}
            }, 0)
        }
    }

    function votesWaiting() {
        var n = scNotes();
        return {
            n: n.length,
            tab: n.length ? n[0].tab : "motions"
        }
    }
    var _vcLast = -1;

    function paintVoteCall() {
        var b = document.getElementById("hcsc"),
            n = document.getElementById("hcScN");
        if (b) {
            var v = votesWaiting();
            b.style.display = v.n > 0 ? "" : "none", n && (n.textContent = v.n > 99 ? "99+" : String(v.n)), b.title = v.n ? v.n + " council vote" + (v.n == 1 ? "" : "s") + " waiting on you" : "", b.setAttribute("aria-label", b.title || "Council votes waiting"), b._tab = v.tab, _vcLast >= 0 && v.n > _vcLast && (b.classList.remove("ring"), b.offsetWidth, b.classList.add("ring"), hum([10, 30, 10])), _vcLast = v.n
        }
    }
    window.scVotesWaiting = votesWaiting, window.scOpenDoor = function() {
        return reload().then(function() {
            openBoard()
        })
    }, window.scOpenVotes = function() {
        return reload().then(function() {
            openChamber(votesWaiting().tab)
        })
    }, (function() {
        var b = document.getElementById("hcsc");
        b && b.addEventListener("click", function() {
            hum([12]), openChamber(b._tab || "motions")
        })
    })();

    function paintDoor() {
        var b = document.getElementById("scRibbon");
        if (b) {
            var tag = b.querySelector(".sc-open");
            if (!SC.loaded || !window.__shkUid) {
                tag && tag.remove(), b.classList.remove("beckon"), b.title = "The Shadow Council";
                return
            }
            var w = me(),
                open = 26 - seated().length,
                mine = atTable(w);
            if (tag || (tag = document.createElement("span"), tag.className = "sc-open", tag.setAttribute("aria-hidden", "true"), b.appendChild(tag)), mine) {
                tag.textContent = open <= 0 ? "FULL" : open + " OPEN", tag.classList.toggle("full", open <= 0), b.classList.remove("beckon");
                var sm = "The Shadow Council \u2014 your seat \xB7 " + open + " of 26 seats open";
                b.title = sm, b.setAttribute("aria-label", sm);
                return
            }
            if (open <= 0) {
                tag.textContent = "FULL", tag.classList.add("full"), b.classList.remove("beckon"), b.title = "The Shadow Council \u2014 every seat is taken", b.setAttribute("aria-label", "The Shadow Council \u2014 every seat is taken");
                return
            }
            tag.textContent = open + " OPEN", tag.classList.remove("full"), b.classList.add("beckon");
            var say2 = "The Shadow Council \u2014 " + open + " of 26 seats open. Tap to claim yours.";
            b.title = say2, b.setAttribute("aria-label", say2)
        }
    }

    function lockedHTML(w) {
        return '<div class="sheet-card"><button type="button" class="sc-close" data-scx>\u2715</button><div class="sc-h" style="padding-top:18px"><div class="sc-seal open" style="font-size:22px">\u{1F512}</div><div class="k" style="letter-spacing:.3em">Access not granted</div><div class="t" style="font-size:19px">Shadow Council Members Only</div></div><div class="sc-rule"></div><p class="sc-p" style="text-align:center">All twenty-six seats are taken. Every letter has its representative on the Council, ' + esc(w.letter) + ' included.</p><p class="sc-p dim" style="text-align:center">Seats open only when a member gives theirs up.</p><div class="sc-row"><button type="button" class="sc-btn ghost" data-scx>Understood</button></div></div>'
    }
    var gateTimer = null;

    function gateCSS() {
        if ($("scGateCSS")) return;
        var st = document.createElement("style");
        st.id = "scGateCSS";
        st.textContent = [
            ".sc-sheet.gate{overflow:hidden;padding:0!important;background:radial-gradient(70% 55% at 50% 42%,#5c1a30 0%,var(--sc-velvet3) 38%,#14040a 78%,#090205 100%)}",
            ".sc-sheet.gate:after{content:\"\";position:absolute;inset:0;pointer-events:none;background:radial-gradient(120% 100% at 50% 45%,transparent 55%,rgba(0,0,0,.55));z-index:1}",
            ".gdoor{position:absolute;top:0;bottom:0;width:50.5%;z-index:6;background:repeating-linear-gradient(90deg,rgba(0,0,0,.18) 0 2px,transparent 2px 22px),linear-gradient(180deg,#3b0f1e,#1c060d);box-shadow:inset 0 0 60px rgba(0,0,0,.7);animation:gDoor 1.25s cubic-bezier(.7,0,.25,1) .25s both}",
            ".gdoor.l{left:0;border-right:1px solid var(--sc-gold);--gx:-102%}.gdoor.r{right:0;border-left:1px solid var(--sc-gold);--gx:102%}",
            ".gdoor:before{content:\"\";position:absolute;inset:18px 16px;border:1px solid var(--sc-gold-lo);border-radius:4px;box-shadow:inset 0 0 0 5px rgba(0,0,0,.25),inset 0 0 0 6px var(--sc-gold-lo)}",
            ".gdoor i{position:absolute;top:50%;width:10px;height:56px;margin-top:-28px;border-radius:5px;background:linear-gradient(90deg,#7a5a1e,#f1d58e 45%,#8a6a28);box-shadow:0 0 10px rgba(241,213,142,.35)}",
            ".gdoor.l i{right:14px}.gdoor.r i{left:14px}",
            "@keyframes gDoor{0%{transform:none}100%{transform:translateX(var(--gx))}}",
            ".grays{position:absolute;left:50%;top:41%;width:180vmax;height:180vmax;margin:-90vmax 0 0 -90vmax;z-index:2;pointer-events:none;opacity:0;background:repeating-conic-gradient(from 0deg,rgba(241,213,142,.07) 0 4deg,transparent 4deg 13deg);-webkit-mask:radial-gradient(circle,#000 0,transparent 42%);mask:radial-gradient(circle,#000 0,transparent 42%);animation:gRays 1.6s ease-out .7s both,gSpin 60s linear infinite}",
            "@keyframes gRays{to{opacity:1}}@keyframes gSpin{to{transform:rotate(360deg)}}",
            ".gember{position:absolute;bottom:-10px;z-index:3;width:3px;height:3px;border-radius:50%;background:#f1d58e;box-shadow:0 0 6px 1px rgba(241,213,142,.8);opacity:0;animation:gEmber linear infinite}",
            "@keyframes gEmber{0%{transform:translate(0,0);opacity:0}12%{opacity:.9}100%{transform:translate(var(--dx),-105vh);opacity:0}}",
            ".sc-sheet.gate .sc-gate{position:relative;z-index:4;box-sizing:border-box;width:100%;max-width:440px;margin:0 auto;padding:0 24px;text-align:center}", ".sc-gate .gseal.big svg.gletters{transform:none}",
            ".sc-gate .gseal.big{width:244px;height:244px;margin:0 auto 6px}",
            ".sc-gate .gseal.big svg.rings{transform:rotate(-90deg)}",
            ".sc-gate .gseal.big .r1{stroke-width:1.1}",
            ".sc-gate .gseal.big .gdisc{width:104px;height:104px;margin:-52px 0 0 -52px;box-shadow:0 0 0 6px #120407,0 0 0 7.5px var(--sc-gold),0 0 50px 8px rgba(241,213,142,.28)}",
            ".sc-gate .gdisc:after{content:\"\";position:absolute;inset:0;background:linear-gradient(115deg,transparent 30%,rgba(255,244,210,.75) 48%,transparent 62%);transform:translateX(-120%);animation:gShine 1.1s ease-in-out 2.1s both}",
            "@keyframes gShine{to{transform:translateX(120%)}}",
            ".gletters{position:absolute;inset:0;width:100%;height:100%;overflow:visible}",
            ".gletters text{font-family:Cinzel,serif;font-weight:700;font-size:10.5px;fill:var(--sc-gold);text-anchor:middle;dominant-baseline:central;opacity:0;animation:gLet .4s ease-out both}",
            ".gletters text.me{fill:#fff4d2;font-size:15px;animation:gLet .4s ease-out both,gMe 1.2s ease-in-out 2.4s 2 alternate}",
            ".gletters circle.me{fill:none;stroke:#fff4d2;stroke-width:1;opacity:0;animation:gLet .5s ease-out 2.3s both}",
            "@keyframes gLet{from{opacity:0;transform:scale(.4)}to{opacity:.85;transform:none}}",
            "@keyframes gMe{to{filter:drop-shadow(0 0 6px #f1d58e) drop-shadow(0 0 14px #f1d58e)}}",
            ".gletters text{transform-box:fill-box;transform-origin:center}",
            ".sc-gate .k{animation-delay:2.35s!important}", ".sc-gate .grule{animation-delay:2.15s!important}.sc-gate .grule i{animation-delay:2.2s!important}",
            ".sc-gate .gw{font-family:Cinzel,serif;font-weight:600;font-size:15px;letter-spacing:.24em;text-transform:uppercase;color:var(--sc-ink);margin:12px 0 2px;opacity:0;animation:scRise .7s ease-out 2.6s both}",
            ".sc-gate .gn{font-family:Cinzel,serif;font-weight:700;font-size:40px;line-height:1.15;letter-spacing:.04em;margin:0 0 14px;white-space:nowrap;",
            "background:linear-gradient(180deg,#fff7dc 0%,#f1d58e 38%,#b8913f 62%,#f6dfa0 100%);-webkit-background-clip:text;background-clip:text;color:transparent;",
            "filter:drop-shadow(0 2px 0 #1a0508) drop-shadow(0 0 22px rgba(241,213,142,.35));opacity:0;animation:gName 1s cubic-bezier(.2,.9,.3,1) 2.85s both}",
            "@keyframes gName{from{opacity:0;letter-spacing:.14em;transform:translateY(10px)}to{opacity:1;letter-spacing:.04em;transform:none}}",
            ".sc-gate .gseat{display:flex;flex-direction:column;align-items:center;gap:10px;margin:2px auto 0;opacity:0;animation:scRise .6s ease-out 3.3s both}", ".sc-gate .gsig{width:92px;height:92px;display:block;overflow:visible;filter:drop-shadow(0 6px 10px rgba(0,0,0,.6)) drop-shadow(0 0 18px rgba(212,179,106,.22));animation:gStamp .7s cubic-bezier(.2,1.3,.4,1) 3.35s both}", ".sc-gate .gsig .ins{font-family:Cinzel,serif;font-weight:700;font-size:7px;fill:#3a2a10}", ".sc-gate .gsig .lt{font-family:Cinzel,serif;font-weight:700;font-size:34px;text-anchor:middle;dominant-baseline:central}", ".sc-gate .gsig .glint{animation:gGlint 1.2s ease-in-out 4s both}", "@keyframes gGlint{from{transform:translateX(-120px)}to{transform:translateX(120px)}}", "@keyframes gStamp{0%{opacity:0;transform:scale(1.5) rotate(-24deg)}70%{opacity:1;transform:scale(.97) rotate(2deg)}100%{opacity:1;transform:none}}", ".sc-gate .gseat span{font-family:Cinzel,serif;font-weight:600;font-size:13px;letter-spacing:.34em;text-transform:uppercase;color:var(--sc-ink);padding-left:.34em}", ".sc-gate .gseat span b{color:var(--sc-gold-hi);font-weight:700}",
            "@media (prefers-reduced-motion:reduce){.gdoor{display:none}.grays,.gember{animation:none!important;opacity:0!important}.sc-gate *,.sc-gate *:before,.sc-gate *:after{animation-duration:.01s!important;animation-delay:0s!important;animation-iteration-count:1!important}}",
            "@media (max-height:620px){.sc-gate .gseal.big{width:190px;height:190px}.sc-gate .gseal.big .gdisc{width:84px;height:84px;margin:-42px 0 0 -42px}}"
        ].join("");
        document.head.appendChild(st)
    }

    function openGate(w) {
        gateCSS();
        var g = sheetEl("scGate", "sc-sheet gate", 97),
            head = !!w.head,
            seat = w.seat || "",
            CROWN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 18h18l-1.6-9.2-4.6 3.9L12 5.5l-2.8 7.2-4.6-3.9z"/><rect x="3" y="19.2" width="18" height="2" rx="1"/></svg>',
            ring = '<svg class="gletters" viewBox="0 0 244 244" aria-hidden="true">' + LETTERS.map(function(L, i) {
                var a = (i / 26) * 2 * Math.PI - Math.PI / 2,
                    x = (122 + 111 * Math.cos(a)).toFixed(1),
                    y = (122 + 111 * Math.sin(a)).toFixed(1),
                    me = head || L === seat;
                return (L === seat && !head ? '<circle class="me" cx="' + x + '" cy="' + y + '" r="11"/>' : '') + '<text class="' + (me ? "me" : "") + '" x="' + x + '" y="' + y + '" style="animation-delay:' + (0.95 + i * 0.045).toFixed(2) + 's' + (me && head ? ',' + (2.4 + i * 0.02).toFixed(2) + 's' : '') + '">' + L + "</text>"
            }).join("") + "</svg>",
            embers = "";
        for (var e = 0; e < 16; e++) embers += '<i class="gember" style="left:' + (4 + Math.random() * 92).toFixed(1) + "%;--dx:" + (Math.random() * 60 - 30).toFixed(0) + "px;animation-duration:" + (6 + Math.random() * 6).toFixed(1) + "s;animation-delay:" + (0.8 + Math.random() * 5).toFixed(1) + 's"></i>';
        var title = head ? "Welcome," : "Welcome, Councilor",
            name = head ? "Keymaster" : esc(w.handle || "Councilor"),
            sigil = function(id, center, legend) {
                var beads = "";
                for (var k = 0; k < 44; k++) {
                    var t = k / 44 * 2 * Math.PI;
                    beads += '<circle cx="' + (50 + 45.2 * Math.cos(t)).toFixed(2) + '" cy="' + (50 + 45.2 * Math.sin(t)).toFixed(2) + '" r="1.15"/>'
                }
                return '<svg class="gsig" viewBox="0 0 100 100" aria-hidden="true"><defs>' +
                    '<radialGradient id="' + id + 'g" cx="38%" cy="32%" r="75%"><stop offset="0" stop-color="#f6e2a6"/><stop offset=".45" stop-color="#c9a352"/><stop offset=".8" stop-color="#7d5c22"/><stop offset="1" stop-color="#4a3410"/></radialGradient>' +
                    '<radialGradient id="' + id + 'd" cx="60%" cy="68%" r="80%"><stop offset="0" stop-color="#d9b866"/><stop offset=".6" stop-color="#8f6a28"/><stop offset="1" stop-color="#5a3f14"/></radialGradient>' +
                    '<linearGradient id="' + id + 'l" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2b1d08"/><stop offset="1" stop-color="#4a3410"/></linearGradient>' +
                    '<path id="' + id + 'p" d="M50 50 m-35.5 0 a35.5 35.5 0 1 1 71 0 a35.5 35.5 0 1 1 -71 0"/>' +
                    '<clipPath id="' + id + 'c"><circle cx="50" cy="50" r="48"/></clipPath></defs>' +
                    '<circle cx="50" cy="50" r="48" fill="url(#' + id + 'g)" stroke="#3a2a10" stroke-width="1"/>' +
                    '<g fill="#5a3f14">' + beads + '</g>' +
                    '<circle cx="50" cy="50" r="42.4" fill="none" stroke="#3a2a10" stroke-width=".7"/><circle cx="50" cy="50" r="41.6" fill="none" stroke="#f6e2a6" stroke-width=".4" opacity=".7"/>' +
                    '<text class="ins"><textPath href="#' + id + 'p" startOffset="0" textLength="221" lengthAdjust="spacing">' + legend + '</textPath></text>' +
                    '<circle cx="50" cy="50" r="29" fill="url(#' + id + 'd)" stroke="#3a2a10" stroke-width="1"/><circle cx="50" cy="50" r="28" fill="none" stroke="#f6e2a6" stroke-width=".5" opacity=".55"/>' +
                    '<path d="M50 24 L54 40 L76 46 L76 54 L54 60 L50 76 L46 60 L24 54 L24 46 L46 40 Z" fill="#6e5019" opacity=".38"/>' +
                    center +
                    '<g clip-path="url(#' + id + 'c)"><rect class="glint" x="-30" y="-10" width="18" height="120" fill="#fff6d8" opacity=".35" transform="skewX(-18)"/></g></svg>'
            },
            letterMark = function(L) {
                return '<text class="lt" x="50" y="51.6" fill="#f6e2a6" opacity=".55">' + L + '</text><text class="lt" x="50" y="50" fill="url(#gsigl)">' + L + '</text>'
            },
            crownMark = '<g transform="translate(35 34) scale(1.25)" ><path d="M3 18h18l-1.6-9.2-4.6 3.9L12 5.5l-2.8 7.2-4.6-3.9z" fill="#f6e2a6" opacity=".55" transform="translate(0 1.2)"/><path d="M3 18h18l-1.6-9.2-4.6 3.9L12 5.5l-2.8 7.2-4.6-3.9z" fill="url(#gsigl)"/><rect x="3" y="19.2" width="18" height="2" rx="1" fill="url(#gsigl)"/></g>',
            seatHTML = head ? '<div class="gseat">' + sigil("gsig", crownMark, "\u2720 SIGILLVM \u2720 CORONAE \u2720 VMBRAE ") + '<span>The Crown \u00b7 <b>Head of the Table</b></span></div>' :
            seat ? '<div class="gseat">' + sigil("gsig", letterMark(esc(seat)), "\u2720 SIGILLVM \u2720 CONSILII \u2720 VMBRAE ") + '<span>Seat of <b>' + esc(seat) + '</b></span></div>' : "";
        g.setAttribute("role", "dialog");
        g.setAttribute("aria-label", (head ? "Welcome, Keymaster" : "Welcome, Councilor " + (w.handle || "") + (seat ? ", Seat of " + seat : "")) + ". Access granted.");
        g.innerHTML = '<div class="gdoor l"><i></i></div><div class="gdoor r"><i></i></div><div class="grays"></div>' + embers +
            '<div class="sc-gate"><div class="gseal big"><svg class="rings" viewBox="0 0 140 140" aria-hidden="true"><circle class="r1" cx="70" cy="70" r="66"/><circle class="r2" cx="70" cy="70" r="58"/><circle class="r3" cx="70" cy="70" r="46"/></svg>' + ring + '<div class="gdisc"><span class="ghook"></span></div></div>' +
            '<div class="grule"><i></i><b>\u269C</b><i></i></div><div class="k">Access granted</div><div class="gw">' + title + '</div><div class="gn">' + name + "</div>" + seatHTML + "</div>";
        g.classList.remove("out"), g.classList.add("on"), hum([40, 80, 40, 80, 160]);
        var gn = g.querySelector(".gn"),
            fitName = function() {
                try {
                    var t = gn.textContent,
                        avail = gn.clientWidth,
                        c = document.createElement("canvas").getContext("2d");
                    if (!avail || !c) return;
                    c.font = "700 100px Cinzel, Georgia, serif";
                    var w = c.measureText(t).width + t.length * 4;
                    gn.style.fontSize = Math.max(14, Math.min(40, Math.floor(avail * 100 / w * .96))) + "px"
                } catch (e) {}
            };
        fitName();
        try {
            document.fonts && document.fonts.load("700 40px Cinzel").then(fitName)
        } catch (e) {}
        var done = !1,
            go = function() {
                done || (done = !0, clearTimeout(gateTimer), g.classList.add("out"), setTimeout(function() {
                    openChamber()
                }, 500), setTimeout(function() {
                    g.classList.remove("on"), setTimeout(function() {
                        g.classList.remove("out")
                    }, 500)
                }, 550))
            };
        g.onclick = null, g._ride || (g._ride = !0, window.addEventListener("click", function(e) {
            g.classList.contains("on") && g.contains(e.target) && (e.stopPropagation(), e.preventDefault())
        }, !0)), gateTimer = setTimeout(go, matchMedia("(prefers-reduced-motion: reduce)").matches ? 2600 : 5600)
    }

    function openBoard() {
        var sh = sheetEl("scBoardSheet", "sc-sheet board", 94),
            w = me();
        if (atTable(w)) {
            openGate(w);
            return
        }
        if (fullHouse() && !atTable(w)) {
            sh.innerHTML = lockedHTML(w), sh.classList.add("on"), hum([30, 30, 30]);
            return
        }
        openSeat(), hum([12])
    }
    window.openShadowBoard = openBoard, document.addEventListener("click", function(ev) {
        if (ev.target.closest && ev.target.closest("#scRibbon")) {
            if (ev.stopPropagation(), !window.__shkUid) {
                say("Sign in first.");
                return
            }
            if (!SC.loaded) {
                say("Reading the seats\u2026"), reload().then(openBoard);
                return
            }
            reload(), openBoard();
            return
        }
        var b = ev.target.closest && ev.target.closest("[data-sc]");
        if (!(!b || !b.closest("#scBoardSheet"))) {
            ev.stopPropagation(), hum([12]), $("scBoardSheet").classList.remove("on");
            var cell = ev.target.closest && ev.target.closest("[data-sl]");
            b.getAttribute("data-sc") === "chamber" ? openChamber() : openSeat(cell ? cell.getAttribute("data-sl") : null)
        }
    }, !0);

    function elig(ok, why) {
        return '<div class="sc-elig' + (ok ? " ok" : "") + '"><i>' + (ok ? "\u2713" : "\u2715") + "</i>" + (ok ? "Eligible" : "Not eligible") + '</div><p class="sc-p" style="text-align:center">' + why + "</p>"
    }

    function openSeat(pick) {
        var w = me(),
            L = pick || w.letter,
            s = SC.seats[L],
            ask = SC.claims.filter(function(c) {
                return c.handle === w.handle && c.letter === L
            })[0],
            sh = sheetEl("scSeat", "sc-sheet", 95),
            h = '<div class="sheet-card"><button type="button" class="sc-close" data-scx>\u2715</button>';
        h += '<div class="sc-h"><div class="t" style="font-size:21px;margin:0 0 12px">\u269C The Shadow Council</div><div class="sc-seal' + (s ? "" : " open") + '">' + L + '</div><div class="t" style="font-size:18px">The Seat of ' + L + "</div>", w.head ? h += '<div class="s">You hold the table, not a seat.</div></div><div class="sc-rule"></div><p class="sc-p">The Keymaster oversees every seat and holds none. Your own letter, ' + esc(L) + ", " + (s ? "is spoken for by <b>" + esc(s.handle) + "</b>." : "stands open like any other \u2014 a casual with a " + esc(L) + " card can claim it.") + '</p><div class="sc-row"><button type="button" class="sc-btn" data-scgo="chamber">\u269C Enter the Chamber</button></div>' : w.seat === L ? h += '<div class="s">Seated ' + ago(s.since) + '</div></div><div class="sc-rule"></div>' + (s.word ? '<div class="sc-q">\u201C' + esc(s.word) + "\u201D</div>" : "") + '<p class="sc-p dim">You represent the ' + esc(L) + '\u2019s on the Council. Help them. Answer them. What you cannot answer, push up the line. The seat is yours until you give it up, or the council takes it.</p><div class="sc-row"><button type="button" class="sc-btn" data-scgo="chamber">\u269C Enter the Chamber</button></div><div class="sc-row"><button type="button" class="sc-btn ghost" data-scgo="giveup">Retire the seat \xB7 step down</button></div>' : ask ? h += '<div class="s">Your claim is in \xB7 filed ' + ago(ask.at) + '</div></div><div class="sc-rule"></div><p class="sc-p dim">The council votes when the window closes' + (ask.ends ? " \xB7 " + new Date(ask.ends).toLocaleDateString(void 0, {
            month: "short",
            day: "numeric"
        }) : "") + '. You will hear by DM when the seat is yours \u2014 or when it is not.</p><div class="sc-row"><button type="button" class="sc-btn ghost" data-scgo="unclaim">Withdraw the claim</button></div>' : L !== w.letter ? h += '<div class="s">' + (s ? "This seat is held" : "This seat stands open") + '</div></div><div class="sc-rule"></div>' + elig(!1, "This is not your letter.") : s ? h += '<div class="s">This seat is held</div></div><div class="sc-rule"></div>' + elig(!1, "Wait until the Shadow Council member retires a seat.") : h += '<div class="s">This seat stands open</div></div><div class="sc-rule"></div>' + elig(!0, "One seat per letter, twenty-six seats. Take " + esc(L) + " and you become the " + esc(L) + "\u2019s representative on the Council: you help new members, answer what you can, push up what you can\u2019t, and sit in on every vote.") + '<textarea class="sc-in" id="scWhy" rows="2" maxlength="300" placeholder="Optional message to the council \u2014 why do you want to join? Short answer." style="margin-bottom:2px"></textarea><div class="sc-row"><button type="button" class="sc-btn" data-scgo="claim">Take the seat of ' + esc(L) + '</button></div><p class="sc-p dim" style="margin-top:10px;text-align:center">Filing opens a seven-day window for ' + esc(L) + ". Others of the letter may file too; the council votes.</p>", h += "</div>", sh.innerHTML = h, sh.classList.add("on")
    }
    document.addEventListener("click", function(ev) {
        var x = ev.target.closest && ev.target.closest("[data-scx]");
        if (x) {
            var s = x.closest(".sheet");
            if (s && (s.classList.remove("on"), s.id === "scChamber")) try {
                floorTrack(typeof CURRENT_ROOM < "u" ? CURRENT_ROOM : null)
            } catch {}
            return
        }
        var g = ev.target.closest && ev.target.closest("[data-scgo]");
        if (g) {
            var k = g.getAttribute("data-scgo"),
                w = me(),
                L = w.letter;
            if (k === "chamber") {
                $("scSeat") && $("scSeat").classList.remove("on"), openChamber();
                return
            }
            if (k === "board") {
                var bs = sheetEl("scBoardSheet", "sc-sheet board", 94);
                paintBoard(), bs.classList.add("on");
                return
            }
            if (k === "giveup" && w.seat && (L = w.seat), k === "claim") {
                rpc("sc_claim", {
                    p_note: $("scWhy") && $("scWhy").value.trim() || null
                }).then(function() {
                    hum([20, 40, 60]), say("\u269C Your claim on the seat of " + L + " is in. The council votes when the window closes."), $("scSeat").classList.remove("on"), reload()
                }).catch(function() {});
                return
            }
            if (k === "unclaim") {
                rpc("sc_withdraw").then(function() {
                    say("Claim withdrawn."), $("scSeat").classList.remove("on"), reload()
                }).catch(function() {});
                return
            }
            if (k === "giveup") {
                var go = function() {
                    rpc("sc_retire").then(function() {
                        hum([80]), say("You have stepped down. The seat of " + L + " is open."), ["scSeat", "scChamber"].forEach(function(id) {
                            var e = $(id);
                            e && e.classList.remove("on")
                        });
                        try {
                            floorTrack(typeof CURRENT_ROOM < "u" ? CURRENT_ROOM : null)
                        } catch {}
                        reload()
                    }).catch(function() {})
                };
                try {
                    shConfirm("Retire the seat of " + L + " and step down from the Shadow Council? The seat opens for another " + L + " at once. Your \u269C mark stays with you.", go, {
                        title: "Are you sure?",
                        icon: "\u269C",
                        okText: "Step down"
                    })
                } catch {
                    confirm("Retire the seat of " + L + " and step down?") && go()
                }
                return
            }
        }
    }, !0);
    var CHARTER = [
        ["I \xB7 The Seats", "One seat per letter, twenty-six seats. A seat holder is the representative of their letter on the Council: welcomes them, answers them, and pushes up what they cannot answer. A seat is claimed and seated; it can be given up, and then it stands open for the next casual of that letter."],
        ["II \xB7 Equals at the Table", "Every seat is equal to every other. Members treat one another with respect \u2014 at the table, on the Hall, and on the docks. Disagree with the motion, never the member."],
        ["III \xB7 The Keymaster", "The Keymaster holds the table, not a seat. The Keymaster can decree a motion carried or struck down, appoint the Keeper of the Count, and alone can bring the removal of a council member to a vote."],
        ["IV \xB7 Motions", "Any seat may put a motion. Voting stays open 48 hours, and a majority of the votes cast carries it; a tie fails. The Keeper of the Count seals the vote once it is cast, works the count, and announces the result to the table."],
        ["V \xB7 Bans", "A seat holder may request the ban of a regular member, with the reason. No seat holder may request the ban of another council member. Only the Keymaster may bring that to the table, and it carries at two-thirds vote."],
        ["VI \xB7 Succession", "When the Keymaster moves up to the union, the Keymaster opens the seat. Every seat holder casts one vote for one seat holder. The Keeper of the Count seals the vote, works the count, and announces the new Keymaster to everybody, who welcome them in. Most votes takes the table; a tie goes to a second round between the tied. The new Keymaster then appoints a Keeper of the Count."],
        ["VII \xB7 The Door", "What is said in the Chamber stays in the Chamber. Who sits in it is known to those who do, and worn as a mark."]
    ];

    function openCharter() {
        var sh = sheetEl("scCharter", "sc-sheet", 98),
            w = me();
        sh.innerHTML = '<div class="sheet-card"><button type="button" class="sc-close" data-scx>\u2715</button><div class="sc-h" style="padding-top:14px"><div class="o">The Order of The Shadow Hook</div><div class="k">The Shadow Council</div><div class="t" style="font-size:20px">The Charter</div><div class="s">Keeper of the Count \xB7 ' + esc(SC.teller || "not yet appointed") + '</div></div><div class="sc-rule"></div>' + CHARTER.map(function(c) {
            return '<div class="sc-sec">' + c[0] + '</div><p class="sc-p">' + c[1] + "</p>"
        }).join("") + '<div class="sc-row"><button type="button" class="sc-btn ghost" data-scx>Close</button></div></div>', sh.classList.add("on")
    }
    window.openCharter = openCharter;
    var tab = "table";

    function openChamber(t) {
        var w = me();
        if (!atTable(w)) {
            say("The Chamber opens to seat holders and the Keymaster."), hum([30, 30, 30]);
            return
        }
        t && (tab = t);
        v2CSS();
        var sh = sheetEl("scChamber", "sc-sheet full", 96);
        paintChamber(), sh.classList.add("on"), hum([15, 30, 15]);
        try {
            floorTrack("The Chamber")
        } catch {}
        reload().then(paintChamber)
    }
    window.openShadowCouncil = openChamber;

    function inRoom(h) {
        var w = me();
        if (h === w.handle) return !0;
        try {
            return (window.FLOOR && FLOOR.roster || []).some(function(r) {
                return r.h === h && r.room === "The Chamber"
            })
        } catch {
            return !1
        }
    }

    function floorSVG(w) {
        var rows = [
                [7, 72],
                [9, 108],
                [10, 144]
            ],
            cx = 190,
            cy = 160,
            i = 0,
            out = "";
        rows.forEach(function(r) {
            for (var n = r[0], rad = r[1], k = 0; k < n; k++) {
                var a = Math.PI + Math.PI * (k + .5) / n,
                    x = cx + rad * Math.cos(a),
                    y = cy + rad * Math.sin(a),
                    L = LETTERS[i++],
                    st = SC.seats[L],
                    here = st && inRoom(st.handle);
                out += '<g class="hs' + (st ? " on" : "") + (L === w.seat ? " me" : "") + (here ? " in" : "") + '" transform="translate(' + x.toFixed(1) + "," + y.toFixed(1) + ')"><title>' + (st ? esc(st.handle) + (here ? " \xB7 in the room" : "") : "Seat of " + L + " \xB7 open") + "</title>" + (here ? '<circle class="halo" r="17"/>' : "") + '<circle r="12.5"/><text y="4.5">' + L + "</text></g>"
            }
        });
        var kmHere = inRoom(SC.head.handle);
        out += '<g class="hs head' + (kmHere ? " in" : "") + '" transform="translate(' + cx + "," + cy + ')"><title>The Keymaster \xB7 ' + esc(SC.head.handle) + (kmHere ? " \xB7 in the room" : "") + '</title><path d="M-30 -2 h60 l-6 12 h-48 z"/>' + (kmHere ? '<circle class="halo" r="20" cy="-12"/>' : "") + '<circle r="15" cy="-12"/><text y="-7">\u269C</text></g>';
        var nIn = seated().filter(function(L) {
            return inRoom(SC.seats[L].handle)
        }).length + (kmHere ? 1 : 0);
        return '<svg class="sc-floor" viewBox="0 4 380 174" aria-label="The Chamber floor"><defs><radialGradient id="scGold" cx="35%" cy="30%"><stop offset="0" stop-color="#f1d58e"/><stop offset=".6" stop-color="#d4b36a"/><stop offset="1" stop-color="#8c6f33"/></radialGradient></defs>' + out + "</svg>"
    }

    function fact(v, unit) {
        return v == null || v === "" ? "\u2014" : v + (unit || "")
    }

    function lateQuestions() {
        return SC.inbox.filter(function(x) {
            return x.state === "open" && !x.taken && Date.now() - x.at > SC.lateAfter
        })
    }

    function openJobs() {
        return SC.jobs.filter(function(j) {
            return j.state === "open"
        }).concat(lateQuestions().map(function(x) {
            return {
                id: "q:" + x.id,
                title: "Answer a late question on " + x.letter,
                body: esc(x.from) + ": " + esc(x.body),
                bucks: 10,
                by: "the line",
                at: x.at,
                state: "open",
                late: !0
            }
        }))
    }

    function jobCard(j, w) {
        var st = j.state === "open" ? "open" : j.state === "taken" ? "taken \xB7 " + esc(j.taker) : j.state === "done" ? "done \xB7 " + esc(j.taker) + " \xB7 awaiting pay" : "paid \xB7 " + esc(j.taker),
            h = '<div class="sc-mo"><div class="k"><span>' + (j.late ? "\u23F1 Late question" : "\u2692 Job") + " \xB7 " + esc(j.by) + '</span><em class="' + (j.state === "paid" ? "carried" : "") + '">' + st + '</em></div><div class="t">' + esc(j.title) + ' <span style="color:var(--sc-gold-hi);white-space:nowrap">\xB7 ' + j.bucks + ' \u2693</span></div><div class="b">' + j.body + "</div>",
            act = "";
        return j.state === "open" && !w.head && (act = '<button type="button" data-scj="take" data-c="' + j.id + '">Take it</button>'), j.state === "taken" && j.taker === w.handle && (act = '<button type="button" class="on" data-scj="done" data-c="' + j.id + '">Mark it done</button>'), j.state === "done" && w.head && (act = '<button type="button" class="on" data-scj="pay" data-c="' + j.id + '">Pay ' + j.bucks + " \u2693 to " + esc(j.taker) + "</button>"), h + (act ? '<div class="sc-vote">' + act + "</div>" : "") + "</div>"
    }


/* ===== CSS v2 (appended after the existing shadowCouncilCSS) ===== */
function v2CSS(){
  if($("scV2CSS"))return;
  var st=document.createElement("style");st.id="scV2CSS";
  st.textContent=[
    "#scChamber .sheet-card{padding:10px 14px calc(8px + env(safe-area-inset-bottom) + var(--kb,0px))}",
    "#scChamber .sc-h2{display:flex;align-items:center;gap:10px;padding:2px 0 0;text-align:left}",
    "#scChamber .sc-h2 .crest{flex:none;width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:17px;color:var(--sc-velvet);background:radial-gradient(circle at 35% 30%,#fff2c8,var(--sc-gold-hi) 50%,#9a7a3a);box-shadow:0 0 0 2px var(--sc-velvet),0 0 0 3px var(--sc-gold-lo),0 6px 16px rgba(0,0,0,.5)}",
    "#scChamber .sc-h2 h1{margin:0;font-family:Cinzel,serif;font-weight:700;font-size:18px;letter-spacing:.09em;color:var(--sc-gold-hi);text-shadow:0 1px 0 #000,0 0 18px rgba(212,179,106,.3);line-height:1.05}",
    "#scChamber .sc-h2 .who{font-family:'Barlow Condensed',sans-serif;font-size:13px;color:var(--sc-dim);margin-top:2px}#scChamber .sc-h2 .who b{color:var(--sc-ink);font-weight:600}",
    "#scChamber .sc-close{position:static;margin-left:auto;top:auto;right:auto}",
    "#scChamber .sc-tools{display:flex;gap:6px;margin:9px -14px 0;padding:0 14px;overflow-x:auto;scrollbar-width:none}#scChamber .sc-tools::-webkit-scrollbar{display:none}",
    "#scChamber .sc-chip{font-family:Cinzel,serif;font-weight:700;font-size:9.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--sc-gold);border:1px solid var(--sc-gold-lo);border-radius:999px;padding:5px 10px;background:none;cursor:pointer;white-space:nowrap}",
    "#scChamber .sc-chip.on{background:rgba(212,179,106,.14);color:var(--sc-gold-hi);border-color:var(--sc-gold)}",
    "#scChamber .sc-floorwrap{overflow:hidden;max-height:0;transition:max-height .35s ease;margin:0 -14px}#scChamber .sc-floorwrap.on{max-height:210px}",
    "#scChamber .sc-floor{max-width:400px;margin:4px auto 0}",
    "#scChamber .sc-pv{margin:8px 0 0}",
    "#scChamber .sc-tabs{background:none;border:0;border-bottom:1px solid var(--sc-gold-lo);border-radius:0;padding:0;gap:0;margin:10px 0 0}",
    "#scChamber .sc-tabs button{padding:10px 0 11px;border-radius:0;font-size:10.5px;letter-spacing:.14em;white-space:nowrap}",
    "#scChamber .sc-tabs button.on{background:none;color:var(--sc-gold-hi);position:relative}",
    "#scChamber .sc-tabs button.on:after{content:'';position:absolute;left:18%;right:18%;bottom:-1px;height:2px;background:linear-gradient(90deg,transparent,var(--sc-gold-hi),transparent)}",
    "#scChamber .sc-tabs button i{position:static;display:inline-block;vertical-align:top;margin:-3px 0 0 4px;box-shadow:none}",
    "#scChamber .sc-body{padding:10px 0 14px}",
    "#scChamber .sc-sec em{font-style:normal;color:var(--sc-dim);letter-spacing:.06em;font-family:'Barlow Condensed',sans-serif;font-size:12px;text-transform:none}",
    "#scChamber .sc-day{display:flex;align-items:center;gap:10px;margin:12px 0 8px;color:rgba(239,227,200,.3);font:600 10.5px Inter,sans-serif;letter-spacing:.2em;text-transform:uppercase}#scChamber .sc-day:before,#scChamber .sc-day:after{content:'';flex:1;height:1px;background:rgba(212,179,106,.14)}",
    "#scChamber .sc-msg{border-bottom:0;padding:7px 0;display:grid;grid-template-columns:34px 1fr}#scChamber .sc-msg .av{width:34px;height:34px}#scChamber .sc-msg .av.sys{background:none;border:1px dashed var(--sc-gold-lo);color:var(--sc-gold)}",
    "#scChamber .sc-msg .who{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}#scChamber .sc-msg .who span{margin:0}#scChamber .sc-msg .who span.role{color:var(--sc-gold);text-transform:uppercase;font-weight:600;font-size:9px;letter-spacing:.14em}",
    "#scChamber .sc-msg .bd{font-size:15.5px;white-space:pre-wrap;word-break:break-word}#scChamber .sc-msg .bd a{color:var(--sc-gold-hi);text-decoration:underline;text-decoration-color:var(--sc-gold-lo);text-underline-offset:2px}#scChamber .sc-msg .bd .at{color:var(--sc-gold-hi);font-weight:600;background:rgba(212,179,106,.14);border-radius:5px;padding:0 4px}",
    "#scChamber .sc-msg.sys .bd{color:var(--sc-dim);font-style:italic;font-size:14px}",
    ".sc-att{margin-top:8px;border-radius:12px;overflow:hidden;border:1px solid var(--sc-gold-lo);background:rgba(0,0,0,.3)}",
    ".sc-att.img{display:grid;gap:2px;max-width:320px}.sc-att.img.two{grid-template-columns:1fr 1fr}.sc-att.img .ph{aspect-ratio:4/3;background:#1d0a10;cursor:zoom-in;position:relative}.sc-att.img.one .ph{aspect-ratio:16/10}.sc-att.img .ph img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}",
    ".sc-att.video{position:relative;aspect-ratio:16/9;background:#07030a;cursor:pointer}.sc-att.video img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}.sc-att.video .play{position:absolute;left:50%;top:50%;width:62px;height:44px;margin:-22px 0 0 -31px;border-radius:12px;background:#8f1d2c;box-shadow:0 8px 24px rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center}.sc-att.video .play:after{content:'';border-style:solid;border-width:9px 0 9px 16px;border-color:transparent transparent transparent #fff;margin-left:3px}",
    ".sc-att.video .cap{position:absolute;left:0;right:0;bottom:0;padding:26px 12px 10px;background:linear-gradient(transparent,rgba(0,0,0,.85));font:12px Inter,sans-serif;color:#fff}.sc-att.video .cap small{display:block;color:rgba(255,255,255,.6);font-size:10px;letter-spacing:.1em;text-transform:uppercase;margin-bottom:2px}.sc-att.video iframe{position:absolute;inset:0;width:100%;height:100%;border:0}",
    ".sc-att.link{display:grid;grid-template-columns:1fr 64px;text-decoration:none;color:inherit}.sc-att.link .t{padding:9px 11px;min-width:0}.sc-att.link .t small{display:block;font:10px Inter,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:var(--sc-gold);margin-bottom:3px}.sc-att.link .t b{display:block;font:600 13px Inter,sans-serif;color:var(--sc-ink);line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.sc-att.link .t span{display:block;font-family:'Barlow Condensed',sans-serif;font-size:12.5px;color:var(--sc-dim);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.sc-att.link .ico{background:var(--sc-velvet2);display:flex;align-items:center;justify-content:center;font-size:22px;border-left:1px solid var(--sc-gold-lo)}",
    ".sc-att.file{display:flex;align-items:center;gap:10px;padding:9px 11px;text-decoration:none;color:inherit}.sc-att.file i{font-style:normal;width:36px;height:36px;border-radius:8px;background:var(--sc-velvet2);display:flex;align-items:center;justify-content:center;font:700 10px Inter,sans-serif;color:var(--sc-gold-hi);border:1px solid var(--sc-gold-lo)}.sc-att.file b{display:block;font:600 13px Inter,sans-serif;color:var(--sc-ink);word-break:break-all}.sc-att.file span{font-family:'Barlow Condensed',sans-serif;font-size:12px;color:var(--sc-dim)}",
    "#scChamber .sc-compose{flex-wrap:wrap;gap:8px;padding-top:8px;margin-top:4px}#scChamber .sc-compose .sc-in{flex:1;min-height:40px;max-height:110px;border-radius:12px}",
    "#scChamber .sc-plus{flex:none;width:40px;height:40px;border-radius:50%;border:1px solid var(--sc-gold-lo);background:rgba(0,0,0,.3);color:var(--sc-gold);font-size:22px;line-height:1;cursor:pointer}#scChamber .sc-compose .sc-btn{height:40px;padding:0 16px}",
    "#scChamber .sc-tray{display:none;width:100%;gap:8px}#scChamber .sc-tray.on{display:flex}#scChamber .sc-tray label,#scChamber .sc-tray button{flex:1;padding:9px 4px;border-radius:10px;border:1px solid var(--sc-gold-lo);background:rgba(0,0,0,.3);color:var(--sc-ink);font:500 12.5px 'Barlow Condensed',sans-serif;cursor:pointer;text-align:center}#scChamber .sc-tray i{display:block;font-style:normal;font-size:18px;margin-bottom:2px}",
    "#scChamber .sc-pend{display:flex;gap:6px;flex-wrap:wrap;width:100%}#scChamber .sc-pend:empty{display:none}#scChamber .sc-pend span{display:inline-flex;align-items:center;gap:6px;padding:4px 8px 4px 6px;border-radius:8px;background:rgba(212,179,106,.14);border:1px solid var(--sc-gold-lo);font-family:'Barlow Condensed',sans-serif;font-size:12.5px;color:var(--sc-ink);max-width:100%}#scChamber .sc-pend span i{font-style:normal;flex:none}#scChamber .sc-pend span em{font-style:normal;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}#scChamber .sc-pend span b{color:var(--sc-gold);cursor:pointer;font-weight:400;margin-left:2px;flex:none}#scChamber .sc-pend span.up{opacity:.6}",
    ".sc-lb{position:fixed;inset:0;z-index:99990;background:#000;display:flex;align-items:center;justify-content:center}.sc-lb img{max-width:100%;max-height:100%}.sc-lb button{position:absolute;top:calc(14px + env(safe-area-inset-top));right:14px;width:36px;height:36px;border-radius:50%;border:1px solid rgba(255,255,255,.3);background:rgba(0,0,0,.5);color:#fff;font-size:16px}",
    /* motions */
    "#scChamber .sc-bar u{position:absolute;right:0;top:0;bottom:0;background:rgba(224,122,110,.5)}#scChamber .sc-bar i{background:#fff;opacity:.8}",
    "#scChamber .sc-voters{display:flex;gap:4px;flex-wrap:wrap;margin-top:8px}#scChamber .sc-voters i{font-style:normal;width:22px;height:22px;border-radius:6px;display:inline-flex;align-items:center;justify-content:center;font:700 10px Cinzel,serif;color:var(--sc-velvet);background:var(--sc-gold)}#scChamber .sc-voters i.n{background:#e07a6e;color:#fff}#scChamber .sc-voters i.p{background:transparent;color:var(--sc-dim);border:1px solid var(--sc-gold-lo)}#scChamber .sc-voters i.w{background:transparent;color:rgba(239,227,200,.3);border:1px dashed rgba(212,179,106,.25)}",
    "#scChamber .sc-vote button.aye.on{background:linear-gradient(180deg,#b7ff3d,#5f8f1f);color:#0b1204;border-color:#dfff9a}#scChamber .sc-vote button.nay.on{background:linear-gradient(180deg,#ff6b6b,#a31d1d);color:#1a0404;border-color:#ffb0b0}",
    /* jobs */
    ".sc-ledger{display:grid;grid-template-columns:1fr 1fr 1fr;gap:7px;margin:0 0 6px}.sc-ledger div{border:1px solid var(--sc-gold-lo);border-radius:11px;padding:9px 6px;text-align:center;background:rgba(0,0,0,.28)}.sc-ledger b{display:block;font:700 19px Cinzel,serif;color:var(--sc-gold-hi)}.sc-ledger span{font:8.5px Inter,sans-serif;letter-spacing:.14em;color:var(--sc-dim);text-transform:uppercase}",
    ".sc-job{border:1px solid var(--sc-gold-lo);border-radius:14px;margin:0 0 10px;background:rgba(0,0,0,.26);overflow:hidden}.sc-job.due{border-color:rgba(241,213,142,.7);box-shadow:0 0 0 1px rgba(241,213,142,.15),0 0 22px rgba(241,213,142,.12)}.sc-job.live{border-color:rgba(159,208,138,.55);box-shadow:0 0 18px rgba(159,208,138,.1)}",
    ".sc-job .hd{display:flex;align-items:center;gap:10px;padding:11px 13px;cursor:pointer}.sc-job .ic{flex:none;width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:17px;background:var(--sc-velvet2);border:1px solid var(--sc-gold-lo)}.sc-job.due .ic{background:linear-gradient(160deg,var(--sc-gold-hi),var(--sc-gold));border-color:var(--sc-gold-hi)}.sc-job.live .ic{background:rgba(159,208,138,.15);border-color:#9fd08a}",
    ".sc-job .hd .n{flex:1;min-width:0}.sc-job .hd .n b{display:block;font:700 13px Cinzel,serif;letter-spacing:.06em;color:var(--sc-gold-hi)}.sc-job .hd .n span{display:block;font-family:'Barlow Condensed',sans-serif;font-size:13px;color:var(--sc-dim);line-height:1.3;margin-top:1px}.sc-job .hd .n span.hot{color:var(--sc-ink)}",
    ".sc-job .pay{flex:none;text-align:right;font:700 13px Cinzel,serif;color:var(--sc-gold-hi)}.sc-job .pay small{display:block;font:600 8.5px Inter,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:var(--sc-dim)}.sc-job .free{font:8.5px Inter,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#9fd08a;border:1px solid rgba(159,208,138,.4);border-radius:999px;padding:3px 7px}",
    ".sc-job .st{display:flex;align-items:center;padding:0 13px 12px}.sc-job .st i{flex:none;width:22px;height:22px;border-radius:50%;border:1px solid var(--sc-gold-lo);display:flex;align-items:center;justify-content:center;font:700 10px Inter,sans-serif;font-style:normal;color:var(--sc-dim)}.sc-job .st i.ok{background:var(--sc-gold);color:var(--sc-velvet);border-color:var(--sc-gold)}.sc-job .st i.now{border-color:var(--sc-gold-hi);color:var(--sc-gold-hi);box-shadow:0 0 0 3px rgba(241,213,142,.15)}.sc-job .st s{flex:1;height:1px;background:var(--sc-gold-lo);text-decoration:none}.sc-job .st s.ok{background:var(--sc-gold)}.sc-job .st span{flex:none;font:9px Inter,sans-serif;letter-spacing:.1em;text-transform:uppercase;color:var(--sc-dim);margin:0 6px}.sc-job .st span.ok{color:var(--sc-gold)}.sc-job .st span.now{color:var(--sc-gold-hi)}",
    ".sc-job .bx{display:none;padding:0 13px 13px;border-top:1px solid rgba(212,179,106,.14)}.sc-job.open .bx{display:block}",
    ".sc-step{display:grid;grid-template-columns:24px 1fr;gap:10px;align-items:start;padding:11px 0 0}.sc-step i{width:24px;height:24px;border-radius:50%;background:var(--sc-gold);color:var(--sc-velvet);font:700 12px Inter,sans-serif;font-style:normal;display:flex;align-items:center;justify-content:center;margin-top:1px}.sc-step i.ok{background:transparent;border:1px solid var(--sc-gold);color:var(--sc-gold)}.sc-step .l{font-family:'Barlow Condensed',sans-serif;font-size:15px;color:var(--sc-ink);line-height:1.35}.sc-step .l small{display:block;font-size:12.5px;color:var(--sc-dim);margin-top:1px}.sc-step .sc-btn{display:block;width:100%;margin-top:7px;box-sizing:border-box}",
    ".sc-rules{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin:10px 0 0}.sc-rules div{border:1px solid var(--sc-gold-lo);border-radius:9px;padding:7px 4px;text-align:center;background:rgba(0,0,0,.25)}.sc-rules b{display:block;font:700 13px Cinzel,serif;color:var(--sc-gold-hi)}.sc-rules b.off{color:var(--sc-dim)}.sc-rules b.ok{color:#9fd08a}.sc-rules span{font:8px Inter,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:var(--sc-dim)}",
    ".sc-pulse{display:inline-block;width:7px;height:7px;border-radius:50%;background:#9fd08a;box-shadow:0 0 8px #9fd08a;margin-right:5px;animation:scPl 1.4s ease-in-out infinite}@keyframes scPl{50%{opacity:.35}}",
    ".sc-btn.big{padding:15px 10px;font-size:12.5px;width:100%;box-sizing:border-box}.sc-btn.live{background:linear-gradient(180deg,#b7ff3d,#5f8f1f);color:#0b1204;border-color:#dfff9a;box-shadow:0 2px 0 #3b5a12}",
    ".sc-drop{margin-top:8px;border:1.5px dashed var(--sc-gold-lo);border-radius:12px;padding:18px 12px;text-align:center;color:var(--sc-dim);font-family:'Barlow Condensed',sans-serif;font-size:14px;cursor:pointer;display:block}.sc-drop b{display:block;color:var(--sc-gold-hi);font:700 11px Cinzel,serif;letter-spacing:.14em;margin-bottom:3px}",
    ".sc-proof{margin:10px 0 0;padding:10px 12px;border-radius:10px;background:rgba(159,208,138,.07);border:1px solid rgba(159,208,138,.3);font-family:'Barlow Condensed',sans-serif;font-size:13.5px;color:var(--sc-ink);line-height:1.4}.sc-proof b{color:#9fd08a;font:10px Inter,sans-serif;letter-spacing:.14em;text-transform:uppercase;display:block;margin-bottom:2px}.sc-proof.warn{background:rgba(224,122,110,.07);border-color:rgba(224,122,110,.35)}.sc-proof.warn b{color:#e07a6e}",
    ".sc-away{display:flex;align-items:center;gap:10px;padding:9px 11px;border:1px solid rgba(212,179,106,.2);border-radius:11px;margin:0 0 7px;background:rgba(0,0,0,.18);opacity:.9}.sc-away .ic{flex:none;width:30px;height:30px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:14px;background:var(--sc-velvet2);border:1px solid var(--sc-gold-lo)}.sc-away .d{flex:1;min-width:0;font-family:'Barlow Condensed',sans-serif;font-size:14px;color:var(--sc-ink)}.sc-away .d small{display:block;font-size:12px;color:var(--sc-dim)}.sc-away .d small.ok{color:#9fd08a}.sc-away label,.sc-away button{flex:none;font:700 9.5px Cinzel,serif;letter-spacing:.08em;padding:7px 9px;border-radius:7px;border:1px solid var(--sc-gold-lo);background:transparent;color:var(--sc-gold);cursor:pointer;white-space:nowrap}.sc-away em{flex:none;font-style:normal;font:700 12px Cinzel,serif;color:#9fd08a}",
    ".sc-jrow{display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid rgba(212,179,106,.12);font-family:'Barlow Condensed',sans-serif;font-size:14px}.sc-jrow .L{flex:none;width:28px;height:28px;border-radius:8px;display:flex;align-items:center;justify-content:center;font:700 12px Cinzel,serif;color:var(--sc-velvet);background:linear-gradient(160deg,var(--sc-gold-hi),var(--sc-gold))}.sc-jrow .d{flex:1;min-width:0}.sc-jrow .d small{display:block;font-size:12px;color:var(--sc-dim)}.sc-jrow em{font-style:normal;font:700 12px Cinzel,serif;color:var(--sc-gold-hi)}.sc-jrow em.paid{color:#9fd08a}.sc-jrow .sc-btn{padding:8px 10px;font-size:10px}",
    /* desk */
    ".sc-elec{border:1px solid var(--sc-gold-lo);border-radius:14px;margin:0 0 18px;background:rgba(0,0,0,.26);overflow:hidden}.sc-elec .hd{display:flex;align-items:center;gap:10px;padding:11px 13px 9px;border-bottom:1px solid rgba(212,179,106,.14)}.sc-elec .seat{flex:none;width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;font:800 17px Cinzel,serif;color:var(--sc-velvet);background:radial-gradient(circle at 35% 30%,var(--sc-gold-hi),var(--sc-gold) 60%,#8c6f33);box-shadow:inset 0 1px 0 rgba(255,255,255,.5)}",
    ".sc-elec .hd .n b{display:block;font:700 13px Cinzel,serif;letter-spacing:.06em;color:var(--sc-gold-hi)}.sc-elec .hd .n span{font-family:'Barlow Condensed',sans-serif;font-size:13px;color:var(--sc-dim)}.sc-elec .hd .n span u{text-decoration:none;color:var(--sc-ink)}.sc-elec .turnout{margin-left:auto;text-align:right}.sc-elec .turnout b{display:block;font:700 15px Cinzel,serif;color:var(--sc-gold-hi)}.sc-elec .turnout small{font:8.5px Inter,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:var(--sc-dim)}",
    ".sc-elec .note{margin:0;padding:8px 13px;background:rgba(224,122,110,.08);border-bottom:1px solid rgba(224,122,110,.25);font-family:'Barlow Condensed',sans-serif;font-size:13px;color:#ffc9c0;line-height:1.35}.sc-elec .note b{font:9.5px Inter,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#e07a6e;display:block;margin-bottom:1px}",
    ".sc-elec .body{padding:10px 10px 4px;background:rgba(0,0,0,.18)}",
    ".sc-cand{margin:0 0 10px;border:1px solid rgba(212,179,106,.45);border-radius:12px;background:linear-gradient(180deg,rgba(74,21,39,.55),rgba(0,0,0,.35));overflow:hidden;box-shadow:0 6px 18px rgba(0,0,0,.35)}.sc-cand:last-of-type{margin-bottom:6px}",
    ".sc-cand .top{display:flex;align-items:center;gap:10px;padding:10px 12px;background:linear-gradient(90deg,rgba(212,179,106,.18),rgba(212,179,106,.03));border-bottom:1px solid var(--sc-gold-lo)}",
    ".sc-cand .pav{flex:none;width:46px;height:46px;border-radius:50%;overflow:hidden;background:#1d0a10;border:1.5px solid var(--sc-gold);display:flex;align-items:center;justify-content:center;font:700 19px Cinzel,serif;color:var(--sc-gold);cursor:pointer;position:relative;box-shadow:0 0 0 2px var(--sc-velvet),0 0 0 3px var(--sc-gold-lo)}.sc-cand .pav img{width:100%;height:100%;object-fit:cover;display:block}.sc-cand .pav.none{border-style:dashed;color:var(--sc-gold-lo)}.sc-cand .pav.km:after{content:'+';position:absolute;right:-3px;bottom:-3px;width:16px;height:16px;border-radius:50%;background:var(--sc-gold);color:var(--sc-velvet);font:700 12px/16px Inter,sans-serif;text-align:center}",
    ".sc-cand .nmw{flex:1;min-width:0}.sc-cand .nmw b{display:block;font:700 15px Cinzel,serif;color:var(--sc-gold-hi);line-height:1.15;cursor:pointer}.sc-cand .nmw small{display:block;font:400 11px Inter,sans-serif;color:var(--sc-dim);margin-top:2px}",
    ".sc-cand .lead{flex:none;text-align:center;min-width:44px}.sc-cand .lead b{display:block;font:700 22px Cinzel,serif;color:var(--sc-gold-hi);line-height:1}.sc-cand .lead span{font:7.5px Inter,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:var(--sc-dim)}",
    ".sc-cand .bd{padding:8px 12px 10px}",
    ".sc-cand .vbar{height:5px;border-radius:4px;background:rgba(0,0,0,.45);margin:0 0 9px;overflow:hidden}.sc-cand .vbar b{display:block;height:100%;background:linear-gradient(90deg,#8c6f33,var(--sc-gold-hi))}",
    ".sc-cand .facts{display:grid;grid-template-columns:repeat(4,1fr);gap:4px;margin:0 0 4px}.sc-cand .facts span{display:flex;flex-direction:column;text-align:center;font:7.5px Inter,sans-serif;letter-spacing:.06em;text-transform:uppercase;color:var(--sc-dim);line-height:1.2}.sc-cand .facts b{font:700 13.5px Cinzel,serif;color:var(--sc-gold-hi);margin-bottom:2px}",
    ".sc-cand .sub{font:700 9px Cinzel,serif;letter-spacing:.22em;text-transform:uppercase;color:var(--sc-gold);margin:12px 0 5px;display:flex;align-items:center;gap:8px}.sc-cand .sub:after{content:'';flex:1;height:1px;background:rgba(212,179,106,.2)}",
    ".sc-cand .about{font-family:'Barlow Condensed',sans-serif;font-size:14px;color:var(--sc-ink);line-height:1.4}.sc-cand .about em{font-style:italic}.sc-cand .about .none{color:rgba(239,227,200,.35)}",
    ".sc-cand .sc-grp{margin:0}.sc-cand .sc-vote{margin-top:12px}",
    ".sc-cand .note{font-family:'Barlow Condensed',sans-serif;font-size:14px;color:var(--sc-ink);margin:4px 0 2px;font-style:italic}",
    ".sc-prof{display:grid;grid-template-columns:56px 1fr;gap:10px;margin:8px 0 2px;padding:9px;border-radius:12px;border:1px solid var(--sc-gold-lo);background:rgba(0,0,0,.25)}.sc-prof .pic{width:56px;height:56px;border-radius:10px;overflow:hidden;background:#1d0a10;border:1px solid var(--sc-gold-lo)}.sc-prof .pic img{width:100%;height:100%;object-fit:cover;display:block}.sc-prof .pic.none{display:flex;align-items:center;justify-content:center;font:700 20px Cinzel,serif;color:var(--sc-gold-lo);border-style:dashed}.sc-prof .i{min-width:0;font-family:'Barlow Condensed',sans-serif;font-size:13.5px;line-height:1.35;color:var(--sc-ink)}.sc-prof .i b{display:block;font:600 12.5px Inter,sans-serif;color:var(--sc-ink)}.sc-prof .i span{display:block;color:var(--sc-dim)}.sc-prof .i em{display:block;font-style:italic;color:var(--sc-ink);margin-top:2px}",
    ".sc-fb{display:inline-flex;align-items:center;gap:6px;margin:6px 0 0;padding:4px 9px 4px 5px;border-radius:999px;border:1px solid rgba(66,103,178,.55);background:rgba(66,103,178,.14);color:#cfe0ff;font:600 12px Inter,sans-serif;cursor:pointer;text-decoration:none}.sc-fb i{font-style:normal;width:18px;height:18px;border-radius:50%;background:#4267b2;color:#fff;display:inline-flex;align-items:center;justify-content:center;font:800 12px Inter,sans-serif}.sc-fb.none{border-style:dashed;border-color:var(--sc-gold-lo);background:none;color:var(--sc-dim)}",
    ".sc-grp{margin:8px 0 2px;border:1px solid var(--sc-gold-lo);border-radius:10px;overflow:hidden}.sc-grp .g{display:flex;align-items:center;gap:8px;padding:7px 10px;font-family:'Barlow Condensed',sans-serif;font-size:13px;color:var(--sc-ink);border-bottom:1px solid rgba(212,179,106,.12)}.sc-grp .g:last-of-type{border-bottom:0}.sc-grp .g i{flex:none;font-style:normal;width:20px;height:20px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font:700 11px Inter,sans-serif}.sc-grp .g i.y{background:rgba(159,208,138,.18);color:#9fd08a;border:1px solid rgba(159,208,138,.5)}.sc-grp .g i.n{background:rgba(224,122,110,.14);color:#ffb3a8;border:1px solid rgba(224,122,110,.5)}.sc-grp .g i.q{background:rgba(212,179,106,.14);color:var(--sc-gold-hi);border:1px solid var(--sc-gold-lo)}.sc-grp .g i.o{color:rgba(239,227,200,.3);border:1px dashed rgba(212,179,106,.3)}",
    ".sc-grp .g b{font:600 12px Inter,sans-serif;color:var(--sc-ink);flex:1;min-width:0}.sc-grp .g b small{display:block;font:400 11.5px 'Barlow Condensed',sans-serif;color:var(--sc-dim)}.sc-grp .mk{display:flex;gap:3px}.sc-grp .mk button{width:26px;height:24px;border-radius:6px;border:1px solid var(--sc-gold-lo);background:none;color:var(--sc-gold);font:700 11px Inter,sans-serif;cursor:pointer}.sc-grp .mk button.on{background:var(--sc-gold);color:var(--sc-velvet)}.sc-grp .g a.go{font:600 11px Inter,sans-serif;color:var(--sc-gold);text-decoration:none;border:1px solid var(--sc-gold-lo);border-radius:6px;padding:4px 7px;white-space:nowrap}.sc-grp .by{padding:5px 10px;font-family:'Barlow Condensed',sans-serif;font-size:11.5px;color:var(--sc-dim);background:rgba(0,0,0,.2)}",
    ".sc-elec .foot{padding:10px 13px 12px;border-top:1px solid rgba(212,179,106,.14)}.sc-elec .foot .sc-row{margin-top:0}.sc-btn.sm{padding:8px 10px;font-size:10px}",
    ".sc-mycard{border:1px solid var(--sc-gold-lo);border-radius:12px;padding:10px 12px;margin:0 0 10px;background:rgba(0,0,0,.25)}.sc-mycard .sc-in{margin-bottom:8px}",
    /* re-vote dialog */
    "#scRevote{position:fixed;inset:0;z-index:99980;background:rgba(5,2,4,.78);display:none;align-items:flex-end;justify-content:center;padding:12px}#scRevote.on{display:flex}@media(min-width:560px){#scRevote{align-items:center}}",
    "#scRevote .card{width:100%;max-width:420px;border-radius:18px;padding:16px 15px 14px;background:linear-gradient(180deg,var(--sc-velvet3),#170509);border:1px solid var(--sc-gold);box-shadow:0 0 0 4px rgba(212,179,106,.1),0 18px 50px rgba(0,0,0,.7);color:var(--sc-ink)}#scRevote h2{margin:0 0 4px;font:700 16px Cinzel,serif;letter-spacing:.06em;color:var(--sc-gold-hi)}#scRevote label{display:flex;gap:10px;align-items:flex-start;padding:9px 10px;border:1px solid var(--sc-gold-lo);border-radius:10px;margin:0 0 7px;font-family:'Barlow Condensed',sans-serif;font-size:14px;line-height:1.35;cursor:pointer}#scRevote label input{margin-top:3px;accent-color:var(--sc-gold)}#scRevote label small{display:block;color:var(--sc-dim);font-size:12.5px}",
    /* herald */
    ".sc-herald{position:fixed;left:12px;right:12px;top:calc(var(--tbH,49px) + 8px);z-index:99970;display:flex;align-items:center;gap:12px;padding:10px 14px 10px 10px;border-radius:14px;background:linear-gradient(180deg,#3b1020,#1a0609);border:1px solid var(--sc-gold);box-shadow:0 0 0 1px rgba(0,0,0,.6),0 0 0 2px var(--sc-gold-lo),0 18px 40px rgba(0,0,0,.65),inset 0 1px 0 rgba(241,213,142,.35);opacity:0;transform:translateY(-16px) scale(.98);pointer-events:none;transition:opacity .45s ease,transform .6s cubic-bezier(.2,.9,.3,1);max-width:440px;margin:0 auto}",
    ".sc-herald.on{opacity:1;transform:none}.sc-herald:before{content:'';position:absolute;inset:4px;border:1px solid rgba(212,179,106,.25);border-radius:11px;pointer-events:none}",
    ".sc-herald .seal{flex:none;width:46px;height:46px;border-radius:50%;display:flex;align-items:center;justify-content:center;font:800 19px Cinzel,serif;color:var(--sc-velvet);background:radial-gradient(circle at 35% 30%,#fff2c8,var(--sc-gold-hi) 50%,#8c6f33);box-shadow:0 0 0 2px var(--sc-velvet),0 0 0 3px var(--sc-gold),0 0 26px rgba(241,213,142,.55);position:relative}.sc-herald .seal:after{content:'';position:absolute;inset:-8px;border-radius:50%;border:1px solid var(--sc-gold-hi);opacity:0}.sc-herald.on .seal:after{animation:scRing 1.6s ease-out .15s 2}@keyframes scRing{0%{transform:scale(.7);opacity:.9}100%{transform:scale(1.5);opacity:0}}",
    ".sc-herald .k{font:600 9px Cinzel,serif;letter-spacing:.36em;text-transform:uppercase;color:var(--sc-gold);padding-left:.36em}.sc-herald .n{font:700 16.5px Cinzel,serif;letter-spacing:.04em;line-height:1.15;margin:2px 0 1px;background:linear-gradient(180deg,#fff7dc 0%,#f1d58e 40%,#c9a24f 65%,#f6dfa0 100%);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 1px 0 #000)}.sc-herald .s{font-family:'Barlow Condensed',sans-serif;font-size:12.5px;letter-spacing:.08em;color:var(--sc-dim)}.sc-herald .s b{color:var(--sc-ink);font-weight:600}",
    ".sc-herald .glint{position:absolute;inset:0;border-radius:14px;overflow:hidden;pointer-events:none}.sc-herald .glint:after{content:'';position:absolute;top:0;bottom:0;width:40%;background:linear-gradient(105deg,transparent 30%,rgba(255,244,210,.22) 50%,transparent 70%);transform:translateX(-160%)}.sc-herald.on .glint:after{animation:scGlint 1.3s ease-in-out .35s both}@keyframes scGlint{to{transform:translateX(320%)}}",
    ".sc-floor .hs.arrive>circle:not(.halo){stroke:#fff4d2;stroke-width:2.2;filter:drop-shadow(0 0 6px #f1d58e)}",
    "#scChamber .sc-msg .av img{width:100%;height:100%;object-fit:cover;border-radius:50%;display:block}#scChamber .sc-msg .av,#scChamber .sc-msg .who b,#scChamber .sc-li[data-scpp],#scChamber .sc-cand .top b{cursor:pointer}",
    "#scProfile .sheet-card{max-width:460px}",
    ".sc-pp{text-align:center;padding:4px 0 0}.sc-pp .ph{width:120px;height:120px;border-radius:50%;margin:0 auto 10px;overflow:hidden;background:#1d0a10;border:2px solid var(--sc-gold);box-shadow:0 0 0 4px var(--sc-velvet),0 0 0 5px var(--sc-gold-lo),0 10px 30px rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;font:700 44px Cinzel,serif;color:var(--sc-gold-lo)}.sc-pp .ph img{width:100%;height:100%;object-fit:cover;display:block}",
    ".sc-pp .nm{font:700 20px Cinzel,serif;letter-spacing:.04em;color:var(--sc-gold-hi);text-shadow:0 1px 0 #000}.sc-pp .rl{font:600 10px Cinzel,serif;letter-spacing:.3em;text-transform:uppercase;color:var(--sc-gold);margin:4px 0 2px}.sc-pp .hd{font-family:'Barlow Condensed',sans-serif;font-size:13px;color:var(--sc-dim)}",
    ".sc-pp .bio{font-family:'Barlow Condensed',sans-serif;font-size:15px;font-style:italic;color:var(--sc-ink);margin:10px 12px 0;line-height:1.4}",
    ".sc-pstats{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin:14px 0 4px}.sc-pstats div{border:1px solid var(--sc-gold-lo);border-radius:11px;padding:9px 4px;text-align:center;background:rgba(0,0,0,.28)}.sc-pstats b{display:block;font:700 16px Cinzel,serif;color:var(--sc-gold-hi)}.sc-pstats span{font:7.5px Inter,sans-serif;letter-spacing:.12em;color:var(--sc-dim);text-transform:uppercase;line-height:1.2;display:block}",
    ".sc-pline{display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(212,179,106,.1);font-family:'Barlow Condensed',sans-serif;font-size:14px;color:var(--sc-ink)}.sc-pline i{font-style:normal;width:26px;text-align:center;color:var(--sc-gold)}.sc-pline a{color:var(--sc-gold-hi)}.sc-pline small{color:var(--sc-dim);margin-left:auto}",
    ".sc-pedit .ph{width:84px;height:84px;border-radius:50%;overflow:hidden;background:#1d0a10;border:1.5px dashed var(--sc-gold-lo);display:flex;align-items:center;justify-content:center;font:700 30px Cinzel,serif;color:var(--sc-gold-lo);cursor:pointer;margin:0 auto 4px;position:relative}.sc-pedit .ph img{width:100%;height:100%;object-fit:cover}.sc-pedit .ph.up{opacity:.5}.sc-pedit .phl{display:block;text-align:center;font:700 9.5px Cinzel,serif;letter-spacing:.14em;color:var(--sc-gold);margin:0 0 10px;cursor:pointer}",
    "@media (prefers-reduced-motion:reduce){.sc-herald,.sc-pulse,.sc-floorwrap{transition:none;animation:none}}"
  ].join("\n");
  document.head.appendChild(st);
}

/* ===== names (real names only inside the Chamber) ===== */
function personOf(handle,uid){var P=SC.people||{};return (uid&&P["u:"+uid])||(handle&&P["h:"+String(handle).toLowerCase()])||null}
function avHTML(handle,uid,fallback,cls){var p=personOf(handle,uid);return '<div class="av'+(cls||"")+'" data-scpp="'+esc(handle||"")+'">'+(p&&p.photo_url?'<img src="'+esc(p.photo_url)+'" alt="">':fallback)+"</div>"}
function nameOf(handle,uid){
  var m=SC.names||{};
  if(uid&&m["u:"+uid])return m["u:"+uid];
  if(handle&&m["h:"+String(handle).toLowerCase()])return m["h:"+String(handle).toLowerCase()];
  return handle||"";
}
function properCase(s){return String(s||"").trim().replace(/\s+/g," ").toLowerCase().replace(/(^|[\s\-'’.])([a-z])/g,function(m,p,c){return p+c.toUpperCase()}).replace(/\bMc([a-z])/g,function(m,c){return "Mc"+c.toUpperCase()})}
function seatLabel(h){var L=seatOf(h);return L?"Seat of "+L:(h===SC.head.handle?"Keymaster":"")}

/* ===== attachments ===== */
var ATT_MAX=8;
function ytId(u){var m=String(u||"").match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/);return m?m[1]:null}
function linkMeta(u){
  var id=ytId(u);if(id)return{kind:"video",url:u,yt:id};
  var host="";try{host=new URL(u).hostname.replace(/^www\./,"")}catch(e){}
  return{kind:"link",url:u,host:host,name:u.replace(/^https?:\/\/(www\.)?/,"")}
}
function attHTML(list){
  if(!list||!list.length)return"";
  var imgs=list.filter(function(a){return a.kind==="image"}),rest=list.filter(function(a){return a.kind!=="image"}),h="";
  if(imgs.length){
    h+='<div class="sc-att img '+(imgs.length===1?"one":"two")+'">'+imgs.slice(0,4).map(function(a){return '<div class="ph" data-sclb="'+esc(a.url)+'"><img src="'+esc(a.thumb||a.url)+'" alt="" loading="lazy"></div>'}).join("")+"</div>";
  }
  rest.forEach(function(a){
    if(a.kind==="video"&&a.yt)h+='<div class="sc-att video" data-scyt="'+esc(a.yt)+'"><img src="https://img.youtube.com/vi/'+esc(a.yt)+'/hqdefault.jpg" alt="" loading="lazy"><div class="play"></div><div class="cap"><small>YouTube</small>'+esc(a.title||"Tap to play")+'</div></div>';
    else if(a.kind==="link")h+='<a class="sc-att link" href="'+esc(a.url)+'" target="_blank" rel="noopener"><div class="t"><small>'+esc(a.host||"link")+'</small><b>'+esc(a.title||a.name||a.url)+'</b><span>'+esc(a.url)+'</span></div><div class="ico">🔗</div></a>';
    else if(a.kind==="file")h+='<a class="sc-att file" href="'+esc(a.url)+'" target="_blank" rel="noopener"><i>'+esc((a.ext||"FILE").toUpperCase().slice(0,4))+'</i><div><b>'+esc(a.name||"file")+'</b><span>'+(a.size?Math.round(a.size/1024)+" KB · ":"")+'tap to open</span></div></a>';
  });
  return h;
}
function bodyHTML(raw){
  var t=esc(raw||"");
  t=t.replace(/(https?:\/\/[^\s<]+)/g,function(u){return '<a href="'+u+'" target="_blank" rel="noopener">'+u+'</a>'});
  t=t.replace(/(^|[^\w@])@([A-Za-z0-9_]{2,24})/g,function(m,p,h){var n=nameOf(h);return p+'<span class="at">@'+esc(n===h?h:n)+'</span>'});
  return t;
}
var pend=[];   /* [{kind,url,name,size,ext,thumb,yt,host,up}] */
function pendHTML(){
  return pend.map(function(p,i){var ic=p.kind==="image"?"🖼":p.kind==="video"?"▶":p.kind==="link"?"🔗":"📄";return '<span'+(p.up?' class="up"':'')+'><i>'+ic+'</i><em>'+esc(p.name||p.url||"")+'</em>'+(p.up?"":'<b data-scrm="'+i+'">✕</b>')+"</span>"}).join("");
}
function paintPend(){var el=$("scPend");el&&(el.innerHTML=pendHTML())}
function shrinkImage(file,max){
  return new Promise(function(res){
    var img=new Image(),url=URL.createObjectURL(file);
    img.onload=function(){
      var w=img.naturalWidth,h=img.naturalHeight,s=Math.min(1,max/Math.max(w,h)),c=document.createElement("canvas");
      c.width=Math.round(w*s);c.height=Math.round(h*s);c.getContext("2d").drawImage(img,0,0,c.width,c.height);
      c.toBlob(function(b){URL.revokeObjectURL(url);res(b||file)},"image/jpeg",.86);
    };
    img.onerror=function(){URL.revokeObjectURL(url);res(file)};
    img.src=url;
  });
}
async function uploadAtt(file){
  if(!window.SB||!window.__shkUid)throw new Error("Sign in first");
  var isImg=/^image\//.test(file.type),blob=isImg?await shrinkImage(file,1600):file;
  if(blob.size>12*1024*1024)throw new Error("Under 12 MB, please");
  var ext=isImg?"jpg":(file.name.split(".").pop()||"bin").toLowerCase().slice(0,5),
      path="chamber/"+window.__shkUid+"-"+Date.now().toString(36)+Math.random().toString(36).slice(2,6)+"."+ext,
      up=await SB.storage.from("chat-media").upload(path,blob,{contentType:isImg?"image/jpeg":(file.type||"application/octet-stream"),cacheControl:"31536000"});
  if(up.error)throw up.error;
  var url=SB.storage.from("chat-media").getPublicUrl(path).data.publicUrl;
  return isImg?{kind:"image",url:url,name:file.name,size:blob.size}:{kind:"file",url:url,name:file.name,size:blob.size,ext:ext};
}
async function uploadProfilePhoto(file){
  SC._phUp=1;paintChamber();
  try{var a=await uploadAtt(file);SC._phUrl=a.url;SC._phUp=0;paintChamber();
    await rpc("sc_profile_set",{p_photo:a.url,p_bio:($("scPBio")||{}).value||"",p_facebook:($("scPFb")||{}).value||"",p_phone:"",p_home:($("scPHome")||{}).value||""});
    say("\u2713 Picture set, council only");reload().then(paintChamber)}
  catch(e){SC._phUp=0;paintChamber();say("\u2717 "+(e&&e.message||e))}
}
function addFiles(files){
  [].slice.call(files||[]).forEach(function(f){
    if(pend.length>=ATT_MAX){say("Eight at most");return}
    var p={kind:/^image\//.test(f.type)?"image":"file",name:f.name,up:true};pend.push(p);paintPend();
    uploadAtt(f).then(function(a){Object.assign(p,a,{up:false});paintPend()},function(e){pend.splice(pend.indexOf(p),1);paintPend();say("✗ "+(e&&e.message||"upload failed"))});
  });
}
function addLink(u){
  u=String(u||"").trim();if(!/^https?:\/\//i.test(u))u="https://"+u;
  if(pend.some(function(p){return p.url===u}))return;
  if(pend.length>=ATT_MAX){say("Eight at most");return}
  var m=linkMeta(u);m.name=m.kind==="video"?"YouTube · "+m.yt:m.name;pend.push(m);paintPend();
}

/* ===== bell + herald ===== */
var AC=null;
function chime(){
  try{
    AC=AC||new (window.AudioContext||window.webkitAudioContext)();
    if(AC.state==="suspended")AC.resume();
    var t=AC.currentTime,out=AC.createGain();out.gain.value=.45;
    var conv=AC.createConvolver(),len=Math.floor(AC.sampleRate*2.2),buf=AC.createBuffer(2,len,AC.sampleRate);
    for(var c=0;c<2;c++){var d=buf.getChannelData(c);for(var i=0;i<len;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/len,3)}
    conv.buffer=buf;var wet=AC.createGain();wet.gain.value=.35;
    out.connect(AC.destination);out.connect(conv);conv.connect(wet);wet.connect(AC.destination);
    [[659.25,0],[987.77,.42],[1318.5,.84]].forEach(function(n,k){
      [1,2.76,5.4].forEach(function(hm,j){
        var o=AC.createOscillator(),g=AC.createGain();o.type="sine";o.frequency.value=n[0]*hm;
        var a=[.5,.14,.05][j],st=t+n[1];
        g.gain.setValueAtTime(0,st);g.gain.linearRampToValueAtTime(a,st+.012);g.gain.exponentialRampToValueAtTime(.0001,st+(k===2?3.2:2)/(j+1));
        o.connect(g);g.connect(out);o.start(st);o.stop(st+3.4);
      });
    });
  }catch(e){}
}
var heraldT=null,lastIn=null;
function herald(handle,seat,n){
  var sh=$("scChamber");if(!sh||!sh.classList.contains("on"))return;
  chime();hum([10,30,10]);
  var h=$("scHerald");
  if(!h){h=document.createElement("div");h.id="scHerald";h.className="sc-herald";h.innerHTML='<div class="glint"></div><div class="seal"></div><div><div class="k">Enters the Chamber</div><div class="n"></div><div class="s"></div></div>';document.body.appendChild(h)}
  h.querySelector(".seal").textContent=seat||"⚜";
  h.querySelector(".n").textContent=nameOf(handle);
  h.querySelector(".s").innerHTML=(seat?"The Seat of <b>"+esc(seat)+"</b>":"<b>The Keymaster</b>")+" · "+n+" now in the room";
  h.classList.remove("on");void h.offsetWidth;h.classList.add("on");
  try{sh.querySelectorAll(".sc-floor .hs").forEach(function(g){var tt=g.querySelector("text");if(tt&&tt.textContent===seat){g.classList.add("arrive");setTimeout(function(){g.classList.remove("arrive")},4000)}})}catch(e){}
  clearTimeout(heraldT);heraldT=setTimeout(function(){h.classList.remove("on")},4200);
}
function watchArrivals(){
  try{
    var w=me(),now={};
    ((window.FLOOR&&FLOOR.roster)||[]).forEach(function(r){r&&r.room==="The Chamber"&&r.h&&(now[r.h]=1)});
    var names=Object.keys(now);
    if(lastIn){
      var sh=$("scChamber");
      if(sh&&sh.classList.contains("on"))names.forEach(function(h){if(!lastIn[h]&&h!==w.handle&&(isCouncil(h)||h===SC.head.handle))herald(h,seatOf(h),names.length)});
    }
    lastIn=now;
  }catch(e){}
}

/* ===== board / hall line helpers ===== */
function boardOpensAt(key){ /* 10 minutes after dispatch officially ends, LA time */
  try{var d=key.slice(0,10),pm=key.slice(-2)==="PM",t=new Date(d+"T"+(pm?"19:40":"10:10")+":00");
    var off=0;try{var la=nowLA(),loc=new Date();off=loc.getTime()-la.getTime()}catch(e){}
    return t.getTime()+off}catch(e){return 0}
}
function mmss(ms){ms=Math.max(0,ms);var m=Math.floor(ms/6e4),s=Math.floor(ms%6e4/1e3);return m+":"+(s<10?"0":"")+s}
function choreDone(kind,key){ /* a house chore is done when a done/paid job from the house names it */
  return SC.jobs.some(function(j){return j.by==="THE HOUSE"&&(j.state==="done"||j.state==="paid")&&String(j.rawBody||"").indexOf("· "+kind+" · "+key)>=0});
}
function choreJob(kind,key){return SC.jobs.filter(function(j){return j.by==="THE HOUSE"&&String(j.rawBody||"").indexOf("· "+kind+" · "+key)>=0})[0]||null}
function hallOf(key){return (SC.hall||{})[key]||{key:key,calls:0}}

/* ===== Chamber alerts: the table, motions, votes ===== */
function alertsOn(){try{return localStorage.getItem("shk_sc_alerts")!=="0"}catch(e){return true}}
var _alT={};
function scNotify(title,body,tag){
  if(!alertsOn()||!council())return;
  var now=Date.now();if(_alT[tag]&&now-_alT[tag]<4000)return;_alT[tag]=now;
  try{if(typeof shkNotify==="function"){shkNotify(title,body,tag,[60,40,60]);return}}catch(e){}
  try{if(!document.hidden){say(title+" \u2014 "+body);hum([60,40,60]);return}}catch(e){}
  try{if(typeof Notification!=="undefined"&&Notification.permission==="granted"){var o={body:body,tag:tag,vibrate:[60,40,60]};window.SW_REG&&SW_REG.showNotification?SW_REG.showNotification(title,o).catch(function(){try{new Notification(title,o)}catch(e){}}):new Notification(title,o)}}catch(e){}
}
function scAlert(table,ev,row,old){
  try{
    var w=me();if(!row||!w.uid)return;
    var inRoomNow=(function(){var sh=$("scChamber");return sh&&sh.classList.contains("on")&&!document.hidden})();
    if(table==="sc_table"&&ev==="INSERT"){
      if(row.uid===w.uid)return;if(inRoomNow&&tab==="table")return;
      var who=row.kind==="house"?"The Table":nameOf(row.handle,row.uid),txt=String(row.body||"").slice(0,110)||(Array.isArray(row.media)&&row.media.length?"sent "+(row.media[0].kind==="image"?"a photo":row.media[0].kind==="video"?"a video":"a file"):"");
      scNotify("\u269C "+who,txt,"shadowhook-chamber-table");return;
    }
    if(table==="sc_motions"&&ev==="INSERT"){
      if(row.by_uid===w.uid)return;
      scNotify(row.kind==="remove"?"\u2620 A removal is on the floor":"\u269C A motion is on the floor",String(row.title||"")+" \u2014 by "+nameOf(row.by_handle,row.by_uid)+". Your vote is needed.","shadowhook-chamber-motion-"+row.id);return;
    }
    if(table==="sc_motions"&&ev==="UPDATE"){
      if(row.state&&row.state!=="open"&&(!old||old.state==="open"||!old.state)){
        scNotify(row.state==="failed"?"The motion fails":"\u269C The motion carries",String(row.title||""),"shadowhook-chamber-result-"+row.id);
      }return;
    }
    if(table==="sc_votes"&&ev==="INSERT"){
      if(row.uid===w.uid)return;
      var m=SC.motions.filter(function(x){return x.id===row.motion_id})[0];
      if(m&&m.by===w.handle){scNotify("\u269C A vote on your motion",nameOf(row.handle,row.uid)+" voted "+(row.choice==="pass"?"abstain":row.choice)+" on \u201C"+m.title+"\u201D","shadowhook-chamber-vote-"+row.motion_id)}
      return;
    }
    if(table==="sc_claim_votes"&&ev==="INSERT"){
      if(!w.head||row.uid===w.uid)return;
      scNotify("\u269C A vote on the seat of "+row.letter,nameOf(row.handle,row.uid)+" cast a vote.","shadowhook-chamber-seat-"+row.letter);return;
    }
  }catch(e){}
}

/* ===== TABLE ===== */
function tableHTML(w){
  var ring='<div class="sc-floorwrap'+(SC._floorOff?"":" on")+'">'+floorSVG(w)+"</div>",
      rows=SC.table.slice().sort(function(a,b){return b.at-a.at}),out="",lastDay="";
  rows.forEach(function(m){
    var dl=new Date(m.at).toDateString(),today=new Date().toDateString(),y=new Date(Date.now()-864e5).toDateString();
    var lab=dl===today?"Today":dl===y?"Yesterday":new Date(m.at).toLocaleDateString(void 0,{weekday:"long",month:"short",day:"numeric"});
    if(lab!==lastDay){out+='<div class="sc-day">'+lab+"</div>";lastDay=lab}
    var head=m.who===SC.head.handle,sys=m.who==="THE TABLE",mine=!sys&&m.who===w.handle;
    out+='<div class="sc-msg'+(sys?" sys":"")+'">'+(sys?'<div class="av sys">\u00B7</div>':avHTML(m.who,m.uid,head?"\u269C":esc(m.letter),head?" head":""))+'<div><div class="who"><b data-scpp="'+(sys?"":esc(m.who))+'">'+esc(sys?"The Table":nameOf(m.who,m.uid))+"</b>"+(sys?"":'<span class="role">'+(head?"Keymaster":"Seat of "+esc(m.letter))+"</span>")+"<span>"+ago(m.at)+(m.edited?" · edited":"")+"</span></div>"+(m.raw?'<div class="bd">'+bodyHTML(m.raw)+"</div>":"")+attHTML(m.media)+(mine||w.head?'<div class="sc-mact">'+(mine?'<button type="button" data-scmsg="edit" data-c="'+m.id+'">Edit</button>':"")+'<button type="button" data-scmsg="del" data-c="'+m.id+'">Delete</button></div>':"")+"</div></div>";
  });
  return ring+'<div class="sc-sec">The Table</div>'+(out||'<p class="sc-p dim">Nothing said yet. Speak to the table below.</p>');
}
function composeHTML(){
  return '<div class="sc-compose"><div class="sc-tray" id="scTray"><label><i>🖼</i>Photo<input type="file" accept="image/*" multiple hidden data-scatt="img"></label><label><i>📄</i>File<input type="file" accept="application/pdf,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt" multiple hidden data-scatt="file"></label><button type="button" data-scc="att-link"><i>🔗</i>Link</button><button type="button" data-scc="att-yt"><i>▶</i>YouTube</button></div><div class="sc-pend" id="scPend">'+pendHTML()+'</div><button type="button" class="sc-plus" data-scc="att-open" aria-label="Attach">+</button><textarea class="sc-in" id="scSay" rows="1" maxlength="2000" placeholder="Speak to the table\u2026"></textarea><button type="button" class="sc-btn" data-scc="say">Say</button></div>';
}

/* ===== MOTIONS ===== */
function motionsHTML(w){
  var seatsL=seated(),open=[],done=[];
  SC.motions.slice().sort(function(a,b){return b.at-a.at}).forEach(function(m){(m.state==="open"?open:done).push(m)});
  var card=function(m){
    var v=m.votes||{},aye=0,nay=0,pass=0;Object.keys(v).forEach(function(k){v[k]==="aye"?aye++:v[k]==="nay"?nay++:pass++});
    var mine=v[w.handle]||"",cast=aye+nay,tot=seatsL.length||1,pa=aye/tot*100,pn=nay/tot*100,mark=m.kind==="remove"?66.67:50,
        hrs=Math.max(0,Math.ceil((m.at+48*36e5-Date.now())/36e5)),now_=cast&&(m.kind==="remove"?aye*3>=cast*2:aye>nay),
        st=m.state==="open"?(hrs?"closes in "+hrs+"h":"closing"):m.state==="carried"?"Carried":m.state==="failed"?"Failed":m.state,
        voters=seatsL.map(function(L){var h=SC.seats[L].handle,c=v[h];return '<i class="'+(c==="aye"?"":c==="nay"?"n":c?"p":"w")+'" title="'+esc(nameOf(h))+'">'+L+"</i>"}).join("");
    var h='<div class="sc-mo"><div class="k"><span>'+(m.kind==="remove"?"\u2620 Removal":"\u269C Motion")+" · "+esc(nameOf(m.by))+'</span><em class="'+m.state+'">'+st+'</em></div><div class="t">'+esc(m.title)+"</div>"+(m.body?'<div class="b">'+esc(m.body)+"</div>":"")+'<div class="sc-bar"><b style="width:'+pa+'%"></b><u style="width:'+pn+'%"></u><i style="left:'+mark+'%"></i></div><div class="sc-tally"><span><b>'+aye+"</b> aye</span><span><b>"+nay+"</b> nay</span><span><b>"+pass+"</b> abstain</span><span>"+Math.max(0,tot-aye-nay-pass)+" not in</span></div>";
    if(m.state==="open"){
      h+='<div class="sc-voters">'+voters+"</div>";
      h+='<p class="sc-p dim" style="margin:8px 0 0">'+(m.kind==="remove"?"Two-thirds of votes cast.":"Majority of votes cast.")+" "+(cast?"If it closed now it <b style='color:"+(now_?"#9fd08a":"#e07a6e")+"'>"+(now_?"carries":"fails")+"</b>, "+aye+" of "+cast+".":"No votes yet.")+"</p>";
      w.seat&&(h+='<div class="sc-vote"><button type="button" class="aye'+(mine==="aye"?" on":"")+'" data-scv="aye" data-m="'+m.id+'">Aye</button><button type="button" class="nay'+(mine==="nay"?" on":"")+'" data-scv="nay" data-m="'+m.id+'">Nay</button><button type="button" class="'+(mine==="pass"?"on":"")+'" data-scv="pass" data-m="'+m.id+'">Abstain</button></div>');
      w.head&&(h+='<div class="sc-vote"><button type="button" class="dec" data-scd="carried" data-m="'+m.id+'">\u269C Decree it carried</button><button type="button" class="dec" data-scd="failed" data-m="'+m.id+'">Strike it down</button></div>');
    }
    return h+"</div>";
  };
  var put='<div class="sc-sec">Put a motion</div><input class="sc-in" id="scMT" maxlength="80" placeholder="The motion, in one line" style="margin-bottom:8px"><textarea class="sc-in" id="scMB" rows="2" maxlength="400" placeholder="Why the table should carry it"></textarea><div class="sc-row"><button type="button" class="sc-btn" data-scc="motion">Put it to the table</button></div><p class="sc-p dim" style="margin-top:10px">Open 48 hours. A majority of the votes cast carries it; a tie fails. Removals need two-thirds. The Keymaster can decree one carried.</p>';
  return '<div class="sc-sec">On the floor <em>'+open.length+" open</em></div>"+(open.map(card).join("")||'<p class="sc-p dim">No motion on the floor.</p>')+(done.length?'<div class="sc-sec">Settled</div>'+done.slice(0,12).map(card).join(""):"")+put;
}

/* ===== JOBS ===== */
var CH_PAY={log:10,pma:15,sheet:15},HALL_TEL_="tel:+13106209879";
function jobsHTML(w){
  var C=window.HOUSE_CHORES;if(!C)return '<p class="sc-p dim">Loading the house jobs\u2026</p>';
  var nm=function(k){try{return C.name(k)}catch(e){return k||""}},
      due={};try{C.list().forEach(function(t){due[t.kind]||(due[t.kind]=t)})}catch(e){}
  var stl=[];try{stl=C.pmaStale?C.pmaStale():[]}catch(e){}
  var lb=due.log?due.log.key:C.lastBoard(),pk=due.pma?due.pma.key:stl[0]||C.pmaKey()||lb,sk=C.sheetKey(),key=lb||pk||"";
  var open=SC._jobOpen||{};
  var track=function(steps){ /* [[label,state]] state 1 ok,2 now,0 */
    return '<div class="st">'+steps.map(function(s,i){var c=s[1]===1?"ok":s[1]===2?"now":"";return '<i class="'+c+'">'+(s[1]===1?"\u2713":i+1)+'</i><span class="'+c+'">'+s[0]+"</span>"+(i<steps.length-1?'<s class="'+(s[1]===1&&steps[i+1][1]?"ok":"")+'"></s>':"")}).join("")+"</div>";
  };
  var away=[],cards="";
  /* ---- Hall Line ---- */
  (function(){
    if(!lb)return;
    var H=hallOf(lb),doneLog=!!H.done_at||choreDone("log",lb)||!due.log,opens=boardOpensAt(lb),left=opens-Date.now(),
        busy=H.caller&&H.started_at&&Date.now()-H.started_at<15*6e4&&H.caller!==w.uid,
        meOn=H.caller===w.uid&&H.started_at&&Date.now()-H.started_at<15*6e4,
        cool=H.last_call_at?Math.max(0,H.last_call_at+5*6e4-Date.now()):0,spent=(H.calls||0)>=2;
    if(doneLog){away.push('<div class="sc-away"><div class="ic">\u260E</div><div class="d">Hall Line · '+esc(nm(lb))+'<small class="ok">'+(H.logged_handle?"Logged by "+esc(nameOf(H.logged_handle)):"End card on the record")+"</small></div>"+(function(){var j=choreJob("log",lb);return j?"<em>"+(j.state==="paid"?"\u2713 ":"")+j.bucks+" \u2693</em>":""})()+"</div>");return}
    var sub,btn,dis=true,cls="due",st;
    if(left>0){sub="Opens 10 min after dispatch ends · "+new Date(opens).toLocaleTimeString([],{hour:"numeric",minute:"2-digit"});btn="\u260E Call the Hall Line · opens in "+mmss(left);st=[["Board ended",1],["10 min",2],["Call",0],["Logged",0]]}
    else if(meOn){sub='<span class="sc-pulse"></span>You are on the line · the log opens when you hang up';btn="On the line\u2026";cls="live";st=[["Board ended",1],["10 min",1],["Call",2],["Logged",0]]}
    else if(busy){sub='<span class="sc-pulse"></span>'+esc(nameOf(H.caller_handle))+" is on the line · "+ago(H.started_at);btn=esc(nameOf(H.caller_handle))+" is calling · wait";cls="live";st=[["Board ended",1],["10 min",1],["Call",2],["Logged",0]]}
    else if(spent){sub="Both calls used · type the end card in by hand";btn="No calls left";st=[["Board ended",1],["10 min",1],["Call",1],["Logged",2]]}
    else if(cool>0){sub=(H.caller_handle?esc(nameOf(H.caller_handle))+" hung up without the card · ":"")+(2-H.calls)+" call left";btn="\u260E Call again in "+mmss(cool);st=[["Board ended",1],["10 min",1],["Call",2],["Logged",0]]}
    else{sub="The hall bot has the end card now · call "+((H.calls||0)+1)+" of 2";btn="\u260E Call the Hall Line";dis=false;st=[["Board ended",1],["10 min",1],["Call",2],["Logged",0]]}
    cards+='<div class="sc-job '+cls+(open.log!==false?" open":"")+'" data-scjob="log"><div class="hd" data-sctog="log"><div class="ic">\u260E</div><div class="n"><b>Hall Line</b><span class="hot">'+sub+'</span></div><div class="pay">+10 \u2693<small>Due</small></div></div>'+track(st)+'<div class="bx"><div class="sc-rules"><div><b>'+(H.calls||0)+' / 2</b><span>calls used</span></div><div><b class="'+(cool>0?"off":"ok")+'">'+(cool>0?mmss(cool):left>0?"\u2014":"Ready")+'</b><span>cooldown</span></div><div><b class="'+(busy||meOn?"ok":"off")+'">'+(meOn?"You":busy?esc(nameOf(H.caller_handle)):"Nobody")+'</b><span>on the line</span></div></div><button type="button" class="sc-btn big'+(dis?"":" live")+'" data-sch="call" data-k="'+esc(lb)+'"'+(dis?" disabled":"")+' style="margin-top:10px">'+btn+'</button>'+(meOn?'<button type="button" class="sc-btn ghost" style="width:100%;margin-top:8px;box-sizing:border-box" data-sch="hangup" data-k="'+esc(lb)+'">I hung up · open the log</button>':"")+'<p class="sc-p dim" style="margin:8px 0 0">The hall bot only knows the end card 10 minutes after dispatch officially ends. Two calls per board, five minutes apart, one caller at a time. Once the card is logged this goes away for everyone.</p>'+(spent?'<button type="button" class="sc-btn ghost" style="width:100%;margin-top:4px;box-sizing:border-box" data-sch="log" data-k="'+esc(lb)+'">\u2328 Type the end card in</button>':"")+"</div></div>";
  })();
  /* ---- PMA sheet ---- */
  (function(){
    if(!pk)return;
    var done=choreDone("pma",pk)&&!due.pma&&!stl.length;
    if(done||(!due.pma&&!stl.length)){var j=choreJob("pma",pk);away.push('<div class="sc-away"><div class="ic">\uD83D\uDCC4</div><div class="d">PMA sheet · '+esc(nm(pk))+'<small class="ok">'+(j?"Read · by "+esc(nameOf(j.taker)):"All sheets are in")+'</small></div><label>+ New document<input type="file" accept="application/pdf,.pdf" multiple hidden data-schf="'+esc(pk)+'" data-t="'+esc("PMA sheet · "+nm(pk))+'"></label>'+(j?"<em>"+(j.state==="paid"?"\u2713 ":"")+j.bucks+" \u2693</em>":"")+"</div>");return}
    var sub=due.pma?esc(nm(pk))+" is missing its PMA sheet":esc(nm(pk))+" was read before the board ended · PMA posted a new one";
    cards+='<div class="sc-job due'+(open.pma!==false?" open":"")+'" data-scjob="pma"><div class="hd" data-sctog="pma"><div class="ic">\uD83D\uDCC4</div><div class="n"><b>PMA sheet</b><span class="hot">'+sub+'</span></div><div class="pay">+15 \u2693<small>Due</small></div></div>'+track([["Board ended",1],["Add PDF",2],["Read",0],["Paid",0]])+'<div class="bx"><div class="sc-step"><i>1</i><div class="l">Get the PDF from PMA<small>It opens in your browser. Download it there.</small><button type="button" class="sc-btn ghost" data-sch="out" data-u="'+esc(C.pmaLink(pk))+'">\u2197 Open PMA in your browser</button></div></div><div class="sc-step"><i>2</i><div class="l">Add it here<small>The app reads it and tells you what it found before it claims the job.</small><label class="sc-drop"><b>Add the PDF</b>tap, or drop the file here<input type="file" accept="application/pdf,.pdf" multiple hidden data-schf="'+esc(pk)+'" data-t="'+esc("PMA sheet · "+nm(pk))+'"></label>'+(SC._pmaProof?'<div class="sc-proof'+(SC._pmaProof.warn?" warn":"")+'"><b>'+esc(SC._pmaProof.head)+'</b>'+esc(SC._pmaProof.text)+'</div>':"")+'</div></div><div class="sc-step"><i class="ok">\u00B7</i><div class="l" style="color:var(--sc-dim)">Only if the PDF didn\u2019t read right<button type="button" class="sc-btn ghost sm" data-sch="enter" data-w="nums-pma" data-k="'+esc(pk)+'">\u2328 Type the numbers in instead</button></div></div></div></div>';
  })();
  /* ---- ILWU sheet ---- */
  (function(){
    if(!sk)return;
    var bad=sk.n>0,url="";try{url=(C.list().filter(function(t){return t.kind==="sheet"})[0]||{}).url||C.ilwuLink()}catch(e){url=C.ilwuLink()}
    if(!bad){away.push('<div class="sc-away"><div class="ic">\uD83D\uDCCB</div><div class="d">ILWU sheet · '+esc(nm(sk.key))+'<small class="ok">The bot read it · nothing to fix</small></div><button type="button" data-sch="out" data-u="'+esc(url)+'">\u2B07 Download</button></div>');return}
    cards+='<div class="sc-job due'+(open.sheet!==false?" open":"")+'" data-scjob="sheet"><div class="hd" data-sctog="sheet"><div class="ic">\uD83D\uDCCB</div><div class="n"><b>ILWU sheet</b><span class="hot">'+esc(nm(sk.key))+" · "+sk.n+" number"+(sk.n>1?"s":"")+" don\u2019t add up</span></div><div class='pay'>+15 \u2693<small>Due</small></div></div>"+track([["Posted",1],["Bot read",1],["Fix",2],["Paid",0]])+'<div class="bx"><div class="sc-proof warn" style="margin-top:12px"><b>Bot read · '+esc(nm(sk.key))+"</b>"+sk.n+" column"+(sk.n>1?"s":"")+" don\u2019t add up. Fix what the paper says and save; the job claims itself.</div><div class=\"sc-row\"><button type=\"button\" class=\"sc-btn\" data-sch=\"fix\" data-k=\""+esc(sk.key)+'">\u270E Check &amp; correct</button><button type="button" class="sc-btn ghost" data-sch="out" data-u="'+esc(url)+'">\u2B07 Download</button></div><button type="button" class="sc-btn ghost sm" style="width:100%;margin-top:8px;box-sizing:border-box" data-sch="enter" data-w="nums-ilwu" data-k="'+esc(sk.key)+'">\u2328 Type every column in</button></div></div>';
  })();
  /* ---- posted jobs & late questions ---- */
  var oj=SC.jobs.filter(function(j){return j.state==="taken"&&j.taker===w.handle}).concat(openJobs()),
      owed=SC.jobs.filter(function(j){return j.state==="done"}),paid=SC.jobs.filter(function(j){return j.state==="paid"}).slice(0,8),
      dueN=(cards.match(/class="sc-job due/g)||[]).length+oj.length,paidMonth=0;
  SC.jobs.forEach(function(j){j.state==="paid"&&j.at>Date.now()-30*864e5&&(paidMonth+=j.bucks||0)});
  var h='<div class="sc-ledger"><div><b>'+dueN+'</b><span>Due now</span></div><div><b>'+owed.length+'</b><span>Waiting pay</span></div><div><b>'+paidMonth+' \u2693</b><span>Paid, 30 days</span></div></div><p class="sc-p dim">One board at a time. When a job is done it goes away for everyone.</p>';
  h+='<div class="sc-sec">'+esc(key?nm(key):"This board")+"</div>"+(cards||'<p class="sc-p dim">Nothing due on this board.</p>');
  oj.length&&(h+='<div class="sc-sec">On the board</div>'+oj.map(function(j){return jobCard(j,w)}).join(""));
  away.length&&(h+='<div class="sc-sec">Put away <em>'+away.length+" done</em></div>"+away.join(""));
  owed.length&&(h+='<div class="sc-sec">Waiting on the Keymaster <em>'+owed.length+"</em></div>"+owed.map(function(j){return '<div class="sc-jrow"><div class="L">'+esc(seatOf(j.taker)||"\u00B7")+'</div><div class="d">'+esc(nameOf(j.taker||""))+"<small>"+esc(String(j.title).replace(/^House chore · /,""))+" · "+ago(j.at)+"</small></div>"+(w.head?'<button type="button" class="sc-btn" data-scj="pay" data-c="'+j.id+'">Pay '+j.bucks+" \u2693</button>":"<em>"+j.bucks+" \u2693</em>")+"</div>"}).join(""));
  paid.length&&(h+='<div class="sc-sec">Paid</div>'+paid.map(function(j){return '<div class="sc-jrow"><div class="L">'+esc(seatOf(j.taker)||"\u00B7")+'</div><div class="d">'+esc(nameOf(j.taker||""))+"<small>"+esc(String(j.title).replace(/^House chore · /,""))+'</small></div><em class="paid">\u2713 '+j.bucks+" \u2693</em></div>"}).join(""));
  return h;
}

/* ===== DESK ===== */
var GROUPS=[["casuallife13","CasualLife13","https://www.facebook.com/groups/373766836771612/members"],["hallics","CASUAL HALLICS","https://www.facebook.com/groups/418077911647326/members"]];
function applicantsHTML(w){
  var A=SC.applicants||[],X=SC.extras||{};
  if(!A.length)return '<div class="sc-sec">Elections</div><p class="sc-p dim">Nobody has filed for a seat.</p>';
  var by={};A.forEach(function(a){(by[a.letter]=by[a.letter]||[]).push(a)});
  var N=seated().length||1;
  return '<div class="sc-sec">Elections <em>'+Object.keys(by).length+" seat"+(Object.keys(by).length>1?"s":"")+"</em></div>"+Object.keys(by).sort().map(function(L){
    var list=by[L],ends=list[0].ends,closed=ends&&ends<Date.now(),tot=list.reduce(function(s,a){return s+a.votes},0),
        mineAny=list.some(function(a){return a.mine}),
        rv=SC.table.filter(function(m){return m.who==="THE TABLE"&&/^Re-vote called on the seat of /.test(m.raw||"")&&m.raw.indexOf("seat of "+L+" ")>=0&&m.at>Date.now()-7*864e5})[0];
    var h='<div class="sc-elec"><div class="hd"><div class="seat">'+L+'</div><div class="n"><b>The seat of '+L+"</b><span>"+list.length+" filed · "+(closed?"window closed":"closes <u>"+new Date(ends).toLocaleDateString(void 0,{month:"short",day:"numeric"})+"</u>")+'</span></div><div class="turnout"><b>'+tot+" / "+N+"</b><small>have voted</small></div></div>";
    rv&&(h+='<div class="note"><b>Re-vote called · '+ago(rv.at)+"</b>"+esc(rv.raw.replace(/^Re-vote called on the seat of \w by the Keymaster: /,""))+"</div>");
    h+='<div class="body">'+list.map(function(a){
      var x=X[a.uid]||{},nm=x.full_name?properCase(x.full_name):a.handle,isNew=a.since&&Date.now()-ts(a.since)<2592e6,idle=a.days===0,pct=tot?a.votes/tot*100:0,hl=String(a.handle||"").toLowerCase();
      var c='<div class="sc-cand"><div class="top"><div class="pav'+(x.photo_url?"":" none")+(w.head?" km":"")+'" data-scpp="'+esc(a.handle)+'"'+(w.head?' data-scsetph="'+a.uid+'" title="Set a picture"':"")+'>'+(x.photo_url?'<img src="'+esc(x.photo_url)+'" alt="">':esc(nm.charAt(0)))+(w.head?'<input type="file" accept="image/*" hidden data-scprof="for" data-u="'+a.uid+'">':"")+'</div><div class="nmw"><b data-scpp="'+esc(a.handle)+'">'+esc(nm)+"</b><small>"+esc(hl)+" · "+(isNew?"new this month":idle?"quiet lately":"active")+" · filed "+ago(a.at)+'</small></div><div class="lead"><b>'+a.votes+"</b><span>vote"+(a.votes===1?"":"s")+'</span></div></div><div class="bd"><div class="vbar"><b style="width:'+pct+'%"></b></div>';
      c+='<div class="facts"><span><b>'+fact(a.hrs!=null?Math.round(+a.hrs):null)+"</b>hours on the book</span><span><b>"+(a.since?new Date(ts(a.since)).toLocaleDateString(void 0,{month:"short",year:"2-digit"}):"\u2014")+"</b>member since</span><span><b>"+a.days+"</b>days in, 30d</span><span><b>"+(a.seen?ago(a.seen):"\u2014")+"</b>last seen</span></div>";
      c+='<div class="sub">About</div><div class="about">'+(a.note?"<em>\u201C"+esc(a.note)+"\u201D</em> "+(x.bio?"<br>":""):"")+(x.bio?"<em>\u201C"+esc(x.bio)+"\u201D</em>":(a.note?"":'<span class="none">Hasn\u2019t filled in their profile yet.</span>'))+(x.facebook_url?'<br><a class="sc-fb" href="'+esc(x.facebook_url)+'" target="_blank" rel="noopener"><i>f</i>Open Facebook profile</a>'+(w.head?' <button type="button" class="sc-fb none" data-scfb="'+a.uid+'" style="font-size:11px"><i>f</i>Change</button>':""):(w.head?'<br><button type="button" class="sc-fb none" data-scfb="'+a.uid+'"><i>f</i>Add their Facebook link</button>':'<br><span class="sc-fb none"><i>f</i>No Facebook linked</span>'))+"</div>";
      var ck=x.checks||{},latest=0,allSet=true;
      c+='<div class="sub">Facebook groups</div><div class="sc-grp">'+GROUPS.map(function(g){var k=ck[g[0]],s=k?k.s:"o";k&&(latest=Math.max(latest,ts(k.at)));k||(allSet=false);
        return '<div class="g"><i class="'+s+'">'+({y:"\u2713",n:"\u2717",q:"?",o:"\u00B7"})[s]+"</i><b>"+g[1]+(k&&k.note?"<small>"+esc(k.note)+"</small>":"")+"</b>"+(w.head?'<span class="mk"><button type="button"'+(s==="y"?' class="on"':"")+' data-scck="y" data-u="'+a.uid+'" data-g="'+g[0]+'">\u2713</button><button type="button"'+(s==="q"?' class="on"':"")+' data-scck="q" data-u="'+a.uid+'" data-g="'+g[0]+'">?</button><button type="button"'+(s==="n"?' class="on"':"")+' data-scck="n" data-u="'+a.uid+'" data-g="'+g[0]+'">\u2717</button></span><a class="go" href="'+g[2]+'" target="_blank" rel="noopener">Open \u2197</a>':"")+"</div>"}).join("")
        +'<div class="by">'+(latest?(Object.keys(ck).every(function(k){return ck[k].s==="y"})&&allSet?"Verified":"Unverified")+" · "+new Date(latest).toLocaleDateString(void 0,{month:"short",day:"numeric"}):"Not checked yet")+"</div></div>";
      c+='<div class="sc-vote"><button type="button" class="'+(a.mine?"on":"")+'" data-scav="'+a.id+'">'+(a.mine?"\u2713 Your vote":"Vote for "+esc(nm.split(" ")[0]))+" · "+a.votes+"</button>"+(w.head?'<button type="button" class="dec" data-scn="seat" data-c="'+a.id+'">Seat by nod</button><button type="button" class="dec" data-scn="decline" data-c="'+a.id+'">Decline</button>':"")+"</div></div></div>";
      return c;
    }).join("")+"</div>";
    h+='<div class="foot">'+(w.head?'<div class="sc-row"><button type="button" class="sc-btn sm" data-scseal="'+L+'"'+(closed||tot?"":" disabled")+'>\u269C Seal the election</button><button type="button" class="sc-btn sm ghost" data-screvote="'+L+'">\u21BA Re-vote</button></div><p class="sc-p dim" style="margin:8px 0 0">'+(closed?"The window is closed.":"The seal opens when the window closes.")+"</p>":(closed?'<div class="sc-row"><button type="button" class="sc-btn sm" data-scseal="'+L+'">\u269C Seal the election</button></div>':'<p class="sc-p dim" style="margin:0">'+(mineAny?"You\u2019ve voted. ":"One vote per seat holder. ")+"The seal opens when the window closes.</p>"))+"</div></div>";
    return h;
  }).join("");
}
function banRecordHTML(w){
  var R=SC.banRecord||[];
  var h='<div class="sc-sec">Banned from marking <em>'+(R.length?R.filter(function(r){return r.active}).length+" now · "+R.length+" on record":"the record")+"</em></div>";
  if(!R.length)return h+'<p class="sc-p dim">Nobody has been banned from the wire.</p>';
  return h+R.map(function(r){
    var nm=r.full_name?properCase(r.full_name):r.handle,until=r.last_until?ts(r.last_until):0;
    return '<div class="sc-cand" style="margin-bottom:8px"><div class="top"><div class="pav none" data-scpp="'+esc(r.handle||"")+'">'+esc((nm||"?").charAt(0))+'</div><div class="nmw"><b data-scpp="'+esc(r.handle||"")+'">'+esc(nm)+'</b><small>'+esc(String(r.handle||"").toLowerCase())+(r.card_id?" · "+esc(r.card_id):"")+" · "+(r.active?'<span style="color:#e07a6e;font-weight:600">banned until '+new Date(until).toLocaleDateString(void 0,{month:"short",day:"numeric"})+"</span>":"ban over · watching")+'</small></div><div class="lead"><b>'+r.times+'</b><span>time'+(r.times===1?"":"s")+'</span></div></div><div class="bd">'
      +(r.history||[]).map(function(x){return '<div class="sc-pline"><i>'+(ts(x.until)>Date.now()?"\u2716":"\u00B7")+"</i><span>"+esc(x.reason||"")+"</span><small>"+new Date(ts(x.at)).toLocaleDateString(void 0,{month:"short",day:"numeric"})+" \u2192 "+new Date(ts(x.until)).toLocaleDateString(void 0,{month:"short",day:"numeric"})+(x.by?" · "+esc(x.by):"")+"</small></div>"}).join("")
      +"</div></div>";
  }).join("");
}
function myCardHTML(w){
  var c=personOf(w.handle,w.uid)||{},nm=nameOf(w.handle,w.uid),pic=SC._phUrl||c.photo_url;
  return '<div class="sc-sec">Your council profile</div><div class="sc-mycard sc-pedit"><p class="sc-p dim" style="margin:0 0 10px">Seen only inside the Chamber. Your picture here is separate from the one on the rest of the app.</p><label class="ph'+(SC._phUp?" up":"")+'">'+(pic?'<img src="'+esc(pic)+'" alt="">':esc((nm||"?").charAt(0)))+'<input type="file" accept="image/*" hidden data-scprof="photo"></label><label class="phl"><input type="file" accept="image/*" hidden data-scprof="photo">'+(SC._phUp?"Uploading\u2026":(pic?"Change the picture":"Add a picture"))+'</label><textarea class="sc-in" id="scPBio" rows="2" maxlength="280" placeholder="One or two lines about you">'+esc(c.bio||"")+'</textarea><input class="sc-in" id="scPFb" maxlength="200" placeholder="facebook.com/your.profile" value="'+esc(c.facebook_url||"")+'"><input class="sc-in" id="scPHome" maxlength="60" placeholder="Where you\u2019re from (optional)" value="'+esc(c.home||"")+'"><div class="sc-row"><button type="button" class="sc-btn" data-scc="prof-save">Save the profile</button></div></div>';
}
function profileHTML(p,w){
  var nm=p.full_name?properCase(p.full_name):p.handle,role=p.role==="keymaster"?"The Keymaster":p.role==="seat"?"Seat of "+p.letter:"Applicant for "+p.letter,self=p.uid===w.uid,ck=p.checks||{};
  var h='<div class="sheet-card"><button type="button" class="sc-close" data-scx>\u2715</button><div class="sc-pp"><div class="ph"'+(p.photo_url?' data-sclb="'+esc(p.photo_url)+'" style="cursor:zoom-in"':"")+'>'+(p.photo_url?'<img src="'+esc(p.photo_url)+'" alt="">':esc(nm.charAt(0)))+'</div><div class="nm">'+esc(nm)+'</div><div class="rl">'+esc(role)+'</div><div class="hd">@'+esc(p.handle)+(p.home?" \u00B7 "+esc(p.home):"")+"</div>"+(p.bio?'<div class="bio">\u201C'+esc(p.bio)+"\u201D</div>":"")+"</div>";
  h+='<div class="sc-pstats"><div><b>'+fact(p.hrs!=null?Math.round(+p.hrs):null)+'</b><span>hours on the book</span></div><div><b>'+(p.member_since?new Date(ts(p.member_since)).toLocaleDateString(void 0,{month:"short",year:"2-digit"}):"\u2014")+'</b><span>member since</span></div><div><b>'+(p.seated_at?new Date(ts(p.seated_at)).toLocaleDateString(void 0,{month:"short",year:"2-digit"}):"\u2014")+'</b><span>seated</span></div><div><b>'+(p.days_active_30||0)+'</b><span>days in, 30d</span></div><div><b>'+(p.jobs_paid||0)+' \u00B7 '+(p.bucks_paid||0)+' \u2693</b><span>jobs \u00B7 paid</span></div><div><b>'+(p.votes_cast||0)+' \u00B7 '+(p.motions_put||0)+'</b><span>votes \u00B7 motions</span></div></div>';
  h+='<div class="sc-pline"><i>\u2302</i>'+(p.last_seen?"Last seen "+ago(ts(p.last_seen)):"")+"<small>"+(p.said||0)+" said at the table</small></div>";
  p.facebook_url&&(h+='<div class="sc-pline"><i>f</i><a href="'+esc(p.facebook_url)+'" target="_blank" rel="noopener">Facebook profile</a></div>');
  Object.keys(ck).length&&(h+='<div class="sc-sec">Facebook groups</div><div class="sc-grp">'+GROUPS.map(function(g){var k=ck[g[0]],s2=k?k.s:"o";return '<div class="g"><i class="'+s2+'">'+({y:"\u2713",n:"\u2717",q:"?",o:"\u00B7"})[s2]+"</i><b>"+g[1]+(k&&k.note?"<small>"+esc(k.note)+"</small>":"")+"</b></div>"}).join("")+"</div>");
  self&&(h+='<div class="sc-row"><button type="button" class="sc-btn ghost" data-scc="my-votes">\u2713 Votes I cast</button><button type="button" class="sc-btn ghost" data-scc="prof-edit">Edit my profile</button></div>');
  return h+"</div>";
}
function openMyVotes(){
  var sh=sheetEl("scMyVotes","sc-sheet",97);
  sh.innerHTML='<div class="sheet-card"><button type="button" class="sc-close" data-scx>\u2715</button><div class="sc-sec">Votes you cast</div><p class="sc-p dim">Loading\u2026</p></div>';sh.classList.add("on");
  rpc("sc_my_votes").then(function(rows){
    rows=rows||[];var mo=rows.filter(function(r){return r.kind==="motion"}),se=rows.filter(function(r){return r.kind==="seat"}),su=rows.filter(function(r){return r.kind==="succession"});
    var line=function(r){
      var when=r.at?new Date(ts(r.at)).toLocaleDateString(void 0,{month:"short",day:"numeric"}):"",st=r.kind==="motion"?(r.state==="open"?"still open":r.state==="carried"||r.state==="decreed"?"carried":r.state==="failed"?"failed":r.state):(r.state==="asked"?"election open":r.state==="seated"?"seated":r.state==="declined"?"declined":r.state||""),
          ch=r.kind==="motion"?(r.choice==="aye"?"Aye":r.choice==="nay"?"Nay":"Abstain"):"Voted for";
      return '<div class="sc-li"><div class="L'+(r.choice==="nay"?'" style="background:#e07a6e;color:#fff':r.choice==="pass"?' open':"")+'">'+(r.kind==="motion"?(r.choice==="aye"?"\u2713":r.choice==="nay"?"\u2717":"\u2013"):esc(r.letter||"\u269C"))+'</div><div class="d">'+(r.kind==="motion"?esc(r.title):esc(r.title)+" \u00B7 the seat of "+esc(r.letter||""))+"<small>"+ch+" \u00B7 "+when+" \u00B7 "+st+"</small></div></div>";
    };
    sh.innerHTML='<div class="sheet-card"><button type="button" class="sc-close" data-scx>\u2715</button><div class="sc-h2" style="margin-bottom:6px"><div class="crest">\u269C</div><div><h1 style="font-size:16px">Votes you cast</h1><div class="who">'+rows.length+" in all</div></div></div>"
      +'<div class="sc-sec">Motions <em>'+mo.length+"</em></div>"+(mo.map(line).join("")||'<p class="sc-p dim">You haven\u2019t voted on a motion yet.</p>')
      +'<div class="sc-sec">Seat elections <em>'+se.length+"</em></div>"+(se.map(line).join("")||'<p class="sc-p dim">No election votes yet.</p>')
      +(su.length?'<div class="sc-sec">Succession</div>'+su.map(line).join(""):"")
      +'<div class="sc-row"><button type="button" class="sc-btn ghost" data-scx>Close</button></div></div>';
  }).catch(function(e){sh.innerHTML='<div class="sheet-card"><button type="button" class="sc-close" data-scx>\u2715</button><p class="sc-p">\u2717 '+esc(e&&e.message||e)+"</p></div>"});
}
function openProfile(handle){
  var p=personOf(handle);if(!p){say("No profile yet.");return}
  var sh=sheetEl("scProfile","sc-sheet",97);sh.innerHTML=profileHTML(p,me());sh.classList.add("on");hum([8]);
}
function deskHTML(w){
  var T=SC.traffic,h='<div class="sc-stat"><div><b>'+T.today+"</b><span>in today</span></div><div><b>"+T.week+"</b><span>this week</span></div><div><b>"+T.month+'</b><span>30 days</span></div></div>';
  h+=applicantsHTML(w);
  h+=banRecordHTML(w);
  if(w.head){
    h+='<div class="sc-sec">Keeper of the Count</div><div class="sc-li"><div class="L">'+(SC.teller&&seatOf(SC.teller)||"?")+'</div><div class="d">'+esc(SC.teller?nameOf(SC.teller):"Nobody")+'<small>seals the vote, works the count, announces it</small></div></div><select class="sc-in" id="scTeller" style="margin:8px 0">'+seated().map(function(L){return '<option value="'+esc(SC.seats[L].holder)+'"'+(SC.seats[L].holder===SC.tellerUid?" selected":"")+">"+L+" · "+esc(nameOf(SC.seats[L].handle))+"</option>"}).join("")+'</select><div class="sc-row"><button type="button" class="sc-btn ghost" data-scc="teller">Appoint</button></div>';
    var asks=SC.bans.filter(function(b){return b.state==="asked"});
    h+='<div class="sc-sec">Ban requests'+(asks.length?" <em>"+asks.length+"</em>":"")+"</div>"+(asks.length?asks.map(function(b){return '<div class="sc-li q"><div class="L">'+esc(b.who.charAt(0))+'</div><div class="d">'+esc(b.who)+"<small>asked by "+esc(nameOf(b.by))+" · "+esc(b.why)+" · "+ago(b.at)+'</small></div><div class="act"><button type="button" class="n" data-scb="granted" data-c="'+b.id+'">Ban</button><button type="button" data-scb="refused" data-c="'+b.id+'">Refuse</button></div></div>'}).join(""):'<p class="sc-p dim">None waiting.</p>');
    SC.succession&&(h+='<div class="sc-sec">Succession</div><p class="sc-p">The seat is open. '+Object.keys(SC.succession.votes).length+" of "+seated().length+" have voted. The Keeper of the Count seals it.</p>");
    h+='<div class="sc-sec">The line · pushed up to you'+(SC.line.length?" <em>"+SC.line.length+"</em>":"")+"</div>"+(SC.line.length?SC.line.map(function(l){return '<div class="sc-li q"><div class="L">'+esc(l.letter)+'</div><div class="d">'+esc(l.from)+"<small>"+esc(l.body)+" · "+ago(l.at)+'</small></div><div class="act"><button type="button" class="y" data-scn="answer" data-c="'+l.id+'">Answered</button></div></div>'}).join(""):'<p class="sc-p dim">The line is clear.</p>');
  }else{
    if(SC.succession){var S=SC.succession,mine=S.votes[w.handle];
      h+='<div class="sc-sec">Succession · the seat is open</div>'+(S.sealed?'<p class="sc-p">Sealed. '+esc(nameOf(S.winner))+" takes the table.</p>":'<p class="sc-p">'+(mine?"You voted for <b>"+esc(nameOf(mine))+"</b>. ":"One vote, for one seat holder. ")+Object.keys(S.votes).length+" of "+seated().length+" cast.</p>"+(mine?"":'<select class="sc-in" id="scSucc" style="margin-bottom:8px">'+seated().map(function(L){return '<option value="'+esc(SC.seats[L].holder)+'">'+L+" · "+esc(nameOf(SC.seats[L].handle))+"</option>"}).join("")+'</select><div class="sc-row"><button type="button" class="sc-btn" data-scc="succ-vote">Cast the vote</button></div>')+(w.handle===SC.teller?'<div class="sc-row"><button type="button" class="sc-btn" data-scc="succ-seal">\u269C Seal the count and announce</button></div>':""));}
    var q=SC.inbox.filter(function(x){return x.letter===w.seat&&x.state!=="answered"}).sort(function(a,b){return a.at-b.at});
    h+='<div class="sc-sec">Questions on '+esc(w.seat)+(q.length?" <em>"+q.length+"</em>":"")+"</div>"+(q.length?q.map(function(x){var late=x.state==="open"&&Date.now()-x.at>SC.lateAfter;return '<div class="sc-li q"><div class="L">'+esc(x.letter)+'</div><div class="d">'+esc(x.from)+"<small>"+esc(x.body)+" · "+ago(x.at)+(x.state==="pushed"?' · <b style="color:var(--sc-gold-hi)">with the Keymaster</b>':late?' · <b style="color:#e07a6e">late \u2014 on the Jobs board</b>':"")+'</small></div><div class="act">'+(x.state==="open"?'<button type="button" class="y" data-scq="answered" data-c="'+x.id+'">Answered</button><button type="button" data-scq="push" data-c="'+x.id+'">\u2192 Keymaster</button>':'<button type="button" class="y" data-scq="answered" data-c="'+x.id+'">Answered</button>')+"</div></div>"}).join(""):'<p class="sc-p dim">Nothing waiting on '+esc(w.seat)+".</p>");
    h+='<div class="sc-sec">Misconduct</div>'+(SC._banOpen?'<p class="sc-p dim">A regular member, and what they did. Council members can\u2019t be named here.</p><input class="sc-in" id="scBanWho" maxlength="24" placeholder="Handle" style="margin-bottom:8px"><textarea class="sc-in" id="scBanWhy" rows="2" maxlength="240" placeholder="What happened, plainly" style="margin-bottom:8px"></textarea><div class="sc-row"><button type="button" class="sc-btn ghost" data-scc="ban-cancel">Never mind</button><button type="button" class="sc-btn red" data-scc="ban-ask">Request the ban</button></div>':'<div class="sc-row"><button type="button" class="sc-btn ghost" data-scc="ban-open">Report serious misconduct</button></div>');
    h+='<div class="sc-sec">Your seat</div><div class="sc-li"><div class="L">'+esc(w.seat)+'</div><div class="d">Seat of '+esc(w.seat)+"<small>seated "+ago((SC.seats[w.seat]||{}).since||Date.now())+'</small></div><div class="act"><button type="button" class="n" data-scgo="giveup">Retire the seat</button></div></div>';
  }
  h+='<div class="sc-sec">Your record</div><div class="sc-row" style="margin-top:0"><button type="button" class="sc-btn ghost" data-scc="my-votes">\u2713 Votes I cast</button><button type="button" class="sc-btn ghost" data-scpp="'+esc(w.handle)+'">\u269C My profile</button></div>';
  h+=myCardHTML(w);
  h+='<div class="sc-sec">The council</div>'+LETTERS.map(function(L){var s=SC.seats[L];return '<div class="sc-li"'+(s?' data-scpp="'+esc(s.handle)+'"':"")+'><div class="L'+(s?"":" open")+'">'+L+'</div><div class="d">'+(s?esc(nameOf(s.handle,s.holder))+"<small>@"+esc(s.handle)+" · seated "+ago(s.since)+"</small>":'<span style="color:var(--sc-dim)">open seat</span>')+"</div></div>"}).join("");
  w.head&&!SC.succession&&(h+='<div class="sc-sec" style="margin-top:26px">Succession</div>'+(SC._succOpen?'<p class="sc-p dim">When you move up to the union, open the seat here. Every seat holder votes for one of their own; the Keeper of the Count seals it and announces your successor. This can\u2019t be taken back.</p><div class="sc-row"><button type="button" class="sc-btn ghost" data-scc="succ-cancel">Not yet</button><button type="button" class="sc-btn red" data-scc="open-seat">Open the Keymaster\u2019s seat</button></div>':'<p class="sc-p dim">For the day you move up to the union.</p><div class="sc-row"><button type="button" class="sc-btn ghost" data-scc="succ-open">Give up the table\u2026</button></div>'));
  return h;
}

/* ===== header ===== */
function headerHTML(w,N,realHead,pvL){
  var inN=0;try{inN=seated().filter(function(L){return inRoom(SC.seats[L].handle)}).length+(inRoom(SC.head.handle)?1:0)}catch(e){}
  return '<div class="sc-h2"><div class="crest">\u269C</div><div><h1>The Chamber</h1><div class="who">'+(w.head?"You hold the table":"<b>"+esc(nameOf(w.handle,w.uid))+"</b> · Seat of "+esc(w.seat))+" <b>·</b> "+N+" seated, "+(26-N)+' open</div></div><button type="button" class="sc-close" data-scx>\u2715</button></div>'
    +'<div class="sc-tools"><button type="button" class="sc-chip'+(SC._floorOff?"":" on")+'" data-scc="floor">\u2302 The floor · '+inN+' in</button><button type="button" class="sc-chip" data-scc="charter">\u2696 Charter</button><button type="button" class="sc-chip'+(alertsOn()?" on":"")+'" data-scc="alerts">\uD83D\uDD14 Alerts '+(alertsOn()?"on":"off")+'</button>'+(realHead?'<button type="button" class="sc-chip" data-scpv="'+(pvL?"off":"on")+'">\uD83D\uDC41 '+(pvL?"Back to the table":"Seat view")+"</button>":"")+"</div>"
    +(pvL?'<div class="sc-pv">\uD83D\uDC41 Previewing what <b>'+esc(nameOf(w.handle))+"</b> (Seat of "+esc(pvL)+") sees · votes here don\u2019t count</div>":"");
}

    function paintChamber() {
        var sh = $("scChamber");
        if (sh) {
            var w = me(),
                N = seated().length,
                keep = null;
            try {
                var ae = document.activeElement;
                ae && sh.contains(ae) && ae.id && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName) && (keep = {
                    id: ae.id,
                    v: ae.value,
                    s: ae.selectionStart,
                    e: ae.selectionEnd
                });
                var body = sh.querySelector(".sc-body"),
                    st = body ? body.scrollTop : 0
            } catch {}
            var vals = {};
            try {
                sh.querySelectorAll("input[id],textarea[id],select[id]").forEach(function(el2) {
                    el2.value && (vals[el2.id] = el2.value)
                })
            } catch {}
            paintChamberNow(w, N);
            try {
                if (Object.keys(vals).forEach(function(id) {
                        var el2 = $(id);
                        el2 && !el2.value && (el2.value = vals[id])
                    }), keep) {
                    var el = $(keep.id);
                    if (el) {
                        el.value = keep.v, el.focus({
                            preventScroll: !0
                        });
                        try {
                            el.setSelectionRange(keep.s, keep.e)
                        } catch {}
                    }
                }
                var b2 = sh.querySelector(".sc-body");
                b2 && keep && (b2.scrollTop = st)
            } catch {}
        }
    }

    function paintChamberNow(w, N) {
        try {
            scMarkSeen(tab)
        } catch (e) {}
        var realHead = w.head,
            pvL = realHead && SC._preview ? SC._preview : null;
        pvL && (w = Object.assign({}, w, {
            head: !1,
            seat: pvL,
            handle: (SC.seats[pvL] || {}).handle || w.handle
        }));
        var sh = $("scChamber"),
            open = SC.motions.filter(function(m) {
                return m.state === "open" && !(m.votes || {})[w.handle]
            }).length,
            wait = w.head ? SC.claims.length + SC.line.length : SC.inbox.filter(function(x) {
                return x.letter === w.seat && x.state === "open"
            }).length,
            jobsOpen = w.head ? SC.jobs.filter(function(j) {
                return j.state === "done"
            }).length : openJobs().length,
            h = '<div class="sheet-card">' + headerHTML(w, N, realHead, pvL) + (SC.announce ? '<div class="sc-announce">\u269C ' + SC.announce + "</div>" : "") + '<div class="sc-tabs"><button type="button" data-sct="table" class="' + (tab === "table" ? "on" : "") + '">Table</button><button type="button" data-sct="motions" class="' + (tab === "motions" ? "on" : "") + '">Motions' + (open ? "<i>" + open + "</i>" : "") + '</button><button type="button" data-sct="jobs" class="' + (tab === "jobs" ? "on" : "") + '">Jobs' + (jobsOpen ? "<i>" + jobsOpen + "</i>" : "") + '</button><button type="button" data-sct="desk" class="' + (tab === "desk" ? "on" : "") + '">Desk' + (wait ? "<i>" + wait + "</i>" : "") + '</button></div><div class="sc-body">' + (tab === "table" ? tableHTML(w) : tab === "motions" ? motionsHTML(w) : tab === "jobs" ? jobsHTML(w) : deskHTML(w)) + "</div>" + (tab === "table" ? composeHTML() : "") + "</div>",
            card = sh.querySelector(".sheet-card");
        if (!card || sh._scTab !== tab) {
            sh.innerHTML = h, sh._scTab = tab, sh._scHTML = h;
            return
        }
        if (sh._scHTML !== h) {
            var t = document.createElement("div");
            t.innerHTML = h;
            var nc = t.firstElementChild,
                grew = !1;
            [".sc-h2", ".sc-tools", ".sc-pv", ".sc-announce", ".sc-tabs", ".sc-body", ".sc-compose"].forEach(function(q) {
                var o = card.querySelector(":scope > " + q),
                    n = nc.querySelector(":scope > " + q);
                if (!(!o && !n)) {
                    if (o && !n) {
                        o.remove();
                        return
                    }
                    if (!(o && n && o.outerHTML === n.outerHTML)) {
                        if (q === ".sc-body" && o && n) {
                            var keep = o.scrollTop;
                            o.innerHTML = n.innerHTML, o.scrollTop = keep;
                            return
                        }
                        if (o && n) {
                            o.replaceWith(n);
                            return
                        }
                        var after2 = nc.querySelector(":scope > " + q).previousElementSibling,
                            anchor = after2 ? card.querySelector(":scope > ." + after2.className.split(" ")[0]) : null;
                        anchor ? anchor.after(n) : card.appendChild(n), grew = !0
                    }
                }
            }), sh._scHTML = h
        }
    }
    var after = function(msg, pat) {
            return function() {
                msg && say(msg), hum(pat || [20, 40, 60]), reload().then(paintChamber)
            }
        },
        nope = function(e) { try { e && e.message && say("\u2717 " + e.message) } catch (x) {} };
    document.addEventListener("change", function(ev) {
        var inp = ev.target;
        if (inp && inp.getAttribute && inp.getAttribute("data-scprof") === "for") { var fu = inp.getAttribute("data-u"), ff = inp.files && inp.files[0]; inp.value = ""; if (!ff) return; say("Uploading…"); uploadAtt(ff).then(function(a) { return rpc("sc_profile_photo_for", { p_uid: fu, p_photo: a.url }) }).then(after("✓ Picture set, council only", [12])).catch(function(e) { say("✗ " + (e && e.message || e)) }); return }
        if (inp && inp.getAttribute && inp.getAttribute("data-scprof") === "photo") { inp.files && inp.files[0] && uploadProfilePhoto(inp.files[0]); inp.value = ""; return }
        if (inp && inp.getAttribute && inp.getAttribute("data-scatt")) { addFiles(inp.files); inp.value = ""; var tr = $("scTray"); tr && tr.classList.remove("on"); return }
        if (!(!inp || !inp.getAttribute || !inp.getAttribute("data-schf"))) {
            var C = window.HOUSE_CHORES;
            if (C) {
                var fs = [].slice.call(inp.files || []),
                    k = inp.getAttribute("data-schf"),
                    ttl = inp.getAttribute("data-t");
                inp.value = "", fs.length && (say("Reading the PDF\u2026"), SC._pmaProof = { head: "Reading\u2026", text: fs.map(function(f) { return f.name }).join(", ") }, paintChamber(), Promise.resolve(C.addPma(fs)).then(function() {
                    try { var g = window.PMA_API && PMA_API.get ? PMA_API.get(k) : null, HL = g && g.los && g.los["Total Longshore"]; SC._pmaProof = g ? { head: "Read \u00B7 " + C.name(k), text: (HL && HL.Total && HL.Total.T ? "Total longshore " + HL.Total.T + ". " : "") + (g.hoot && g.hoot.total ? "Shift 3 hoot owl " + g.hoot.total + ". " : "") + (g.held ? "On hold \u2014 check the To-Do." : "On the record, claimed by you."), warn: !!g.held } : { head: "Added", text: "On the record." } } catch (e) { SC._pmaProof = { head: "Added", text: "On the record." } }

                    return rpc("sc_chore_done", {
                        p_kind: "pma",
                        p_key: k || fs[0].name,
                        p_title: ttl || "PMA sheet \xB7 " + fs[0].name
                    })
                }).then(function() {
                    after("\u{1F4C4} On the record \u2014 claimed for the Keymaster to pay", [20, 40, 20])()
                }).catch(function(e) {
                    say("\u2717 " + (e && e.message || e))
                }))
            }
        }
    }), document.addEventListener("click", function(ev) {
        var sh = $("scChamber");
        if (!(!sh || !sh.classList.contains("on"))) {
            var w = me(),
                t = ev.target.closest && ev.target.closest("[data-sct]");
            if (t && !ev.target.closest("[data-scmsg]")) {
                tab = t.getAttribute("data-sct"), paintChamber(), hum([8]);
                return
            }
            var fb = ev.target.closest && ev.target.closest("[data-scfb]");
            if (fb && w.head) { var cur = ((SC.extras || {})[fb.getAttribute("data-scfb")] || {}).facebook_url || "", u = prompt("Their Facebook profile link", cur); if (u === null) return; rpc("sc_profile_fb_for", { p_uid: fb.getAttribute("data-scfb"), p_facebook: u.trim() }).then(after(u.trim() ? "\u2713 Facebook link added" : "Link removed", [12])).catch(nope); return }
            var sph = ev.target.closest && ev.target.closest("[data-scsetph]");
            if (sph && w.head && !ev.target.closest("input")) { var fi = sph.querySelector("input[type=file]"); fi && fi.click(); return }
            var pp = ev.target.closest && ev.target.closest("[data-scpp]");
            if (pp && pp.getAttribute("data-scpp") && !ev.target.closest("[data-scmsg],[data-scav],[data-scn],[data-scck],a,button,input")) { openProfile(pp.getAttribute("data-scpp")); return }
            var tg = ev.target.closest && ev.target.closest("[data-sctog]");
            if (tg) { var kk = tg.getAttribute("data-sctog"); SC._jobOpen = SC._jobOpen || {}; SC._jobOpen[kk] = SC._jobOpen[kk] === false; tg.parentNode.classList.toggle("open", SC._jobOpen[kk] !== false); return }
            var lb = ev.target.closest && ev.target.closest("[data-sclb]");
            if (lb) { var box = document.createElement("div"); box.className = "sc-lb"; box.innerHTML = '<img src="' + esc(lb.getAttribute("data-sclb")) + '" alt=""><button type="button">\u2715</button>'; box.onclick = function() { box.remove() }; document.body.appendChild(box); return }
            var yt = ev.target.closest && ev.target.closest("[data-scyt]");
            if (yt && !yt.querySelector("iframe")) { var vid = yt.getAttribute("data-scyt"); SC._playing = vid; yt.innerHTML = '<iframe src="https://www.youtube.com/embed/' + encodeURIComponent(vid) + '?autoplay=1&playsinline=1&rel=0&modestbranding=1" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>'; return }
            var rm = ev.target.closest && ev.target.closest("[data-scrm]");
            if (rm) { pend.splice(+rm.getAttribute("data-scrm"), 1); paintPend(); return }
            var ck = ev.target.closest && ev.target.closest("[data-scck]");
            if (ck && w.head) {
                var cs = ck.getAttribute("data-scck"), note = cs === "y" ? null : prompt(cs === "q" ? "What's unsure? (shows under the group)" : "Why not? (shows under the group)", "");
                if (note === null && cs !== "y") return;
                rpc("sc_check_set", { p_uid: ck.getAttribute("data-u"), p_grp: ck.getAttribute("data-g"), p_status: cs, p_note: note || null }).then(after(cs === "y" ? "\u2713 Verified" : "Saved", [12])).catch(nope); return
            }
            var rvb = ev.target.closest && ev.target.closest("[data-screvote]");
            if (rvb && w.head) { openRevote(rvb.getAttribute("data-screvote")); return }
            var ch = ev.target.closest && ev.target.closest("[data-sch]");
            if (ch) {
                var C = window.HOUSE_CHORES,
                    a = ch.getAttribute("data-sch"),
                    k = ch.getAttribute("data-k");
                if (!C) return;
                if (a === "out") {
                    C.outside(ch.getAttribute("data-u"));
                    return
                }
                if (a === "call") {
                    if (ch.disabled) return;
                    ch.disabled = !0;
                    rpc("sc_hall_start", { p_key: k }).then(function(r) {
                        if (!r || !r.ok) {
                            var why = r && r.why;
                            say(why === "busy" ? "\u260E " + nameOf(r.by) + " is already on the line." : why === "done" ? "\u2713 Already logged" + (r.by ? " by " + nameOf(r.by) : "") + "." : why === "spent" ? "Both calls were used on this board." : why === "cooldown" ? "Call again in " + mmss(ts(r.until) - Date.now()) + "." : "Not now.");
                            hum([30, 30, 30]); reload().then(paintChamber); return;
                        }
                        window.__hlCall = { k: k, at: Date.now() };
                        var back = function() {
                            if (document.visibilityState !== "visible") return;
                            var c2 = window.__hlCall; if (!c2 || Date.now() - c2.at < 2500 || Date.now() - c2.at > 15 * 6e4) return;
                            window.__hlCall = null; document.removeEventListener("visibilitychange", back); window.removeEventListener("focus", back);
                            rpc("sc_hall_hangup", { p_key: c2.k }).catch(nope);
                            var s2 = $("scChamber"); s2 && s2.classList.remove("on");
                            setTimeout(function() { c2.k && C.log(c2.k) }, 250);
                        };
                        document.addEventListener("visibilitychange", back); window.addEventListener("focus", back);
                        reload().then(paintChamber); hum([15]); location.href = HALL_TEL_;
                    }).catch(function(e) { ch.disabled = !1; say("\u2717 " + (e && e.message || e)) });
                    return
                }
                if (a === "hangup") {
                    rpc("sc_hall_hangup", { p_key: k }).catch(nope);
                    sh.classList.remove("on"); setTimeout(function() { C.log(k) }, 200); return
                }
                if (a === "log" || a === "enter" || a === "fix") {
                    if (!k) {
                        say("Nothing to open yet");
                        return
                    }
                    sh.classList.remove("on"), setTimeout(function() {
                        a === "log" ? C.log(k) : a === "fix" ? C.fix(k) : C.enter(k, ch.getAttribute("data-w"))
                    }, 150);
                    return
                }
                if (a === "done") {
                    ch.disabled = !0, rpc("sc_chore_done", {
                        p_kind: ch.getAttribute("data-kind"),
                        p_key: k,
                        p_title: ch.getAttribute("data-t")
                    }).then(function(r) {
                        after(r && r.ok ? "\u2713 Claimed \u2014 the Keymaster pays it out" : "Already claimed", [20, 40, 20])()
                    }).catch(function(e) {
                        ch.disabled = !1, say("\u2717 " + (e && e.message || e))
                    });
                    return
                }
                return
            }
            var v = ev.target.closest && ev.target.closest("[data-scv]");
            if (v && SC._preview) {
                say("Preview only \u2014 the seat holders cast these.");
                return
            }
            if (v) {
                rpc("sc_vote", {
                    p_motion: v.getAttribute("data-m"),
                    p_choice: v.getAttribute("data-scv")
                }).then(function(st) {
                    after(st === "carried" ? "\u269C The motion carries." : st === "failed" ? "The motion fails." : "Vote cast.", st === "carried" ? [40, 40, 120] : [15])()
                }).catch(nope);
                return
            }
            var d = ev.target.closest && ev.target.closest("[data-scd]");
            if (d && w.head) {
                var ok = d.getAttribute("data-scd") === "carried",
                    go = function() {
                        rpc("sc_decree", {
                            p_motion: d.getAttribute("data-m"),
                            p_ok: ok
                        }).then(after(ok ? "\u269C So decreed." : "Struck down.", [60])).catch(nope)
                    },
                    q = ok ? "Decree this motion carried? That ends the vote now and announces it at the table." : "Strike this motion down? That ends the vote now.";
                try {
                    shConfirm(q, go, {
                        title: ok ? "Decree it carried" : "Strike it down",
                        okText: ok ? "Decree" : "Strike"
                    })
                } catch (e9) {
                    confirm(q) && go()
                }
                return
            }
            var n = ev.target.closest && ev.target.closest("[data-scn]");
            if (n && w.head) {
                var k = n.getAttribute("data-scn"),
                    id = n.getAttribute("data-c");
                if (k === "seat") {
                    var c = SC.claims.filter(function(x2) {
                        return x2.id === id
                    })[0];
                    rpc("sc_decide", {
                        p_id: id,
                        p_ok: !0
                    }).then(after("\u269C " + (c ? c.handle : "") + " is seated at " + (c ? c.letter : "") + ". DM sent \xB7 Keymaster.", [40, 40, 120])).catch(nope)
                } else k === "decline" ? rpc("sc_decide", {
                    p_id: id,
                    p_ok: !1
                }).then(after("Claim declined. DM sent \xB7 Keymaster.")).catch(nope) : k === "answer" && rpc("sc_answered", {
                    p_id: id
                }).then(after("Marked answered.", [12])).catch(nope);
                return
            }
            var av = ev.target.closest && ev.target.closest("[data-scav]");
            if (av) {
                rpc("sc_claim_vote", {
                    p_claim: av.getAttribute("data-scav")
                }).then(after("Vote cast.", [15])).catch(nope);
                return
            }
            var sl = ev.target.closest && ev.target.closest("[data-scseal]");
            if (sl) {
                var SL = sl.getAttribute("data-scseal");
                rpc("sc_elect_seal", {
                    p_letter: SL
                }).then(function(r) {
                    after("\u269C " + r + " takes the seat of " + SL + ", elected by the council.", [40, 40, 120])()
                }).catch(nope);
                return
            }
            var qq = ev.target.closest && ev.target.closest("[data-scq]");
            if (qq && w.seat) {
                var x = SC.inbox.filter(function(i) {
                    return i.id === qq.getAttribute("data-c")
                })[0];
                if (!x) return;
                qq.getAttribute("data-scq") === "push" ? rpc("sc_push", {
                    p_council_line: x.id
                }).then(after("Pushed to the Keymaster.")).catch(nope) : rpc("sc_inbox_done", {
                    p_member: x.member
                }).then(after("Marked answered.", [12])).catch(nope);
                return
            }
            var jb = ev.target.closest && ev.target.closest("[data-scj]");
            if (jb) {
                var jid = jb.getAttribute("data-c"),
                    op = jb.getAttribute("data-scj");
                if (jid.indexOf("q:") === 0) {
                    op === "take" && rpc("sc_job_from_line", {
                        p_council_line: jid.slice(2)
                    }).then(after("It\u2019s yours. Answer them and mark it done.")).catch(nope);
                    return
                }
                var j = SC.jobs.filter(function(i) {
                    return i.id === jid
                })[0];
                if (!j) return;
                op === "take" ? rpc("sc_job_take", {
                    p_id: jid
                }).then(after("\u2692 Taken. " + j.bucks + " \u2693 when it\u2019s done and paid.")).catch(nope) : op === "done" ? rpc("sc_job_done", {
                    p_id: jid
                }).then(after("Marked done. The Keymaster pays it out.", [40, 40, 120])).catch(nope) : op === "pay" && w.head && rpc("sc_job_pay", {
                    p_id: jid
                }).then(after("\u2693 " + j.bucks + " paid to " + j.taker + ".", [40, 40, 120])).catch(nope);
                return
            }
            var bb = ev.target.closest && ev.target.closest("[data-scb]");
            if (bb && w.head) {
                var ok2 = bb.getAttribute("data-scb") === "granted",
                    br = SC.bans.filter(function(x2) {
                        return x2.id === bb.getAttribute("data-c")
                    })[0],
                    why2 = prompt(ok2 ? "Ban " + (br ? br.who : "them") + ". The reason (it goes on the table and on their ban notice):" : "Refuse the ban on " + (br ? br.who : "them") + ". Why? (it goes on the table)", "");
                if (why2 === null) return;
                if (!why2.trim()) {
                    say("Give the table a reason.");
                    return
                }
                rpc("sc_ban_decide", {
                    p_id: bb.getAttribute("data-c"),
                    p_ok: ok2,
                    p_note: why2.trim()
                }).then(after(ok2 ? "\u2620 " + (br ? br.who : "") + " is banned." : "Refused \u2014 the table has your reason.")).catch(nope);
                return
            }
            var pvb = ev.target.closest && ev.target.closest("[data-scpv]");
            if (pvb) {
                SC._preview = pvb.getAttribute("data-scpv") === "on" ? seated()[0] || "A" : null;
                paintChamber();
                return
            }
            var tb = ev.target.closest && ev.target.closest("[data-scmsg]");
            if (tb) {
                var tid = tb.getAttribute("data-c"),
                    tm = SC.table.filter(function(x3) {
                        return x3.id === tid
                    })[0];
                if (!tm) return;
                if (tb.getAttribute("data-scmsg") === "edit") {
                    var nt = prompt("Edit what you said:", tm.raw);
                    if (nt === null || !nt.trim() || nt.trim() === tm.raw) return;
                    rpc("sc_table_edit", {
                        p_id: tid,
                        p_body: nt.trim()
                    }).then(after("\u270E Edited.", [12])).catch(nope);
                    return
                }
                try {
                    shConfirm("Take this off the table for everyone?", function() {
                        rpc("sc_table_delete", {
                            p_id: tid
                        }).then(after("Taken off the table.", [12])).catch(nope)
                    }, {
                        title: "Delete message",
                        okText: "Delete"
                    })
                } catch (e9) {
                    confirm("Take this off the table for everyone?") && rpc("sc_table_delete", {
                        p_id: tid
                    }).then(after("Taken off the table.", [12])).catch(nope)
                }
                return
            }
            var c = ev.target.closest && ev.target.closest("[data-scc]");
            if (c) {
                var kind = c.getAttribute("data-scc");
                if (kind === "charter") {
                    ev.preventDefault(), openCharter();
                    return
                }
                if (kind === "floor") { SC._floorOff = !SC._floorOff; var fw = sh.querySelector(".sc-floorwrap"); fw && fw.classList.toggle("on", !SC._floorOff); c.classList.toggle("on", !SC._floorOff); return }
                if (kind === "alerts") { var on = !alertsOn(); try { localStorage.setItem("shk_sc_alerts", on ? "1" : "0") } catch (e) {} say(on ? "\uD83D\uDD14 Chamber alerts on" : "Chamber alerts off"); paintChamber(); if (on) try { typeof Notification !== "undefined" && Notification.permission === "default" && Notification.requestPermission() } catch (e) {} return }
                if (kind === "my-votes") { openMyVotes(); return }
                if (kind === "prof-save") {
                    rpc("sc_profile_set", { p_photo: SC._phUrl || ((personOf(w.handle, w.uid) || {}).photo_url) || "", p_bio: ($("scPBio").value || "").trim(), p_facebook: ($("scPFb").value || "").trim(), p_phone: "", p_home: ($("scPHome").value || "").trim() }).then(function() { SC._phUrl = null; after("Profile saved. Council only.", [12])() }).catch(nope); return
                }
                if (kind === "prof-edit") { var ps = $("scProfile"); ps && ps.classList.remove("on"); tab = "desk"; paintChamber(); setTimeout(function() { var e2 = sh.querySelector(".sc-pedit"); e2 && e2.scrollIntoView({ block: "start", behavior: "smooth" }) }, 80); return }
                if (kind === "att-open") { var tr = $("scTray"); tr && tr.classList.toggle("on"); return }
                if (kind === "att-link" || kind === "att-yt") { var u = prompt(kind === "att-yt" ? "YouTube link" : "Paste the link", ""); if (u && u.trim()) addLink(u); var tr2 = $("scTray"); tr2 && tr2.classList.remove("on"); return }
                if (kind === "card-save") {
                    rpc("sc_card_set", { p_facebook: ($("scCardFb").value || "").trim(), p_photo: ($("scCardPhoto").value || "").trim(), p_bio: ($("scCardBio").value || "").trim() }).then(after("Card saved. The council sees it with your filing.", [12])).catch(nope); return
                }

                if (kind === "teller" && w.head) {
                    var tu = $("scTeller").value;
                    if (!tu) {
                        say("Seat someone first.");
                        return
                    }
                    rpc("sc_set_teller", {
                        p_uid: tu
                    }).then(after("\u269C Keeper of the Count appointed.", [40, 40, 120])).catch(nope);
                    return
                }
                if (kind === "open-seat" && w.head) {
                    var start = function() {
                        SC._succOpen = !1, rpc("sc_open_seat").then(after("The seat is open. The council votes.", [80, 40, 80, 40, 160])).catch(nope)
                    };
                    try {
                        shConfirm("Open the Keymaster\u2019s seat? Every seat holder votes for one of their own, and the Keeper of the Count announces your successor.", start, {
                            title: "Succession",
                            icon: "\u269C",
                            okText: "Open the seat"
                        })
                    } catch {
                        confirm("Open the seat?") && start()
                    }
                    return
                }
                if (kind === "succ-vote" && w.seat) {
                    rpc("sc_succ_vote", {
                        p_candidate: $("scSucc").value
                    }).then(after("Your vote is cast and sealed.")).catch(nope);
                    return
                }
                if (kind === "succ-seal" && w.uid === SC.tellerUid) {
                    rpc("sc_succ_seal").then(function(r) {
                        after(r === "tie" ? "A tie \u2014 a second round between the tied." : "\u269C Announced: " + r + " is the new Keymaster.", [40, 40, 40, 40, 200])()
                    }).catch(nope);
                    return
                }
                if (kind === "succ-open" && w.head) {
                    SC._succOpen = !0, paintChamber();
                    try {
                        var f = document.querySelector('[data-scc="open-seat"]');
                        f && f.scrollIntoView && f.scrollIntoView({
                            block: "end",
                            behavior: "smooth"
                        })
                    } catch {}
                    return
                }
                if (kind === "succ-cancel") {
                    SC._succOpen = !1, paintChamber();
                    return
                }
                if (kind === "ban-open") {
                    SC._banOpen = !0, paintChamber();
                    return
                }
                if (kind === "ban-cancel") {
                    SC._banOpen = !1, paintChamber();
                    return
                }
                if (kind === "ban-ask" && w.seat) {
                    var who = ($("scBanWho").value || "").trim(),
                        why = ($("scBanWhy").value || "").trim();
                    if (!who || why.length < 4) {
                        say("A handle and a reason.");
                        return
                    }
                    rpc("sc_ban_ask", {
                        p_who: who,
                        p_why: why
                    }).then(function() {
                        SC._banOpen = !1, after("Sent to the Keymaster.")()
                    }).catch(nope);
                    return
                }
                if (kind === "job" && w.head) {
                    var JT = ($("scJT").value || "").trim(),
                        JB = ($("scJB").value || "").trim(),
                        JP = parseInt($("scJP").value, 10) || 0;
                    if (JT.length < 4 || JP < 1) {
                        say("Give the job a line and a bounty.");
                        return
                    }
                    rpc("sc_job_post", {
                        p_title: JT,
                        p_body: JB,
                        p_bucks: JP
                    }).then(after("\u2692 Posted \xB7 " + JP + " \u2693")).catch(nope);
                    return
                }
                if (kind === "say") {
                    var txt = $("scSay") && $("scSay").value.trim() || "";
                    if (pend.some(function(p) { return p.up })) { say("Still uploading\u2026"); return }
                    var media = pend.filter(function(p) { return !p.up }).map(function(p) { var o = { kind: p.kind, url: p.url }; p.name && (o.name = p.name); p.size && (o.size = p.size); p.ext && (o.ext = p.ext); p.yt && (o.yt = p.yt); p.host && (o.host = p.host); return o });
                    if (!txt && !media.length) return;
                    $("scSay").value = "", pend = [], paintPend(); var tr3 = $("scTray"); tr3 && tr3.classList.remove("on");
                    rpc("sc_say", { p_body: txt, p_media: media }).then(after(null, [12])).catch(function(e) { say("\u2717 " + (e && e.message || e)) });
                    return
                }

                if (kind === "motion") {
                    var T = ($("scMT").value || "").trim(),
                        B = ($("scMB").value || "").trim();
                    if (T.length < 4) {
                        say("Give the motion a line.");
                        return
                    }
                    rpc("sc_motion", {
                        p_title: T,
                        p_body: B
                    }).then(after("\u269C On the floor. The table votes.")).catch(nope);
                    return
                }
            }
        }
    }, !0);
    /* jobs tab: live countdowns (hall line opens / cooldown / who's on the line) */
    setInterval(function() {
        try {
            var sh = $("scChamber"); if (!sh || !sh.classList.contains("on") || tab !== "jobs") return;
            if (sh.querySelector('[data-sch="call"][disabled], .sc-pulse')) paintChamber();
        } catch (e) {}
    }, 1000);
    /* the Hall Line is done the moment the end card is on the record: claim it for whoever called */
    setInterval(function() {
        try {
            var C = window.HOUSE_CHORES, w = me(); if (!C || !SC.loaded || !w.uid) return;
            var lb = C.lastBoard(); if (!lb) return;
            var H = hallOf(lb), due = C.list().some(function(t) { return t.kind === "log" && t.key === lb });
            if (H.done_at || due) return;
            if (H.caller === w.uid && !choreDone("log", lb) && !SC._claiming) {
                SC._claiming = 1;
                rpc("sc_chore_done", { p_kind: "log", p_key: lb, p_title: "Hall Line \u00B7 " + C.name(lb) }).then(function() { return rpc("sc_hall_logged", { p_key: lb }) }).then(after("\u260E End card logged. 10 \u2693 when the Keymaster pays.", [20, 40, 20])).catch(nope).then(function() { SC._claiming = 0 });
            } else if (!H.done_at && H.calls > 0 && !H.caller && choreDone("log", lb)) {
                rpc("sc_hall_logged", { p_key: lb }).catch(nope);
            }
        } catch (e) {}
    }, 5000);
    /* re-vote dialog */
    function openRevote(L) {
        var d = $("scRevote");
        if (!d) { d = document.createElement("div"); d.id = "scRevote"; document.body.appendChild(d); d.addEventListener("click", function(e) { if (e.target === d) d.classList.remove("on") }) }
        d.innerHTML = '<div class="card"><h2>\u21BA Re-vote \u00B7 the seat of ' + esc(L) + '</h2><p class="sc-p dim">Clears every vote on this seat and reopens it. The reason goes on the table so the council knows why.</p><label><input type="radio" name="scrv" value="The rules changed after voting opened." checked><div>The rules changed after voting opened<small>Names were revealed, a candidate was added, or the charter moved.</small></div></label><label><input type="radio" name="scrv" value="A candidate withdrew or was declined."><div>A candidate withdrew or was declined</div></label><label><input type="radio" name="scrv" value=""><div>Something else<small>Write it in below.</small></div></label><input class="sc-in" id="scRvWhy" maxlength="300" placeholder="In your words, one line" style="margin:0 0 8px"><label><input type="checkbox" id="scRvKeep"><div>Keep the same closing date<small>Otherwise the window restarts: 7 days from now.</small></div></label><div class="sc-row"><button type="button" class="sc-btn ghost" data-scrv="no">Never mind</button><button type="button" class="sc-btn red" data-scrv="go">Clear the votes</button></div></div>';
        d.classList.add("on");
        d.querySelector('[data-scrv="no"]').onclick = function() { d.classList.remove("on") };
        d.querySelector('[data-scrv="go"]').onclick = function() {
            var pick = (d.querySelector('input[name="scrv"]:checked') || {}).value || "", why = ($("scRvWhy").value || "").trim(), reason = (pick + " " + why).trim();
            if (reason.length < 4) { say("Give the table a reason."); return }
            rpc("sc_elect_revote", { p_letter: L, p_reason: reason, p_keep: $("scRvKeep").checked }).then(function(n) { d.classList.remove("on"); after("\u21BA " + n + " vote" + (n === 1 ? "" : "s") + " cleared on " + L + ". It\u2019s on the table.", [40, 40, 120])() }).catch(nope);
        };
    }
    var rtTimer = null;

    function rtKick() {
        clearTimeout(rtTimer), rtTimer = setTimeout(function() {
            reload().then(function() {
                var ch = $("scChamber");
                ch && ch.classList.contains("on") && paintChamber()
            })
        }, 350)
    }

    function rtOn() {
        try {
            if (!window.SB || window.__scRT) return;
            window.__scRT = SB.channel("shadow-council"), ["sc_seats", "sc_claims", "sc_claim_votes", "sc_table", "sc_motions", "sc_votes", "sc_jobs", "sc_line", "sc_bans", "sc_house", "sc_succ_votes", "sc_hall_line", "sc_applicant_checks", "sc_applicant_card", "sc_profile", "wire_ban_log"].forEach(function(t) {
                window.__scRT.on("postgres_changes", {
                    event: "*",
                    schema: "public",
                    table: t
                }, rtKick)
            }), [["sc_table", "INSERT"], ["sc_motions", "INSERT"], ["sc_motions", "UPDATE"], ["sc_votes", "INSERT"], ["sc_claim_votes", "INSERT"]].forEach(function(t) {
                window.__scRT.on("postgres_changes", { event: t[1], schema: "public", table: t[0] }, function(p) { try { scAlert(t[0], t[1], p && p.new, p && p.old) } catch (e) {} })
            }), window.__scRT.subscribe()
        } catch (e) {
            console.warn("[sc] realtime", e)
        }
    }
    var _fsr = window._floorSheetRepaint;
    window._floorSheetRepaint = function() {
        try {
            typeof _fsr == "function" && _fsr.apply(this, arguments)
        } catch {}
        try { watchArrivals() } catch (e) {}
        try {
            var ch = $("scChamber");
            if (ch && ch.classList.contains("on") && tab === "table") {
                var old = ch.querySelector(".sc-floor");
                if (old) {
                    var w = me(),
                        t = document.createElement("div");
                    t.innerHTML = floorSVG(w);
                    var nu = t.firstElementChild;
                    nu && nu.outerHTML !== old.outerHTML && old.replaceWith(nu)
                }
            }
        } catch {}
    }, (function() {
        var tries = 0,
            iv = setInterval(function() {
                window.SB && window.__shkUid ? (clearInterval(iv), setTimeout(function() {
                    var go = function() {
                        reload(), rtOn()
                    };
                    window.requestIdleCallback ? requestIdleCallback(go, {
                        timeout: 8e3
                    }) : go()
                }, window.__scOnDemand ? 0 : 2e4)) : ++tries > 180 && clearInterval(iv)
            }, 1e3)
    })();
    try {
        Array.isArray(window.BADGES) && !BADGES.some(function(b) {
            return b[1] && b[1].indexOf("Shadow Council \xB7") === 0
        }) && BADGES.push(["\u269C", "Shadow Council \xB7 a seat at the table", 0, 2])
    } catch {}
})();
try {
    window.SC && (window.SC._live = !0), typeof window.__scReady == "function" && window.__scReady()
} catch {}