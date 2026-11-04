// Learning statistics, all measured on this device: active time, messages, how many checked
// messages needed a correction, reviews, and the daily streak.
import { state, persist } from './store.js';
import { dayKey } from './util.js';
import { status, isDue } from './srs.js';
import { tts } from './voice/tts.js';

const KEEP_DAYS = 730;   // per-day records are tiny; two years of history
const ACTIVE_WINDOW = 90 * 1000;   // counts as learning time if the user did something in the last 90 s
const TICK = 15 * 1000;

export function today() {
  const k = dayKey();
  const d = (state.days[k] ||= { msgs: 0, checked: 0, corrected: 0, secs: 0, reviews: 0, words: 0, voice: 0 });
  // Fields added later start at 0 on older days.
  for (const f of ['hints', 'hintFull', 'helper', 'shadow', 'shadowWords', 'shadowHeard', 'listen', 'listenOk']) d[f] ||= 0;
  return d;
}
function prune() {
  const keys = Object.keys(state.days).sort();
  for (const k of keys.slice(0, Math.max(0, keys.length - KEEP_DAYS))) delete state.days[k];
}

// A user message counts toward accuracy only if it is long enough to judge (3+ words).
export function recordMessage(text, corrected, voice) {
  const d = today();
  d.msgs += 1;
  if (voice) d.voice += 1;
  if (String(text || '').trim().split(/\s+/).length >= 3) {
    d.checked += 1;
    if (corrected) d.corrected += 1;
  }
  prune();
}
export function recordReview() { today().reviews += 1; }
// level: the highest hint step the learner opened before answering (4 = saw a full example).
export function recordHint(level) { const d = today(); d.hints += 1; if (level >= 4) d.hintFull += 1; }
export function recordHelper() { today().helper += 1; }
// Shadowing: one finished sentence. words/heard only when speech recognition was used.
export function recordShadow(words, heard) { const d = today(); d.shadow += 1; if (words) { d.shadowWords += words; d.shadowHeard += heard; } }
export function recordListen(ok) { const d = today(); d.listen += 1; if (ok) d.listenOk += 1; }
export function recordWord() { today().words += 1; }

let lastAction = Date.now();
let pendingSecs = 0;
export function startTimeTracking() {
  const mark = () => { lastAction = Date.now(); };
  for (const ev of ['pointerdown', 'keydown', 'touchstart', 'wheel']) window.addEventListener(ev, mark, { passive: true });
  setInterval(() => {
    const speaking = tts().speaking();
    if (document.visibilityState === 'visible' && (Date.now() - lastAction < ACTIVE_WINDOW || speaking)) {
      today().secs += TICK / 1000;
      pendingSecs += TICK / 1000;
      if (pendingSecs >= 60) { pendingSecs = 0; persist(); }
    }
  }, TICK);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && pendingSecs) { pendingSecs = 0; persist(); } });
}

const isActiveDay = (d) => d && (d.msgs > 0 || d.reviews > 0 || d.secs >= 120);

// Days in a row with learning, ending today (or yesterday, so the streak survives until tonight).
export function streak() {
  let n = 0;
  const d = new Date();
  if (!isActiveDay(state.days[dayKey(d)])) d.setDate(d.getDate() - 1);
  while (isActiveDay(state.days[dayKey(d)])) { n += 1; d.setDate(d.getDate() - 1); }
  return n;
}

export function lastDays(n = 7) {
  const out = [];
  const d = new Date();
  d.setDate(d.getDate() - (n - 1));
  for (let i = 0; i < n; i++) {
    const k = dayKey(d);
    out.push({ key: k, date: new Date(d), ...(state.days[k] || { msgs: 0, checked: 0, corrected: 0, secs: 0, reviews: 0, words: 0, voice: 0 }) });
    d.setDate(d.getDate() + 1);
  }
  return out;
}

export function totals() {
  let secs = 0, msgs = 0, checked = 0, corrected = 0, reviews = 0, voice = 0, hints = 0, hintFull = 0, helper = 0;
  let shadow = 0, shadowWords = 0, shadowHeard = 0, listen = 0, listenOk = 0;
  for (const d of Object.values(state.days)) {
    secs += d.secs || 0; msgs += d.msgs || 0; checked += d.checked || 0; corrected += d.corrected || 0; reviews += d.reviews || 0; voice += d.voice || 0;
    hints += d.hints || 0; hintFull += d.hintFull || 0; helper += d.helper || 0;
    shadow += d.shadow || 0; shadowWords += d.shadowWords || 0; shadowHeard += d.shadowHeard || 0; listen += d.listen || 0; listenOk += d.listenOk || 0;
  }
  return { secs, msgs, checked, corrected, reviews, voice, hints, hintFull, helper, shadow, shadowWords, shadowHeard, listen, listenOk };
}

// Share of checked messages with no correction; null when there is too little to say.
export function accuracy(days = 7) {
  let checked = 0, corrected = 0;
  for (const d of lastDays(days)) { checked += d.checked; corrected += d.corrected; }
  return checked >= 3 ? Math.round(((checked - corrected) / checked) * 100) : null;
}

export function vocabCounts() {
  const all = state.vocab.length;
  const mastered = state.vocab.filter((v) => status(v.srs) === 'mastered').length;
  const learning = state.vocab.filter((v) => status(v.srs) === 'learning').length;
  return { all, mastered, learning };
}

export function dueCards(now = Date.now()) {
  const m = state.mistakes.filter((x) => isDue(x.srs, now)).map((x) => ({ kind: 'mistake', item: x }));
  const v = state.vocab.filter((x) => isDue(x.srs, now)).map((x) => ({ kind: 'word', item: x }));
  // Oldest due first, mixing both kinds.
  return [...m, ...v].sort((a, b) => a.item.srs.due - b.item.srs.due);
}
