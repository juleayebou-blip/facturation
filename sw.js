// Service worker : permet d'utiliser l'application sans connexion.
// Stratégie : réseau d'abord (pour recevoir les mises à jour), cache en secours hors ligne.
const VERSION = 'facturation-v3';
const FILES = [
  './', 'index.html', 'styles.css', 'lib.js', 'app.js', 'manifest.webmanifest',
  'logo.png', 'icons/icon-192.png', 'icons/icon-512.png', 'data/seed.json'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then((r) => r || caches.match('index.html')))
  );
});
