/* share-sw.js — #sharein(oct5) — A DISPATCH SUMMARY SHARED IN FROM THE PHONE.
   ────────────────────────────────────────────────────────────────────────────
   The manifest's share_target puts "Shadow Hook" in Android's share sheet for PDFs. A share
   arrives as a POST to /share-in/ — and a static host can't take a POST — so this small worker,
   registered by index.html for that one path only, catches it, tucks the PDF(s) into their own
   cache, and opens the app at /?share-in=N. The app reads them, puts them on the record (the
   Keymaster's key is needed to save them for everyone), and empties the cache.
   It lives apart from sw.js on purpose: its scope is /share-in/ and nothing else, so the app's
   own worker (caching, updates, alerts) is untouched and never needs editing for this.
   ──────────────────────────────────────────────────────────────────────────── */
const SHARE_CACHE = 'shadowhook-share';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'POST') return;            // only the share sheet's POST — anything else passes straight through
  e.respondWith((async () => {
    let n = 0;
    try {
      const fd = await req.formData();
      const files = fd.getAll('pdf').filter((f) => f && typeof f === 'object' && f.size > 0);
      const c = await caches.open(SHARE_CACHE);
      for (const f of files) {
        n++;
        await c.put(new Request('/__share-in/' + Date.now() + '-' + n), new Response(f, {
          headers: {
            'content-type': f.type || 'application/pdf',
            'x-file-name': encodeURIComponent(f.name || ('sheet-' + n + '.pdf'))
          }
        }));
      }
    } catch (_) {}
    return Response.redirect(new URL('../?share-in=' + n, self.registration.scope).href, 303);
  })());
});
