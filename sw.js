const CACHE_NAME = "schichtplan-pwa-v4";

self.addEventListener("install", (event) => {
  // We intentionally do not pre-cache to avoid stale UI/counter issues.
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Never touch your API/function routes (always network)
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

  // For HTML navigations: network-first (no caching)
  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request));
    return;
  }
});
