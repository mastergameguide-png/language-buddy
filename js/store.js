// App data: settings, learner state, and helpers that read them. Everything lives in
// localStorage on this device; `save` reports failures instead of hiding them.
import { uid, clampStr, toast } from './util.js';
import { newCard } from './srs.js';
import { getCharacter, CHARACTER_IDS, EMOTIONS, ROLES } from './engine/characters.js';
import { freshSession } from './engine/roles.js';
import { expire } from './engine/memory.js';
import { SKILLS } from './engine/response.js';

export const LANGS = {
  English: { code: 'en-US', label: 'English (อังกฤษ)' },
  Japanese: { code: 'ja-JP', label: '日本語 (ญี่ปุ่น)' },
  Chinese: { code: 'zh-CN', label: '中文 (จีน)' },
  Korean: { code: 'ko-KR', label: '한국어 (เกาหลี)' },
  French: { code: 'fr-FR', label: 'Français (ฝรั่งเศส)' },
  Spanish: { code: 'es-ES', label: 'Español (สเปน)' },
  German: { code: 'de-DE', label: 'Deutsch (เยอรมัน)' },
};
export const CEFR = { A1: 'เริ่มต้น', A2: 'พื้นฐาน', B1: 'กลาง', B2: 'กลาง-สูง', C1: 'สูง', C2: 'เชี่ยวชาญ' };
// IELTS band → CEFR, following the official IELTS/CEFR alignment (B1 4.0–5.0, B2 5.5–6.5, C1 7.0–8.0, C2 8.5+).
export const IELTS = [['3.5', 'A2'], ['4.0', 'B1'], ['4.5', 'B1'], ['5.0', 'B1'], ['5.5', 'B2'], ['6.0', 'B2'], ['6.5', 'B2'],
  ['7.0', 'C1'], ['7.5', 'C1'], ['8.0', 'C1'], ['8.5', 'C2'], ['9.0', 'C2']];

// Error categories the AI must choose from, so the Mistake Book can group and count them.
export const CATEGORIES = {
  tense: 'Tense (กาล)',
  'verb form': 'รูปกริยา',
  agreement: 'Subject–verb agreement',
  article: 'Article (a/an/the)',
  preposition: 'Preposition',
  plural: 'เอกพจน์/พหูพจน์',
  'word choice': 'การเลือกคำ',
  'word order': 'ลำดับคำ',
  spelling: 'การสะกด',
  punctuation: 'เครื่องหมาย',
  naturalness: 'ความเป็นธรรมชาติ',
  other: 'อื่นๆ',
};

export const DEFAULT_SETTINGS = {
  workerUrl: '',
  accessCode: '',               // optional; must match ACCESS_CODE on the Worker if that is set
  lang: 'English',
  level: 'B1',                  // CEFR (A1–C2) or, for English, an IELTS band such as 'IELTS 6.5'
  variant: 'American',          // English only: American or British
  name: 'Sam',
  persona: 'A kind, playful friend from abroad. Casual, warm, a little teasing. Loves hearing about the user\'s day, food and hobbies.',
  learnerName: '',
  goalText: '',                 // why the learner studies, e.g. "IELTS 7 for a master's degree"
  goalMinutes: 15,
  goalMessages: 10,
  goalReviews: 10,
  feedback: 'gentle',           // gentle: only clear errors; detailed: also naturalness tips
  theme: 'dark',
  voice: true,
  autoSend: true,
  rate: 0.95,
  dailyLimit: 0,                // free Gemini requests per day from AI Studio; 0 = unknown
  perDay: 2,                    // push: how many times a day the buddy may message first
  pushMode: 'random',           // random: perDay times between pushFrom..pushTo; fixed: at pushTimes
  pushFrom: 9,
  pushTo: 21,
  pushTimes: ['08:00', '19:00'],
  ai: 'auto',                   // which AI the worker tries first: auto (Gemini → Groq), groq, gemini
  character: 'buddy',           // who the learner is talking to (see js/engine/characters.js)
  memoryLearner: true,          // shared learner memory: facts the characters learn about you
  memoryCharacter: true,        // each character remembers its own past chats with you
  adaptiveVoice: true,          // speech speed follows the level, tone follows the character's mood
};

