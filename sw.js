// Service worker : l'application s'ouvre sans connexion.
// Stratégie : le cache répond d'abord (ouverture instantanée, même sans réseau), puis il est rafraîchi en arrière-plan.
// Les mises à jour déposées sur GitHub sont donc prises en compte à l'ouverture suivante.
const VERSION = 'facturation-v8';
const CORE = ['./', 'index.html', 'styles.css', 'lib.js', 'app.js', 'manifest.webmanifest', 'seed.js', 'logo.png'];
const OPTIONAL = ['icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'pdf-lib.min.js', 'pdfgen.js'];

async function fillMissing() {
  const c = await caches.open(VERSION);
  await Promise.all(CORE.concat(OPTIONAL).map(async (u) => {
    try { if (await c.match(u)) return; const r = await fetch(u, { cache: 'reload' }); if (r.ok) await c.put(u, r); } catch (e) { /* hors ligne */ }
  }));
}

self.addEventListener('install', (e) => {
  // Les fichiers indispensables doivent tous être présents, sinon l'installation échoue et l'ancienne version reste active.
  e.waitUntil(caches.open(VERSION)
    .then((c) => c.addAll(CORE.map((u) => new Request(u, { cache: 'reload' }))))
    .then(() => fillMissing())
    .then(() => self.skipWaiting()));
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
  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    let hit = await cache.match(req, { ignoreSearch: true });
    if (!hit && req.mode === 'navigate') hit = (await cache.match('index.html')) || (await cache.match('./'));
    const net = fetch(req).then((res) => { if (res && res.ok) cache.put(req, res.clone()); return res; }).catch(() => null);
    if (hit) { e.waitUntil(net.then(() => fillMissing())); return hit; }
    const res = await net;
    return res || new Response("Hors connexion : ouvrez l'application une première fois avec internet.", { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  })());
});
