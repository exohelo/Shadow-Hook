/* messy_boats.js — #messyboats (oct 22). 66 searches, 0 matches: the few people looking were never on the dock at the
   same moment, and the 10 men looking for women could only ever match with 3 women. Three changes, all server-backed:
     · BOATS — the hour has departures (10:00 · 10:20 · 10:40). Everyone gets a push 2 minutes before each boat and the
       people on the dock at the whistle match at once (dates_window().boats / next_boat, messy_tick every minute).
     · THE HOOK — tap GET MESSY and your hook is in for the night (dates_rsvp_set): leave the screen and the server pings
       you when someone you could match with starts looking (dates_seek_ping, skipping people already on the dock) or
       a boat is about to leave. The queue screen shows a live count: on the dock now · for you · hooks in tonight.
     · ANYONE · JUST TALK — a fourth lane in dates.js ('*'): a 10-minute conversation with whoever is on the dock.
   Plus a banner (dates_hours.banner, set with messy_announce) on the Messy card and inside the door, for the holiday push.
   Load once from index.html, after messy_hour.js:  <script src="messy_boats.js?v=oct22a" defer></script> */
(function(){
  'use strict';
  if(window.__messyBoats)return; window.__messyBoats=true;
  var NEON='#ff3d9a', GOLD='#ffe600';
  var E=function(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); };
  var W=null, wAt=0, C=null, cAt=0, hooked=false, hookFor='';

  var st=document.createElement('style'); st.textContent=
    '.mb-queue{width:100%;display:flex;flex-direction:column;gap:8px}'+
    '.mb-boat{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:12px;background:linear-gradient(180deg,#2a0b1a,#0b0509);border:1px solid rgba(255,230,0,.45);box-shadow:0 0 14px rgba(255,230,0,.15)}'+
    '.mb-boat i{font-style:normal;font-size:22px;line-height:1}.mb-boat b{display:block;font:400 17px Anton,sans-serif;letter-spacing:.06em;color:'+GOLD+'}.mb-boat small{display:block;font:600 12px Inter,system-ui,sans-serif;color:#d7c6cf;line-height:1.35}'+
    '.mb-boat.now{border-color:'+NEON+';box-shadow:0 0 18px rgba(255,61,154,.35)}.mb-boat.now b{color:'+NEON+'}'+
    '.mb-count{display:flex;justify-content:center;gap:14px;font:700 11px Inter,system-ui,sans-serif;letter-spacing:.12em;color:#8f979e;text-align:center;flex-wrap:wrap}.mb-count b{color:#f3e9ee;font-size:14px;margin-right:4px}.mb-count .you b{color:'+NEON+'}'+
    '.mb-hook{font:600 12px Inter,system-ui,sans-serif;color:#b89aa8;text-align:center;line-height:1.4}.mb-hook b{color:'+GOLD+'}'+
    '.mb-news{margin:0 0 10px;padding:12px 14px;border-radius:14px;background:linear-gradient(135deg,#3a0f2a,#120812);border:1px solid rgba(255,61,154,.5);box-shadow:0 0 18px rgba(255,61,154,.2)}'+
    '.mb-news .k{font:700 10px Inter,system-ui,sans-serif;letter-spacing:.22em;color:'+NEON+'}.mb-news .t{font:600 14px Inter,system-ui,sans-serif;color:#f3e9ee;line-height:1.4;margin-top:4px}'+
    '.mb-boats{margin-top:8px;font:700 11px Inter,system-ui,sans-serif;letter-spacing:.14em;color:'+GOLD+'}.mb-boats span{color:#8f979e;letter-spacing:.04em;font-weight:600;display:block;margin-top:3px}'+
    '.gm-messy .mb-tag{position:absolute;top:8px;right:8px;z-index:3;padding:3px 7px;border-radius:7px;background:'+NEON+';color:#0b0509;font:800 9px Inter,system-ui,sans-serif;letter-spacing:.16em;box-shadow:0 0 10px '+NEON+';pointer-events:none}';
  document.head.appendChild(st);

  function rpc(fn,args){ return window.SB?window.SB.rpc(fn,args||{}).then(function(r){ if(r.error)throw new Error(r.error.message||'refused'); return r.data; }):Promise.reject(new Error('backend off')); }
  function clock(iso){ try{ var d=new Date(iso), h=d.getHours(), m=d.getMinutes(); return (h%12||12)+(m?':'+(m<10?'0':'')+m:'')+(h<12?' AM':' PM'); }catch(e){ return ''; } }
  function mmss(ms){ var s=Math.max(0,Math.round(ms/1000)); return Math.floor(s/60)+':'+(s%60<10?'0':'')+(s%60); }

  function win(force){
    if(!window.SB||!window.__shkUid)return; if(!force&&Date.now()-wAt<60000)return; wAt=Date.now();
    rpc('dates_window').then(function(w){ if(w){ W=w; paintAll(); } },function(){});
  }
  function counts(){
    if(!window.SB||!window.__shkUid||!document.getElementById('mbQueue'))return; if(Date.now()-cAt<15000)return; cAt=Date.now();
    rpc('dates_rsvp_count').then(function(c){ if(c&&c.ok){ C=c; if(c.mine)hooked=true; paintQueue(); } },function(){});
  }
  /* GET MESSY = the hook goes in for the night, so the server can ping this phone once it leaves */
  function hook(){
    if(!W||W.always)return; var key=W.opens_at||''; if(hooked&&hookFor===key)return; if(!window.SB||!window.__shkUid)return;
    hooked=true; hookFor=key;
    rpc('dates_rsvp_set',{p_on:true}).then(function(c){ if(c&&c.ok){ C=c; cAt=Date.now(); paintQueue(); } },function(){ hooked=false; });
  }

  function nextBoat(){
    if(!W||!W.boats||!W.boats.length)return null;
    var now=Date.now(), b=W.boats.map(function(x){ return Date.parse(x); }).filter(function(t){ return t>=now-90000; });
    return b.length?b[0]:null;
  }
  function paintQueue(){
    var q=document.getElementById('mbQueue'); if(!q)return;
    hook();
    var html='', nb=nextBoat(), open=!!(W&&(W.open||W.always));
    if(W&&!W.always){
      if(nb!=null){
        var left=nb-Date.now(), soon=left<=120000;
        html+='<div class="mb-boat'+(soon?' now':'')+'"><i>\u26F5</i><div><b>'+(left<=0?'BOAT\u2019S LEAVING NOW':soon?'BOAT LEAVES IN '+mmss(left):'NEXT BOAT '+E(clock(nb))+' \u00B7 '+mmss(left))+'</b><small>'+(soon?'Everyone on the dock right now gets matched at once.':'Everyone on the dock at '+E(clock(nb))+' gets matched at once. Stay, or come back for it.')+'</small></div></div>';
      } else if(open){
        html+='<div class="mb-boat"><i>\u26F5</i><div><b>LAST BOAT\u2019S GONE</b><small>The dock stays open till '+E(clock(W.closes_at))+' \u2014 anyone who steps on now matches with whoever is here.</small></div></div>';
      }
    }
    if(C){
      html+='<div class="mb-count"><span><b>'+(+C.on_dock||0)+'</b>ON THE DOCK NOW</span><span class="you"><b>'+(+C.dock_for_you||0)+'</b>FOR YOU</span><span><b>'+(+C.coming||0)+'</b>HOOK'+((+C.coming||0)===1?'':'S')+' IN TONIGHT</span></div>';
    }
    html+='<div class="mb-hook">\uD83E\uDE9D <b>Your hook\u2019s in.</b> Leave this screen and we\u2019ll ping you the moment someone for you starts looking, and before every boat.</div>';
    if(q.innerHTML!==html)q.innerHTML=html;
  }

  /* the door: banner on top, the boats under the countdown */
  function paintDoor(){
    var body=document.getElementById('msyBody'); if(!body||!W)return;
    var news=body.querySelector('.mb-news');
    if(W.banner){
      if(!news){ news=document.createElement('div'); news.className='mb-news'; body.insertBefore(news,body.firstChild); }
      var nh='<div class="k">\u2728 WHAT\u2019S NEW ON THE DOCK</div><div class="t">'+E(W.banner)+'</div>'; if(news.innerHTML!==nh)news.innerHTML=nh;
    } else if(news)news.remove();
    if(W.always||!W.boats||W.boats.length<2)return;
    var host=body.querySelector('.mh-door')||body.querySelector('.mh-left'); if(!host)return;
    var line=host.querySelector('.mb-boats'); if(!line){ line=document.createElement('div'); line.className='mb-boats'; host.appendChild(line); }
    var lh='\u26F5 BOATS '+W.boats.map(function(b){ return E(clock(b).replace(' PM','').replace(' AM','')); }).join(' \u00B7 ')+(W.open?'':' PM')+'<span>Everyone on the dock when a boat leaves gets matched at once. Tap GET MESSY to put your hook in \u2014 we ping you before each one.</span>';
    if(line.innerHTML!==lh)line.innerHTML=lh;
  }
  /* the Messy card on the Hall: a NEW tag while a banner is up */
  function paintCard(){
    var c=document.querySelector('.hcard.gm-messy'); if(!c)return; var t=c.querySelector('.mb-tag');
    if(W&&W.banner){ if(!t){ t=document.createElement('div'); t.className='mb-tag'; t.textContent='NEW'; c.appendChild(t); } }
    else if(t)t.remove();
  }
  function paintAll(){ paintQueue(); paintDoor(); paintCard(); }

  var t=null;
  new MutationObserver(function(){ if(t)return; t=setTimeout(function(){ t=null; if(document.getElementById('mbQueue')){ counts(); } paintAll(); win(false); },300); }).observe(document.documentElement,{childList:true,subtree:true});
  setInterval(function(){ if(document.getElementById('mbQueue')){ paintQueue(); counts(); } },1000);
  setInterval(function(){ win(false); },60000);
  var boot=setInterval(function(){ if(window.SB&&window.__shkUid){ clearInterval(boot); win(true); } },1500);
  /* the Keymaster's megaphone, from the console: messyAnnounce('banner text', 'push title', 'push body') */
  window.messyAnnounce=function(banner,title,body){ return rpc('messy_announce',{p_banner:banner||null,p_title:title||null,p_body:body||null}).then(function(r){ win(true); return r; }); };
})();