export const STATE_VERSION = 2;
const EMPTY_STATE = () => ({
  v: STATE_VERSION, messages: [], facts: [], mistakes: [], vocab: [], scene: null, lastSeen: 0,
  days: {}, activity: [], results: [],
  charMemory: {}, sessions: {}, skills: {}, topics: {},
  trimmed: {},
});
// How much is kept on this device. Learning records (words, mistakes) are only trimmed at a
// very high safety cap, and anything trimmed is counted in state.trimmed and shown in Settings,
// so nothing disappears silently. Chat keeps the latest messages per character.
export const LIMITS = { messagesPerChar: 500, mistakes: 5000, vocab: 5000, results: 500, activity: 40, days: 730 };
const TRIM_KINDS = ['messages', 'mistakes', 'vocab', 'results'];

// Keeps the newest `max` items and counts what was removed in s.trimmed[kind].
function capList(s, kind, list, max) {
  if (list.length <= max) return list;
  if (TRIM_KINDS.includes(kind)) s.trimmed[kind] = (s.trimmed[kind] || 0) + list.length - max;
  return list.slice(-max);
}
// Chat: the newest LIMITS.messagesPerChar messages of each character's thread.
function capMessages(s, list) {
  const per = {};
  for (const m of list) per[m.char || 'buddy'] = (per[m.char || 'buddy'] || 0) + 1;
  if (Object.values(per).every((n) => n <= LIMITS.messagesPerChar)) return list;
  const drop = Object.fromEntries(Object.entries(per).map(([k, n]) => [k, Math.max(0, n - LIMITS.messagesPerChar)]));
  const out = list.filter((m) => { const k = m.char || 'buddy'; if (drop[k] > 0) { drop[k]--; return false; } return true; });
  s.trimmed.messages = (s.trimmed.messages || 0) + list.length - out.length;
  return out;
}

// ---------- storage ----------
export function load(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}
let warned = false;
export function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    if (!warned) { warned = true; toast('บันทึกข้อมูลไม่ได้ (พื้นที่ในเครื่องอาจเต็ม) — ลองส่งออกข้อมูลสำรองแล้วล้างแชตเก่า', true); }
    console.error('save failed', key, e);
    return false;
  }
}

// ---------- migration & validation ----------
const str = (v, n = 4000) => clampStr(v, n);
function cleanCorrection(c) {
  if (!c || !c.wrong || !c.right) return null;
  return {
    wrong: str(c.wrong, 600), right: str(c.right, 600), why: str(c.why, 600),
    category: CATEGORIES[c.category] ? c.category : 'other',
    natural: str(c.natural, 600), example: str(c.example, 400),
  };
}
function cleanMistake(m) {
  const c = cleanCorrection(m);
  if (!c) return null;
  const t = Number(m.t) || Date.now();
  return { id: str(m.id, 40) || uid(), ...c, t, srs: m.srs && typeof m.srs === 'object' ? m.srs : newCard(t) };
}
function cleanWord(w) {
  if (!w || !w.word) return null;
  const t = Number(w.t) || Date.now();
  return { id: str(w.id, 40) || uid(), word: str(w.word, 80), meaning: str(w.meaning, 200), example: str(w.example, 300), t, srs: w.srs && typeof w.srs === 'object' ? w.srs : newCard(t) };
}
function cleanMessage(m) {
  if (!m || (m.role !== 'user' && m.role !== 'model')) return null;
  const out = { role: m.role, text: str(m.text), t: Number(m.t) || Date.now() };
  if (m.photo) out.photo = true;
  if (m.voice) out.voice = true;
  if (m.ai === 'groq') out.ai = 'groq';
  if (m.failed) out.failed = true;
  if (m.char && CHARACTER_IDS.includes(m.char) && m.char !== 'buddy') out.char = m.char;
  if (m.role === 'model' && m.emotion && EMOTIONS.includes(m.emotion.state)) out.emotion = { state: m.emotion.state, intensity: Math.max(0, Math.min(1, Number(m.emotion.intensity) || 0.5)) };
  if (m.as && ROLES[m.as]) out.as = m.as;
  if (Array.isArray(m.suggestions)) {
    const s = m.suggestions.filter((x) => x && x.text).slice(0, 4).map((x) => ({ label: str(x.label, 24), text: str(x.text, 200) }));
    if (s.length) out.suggestions = s;
  } else if (m.suggestion) out.suggestions = [{ label: '', text: str(m.suggestion, 200) }];   // older single suggestion
  const c = cleanCorrection(m.correction);
  if (c) out.correction = c;
  if (m.newWord && m.newWord.word) out.newWord = { word: str(m.newWord.word, 80), meaning: str(m.newWord.meaning, 200) };
  return out;
}

