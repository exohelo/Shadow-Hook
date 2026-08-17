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
const CACHE = 'shadowhook-v72';  // ← bump this each time you deploy an update  (v72: A TYPED HOUR FIGURE HAS TO BE WITHIN REACH OF THE RECORD. The hours sheet took any number between 0 and 20,000 and wrote it straight into the book — and the book drives the pay ladder, the Race AND the marks wall. A hand with 100 hours could type 8,000 and light nine hour-marks, Century Club through The Vault, in about ten seconds: 270 ⬡ out of a text field, and a lane near the top of the Race they had not worked for. This does NOT lock the typed figure — #hoursown is right that the posting is a snapshot of one day with a closed roster and the hand holding the stub can be right when the snapshot is not, so correcting the record has to stay possible. What stops being possible is inventing it. The ceiling is what the Order's own record says this card had, plus what they could physically have worked between the posting cutoff and the paid-through date they are claiming: ten hours a day, every day, no days off — seventy a week sustained for the whole stretch, which nobody does. Plus a flat 100-hour tolerance so a genuine discrepancy is never blocked by arithmetic, and the allowance is CAPPED at 1,000 so the guard does not quietly loosen itself every day the posting sits unrefreshed. Work done since the cutoff was never supposed to live in this figure anyway — sealed dockets add it on top by themselves. Checked against the whole posting: 0 of 5,510 hands have a posted figure above their own ceiling, so no honest hand is blocked. A card not on the posting has no figure to check against and is held to tolerance plus allowance; a real book bigger than that is a conversation with the Keymaster, not a text field, and the message says so.  ── v71: THE MARKS WALL STOPS PAYING TWICE. A mark paid PAY.MARK ⬡ off the in-memory flag while only the disk write was deduped against the stored list, so any moment the two came apart the mark paid again and wrote nothing — no trace on the device, and the badge key byte-identical before and after. Four routes reached that state with nobody touching a console: settle() rebuilt the flags from a MISSING, EMPTY or SHORTER server row and zeroed all 112 first; the cloud apply() writes String(v!=null?v:'') so a null row lands as an empty string; both boot restores JSON.parse that empty string, throw, and restore ZERO flags; and settle()'s badge branch is skipped while the card reads "anon" although apply() has already written the server's list to disk. settle() only repaints, so the wipe was silent and went off on the NEXT checkMarks() — a docket seal, an hours save, a strike, or the next open. That is the "I sealed one docket and got forty marks", up to 107 × PAY.MARK a go, repeatable. THREE CHANGES, all in index.html: unlockBadge now reads the STORED LIST, writes it, and only then pays — an unreadable or empty value heals the key from the wall and pays for nothing, because when a mark can't be proved unpaid the honest default is silence, not money; settle() unions instead of replacing, since a mark is monotonic and a sync may only ever ADD one, exactly the way the dockets branch beside it already merges; and both boot restores refuse to read an empty string as an empty list, the way reloadAcctBucks already did. And the root of it: the badges key was doing two jobs at once — it was the WALL (display state, syncs between a member's phones, replaceable by any of them) and it was also the PAYMENT RECORD, and conflating those is why a display problem could mint currency. They are two keys now. shadowhook_badges_<card> stays the wall and syncs as before. shadowhook_markspaid_<card> is the record of what this card has actually been paid for: device-local, excluded from the cloud mirror in mine() exactly like the credits key, and nothing else decides whether ⬡ moves. A nulled server row, a shorter list from a second phone, an empty string — none of them can reach it. It is seeded from the wall the first time a card runs this build, and again on every path that reassigns ACCT_ID, because K() repoints at a different card's keys and an absent payment record would otherwise read as "nothing paid" and buy the whole wall a second time. A card whose payment record reads as junk pays for NO mark for the rest of that session, not just the first one — the rebuild makes the key readable again, so guarding only the first mark left the other 89 of a re-derived wall paying out normally, a 2,640 ⬡ hole in the middle of the fix for a 3,210 ⬡ hole. The cost is one session where a genuinely new mark records without paying; the member earns it again tomorrow against a clean key, and a re-minted wall cannot be taken back. The payout reason now carries the mark's NAME — "new mark earned · Night Owl" — so the book can finally tell a legitimate catch-up from a repeat. NOT FIXED YET, say it plainly: the record of what has been paid still lives in localStorage, so clearing site data still mints. The wall is a marks_awarded row with a unique constraint and an apply_bucks that refuses a mark delta without it. No rule thresholds were touched — the loose ones are still loose.  ── v70: THEIR BOOK. The statement a member reads in THE BANK now opens on ANY hand's page in the Command Center — tap a roster row and the lines are right under their stack, newest first, each one saying which record it came from. Two records are merged: buck_ledger, written server-side, which carries the running balance after every move and marks a pack bought with real money; and bucks_book, written by the app from the phone once the bank confirms. A line that exists only in the book is labelled 'book only', because the phone wrote it and the phone can lie — that distinction is the whole point. Above the lines sits the reckoning: what the card says, what the lines add up to, and the gap. If those two numbers disagree, ⬡ moved without writing a line, and no explanation makes that innocent. Riding along: THE BOOKS, above the roster — nobody reads 132 statements by eye, so every hand whose book has something to answer for surfaces in one list, worst first, with the reason named. DRIFT (card and lines disagree) · CHAIN BREAK (a ledger row's running balance doesn't follow the one before it) · NO LINES (a stack above zero with nothing written down) · CHURN (sealing dockets and striking them straight back — the #fix2(bucks) hole being walked on) · BURST (credits piled inside sixty seconds) · HOT DAY · BIG CREDIT · BLANK REASON (apply_bucks called by hand) · CARRY. A paid pack never lights a flag, and a flagged hand carries a ⚠ on the roster line so the list and the page can't disagree. Read-only: nothing here moves ⬡. NEEDS ONE DEPLOY — run MEMBER-BOOK.sql in Supabase, or the Command Center says so out loud instead of showing an empty book. No push changes; the v66 handlers stand.)

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
    /* #swfast(aug12) — INSTANT OPENS, EVEN ON A BAD SIGNAL.
       This used to be pure network-first: every open WAITED for the whole ~2 MB app
       to come down the wire before it showed anything, and only fell back to the
       cached copy if the network outright FAILED. A slow-but-alive signal (one bar in
       a yard) isn't a failure — it just hangs, which is why the app "took forever".
       Now: we still ask the network first, so a good signal always lands the newest
       build; but if it hasn't answered within 2s we hand over the last good copy and
       let the fresh one finish downloading in the background for next time. No signal
       at all → the cached copy shows at once. A first-ever visit (nothing cached yet)
       still waits, because there's nothing else to show. The version-bump reload flow
       is untouched, so a real deploy still takes over the moment its worker installs. */
    e.respondWith((async () => {
      const cached = await caches.match(cacheKey);
      const network = fetch(url.href, { cache: 'reload', credentials: 'same-origin' })
        .then((res) => {
          /* #swpoison(aug10) — only a REAL 200 is ever filed. Cache.put() will happily
             store a 404 / 502 error page, and a poisoned cache once left members staring
             at "502 Bad Gateway" AS the app until they cleared site data. */
          if (isGoodDoc(res)) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(cacheKey, copy)).catch(() => {});
            return res;
          }
          /* server answered, but with an error page — prefer the last known-good copy */
          return caches.match(cacheKey)
            .then((r) => r || (isShell ? null : caches.match('index.html')))
            .then((r) => r || res);
        })
        .catch(() => cached || caches.match('index.html').then((r) => r || caches.match('.')));
      if (!cached) return network;                       // first-ever visit: nothing to fall back to
      const softTimeout = new Promise((resolve) => setTimeout(() => resolve(cached), 2000));
      return Promise.race([network, softTimeout]);       // fresh if the signal is quick, cache if it's slow
    })());
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
