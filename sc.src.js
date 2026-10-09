/* sc.js — THE SHADOW COUNCIL, as its own file (#sclazy, oct 9). Loaded by index.html on demand: a casual's phone never
   parses this; a seat holder's fetches it at idle; anyone who taps the door gets it on the tap. Everything the
   council was in the one-file build is here, unchanged, plus the three lines marked #sclazy. */
/* ═══════════════════════════════════════════════════════════════════════════════
   #shadowcouncil(oct8) — THE SHADOW COUNCIL · first sitting (DEMO BUILD)

   Twenty-six seats at a long table, one per board letter, and the Keymaster at the
   head of it. A seat holder represents every casual whose card starts with their
   letter: welcomes them, answers them, and when a question is too big for the seat,
   pushes it up the line to the Keymaster. Nobody outside the room learns who sits in it.

   LIVE (oct 8, #sclive): state comes off the sc_* tables (sc_seats · sc_claims · sc_table ·
   sc_motions · sc_votes · sc_jobs · sc_line · sc_bans · sc_house · sc_succ_votes), every
   action is an RPC (sc_claim, sc_decide, sc_say, sc_vote, sc_decree, sc_job_*, sc_push,
   sc_ban_ask, sc_set_teller, sc_open_seat, sc_succ_*), and realtime repaints the room.
   The Desk's letter questions come off the Council Mailbox through sc_inbox(), routed by
   the member's letter. Presence is the Floor's own roster (room 'The Chamber').

   The pieces:
     · the SEAT BOARD (#scBoard) at the top of the Hall — filled / open, never who
     · the SEAT SHEET (#scSeat) — claim your letter's seat, or give it up
     · the CHAMBER (#scChamber) — velvet and gold: THE TABLE · MOTIONS · THE DESK
     · the MARK "⚜ Shadow Council" registered on the Marks wall (locked in the demo)

   Rules of the house, as the Keymaster set them:
     · one seat per letter; the Keymaster holds no seat, he holds the table
     · a seat is claimed, then SEATED by the Keymaster's nod (a claim is not a seat)
     · a seat can be given up; the letter goes back on the board as open
     · a motion carries at two-thirds of the seated members voting AYE
     · removal for misconduct: two-thirds, or the Keymaster's direct decree
   When this goes live, every one of these becomes a row-security rule, not a line
   of client code. The shapes below are drawn so the tables can be cut to match.
   ═══════════════════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';
  var LETTERS='ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  var esc=function(s){ return (s==null?'':(''+s)).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;'); };
  var $=function(id){ return document.getElementById(id); };
  var say=function(m){ try{ toast(m); }catch(e){} };
  var hum=function(p){ try{ buzz(p||[20]); }catch(e){} };
  /* sheetEl() is the Dispatch Post's and lives inside its closure in this build — same shape, drawn here */
  var sheetEl=function(id,cls,z){ var s=$(id); if(!s){ s=document.createElement('div'); s.className='sheet '+(cls||''); s.id=id; if(z)s.style.zIndex=String(z); document.body.appendChild(s);
      s.addEventListener('click',function(e){ if(e.target===s)s.classList.remove('on'); }); } return s; };
  var ago=function(t){ var d=Math.max(0,Date.now()-t), m=Math.round(d/6e4); if(m<1)return 'just now'; if(m<60)return m+'m ago'; var h=Math.round(m/60); if(h<24)return h+'h ago'; return Math.round(h/24)+'d ago'; };

  /* ── LIVE STATE — the table as it stands on the server (#sclive) ────────────── */
  var SC=window.SC={
    head:{handle:'EXO',card:'D4928'},
    seats:{}, claims:[], table:[], motions:[], jobs:[], line:[], inbox:[], bans:[],
    teller:null, tellerUid:null, announce:null, succession:null,
    traffic:{today:'—',week:'—',month:'—',peak:'',dispatch:''},
    lateAfter:24*36e5, loaded:false
  };
  LETTERS.forEach(function(L){ SC.seats[L]=null; });
  var ts=function(x){ var t=Date.parse(x||''); return isNaN(t)?Date.now():t; };
  function isCrown(){ try{ return !!window.__isKM&&String((loadAcct()||{}).id||'').toUpperCase().trim()===SC.head.card; }catch(e){ return false; } }
  function seatOf_uid(u){ var r=null; if(!u)return null; LETTERS.forEach(function(L){ if(SC.seats[L]&&SC.seats[L].holder===u)r=L; }); return r; }
  function council(){ return !!window.__shkUid&&(isCrown()||!!seatOf_uid(window.__shkUid)); }

  /* every seat for everyone (letter + whether held); holders and handles for the council only */
  async function loadSeats(){
    var r=await SB.from('sc_seats').select('letter,seated_at'); if(r.error)throw r.error;
    LETTERS.forEach(function(L){ SC.seats[L]=null; });
    (r.data||[]).forEach(function(x){ if(x.seated_at)SC.seats[x.letter]={handle:'',since:ts(x.seated_at),holder:null}; });
    var f=await SB.rpc('sc_seats_full'); if(!f.error&&f.data&&f.data.length){ f.data.forEach(function(x){ if(x.holder)SC.seats[x.letter]={handle:x.handle||'',since:ts(x.seated_at),holder:x.holder}; }); }
  }
  async function loadClaims(){ var r=await SB.from('sc_claims').select('id,uid,handle,letter,asked_at,window_ends,note').eq('status','asked').order('asked_at'); SC.claims=(r.data||[]).map(function(c){ return {id:c.id,uid:c.uid,letter:c.letter,handle:c.handle,at:ts(c.asked_at),ends:c.window_ends?ts(c.window_ends):null,note:c.note||''}; });
    var a=await SB.rpc('sc_applicants'); SC.applicants=(a.data||[]).map(function(x){ return {id:x.id,uid:x.uid,handle:x.handle||'',letter:x.letter,note:x.note||'',at:ts(x.asked_at),ends:x.window_ends?ts(x.window_ends):null,hrs:x.hrs,since:x.member_since,days:x.days_active_30||0,calls:x.calls_30||0,seen:x.last_seen?ts(x.last_seen):null,votes:x.votes||0,mine:!!x.my_vote}; }); }
  async function loadRoom(){
    if(!council()){ SC.table=[];SC.motions=[];SC.jobs=[];SC.line=[];SC.inbox=[];SC.bans=[];SC.succession=null;SC.announce=null; return; }
    var rs=await Promise.all([
      SB.from('sc_table').select('id,handle,letter,kind,body,created_at').order('created_at',{ascending:false}).limit(200),
      SB.from('sc_motions').select('*').order('created_at',{ascending:false}).limit(60),
      SB.from('sc_votes').select('motion_id,handle,choice'),
      SB.from('sc_jobs').select('*').order('created_at',{ascending:false}).limit(100),
      SB.from('sc_line').select('*').is('answered_at',null).order('created_at'),
      SB.rpc('sc_inbox'),
      SB.from('sc_bans').select('*').order('created_at',{ascending:false}).limit(50),
      SB.from('sc_house').select('*').eq('id',1).maybeSingle(),
      SB.from('sc_succ_votes').select('handle,candidate,candidate_handle'),
      SB.rpc('sc_traffic')
    ]);
    SC.table=(rs[0].data||[]).map(function(x){ return {id:x.id,who:x.kind==='house'?'THE TABLE':(x.handle||''),letter:x.letter||'',body:esc(x.body),at:ts(x.created_at)}; });
    var votes={}; (rs[2].data||[]).forEach(function(v){ (votes[v.motion_id]=votes[v.motion_id]||{})[v.handle]=v.choice; });
    SC.motions=(rs[1].data||[]).map(function(x){ return {id:x.id,kind:x.kind,title:x.title,body:x.body||'',by:x.by_handle||'',at:ts(x.created_at),votes:votes[x.id]||{},state:x.state,target:x.target_letter}; });
    SC.jobs=(rs[3].data||[]).map(function(x){ return {id:x.id,title:x.title,body:esc(x.body||''),bucks:x.bucks,by:x.by_handle||'',at:ts(x.created_at),taker:x.taker_handle||null,state:x.state,late:!!x.source_line,source_line:x.source_line}; });
    SC.line=(rs[4].data||[]).map(function(x){ return {id:x.id,from:x.from_handle||'',letter:x.letter||'',body:x.body,at:ts(x.created_at)}; });
    var taken={}; SC.jobs.forEach(function(j){ if(j.source_line&&j.state!=='paid')taken[j.source_line]=1; });
    SC.inbox=(rs[5].data||[]).map(function(x){ return {id:x.id,member:x.member_id,letter:x.letter,from:x.member_handle||'',body:x.body||'',at:ts(x.created_at),state:x.pushed?'pushed':'open',taken:!!taken[x.id]}; });
    SC.bans=(rs[6].data||[]).map(function(x){ return {id:x.id,who:x.who,by:x.by_handle||'',why:x.why,at:ts(x.created_at),state:x.state}; });
    var h=rs[7].data||{}; SC.teller=h.teller_handle||null; SC.tellerUid=h.teller||null; SC.announce=h.announce||null;
    if(h.succession_open){ var sv={}; (rs[8].data||[]).forEach(function(v){ sv[v.handle]=v.candidate_handle; }); SC.succession={votes:sv,sealed:!!h.succession_sealed_at,winner:h.successor_handle||null}; } else SC.succession=null;
    var tr=(rs[9].data||[])[0]; if(tr)SC.traffic={today:tr.today,week:tr.week,month:tr.month,peak:'',dispatch:''};
  }
  var loading=null;
  async function reload(){ if(!window.SB||!window.__shkUid)return; if(loading)return loading; loading=(async function(){ try{ await loadSeats(); await loadClaims(); await loadRoom(); SC.loaded=true; markCheck(); try{ paintDoor(); }catch(e){}   /* #seatsopen */ try{ paintVoteCall(); }catch(e){}   /* #votecall */
    try{ localStorage.setItem('shk_sc_member',atTable(me())?'1':'0'); }catch(e){}   /* #sclazy — a seat holder's phone fetches the council at idle next time; a casual's never does until they knock */ const ss=LETTERS.map(function(L){ return SC.seats[L]?L:''; }).join(''); if(ss!==SC._seatSig){ var first=SC._seatSig==null; SC._seatSig=ss; if(!first){ try{ if(typeof loadCouncil==='function')loadCouncil(); }catch(e){} } } }catch(e){ console.warn('[sc] load',e); }   /* #calmcouncil — only on a seat change; boot already runs loadCouncil once */ loading=null; })(); return loading; }
  window.scReload=reload;
  /* the ⚜ mark lands when your own seat is truly held */
  function markCheck(){ try{ if(seatOf_uid(window.__shkUid)&&typeof unlockBadge==='function'&&typeof bixLate==='function'){ var ix=bixLate('Shadow Council'); if(ix>=0)unlockBadge(ix); } }catch(e){} }
  /* an RPC with the house's manners: toast the server's reason when it refuses */
  async function rpc(fn,args){ var r=await SB.rpc(fn,args||{}); if(r.error){ var msg=String(r.error.message||'').replace(/^[A-Z0-9]+:\s*/,''); say(msg||'The house said no.'); hum([30,30,30]); throw r.error; } return r.data; }

  /* ── WHO AM I at the table (with the demo override) ────────────────────────── */
  function me(){
    var a=null; try{ a=loadAcct()||{}; }catch(e){ a={}; }
    var handle=a.handle||'', letter=null;
    try{ letter=myLetter(); }catch(e){}
    if(!letter)letter=(String(a.id||'').charAt(0).toUpperCase()||null);
    return {handle:handle,letter:letter,head:isCrown(),seat:seatOf_uid(window.__shkUid),uid:window.__shkUid};
  }
  function seated(){ return LETTERS.filter(function(L){ return !!SC.seats[L]; }); }
  function seatOf(h){ var r=null; LETTERS.forEach(function(L){ if(SC.seats[L]&&SC.seats[L].handle===h)r=L; }); return r; }
  function isCouncil(h){ h=String(h||'').toUpperCase(); return h===SC.head.handle||!!seatOf(h); }
  function atTable(w){ return w.head||!!w.seat; }

  /* ── THE DRESS — velvet walls, gold trim ───────────────────────────────────── */
  var css=document.createElement('style'); css.id='shadowCouncilCSS';
  css.textContent=[
  ':root{--sc-velvet:#2a0b14;--sc-velvet2:#3b1020;--sc-velvet3:#4a1527;--sc-gold:#d4b36a;--sc-gold-hi:#f1d58e;--sc-gold-lo:rgba(212,179,106,.35);--sc-ink:#efe3c8;--sc-dim:rgba(239,227,200,.55)}',
  /* the seat board on the Hall */
  /* the gold hanging banner on the header */
  /* #crestdoor(oct8) — the crest at seal size, done the way the story avatar does it (#sty-av): the whole crest is a
     dark blob at 33px, so zoom past the wordmark banner to the anchor + star and screen it over a lit plate.
     Gold rim so it reads as the ⚓ seal's twin. */
  '.sc-ribbon{flex:none;width:33px;height:33px;padding:0;border-radius:10px;cursor:pointer;overflow:hidden;position:relative;',
  '  background:radial-gradient(circle at 50% 34%,rgba(241,213,142,.55),var(--sc-velvet) 80%);border:1px solid rgba(212,179,106,.7);',
  '  box-shadow:0 0 14px rgba(212,179,106,.3),inset 0 1px 0 rgba(241,213,142,.3)}',
  /* #hookbaked(oct8) — the hook is cut out of the crest and BAKED IN as a 132px webp (8 KB), so the door never
     depends on shk-crest.webp loading; the Keymaster's phone showed an empty plate while the file was referenced */
  ':root{--sc-hook:url(data:image/webp;base64,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)}',
  '.sc-ribbon .sc-crest{position:absolute;inset:0;background:var(--sc-hook) center/cover no-repeat}',
  'html.daylight .sc-ribbon{box-shadow:none}',
  '.sc-ribbon:active{transform:translateY(1px)}',
  /* #seatsopen(oct8) — the crest read as a logo, not a door. While seats are open (and the member isn't seated) the door
     wears a gold tag — 12 OPEN — hung under the plate, and the rim breathes gold so it reads as a button. Seated: no tag. Full: FULL. */
  '.sc-ribbon{overflow:visible}.sc-ribbon .sc-crest{border-radius:9px;overflow:hidden}',
  /* #tagroom(oct8) — the tag is wider than the plate; step the door in off the screen's left edge so 22 OPEN isn't cut */
  '.sc-ribbon{margin-left:10px}',
  '.sc-ribbon .sc-open{position:absolute;left:50%;bottom:-8px;transform:translateX(-50%);z-index:2;white-space:nowrap;pointer-events:none;',
  '  font:800 7.5px/1 Cinzel,serif;letter-spacing:.08em;color:var(--sc-velvet);background:linear-gradient(180deg,var(--sc-gold-hi),var(--sc-gold));border:1px solid var(--sc-velvet);border-radius:99px;padding:3px 5px 2px;box-shadow:0 0 8px rgba(212,179,106,.7)}',
  '.sc-ribbon .sc-open.full{background:var(--sc-velvet2);color:var(--sc-gold);border-color:var(--sc-gold-lo);box-shadow:none}',
  '.sc-ribbon.beckon{animation:scBeckon 2.2s ease-in-out infinite}',
  '@keyframes scBeckon{0%,100%{box-shadow:0 0 14px rgba(212,179,106,.3),inset 0 1px 0 rgba(241,213,142,.3)}50%{box-shadow:0 0 24px rgba(241,213,142,.9),0 0 0 3px rgba(212,179,106,.4),inset 0 1px 0 rgba(241,213,142,.3)}}',
  '@media (prefers-reduced-motion:reduce){.sc-ribbon.beckon{animation:none;box-shadow:0 0 22px rgba(241,213,142,.8)}}',
  '.sc-sheet.board .sheet-card{padding:34px 12px calc(12px + env(safe-area-inset-bottom))}',
  /* #accessgranted — the gate */
  '.sc-sheet.gate{align-items:center;background:radial-gradient(120% 90% at 50% 40%,var(--sc-velvet3),#170509 70%);backdrop-filter:none;-webkit-backdrop-filter:none}',
  '.sc-sheet.gate{transition:opacity .45s ease, visibility 0s linear .45s}',
  '.sc-sheet.gate.out .sc-gate{opacity:0;transform:scale(.97);transition:opacity .45s ease,transform .6s ease}',
  '.sc-gate{text-align:center;padding:0 28px;transition:opacity .6s ease}',
  '.sc-gate .gseal{position:relative;width:140px;height:140px;margin:0 auto 14px}',
  '.sc-gate .gseal svg{position:absolute;inset:0;width:100%;height:100%;transform:rotate(-90deg)}',
  '.sc-gate .gseal circle{fill:none;stroke:var(--sc-gold);stroke-width:.8;stroke-dasharray:420;stroke-dashoffset:420;animation:scDraw 1.4s cubic-bezier(.4,0,.2,1) both}',
  '.sc-gate .gseal .r2{stroke-width:.5;stroke:var(--sc-gold-hi);animation-delay:.25s;stroke-dasharray:4 3 0 0;stroke-dasharray:370;stroke-dashoffset:370;animation-duration:1.2s}',
  '.sc-gate .gseal .r3{stroke-width:1.2;stroke:var(--sc-gold-hi);animation-delay:.5s;stroke-dasharray:290;stroke-dashoffset:290;animation-duration:1s}',
  '.sc-gate .gdisc{position:absolute;left:50%;top:50%;width:76px;height:76px;margin:-38px 0 0 -38px;border-radius:50%;overflow:hidden;background:#120407;border:1.5px solid var(--sc-gold-hi);box-shadow:0 0 0 5px #170509,0 0 0 6px var(--sc-gold-lo),0 0 40px rgba(212,179,106,.25);opacity:0;transform:scale(.6);animation:scDisc .9s cubic-bezier(.2,.9,.3,1.2) 1s both}',
  '.sc-gate .gdisc .ghook{position:absolute;inset:0;background:var(--sc-hook) center/cover no-repeat;filter:brightness(1.05)}',
  '.sc-gate .grule{display:flex;align-items:center;justify-content:center;gap:10px;width:220px;margin:0 auto 14px;opacity:0;animation:scRise .7s ease-out 1.35s both}',
  '.sc-gate .grule i{flex:1;height:1px;background:linear-gradient(90deg,transparent,var(--sc-gold));transform:scaleX(0);transform-origin:right;animation:scRule .8s ease-out 1.4s both}.sc-gate .grule i+b+i{background:linear-gradient(90deg,var(--sc-gold),transparent);transform-origin:left}',
  '.sc-gate .grule b{color:var(--sc-gold-hi);font-size:13px;line-height:1}',
  '.sc-gate .k{font-family:Cinzel,serif;font-weight:600;font-size:10.5px;letter-spacing:.5em;color:var(--sc-gold);text-transform:uppercase;opacity:0;animation:scTrack 1s ease-out 1.5s both;padding-left:.5em}',
  '.sc-gate .t{font-family:Cinzel,serif;font-weight:700;font-size:21px;line-height:1.25;color:var(--sc-gold-hi);margin:10px 0 6px;text-shadow:0 1px 0 #000,0 0 26px rgba(212,179,106,.3);opacity:0;animation:scRise .7s ease-out 1.75s both}',
  '.sc-gate .s{font-family:Cinzel,serif;font-size:12.5px;letter-spacing:.2em;text-transform:uppercase;color:var(--sc-dim);opacity:0;animation:scRise .7s ease-out 2s both}',
  '@keyframes scDraw{to{stroke-dashoffset:0}}',
  '@keyframes scDisc{to{opacity:1;transform:none}}',
  '@keyframes scRule{to{transform:scaleX(1)}}',
  '@keyframes scTrack{from{opacity:0;letter-spacing:.9em}to{opacity:1;letter-spacing:.5em}}',
  '@keyframes scRise{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}',
  '@media (prefers-reduced-motion:reduce){.sc-gate *{animation-duration:.01s!important;animation-delay:0s!important}}',
  '.sc-sheet.board .sheet-card:before{display:none}',
  '#scBoard{margin:0 0 20px;border-radius:17px;padding:14px 14px 13px;position:relative;overflow:hidden;cursor:pointer;',
  '  background:radial-gradient(120% 90% at 50% 0%,var(--sc-velvet3),var(--sc-velvet) 60%,#1b0710);border:1px solid var(--sc-gold-lo);box-shadow:inset 0 0 0 1px rgba(0,0,0,.35),0 10px 30px rgba(0,0,0,.45)}',
  '#scBoard:before{content:"";position:absolute;inset:5px;border:1px solid rgba(212,179,106,.22);border-radius:13px;pointer-events:none}',
  '#scBoard .sc-kind{font-family:Cinzel,serif;font-weight:600;font-size:9.5px;letter-spacing:.3em;color:var(--sc-gold);text-transform:uppercase;margin:0 0 6px}',
  '#scBoard .sc-ttl{font-family:Cinzel,serif;font-weight:700;font-size:21px;letter-spacing:.06em;color:var(--sc-gold-hi);margin:0 0 2px;text-shadow:0 1px 0 #000,0 0 18px rgba(212,179,106,.25)}',
  '#scBoard .sc-sub{font-family:"Barlow Condensed",sans-serif;font-size:13px;color:var(--sc-dim);letter-spacing:.03em;margin-bottom:11px}',
  '#scBoard .sc-grid{display:grid;grid-template-columns:repeat(13,minmax(0,1fr));gap:5px}',
  '#scBoard .sc-grid b{display:flex;align-items:center;justify-content:center;height:24px;border-radius:6px;font-family:Cinzel,serif;font-weight:700;font-size:11.5px;letter-spacing:.02em;',
  '  color:rgba(239,227,200,.28);border:1px solid rgba(212,179,106,.14);background:rgba(0,0,0,.25)}',
  '#scBoard .sc-grid b.sc-on{color:#2a0b14;background:linear-gradient(160deg,var(--sc-gold-hi),var(--sc-gold) 60%,#9a7a3a);border-color:var(--sc-gold-hi);box-shadow:0 0 10px rgba(212,179,106,.35),inset 0 1px 0 rgba(255,255,255,.5)}',
  '#scBoard .sc-grid b.sc-me{outline:2px solid var(--sc-gold-hi);outline-offset:1px}',
  '#scBoard .sc-grid b.sc-ask{color:var(--sc-gold);border-style:dashed;border-color:var(--sc-gold)}',
  '#scBoard .sc-foot{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:12px}',
  '#scBoard .sc-foot .st{font-family:"Barlow Condensed",sans-serif;font-size:12.5px;color:var(--sc-dim)}#scBoard .sc-foot .st b{color:var(--sc-gold-hi);font-weight:700}',
  '#scBoard .sc-cta{font-family:Cinzel,serif;font-weight:700;font-size:11px;letter-spacing:.14em;text-transform:uppercase;padding:9px 13px;border-radius:9px;color:#2a0b14;',
  '  background:linear-gradient(160deg,var(--sc-gold-hi),var(--sc-gold));border:1px solid var(--sc-gold-hi);box-shadow:0 2px 0 #6e5424,0 6px 16px rgba(0,0,0,.4);cursor:pointer}',
  '#scBoard .sc-cta.ghost{background:transparent;color:var(--sc-gold);box-shadow:none}',
  '#scDemo{display:flex;gap:5px;margin:-8px 0 0;align-items:center;flex-wrap:wrap}#scDemo span{font-family:Inter,system-ui,sans-serif;font-size:8.5px;letter-spacing:.18em;color:var(--steel);text-transform:uppercase;margin-right:3px}',
  '#scDemo button{font-family:"Barlow Condensed",sans-serif;font-size:11px;letter-spacing:.06em;padding:4px 9px;border-radius:999px;border:1px solid var(--line);background:var(--plate-2);color:var(--steel);cursor:pointer}',
  '#scDemo button.on{border-color:var(--sc-gold);color:var(--sc-gold-hi);background:var(--sc-velvet)}',
  /* the two sheets share the velvet */
  '.sc-sheet .sheet-card{background:radial-gradient(130% 70% at 50% -10%,var(--sc-velvet3),var(--sc-velvet) 55%,#170509);border:1px solid var(--sc-gold-lo);color:var(--sc-ink);text-align:left;max-width:520px;position:relative}',
  '.sc-sheet .sheet-card:before{content:"";position:absolute;inset:7px;border:1px solid rgba(212,179,106,.18);border-radius:16px 16px 0 0;pointer-events:none}',
  /* #chamberpage(oct8) — THE CHAMBER IS A PAGE, NOT A SHEET. It docks under the fixed dispatch console (--tbH) so the
     clock and the board stay live and unblurred on top; a casual can sit at the table and still watch dispatch. No
     backdrop, no slide-up, square top edge, every tab the full height. The seat and board sheets stay sheets. */
  '.sc-sheet.full{top:var(--tbH,49px);align-items:stretch;background:transparent;backdrop-filter:none;-webkit-backdrop-filter:none;padding-bottom:0}',
  '.sc-sheet.full .sheet-card{max-width:none;height:100%;max-height:none;border-radius:0;border-width:0 0 0 0;border-top:1px solid var(--sc-gold-lo);transform:none;',
  '  display:flex;flex-direction:column;padding:12px 16px calc(10px + env(safe-area-inset-bottom) + var(--kb,0px))}',
  '.sc-sheet.full .sheet-card:before{inset:6px;border-radius:0}',
  /* #androidstill(oct9) — THE CHAMBER GETS ITS OWN LAYER. On Android, Chrome drops and redraws a big fixed sheet
     whenever too much animates beneath it, and the Chamber sat over the Halloween scene (bats, drips, embers)
     with its own floor pulsing inside an SVG, which the phone cannot hand to the GPU, so every pulse re-rastered
     the whole sheet: random bursts of the sheet blinking off and on. Three things: the sheet is promoted to its
     own compositor layer and painted in isolation; the season decor behind it is parked while it is open (it
     is under the sheet anyway); and the halo pulses by opacity alone, which is cheap to repaint. */
  '.sc-sheet.full{will-change:transform;transform:translateZ(0);backface-visibility:hidden;contain:layout paint}',
  '.sc-sheet.full .sheet-card{contain:paint;isolation:isolate}',
  /* (the decor pause moved to the shell: html.covered — #covered, oct 9) */
  '.sc-sheet.full .sc-h{padding-top:6px}',
  '.sc-h{text-align:center;padding:14px 0 10px}.sc-h .k{font-family:Inter,system-ui,sans-serif;font-size:8.5px;letter-spacing:.22em;color:var(--sc-gold);text-transform:uppercase;white-space:nowrap}',
  /* #chamberhead(oct8) — the house name over the door, the society line under it, by the Keymaster */
  '.sc-h .o{font-family:Cinzel,serif;font-weight:600;font-size:12.5px;letter-spacing:.14em;color:var(--sc-gold-hi);text-transform:uppercase;white-space:nowrap;margin:0 0 3px}',
  '.sc-h .t{font-family:Cinzel,serif;font-weight:700;font-size:22px;letter-spacing:.08em;color:var(--sc-gold-hi);text-shadow:0 1px 0 #000,0 0 22px rgba(212,179,106,.3);margin:3px 0 2px}',
  '.sc-h .s{font-family:"Barlow Condensed",sans-serif;font-size:13px;color:var(--sc-dim);letter-spacing:.03em}',
  '.sc-rule{height:1px;margin:6px 0 12px;background:linear-gradient(90deg,transparent,var(--sc-gold),transparent);opacity:.7}',
  '.sc-seal{width:58px;height:58px;border-radius:50%;margin:0 auto 8px;display:flex;align-items:center;justify-content:center;font-family:Cinzel,serif;font-weight:700;font-size:26px;color:#2a0b14;',
  '  background:radial-gradient(circle at 35% 30%,var(--sc-gold-hi),var(--sc-gold) 55%,#8c6f33);box-shadow:0 0 0 3px var(--sc-velvet),0 0 0 4px var(--sc-gold-lo),0 8px 22px rgba(0,0,0,.5),inset 0 1px 0 rgba(255,255,255,.6)}',
  '.sc-seal.open{background:transparent;color:var(--sc-gold);border:2px dashed var(--sc-gold-lo);box-shadow:none}',
  '.sc-elig{display:flex;align-items:center;justify-content:center;gap:9px;margin:2px auto 12px;padding:9px 16px;border-radius:999px;width:max-content;font-family:Cinzel,serif;font-weight:700;font-size:12.5px;letter-spacing:.16em;text-transform:uppercase;color:#ffb3a8;border:1px solid rgba(224,122,110,.6);background:rgba(125,35,32,.35)}',
  '.sc-elig i{font-style:normal;width:20px;height:20px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:12px;background:#7d2320;color:#fff}',
  '.sc-elig.ok{color:#2a0b14;border-color:var(--sc-gold-hi);background:linear-gradient(160deg,var(--sc-gold-hi),var(--sc-gold))}.sc-elig.ok i{background:#2a0b14;color:var(--sc-gold-hi)}',
  '.sc-p{font-family:"Barlow Condensed",sans-serif;font-size:15px;line-height:1.4;color:var(--sc-ink);margin:0 0 10px}.sc-p.dim{color:var(--sc-dim);font-size:13.5px}',
  '.sc-q{font-family:Cinzel,serif;font-style:normal;font-size:13px;color:var(--sc-gold-hi);text-align:center;padding:8px 14px;margin:0 0 12px;border-left:2px solid var(--sc-gold);border-right:2px solid var(--sc-gold)}',
  '.sc-in{width:100%;background:rgba(0,0,0,.35);border:1px solid var(--sc-gold-lo);border-radius:10px;padding:10px 12px;color:var(--sc-ink);font-family:"Barlow Condensed",sans-serif;font-size:15px;outline:none;resize:none}',
  '.sc-in:focus{border-color:var(--sc-gold)}.sc-in::placeholder{color:rgba(239,227,200,.35)}',
  '.sc-row{display:flex;gap:8px;margin-top:10px}.sc-row>*{flex:1}',
  '.sc-btn{font-family:Cinzel,serif;font-weight:700;font-size:11.5px;letter-spacing:.12em;text-transform:uppercase;padding:12px 10px;border-radius:10px;cursor:pointer;color:#2a0b14;',
  '  background:linear-gradient(160deg,var(--sc-gold-hi),var(--sc-gold));border:1px solid var(--sc-gold-hi);box-shadow:0 2px 0 #6e5424,0 6px 16px rgba(0,0,0,.4)}',
  '.sc-btn.ghost{background:transparent;color:var(--sc-gold);box-shadow:none;border-color:var(--sc-gold-lo)}.sc-btn.red{background:linear-gradient(160deg,#c0453a,#7d2320);color:#ffe9e4;border-color:#d6665a;box-shadow:0 2px 0 #4b1210}',
  '.sc-btn:disabled{opacity:.45;cursor:default}',
  /* the Chamber */
  '.sc-charterlink{display:inline-block;margin-top:6px;font-family:Cinzel,serif;font-weight:700;font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:var(--sc-gold);text-decoration:none;border:1px solid var(--sc-gold-lo);border-radius:999px;padding:4px 11px}',
  '.sc-announce{margin:-4px 0 10px;padding:9px 12px;border-radius:10px;text-align:center;font-family:Cinzel,serif;font-weight:700;font-size:12px;letter-spacing:.06em;color:#2a0b14;background:linear-gradient(160deg,var(--sc-gold-hi),var(--sc-gold));border:1px solid var(--sc-gold-hi)}',
  '.sc-tabs{display:flex;gap:4px;margin:0 0 12px;padding:3px;border-radius:12px;background:rgba(0,0,0,.35);border:1px solid var(--sc-gold-lo)}',
  '.sc-tabs button{flex:1;font-family:Cinzel,serif;font-weight:700;font-size:10px;letter-spacing:.12em;text-transform:uppercase;padding:9px 4px;border-radius:9px;border:0;background:transparent;color:var(--sc-dim);cursor:pointer;position:relative}',
  '.sc-tabs button.on{color:#2a0b14;background:linear-gradient(160deg,var(--sc-gold-hi),var(--sc-gold))}',
  '.sc-tabs button i{position:absolute;top:-4px;right:-3px;min-width:15px;height:15px;padding:0 4px;border-radius:8px;background:#c0453a;color:#fff;font:700 9px/15px Inter,sans-serif;font-style:normal;box-shadow:0 0 0 2px var(--sc-velvet)}',
  '.sc-body{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;padding:2px 2px 8px;min-height:0}',
  '.sc-table{display:flex;gap:6px;flex-wrap:wrap;justify-content:center;margin:0 0 12px}',
  /* #hemicycle — the floor */
  '.sc-floor{display:block;width:100%;max-width:420px;margin:0 auto 6px;font-family:Cinzel,serif;font-weight:700}',
  '.sc-floor .hs circle{fill:transparent;stroke:rgba(212,179,106,.38);stroke-width:1;stroke-dasharray:3 2.5}',
  '.sc-floor .hs text{font-size:12px;fill:rgba(212,179,106,.45);text-anchor:middle}',
  '.sc-floor .hs.on circle{fill:url(#scGold);stroke:var(--sc-gold-hi);stroke-dasharray:none}',
  '.sc-floor .hs.on text{fill:#2a0b14}',
  '.sc-floor .hs.me circle{stroke:#fff;stroke-width:2}',
  /* #inroom — the presence halo: a green ring that breathes */
  '.sc-floor .hs .halo{fill:rgba(127,174,106,.12);stroke:#9fd08a;stroke-width:1.5;stroke-dasharray:none;animation:scHalo 2.2s ease-in-out infinite}',
  '.sc-floor .hs.in>circle:not(.halo){stroke:#9fd08a}',
  '.sc-floor .hs.me .halo{stroke:#fff}',
  '@keyframes scHalo{0%,100%{opacity:.5}50%{opacity:1}}',   /* #androidstill — opacity only, no scale */
  '.sc-floor .hs{transform-box:fill-box;transform-origin:center}.sc-floor .hs .halo{transform-box:fill-box;transform-origin:center}',
  '.sc-inroom{display:flex;align-items:center;justify-content:center;gap:6px;margin:2px 0 0;font-family:"Barlow Condensed",sans-serif;font-size:12px;letter-spacing:.06em;color:var(--sc-dim)}',
  '.sc-inroom i{width:7px;height:7px;border-radius:50%;background:#9fd08a;box-shadow:0 0 8px rgba(159,208,138,.8)}.sc-inroom b{color:#9fd08a}',
  '.sc-floor .hs.head path{fill:#2a0b14;stroke:var(--sc-gold);stroke-width:1}',
  '.sc-floor .hs.head circle{fill:url(#scGold);stroke:var(--sc-gold-hi);stroke-dasharray:none;stroke-width:1.5}',
  '.sc-floor .hs.head text{font-size:17px;fill:#2a0b14}',
  '.sc-table .ch{width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:Cinzel,serif;font-weight:700;font-size:13px;color:#2a0b14;',
  '  background:radial-gradient(circle at 35% 30%,var(--sc-gold-hi),var(--sc-gold) 60%,#8c6f33);box-shadow:0 3px 8px rgba(0,0,0,.5),inset 0 1px 0 rgba(255,255,255,.5);position:relative}',
  '.sc-table .ch.head{width:44px;height:44px;font-size:18px;background:radial-gradient(circle at 35% 30%,#fff2c8,var(--sc-gold-hi) 50%,#9a7a3a)}',
  '.sc-table .ch.empty{background:transparent;color:rgba(212,179,106,.35);border:1px dashed rgba(212,179,106,.3);box-shadow:none}',
  '.sc-msg{display:flex;gap:10px;padding:9px 0;border-bottom:1px solid rgba(212,179,106,.12)}',
  '.sc-msg .av{flex:none;width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:Cinzel,serif;font-weight:700;font-size:12px;color:#2a0b14;background:linear-gradient(160deg,var(--sc-gold-hi),var(--sc-gold))}',
  '.sc-msg .av.head{background:radial-gradient(circle at 35% 30%,#fff2c8,var(--sc-gold-hi) 50%,#9a7a3a);font-size:15px}',
  '.sc-msg .who{font-family:Cinzel,serif;font-weight:700;font-size:12px;letter-spacing:.06em;color:var(--sc-gold-hi)}.sc-msg .who span{font-family:Inter,system-ui,sans-serif;font-weight:400;font-size:9px;letter-spacing:.12em;color:var(--sc-dim);margin-left:7px}',
  '.sc-msg .bd{font-family:"Barlow Condensed",sans-serif;font-size:15px;line-height:1.38;color:var(--sc-ink);margin-top:2px}',
  '.sc-compose{flex:none;display:flex;gap:8px;margin-top:8px;padding-top:10px;border-top:1px solid var(--sc-gold-lo);align-items:flex-end}.sc-compose .sc-in{flex:1;min-height:44px;max-height:120px}.sc-compose .sc-btn{flex:none;padding:12px 14px}',
  '.sc-mo{border:1px solid var(--sc-gold-lo);border-radius:13px;padding:12px 13px;margin:0 0 10px;background:rgba(0,0,0,.28)}',
  '.sc-mo .k{font-family:Inter,system-ui,sans-serif;font-size:8.5px;letter-spacing:.2em;color:var(--sc-gold);text-transform:uppercase;display:flex;justify-content:space-between}',
  '.sc-mo .k em{font-style:normal;color:var(--sc-dim)}.sc-mo .k em.carried{color:#9fd08a}.sc-mo .k em.failed{color:#e07a6e}.sc-mo .k em.decreed{color:var(--sc-gold-hi)}',
  '.sc-mo .t{font-family:Cinzel,serif;font-weight:700;font-size:14.5px;color:var(--sc-ink);margin:5px 0 3px}.sc-mo .b{font-family:"Barlow Condensed",sans-serif;font-size:13.5px;line-height:1.35;color:var(--sc-dim)}',
  '.sc-bar{height:7px;border-radius:4px;background:rgba(0,0,0,.45);margin:10px 0 5px;position:relative;overflow:hidden;border:1px solid rgba(212,179,106,.2)}',
  '.sc-bar b{position:absolute;left:0;top:0;bottom:0;background:linear-gradient(90deg,#8c6f33,var(--sc-gold-hi));border-radius:4px}.sc-bar i{position:absolute;top:-2px;bottom:-2px;width:2px;background:#e07a6e}',
  '.sc-tally{display:flex;justify-content:space-between;font-family:"Barlow Condensed",sans-serif;font-size:12px;color:var(--sc-dim)}.sc-tally b{color:var(--sc-gold-hi)}',
  '.sc-vote{display:flex;gap:6px;margin-top:9px}.sc-vote button{flex:1;font-family:Cinzel,serif;font-weight:700;font-size:10.5px;letter-spacing:.1em;padding:9px 4px;border-radius:8px;border:1px solid var(--sc-gold-lo);background:transparent;color:var(--sc-gold);cursor:pointer}',
  '.sc-vote button.on{background:linear-gradient(160deg,var(--sc-gold-hi),var(--sc-gold));color:#2a0b14}.sc-vote button.dec{border-color:#d6665a;color:#ffb3a8}.sc-vote button.dec.on{background:#7d2320;color:#fff}',
  '.sc-ap{border-top:1px solid rgba(212,179,106,.14);padding:10px 0 4px}.sc-ap.mine{background:linear-gradient(90deg,rgba(212,179,106,.06),transparent)}',
  '.sc-ap .who b{font-family:Cinzel,serif;font-size:13.5px;color:var(--sc-gold-hi)}.sc-ap .who span{font-family:Inter,system-ui,sans-serif;font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:var(--sc-dim);margin-left:8px}',
  '.sc-ap .note{font-family:"Barlow Condensed",sans-serif;font-size:14px;color:var(--sc-ink);margin:4px 0 2px;font-style:italic}',
  '.sc-ap .facts{display:grid;grid-template-columns:repeat(5,1fr);gap:4px;margin:8px 0 2px}.sc-ap .facts span{display:flex;flex-direction:column;align-items:center;text-align:center;font-family:Inter,system-ui,sans-serif;font-size:7.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--sc-dim);line-height:1.2}',
  '.sc-ap .facts b{font-family:Cinzel,serif;font-size:14px;color:var(--sc-gold-hi);margin-bottom:2px}',
  '.sc-stat{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin:0 0 12px}.sc-stat div{border:1px solid var(--sc-gold-lo);border-radius:11px;padding:9px 6px;text-align:center;background:rgba(0,0,0,.28)}',
  '.sc-stat b{display:block;font-family:Cinzel,serif;font-weight:700;font-size:19px;color:var(--sc-gold-hi)}.sc-stat span{font-family:Inter,system-ui,sans-serif;font-size:8px;letter-spacing:.16em;color:var(--sc-dim);text-transform:uppercase}',
  '.sc-sec{font-family:Cinzel,serif;font-weight:700;font-size:11px;letter-spacing:.2em;color:var(--sc-gold);text-transform:uppercase;margin:14px 0 7px;display:flex;align-items:center;gap:9px}.sc-sec:after{content:"";flex:1;height:1px;background:var(--sc-gold-lo)}',
  '.sc-li{display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(212,179,106,.1);font-family:"Barlow Condensed",sans-serif;font-size:14px;color:var(--sc-ink)}',
  '.sc-li .L{flex:none;width:26px;height:26px;border-radius:7px;display:flex;align-items:center;justify-content:center;font-family:Cinzel,serif;font-weight:700;font-size:12px;color:#2a0b14;background:linear-gradient(160deg,var(--sc-gold-hi),var(--sc-gold))}',
  '.sc-li .L.open{background:transparent;color:rgba(212,179,106,.4);border:1px dashed rgba(212,179,106,.3)}.sc-li .d{flex:1;min-width:0}.sc-li .d small{display:block;font-size:11.5px;color:var(--sc-dim)}',
  '.sc-li .act{display:flex;gap:5px}.sc-li .act button{font-family:Cinzel,serif;font-weight:700;font-size:9.5px;letter-spacing:.08em;padding:6px 9px;border-radius:7px;border:1px solid var(--sc-gold-lo);background:transparent;color:var(--sc-gold);cursor:pointer}',
  '.sc-li.q{flex-wrap:wrap}.sc-li.q .act{width:100%;justify-content:flex-end;margin-top:4px}.sc-li.q .act button{padding:8px 14px;font-size:10.5px}',
  '.sc-li .act button.y{background:linear-gradient(160deg,var(--sc-gold-hi),var(--sc-gold));color:#2a0b14}.sc-li .act button.n{border-color:#d6665a;color:#ffb3a8}',
  '.sc-close{position:absolute;top:-2px;right:12px;width:30px;height:30px;border-radius:50%;border:1px solid var(--sc-gold-lo);background:rgba(0,0,0,.35);color:var(--sc-gold);font-size:15px;cursor:pointer;z-index:2}',
  'html.daylight #scBoard,html.daylight .sc-sheet .sheet-card{color:var(--sc-ink)}',
  /* #chamberstill(oct9) — the 13px text floor (#textfloor) lifts anything smaller a few frames AFTER it is drawn,
     so every one of these labels used to flash in small and then jump. Drawn at the floor to begin with: one
     paint, no jump. Tracking is eased where the tiny caps relied on it. */
  '.sc-gate .k,.sc-gate .s,#scBoard .sc-kind,#scBoard .sc-grid b,#scBoard .sc-foot .st,#scBoard .sc-cta,#scDemo span,#scDemo button,.sc-h .k,.sc-h .o,.sc-elig,.sc-elig i,.sc-btn,.sc-charterlink,.sc-announce,.sc-tabs button,.sc-inroom,.sc-msg .av,.sc-msg .who,.sc-msg .who span,.sc-mo .k,.sc-tally,.sc-vote button,.sc-ap .who span,.sc-ap .facts span,.sc-stat span,.sc-sec,.sc-li .L,.sc-li .d small,.sc-li .act button,.sc-li.q .act button{font-size:13px}',
  '.sc-h .k,.sc-gate .k{letter-spacing:.16em}.sc-ap .facts span,.sc-stat span,.sc-mo .k,.sc-msg .who span,.sc-ap .who span{letter-spacing:.06em}',
  ].join('\n');
  document.head.appendChild(css);

  /* ── THE SEAT BOARD on the Hall — filled or open, never who ────────────────── */
  function boardHTML(){
    var w=me(), n=seated().length, mine=SC.seats[w.letter], ask=SC.claims.some(function(c){ return c.handle===w.handle&&c.letter===w.letter; });
    var cells=LETTERS.map(function(L){
      var cl=(SC.seats[L]?'sc-on':'')+(L===w.letter&&!w.head?' sc-me':'')+(!SC.seats[L]&&SC.claims.some(function(c){return c.letter===L;})&&(w.head||ask&&L===w.letter)?' sc-ask':'');
      return '<b class="'+cl+'" data-sl="'+L+'" title="Seat of '+L+'">'+L+'</b>';
    }).join('');
    var cta;
    if(w.head)             cta='<button type="button" class="sc-cta" data-sc="chamber">⚜ Enter the Chamber</button>';
    else if(w.seat)        cta='<button type="button" class="sc-cta" data-sc="chamber">⚜ Enter the Chamber</button>';
    else if(ask)           cta='<button type="button" class="sc-cta ghost" data-sc="seat">Claim placed · awaiting the Keymaster</button>';
    else if(mine)          cta='<button type="button" class="sc-cta ghost" data-sc="seat">Seat of '+w.letter+' is held</button>';
    else                   cta='<button type="button" class="sc-cta" data-sc="seat">Claim the seat of '+esc(w.letter)+'</button>';
    var demo='';
    return '<div id="scBoard" data-sc="seat">'
      +'<div class="sc-ttl">⚜ The Shadow Council</div>'
      +'<div class="sc-kind">Secret Society</div>'
      +'<div class="sc-sub">One seat per letter. Twenty-six seats.</div>'
      +'<div class="sc-grid">'+cells+'</div>'
      +'<div class="sc-foot"><div class="st"><b>'+n+'</b> of 26 seats filled · <b>'+(26-n)+'</b> open</div>'+cta+'</div>'
      +'</div>'+demo;
  }
  /* #ribbon(oct8) — the board is a SHEET now, opened from the gold banner on the header; it no
     longer sits on the Hall and takes a screen of it. Same grid, same counts, same doors. */
  function paintBoard(){ var sh=$('scBoardSheet'); if(!sh)return; sh.innerHTML='<div class="sheet-card"><button type="button" class="sc-close" data-scx>✕</button>'+boardHTML()+'</div>'; }
  /* #fullhouse(oct8) — WHEN EVERY SEAT IS TAKEN the board is not for outsiders: the crest opens a locked door
     instead. Seat holders and the Keymaster go straight to the board as ever. */
  function fullHouse(){ return seated().length===26; }
  /* #seatsopen(oct8) — dress the door: the tag + the breathing rim say SEATS ARE OPEN, TAP HERE */
  /* #votecall(oct9) — what's waiting on THIS member's vote: open motions they haven't voted on; a seat with
     applicants whose window is still open and no vote of theirs cast; a succession vote not yet cast. */
  function votesWaiting(){ var w=me(); if(!atTable(w)||!SC.loaded)return {n:0,tab:'motions'};
    var m=SC.motions.filter(function(x){ return x.state==='open'&&!(x.votes||{})[w.handle]; }).length;
    var by={}; (SC.applicants||[]).forEach(function(a){ (by[a.letter]=by[a.letter]||[]).push(a); });
    var c=Object.keys(by).filter(function(L){ var l=by[L]; return !(l[0].ends&&l[0].ends<Date.now())&&!l.some(function(a){ return a.mine; }); }).length;
    var su=(SC.succession&&!SC.succession.sealed&&!w.head&&!SC.succession.votes[w.handle])?1:0;
    return {n:m+c+su,tab:m?'motions':'desk'}; }
  var _vcLast=-1;
  function paintVoteCall(){ var b=document.getElementById('hcsc'), n=document.getElementById('hcScN'); if(!b)return;
    var v=votesWaiting(); b.style.display=v.n>0?'':'none'; if(n)n.textContent=v.n>99?'99+':String(v.n);
    b.title=v.n?v.n+' council vote'+(v.n==1?'':'s')+' waiting on you':''; b.setAttribute('aria-label',b.title||'Council votes waiting'); b._tab=v.tab;
    if(_vcLast>=0&&v.n>_vcLast){ b.classList.remove('ring'); void b.offsetWidth; b.classList.add('ring'); hum([10,30,10]); }   /* a new one: a ring, like the ✉ */
    _vcLast=v.n; }
  window.scVotesWaiting=votesWaiting;
  /* #sclazy — the door and the alert, for the shell's loader: read first, then open, so a seat holder never sees the
     seat sheet flash while the seats are still in flight */
  window.scOpenDoor=function(){ return reload().then(function(){ openBoard(); }); };
  window.scOpenVotes=function(){ return reload().then(function(){ openChamber(votesWaiting().tab); }); };
  (function(){ var b=document.getElementById('hcsc'); if(b)b.addEventListener('click',function(){ hum([12]); openChamber(b._tab||'motions'); }); })();
  function paintDoor(){ var b=document.getElementById('scRibbon'); if(!b)return; var tag=b.querySelector('.sc-open');
    if(!SC.loaded||!window.__shkUid){ if(tag)tag.remove(); b.classList.remove('beckon'); b.title='The Shadow Council'; return; }
    var w=me(), open=26-seated().length, mine=atTable(w);
    if(!tag){ tag=document.createElement('span'); tag.className='sc-open'; tag.setAttribute('aria-hidden','true'); b.appendChild(tag); }
    /* #seatcount(oct8) — a seated member sees the count too, just without the beckoning rim */
    if(mine){ tag.textContent=open<=0?'FULL':open+' OPEN'; tag.classList.toggle('full',open<=0); b.classList.remove('beckon'); var sm='The Shadow Council — your seat · '+open+' of 26 seats open'; b.title=sm; b.setAttribute('aria-label',sm); return; }
    if(open<=0){ tag.textContent='FULL'; tag.classList.add('full'); b.classList.remove('beckon'); b.title='The Shadow Council — every seat is taken'; b.setAttribute('aria-label','The Shadow Council — every seat is taken'); return; }
    tag.textContent=open+' OPEN'; tag.classList.remove('full'); b.classList.add('beckon');
    var say='The Shadow Council — '+open+' of 26 seats open. Tap to claim yours.'; b.title=say; b.setAttribute('aria-label',say); }
  function lockedHTML(w){
    return '<div class="sheet-card"><button type="button" class="sc-close" data-scx>✕</button>'
      +'<div class="sc-h" style="padding-top:18px"><div class="sc-seal open" style="font-size:22px">🔒</div><div class="k" style="letter-spacing:.3em">Access not granted</div><div class="t" style="font-size:19px">Shadow Council Members Only</div></div><div class="sc-rule"></div>'
      +'<p class="sc-p" style="text-align:center">All twenty-six seats are taken. Every letter has its representative on the Council, '+esc(w.letter)+' included.</p>'
      +'<p class="sc-p dim" style="text-align:center">Seats open only when a member gives theirs up.</p>'
      +'<div class="sc-row"><button type="button" class="sc-btn ghost" data-scx>Understood</button></div></div>';
  }
  /* #accessgranted(oct8) — A MEMBER AT THE DOOR: no board, no claim — the lock turns, ACCESS GRANTED, a line with
     their name, and the Chamber opens behind it. Tap anywhere to skip the beat. */
  var gateTimer=null;
  function openGate(w){
    var g=sheetEl('scGate','sc-sheet gate',97);
    var who=w.head?'Welcome, Keymaster.':'Welcome, Council Member '+esc(w.handle)+'.';
    var line=w.head?'The table awaits.':'Your seat awaits.';
    /* #gateseal(oct8) — the seal: hairline rings that draw themselves, the crest's hook in a dark disc, a rule with a
       fleuron, and the type tracking in. Nothing cartoon about it. */
    g.innerHTML='<div class="sc-gate"><div class="gseal"><svg viewBox="0 0 140 140" aria-hidden="true"><circle class="r1" cx="70" cy="70" r="66"/><circle class="r2" cx="70" cy="70" r="58"/><circle class="r3" cx="70" cy="70" r="46"/></svg><div class="gdisc"><span class="ghook"></span></div></div>'
      +'<div class="grule"><i></i><b>⚜</b><i></i></div><div class="k">Access granted</div><div class="t">'+who+'</div><div class="s">'+line+'</div></div>';
    g.classList.remove('out'); g.classList.add('on'); hum([30,60,30,60,120]);
    /* #gatefade(oct8) — the exit: the seal and the type fade, the velvet washes to red, the Chamber comes up beneath
       it, and the red itself fades last. Not a cut. */
    var done=false, go=function(){ if(done)return; done=true; clearTimeout(gateTimer); g.classList.add('out');
      setTimeout(function(){ openChamber(); },500); setTimeout(function(){ g.classList.remove('on'); setTimeout(function(){ g.classList.remove('out'); },500); },550); };
    g.onclick=go; gateTimer=setTimeout(go,3800);
  }
  function openBoard(){ var sh=sheetEl('scBoardSheet','sc-sheet board',94); var w=me();
    if(atTable(w)){ openGate(w); return; }
    if(fullHouse()&&!atTable(w)){ sh.innerHTML=lockedHTML(w); sh.classList.add('on'); hum([30,30,30]); return; }
    /* #noboard(oct8) — no letter board: we know their letter, so the door opens on their own seat */
    openSeat(); hum([12]); }
  window.openShadowBoard=openBoard;
  document.addEventListener('click',function(ev){
    if(ev.target.closest&&ev.target.closest('#scRibbon')){ ev.stopPropagation(); if(!window.__shkUid){ say('Sign in first.'); return; } if(!SC.loaded){ say('Reading the seats…'); reload().then(openBoard); return; } reload(); openBoard(); return; }
    var b=ev.target.closest&&ev.target.closest('[data-sc]'); if(!b||!b.closest('#scBoardSheet'))return;
    ev.stopPropagation(); hum([12]); $('scBoardSheet').classList.remove('on');
    var cell=ev.target.closest&&ev.target.closest('[data-sl]');   /* #eligible — a tapped letter opens THAT seat */
    if(b.getAttribute('data-sc')==='chamber')openChamber(); else openSeat(cell?cell.getAttribute('data-sl'):null);
  },true);

  /* ── THE SEAT SHEET — claim it, or give it up ───────────────────────────────── */
  /* #eligible(oct8) — the seat sheet leads with ELIGIBLE / NOT ELIGIBLE and one reason, no lecture. */
  function elig(ok,why){ return '<div class="sc-elig'+(ok?' ok':'')+'"><i>'+(ok?'✓':'✕')+'</i>'+(ok?'Eligible':'Not eligible')+'</div><p class="sc-p" style="text-align:center">'+why+'</p>'; }
  function openSeat(pick){
    var w=me(), L=pick||w.letter, s=SC.seats[L], ask=SC.claims.filter(function(c){ return c.handle===w.handle&&c.letter===L; })[0];
    var sh=sheetEl('scSeat','sc-sheet',95); var h='<div class="sheet-card"><button type="button" class="sc-close" data-scx>✕</button>';
    h+='<div class="sc-h"><div class="t" style="font-size:21px">⚜ The Shadow Council</div><div class="k" style="font-family:Cinzel,serif;font-size:9.5px;letter-spacing:.3em;margin:2px 0 12px">Secret Society</div><div class="sc-seal'+(s?'':' open')+'">'+L+'</div><div class="t" style="font-size:18px">The Seat of '+L+'</div>';
    if(w.head){
      h+='<div class="s">You hold the table, not a seat.</div></div><div class="sc-rule"></div>'
        +'<p class="sc-p">The Keymaster oversees every seat and holds none. Your own letter, '+esc(L)+', '+(s?'is spoken for by <b>'+esc(s.handle)+'</b>.':'stands open like any other — a casual with a '+esc(L)+' card can claim it.')+'</p>'
        +'<div class="sc-row"><button type="button" class="sc-btn" data-scgo="chamber">⚜ Enter the Chamber</button></div>';
    } else if(w.seat===L){
      h+='<div class="s">Seated '+ago(s.since)+'</div></div><div class="sc-rule"></div>'+(s.word?'<div class="sc-q">“'+esc(s.word)+'”</div>':'')
        +'<p class="sc-p dim">You represent the '+esc(L)+'’s on the Council. Help them. Answer them. What you cannot answer, push up the line. The seat is yours until you give it up, or the council takes it.</p>'
        +'<div class="sc-row"><button type="button" class="sc-btn" data-scgo="chamber">⚜ Enter the Chamber</button></div>'
        +'<div class="sc-row"><button type="button" class="sc-btn ghost" data-scgo="giveup">Retire the seat · step down</button></div>';
    } else if(ask){
      h+='<div class="s">Your claim is in · filed '+ago(ask.at)+'</div></div><div class="sc-rule"></div>'
        +'<p class="sc-p dim">The council votes when the window closes'+(ask.ends?' · '+new Date(ask.ends).toLocaleDateString(undefined,{month:'short',day:'numeric'}):'')+'. You will hear by DM when the seat is yours — or when it is not.</p>'
        +'<div class="sc-row"><button type="button" class="sc-btn ghost" data-scgo="unclaim">Withdraw the claim</button></div>';
    } else if(L!==w.letter){
      h+='<div class="s">'+(s?'This seat is held':'This seat stands open')+'</div></div><div class="sc-rule"></div>'+elig(false,'This is not your letter.');
    } else if(s){
      h+='<div class="s">This seat is held</div></div><div class="sc-rule"></div>'+elig(false,'Wait until the Shadow Council member retires a seat.');
    } else {
      h+='<div class="s">This seat stands open</div></div><div class="sc-rule"></div>'+elig(true,'One seat per letter, twenty-six seats. Take '+esc(L)+' and you become the '+esc(L)+'’s representative on the Council: you help new members, answer what you can, push up what you can’t, and sit in on every vote.')
        +'<textarea class="sc-in" id="scWhy" rows="2" maxlength="300" placeholder="Optional message to the council — why do you want to join? Short answer." style="margin-bottom:2px"></textarea>'
        +'<div class="sc-row"><button type="button" class="sc-btn" data-scgo="claim">Take the seat of '+esc(L)+'</button></div>'
        +'<p class="sc-p dim" style="margin-top:10px;text-align:center">Filing opens a seven-day window for '+esc(L)+'. Others of the letter may file too; the council votes.</p>';
    }
    h+='</div>'; sh.innerHTML=h; sh.classList.add('on');
  }
  document.addEventListener('click',function(ev){
    var x=ev.target.closest&&ev.target.closest('[data-scx]'); if(x){ var s=x.closest('.sheet'); if(s){ s.classList.remove('on'); if(s.id==='scChamber'){ try{ floorTrack(typeof CURRENT_ROOM!=='undefined'?CURRENT_ROOM:null); }catch(e){} } } return; }
    var g=ev.target.closest&&ev.target.closest('[data-scgo]'); if(!g)return;
    var k=g.getAttribute('data-scgo'), w=me(), L=w.letter;
    if(k==='chamber'){ $('scSeat')&&$('scSeat').classList.remove('on'); openChamber(); return; }
    if(k==='board'){ var bs=sheetEl('scBoardSheet','sc-sheet board',94); paintBoard(); bs.classList.add('on'); return; }
    if(k==='giveup'&&w.seat)L=w.seat;
    if(k==='claim'){ rpc('sc_claim',{p_note:($('scWhy')&&$('scWhy').value.trim())||null}).then(function(){ hum([20,40,60]); say('⚜ Your claim on the seat of '+L+' is in. The council votes when the window closes.'); $('scSeat').classList.remove('on'); reload(); }).catch(function(){}); return; }
    if(k==='unclaim'){ rpc('sc_withdraw').then(function(){ say('Claim withdrawn.'); $('scSeat').classList.remove('on'); reload(); }).catch(function(){}); return; }
    if(k==='giveup'){ var go=function(){ rpc('sc_retire').then(function(){ hum([80]); say('You have stepped down. The seat of '+L+' is open.'); ['scSeat','scChamber'].forEach(function(id){ var e=$(id); if(e)e.classList.remove('on'); }); try{ floorTrack(typeof CURRENT_ROOM!=='undefined'?CURRENT_ROOM:null); }catch(e){} reload(); }).catch(function(){}); };
      /* #retire(oct8) — stepping down is deliberate: an ARE YOU SURE that says what it means */
      try{ shConfirm('Retire the seat of '+L+' and step down from the Shadow Council? The seat opens for another '+L+' at once. Your ⚜ mark stays with you.',go,{title:'Are you sure?',icon:'⚜',okText:'Step down'}); }catch(e){ if(confirm('Retire the seat of '+L+' and step down?'))go(); } return; }
  },true);

  /* ── THE CHARTER — the rules of the house, as the Keymaster set them (#charter, oct 8) ── */
  var CHARTER=[
    ['I · The Seats','One seat per letter, twenty-six seats. A seat holder is the representative of their letter on the Council: welcomes them, answers them, and pushes up what they cannot answer. A seat is claimed and seated; it can be given up, and then it stands open for the next casual of that letter.'],
    ['II · Equals at the Table','Every seat is equal to every other. Members treat one another with respect — at the table, on the Hall, and on the docks. Disagree with the motion, never the member.'],
    ['III · The Keymaster','The Keymaster holds the table, not a seat. The Keymaster can decree a motion carried or struck down, appoint the Keeper of the Count, and alone can bring the removal of a council member to a vote.'],
    ['IV · Motions','Any seat may put a motion. Two-thirds of the seated carries it. The Keeper of the Count seals the vote once it is cast, works the count, and announces the result to the table.'],
    ['V · Bans','A seat holder may request the ban of a regular member, with the reason. No seat holder may request the ban of another council member. Only the Keymaster may bring that to the table, and it carries at two-thirds vote.'],
    ['VI · Succession','When the Keymaster moves up to the union, the Keymaster opens the seat. Every seat holder casts one vote for one seat holder. The Keeper of the Count seals the vote, works the count, and announces the new Keymaster to everybody, who welcome them in. Most votes takes the table; a tie goes to a second round between the tied. The new Keymaster then appoints a Keeper of the Count.'],
    ['VII · The Door','What is said in the Chamber stays in the Chamber. Who sits in it is known to those who do, and worn as a mark.']
  ];
  function openCharter(){
    var sh=sheetEl('scCharter','sc-sheet',98); var w=me();
    sh.innerHTML='<div class="sheet-card"><button type="button" class="sc-close" data-scx>✕</button>'
      +'<div class="sc-h" style="padding-top:14px"><div class="o">The Order of The Shadow Hook</div><div class="k">The Shadow Council</div><div class="t" style="font-size:20px">The Charter</div><div class="s">Keeper of the Count · '+esc(SC.teller||'not yet appointed')+'</div></div><div class="sc-rule"></div>'
      +CHARTER.map(function(c){ return '<div class="sc-sec">'+c[0]+'</div><p class="sc-p">'+c[1]+'</p>'; }).join('')
      +'<div class="sc-row"><button type="button" class="sc-btn ghost" data-scx>Close</button></div></div>';
    sh.classList.add('on');
  }
  window.openCharter=openCharter;

  /* ── THE CHAMBER — velvet, gold, three tabs ────────────────────────────────── */
  var tab='table';
  function openChamber(t){
    var w=me(); if(!atTable(w)){ say('The Chamber opens to seat holders and the Keymaster.'); hum([30,30,30]); return; }
    if(t)tab=t; var sh=sheetEl('scChamber','sc-sheet full',96); paintChamber(); sh.classList.add('on'); hum([15,30,15]);   /* docks under the console like .roomscreen: top:var(--tbH) */
    try{ floorTrack('The Chamber'); }catch(e){}   /* #inroom — the roster says where you stand */
    reload().then(paintChamber);
  }
  window.openShadowCouncil=openChamber;
  /* #inroom(oct8) — who's in the Chamber: presence (mocked here; live it's the same roster the rooms use) */
  function inRoom(h){ var w=me(); if(h===w.handle)return true; try{ return (window.FLOOR&&FLOOR.roster||[]).some(function(r){ return r.h===h&&r.room==='The Chamber'; }); }catch(e){ return false; } }
  /* #hemicycle · #chambercalm — the floor, drawn on its own so presence can redraw just this */
  function floorSVG(w){

      var rows=[[7,72],[9,108],[10,144]], cx=190, cy=160, i=0, out='';
      rows.forEach(function(r){ var n=r[0], rad=r[1];
        for(var k=0;k<n;k++){ var a=Math.PI+Math.PI*(k+0.5)/n, x=cx+rad*Math.cos(a), y=cy+rad*Math.sin(a), L=LETTERS[i++], st=SC.seats[L], here=st&&inRoom(st.handle);
          out+='<g class="hs'+(st?' on':'')+(L===w.seat?' me':'')+(here?' in':'')+'" transform="translate('+x.toFixed(1)+','+y.toFixed(1)+')"><title>'+(st?esc(st.handle)+(here?' · in the room':''):'Seat of '+L+' · open')+'</title>'+(here?'<circle class="halo" r="17"/>':'')+'<circle r="12.5"/><text y="4.5">'+L+'</text></g>'; } });
      var kmHere=inRoom(SC.head.handle);
      out+='<g class="hs head'+(kmHere?' in':'')+'" transform="translate('+cx+','+cy+')"><title>The Keymaster · '+esc(SC.head.handle)+(kmHere?' · in the room':'')+'</title><path d="M-30 -2 h60 l-6 12 h-48 z"/>'+(kmHere?'<circle class="halo" r="20" cy="-12"/>':'')+'<circle r="15" cy="-12"/><text y="-7">⚜</text></g>';
      var nIn=seated().filter(function(L){ return inRoom(SC.seats[L].handle); }).length+(kmHere?1:0);
      return '<svg class="sc-floor" viewBox="0 4 380 174" aria-label="The Chamber floor"><defs><radialGradient id="scGold" cx="35%" cy="30%"><stop offset="0" stop-color="#f1d58e"/><stop offset=".6" stop-color="#d4b36a"/><stop offset="1" stop-color="#8c6f33"/></radialGradient></defs>'+out+'</svg>';
  }
  function tableHTML(w){
    /* #hemicycle(oct8) — THE CHAMBER FLOOR, drawn like a legislature: the Keymaster's seal at the podium, and
       three rising arcs of seats facing it, front row A–G, then H–P, then Q–Z. Gold = seated, dashed = open. */
    var ring=floorSVG(w);
    
    var rows=SC.table.slice().sort(function(a,b){ return a.at-b.at; }).map(function(m){
      var head=m.who===SC.head.handle, sys=m.who==='THE TABLE';
      return '<div class="sc-msg"><div class="av'+(head?' head':'')+'">'+(head?'⚜':sys?'·':esc(m.letter))+'</div><div><div class="who">'+esc(m.who)+'<span>'+(head?'THE KEYMASTER':sys?'':'SEAT OF '+esc(m.letter))+' · '+ago(m.at)+'</span></div><div class="bd">'+m.body+'</div></div></div>';
    }).join('');
    return ring+'<div class="sc-sec">The Table</div>'+rows;
  }
  function motionsHTML(w){
    var N=seated().length, need=Math.ceil(N*2/3);
    var list=SC.motions.slice().sort(function(a,b){ return (a.state==='open'?0:1)-(b.state==='open'?0:1)||b.at-a.at; }).map(function(m){
      var v=m.votes||{}, aye=0,nay=0,pass=0; Object.keys(v).forEach(function(k){ if(v[k]==='aye')aye++; else if(v[k]==='nay')nay++; else pass++; });
      var mine=v[w.handle]||'', pct=N?Math.min(100,aye/N*100):0, mark=N?need/N*100:66;
      var st=m.state==='open'?'open · needs '+need+' of '+N:m.state;
      var h='<div class="sc-mo"><div class="k"><span>'+(m.kind==='remove'?'☠ Removal':'⚜ Motion')+' · by '+esc(m.by)+'</span><em class="'+m.state+'">'+st+'</em></div><div class="t">'+esc(m.title)+'</div><div class="b">'+esc(m.body)+'</div>'
        +'<div class="sc-bar"><b style="width:'+pct+'%"></b><i style="left:'+mark+'%"></i></div><div class="sc-tally"><span><b>'+aye+'</b> aye</span><span><b>'+nay+'</b> nay</span><span><b>'+pass+'</b> abstain</span><span>⅔ = <b>'+need+'</b></span></div>';
      if(m.state==='open'){
        if(w.seat)h+='<div class="sc-vote"><button type="button" data-scv="aye" data-m="'+m.id+'" class="'+(mine==='aye'?'on':'')+'">Aye</button><button type="button" data-scv="nay" data-m="'+m.id+'" class="'+(mine==='nay'?'on':'')+'">Nay</button><button type="button" data-scv="pass" data-m="'+m.id+'" class="'+(mine==='pass'?'on':'')+'">Abstain</button></div>';
        if(w.head)h+='<div class="sc-vote"><button type="button" class="dec" data-scd="carried" data-m="'+m.id+'">⚜ Decree it carried</button><button type="button" class="dec" data-scd="failed" data-m="'+m.id+'">Strike it down</button></div>';
      }
      return h+'</div>';
    }).join('');
    /* #quietremoval — removal is not on the menu. The ⅔ tally still knows how (kind 'remove'), for the day it's needed. */
    var put='<div class="sc-sec">Put a motion</div>'
      +'<input class="sc-in" id="scMT" maxlength="80" placeholder="The motion, in one line" style="margin-bottom:8px">'
      +'<textarea class="sc-in" id="scMB" rows="2" maxlength="400" placeholder="Why the table should carry it"></textarea>'
      +'<div class="sc-row"><button type="button" class="sc-btn" data-scc="motion">Put it to the table</button></div>'
      +'<p class="sc-p dim" style="margin-top:10px">Two-thirds of the seated carries a motion. The Keymaster can decree one carried.</p>';
    return '<div class="sc-sec">Motions</div>'+(list||'<p class="sc-p dim">No motion on the floor.</p>')+put;
  }
  /* #election(oct8) — THE APPLICANTS: every open claim, grouped by letter, with the facts the council weighs —
     hours on the book, member since, days active and calls logged this month, last seen — and one vote per letter
     per seat. When the window closes any seat seals it; the crown's nod (Seat / Decline) stands beside the vote. */
  function fact(v,unit){ return (v==null||v==='')?'—':(v+(unit||'')); }
  function applicantsHTML(w){
    var A=SC.applicants||[]; if(!A.length)return '<div class="sc-sec">Applicants</div><p class="sc-p dim">Nobody has filed for a seat.</p>';
    var by={}; A.forEach(function(a){ (by[a.letter]=by[a.letter]||[]).push(a); });
    return '<div class="sc-sec">Applicants</div>'+Object.keys(by).sort().map(function(L){ var list=by[L], ends=list[0].ends, closed=ends&&ends<Date.now();
      var head='<div class="sc-mo"><div class="k"><span>⚜ The seat of '+L+' · '+list.length+' filed</span><em class="'+(closed?'carried':'')+'">'+(closed?'window closed':'window closes '+new Date(ends).toLocaleDateString(undefined,{month:'short',day:'numeric'}))+'</em></div>';
      var rows=list.map(function(a){ var isNew=a.since&&(Date.now()-ts(a.since))<30*864e5, idle=a.days===0;
        return '<div class="sc-ap'+(a.mine?' mine':'')+'"><div class="who"><b>'+esc(a.handle)+'</b><span>'+(isNew?'new this month':idle?'quiet lately':'active')+' · filed '+ago(a.at)+'</span></div>'
          +(a.note?'<div class="note">“'+esc(a.note)+'”</div>':'')
          +'<div class="facts"><span><b>'+fact(a.hrs!=null?Math.round(+a.hrs):null)+'</b>hours on the book</span><span><b>'+(a.since?new Date(ts(a.since)).toLocaleDateString(undefined,{month:'short',year:'2-digit'}):'—')+'</b>member since</span><span><b>'+a.days+'</b>days in, 30d</span><span><b>'+a.calls+'</b>calls logged, 30d</span><span><b>'+(a.seen?ago(a.seen):'—')+'</b>last seen</span></div>'
          +'<div class="sc-vote"><button type="button" class="'+(a.mine?'on':'')+'" data-scav="'+a.id+'">'+(a.mine?'✓ Your vote':'Vote')+' · '+a.votes+'</button>'
          +(w.head?'<button type="button" class="dec" data-scn="seat" data-c="'+a.id+'">Seat by nod</button><button type="button" class="dec" data-scn="decline" data-c="'+a.id+'">Decline</button>':'')+'</div></div>'; }).join('');
      var seal=(closed||w.head)?'<div class="sc-row"><button type="button" class="sc-btn" data-scseal="'+L+'">⚜ Seal the election for '+L+'</button></div>':'<p class="sc-p dim" style="margin:8px 0 0">The seal opens when the window closes.</p>';
      return head+rows+seal+'</div>'; }).join('');
  }
  function deskHTML(w){
    var T=SC.traffic;
    var h='<div class="sc-sec">Foot traffic</div><div class="sc-stat"><div><b>'+T.today+'</b><span>in today</span></div><div><b>'+T.week+'</b><span>this week</span></div><div><b>'+T.month+'</b><span>30 days</span></div></div>'
      +'<p class="sc-p dim">Busiest hour '+esc(T.peak)+' · dispatch pulls at '+esc(T.dispatch)+'. Counts only, no names — the same numbers the Keymaster sees.</p>';
    if(w.head){
      h+=applicantsHTML(w);
      /* #charter — the Keeper of the Count, ban requests, and the succession */
      h+='<div class="sc-sec">Keeper of the Count</div><div class="sc-li"><div class="L">'+(SC.teller&&seatOf(SC.teller)||'?')+'</div><div class="d">'+esc(SC.teller||'Nobody')+'<small>seals the vote, works the count, announces it</small></div></div>'
        +'<select class="sc-in" id="scTeller" style="margin:8px 0">'+seated().map(function(L){ return '<option value="'+esc(SC.seats[L].holder)+'"'+(SC.seats[L].holder===SC.tellerUid?' selected':'')+'>'+L+' · '+esc(SC.seats[L].handle)+'</option>'; }).join('')+'</select><div class="sc-row"><button type="button" class="sc-btn ghost" data-scc="teller">Appoint</button></div>';
      var asks=SC.bans.filter(function(b){ return b.state==='asked'; });
      h+='<div class="sc-sec">Ban requests</div>'+(asks.length?asks.map(function(b){ return '<div class="sc-li q"><div class="L">'+esc(b.who.charAt(0))+'</div><div class="d">'+esc(b.who)+'<small>asked by '+esc(b.by)+' · '+esc(b.why)+' · '+ago(b.at)+'</small></div><div class="act"><button type="button" class="n" data-scb="granted" data-c="'+b.id+'">Ban</button><button type="button" data-scb="refused" data-c="'+b.id+'">Refuse</button></div></div>'; }).join(''):'<p class="sc-p dim">None waiting.</p>');
      /* #succfoot(oct8) — while a vote is running its count is news and stays up here; the OPEN THE SEAT button
         is a once-in-a-tenure act and lives at the very foot of the desk, folded, past the roster */
      if(SC.succession)h+='<div class="sc-sec">Succession</div><p class="sc-p">The seat is open. '+Object.keys(SC.succession.votes).length+' of '+seated().length+' have voted. The Keeper of the Count seals it.</p>';
      h+='<div class="sc-sec">The line · pushed up to you</div>'+(SC.line.length?SC.line.map(function(l){
        return '<div class="sc-li"><div class="L">'+esc(l.letter)+'</div><div class="d">'+esc(l.from)+'<small>'+esc(l.body)+' · '+ago(l.at)+'</small></div><div class="act"><button type="button" class="y" data-scn="answer" data-c="'+l.id+'">Answered</button></div></div>'; }).join(''):'<p class="sc-p dim">The line is clear.</p>');
    } else {
      h+=applicantsHTML(w);
      /* #charter — succession vote, and requesting a ban */
      if(SC.succession){ var S=SC.succession, mine=S.votes[w.handle];
        h+='<div class="sc-sec">Succession · the seat is open</div>'+(S.sealed?'<p class="sc-p">Sealed. '+esc(S.winner)+' takes the table.</p>':
          '<p class="sc-p">'+(mine?'You voted for <b>'+esc(mine)+'</b>. ':'One vote, for one seat holder. ')+Object.keys(S.votes).length+' of '+seated().length+' cast.</p>'
          +(mine?'':'<select class="sc-in" id="scSucc" style="margin-bottom:8px">'+seated().map(function(L){ return '<option value="'+esc(SC.seats[L].holder)+'">'+L+' · '+esc(SC.seats[L].handle)+'</option>'; }).join('')+'</select><div class="sc-row"><button type="button" class="sc-btn" data-scc="succ-vote">Cast the vote</button></div>')
          +(w.handle===SC.teller?'<div class="sc-row"><button type="button" class="sc-btn" data-scc="succ-seal">⚜ Seal the count and announce</button></div>':'')); }
      /* #bancollapsed(oct8) — a ban is a serious matter, not a reflex: one quiet line and a button, and the form
         opens only when a seat means it. No pitch, no placeholder inviting a name. */
      h+='<div class="sc-sec">Misconduct</div>'+(SC._banOpen
        ?'<p class="sc-p dim">A regular member, and what they did. Council members can’t be named here.</p><input class="sc-in" id="scBanWho" maxlength="24" placeholder="Handle" style="margin-bottom:8px"><textarea class="sc-in" id="scBanWhy" rows="2" maxlength="240" placeholder="What happened, plainly" style="margin-bottom:8px"></textarea><div class="sc-row"><button type="button" class="sc-btn ghost" data-scc="ban-cancel">Never mind</button><button type="button" class="sc-btn red" data-scc="ban-ask">Request the ban</button></div>'
        :'<div class="sc-row"><button type="button" class="sc-btn ghost" data-scc="ban-open">Report serious misconduct</button></div>');
      /* #accessgranted — the board no longer greets a member, so the seat's own controls live here */
      h+='<div class="sc-sec">Your seat</div><div class="sc-li"><div class="L">'+esc(w.seat)+'</div><div class="d">Seat of '+esc(w.seat)+'<small>seated '+ago((SC.seats[w.seat]||{}).since||Date.now())+'</small></div><div class="act"><button type="button" class="n" data-scgo="giveup">Retire the seat</button></div></div>';
      /* #letterline — what came in on your letter. Answer it, or one tap pushes it to the Keymaster. */
      var q=SC.inbox.filter(function(x){ return x.letter===w.seat&&x.state!=='answered'; }).sort(function(a,b){ return a.at-b.at; });
      h+='<div class="sc-sec">Questions on '+esc(w.seat)+'</div>'+(q.length?q.map(function(x){ var late=x.state==='open'&&Date.now()-x.at>SC.lateAfter;
        return '<div class="sc-li q"><div class="L">'+esc(x.letter)+'</div><div class="d">'+esc(x.from)+'<small>'+esc(x.body)+' · '+ago(x.at)+(x.state==='pushed'?' · <b style="color:var(--sc-gold-hi)">with the Keymaster</b>':late?' · <b style="color:#e07a6e">late — on the Jobs board</b>':'')+'</small></div>'
          +'<div class="act">'+(x.state==='open'?'<button type="button" class="y" data-scq="answered" data-c="'+x.id+'">Answered</button><button type="button" data-scq="push" data-c="'+x.id+'">→ Keymaster</button>':'<button type="button" class="y" data-scq="answered" data-c="'+x.id+'">Answered</button>')+'</div></div>'; }).join('')
        :'<p class="sc-p dim">Nothing waiting on '+esc(w.seat)+'. Questions from your letter land here; answer them, or push one to the Keymaster with a tap.</p>')
        +'<p class="sc-p dim">A question left '+Math.round(SC.lateAfter/36e5)+' hours goes on the Jobs board for any seat to take.</p>';
    }
    h+='<div class="sc-sec">The roster · by handle only</div>'+LETTERS.map(function(L){ var s=SC.seats[L];
      return '<div class="sc-li"><div class="L'+(s?'':' open')+'">'+L+'</div><div class="d">'+(s?esc(s.handle)+'<small>seated '+ago(s.since)+'</small>':'<span style="color:var(--sc-dim)">open seat</span>')+'</div>'
        +'</div>'; }).join('');
    h+='<p class="sc-p dim" style="margin-top:12px">More tools come to this desk as the Keymaster hands them down. The Command Center stays the Keymaster’s.</p>';
    /* #succfoot(oct8) — the Keymaster's succession, at the foot and folded: one quiet line, and the red button only
       shows once the Keymaster opens the fold (same shape as #bancollapsed). Used once, when the seat is given up. */
    if(w.head&&!SC.succession){
      h+='<div class="sc-sec" style="margin-top:26px">Succession</div>'+(SC._succOpen
        ?'<p class="sc-p dim">When you move up to the union, open the seat here. Every seat holder votes for one of their own; the Keeper of the Count seals it and announces your successor. This can’t be taken back.</p><div class="sc-row"><button type="button" class="sc-btn ghost" data-scc="succ-cancel">Not yet</button><button type="button" class="sc-btn red" data-scc="open-seat">Open the Keymaster’s seat</button></div>'
        :'<p class="sc-p dim">For the day you move up to the union.</p><div class="sc-row"><button type="button" class="sc-btn ghost" data-scc="succ-open">Give up the table…</button></div>');
    }
    return h;
  }
  /* ── JOBS — work for port bucks. #jobs(oct8) ───────────────────────────────────
     The Keymaster posts a job with a bounty; a seat takes it, marks it done, the Keymaster
     pays. A letter question left too long becomes a job on its own — any seat can take it. */
  function lateQuestions(){ return SC.inbox.filter(function(x){ return x.state==='open'&&!x.taken&&Date.now()-x.at>SC.lateAfter; }); }
  function openJobs(){ return SC.jobs.filter(function(j){ return j.state==='open'; }).concat(lateQuestions().map(function(x){ return {id:'q:'+x.id,title:'Answer a late question on '+x.letter,body:esc(x.from)+': '+esc(x.body),bucks:10,by:'the line',at:x.at,state:'open',late:true}; })); }
  function jobCard(j,w){
    var st=j.state==='open'?'open':j.state==='taken'?'taken · '+esc(j.taker):j.state==='done'?'done · '+esc(j.taker)+' · awaiting pay':'paid · '+esc(j.taker);
    var h='<div class="sc-mo"><div class="k"><span>'+(j.late?'⏱ Late question':'⚒ Job')+' · '+esc(j.by)+'</span><em class="'+(j.state==='paid'?'carried':'')+'">'+st+'</em></div><div class="t">'+esc(j.title)+' <span style="color:var(--sc-gold-hi);white-space:nowrap">· '+j.bucks+' ⚓</span></div><div class="b">'+j.body+'</div>';
    var act='';
    if(j.state==='open'&&!w.head)act='<button type="button" data-scj="take" data-c="'+j.id+'">Take it</button>';
    if(j.state==='taken'&&j.taker===w.handle)act='<button type="button" class="on" data-scj="done" data-c="'+j.id+'">Mark it done</button>';
    if(j.state==='done'&&w.head)act='<button type="button" class="on" data-scj="pay" data-c="'+j.id+'">Pay '+j.bucks+' ⚓ to '+esc(j.taker)+'</button>';
    return h+(act?'<div class="sc-vote">'+act+'</div>':'')+'</div>';
  }
  function jobsHTML(w){
    var open=openJobs(), mine=SC.jobs.filter(function(j){ return j.taker===w.handle&&j.state!=='paid'; }), rest=SC.jobs.filter(function(j){ return j.state!=='open'&&!(j.taker===w.handle&&j.state!=='paid'); });
    var h='<p class="sc-p dim">Work the house needs done, paid in port bucks ⚓: files added, corrections made, questions answered. Take a job, do it, mark it done; the Keymaster pays it out.</p>';
    if(w.head)h+='<div class="sc-sec">Post a job</div><input class="sc-in" id="scJT" maxlength="80" placeholder="The job, in one line" style="margin-bottom:8px"><textarea class="sc-in" id="scJB" rows="2" maxlength="300" placeholder="What done looks like" style="margin-bottom:8px"></textarea><div style="display:flex;align-items:center;gap:10px;margin-bottom:8px"><span class="sc-p dim" style="margin:0;white-space:nowrap">Bounty ⚓</span><input class="sc-in" id="scJP" type="number" min="1" max="500" value="20" style="flex:1"></div><div class="sc-row"><button type="button" class="sc-btn" data-scc="job">Post it · ⚓ bounty</button></div>';
    if(mine.length)h+='<div class="sc-sec">Your jobs</div>'+mine.map(function(j){ return jobCard(j,w); }).join('');
    h+='<div class="sc-sec">Open · take one</div>'+(open.length?open.map(function(j){ return jobCard(j,w); }).join(''):'<p class="sc-p dim">Nothing open. Check back after the next draw.</p>');
    if(rest.length)h+='<div class="sc-sec">In hand · done · paid</div>'+rest.sort(function(a,b){ return b.at-a.at; }).map(function(j){ return jobCard(j,w); }).join('');
    return h;
  }
  function paintChamber(){
    var sh=$('scChamber'); if(!sh)return; var w=me(), N=seated().length;
    /* #chambercalm — remember what's being typed and where the cursor sits, then put it back after the repaint */
    var keep=null; try{ var ae=document.activeElement; if(ae&&sh.contains(ae)&&ae.id&&/^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName)){ keep={id:ae.id,v:ae.value,s:ae.selectionStart,e:ae.selectionEnd}; } var body=sh.querySelector('.sc-body'); var st=body?body.scrollTop:0; }catch(e){}
    var vals={}; try{ sh.querySelectorAll('input[id],textarea[id],select[id]').forEach(function(el){ if(el.value)vals[el.id]=el.value; }); }catch(e){}
    paintChamberNow(w,N);
    try{ Object.keys(vals).forEach(function(id){ var el=$(id); if(el&&!el.value)el.value=vals[id]; });
      if(keep){ var el=$(keep.id); if(el){ el.value=keep.v; el.focus({preventScroll:true}); try{ el.setSelectionRange(keep.s,keep.e); }catch(e){} } }
      var b2=sh.querySelector('.sc-body'); if(b2&&keep)b2.scrollTop=st; }catch(e){}
  }
  function paintChamberNow(w,N){
    var sh=$('scChamber');
    var open=SC.motions.filter(function(m){ return m.state==='open'&&!(m.votes||{})[w.handle]; }).length, wait=w.head?SC.claims.length+SC.line.length:SC.inbox.filter(function(x){ return x.letter===w.seat&&x.state==='open'; }).length, jobsOpen=w.head?SC.jobs.filter(function(j){ return j.state==='done'; }).length:openJobs().length;
    var h='<div class="sheet-card"><button type="button" class="sc-close" data-scx>✕</button>'
      +'<div class="sc-h"><div class="o">The Order of The Shadow Hook</div><div class="k">Secret Society</div><div class="t">⚜ The Chamber</div><div class="s">'+(w.head?'You hold the table.':'Seat of '+esc(w.seat)+' · '+esc(w.handle))+' · '+N+' seated · '+(26-N)+' open</div><a href="#" class="sc-charterlink" data-scc="charter">⚖ The Charter</a></div><div class="sc-rule"></div>'
      +(SC.announce?'<div class="sc-announce">⚜ '+SC.announce+'</div>':'')
      +'<div class="sc-tabs"><button type="button" data-sct="table" class="'+(tab==='table'?'on':'')+'">Table</button><button type="button" data-sct="motions" class="'+(tab==='motions'?'on':'')+'">Motions'+(open?'<i>'+open+'</i>':'')+'</button><button type="button" data-sct="jobs" class="'+(tab==='jobs'?'on':'')+'">Jobs'+(jobsOpen?'<i>'+jobsOpen+'</i>':'')+'</button><button type="button" data-sct="desk" class="'+(tab==='desk'?'on':'')+'">Desk'+(wait?'<i>'+wait+'</i>':'')+'</button></div>'
      +'<div class="sc-body">'+(tab==='table'?tableHTML(w):tab==='motions'?motionsHTML(w):tab==='jobs'?jobsHTML(w):deskHTML(w))+'</div>'
      /* #composebottom(oct8) — the Table's say-box is pinned to the foot of the page, under the scroll, like a chat */
      +(tab==='table'?'<div class="sc-compose"><textarea class="sc-in" id="scSay" rows="1" maxlength="600" placeholder="Speak to the table…"></textarea><button type="button" class="sc-btn" data-scc="say">Say</button></div>':'')+'</div>';
    /* #chamberstill(oct9) — THE CHAMBER IS NOT REBUILT ON EVERY READ. This used to be `sh.innerHTML=h` on every
       paint: the first open, the server read half a second later, and every realtime kick from any of eleven
       tables — each one threw the whole sheet away and drew it again (scroll back to the bottom, halos
       restarted, the say-box recreated, and the 13px text floor re-lifting every label a few frames after).
       Now the sheet is built once; after that only the section whose HTML actually changed is swapped, and a
       read that changes nothing touches nothing. */
    var card=sh.querySelector('.sheet-card');
    if(!card||sh._scTab!==tab){ sh.innerHTML=h; sh._scTab=tab; sh._scHTML=h; if(tab==='table'){ var b=sh.querySelector('.sc-body'); if(b)b.scrollTop=b.scrollHeight; } return; }
    if(sh._scHTML===h)return;
    var t=document.createElement('div'); t.innerHTML=h; var nc=t.firstElementChild;
    var grew=false;
    ['.sc-h','.sc-announce','.sc-tabs','.sc-body','.sc-compose'].forEach(function(q){
      var o=card.querySelector(':scope > '+q), n=nc.querySelector(':scope > '+q);
      if(!o&&!n)return;
      if(o&&!n){ o.remove(); return; }
      if(o&&n&&o.outerHTML===n.outerHTML)return;
      if(q==='.sc-body'&&o&&n){ var wasBottom=o.scrollHeight-o.scrollTop-o.clientHeight<40; o.innerHTML=n.innerHTML; if(tab==='table'&&wasBottom)o.scrollTop=o.scrollHeight; return; }
      if(o&&n){ o.replaceWith(n); return; }
      /* a section that didn't exist before (the announcement appearing): put it where it belongs */
      var after=nc.querySelector(':scope > '+q).previousElementSibling, anchor=after?card.querySelector(':scope > .'+after.className.split(' ')[0]):null;
      if(anchor)anchor.after(n); else card.appendChild(n); grew=true; });
    sh._scHTML=h;
  }
  /* ── THE TAPS — every one a server call, then a fresh read and a repaint (#sclive) ── */
  var after=function(msg,pat){ return function(){ if(msg)say(msg); hum(pat||[20,40,60]); reload().then(paintChamber); }; };
  var nope=function(){};
  document.addEventListener('click',function(ev){
    var sh=$('scChamber'); if(!sh||!sh.classList.contains('on'))return; var w=me();
    var t=ev.target.closest&&ev.target.closest('[data-sct]'); if(t){ tab=t.getAttribute('data-sct'); paintChamber(); hum([8]); return; }
    var v=ev.target.closest&&ev.target.closest('[data-scv]'); if(v){ rpc('sc_vote',{p_motion:v.getAttribute('data-m'),p_choice:v.getAttribute('data-scv')}).then(function(st){ after(st==='carried'?'⚜ The motion carries.':st==='failed'?'The motion fails.':'Vote cast.',st==='carried'?[40,40,120]:[15])(); }).catch(nope); return; }
    var d=ev.target.closest&&ev.target.closest('[data-scd]'); if(d&&w.head){ var ok=d.getAttribute('data-scd')==='carried'; rpc('sc_decree',{p_motion:d.getAttribute('data-m'),p_ok:ok}).then(after(ok?'⚜ So decreed.':'Struck down.',[60])).catch(nope); return; }
    var n=ev.target.closest&&ev.target.closest('[data-scn]'); if(n&&w.head){ var k=n.getAttribute('data-scn'), id=n.getAttribute('data-c');
      if(k==='seat'){ var c=SC.claims.filter(function(x){ return x.id===id; })[0]; rpc('sc_decide',{p_id:id,p_ok:true}).then(after('⚜ '+(c?c.handle:'')+' is seated at '+(c?c.letter:'')+'. DM sent · Keymaster.',[40,40,120])).catch(nope); }
      else if(k==='decline'){ rpc('sc_decide',{p_id:id,p_ok:false}).then(after('Claim declined. DM sent · Keymaster.')).catch(nope); }
      else if(k==='answer'){ rpc('sc_answered',{p_id:id}).then(after('Marked answered.',[12])).catch(nope); }
      return; }
    var av=ev.target.closest&&ev.target.closest('[data-scav]'); if(av){ rpc('sc_claim_vote',{p_claim:av.getAttribute('data-scav')}).then(after('Vote cast.',[15])).catch(nope); return; }
    var sl=ev.target.closest&&ev.target.closest('[data-scseal]'); if(sl){ var SL=sl.getAttribute('data-scseal'); rpc('sc_elect_seal',{p_letter:SL}).then(function(r){ after('⚜ '+r+' takes the seat of '+SL+', elected by the council.',[40,40,120])(); }).catch(nope); return; }
    var qq=ev.target.closest&&ev.target.closest('[data-scq]'); if(qq&&w.seat){ var x=SC.inbox.filter(function(i){ return i.id===qq.getAttribute('data-c'); })[0]; if(!x)return;
      if(qq.getAttribute('data-scq')==='push'){ rpc('sc_push',{p_council_line:x.id}).then(after('Pushed to the Keymaster.')).catch(nope); }
      else { rpc('sc_inbox_done',{p_member:x.member}).then(after('Marked answered.',[12])).catch(nope); } return; }
    var jb=ev.target.closest&&ev.target.closest('[data-scj]'); if(jb){ var jid=jb.getAttribute('data-c'), op=jb.getAttribute('data-scj');
      if(jid.indexOf('q:')===0){ if(op==='take'){ rpc('sc_job_from_line',{p_council_line:jid.slice(2)}).then(after('It’s yours. Answer them and mark it done.')).catch(nope); } return; }
      var j=SC.jobs.filter(function(i){ return i.id===jid; })[0]; if(!j)return;
      if(op==='take'){ rpc('sc_job_take',{p_id:jid}).then(after('⚒ Taken. '+j.bucks+' ⚓ when it’s done and paid.')).catch(nope); }
      else if(op==='done'){ rpc('sc_job_done',{p_id:jid}).then(after('Marked done. The Keymaster pays it out.',[40,40,120])).catch(nope); }
      else if(op==='pay'&&w.head){ rpc('sc_job_pay',{p_id:jid}).then(after('⚓ '+j.bucks+' paid to '+j.taker+'.',[40,40,120])).catch(nope); }
      return; }
    var c=ev.target.closest&&ev.target.closest('[data-scc]'); if(!c)return; var kind=c.getAttribute('data-scc'); if(kind==='charter'){ ev.preventDefault(); openCharter(); return; }
    var bb=ev.target.closest&&ev.target.closest('[data-scb]'); if(bb&&w.head){ var ok2=bb.getAttribute('data-scb')==='granted', br=SC.bans.filter(function(x){ return x.id===bb.getAttribute('data-c'); })[0];
      rpc('sc_ban_decide',{p_id:bb.getAttribute('data-c'),p_ok:ok2}).then(after(ok2?'☠ '+(br?br.who:'')+' is banned.':'Refused.')).catch(nope); return; }
    if(kind==='teller'&&w.head){ var tu=$('scTeller').value; if(!tu){ say('Seat someone first.'); return; } rpc('sc_set_teller',{p_uid:tu}).then(after('⚜ Keeper of the Count appointed.',[40,40,120])).catch(nope); return; }
    if(kind==='open-seat'&&w.head){ var start=function(){ SC._succOpen=false; rpc('sc_open_seat').then(after('The seat is open. The council votes.',[80,40,80,40,160])).catch(nope); };
      try{ shConfirm('Open the Keymaster’s seat? Every seat holder votes for one of their own, and the Keeper of the Count announces your successor.',start,{title:'Succession',icon:'⚜',okText:'Open the seat'}); }catch(e){ if(confirm('Open the seat?'))start(); } return; }
    if(kind==='succ-vote'&&w.seat){ rpc('sc_succ_vote',{p_candidate:$('scSucc').value}).then(after('Your vote is cast and sealed.')).catch(nope); return; }
    if(kind==='succ-seal'&&w.uid===SC.tellerUid){ rpc('sc_succ_seal').then(function(r){ after(r==='tie'?'A tie — a second round between the tied.':'⚜ Announced: '+r+' is the new Keymaster.',[40,40,40,40,200])(); }).catch(nope); return; }
    if(kind==='succ-open'&&w.head){ SC._succOpen=true; paintChamber(); try{ var f=document.querySelector('[data-scc="open-seat"]'); if(f&&f.scrollIntoView)f.scrollIntoView({block:'end',behavior:'smooth'}); }catch(e){} return; }
    if(kind==='succ-cancel'){ SC._succOpen=false; paintChamber(); return; }
    if(kind==='ban-open'){ SC._banOpen=true; paintChamber(); return; }
    if(kind==='ban-cancel'){ SC._banOpen=false; paintChamber(); return; }
    if(kind==='ban-ask'&&w.seat){ var who=($('scBanWho').value||'').trim(), why=($('scBanWhy').value||'').trim(); if(!who||why.length<4){ say('A handle and a reason.'); return; }
      rpc('sc_ban_ask',{p_who:who,p_why:why}).then(function(){ SC._banOpen=false; after('Sent to the Keymaster.')(); }).catch(nope); return; }
    if(kind==='job'&&w.head){ var JT=($('scJT').value||'').trim(), JB=($('scJB').value||'').trim(), JP=parseInt($('scJP').value,10)||0; if(JT.length<4||JP<1){ say('Give the job a line and a bounty.'); return; }
      rpc('sc_job_post',{p_title:JT,p_body:JB,p_bucks:JP}).then(after('⚒ Posted · '+JP+' ⚓')).catch(nope); return; }
    if(kind==='say'){ var txt=($('scSay')&&$('scSay').value.trim())||''; if(!txt)return; $('scSay').value=''; rpc('sc_say',{p_body:txt}).then(after(null,[12])).catch(nope); return; }
    if(kind==='motion'){ var T=($('scMT').value||'').trim(), B=($('scMB').value||'').trim(); if(T.length<4){ say('Give the motion a line.'); return; }
      rpc('sc_motion',{p_title:T,p_body:B}).then(after('⚜ On the floor. The table votes.')).catch(nope); return; }
  },true);

  /* ── REALTIME — the room repaints when the tables move; presence repaints the halos ── */
  var rtTimer=null; function rtKick(){ clearTimeout(rtTimer); rtTimer=setTimeout(function(){ reload().then(function(){ var ch=$('scChamber'); if(ch&&ch.classList.contains('on'))paintChamber(); }); },350); }
  function rtOn(){ try{ if(!window.SB||window.__scRT)return; window.__scRT=SB.channel('shadow-council');
    ['sc_seats','sc_claims','sc_claim_votes','sc_table','sc_motions','sc_votes','sc_jobs','sc_line','sc_bans','sc_house','sc_succ_votes'].forEach(function(t){ window.__scRT.on('postgres_changes',{event:'*',schema:'public',table:t},rtKick); });
    window.__scRT.subscribe(); }catch(e){ console.warn('[sc] realtime',e); } }
  /* #chambercalm(oct8) — presence ticks every few seconds; they used to repaint the whole Chamber and knock the text box out
     from under a typing thumb. Now they redraw only the floor (the halos), in place. */
  var _fsr=window._floorSheetRepaint; window._floorSheetRepaint=function(){ try{ if(typeof _fsr==='function')_fsr.apply(this,arguments); }catch(e){} try{ var ch=$('scChamber'); if(ch&&ch.classList.contains('on')&&tab==='table'){ var old=ch.querySelector('.sc-floor'); if(old){ var w=me(), t=document.createElement('div'); t.innerHTML=floorSVG(w); var nu=t.firstElementChild; if(nu&&nu.outerHTML!==old.outerHTML)old.replaceWith(nu); } } }catch(e){} };
  /* first read once there's a session; keep watching for one */
  /* #calmcouncil — the first read waits for the phone to settle (and runs when idle), not in the boot crowd */
  (function boot(){ var tries=0, iv=setInterval(function(){ if(window.SB&&window.__shkUid){ clearInterval(iv); setTimeout(function(){ var go=function(){ reload(); rtOn(); }; if(window.requestIdleCallback)requestIdleCallback(go,{timeout:8000}); else go(); },window.__scOnDemand?0:20000); } else if(++tries>180)clearInterval(iv); },1000); })();   /* #sclazy — fetched on a tap: no 20 s wait */

  /* ── THE MARK — registered on the wall, locked until a seat is truly taken ──── */
  try{ if(Array.isArray(window.BADGES)&&!BADGES.some(function(b){ return b[1]&&b[1].indexOf('Shadow Council ·')===0; }))BADGES.push(['⚜','Shadow Council · a seat at the table',0,2]); }catch(e){}

})();
try{ if(window.SC)window.SC._live=true; if(typeof window.__scReady==='function')window.__scReady(); }catch(e){}
