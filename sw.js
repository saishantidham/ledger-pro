const CACHE_NAME = 'ledger-pro-v3'; // Bumped version to force cache clear
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './css/theme.css',
    './css/layout.css',
    './css/form.css',
    './css/modal.css',
    './js/config.js',
    './js/db.js',
    './js/auth.js',
    './js/engine.js'
];

self.addEventListener('install', event => {
    self.skipWaiting(); // Force the waiting service worker to become the active service worker.
    event.waitUntil(
        caches.open(CACHE_NAME).then(async cache => {
            for (let asset of ASSETS_TO_CACHE) {
                try { await cache.add(asset); } 
                catch (e) { console.warn('Cache skip:', asset); }
            }
        })
    );
});

// THIS DESTROYS THE OLD BROKEN CACHE
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cache => {
                    if (cache !== CACHE_NAME) {
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
    return self.clients.claim();
});

self.addEventListener('fetch', event => {
    if (event.request.url.includes('supabase.co')) return;
    event.respondWith(
        caches.match(event.request).then(response => {
            return response || fetch(event.request);
        })
    );
});
