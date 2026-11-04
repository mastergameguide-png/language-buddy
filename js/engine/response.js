// Structured AI response: the schema the model is asked for, and a validator that treats the
// model's output as untrusted data. Only known fields with the right types and lengths survive;
// nothing in a reply can trigger an app action by itself (the app decides what to do with it).
import { EMOTIONS, ROLES } from './characters.js';
import { cleanEmotion } from './emotion.js';

export const CATEGORY_IDS = ['tense', 'verb form', 'agreement', 'article', 'preposition', 'plural', 'word choice', 'word order', 'spelling', 'punctuation', 'naturalness', 'other'];
export const SKILLS = ['grammar', 'vocabulary', 'fluency', 'comprehension', 'naturalness'];

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
  };
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
    return { reply: clean(raw, 4000) || '…', malformed: true, characterId: charId, emotion: null, activeRole: null, correction: null, newWord: null, memoryUpdates: [], suggestion: '', score: null, topic: '', summary: '', assessment: null };
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
    suggestion: clean(j.suggested_follow_up, 200),
    score: Number.isFinite(score) ? Math.max(0, Math.min(10, score)) : null,
    topic: clean(j.topic, 60),
    summary: clean(j.summary, 400),
    assessment: assessmentOf(j.assessment),
  };
}
