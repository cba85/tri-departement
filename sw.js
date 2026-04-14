const CACHE_NAME = "tri-departemental-v2";
const APP_SHELL = ["/", "/index.html", "/style.min.css", "/scripts.min.js", "/favicon.png", "moon.svg", "sun.svg"];
const OPTIONAL_ASSETS = ["/communes.json"];

function getNavigationCandidates(pathname) {
  if (pathname === "/") {
    return ["/", "/index.html"];
  }

  const normalizedPath = pathname.endsWith("/") ? pathname : `${pathname}/`;

  return [pathname, normalizedPath, `${normalizedPath}index.html`, "/"];
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await cache.addAll(APP_SHELL);

      await Promise.allSettled(
        OPTIONAL_ASSETS.map(async (asset) => {
          const response = await fetch(asset, { cache: "no-cache" });

          if (response.ok) {
            await cache.put(asset, response);
          }
        }),
      );
    }),
  );

  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              return caches.delete(cacheName);
            }
          }),
        );
      })
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const responseClone = response.clone();

          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });

          return response;
        })
        .catch(async () => {
          const candidates = getNavigationCandidates(url.pathname);

          for (const candidate of candidates) {
            const cachedResponse = await caches.match(candidate);

            if (cachedResponse) {
              return cachedResponse;
            }
          }

          return Response.error();
        }),
    );

    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(request).then((response) => {
        if (!response || response.status !== 200 || response.type !== "basic") {
          return response;
        }

        const responseClone = response.clone();

        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, responseClone);
        });

        return response;
      });
    }),
  );
});
