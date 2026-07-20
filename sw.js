/* Shadow Hook - service worker  (auto-updating)
   - Offline: caches the app shell so it opens with no signal (out at the ports).
   - Notifications: showNotification() while open/backgrounded, and real Web Push
     when the profile server sends them (the app already calls this).
   - AUTO-UPDATE: the app now refreshes itself. Every time a phone opens the app
     online, it pulls the latest index.html straight from the server (bypassing the
     phone's cache), so a new deploy reaches everyone on their next open - no more
     bumping a version by hand. The cache is only a fallback for when there's no signal.
   (You can still bump this number if you ever want to force a hard refresh.) */
const CACHE = 'shadowhook-v3';

const SHELL = [
  '.',
  'index.html',
  'manifest.webmanifest',
  'icon-192.png',
  'icon-512.png',
  'icon-maskable-512.png',
  'apple-touch-icon.png'
];

/* Install: pull FRESH copies of the shell (cache:'reload' skips the phone's old cache),
   then take over immediately. Missing files are skipped, never fatal. */
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

/* Activate: drop every old cache and take control of open pages right away. */
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* Lets the page ask the worker to activate instantly (used by the optional
   auto-refresh snippet). Harmless if the page never sends it. */
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // leave CDN scripts (Supabase, etc.) alone

  const isDoc = req.mode === 'navigate' ||
                (req.headers.get('accept') || '').includes('text/html');

  /* THE APP ITSELF - always fetch the newest copy from the server, bypassing the
     phone's HTTP cache. This is the line that makes updates actually reach people.
     If there's no signal, fall back to the last good cached copy. */
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

  /* ICONS / MANIFEST - serve instantly from cache, but quietly refresh the cached
     copy in the background so they stay current over time (stale-while-revalidate). */
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

/* ---- notifications (unchanged) ---- */
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