// Accepts any older or imported shape and returns a valid current state.
export function normalizeState(raw) {
  const s = { ...EMPTY_STATE(), ...(raw && typeof raw === 'object' ? raw : {}) };
  const t = s.trimmed && typeof s.trimmed === 'object' ? s.trimmed : {};
  s.trimmed = Object.fromEntries(TRIM_KINDS.filter((k) => Number(t[k]) > 0).map((k) => [k, Math.floor(Number(t[k]))]));
  s.messages = capMessages(s, (Array.isArray(s.messages) ? s.messages : []).map(cleanMessage).filter(Boolean));
  s.facts = (Array.isArray(s.facts) ? s.facts : []).map((f) => str(f, 160)).filter(Boolean).slice(-40);
  s.mistakes = capList(s, 'mistakes', (Array.isArray(s.mistakes) ? s.mistakes : []).map(cleanMistake).filter(Boolean), LIMITS.mistakes);
  s.vocab = capList(s, 'vocab', (Array.isArray(s.vocab) ? s.vocab : []).map(cleanWord).filter(Boolean), LIMITS.vocab);
  s.days = s.days && typeof s.days === 'object' ? s.days : {};
  s.activity = (Array.isArray(s.activity) ? s.activity : []).slice(-LIMITS.activity);
  s.results = capList(s, 'results', Array.isArray(s.results) ? s.results : [], LIMITS.results);
  s.scene = s.scene && typeof s.scene === 'object' && (s.scene.en || s.scene.id || s.scene.th) ? { ...s.scene, char: CHARACTER_IDS.includes(s.scene.char) ? s.scene.char : 'buddy' } : null;
  const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
  s.charMemory = Object.fromEntries(Object.entries(obj(s.charMemory)).filter(([k, v]) => CHARACTER_IDS.includes(k) && Array.isArray(v))
    .map(([k, v]) => [k, expire(v.filter((m) => m && m.text).map((m) => ({ id: str(m.id, 40) || uid(), text: str(m.text, 160), t: Number(m.t) || Date.now(), used: Number(m.used) || 0 }))).slice(-25)]));
  s.sessions = Object.fromEntries(Object.entries(obj(s.sessions)).filter(([k, v]) => CHARACTER_IDS.includes(k) && v && typeof v === 'object'));
  s.skills = Object.fromEntries(Object.entries(obj(s.skills)).filter(([k, v]) => SKILLS.includes(k) && Array.isArray(v)).map(([k, v]) => [k, v.map(Number).filter((n) => n >= 1 && n <= 5).slice(-30)]));
  s.topics = Object.fromEntries(Object.entries(obj(s.topics)).filter(([, n]) => Number(n) > 0).sort((a, b) => b[1] - a[1]).slice(0, 30).map(([k, n]) => [str(k, 60), Number(n)]));
  s.lastSeen = Number(s.lastSeen) || 0;
  s.v = STATE_VERSION;
  return s;
}

export let settings = { ...DEFAULT_SETTINGS, ...load('lb_settings', {}) };
export let state = normalizeState(load('lb_state', null));
export let push = { id: '', enabled: false, lastSync: 0, ...load('lb_push', {}) };

export function setSettings(next) { settings = { ...DEFAULT_SETTINGS, ...next }; save('lb_settings', settings); emit('settings'); }
export function saveSettings() { save('lb_settings', settings); emit('settings'); }
export function replaceState(next) { state = normalizeState(next); persist(); emit('state'); }
export function persist() {
  state.trimmed ||= {};
  state.messages = capMessages(state, state.messages);
  save('lb_state', { ...state, messages: state.messages.map(({ photoData, ...m }) => m) });
}
export function savePush() { save('lb_push', push); }

// Another tab changed the data: pick it up instead of overwriting it later.
window.addEventListener('storage', (e) => {
  if (e.key === 'lb_state' && e.newValue) { state = normalizeState(load('lb_state', null)); emit('state'); }
  if (e.key === 'lb_settings' && e.newValue) { settings = { ...DEFAULT_SETTINGS, ...load('lb_settings', {}) }; emit('settings'); }
});

