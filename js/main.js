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
import { renderCharacters } from './views/characters.js';
import { renderVoice } from './views/voice.js';
import { renderProgress } from './views/progress.js';
import { renderLearn } from './views/learn.js';
import { renderLevels } from './views/levels.js';
import { renderDashboard } from './views/dashboard.js';
import { renderTep } from './views/tep.js';
import { renderMyWords } from './views/mywords.js';
import { renderBook } from './views/book.js';
import { initSettings, fillSettings, applyTheme } from './views/settings.js';
import { maybeOnboard } from './views/onboarding.js';

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
  roleplay: { el: 'view-roleplay', render: () => renderRoleplay($('roleBody')), nav: 'practice' },
  me: { el: 'view-me', render: () => renderMe($('meBody')), nav: 'me' },
  characters: { el: 'view-characters', render: () => renderCharacters($('charsBody')), nav: 'chat' },
  voice: { el: 'view-voice', render: () => renderVoice($('voiceBody')), nav: 'practice' },
  progress: { el: 'view-progress', render: () => renderProgress($('progressBody')), nav: 'me' },
  learn: { el: 'view-learn', render: () => renderLearn($('learnBody')), nav: 'practice' },
  levels: { el: 'view-levels', render: () => renderLevels($('levelsBody')), nav: 'me' },
  mywords: { el: 'view-mywords', render: () => renderMyWords($('mywordsBody')), nav: 'review' },
  tep: { el: 'view-tep', render: () => renderTep($('tepBody')), nav: 'practice' },
  book: { el: 'view-book', render: () => renderBook($('bookBody')), nav: 'practice' },
  dashboard: { el: 'view-dashboard', render: () => renderDashboard($('dashboardBody')), nav: 'me' },
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
  // The three practice pages share one menu button and a row of links at the top.
  for (const a of document.querySelectorAll('.ptabs a')) {
    if (a.dataset.p === v) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }
  current = v;
  try { VIEWS[v].render(); } catch (e) { reportError(e); }
  const sc = $(VIEWS[v].el).querySelector('.scroll');
  if (sc) sc.scrollTop = 0;
  // On a phone the row of practice links is wider than the screen: bring the open page's link into view.
  const tab = $(VIEWS[v].el).querySelector('.ptabs a[aria-current="page"]');
  if (tab) { const row = tab.parentElement; row.scrollLeft = Math.max(0, tab.offsetLeft - row.offsetLeft - (row.clientWidth - tab.offsetWidth) / 2); }
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

function showUpdateBar() {
  if (document.querySelector('.update-bar')) return;
  const bar = document.createElement('div');
  bar.className = 'update-bar';
  bar.setAttribute('role', 'status');
  bar.append('มีเวอร์ชันใหม่แล้ว');
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'btn sm primary';
  b.textContent = 'โหลดใหม่';
  b.addEventListener('click', () => location.reload());
  const x = document.createElement('button');
  x.type = 'button';
  x.className = 'icon-btn sm';
  x.setAttribute('aria-label', 'ปิด');
  x.textContent = '✕';
  x.addEventListener('click', () => bar.remove());
  bar.append(b, x);
  document.body.append(bar);
}

// Keyboard users can jump past the menu to the current page's heading.
function skipToContent() {
  const view = document.querySelector('.view:not([hidden])');
  const target = view?.querySelector('h1') || view;
  if (!target) return;
  target.setAttribute('tabindex', '-1');
  target.focus();
}

function boot() {
  $('skipLink').addEventListener('click', skipToContent);
  // Data from an older version was upgraded in memory; write the new shape back once.
  if ((load('lb_state', null) || {}).v !== STATE_VERSION && state.messages.length + state.mistakes.length) persist();
  for (const n of document.querySelectorAll('[data-icon]')) n.prepend(icon(n.dataset.icon));
  applyTheme(settings.theme);
  initChat();
  initSettings();
  window.addEventListener('hashchange', route);
  route();
  maybeOnboard();
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
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.register('sw.js').then((reg) => {
      // Look for a new version when the app comes back to the screen.
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
    }).catch(() => {});
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController) showUpdateBar(); });
  }
}

boot();
