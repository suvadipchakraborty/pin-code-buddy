// PIN Code Buddy — service worker
// Goal: make the app shell installable and let it open instantly (even
// offline), while PIN lookups themselves always go to the network first
// since post office data should stay fresh.

const CACHE_NAME = "pin-buddy-v2";
const APP_SHELL = [
  "/",
  "/index.html",
  "/css/styles.css",
  "/js/app.js",
  "/manifest.webmanifest",
  "/assets/icon-192.png",
  "/assets/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET") return;

  // PIN lookups: network-first, no caching of live postal data.
  if (url.hostname === "api.postalpincode.in") {
    event.respondWith(
      fetch(request).catch(() =>
        new Response(JSON.stringify([{ Status: "Error", Message: "Offline" }]), {
          headers: { "Content-Type": "application/json" },
        })
      )
    );
    return;
  }

  // Same-origin app shell: cache-first, falling back to network.
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request)
          .then((response) => {
            if (response.ok && request.url.startsWith("http")) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            }
            return response;
          })
          .catch(() => caches.match("/index.html"));
      })
    );
  }
});
