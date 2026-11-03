// Bump this when you change any app file so phones pick up the new version.
const CACHE = 'buddy-v11';
const SHELL = [
  './', 'index.html', 'manifest.json', 'css/app.css',
  'js/main.js', 'js/util.js', 'js/store.js', 'js/srs.js', 'js/stats.js', 'js/ai.js', 'js/speech.js', 'js/push.js', 'js/sync.js',
  'js/views/chat.js', 'js/views/home.js', 'js/views/review.js', 'js/views/roleplay.js', 'js/views/me.js', 'js/views/settings.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network first for the app's own files (so updates show up), cache when offline.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      })
      .catch(() => caches.match(req).then((r) => r || caches.match('index.html')))
  );
});

// The buddy's message sent by the Worker's cron. iOS requires every push to show a notification.
self.addEventListener('push', (e) => {
  let msg = {};
  try { msg = e.data ? e.data.json() : {}; } catch { msg = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(msg.title || 'Buddy', {
    body: msg.body || 'มีข้อความใหม่ 💬',
    icon: 'icons/icon-192.png',
    badge: 'icons/icon-192.png',
    tag: 'buddy',
    data: { url: './' },
  }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const win = wins.find((w) => new URL(w.url).pathname.startsWith(new URL(self.registration.scope).pathname));
    if (win) return win.focus();
    return self.clients.openWindow(self.registration.scope);
  })());
});
