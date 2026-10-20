/* room_fast.js — #roomfast (oct 19). The Dispatch Post room froze phones during live dispatch (3–19 s on older
   iPhones): every new mark or drop rebuilt the room's whole timeline — up to 240 rows — and, behind the room, the
   Hall feed's posts were rebuilt too even though nobody could see them. index.html now:
     1. hands each new timeline to window.dpListPatch(list, oldRows, newRows) — this file — which changes ONLY the
        rows that changed: new marks slide in at the top, the NOW tag moves, struck rows update, the oldest rows fall
        off the bottom. If the change doesn't look like that (a new tab, a big reshuffle), it says so and the room
        rebuilds the list the old way.
     2. skips the hidden Hall feed while the room is open (DP._feedLag), and this file repaints it once, the moment
        the room closes.
   Switch it off on a phone from the console: dpRoomFast=false (the room goes back to full rebuilds).
   Load once from index.html, after messy_hour.js:  <script src="room_fast.js?v=oct19a" defer></script> */
(function(){
  'use strict';
  if(window.__roomFast)return; window.__roomFast=true;
  var MAX_SHIFT=40, MAX_FIX=12;
  function nodes(html){ var t=document.createElement('div'); t.innerHTML=html; return t.firstElementChild; }
  window.dpListPatch=function(ls,oldRows,newRows){
    if(window.dpRoomFast===false)return false;
    if(!ls||!Array.isArray(oldRows)||!Array.isArray(newRows)||!oldRows.length||!newRows.length)return false;
    var tl=ls.firstElementChild; if(!tl||!tl.classList.contains('dp-tl'))return false;
    var kids=tl.children; if(kids.length!==oldRows.length)return false;            /* DOM and memory disagree: rebuild */
    var p=0, n=Math.min(oldRows.length,newRows.length);
    while(p<n&&oldRows[p]===newRows[p])p++;
    if(p===oldRows.length&&p===newRows.length)return true;                           /* nothing changed */
    /* find how many new rows were added at the top (offset o): new[o+i] lines up with old[p+i] */
    var best=-1, bestBad=1e9;
    for(var o=p;o<=Math.min(newRows.length,p+MAX_SHIFT);o++){
      var len=Math.min(newRows.length-o,oldRows.length-p), bad=0;
      for(var i=0;i<len&&bad<=MAX_FIX;i++)if(newRows[o+i]!==oldRows[p+i])bad++;
      if(bad<bestBad){ bestBad=bad; best=o; if(bad===0)break; }
    }
    if(best<0||bestBad>MAX_FIX)return false;
    var o2=best, len2=Math.min(newRows.length-o2,oldRows.length-p);
    var anchor=kids[p]||null, frag=document.createDocumentFragment(), add=newRows.slice(p,o2).join('');
    if(add){ var t=document.createElement('div'); t.innerHTML=add; if(t.children.length!==o2-p)return false; while(t.firstChild)frag.appendChild(t.firstChild); }
    /* fix the few aligned rows that changed (the NOW tag, a struck drop, "sending…" settling) */
    var fixes=[];
    for(var j=0;j<len2;j++)if(newRows[o2+j]!==oldRows[p+j]){ var nn=nodes(newRows[o2+j]); if(!nn)return false; fixes.push([kids[p+j],nn]); }
    var tail=[]; for(var q=p+len2;q<kids.length;q++)tail.push(kids[q]);                 /* old rows past the new end */
    var more=newRows.slice(o2+len2).join('');
    /* every check passed — now touch the DOM */
    if(frag.childNodes.length)tl.insertBefore(frag,anchor);
    fixes.forEach(function(f){ f[0].replaceWith(f[1]); });
    tail.forEach(function(x){ x.remove(); });
    if(more)tl.insertAdjacentHTML('beforeend',more);
    if(tl.children.length!==newRows.length)return false;                                /* belt and braces: rebuild */
    return true;
  };
  /* the Hall feed behind the room: repaint once when the room closes */
  var was=false;
  function watch(){
    var r=document.getElementById('dpRoom'); if(!r){ setTimeout(watch,1500); return; }
    was=r.classList.contains('on');
    new MutationObserver(function(){ var on=r.classList.contains('on'); if(was&&!on){ try{ if(window.DP&&window.DP._feedLag&&typeof window.dpRefresh==='function')window.dpRefresh(); }catch(e){} } was=on; }).observe(r,{attributes:true,attributeFilter:['class']});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',watch); else watch();
})();
