importScripts('https://storage.googleapis.com/workbox-cdn/releases/6.4.1/workbox-sw.js');

if (workbox) {
    console.log(`Workbox is loaded`);

    // Cache Firebase Images
    workbox.routing.registerRoute(
        /^https:\/\/firebasestorage\.googleapis\.com\/.*/i,
        new workbox.strategies.CacheFirst({
            cacheName: 'firebase-images',
            plugins: [
                new workbox.expiration.ExpirationPlugin({
                    maxEntries: 500,
                    maxAgeSeconds: 60 * 60 * 24 * 60, // 60 days
                }),
                new workbox.cacheableResponse.CacheableResponsePlugin({
                    statuses: [0, 200],
                }),
            ],
        })
    );

    // Cache Unsplash Images
    workbox.routing.registerRoute(
        /^https:\/\/images\.unsplash\.com\/.*/i,
        new workbox.strategies.CacheFirst({
            cacheName: 'unsplash-images',
            plugins: [
                new workbox.expiration.ExpirationPlugin({
                    maxEntries: 100,
                    maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
                }),
                new workbox.cacheableResponse.CacheableResponsePlugin({
                    statuses: [0, 200],
                }),
            ],
        })
    );

    // Cache General Images (including Next.js optimized images)
    workbox.routing.registerRoute(
        ({ request }) => request.destination === 'image',
        new workbox.strategies.CacheFirst({
            cacheName: 'static-images',
            plugins: [
                new workbox.expiration.ExpirationPlugin({
                    maxEntries: 100,
                    maxAgeSeconds: 30 * 24 * 60 * 60,
                }),
            ],
        })
    );

} else {
    console.log(`Workbox didn't load`);
}

self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    self.clients.claim();
});
