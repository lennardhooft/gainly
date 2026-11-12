// Offline-cache voor de app. Een nieuwe versie (andere VERSION) wordt op de achtergrond klaargezet,
// maar pas actief als de gebruiker in de app op "Bijwerken" tikt. Gegevens (localStorage) raakt dit nooit aan.
const VERSION = 'gainly-v14';
const SHELL = ['./', 'index.html', 'styles.css', 'app.js', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png', 'icons/logo.webp'];

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
    .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Cache eerst: de app blijft exact dezelfde versie tot je bijwerkt.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
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
