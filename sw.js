//
//  sw.js
//  Offline cache.
//
//  TWO THINGS THAT PULL IN OPPOSITE DIRECTIONS. A pool has no signal, so the app
//  has to open from the cache. But the page is published by pushing to git, so a
//  fix has to reach the swimmer's phone without them knowing anything happened.
//  A purely cache-first worker serves the old version forever and quietly makes
//  every fix invisible.
//
//  So: NETWORK FIRST FOR THE PAGE, cache first for everything else.
//
//  The page is the only file that ever changes — everything lives inside
//  index.html — so it is the only one worth asking about. It's asked with a
//  short deadline, because "no signal" and "bad signal" want the same answer and
//  only one of them fails quickly on its own. Whatever comes back is cached, so
//  the poolside copy is always the last one that loaded successfully.
//
//  The icons and the manifest never change without the page changing, so they
//  come from the cache and cost nothing.
//

const CACHE = 'ghost-v3';
const FILES = ['./', 'index.html', 'manifest.webmanifest',
               'icon-192.png', 'icon-512.png', 'icon-maskable-512.png'];

/** How long to wait for a fresh page before opening the cached one. Long enough
 *  for a slow connection, short enough that a dead one isn't a delay you'd
 *  notice standing on the tiles. */
const NETWORK_TIMEOUT = 3500;

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      // `reload` so a reinstall genuinely refetches rather than being handed the
      // browser's own HTTP cache — which is where a stale page hides.
      .then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/** Fetch, but give up in time to open the cached page instead. */
function fromNetwork(request, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    fetch(request).then((res) => { clearTimeout(timer); resolve(res); },
                        (err) => { clearTimeout(timer); reject(err); });
  });
}

function keep(request, response) {
  if (response && response.ok) {
    const copy = response.clone();
    caches.open(CACHE).then((c) => c.put(request, copy));
  }
  return response;
}

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;
  if (new URL(request.url).origin !== location.origin) return;

  // The page itself: ask, briefly, then fall back to what we have.
  if (request.mode === 'navigate') {
    e.respondWith(
      fromNetwork(request, NETWORK_TIMEOUT)
        .then((res) => keep(request, res))
        .catch(() => caches.match(request).then((hit) => hit || caches.match('index.html')))
    );
    return;
  }

  // Everything else: from the cache, and refreshed behind your back for next time.
  e.respondWith(
    caches.match(request).then((hit) => {
      const live = fetch(request).then((res) => keep(request, res)).catch(() => hit);
      return hit || live;
    })
  );
});
