// App entry: hash router, nav badges, global error handling, startup tasks.
import { $, icon, toast } from './util.js';
import { settings, state, persist, on, load, STATE_VERSION } from './store.js';
import { startTimeTracking, dueCards } from './stats.js';
import { fetchInbox, syncPush } from './push.js';
import { startAutoSync } from './sync.js';
import { initChat, renderChat, renderHeader, maybeGreet } from './views/chat.js';
import { renderHome } from './views/home.js';
import { renderReview } from './views/review.js';
import { renderRoleplay } from './views/roleplay.js';
import { renderMe } from './views/me.js';
import { initSettings, fillSettings, applyTheme } from './views/settings.js';

// A bug in one view should not take the whole app down; tell the user and keep going.
let lastErr = 0;
function reportError(e) {
  console.error(e);
  if (Date.now() - lastErr < 4000) return;
  lastErr = Date.now();
  toast('มีบางอย่างผิดพลาด ลองใหม่อีกครั้ง หรือรีเฟรชแอป', true);
}
window.addEventListener('error', (e) => reportError(e.error || e.message));
window.addEventListener('unhandledrejection', (e) => reportError(e.reason));

const VIEWS = {
  home: { el: 'view-home', render: () => renderHome($('homeBody')), nav: 'home' },
  chat: { el: 'view-chat', render: () => { renderHeader(); renderChat(); markChatRead(); maybeGreet(); }, nav: 'chat' },
  review: { el: 'view-review', render: () => renderReview($('reviewBody')), nav: 'review' },
  roleplay: { el: 'view-roleplay', render: () => renderRoleplay($('roleBody')), nav: 'roleplay' },
  me: { el: 'view-me', render: () => renderMe($('meBody')), nav: 'me' },
  settings: { el: 'view-settings', render: () => fillSettings(), nav: 'me' },
};
let current = null;

function route() {
  const name = (location.hash || '#home').slice(1);
  const v = VIEWS[name] ? name : 'home';
  if (!VIEWS[name]) history.replaceState(null, '', '#home');
  for (const [k, def] of Object.entries(VIEWS)) $(def.el).hidden = k !== v;
  for (const a of document.querySelectorAll('.nav a')) {
    if (a.dataset.view === VIEWS[v].nav) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }
  current = v;
  try { VIEWS[v].render(); } catch (e) { reportError(e); }
  const sc = $(VIEWS[v].el).querySelector('.scroll');
  if (sc) sc.scrollTop = 0;
  updateBadges();
}

function markChatRead() { state.lastChatView = Date.now(); }
function updateBadges() {
  const due = dueCards().length;
  const unread = current === 'chat' ? 0 : state.messages.filter((m) => m.role === 'model' && m.t > (state.lastChatView || 0)).length;
  const set = (id, n) => { const d = $(id); d.hidden = !n; d.textContent = n > 99 ? '99+' : String(n); };
  set('dueDot', due);
  set('chatDot', unread);
}

// Re-render whatever is on screen when data changes (other tab, import, inbox).
on('state', () => {
  if (current === 'chat') { renderChat(); markChatRead(); }
  else if (current && current !== 'settings') VIEWS[current].render();
  updateBadges();
});
on('badges', updateBadges);
on('settings', () => { applyTheme(settings.theme); if (current && current !== 'settings' && current !== 'chat') VIEWS[current].render(); });

function boot() {
  // Data from an older version was upgraded in memory; write the new shape back once.
  if ((load('lb_state', null) || {}).v !== STATE_VERSION && state.messages.length + state.mistakes.length) persist();
  for (const n of document.querySelectorAll('[data-icon]')) n.prepend(icon(n.dataset.icon));
  applyTheme(settings.theme);
  initChat();
  initSettings();
  window.addEventListener('hashchange', route);
  route();
  startTimeTracking();
  fetchInbox();
  syncPush(false);
  startAutoSync();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      fetchInbox().then(() => { if (current === 'chat') maybeGreet(); });
      syncPush(false);
      updateBadges();
    } else {
      if (current === 'chat') state.lastSeen = state.messages.length ? Date.now() : state.lastSeen;
      persist();
    }
  });
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
}

boot();
