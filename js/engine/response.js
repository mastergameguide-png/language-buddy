// Structured AI response: the schema the model is asked for, and a validator that treats the
// model's output as untrusted data. Only known fields with the right types and lengths survive;
// nothing in a reply can trigger an app action by itself (the app decides what to do with it).
import { EMOTIONS, ROLES } from './characters.js';
import { cleanEmotion } from './emotion.js';

export const CATEGORY_IDS = ['tense', 'verb form', 'agreement', 'article', 'preposition', 'plural', 'word choice', 'word order', 'spelling', 'punctuation', 'naturalness', 'other'];
export const SKILLS = ['grammar', 'vocabulary', 'fluency', 'comprehension', 'naturalness'];
// error: wrong · unnatural: not wrong but not what a native speaker says · style: optional nicer way.
export const FEEDBACK_TYPES = ['error', 'unnatural', 'style'];

const str = (v, n) => (v == null ? '' : String(v)).slice(0, n);
const clean = (v, n) => str(v, n).trim();

// Models do not always use the exact category names; map close ones instead of losing them.
export function mapCategory(raw) {
  const c = String(raw || '').toLowerCase().trim();
  if (CATEGORY_IDS.includes(c)) return c;
  const rules = [
    [/tense|past|present|future|perfect/, 'tense'], [/agree/, 'agreement'], [/article|determiner/, 'article'],
    [/preposition/, 'preposition'], [/plural|singular|countable/, 'plural'], [/spell/, 'spelling'], [/punct|capital/, 'punctuation'],
    [/order/, 'word order'], [/natural|idiom|collocation|style|register/, 'naturalness'], [/vocab|word|lexic/, 'word choice'],
    [/verb|gerund|infinitive|modal/, 'verb form'],
  ];
  for (const [re, id] of rules) if (re.test(c)) return id;
  return 'other';
}

// Pretty-printed JSON can't have raw newlines inside strings, so a word at the start of a line
// followed by ":" is a key the model forgot to quote.
const repair = (t) => t.replace(/^(\s*)([A-Za-z_]\w*)\s*:/gm, '$1"$2":').replace(/,(\s*[}\]])/g, '$1');

export function extractJSON(text) {
  const cleaned = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '').trim();
  const m = cleaned.match(/\{[\s\S]*\}/);
  for (const candidate of [cleaned, m && m[0], m && repair(m[0])]) {
    if (!candidate) continue;
    try { return { json: JSON.parse(candidate), raw: cleaned }; } catch {}
  }
  return { json: null, raw: cleaned };
}

function feedbackOf(j) {
  // New name first, then the older field names this app used before.
  const f = j.language_feedback ?? j.correction;
  if (!f || typeof f !== 'object') return null;
  const wrong = clean(f.original ?? f.wrong, 600), right = clean(f.corrected ?? f.right, 600);
  if (!wrong || !right || wrong.toLowerCase() === right.toLowerCase()) return null;
  return {
    wrong, right,
    category: mapCategory(f.category),
    why: clean(f.explanation ?? f.why, 600),
    natural: clean(f.natural_expression ?? f.natural, 600),
    example: clean(f.example, 400),
    type: feedbackType(f),
    th: clean(f.translation_th ?? f.th, 400),
  };
}

// Older replies had no type: a "naturalness" category counts as unnatural, anything else as an error.
function feedbackType(f) {
  const t = String(f.type || '').toLowerCase().trim();
  if (FEEDBACK_TYPES.includes(t)) return t;
  if (/style|optional|suggest/.test(t)) return 'style';
  if (/unnatural|natural|idiom/.test(t)) return 'unnatural';
  return mapCategory(f.category) === 'naturalness' ? 'unnatural' : 'error';
}

// Graded help for answering the character's message: clue → vocabulary → structure → example.
export function hintsOf(h) {
  if (!h || typeof h !== 'object') return null;
  const vocab = (Array.isArray(h.vocab) ? h.vocab : []).slice(0, 10)
    .map((v) => (typeof v === 'string' ? { word: clean(v, 60), th: '' } : v && typeof v === 'object' ? { word: clean(v.word, 60), th: clean(v.th ?? v.meaning, 120) } : null))
    .filter((v) => v && v.word).slice(0, 5);
  const out = { clue: clean(h.clue, 300), vocab, structure: clean(h.structure, 200), example: clean(h.example, 300), example_th: clean(h.example_th, 300) };
  return out.clue || vocab.length || out.structure || out.example ? out : null;
}

