#!/usr/bin/env node
'use strict';
/* ============================================================================
push-board.js — THE LOOKOUT's board sender. Runs right after leftoff.js in
the same workflow. If the wire carries a FRESH end card for the board that
just ran, every subscribed hand within PUSH_AHEAD letters of the next
opening card gets a real push — app closed or not. Dedupes through
push_sent, so the dense cron net sends each board's ping exactly once.
Env: SUPABASE_URL, SUPABASE_SERVICE_KEY, PUSH_AHEAD (letters, default 3)
     VAPID_PUBLIC / VAPID_PRIVATE / VAPID_SUBJECT are optional: without them the
     keys load from km_secrets (where the Oct 29 key pair lives), like the
     Supabase senders do.
nov11: iPhone-app devices (push_subs endpoint "apns:<token>") are handed to the
     push-apns edge function, which sends them through Apple.
Needs: npm i web-push (the workflow step installs it)
========================================================================== */
const webpush=require('web-push');
const env=k=>(process.env[k]||'').trim();
const SB=env('SUPABASE_URL').replace(/\/+$/,''), KEY=env('SUPABASE_SERVICE_KEY');
const AHEAD=Math.max(0,parseInt(env('PUSH_AHEAD')||'3',10));
const AZ='ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const log=(...a)=>console.log('[lookout]',...a);
if(!SB||!KEY){log('missing config — standing down (need SUPABASE_URL and SUPABASE_SERVICE_KEY)');process.exit(0);}
const H={apikey:KEY,Authorization:'Bearer '+KEY,'Content-Type':'application/json'};
async function sel(t,q){const r=await fetch(SB+'/rest/v1/'+t+'?'+q,{headers:H});if(!r.ok)throw new Error(t+': '+r.status);return r.json();}
async function vapid(){
  let pub=env('VAPID_PUBLIC'),priv=env('VAPID_PRIVATE');
  if(!pub||!priv){
    const rows=await sel('km_secrets','select=name,value&name=in.(vapid_public,vapid_private)');
    for(const r of rows||[]){if(r.name==='vapid_public'&&!pub)pub=r.value;if(r.name==='vapid_private'&&!priv)priv=r.value;}
  }
  if(!pub||!priv)throw new Error('no VAPID keys in the environment or km_secrets');
  webpush.setVapidDetails(env('VAPID_SUBJECT')||'mailto:keymaster@theshadowhook.com',pub,priv);
}
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
await vapid();
const openL=AZ.indexOf(open[0]), openN=parseInt(open.slice(1),10);
/* review find #2 — 'select=*' returns AT MOST 1000 rows (PostgREST default): past a
thousand watches, hands silently stopped getting pinged. Filter SERVER-SIDE to just
the letters inside the net — smaller than any cap, cheaper on the wire too. */
const letters=[];for(let i=0;i<=AHEAD;i++)letters.push(AZ[(openL+i)%26]);
const orQ=letters.map(L=>'card.like.'+L+'*').join(',');
const subs=await sel('push_subs','select=*&or=('+orQ+')&limit=5000');
let sent=0,dead=0;const apns=[];
for(const s of subs){
const isApp=String(s.endpoint||'').startsWith('apns:');
if(!s.card||!/^[A-Z]\d{3,5}$/.test(s.card)||(!isApp&&(!s.p256dh||!s.auth)))continue;
const d=((AZ.indexOf(s.card[0])-openL)%26+26)%26;
if(d>AHEAD)continue;
/* review find #3 — same letter but a LOWER number = the board already passed them
this cycle. "That is YOUR letter, get ready" to a hand who was called an hour
ago is noise that teaches people to ignore the Lookout. Skip them. */
if(d===0 && parseInt(s.card.slice(1),10)<openN)continue;
const body=d===0
?('Next board opens on '+open+' — that is YOUR letter. Get ready.')
:('Board ended at '+end+' — next opens '+open+'. Your '+s.card+' is '+d+' letter'+(d>1?'s':'')+' out.');
if(isApp){apns.push({endpoint:s.endpoint,title:'⚓ THE BOARD MOVED',body:body,data:{url:'/',tag:'shk-board'}});continue;}
try{
await webpush.sendNotification({endpoint:s.endpoint,keys:{p256dh:s.p256dh,auth:s.auth}},
JSON.stringify({title:'⚓ THE BOARD MOVED',body:body,tag:'shk-board',url:'/'}));
sent++;
}catch(e){
if(e.statusCode===403||e.statusCode===404||e.statusCode===410){dead++;
await fetch(SB+'/rest/v1/push_subs?endpoint=eq.'+encodeURIComponent(s.endpoint),{method:'DELETE',headers:H});}
else log('send failed:',e.statusCode||e.message);
}
}
if(apns.length){
  try{
    const r=await fetch(SB+'/functions/v1/push-apns',{method:'POST',headers:H,body:JSON.stringify({items:apns})});
    const j=await r.json().catch(()=>({}));
    sent+=j.sent||0;dead+=j.dead||0;
    log('iPhone app: '+(j.sent||0)+' sent, '+(j.dead||0)+' dead, '+(j.failed||0)+' failed');
  }catch(e){log('iPhone app send failed:',e.message);}
}
await fetch(SB+'/rest/v1/push_sent',{method:'POST',headers:Object.assign({Prefer:'return=minimal'},H),body:JSON.stringify([{k:sentKey}])});
log('⚓ announced '+k+' end='+end+' → '+sent+' phones ('+dead+' dead watches cleared)');
})().catch(e=>{console.error('[lookout] FAILED:',e.message);process.exit(1);});
