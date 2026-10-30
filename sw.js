const CACHE_NAME = 'my-lingq-shell-v4';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './img/theme/ja-banner.webp',
  './img/theme/ja-washi.webp',
  './img/theme/en-banner.webp',
  './img/theme/en-sand.webp',
];
const SHELL_URLS = new Set(APP_SHELL.map(path => new URL(path, self.registration.scope).href));

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key.startsWith('my-lingq-shell-') && key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    // 온라인이면 최신 화면을 받아 캐시도 갱신 → 오프라인에서도 마지막으로 본 버전이 열림
    const shell = new URL('./index.html', self.registration.scope).href;
    event.respondWith(
      fetch(request).then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE_NAME).then(c => c.put(shell, copy)); }
        return res;
      }).catch(() => caches.match(shell))
    );
  } else if (SHELL_URLS.has(url.href)) {
    event.respondWith(caches.match(request).then(cached => cached || fetch(request)));
  }
});
