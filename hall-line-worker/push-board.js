#!/usr/bin/env node
'use strict';
/* ============================================================================
   push-board.js — THE LOOKOUT's board sender. Runs right after leftoff.js in
   the same workflow. If the wire carries a FRESH end card for the board that
   just ran, every subscribed hand within PUSH_AHEAD letters of the next
   opening card gets a real push — app closed or not. Dedupes through
   push_sent, so the dense cron net sends each board's ping exactly once.
   Env: SUPABASE_URL, SUPABASE_SERVICE_KEY, VAPID_PUBLIC, VAPID_PRIVATE,
        VAPID_SUBJECT (mailto:), PUSH_AHEAD (letters, default 3)
   Needs: npm i web-push  (the workflow step installs it)
   ========================================================================== */
const webpush=require('web-push');
const env=k=>(process.env[k]||'').trim();
const SB=env('SUPABASE_URL').replace(/\/+$/,''), KEY=env('SUPABASE_SERVICE_KEY');
/* #lookout — the Order's push identity, PUBLIC half only (safe in the repo; the
   private half signs from the VAPID_PRIVATE GitHub secret and never touches code) */
const VAPID_PUB_DEFAULT='BOIf-N1g5af_QuVRTc9AbScS5YWjUMAX8wSFjfbC4Y6KPVJvLGxzvWrgPSBb38yYvCAuKCJqAGWisb8d-vZpbss';
const AHEAD=Math.max(0,parseInt(env('PUSH_AHEAD')||'3',10));
const AZ='ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const log=(...a)=>console.log('[lookout]',...a);
const VPUB=env('VAPID_PUBLIC')||VAPID_PUB_DEFAULT;
if(!SB||!KEY||!VPUB||!env('VAPID_PRIVATE')){log('missing config — standing down (need SUPABASE_URL/SERVICE_KEY + the VAPID_PRIVATE secret)');process.exit(0);}
webpush.setVapidDetails(env('VAPID_SUBJECT')||'mailto:keymaster@theshadowhook.com',VPUB,env('VAPID_PRIVATE'));
const H={apikey:KEY,Authorization:'Bearer '+KEY,'Content-Type':'application/json'};
async function sel(t,q){const r=await fetch(SB+'/rest/v1/'+t+'?'+q,{headers:H});if(!r.ok)throw new Error(t+': '+r.status);return r.json();}
function laParts(ts){const d=new Date(ts||Date.now());const p=new Intl.DateTimeFormat('en-US',{timeZone:'America/Los_Angeles',hour12:false,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',weekday:'short'}).formatToParts(d).reduce((o,x)=>(o[x.type]=x.value,o),{});return{iso:p.year+'-'+p.month+'-'+p.day,dow:p.weekday,mins:(parseInt(p.hour,10)%24)*60+parseInt(p.minute,10)};}
function targetKey(){const n=laParts();if(n.mins>=19*60)return n.iso+'_'+n.dow+'_PM';if(n.mins>=9*60+30)return n.iso+'_'+n.dow+'_AM';const y=laParts(Date.now()-86400000);return y.iso+'_'+y.dow+'_PM';}
function nextCard(id){const m=/^([A-Z])(\d+)$/.exec(id||'');return m?m[1]+String(parseInt(m[2],10)+1).padStart(m[2].length,'0'):null;}
(async()=>{
  const k=targetKey();
  const rows=await sel('board_wire','k=eq.'+encodeURIComponent(k)+'&select=*');
  const row=rows[0];
  const end=row&&row.patch&&row.patch.end?String(row.patch.end).toUpperCase():null;
  if(!end){log('no end on the wire for '+k+' — nothing to announce');return;}
  const sentKey='board_'+k+'_'+end;
  const dup=await sel('push_sent','k=eq.'+encodeURIComponent(sentKey)+'&select=k');
  if(dup.length){log('already announced '+sentKey);return;}
  const open=nextCard(end);
  /* review find #1 — a malformed end on the wire ('??', a stray word) made nextCard
     return null and the next line threw: a red run over bad data. Say it and stand down. */
  if(!open){log('end card on the wire is unreadable ('+end+') — standing down');return;}
  const openL=AZ.indexOf(open[0]), openN=parseInt(open.slice(1),10);
  /* review find #2 — `select=*` returns AT MOST 1000 rows (PostgREST default): past a
     thousand watches, hands silently stopped getting pinged. Filter SERVER-SIDE to just
     the letters inside the net — smaller than any cap, cheaper on the wire too. */
  const letters=[];for(let i=0;i<=AHEAD;i++)letters.push(AZ[(openL+i)%26]);
  const orQ=letters.map(L=>'card.like.'+L+'*').join(',');
  const subs=await sel('push_subs','select=*&or=('+orQ+')&limit=5000');
  let sent=0,dead=0;
  for(const s of subs){
    if(!s.card||!/^[A-Z]\d{3,5}$/.test(s.card)||!s.p256dh||!s.auth)continue;
    const d=((AZ.indexOf(s.card[0])-openL)%26+26)%26;
    if(d>AHEAD)continue;
    /* review find #3 — same letter but a LOWER number = the board already passed them
       this cycle. "That is YOUR letter, get ready" to a hand who was called an hour
       ago is noise that teaches people to ignore the Lookout. Skip them. */
    if(d===0 && parseInt(s.card.slice(1),10)<openN)continue;
    const body=d===0
      ?('Next board opens on '+open+' — that is YOUR letter. Get ready.')
      :('Board ended at '+end+' — next opens '+open+'. Your '+s.card+' is '+d+' letter'+(d>1?'s':'')+' out.');
    try{
      await webpush.sendNotification({endpoint:s.endpoint,keys:{p256dh:s.p256dh,auth:s.auth}},
        JSON.stringify({title:'⚓ THE BOARD MOVED',body:body,tag:'shk-board',url:'/'}));
      sent++;
    }catch(e){
      if(e.statusCode===404||e.statusCode===410){dead++;
        await fetch(SB+'/rest/v1/push_subs?endpoint=eq.'+encodeURIComponent(s.endpoint),{method:'DELETE',headers:H});}
      else log('send failed:',e.statusCode||e.message);
    }
  }
  await fetch(SB+'/rest/v1/push_sent',{method:'POST',headers:Object.assign({Prefer:'return=minimal'},H),body:JSON.stringify([{k:sentKey}])});
  log('⚓ announced '+k+' end='+end+' → '+sent+' phones ('+dead+' dead watches cleared)');
})().catch(e=>{console.error('[lookout] FAILED:',e.message);process.exit(1);});
