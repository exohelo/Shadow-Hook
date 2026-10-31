/* media_slim.js — #slim (oct 31). Photos were going into chat-media at full phone size (up to 9 MB each), and every
   open of the chat served them again — ~15 GB a day of egress on 127 MB of files. Two things:
     1. EVERY image upload is shrunk first, at the one place they all pass through (the storage client's upload):
        longest side 1280 px, JPEG ~82% — about 150–300 KB. Anything already small (< 350 KB) or a GIF is left alone;
        HEIC the phone can't decode in a canvas goes up as-is. Videos untouched. Covers rooms, DMs, talk, clans,
        stories, the sheet picture, dispatch comments, avatars and banners.
     2. Profile → 🪶 SLIM THE PHOTOS (Keymaster only): walks chat-media, downloads each image over 400 KB, shrinks it
        the same way and writes it back over the same path (same URL — nothing in the app changes). Shows progress;
        safe to stop and run again. Run it once on wifi.
   Load once from index.html, after wire_v2.js:  <script src="media_slim.js?v=oct31a" defer></script> */
(function(){
  'use strict';
  if(window.__mediaSlim)return; window.__mediaSlim=true;
  var MAX=1280, Q=0.82, MIN_BYTES=350*1024, BUCKET='chat-media';
  var say=function(m){ try{ toast(m); }catch(e){} };

  /* ---------- the shrink ---------- */
  function decode(blob){
    return new Promise(function(res,rej){
      if(window.createImageBitmap){ createImageBitmap(blob).then(res,function(){ viaImg(); }); } else viaImg();
      function viaImg(){ var u=URL.createObjectURL(blob), im=new Image(); im.onload=function(){ URL.revokeObjectURL(u); res(im); }; im.onerror=function(){ URL.revokeObjectURL(u); rej(new Error('decode')); }; im.src=u; }
    });
  }
  function shrink(blob){
    return decode(blob).then(function(src){
      var w=src.width||src.naturalWidth, h=src.height||src.naturalHeight; if(!w||!h)throw new Error('size');
      var s=Math.min(1, MAX/Math.max(w,h)), cw=Math.max(1,Math.round(w*s)), ch=Math.max(1,Math.round(h*s));
      var c=document.createElement('canvas'); c.width=cw; c.height=ch; var g=c.getContext('2d'); g.drawImage(src,0,0,cw,ch);
      try{ src.close&&src.close(); }catch(e){}
      return new Promise(function(res){ c.toBlob(function(out){ res(out); },'image/jpeg',Q); });
    });
  }
  function isImage(body,type){ var t=String(type||(body&&body.type)||'').toLowerCase(); return /^image\//.test(t)&&!/gif/.test(t); }

  /* ---------- 1. shrink on upload ---------- */
  function patch(){
    var SB=window.SB; if(!SB||!SB.storage||SB.storage.__slim)return false;
    var proto; try{ proto=Object.getPrototypeOf(SB.storage.from(BUCKET)); }catch(e){ return false; }
    if(!proto||typeof proto.upload!=='function')return false;
    var orig=proto.upload;
    proto.upload=function(path,body,opts){
      var self=this, o=opts||{}, type=o.contentType||(body&&body.type)||'';
      if(!(body instanceof Blob)||!isImage(body,type)||body.size<MIN_BYTES)return orig.call(self,path,body,opts);
      return shrink(body).then(function(small){
        if(!small||small.size>=body.size)return orig.call(self,path,body,opts);
        var o2=Object.assign({},o,{contentType:'image/jpeg'});
        try{ console.info('[slim] '+Math.round(body.size/1024)+'k \u2192 '+Math.round(small.size/1024)+'k '+path); }catch(e){}
        return orig.call(self,path,small,o2);
      },function(){ return orig.call(self,path,body,opts); });
    };
    SB.storage.__slim=true; return true;
  }
  if(!patch()){ var tries=0, w=setInterval(function(){ if(patch()||++tries>240)clearInterval(w); },500); }

  /* ---------- 2. slim what's already stored (Keymaster) ---------- */
  var busy=false, stop=false;
  function listAll(prefix){ /* every object under prefix, recursing into folders */
    var out=[];
    function page(p,off){ return window.SB.storage.from(BUCKET).list(p,{limit:200,offset:off,sortBy:{column:'name',order:'asc'}}).then(function(r){
      var items=(r&&r.data)||[], folders=[];
      items.forEach(function(it){ if(it.id==null&&!(it.metadata&&it.metadata.size))folders.push(it.name); else out.push({path:(p?p+'/':'')+it.name,size:(it.metadata&&it.metadata.size)||0,type:(it.metadata&&it.metadata.mimetype)||''}); });
      var next=items.length===200?page(p,off+200):Promise.resolve();
      return next.then(function(){ return folders.reduce(function(pr,f){ return pr.then(function(){ return page((p?p+'/':'')+f,0); }); },Promise.resolve()); });
    }); }
    return page(prefix||'',0).then(function(){ return out; });
  }
  function slimStored(status){
    if(busy)return; busy=true; stop=false;
    var done=0, saved=0, skipped=0, failed=0;
    status('listing the bucket\u2026');
    listAll('').then(function(all){
      var big=all.filter(function(o){ return o.size>400*1024&&/^image\//.test(o.type)&&!/gif|heic|heif/.test(o.type); });
      var before=big.reduce(function(a,o){ return a+o.size; },0);
      status(big.length+' photos over 400 KB ('+Math.round(before/1048576)+' MB) \u2014 starting');
      return big.reduce(function(pr,o){ return pr.then(function(){ if(stop)return;
        return window.SB.storage.from(BUCKET).download(o.path).then(function(r){ if(r.error||!r.data)throw r.error||new Error('download');
          return shrink(r.data).then(function(small){
            if(!small||small.size>=o.size){ skipped++; return; }
            return window.SB.storage.from(BUCKET).upload(o.path,small,{contentType:'image/jpeg',cacheControl:'31536000',upsert:true}).then(function(u){ if(u.error)throw u.error; saved+=o.size-small.size; });
          });
        }).then(function(){ done++; },function(){ failed++; done++; }).then(function(){ status(done+'/'+big.length+' \u00B7 saved '+Math.round(saved/1048576)+' MB'+(failed?' \u00B7 '+failed+' failed':'')); });
      }); },Promise.resolve()).then(function(){ status((stop?'stopped at ':'done: ')+done+'/'+big.length+' \u00B7 saved '+Math.round(saved/1048576)+' MB \u00B7 '+skipped+' already fine'+(failed?' \u00B7 '+failed+' failed':'')); say('\uD83E\uDEB6 Photos slimmed \u2014 saved '+Math.round(saved/1048576)+' MB'); });
    }).catch(function(e){ status('\u2717 '+((e&&e.message)||'could not list the bucket')); }).then(function(){ busy=false; });
  }
  function box(){
    var size=document.getElementById('sizeBox'); if(!size||document.getElementById('slimBox'))return;
    var b=document.createElement('div'); b.className='albox'; b.id='slimBox';
    b.innerHTML='<h4>\uD83E\uDEB6 Slim the photos</h4><div class="als" style="margin-bottom:8px">New photos are shrunk automatically now. This shrinks the ones already in chat-media (same links, nothing else changes). Run once, on wifi.</div>'+
      '<button type="button" class="btn" id="slimGo" style="width:100%">SLIM THE PHOTOS</button><div class="als" id="slimSt" style="margin-top:6px"></div>';
    size.parentNode.insertBefore(b,size);
    b.querySelector('#slimGo').addEventListener('click',function(){ var st=b.querySelector('#slimSt'), btn=this;
      if(busy){ stop=true; btn.textContent='STOPPING\u2026'; return; }
      btn.textContent='STOP'; slimStored(function(m){ st.textContent=m; if(!busy)btn.textContent='SLIM THE PHOTOS'; }); });
  }
  var can=null, lastUid=null;
  function check(){ if(!window.SB||!window.__shkUid){ can=false; return; } window.SB.rpc('hand_count_can').then(function(r){ can=!r.error&&r.data===true; if(can)box(); else { var e=document.getElementById('slimBox'); e&&e.remove(); } },function(){}); }
  setInterval(function(){ var u=window.__shkUid||null; if(u!==lastUid){ lastUid=u; can=null; var e=document.getElementById('slimBox'); e&&e.remove(); if(u)setTimeout(check,1500); } },1000);
  new MutationObserver(function(){ if(can&&!document.getElementById('slimBox'))box(); }).observe(document.body,{childList:true,subtree:true});
})();
