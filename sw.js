const CACHE_NAME = 'pdf-layout-pwa-forced-v20260203';
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

// Install: Cache essential files
self.addEventListener('install', event => {
    self.skipWaiting(); // Force new service worker to become active
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(async cache => {
                console.log('Opened v2 cache');
                await cache.addAll(localUrlsToCache);
                try {
                    await cache.addAll(externalUrlsToCache);
                } catch (err) {
                    console.warn('Failed to cache external assets:', err);
                }
            })
    );
});

// Activate: Cleanup ALL old caches aggressively
self.addEventListener('activate', event => {
    event.waitUntil(
        Promise.all([
            self.clients.claim(),
            caches.keys().then(cacheNames => {
                return Promise.all(
                    cacheNames.map(cacheName => {
                        if (cacheName !== CACHE_NAME) {
                            console.log('Force deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
        ])
    );
});

// Fetch: Stale-While-Revalidate Strategy
self.addEventListener('fetch', event => {
    // We only care about GET requests for caching
    if (event.request.method !== 'GET') return;

    event.respondWith(
        caches.open(CACHE_NAME).then(cache => {
            return cache.match(event.request).then(response => {
                const fetchPromise = fetch(event.request).then(networkResponse => {
                    // Cache the new version if it's a valid response from our domain or external list
                    if (networkResponse && networkResponse.status === 200) {
                        cache.put(event.request, networkResponse.clone());
                    }
                    return networkResponse;
                }).catch(() => {
                    // Silently fail network update if offline
                });

                // Return cache if available, otherwise wait for network
                return response || fetchPromise;
            });
        })
    );
});
