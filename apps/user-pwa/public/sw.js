const SHELL_CACHE = 'medico-shell-v1';
const DATA_CACHE = 'medico-public-data-v1';
const SHELL_URLS = ['/', '/manifest.json', '/icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) => key !== SHELL_CACHE && key !== DATA_CACHE,
            )
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

function isPublicApiRequest(url, request) {
  if (
    request.method !== 'GET' ||
    request.credentials === 'include' ||
    request.headers.has('authorization') ||
    request.headers.has('x-staff-pin') ||
    request.headers.has('x-staff-password')
  ) return false;
  return (
    url.pathname === '/api/hospitals' ||
    /^\/api\/hospitals\/[0-9a-f-]+$/i.test(url.pathname) ||
    url.pathname === '/api/doctors'
  );
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (isPublicApiRequest(url, request)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(DATA_CACHE);
        const cached = await cache.match(request);
        const update = fetch(request).then((response) => {
          if (response.ok) void cache.put(request, response.clone());
          return response;
        });
        if (cached) {
          event.waitUntil(update.catch(() => undefined));
          return cached;
        }
        try {
          return await update;
        } catch {
          return new Response(
            JSON.stringify({
              success: false,
              error: 'Offline and no saved hospital data is available.',
            }),
            {
              status: 503,
              headers: { 'Content-Type': 'application/json' },
            },
          );
        }
      })(),
    );
    return;
  }

  if (url.origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(SHELL_CACHE);
        return (await cache.match('/')) ?? Response.error();
      }),
    );
    return;
  }
  if (
    request.method === 'GET' &&
    ['script', 'style', 'image', 'font'].includes(request.destination)
  ) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              void caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
  }
});
