// The deploy workflow (.github/workflows/pages.yml) replaces this value with the commit SHA on
// every push to main, so phones pick up each release. Opened locally, the value below is used as is.
const CACHE = 'buddy-v23';
// Thai web font from Google Fonts. Kept in its own cache so it survives app updates and works offline.
const FONT_CACHE = 'buddy-fonts-v1';
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];
const FONT_CSS = 'https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@400;500;700&display=swap';
const SHELL = [
  './', 'index.html', 'manifest.json', 'css/app.css',
  'js/main.js', 'js/util.js', 'js/store.js', 'js/srs.js', 'js/stats.js', 'js/ai.js', 'js/conversation.js', 'js/speech.js', 'js/push.js', 'js/sync.js',
  'js/engine/characters.js', 'js/engine/emotion.js', 'js/engine/roles.js', 'js/engine/memory.js', 'js/engine/scenarios.js', 'js/engine/response.js', 'js/engine/prompt.js', 'js/engine/modes.js', 'js/engine/checks.js',
  'js/views/avatar.js', 'js/views/characters.js', 'js/views/voice.js', 'js/views/progress.js', 'js/views/learn.js', 'js/views/ui.js', 'js/engine/ielts.js', 'js/engine/reading.js', 'js/engine/courses.js', 'js/engine/levels.js', 'js/engine/gates.js', 'js/views/levels.js', 'js/engine/daily.js', 'js/views/daily.js', 'js/engine/dashboard.js', 'js/views/dashboard.js', 'js/engine/tep.js', 'js/views/tep.js', 'js/engine/mywords.js', 'js/engine/highlights.js', 'js/views/mywords.js', 'js/engine/book.js', 'js/bookdb.js', 'js/views/book.js', 'js/engine/shadowing.js', 'js/engine/analytics.js', 'js/engine/plan.js', 'js/voice/tts.js', 'js/voice/stt.js', 'js/voice/recorder.js',
  'js/views/onboarding.js', 'js/views/chat.js', 'js/views/home.js', 'js/views/review.js', 'js/views/roleplay.js', 'js/views/me.js', 'js/views/settings.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  // `reload` skips the browser's HTTP cache so the offline copy is the new version, not a stale one.
  e.waitUntil(
    Promise.all([
      caches.open(CACHE).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' })))),
      precacheFonts(),
    ]).then(() => self.skipWaiting())
  );
});

// Saves the font stylesheet and the font files it lists, so the first offline visit already has them.
// Best effort: if the network or Google Fonts is unavailable, the app still installs.
async function precacheFonts() {
  try {
    const cache = await caches.open(FONT_CACHE);
    const res = await fetch(FONT_CSS);
    if (!res.ok) return;
    const css = await res.clone().text();
    await cache.put(FONT_CSS, res);
    const files = new Set(css.match(/https:\/\/fonts\.gstatic\.com\/[^)'"\s]+/g) || []);
    await Promise.all([...files].map((u) => fetch(u).then((r) => (r.ok ? cache.put(u, r) : null)).catch(() => {})));
  } catch { /* offline now; the fetch handler caches fonts on first use */ }
}

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== FONT_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network first for the app's own files (so updates show up), cache when offline.
// `no-cache` asks the server every time (a quick 304 when unchanged): GitHub Pages lets the
// browser keep files for 10 minutes, which could mix a new index.html with old scripts.
// Fonts: use the saved copy right away and refresh it in the background.
async function fontResponse(e) {
  const cache = await caches.open(FONT_CACHE);
  const hit = await cache.match(e.request, { ignoreVary: true });
  const fresh = fetch(e.request).then((res) => {
    // Stylesheets requested without CORS come back "opaque" (status 0); they are still usable.
    if (res.ok || res.type === 'opaque') cache.put(e.request, res.clone());
    return res;
  });
  if (hit) { e.waitUntil(fresh.catch(() => {})); return hit; }
  return fresh;
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (FONT_HOSTS.includes(url.hostname)) { e.respondWith(fontResponse(e)); return; }
  if (url.origin !== location.origin) return;
  e.respondWith(
    fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' })
      .then((res) => {
        const copy = res.clone();
        if (res.ok) caches.open(CACHE).then((c) => c.put(req, copy));
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
