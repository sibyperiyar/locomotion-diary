// Import the shared version file
importScripts('./js/version.js');

// Use the version from version.js (APP_VERSION)
const CACHE_NAME = 'locomotion-diary-v' + (typeof APP_VERSION !== 'undefined' ? APP_VERSION : '1.0.0');

const ASSETS = [
    './',
    './index.html',
    './css/style.css',
    './css/stats.css',
    './js/app.js',
    './js/parser.js',
    './js/db.js',
    './js/stats.js',
    './js/version.js',
    './js/weather.js',
    './js/manual-entry.js',
    './js/map.js',
    './js/locales.js',
    './js/photos.js',
    './js/ai.js',
    './USER_MANUAL.html',
    './manifest.json',
    './icon.png',
    'https://cdn.jsdelivr.net/npm/chart.js',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
];

self.addEventListener('install', (e) => {
    self.skipWaiting(); // Activate immediately
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((keyList) => {
            return Promise.all(keyList.map((key) => {
                if (key !== CACHE_NAME) {
                    return caches.delete(key);
                }
            }));
        })
    );
    self.clients.claim();
});

// Network-First Strategy
self.addEventListener('fetch', (e) => {
    e.respondWith(
        fetch(e.request)
            .then((response) => {
                // Check if we received a valid response
                if (!response || response.status !== 200 || response.type !== 'basic') {
                    return response;
                }

                // Clone the response
                const responseToCache = response.clone();

                caches.open(CACHE_NAME)
                    .then((cache) => {
                        cache.put(e.request, responseToCache);
                    });

                return response;
            })
            .catch(() => {
                return caches.match(e.request);
            })
    );
});