// ---------- tiny event bus ----------
const listeners = {};
export function on(name, fn) { (listeners[name] ||= []).push(fn); }
export function emit(name, data) { for (const fn of listeners[name] || []) { try { fn(data); } catch (e) { console.error(e); } } }

export function addResult(r) {
  state.results.push(r);
  state.results = capList(state, 'results', state.results, LIMITS.results);
}

// Size of this app's data in localStorage (characters ≈ bytes for the browser's ~5 MB limit).
export function storageReport() {
  let chars = 0;
  try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith('lb_')) chars += k.length + (localStorage.getItem(k) || '').length; } } catch {}
  return {
    kb: Math.round(chars / 1024), limitKb: 5000,
    counts: { messages: state.messages.length, mistakes: state.mistakes.length, vocab: state.vocab.length, results: state.results.length },
    trimmed: { ...state.trimmed },
  };
}

// ---------- characters ----------
export const charOf = (m) => m.char || 'buddy';
export const activeCharId = () => (CHARACTER_IDS.includes(settings.character) ? settings.character : 'buddy');
export const activeChar = () => getCharacter(activeCharId(), settings);
// The live session for a character (role, scenario, mood, topic); stale ones start fresh.
export function sessionOf(id = activeCharId()) {
  const s = freshSession(state.sessions[id], getCharacter(id, settings));
  state.sessions[id] = s;
  return s;
}
export const threadOf = (id = activeCharId()) => state.messages.filter((m) => charOf(m) === id);

// ---------- learner helpers ----------
export const isEnglish = () => settings.lang === 'English';
export const ieltsBand = (level = settings.level) => (/^IELTS /.test(level) ? level.slice(6) : null);
export const cefrOf = (level = settings.level) => (ieltsBand(level) ? (IELTS.find(([b]) => b === ieltsBand(level)) || [0, 'B1'])[1] : (CEFR[level] ? level : 'B1'));
export const speechCode = () => (isEnglish() ? (settings.variant === 'British' ? 'en-GB' : 'en-US') : LANGS[settings.lang]?.code || 'en-US');
export function levelText() {
  const band = isEnglish() && ieltsBand();
  return band ? `IELTS band ${band} (about CEFR ${cefrOf()})` : `CEFR ${cefrOf()}`;
}
export function levelShort() {
  const band = isEnglish() && ieltsBand();
  return band ? `IELTS ${band}` : cefrOf();
}
export const flag = () => (isEnglish() ? (settings.variant === 'British' ? '🇬🇧' : '🇺🇸') : '');

export function logActivity(type, text) {
  state.activity.push({ t: Date.now(), type, text: clampStr(text, 120) });
  state.activity = state.activity.slice(-LIMITS.activity);
}

export function addMistake(c) {
  // The same fix twice is one card, so it does not flood the review queue.
  const dup = state.mistakes.find((m) => m.right.toLowerCase() === c.right.toLowerCase() && m.wrong.toLowerCase() === c.wrong.toLowerCase());
  if (dup) {
    dup.srs.due = Math.min(dup.srs.due, Date.now());
    // Older entries (from before categories existed) pick up the richer details.
    if (dup.category === 'other' && c.category !== 'other') Object.assign(dup, { category: c.category, why: c.why || dup.why, natural: c.natural || dup.natural, example: c.example || dup.example });
    return dup;
  }
  const m = { id: uid(), ...c, t: Date.now(), srs: newCard() };
  state.mistakes.push(m);
  state.mistakes = capList(state, 'mistakes', state.mistakes, LIMITS.mistakes);
  return m;
}

export function addWord(w) {
  const word = clampStr(w.word, 80).trim();
  if (!word || state.vocab.some((v) => v.word.toLowerCase() === word.toLowerCase())) return null;
  const v = { id: uid(), word, meaning: clampStr(w.meaning, 200), example: clampStr(w.example, 300), t: Date.now(), srs: newCard() };
  state.vocab.push(v);
  state.vocab = capList(state, 'vocab', state.vocab, LIMITS.vocab);
  return v;
}

// Most frequent error categories in the last 30 days, for the tutor prompt and the dashboard.
export function weakAreas(days = 30) {
  const since = Date.now() - days * 86400000;
  const counts = {};
  for (const m of state.mistakes) if (m.t >= since) counts[m.category] = (counts[m.category] || 0) + 1;
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([category, count]) => ({ category, count }));
}
