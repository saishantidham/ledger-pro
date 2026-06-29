const CACHE_NAME = 'ledger-pro-v2';
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
    // Bulletproof caching: Load files individually so one missing file doesn't crash the whole PWA
    event.waitUntil(
        caches.open(CACHE_NAME).then(async cache => {
            for (let asset of ASSETS_TO_CACHE) {
                try { 
                    await cache.add(asset); 
                } catch (e) { 
                    console.warn('SW could not cache asset (might be missing):', asset); 
                }
            }
        })
    );
});

self.addEventListener('fetch', event => {
    // Skip Supabase API calls so we always get fresh database data
    if (event.request.url.includes('supabase.co')) return;

    // Cache-First strategy for local UI files
    event.respondWith(
        caches.match(event.request).then(response => {
            return response || fetch(event.request);
        })
    );
});
