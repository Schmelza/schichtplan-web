const CACHE_NAME = "schichtplan-pwa-v3";

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // NIE APIs cachen
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

  // Für HTML immer NETZ zuerst
  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request));
    return;
  }
});