// The "say it in English" helper's answer: up to 3 { label, text, note }.
export function parseHelper(text) {
  const { json } = extractJSON(text);
  // Models sometimes answer with the bare list instead of { options: [...] }.
  const list = Array.isArray(json) ? json : json && Array.isArray(json.options) ? json.options : [];
  const seen = new Set();
  return list.slice(0, 4).map((o) => (o && typeof o === 'object' ? { label: clean(o.label, 24), text: clean(o.text, 300), note: clean(o.note_th ?? o.note, 200) } : null))
    .filter((o) => o && o.text && !seen.has(o.text.toLowerCase()) && seen.add(o.text.toLowerCase())).slice(0, 3);
}

function memoryOf(j) {
  const out = [];
  if (Array.isArray(j.memory_updates)) {
    for (const u of j.memory_updates.slice(0, 4)) {
      if (typeof u === 'string') out.push({ scope: 'learner', text: clean(u, 160) });
      else if (u && typeof u === 'object') out.push({ scope: u.scope === 'character' ? 'character' : 'learner', text: clean(u.text, 160) });
    }
  }
  if (Array.isArray(j.remember)) for (const f of j.remember.slice(0, 4)) out.push({ scope: 'learner', text: clean(f, 160) });
  return out.filter((u) => u.text);
}

// Reply ideas for the learner: up to 4 { label, text }, each a different kind of answer.
// Accepts the new "suggested_replies" list and the older single "suggested_follow_up" string.
export function suggestionsOf(j) {
  const out = [];
  const seen = new Set();
  const add = (label, text) => {
    const t = clean(text, 200);
    if (!t || seen.has(t.toLowerCase())) return;
    seen.add(t.toLowerCase());
    out.push({ label: clean(label, 24), text: t });
  };
  if (Array.isArray(j.suggested_replies)) {
    for (const s of j.suggested_replies.slice(0, 6)) {
      if (typeof s === 'string') add('', s);
      else if (s && typeof s === 'object') add(s.label || s.type, s.text || s.reply);
    }
  }
  if (typeof j.suggested_follow_up === 'string') add('', j.suggested_follow_up);
  return out.slice(0, 4);
}

function assessmentOf(a) {
  if (!a || typeof a !== 'object') return null;
  const out = {};
  for (const k of SKILLS) {
    const n = Number(a[k]);
    if (Number.isFinite(n) && n >= 1 && n <= 5) out[k] = Math.round(n * 2) / 2;
  }
  return Object.keys(out).length ? out : null;
}

// Returns a safe object. `malformed` is true when the reply was not the JSON we asked for;
// the text is still shown so the chat never breaks.
export function parseStructured(text, { charId = null, roles = [] } = {}) {
  const { json: j, raw } = extractJSON(text);
  const message = j && typeof j === 'object' ? (typeof j.message === 'string' ? j.message : typeof j.reply === 'string' ? j.reply : null) : null;
  if (message == null) {
    return { reply: clean(raw, 4000) || '…', malformed: true, characterId: charId, emotion: null, activeRole: null, correction: null, newWord: null, memoryUpdates: [], suggestions: [], hints: null, score: null, topic: '', summary: '', assessment: null };
  }
  const w = j.new_word;
  const role = typeof j.active_role === 'string' ? j.active_role.trim().toLowerCase().replace(/[\s-]+/g, '_') : null;
  const score = j.score === null || j.score === undefined || j.score === '' ? null : Number(j.score);
  return {
    reply: clean(message, 4000) || '…',
    malformed: false,
    // A reply that claims to be another character is not trusted to change who is talking.
    characterId: charId,
    emotion: cleanEmotion(j.emotion) || (EMOTIONS.includes(j.emotion) ? { state: j.emotion, intensity: 0.5 } : null),
    activeRole: role && ROLES[role] && (!roles.length || roles.includes(role)) ? role : null,
    correction: feedbackOf(j),
    newWord: w && typeof w === 'object' && clean(w.word, 80) ? { word: clean(w.word, 80), meaning: clean(w.meaning, 200), example: clean(w.example, 300) } : null,
    memoryUpdates: memoryOf(j),
    suggestions: suggestionsOf(j),
    hints: hintsOf(j.hints),
    score: Number.isFinite(score) ? Math.max(0, Math.min(10, score)) : null,
    topic: clean(j.topic, 60),
    summary: clean(j.summary, 400),
    assessment: assessmentOf(j.assessment),
  };
}
