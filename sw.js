const CACHE_NAME = 'ledger-pro-v10'; 
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
    './js/engine.js',
    './js/export.js',
    'https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.3.0/exceljs.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.31/jspdf.plugin.autotable.min.js'
];

self.addEventListener('install', event => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then(async cache => {
            for (let asset of ASSETS_TO_CACHE) {
                try { 
                    const request = new Request(asset, { mode: asset.startsWith('http') ? 'cors' : 'no-cors' });
                    await cache.add(request); 
                } 
                catch (e) { console.warn('Cache skip:', asset); }
            }
        })
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cache => {
                    if (cache !== CACHE_NAME) return caches.delete(cache);
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
