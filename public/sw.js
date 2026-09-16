// Rafeeq service worker — keeps the app usable on weak connectivity near stations.
// App shell: network-first with cache fallback. Static assets & fonts: cache-first.
const VERSION = 'rafeeq-v1';
const SCOPE_PATH = new URL(self.registration ? self.registration.scope : self.location.href).pathname.replace(/\/+$/, '') + '/';
const INDEX_HTML = `${SCOPE_PATH}index.html`;
const SHELL = [
  SCOPE_PATH,
  INDEX_HTML,
  `${SCOPE_PATH}manifest.webmanifest`,
  `${SCOPE_PATH}favicon.svg`,
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(INDEX_HTML, copy));
          return res;
        })
        .catch(() => caches.match(INDEX_HTML).then((res) => res || caches.match(SCOPE_PATH))),
    );
    return;
  }

  const cacheable =
    (url.origin === self.location.origin &&
      (url.pathname.startsWith(`${SCOPE_PATH}assets/`) || url.pathname.startsWith('/assets/'))) ||
    url.hostname === 'fonts.googleapis.com' ||
    url.hostname === 'fonts.gstatic.com';

  if (cacheable) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((res) => {
            if (res.ok || res.type === 'opaque') {
              const copy = res.clone();
              caches.open(VERSION).then((c) => c.put(request, copy));
            }
            return res;
          }),
      ),
    );
  }
});
