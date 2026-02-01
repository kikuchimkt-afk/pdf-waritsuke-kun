const CACHE_NAME = 'pdf-layout-pwa-v1';
const localUrlsToCache = [
    './',
    './index.html',
    './style.css',
    './script.js',
    './manifest.json',
    './icons/icon-192.png',
    './icons/icon-512.png'
];

const externalUrlsToCache = [
    'https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js',
    'https://unpkg.com/lucide@latest',
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;800&display=swap'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(async cache => {
                console.log('Opened cache');
                // Cache local files significantly
                await cache.addAll(localUrlsToCache);

                // Try caching external, but don't fail install if they fail (e.g. offline/redirect)
                try {
                    await cache.addAll(externalUrlsToCache);
                } catch (err) {
                    console.warn('Failed to cache external assets:', err);
                }
            })
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                if (response) {
                    return response;
                }
                return fetch(event.request);
            })
    );
});

self.addEventListener('activate', event => {
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});
