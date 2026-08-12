/* Shadow Hook — service worker  (auto-updating)
   ────────────────────────────────────────────────────────────────────────────
   TO PUSH AN UPDATE, CHANGE ONE THING: the version number on the CACHE line just
   below (v4 → v5 → v6 …). Then re-upload the files you changed (index.html and,
   because you bumped it, this sw.js). That's the whole workflow.
   Why this makes old versions go away:
     • The app is served NETWORK-FIRST (see the fetch handler). Every time a phone
       opens the app online it pulls the latest index.html straight from the server,
       bypassing the phone's cache. The cache is only a fallback for no-signal.
     • index.html actively checks for a new sw.js on every open and every time the
       app is reopened from the home screen. When it finds this bumped version it
       activates it and refreshes once, so the member lands on the new build now.
     • Bumping the number below also wipes every old cache on activate, so nothing
       stale can survive.
   ──────────────────────────────────────────────────────────────────────────── */
const CACHE = 'shadowhook-v37';  // ← bump this each time you deploy an update  (v37: chat redesigned to a modern phone-messenger feel — grouped bubbles, avatars, day/night; emoji strip removed; GIF picker fixed; camera/gallery via a ＋ menu; rooms open on the newest message)

/* #swdupe(aug10) — '.' and 'index.html' ARE THE SAME 2.1 MB DOCUMENT.
   They both sat in the shell list, so every version bump pulled the whole app
   down TWICE on a member's phone — often on cell data, in a yard, on one bar.
   The document is fetched once below and filed under both keys from that single
   response; the offline fallback still checks both, exactly as before. */
const ASSETS = [
  'manifest.webmanifest',
  'icon-192.png',
  'icon-512.png',
  'icon-maskable-512.png',
  'apple-touch-icon.png'
];

/* Only a REAL app document is ever worth filing. See #swpoison in the fetch
   handler below for what happens when this check isn't made. */
const isGoodDoc = (res) => !!(res && res.ok && !res.redirected);

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => {
      const doc = fetch(new Request('index.html', { cache: 'reload' }))
        .then((res) => isGoodDoc(res)
          ? Promise.all([c.put('index.html', res.clone()), c.put('.', res.clone())])
          : null)
        .catch(() => null);
      const rest = Promise.all(ASSETS.map((u) =>
        fetch(new Request(u, { cache: 'reload' }))
          .then((res) => (res && res.ok) ? c.put(u, res) : null)
          .catch(() => null)
      ));
      return Promise.all([doc, rest]);
    })
    /* take over either way — network-first means the app still runs with an empty
       cache, and a worker stuck in "waiting" would strand the member on the old
       build until they killed the app. */
    .then(() => self.skipWaiting(), () => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
      .catch(() => self.clients.claim())
  );
});

self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
  // The app asks "which build are you?" so it can show the version in the account
  // panel. Answer with our cache name — the single source of truth for the build.
  if (e.data && e.data.type === 'VERSION' && e.ports && e.ports[0]) {
    e.ports[0].postMessage({ version: CACHE });
  }
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const isDoc = req.mode === 'navigate' ||
                (req.headers.get('accept') || '').includes('text/html');
  // The app document: NETWORK-FIRST. Always try the server (cache:'reload' bypasses
  // the browser's HTTP cache) so the newest deploy wins; fall back to cache offline.
  if (isDoc) {
    /* #swpages(aug12) — THE SHELL KEY ONLY EVER TAKES THE APP ITSELF.
       This SW scopes the whole origin, and every HTML navigation used to be
       filed under 'index.html' — so one visit to vendor.html / dockoffice.html /
       service.html / ambassador.html OVERWROTE the app's offline copy with that
       page. Next no-signal open, the "app" WAS the Dock Office gate, and only
       clearing site data brought the real one back. Now the app document keeps
       the shell keys and every other page is filed under its own URL; offline
       falls back to that page's own copy first, then to the app shell. */
    const isShell = url.pathname === '/' || /\/index\.html$/.test(url.pathname);
    const cacheKey = isShell ? 'index.html' : req;
    e.respondWith(
      fetch(url.href, { cache: 'reload', credentials: 'same-origin' })
        .then((res) => {
          /* #swpoison(aug10) — THE CACHE ONLY EVER TAKES A REAL PAGE.
             This used to file whatever came back, and Cache.put() does NOT reject
             a 404 or a 502 — verified, it stores them happily. So one hiccup at
             the host (a deploy mid-swap, a Cloudflare error page, a cold origin)
             on a single navigation overwrote the good copy with that error
             page. The member then lost signal, the fallback below handed them the
             cached copy, and they were looking at "502 Bad Gateway" AS the app —
             stuck there until they cleared site data. Only a real 200 gets filed. */
          if (isGoodDoc(res)) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(cacheKey, copy)).catch(() => {});
            return res;
          }
          /* Server answered, but not with the page. Prefer the last known-good
             copy over showing a member the host's error page. */
          return caches.match(cacheKey)
            .then((r) => r || (isShell ? null : caches.match('index.html')))
            .then((r) => r || res);
        })
        .catch(() => caches.match(cacheKey)
          .then((r) => r || caches.match('index.html'))
          .then((r) => r || caches.match('.')))
    );
    return;
  }
  // Everything else (icons, manifest): serve fast from cache, refresh in background.
  e.respondWith(
    caches.match(req).then((cached) => {
      const net = fetch(req).then((res) => {
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => cached);
      return cached || net;
    })
  );
});

self.addEventListener('push', (e) => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch (_) {
    try { data = { body: e.data.text() }; } catch (__) { data = {}; }
  }
  const title = data.title || 'Shadow Hook';
  const opts = {
    body: data.body || 'New activity on the wire.',
    icon: 'icon-192.png',
    badge: 'icon-192.png',
    tag: data.tag || 'shadowhook',
    vibrate: [120, 60, 120],
    data: { url: data.url || '.', room: data.room || null, go: data.go || null }
  };
  e.waitUntil(self.registration.showNotification(title, opts));
});

/* #alerts(aug10) — TAPPING AN ALERT HAS TO LAND SOMEWHERE.
   This used to focus whatever window it found and stop there, so a member tapped
   "NACLDOG replied in The Hall Floor" and got the app on whatever tab they left
   it on — with no idea where the reply was. data.url was only honoured when NO
   window existed, which is the rarer case. Now an already-open app is TOLD where
   to go before it is focused, and a cold start carries the destination in the
   URL hash so the app can read it on boot. */
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const d = e.notification.data || {};
  const hash = d.room ? ('#room=' + encodeURIComponent(d.room))
             : d.go   ? ('#go=' + encodeURIComponent(d.go))
             : '';
  const target = (d.url || '.') + hash;
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      /* #alerts2(aug12) — LAND ON THE APP, NOT JUST ANY WINDOW. The first window
         in the list can be vendor.html / dockoffice.html (same origin, same SW),
         which has no alertGo — the tap would focus the Dock Office and go
         nowhere. Prefer a window that is actually the app; only then settle. */
      const isApp = (c) => { try { const p = new URL(c.url).pathname; return p === '/' || /\/index\.html$/.test(p); } catch (_) { return false; } };
      const pick = list.find((c) => isApp(c) && 'focus' in c) || list.find((c) => 'focus' in c);
      if (pick) {
        try { pick.postMessage({ type: 'ALERT_TAP', room: d.room || null, go: d.go || null }); } catch (_) {}
        return pick.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    })
  );
});
