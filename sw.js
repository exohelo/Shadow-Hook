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
const CACHE = 'shadowhook-v5';   // ← bump this each time you deploy an update

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

  // The app document: NETWORK-FIRST. Always try the server (cache:'reload' bypasses
  // the browser's HTTP cache) so the newest deploy wins; fall back to cache offline.
  if (isDoc) {
    e.respondWith(
      fetch(url.href, { cache: 'reload', credentials: 'same-origin' })
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('index.html', copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match('index.html').then((r) => r || caches.match('.')))
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
