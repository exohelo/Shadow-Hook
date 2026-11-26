/* ═══ #pvideo(nov25) — A VIDEO FOR YOUR PICTURE OR YOUR BANNER · TAP A PICTURE, SEE THE PERSON ═══
   Loaded from ports_ext.js. Rides on the profile code in index.html (avatarCompose, bannerCompose,
   openDmCard, AVATARS, BANNERS …) without changing it.

   THE CLIP. Pick a video from the gallery where you'd pick a photo. You frame it the same way
   (drag · pinch), choose where it starts, and the phone cuts a 10-second, silent, looping clip
   (480×480 for the picture, 960×320 for the banner) — small enough for the wire whatever the phone
   shot. The first frame is saved as the still: avatar_url / banner_url keep working in every small
   slot on the app. The clip itself (avatar_video_url / banner_video_url) plays on the member card,
   in your own profile, and full screen. A phone that can't cut video uploads the clip as-is if it
   is short and under 24 MB.

   THE TAP. A profile picture anywhere on the app ([data-avuid]) opens that member's card. On the
   card, the picture or the banner opens full screen — a photo in the pinch-zoom lightbox, a video
   in the player with sound. Your own picture in the profile editor still opens the chooser.

   The database side: profiles.avatar_video_url / banner_video_url, avatar_board carries the
   picture clip, and a trigger drops the clip when a still replaces it (PROFILE-VIDEO, nov25). */
