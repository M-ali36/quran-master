// public/sw.js
const STATIC_CACHE = "quran-static-v2";
const AUDIO_CACHE = "quran_audio_offline_v1";
const VIDEO_CACHE = "quran_videos_cache_v1";

const PRECACHE_ASSETS = [
  "/",
  "/manifest.webmanifest",
  "/favicon.ico",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png"
];

// Precache shell on install
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_ASSETS))
  );
  self.skipWaiting();
});

// Clean up stale caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (![STATIC_CACHE, AUDIO_CACHE, VIDEO_CACHE].includes(key)) {
            return caches.delete(key);
          }
        })
      )
    )
  );
  self.clients.claim();
});

// Intercept requests
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. Audio and Proxy Video (Cache First, fallback to network)
  if (
    url.pathname.endsWith(".mp3") ||
    url.pathname.startsWith("/api/video") ||
    url.hostname.includes("mp3quran.net")
  ) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;

        return fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const clone = networkResponse.clone();
              const targetCache = url.pathname.endsWith(".mp3")
                ? AUDIO_CACHE
                : VIDEO_CACHE;
              caches.open(targetCache).then((c) => c.put(request, clone));
            }
            return networkResponse;
          })
          .catch(() => new Response("", { status: 408 }));
      })
    );
    return;
  }

  // 2. Dynamic JSON data (surahs, verses, reciters) -> Stale While Revalidate
  if (url.pathname.endsWith(".json") || url.pathname.includes("/data/")) {
    event.respondWith(
      caches.open(STATIC_CACHE).then((cache) =>
        cache.match(request).then((cached) => {
          const fetchPromise = fetch(request)
            .then((networkResponse) => {
              if (networkResponse && networkResponse.status === 200) {
                cache.put(request, networkResponse.clone());
              }
              return networkResponse;
            })
            .catch(() => cached);
          return cached || fetchPromise;
        })
      )
    );
    return;
  }

  // 3. Navigation (HTML Pages) -> Network first, fallback to cached root
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(request).then((cached) => cached || caches.match("/"))
      )
    );
    return;
  }

  // 4. Next.js Static bundles and chunks (_next/static)
  if (url.pathname.startsWith("/_next/static")) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(STATIC_CACHE).then((c) => c.put(request, clone));
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // 5. Default fallback
  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request))
  );
});