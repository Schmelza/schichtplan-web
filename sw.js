const CACHE_NAME = "schichtplan-pwa-v1";
const ASSETS = [
  "/",
  "/index.html",
  "/favicon.ico",
  "/apple-touch-icon.png",
  "/manifest.webmanifest",
  "/pwa-192.png",
  "/pwa-512.png",
  "/pwa-192-maskable.png",
  "/pwa-512-maskable.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Never cache API/function routes (always network)
  if (
    url.pathname.startsWith("/counter") ||
    url.pathname.startsWith("/generate") ||
    url.pathname.startsWith("/ics") ||
    url.pathname.startsWith("/printv1") ||
    url.pathname.startsWith("/printv2") ||
    url.pathname.startsWith("/range")
  ) {
    return;
  }

  event.respondWith(caches.match(req).then((cached) => cached || fetch(req)));
});
