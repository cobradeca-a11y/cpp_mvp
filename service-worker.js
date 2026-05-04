const APP_BUILD = "audit-50-cache-v5";
const CACHE_NAME = `cpp-professional-omr-${APP_BUILD}`;

const ASSETS = [
  "./",
  "./index.html?v=audit-50-cache-v5",
  "./manifest.json?v=audit-50-cache-v5",
  "./src/styles.css?v=audit-50-cache-v5",
  "./src/app-audit50.js?v=audit-50-cache-v5",
  "./src/modules/cpp-json.js?v=audit-50-cache-v5",
  "./src/modules/file-input.js?v=audit-50-cache-v5",
  "./src/modules/professional-omr-client.js?v=audit-50-cache-v5",
  "./src/modules/feedback-engine.js?v=audit-50-cache-v5",
  "./src/modules/measure-review.js?v=audit-50-cache-v5",
  "./src/modules/chord-sheet-technical.js?v=audit-50-cache-v5",
  "./src/modules/chord-sheet-playable.js?v=audit-50-cache-v5",
  "./src/modules/confidence-engine.js?v=audit-50-cache-v5",
  "./src/modules/navigation-engine.js?v=audit-50-cache-v5",
  "./src/modules/export-output.js?v=audit-50-cache-v5",
  "./src/modules/multipage-audit-export.js?v=audit-50-cache-v5",
  "./src/modules/error-reporting.js?v=audit-50-cache-v5",
  "./src/modules/audit50-ocr-warning-panel.js?v=audit-50-cache-v5"
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

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request, { cache: "no-store" });
    if (response && response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    throw error;
  }
}

async function clearCppCaches() {
  const keys = await caches.keys();
  await Promise.all(keys.filter(key => key.startsWith("cpp-professional-omr-")).map(key => caches.delete(key)));
}

self.addEventListener("message", event => {
  if (event.data?.type === "CPP_CLEAR_CACHE_AND_RELOAD") {
    event.waitUntil(
      clearCppCaches().then(() => self.clients.matchAll({ type: "window" })).then(clients => {
        clients.forEach(client => client.postMessage({ type: "CPP_CACHE_CLEARED", build: APP_BUILD }));
      })
    );
  }

  if (event.data?.type === "CPP_GET_BUILD") {
    event.source?.postMessage({ type: "CPP_BUILD", build: APP_BUILD, cache: CACHE_NAME });
  }
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.pathname.includes("/api/omr/") || url.pathname.endsWith("/health")) return;

  const destination = event.request.destination;
  const isFrontendAsset = ["document", "script", "style", "manifest"].includes(destination)
    || url.pathname.endsWith(".js")
    || url.pathname.endsWith(".css")
    || url.pathname.endsWith(".html")
    || url.pathname.endsWith("/manifest.json")
    || url.pathname === "/";

  if (isFrontendAsset) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then(cached => cached || fetch(event.request).catch(() => cached))
  );
});
