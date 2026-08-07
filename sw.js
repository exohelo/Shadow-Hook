/* Shadow Hook — service worker  (auto-updating)
   ────────────────────────────────────────────────────────────────────────────
   TO PUSH AN UPDATE, CHANGE ONE THING: the version number on the CACHE line just
   below (v4 → v5 → v6 …). Then re-upload the files you changed (index.html and,
   because you bumped it, this sw.js). That's the whole workflow — and the bump
   is REQUIRED now (see #fastboot), it's what carries an update to the phones.

   #fastboot(aug7) — the app opens INSTANTLY from cache now.
     • The old fetch was NETWORK-FIRST: every open re-downloaded the whole app
       (~640 KB on the wire) before anything painted — 3-5 s on hall LTE.
     • Now the app paints straight from the phone's cache and the fresh copy
       downloads quietly BEHIND it (cache-first + background refresh).
   Why updates still go away like before:
     • index.html checks for a new sw.js on every open (reg.update()). Your bump
       lands the new worker, its install step re-downloads the shell fresh, and
       the page refreshes once — the member is on the new build seconds later.
     • Bumping the number below also wipes every old cache on activate, so
       nothing stale can survive a deploy.
   ──────────────────────────────────────────────────────────────────────────── */
const CACHE = 'shadowhook-v35';   // ← bump this each time you deploy an update (v35: #fastboot — instant open from cache, fresh copy loads behind)

const SHELL = [
  '.',
  'index.html',
  'manifest.webmanifest',
  'icon-192.png',
  'icon-512.png',
  'icon-maskable-512.png',
  'apple-touch-icon.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) =>
      Promise.all(SHELL.map((u) =>
        fetch(new Request(u, { cache: 'reload' }))
          .then((res) => (res && res.ok) ? c.put(u, res) : null)
          .catch(() => null)
      ))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
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

  // The app document: CACHE-FIRST + background refresh (#fastboot aug7).
  // The cached build paints NOW; the fresh copy downloads behind it and lands in
  // the cache for the next open. A deploy still reaches every phone the same day
  // because the sw.js version bump (reg.update() runs on every open) installs the
  // new worker, re-caches the shell fresh, and refreshes the page once.
  if (isDoc) {
    const fresh = fetch(url.href, { cache: 'reload', credentials: 'same-origin' })
      .then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('index.html', copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => null);
    e.respondWith(
      caches.match('index.html')
        .then((r) => r || caches.match('.'))
        .then((cached) => cached || fresh.then((res) => res || caches.match('index.html')))
    );
    e.waitUntil(fresh);
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
    data: { url: data.url || '.' }
  };
  e.waitUntil(self.registration.showNotification(title, opts));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const target = (e.notification.data && e.notification.data.url) || '.';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) { if ('focus' in c) return c.focus(); }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    })
  );
});
