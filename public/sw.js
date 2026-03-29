const CACHE_NAME = "wildatlas-v2";
const PRECACHE_URLS = ["/", "/index.html"];

const isBuildAssetRequest = (url) =>
  url.pathname.startsWith("/assets/") ||
  url.pathname.startsWith("/@vite") ||
  url.pathname.startsWith("/node_modules/.vite/") ||
  /\.(?:js|mjs|css|map)$/i.test(url.pathname);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and chrome-extension requests
  if (request.method !== "GET" || !request.url.startsWith("http")) return;

  // Network-first for API/supabase calls
  if (
    request.url.includes("/rest/") ||
    request.url.includes("/functions/") ||
    request.url.includes("supabase")
  ) {
    return;
  }

  // Avoid caching Vite/dev/build JS and CSS bundles — stale cached chunks can
  // break the app after deploys and hot reloads.
  if (url.origin !== self.location.origin || isBuildAssetRequest(url)) {
    return;
  }

  // Network-first for navigations so new deployments don't get stuck on an old
  // cached app shell that references deleted chunk files.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then(async (response) => {
          if (response.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, response.clone());
          }
          return response;
        })
        .catch(async () => {
          const cache = await caches.open(CACHE_NAME);
          return (await cache.match(request)) || (await cache.match("/index.html"));
        })
    );
    return;
  }

  // Stale-while-revalidate for app shell & assets
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(request);
      const fetchPromise = fetch(request)
        .then((response) => {
          if (response.ok) {
            cache.put(request, response.clone());
          }
          return response;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