(function () {
  'use strict';
  if (window.__pvideo) return; window.__pvideo = true;

  var SEG = 10;                                   /* seconds in a clip */
  var RAW_MAX = 24 * 1024 * 1024;                 /* as-is fallback ceiling (bucket is 25 MB) */
  var SPEC = {
    av: { W: 480, H: 480, PW: 256, PH: 256, bps: 1400000, dir: 'avatars', col: 'avatar_video_url', still: 'avatar_url', title: 'YOUR PICTURE' },
    bn: { W: 960, H: 320, PW: 1200, PH: 400, bps: 2200000, dir: 'banners', col: 'banner_video_url', still: 'banner_url', title: 'YOUR BANNER' }
  };
  var VID = { av: {}, bn: {} };
  try { var c = JSON.parse(localStorage.getItem('shadowhook_pvideo') || '{}'); if (c && c.av) VID = { av: c.av || {}, bn: c.bn || {} }; } catch (e) {}
  function saveVID() { try { localStorage.setItem('shadowhook_pvideo', JSON.stringify(VID)); } catch (e) {} }
  window.PVIDEO = VID;

  function E(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function say(m) { try { toast(m); } catch (e) {} }
  function me() { return window.__shkUid || ''; }
  function still(kind, uid) {
    try { return kind === 'av' ? (typeof avatarOf === 'function' ? avatarOf(uid) : '') : (uid === me() && typeof myBanner === 'function' ? myBanner() : (typeof BANNERS !== 'undefined' ? BANNERS[uid] || '' : '')); } catch (e) { return ''; }
  }
  function clip(kind, uid) { var c = (uid && still(kind, uid)) ? (VID[kind][uid] || '') : ''; return (c && typeof DEAD !== 'undefined' && DEAD[c]) ? '' : c; }   /* no still → no clip (it was taken down) */
  var calm = false; try { calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  /* ── styles ── */
  var st = document.createElement('style');
  st.textContent =
    '.pv-host{position:relative;overflow:hidden}' +
    '.pv-fill{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;pointer-events:none;z-index:0;background:transparent}' +
    '.pv-host>span,.pv-host>.cv-edit,.pv-host>.cv-add{z-index:1}' +
    '.pv-av{width:100%;height:100%;object-fit:cover;display:block;border-radius:inherit;pointer-events:none}' +
    '#dmCardSheet .dmc-av,#dmCardSheet .dmc-cover.has{cursor:zoom-in}' +
    '#pvBox{position:fixed;inset:0;z-index:105;display:none;background:rgba(4,5,7,.97);align-items:center;justify-content:center}' +
    '#pvBox.on{display:flex}' +
    '#pvBox video{max-width:100%;max-height:100%;display:block}' +
    '#pvBox .pvx{position:absolute;top:calc(10px + env(safe-area-inset-top));left:14px;width:40px;height:40px;border-radius:50%;' +
    'background:rgba(0,0,0,.42);border:1px solid rgba(255,255,255,.16);color:#e8e3d8;font-size:19px;line-height:1;cursor:pointer;display:grid;place-items:center;padding:0;z-index:2}' +
    '.pv-bar{height:6px;border-radius:99px;background:rgba(255,255,255,.12);overflow:hidden;margin:10px 0 4px}' +
    '.pv-bar>i{display:block;height:100%;width:0;background:var(--copper-hi,#eeb46b);transition:width .2s}' +
    '.pv-row{display:flex;align-items:center;gap:10px;margin:2px 0 12px}' +
    '.pv-row input{flex:1}' +
    '.pv-row span{font:600 11px/1 Inter,system-ui,sans-serif;letter-spacing:.08em;color:rgba(232,227,216,.7);min-width:64px;text-align:right}';
  (document.head || document.documentElement).appendChild(st);

  /* ── a video element that plays quietly in a slot ── */
  function vidTag(url, poster, cls) {
    return '<video class="' + cls + '" src="' + E(url) + '"' + (poster ? ' poster="' + E(poster) + '"' : '') +
      (calm ? '' : ' autoplay') + ' muted loop playsinline webkit-playsinline preload="metadata" disablepictureinpicture></video>';
  }
  var DEAD = {};   /* clips that wouldn't play this visit — never put back, or the card would retry forever */
  function arm(v) {   /* muted for real (iOS reads the property), started, and gone if it won't play — the still shows */
    if (!v || v.__pv) return; v.__pv = 1;
    try { v.muted = true; v.defaultMuted = true; } catch (e) {}
    v.addEventListener('error', function () { DEAD[v.getAttribute('src')] = 1; try { v.remove(); } catch (e) {} });
    if (!calm) { var p = v.play(); if (p && p.catch) p.catch(function () {}); }
  }
  /* put the clip in a slot, or take a stale one out. mode 'fill' = behind a cover, 'av' = in place of the <img> */
  function dress(el, url, poster, mode) {
    if (!el) return;
    var cur = el.querySelector(':scope > video.pv-fill, :scope > video.pv-av');
    var img = mode === 'av' ? el.querySelector(':scope > img') : null;
    if (url && DEAD[url]) url = '';
    if (!url) { if (cur) cur.remove(); if (img && img.style.display) img.style.display = ''; return; }
    /* only touch what's wrong — every write here is a mutation the card's observer hears */
    if (mode !== 'av' && !el.classList.contains('pv-host')) el.classList.add('pv-host');
    if (img && img.style.display !== 'none') img.style.display = 'none';
    if (cur && cur.getAttribute('src') === url) return;
    if (cur) cur.remove();
    var tmp = document.createElement('div'); tmp.innerHTML = vidTag(url, poster, mode === 'av' ? 'pv-av' : 'pv-fill');
    var v = tmp.firstChild;
    if (img) v.addEventListener('error', function () { img.style.display = ''; });
    el.insertBefore(v, el.firstChild);
    arm(v);
  }

  /* ── your own profile: the seal, About-me picture, both banners ── */
  function paintMine() {
    var u = me(); if (!u) return;
    var a = clip('av', u), ap = still('av', u), b = clip('bn', u), bp = still('bn', u);
    dress(document.getElementById('pfSeal'), a, ap, 'av');
    dress(document.getElementById('abPic'), a, ap, 'av');
    dress(document.getElementById('pfCover'), b, bp, 'fill');
    dress(document.getElementById('abCover'), b, bp, 'fill');
  }
  /* ── the member card ── */
  function paintCard() {
    var sh = document.getElementById('dmCardSheet'); if (!sh || !sh.classList.contains('on')) return;
    var uid = window.__dmCardUid; if (!uid) return;
    var av = sh.querySelector('.dmc-av'); if (av) dress(av, clip('av', uid), still('av', uid), 'av');
    var cv = sh.querySelector('.dmc-cover'); if (cv) dress(cv, clip('bn', uid), still('bn', uid), 'fill');
  }
  var cardObs = null;
  function watchCard() {
    var sh = document.getElementById('dmCardSheet'); if (!sh || sh.__pv) return; sh.__pv = 1;
    cardObs = new MutationObserver(function () { paintCard(); });
    cardObs.observe(sh, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    /* on the card: picture or banner → full screen. Bubble phase on the sheet, so a pull-to-close
       (which eats its click in the capture phase) never also opens the viewer. */
    sh.addEventListener('click', function (e) {
      var uid = window.__dmCardUid; if (!uid) return;
      var t = e.target;
      if (t.closest && t.closest('.dmc-av')) { e.stopPropagation(); full('av', uid); return; }
      if (t.closest && t.closest('.dmc-cover')) { e.stopPropagation(); full('bn', uid); }
    });
    paintCard();
  }

  /* ── full screen ── */
  var box = null;
  function vbox() {
    if (box) return box;
    box = document.createElement('div'); box.id = 'pvBox'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true');
    box.innerHTML = '<button type="button" class="pvx" aria-label="Close">✕</button><video playsinline webkit-playsinline loop controls></video>';
    document.body.appendChild(box);
    box.querySelector('.pvx').addEventListener('click', function (e) { e.stopPropagation(); vclose(); });
    box.addEventListener('click', function (e) { if (e.target === box) vclose(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && box.classList.contains('on')) vclose(); });
    return box;
  }
  function vclose() { if (!box) return; var v = box.querySelector('video'); try { v.pause(); } catch (e) {} v.removeAttribute('src'); try { v.load(); } catch (e) {} box.classList.remove('on'); }
  window.pvClose = vclose; window.pvIsOpen = function () { return !!(box && box.classList.contains('on')); };
  function full(kind, uid) {
    var c = clip(kind, uid), s = still(kind, uid);
    if (c) {
      var b = vbox(), v = b.querySelector('video');
      v.muted = false; v.poster = s || ''; v.src = c; b.classList.add('on');
      var p = v.play(); if (p && p.catch) p.catch(function () { v.muted = true; v.play().catch(function () {}); });
      return;
    }
    if (s && typeof window.lbOpen === 'function') window.lbOpen(s, '');
  }
  window.pvFull = full;

  /* ── any profile picture on the app → that member's card ── */
  document.addEventListener('click', function (e) {
    var t = e.target; if (!t || !t.closest) return;
    var slot = t.closest('[data-avuid]'); if (!slot) return;
    var uid = slot.getAttribute('data-avuid'); if (!uid) return;
    if (slot.closest('#dmCardSheet,#profileSheet,#avPrevSheet,#avSheet,#bnSheet,#pvSheet,#lbox,#pvBox')) return;
    if (typeof window.openDmCard !== 'function') return;
    e.preventDefault(); e.stopPropagation();
    window.openDmCard(uid);
  }, true);

  /* ── reading the clips ── */
  async function loadBoard() {
    if (!window.SB) return;
    try {
      var r = await window.SB.from('avatar_board').select('id,avatar_video_url').not('avatar_video_url', 'is', null).limit(3000);
      if (r.error) return;
      var m = {}; (r.data || []).forEach(function (x) { if (x.avatar_video_url) m[x.id] = x.avatar_video_url; });
      VID.av = m; saveVID(); paintMine(); paintCard();
    } catch (e) {}
  }
  async function loadOne(uid) {
    if (!(window.SB && uid)) return;
    try {
      var r = await window.SB.from('profiles').select('avatar_video_url,banner_video_url').eq('id', uid).maybeSingle();
      if (r.error || !r.data) return;
      var ch = false;
      [['av', 'avatar_video_url'], ['bn', 'banner_video_url']].forEach(function (k) {
        var v = r.data[k[1]] || '';
        if ((VID[k[0]][uid] || '') !== v) { ch = true; if (v) VID[k[0]][uid] = v; else delete VID[k[0]][uid]; }
      });
      if (ch) saveVID();
      if (uid === me()) paintMine();
      if (uid === window.__dmCardUid) paintCard();
    } catch (e) {}
  }

  /* ── hooks into the page's own functions (all top-level, so the bare-name calls inside index.html see these) ── */
  function wrap(name, after) {
    var orig = window[name]; if (typeof orig !== 'function' || orig.__pv) return false;
    var w = function () { var r = orig.apply(this, arguments); try { after.apply(this, [r].concat([].slice.call(arguments))); } catch (e) {} return r; };
    w.__pv = 1; w.__orig = orig; window[name] = w; return true;
  }
  function hookAll() {
    wrap('profileSealPaint', function () { paintMine(); });
    wrap('bannerPaint', function () { paintMine(); });
    wrap('sbLoadAvatars', function (p) { Promise.resolve(p).then(function () { loadBoard(); if (me()) loadOne(me()); }); });
    wrap('openDmCard', function (p, uid) { watchCard(); paintCard(); loadOne(uid); Promise.resolve(p).then(function () { watchCard(); paintCard(); }); });
    /* the chooser sheets let a video through */
    wrap('bannerChooser', function () {
      var sh = document.getElementById('bnSheet'); if (!sh) return;
      var f = sh.querySelector('#bnFile'); if (f) f.accept = 'image/*,video/*';
      var b = sh.querySelector('#bnPick'); if (b) b.textContent = '🖼 PICK A PICTURE OR VIDEO';
      var p = sh.querySelector('p.sub'); if (p) p.textContent = 'A wide picture across the top of your card — the harbor, your rig, your crew. A video plays as a 10-second loop. Everyone who taps you sees it.';
    });
    wrap('avatarChooser', function () {
      var sh = document.getElementById('avSheet'); if (!sh) return;
      var g = sh.querySelector('#avPick'); if (g) g.textContent = '🖼 Photo or video from your gallery';
      var p = sh.querySelector('p.sub'); if (p) p.textContent = 'Shows beside your handle on the board, in the talk and in the rooms. A video plays as a 10-second loop on your card — the first frame shows everywhere else.';
      /* the page makes #avFile on first use with accept=image/*; make it ourselves, video allowed */
      if (!document.getElementById('avFile')) {
        var i = document.createElement('input'); i.type = 'file'; i.id = 'avFile'; i.hidden = true; i.accept = 'image/*,video/*';
        document.body.appendChild(i);
        i.addEventListener('change', function (e) { var f = e.target.files && e.target.files[0]; e.target.value = ''; if (f) window.avatarCompose(f); });
      } else { document.getElementById('avFile').accept = 'image/*,video/*'; }
    });
    /* a video goes to the clip maker; a photo goes the old way */
    ['avatarCompose', 'bannerCompose'].forEach(function (n) {
      var orig = window[n]; if (typeof orig !== 'function' || orig.__pv) return;
      var w = function (file) { if (isVideo(file)) return compose(n === 'avatarCompose' ? 'av' : 'bn', file); return orig.apply(this, arguments); };
      w.__pv = 1; w.__orig = orig; window[n] = w;
    });
    /* a still that replaces a clip, or a removal: the trigger clears the column; once the wire says
       so, we drop the clip's file and our copy */
    ['avatarUpload', 'avatarRemove', 'bannerRemove'].forEach(function (n) {
      var orig = window[n]; if (typeof orig !== 'function' || orig.__pv) return;
      var kind = n === 'bannerRemove' ? 'bn' : 'av';
      var w = async function () { var old = VID[kind][me()] || ''; var r = await orig.apply(this, arguments); if (old) settle(kind, old); return r; };
      w.__pv = 1; w.__orig = orig; window[n] = w;
    });
    paintMine();
    if (window.SB) { loadBoard(); if (me()) loadOne(me()); }
  }
  /* bannerCompose sets a still inside its own click handler (no function to wrap): notice the still
     changing under a clip we hold, and let the clip go */
  var lastBn = '';
  setInterval(function () {
    var u = me(); if (!u) return; var s = still('bn', u);
    if (lastBn && s !== lastBn && VID.bn[u] && !pending.bn) settle('bn', VID.bn[u]);
    lastBn = s;
  }, 1500);
  var pending = { av: false, bn: false };
  /* ask the wire what the clip is now; if it moved on from `old`, the old file goes */
  async function settle(kind, old) {
    var u = me(); if (!(u && old && window.SB)) return;
    try {
      var r = await window.SB.from('profiles').select(SPEC[kind].col).eq('id', u).maybeSingle();
      if (r.error || !r.data) return;
      var now = r.data[SPEC[kind].col] || '';
      if (now === old) return;
      if (now) VID[kind][u] = now; else delete VID[kind][u];
      saveVID(); dropFile(old, kind); paintMine();
    } catch (e) {}
  }

  function isVideo(f) { return !!f && (/^video\//i.test(f.type || '') || /\.(mp4|mov|m4v|webm|3gp)$/i.test(f.name || '')); }
  function dropFile(url, kind) {
    try { var k = String(url || '').match(/\/chat-media\/((?:avatars|banners)\/[^?#]+)/); if (k && window.SB) window.SB.storage.from('chat-media').remove([decodeURIComponent(k[1])]).catch(function () {}); } catch (e) {}
  }

  /* ── THE CLIP MAKER ── */
  function cropRect(w, h, W, H, v) {   /* same framing as the photo (wideFrom), for a video */
    var k = Math.max(W / w, H / h) * Math.max(1, v.z || 1), sw = W / k, sh = H / k;
    var sx = v.cx * w - sw / 2, sy = v.cy * h - sh / 2;
    sx = Math.max(0, Math.min(w - sw, sx)); sy = Math.max(0, Math.min(h - sh, sy));
    return [sx, sy, sw, sh];
  }
  function canRecord() {
    try { return typeof MediaRecorder === 'function' && typeof HTMLCanvasElement.prototype.captureStream === 'function'; } catch (e) { return false; }
  }
  function recType() {
    var c = ['video/mp4;codecs=avc1.42E01E', 'video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
    for (var i = 0; i < c.length; i++) { try { if (MediaRecorder.isTypeSupported(c[i])) return c[i]; } catch (e) {} }
    return '';
  }
  function fmt(t) { t = Math.max(0, Math.round(t)); return Math.floor(t / 60) + ':' + ('0' + (t % 60)).slice(-2); }
  function seek(v, t) { return new Promise(function (res) { var done = false, f = function () { if (done) return; done = true; v.removeEventListener('seeked', f); res(); }; v.addEventListener('seeked', f); try { v.currentTime = t; } catch (e) { f(); } setTimeout(f, 1500); }); }
  function blobOf(c, type, q) { return new Promise(function (res, rej) { try { c.toBlob(function (b) { b ? res(b) : rej(new Error('no blob')); }, type, q); } catch (e) { rej(e); } }); }

  async function compose(kind, file) {
    if (typeof guestWall === 'function' && guestWall()) return;
    if (!(window.SB && me())) { say('Sign in to set a video'); return; }
    var S = SPEC[kind];
    var url = URL.createObjectURL(file);
    var v = document.createElement('video');
    v.muted = true; v.defaultMuted = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.setAttribute('webkit-playsinline', ''); v.preload = 'auto'; v.src = url;
    try {
      await new Promise(function (res, rej) { v.onloadeddata = res; v.onerror = function () { rej(new Error('read')); }; setTimeout(function () { rej(new Error('slow')); }, 20000); });
    } catch (e) { URL.revokeObjectURL(url); say('Couldn’t read that video on this phone — try a different clip'); return; }
    var vw = v.videoWidth, vh = v.videoHeight;
    if (!(vw > 0 && vh > 0)) { URL.revokeObjectURL(url); say('Couldn’t read that video on this phone — try a different clip'); return; }
    var dur = isFinite(v.duration) && v.duration > 0 ? v.duration : SEG;
    var seg = Math.min(SEG, dur), maxStart = Math.max(0, dur - seg);
    var rec = canRecord() && !!recType();
    if (!rec && (file.size > RAW_MAX || dur > 30)) { URL.revokeObjectURL(url); say('This phone can’t trim video — pick a clip under 30 seconds and 24 MB'); return; }

    var V = { cx: .5, cy: .5, z: 1 }, start = 0, busy = false, alive = true;
    var dims = { get width() { return vw; }, get height() { return vh; } };
    var PW = kind === 'av' ? 256 : 600, PH = kind === 'av' ? 256 : 200;
    var sh = document.getElementById('pvSheet');
    if (!sh) { sh = document.createElement('div'); sh.className = 'sheet'; sh.id = 'pvSheet'; sh.style.zIndex = '94'; document.body.appendChild(sh); }
    var close = function () { alive = false; sh.classList.remove('on'); try { v.pause(); } catch (e) {} setTimeout(function () { try { URL.revokeObjectURL(url); } catch (e) {} }, 500); };
    sh.onclick = function (e) { if (e.target === sh && !busy) close(); };
    try { var bs = document.getElementById(kind === 'av' ? 'avSheet' : 'bnSheet'); if (bs) bs.classList.remove('on'); } catch (e) {}
    sh.innerHTML = '<div class="sheet-card" style="text-align:left">' +
      '<div class="big" style="font-size:20px;letter-spacing:.06em;text-align:center">' + S.title + '</div>' +
      '<p class="sub" style="margin:6px 0 12px;text-align:center">A ' + Math.round(seg) + '-second loop, no sound' + (rec ? '' : ' — this phone sends the clip as it is') + '.</p>' +
      (kind === 'av'
        ? '<div style="display:flex;justify-content:center;margin:2px 0 12px"><canvas id="pvC" width="' + PW + '" height="' + PH + '" style="touch-action:none;cursor:grab;width:168px;height:168px;border-radius:50%;border:2px solid rgba(238,180,107,.5);box-shadow:0 8px 24px rgba(0,0,0,.45);background:#0a0b0d"></canvas></div>'
        : '<canvas id="pvC" width="' + PW + '" height="' + PH + '" style="display:block;width:100%;aspect-ratio:3/1;border-radius:12px;margin:10px 0 10px;border:1px solid var(--line);touch-action:none;cursor:grab;background:#0a0b0d"></canvas>') +
      (rec ? '<div class="sub" style="text-align:center;margin:-2px 0 10px">Drag to move · pinch (or scroll) to zoom</div>' : '') +
      (maxStart > 0.2 ? '<div class="pv-row"><input type="range" id="pvStart" min="0" max="' + maxStart.toFixed(1) + '" step="0.1" value="0" aria-label="Where the clip starts"><span id="pvAt">starts 0:00</span></div>' : '') +
      '<div class="pv-bar" id="pvBar" style="display:none"><i></i></div>' +
      '<button class="btn" id="pvUse" type="button">✓ USE THIS VIDEO</button>' +
      '<button class="btn-ghost" id="pvNo" type="button" style="width:100%;margin-top:10px;border:0;color:#586067">Never mind</button></div>';
    sh.classList.add('on');
    var cv = sh.querySelector('#pvC'), g = cv.getContext('2d');
    var draw = function (ctx, W, H) { try { if (typeof clampView === 'function') clampView(dims, W, H, V); var r = cropRect(vw, vh, W, H, rec ? V : { cx: .5, cy: .5, z: 1 }); ctx.drawImage(v, r[0], r[1], r[2], r[3], 0, 0, W, H); } catch (e) {} };
    if (rec && typeof panZoom === 'function') panZoom(cv, dims, PW, PH, V, function () { draw(g, PW, PH); });
    /* the preview: the chosen 10 seconds, looping, drawn through the frame */
    var tick = function () { if (!alive) return; if (!busy) { if (v.currentTime >= start + seg - 0.05 || v.ended) { try { v.currentTime = start; } catch (e) {} if (v.paused) v.play().catch(function () {}); } draw(g, PW, PH); } requestAnimationFrame(tick); };
    await seek(v, 0); v.play().catch(function () {}); requestAnimationFrame(tick);
    var rs = sh.querySelector('#pvStart'), at = sh.querySelector('#pvAt');
    if (rs) rs.addEventListener('input', function () { start = +rs.value || 0; at.textContent = 'starts ' + fmt(start); try { v.currentTime = start; } catch (e) {} });
    sh.querySelector('#pvNo').addEventListener('click', function () { if (!busy) close(); });
    sh.querySelector('#pvUse').addEventListener('click', async function () {
      if (busy) return; busy = true;
      var btn = sh.querySelector('#pvUse'), bar = sh.querySelector('#pvBar'), fill = bar.firstChild;
      btn.disabled = true; sh.querySelector('#pvNo').disabled = true;
      pending[kind] = true;
      try {
        var poster, vblob, vtype;
        /* the still: the first frame of the clip, at the size the old picture/banner had */
        await seek(v, start);
        var pc = document.createElement('canvas'); pc.width = S.PW; pc.height = S.PH; var pg = pc.getContext('2d'); pg.imageSmoothingQuality = 'high';
        draw(pg, S.PW, S.PH);
        poster = await blobOf(pc, 'image/jpeg', .86);
        if (rec) {
          btn.textContent = 'MAKING YOUR CLIP…'; bar.style.display = '';
          var oc = document.createElement('canvas'); oc.width = S.W; oc.height = S.H; var og = oc.getContext('2d'); og.imageSmoothingQuality = 'high';
          draw(og, S.W, S.H);
          var type = recType(), stream = oc.captureStream(30), chunks = [];
          var mr = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: S.bps });
          mr.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
          var stopped = new Promise(function (res) { mr.onstop = res; });
          v.loop = false; mr.start(250); await v.play().catch(function () {});
          await new Promise(function (res) {
            var t0 = performance.now(), fin = false;
            var step = function () {
              if (fin) return;
              draw(og, S.W, S.H);
              var done = v.currentTime - start;
              fill.style.width = Math.min(100, done / seg * 100).toFixed(1) + '%';
              if (done >= seg || v.ended || performance.now() - t0 > (seg + 8) * 1000) { fin = true; return res(); }
              if (v.requestVideoFrameCallback) v.requestVideoFrameCallback(step); else requestAnimationFrame(step);
            };
            step();
          });
          try { v.pause(); } catch (e) {}
          mr.stop(); await stopped; try { stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}
          vtype = type.split(';')[0];
          vblob = new Blob(chunks, { type: vtype });
          if (!vblob.size) throw new Error('empty clip');
        } else {
          vblob = file; vtype = /quicktime|\.mov$/i.test(file.type + file.name) ? 'video/quicktime' : (/webm/i.test(file.type) ? 'video/webm' : 'video/mp4');
        }
        btn.textContent = 'SENDING…'; fill.style.width = '100%';
        var u = me(), stamp = Date.now().toString(36), ext = vtype === 'video/webm' ? 'webm' : vtype === 'video/quicktime' ? 'mov' : 'mp4';
        var pPath = S.dir + '/' + u + '-' + stamp + '.jpg', vPath = S.dir + '/' + u + '-' + stamp + '.' + ext;
        var up1 = await window.SB.storage.from('chat-media').upload(pPath, poster, { contentType: 'image/jpeg', upsert: false, cacheControl: '31536000' }); if (up1.error) throw up1.error;
        var up2 = await window.SB.storage.from('chat-media').upload(vPath, vblob, { contentType: vtype, upsert: false, cacheControl: '31536000' });
        if (up2.error) { window.SB.storage.from('chat-media').remove([pPath]).catch(function () {}); throw up2.error; }
        var pUrl = window.SB.storage.from('chat-media').getPublicUrl(pPath).data.publicUrl, vUrl = window.SB.storage.from('chat-media').getPublicUrl(vPath).data.publicUrl;
        var oldStill = still(kind, u), oldClip = VID[kind][u] || '';
        var row = {}; row[S.still] = pUrl; row[S.col] = vUrl;
        var r = await window.SB.from('profiles').update(row).eq('id', u).select('id');
        if (r.error) { window.SB.storage.from('chat-media').remove([pPath, vPath]).catch(function () {}); throw r.error; }
        VID[kind][u] = vUrl; saveVID();
        if (kind === 'av') { AVATARS[u] = pUrl; try { localStorage.setItem(K('avatar'), pUrl); } catch (e) {} }
        else { BANNERS[u] = pUrl; try { localStorage.setItem(K('banner'), pUrl); } catch (e) {} lastBn = pUrl; }
        if (oldStill && oldStill !== pUrl) dropFile(oldStill, kind);
        if (oldClip && oldClip !== vUrl) dropFile(oldClip, kind);
        try { if (kind === 'av') { paintAvatars(); renderSocialFeed(); } else bannerPaint(); } catch (e) {}
        paintMine();
        busy = false; close(); say(kind === 'av' ? '🎬 That’s you now — moving' : '🎬 Banner set — it plays on your card');
        try { goAboutYou(); } catch (e) {}
      } catch (e) {
        var m = String((e && (e.message || e.error)) || e || '');
        try { if (typeof shkAlert === 'function') shkAlert('pvideo:' + kind, m, ''); } catch (x) {}
        say(/video_url|column|42703|PGRST204|schema/i.test(m) ? 'Video pictures need the database update first' :
            /too large|413|exceeded|maximum size/i.test(m) ? 'That clip is too big for the wire — pick a shorter one' :
            /mime|content.?type|not supported/i.test(m) ? 'The wire won’t take that video type' :
            'Couldn’t set the video — ' + (m ? m.slice(0, 80) : 'try again'));
        busy = false; btn.disabled = false; btn.textContent = '✓ USE THIS VIDEO'; sh.querySelector('#pvNo').disabled = false; bar.style.display = 'none'; fill.style.width = '0';
        v.loop = true; v.play().catch(function () {});
      }
      pending[kind] = false;
    });
  }
  window.pvCompose = compose;

  /* the page's own script may still be loading when this runs */
  var tries = 0;
  (function boot() {
    if (typeof window.openDmCard === 'function' && typeof window.avatarCompose === 'function') { hookAll(); return; }
    if (++tries < 120) setTimeout(boot, 250);
  })();
})();
