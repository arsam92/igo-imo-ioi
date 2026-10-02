const CACHE = 'chaos-soccer-v1';
const CORE = ['./','./index.html','./game.js','./manifest.webmanifest','./icon.svg'];
const CDN = [
  'https://cdn.jsdelivr.net/npm/three@0.186.1/build/three.module.js',
  'https://cdn.jsdelivr.net/npm/@dimforge/rapier3d-compat@0.21.0/rapier.es.js'
];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(async c => { await c.addAll(CORE); for (const u of CDN) { try { await c.add(u); } catch (_) {} } self.skipWaiting(); })));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))));
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(r => { const copy=r.clone(); caches.open(CACHE).then(c=>c.put(e.request,copy)); return r; }).catch(()=>caches.match('./index.html'))));
});
