const CACHE_NAME = "cpp-professional-omr-v1";

const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./src/styles.css",
  "./src/app.js",
  "./src/modules/cpp-json.js",
  "./src/modules/file-input.js",
  "./src/modules/professional-omr-client.js",
  "./src/modules/feedback-engine.js",
  "./src/modules/measure-review.js",
  "./src/modules/chord-sheet-technical.js",
  "./src/modules/chord-sheet-playable.js",
  "./src/modules/confidence-engine.js",
  "./src/modules/export-output.js"
];

self.addEventListener("install", event => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.pathname.includes("/api/omr/") || url.pathname.endsWith("/health")) return;

  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request).catch(() => cached))
  );
});
