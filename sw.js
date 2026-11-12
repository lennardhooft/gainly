// Offline-cache voor de app. Een nieuwe versie (andere VERSION) wordt op de achtergrond klaargezet,
// maar pas actief als de gebruiker in de app op "Bijwerken" tikt. Gegevens (localStorage) raakt dit nooit aan.
const VERSION = 'gainly-v62';
const SHELL = ['./', 'index.html', 'styles.css', 'gym.js', 'food.js', 'app.js', 'vendor/html5-qrcode.min.js', 'vendor/supabase.min.js', 'sync.js', 'exercises.json', 'nevo.json', 'manifest.webmanifest',
  'icons/gainly-192.png', 'icons/gainly-512.png', 'icons/gainly-180.png', 'icons/logo.webp'];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    await cache.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' })));
    // Allereerste installatie: meteen actief. Anders wachten op de gebruiker.
    if (!self.registration.active) self.skipWaiting();
  })());
});

self.addEventListener('message', (e) => {
  if (e.data === 'activate') self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== IMG_CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Cache eerst: de app blijft exact dezelfde versie tot je bijwerkt.
const IMG_CACHE = 'gainly-exercise-images'; // blijft bewaard over updates heen
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // Oefeningfoto's (free-exercise-db via jsDelivr): eenmaal geladen, daarna offline beschikbaar.
  if (e.request.method === 'GET' && url.hostname === 'cdn.jsdelivr.net' && url.pathname.includes('/free-exercise-db@')) {
    e.respondWith((async () => {
      const cache = await caches.open(IMG_CACHE);
      const hit = await cache.match(e.request);
      if (hit) return hit;
      const res = await fetch(e.request);
      if (res.ok || res.type === 'opaque') cache.put(e.request, res.clone());
      return res;
    })());
    return;
  }
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  // Tekeningen: pas laden als je ze bekijkt, daarna offline beschikbaar (ook na updates).
  if (url.pathname.includes('/drawings/')) {
    e.respondWith((async () => {
      const cache = await caches.open(IMG_CACHE);
      const hit = await cache.match(e.request);
      if (hit) return hit;
      const res = await fetch(e.request);
      if (res.ok) cache.put(e.request, res.clone());
      return res;
    })());
    return;
  }
  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const hit = await cache.match(e.request, { ignoreSearch: true });
    if (hit) return hit;
    try {
      return await fetch(e.request);
    } catch {
      return (await cache.match('index.html')) || Response.error();
    }
  })());
});
