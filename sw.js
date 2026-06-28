const CACHE_NAME = 'ledger-pro-v1';
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/css/theme.css',
    '/css/layout.css',
    '/css/form.css',
    '/css/modal.css',
    '/js/config.js',
    '/js/db.js',
    '/js/auth.js',
    '/js/engine.js'
];

// Install and Cache assets
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS_TO_CACHE))
    );
});

// Intercept network requests
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
