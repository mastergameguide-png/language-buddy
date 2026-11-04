// Memory engine, three layers:
//  - shared learner memory: facts about the learner (state.facts), mistakes, words, level, goals
//  - character memory: what one character remembers of its own chats (state.charMemory[id])
//  - session memory: role, scenario, mood, topic and a running summary (state.sessions[id])
// Only short summaries are kept long-term, never whole conversations.

export const CHAR_MEMORY_MAX = 25;
export const LEARNER_FACTS_MAX = 40;
const EXPIRE_MS = 180 * 86400000;        // character memories not mentioned or used this long are dropped
const STOP = new Set('a an the to of in on at for and or but is are was were be been i you he she it we they my your his her our their me him them this that with from about have has had do did does not no yes so very really just like'.split(' '));

const words = (s) => String(s || '').toLowerCase().match(/[\p{L}\p{N}']+/gu)?.filter((w) => w.length > 1 && !STOP.has(w)) || [];

export function similarity(a, b) {
  const x = new Set(words(a)), y = new Set(words(b));
  if (!x.size || !y.size) return String(a).trim().toLowerCase() === String(b).trim().toLowerCase() ? 1 : 0;
  let common = 0;
  for (const w of x) if (y.has(w)) common++;
  return common / (x.size + y.size - common);
}

// Things that should not be stored even if the model suggests them.
const SENSITIVE = /(password|passcode|pin code|credit card|card number|bank account|passport no|id card|social security|\b\d[\d -]{7,}\d\b|@[\w-]+\.[a-z]{2,})/i;
export function safeMemoryText(t) {
  const s = String(t || '').replace(/\s+/g, ' ').trim().slice(0, 160);
  if (s.length < 3 || SENSITIVE.test(s)) return '';
  return s;
}

// Adds or refreshes a memory in a list; near-duplicates update the old entry instead.
export function remember(list, text, now = Date.now(), max = CHAR_MEMORY_MAX) {
  const s = safeMemoryText(text);
  if (!s) return list;
  const out = list.slice();
  const i = out.findIndex((m) => similarity(m.text, s) >= 0.6);
  if (i >= 0) out[i] = { ...out[i], text: s.length >= out[i].text.length ? s : out[i].text, t: now };
  else out.push({ id: now.toString(36) + Math.random().toString(36).slice(2, 6), text: s, t: now, used: 0 });
  return out.slice(-max);
}

export function rememberFact(facts, text) {
  const s = safeMemoryText(text);
  if (!s || facts.some((f) => similarity(f, s) >= 0.6)) return facts;
  return [...facts, s].slice(-LEARNER_FACTS_MAX);
}

export function expire(list, now = Date.now()) {
  return list.filter((m) => now - Math.max(m.t || 0, m.used || 0) < EXPIRE_MS);
}

// Most relevant memories for what is being talked about now (word overlap + recency).
export function recall(list, context, n = 6, now = Date.now()) {
  const ctx = new Set(words(context));
  return list
    .map((m) => {
      const overlap = words(m.text).filter((w) => ctx.has(w)).length;
      const ageDays = (now - (m.t || 0)) / 86400000;
      return { m, score: overlap * 2 + Math.max(0, 1 - ageDays / 30) };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, n)
    .map((x) => x.m);
}

// Applies validated memory updates from a reply. Returns the new { facts, charMemory } parts.
export function applyMemoryUpdates({ facts, list }, updates, opts, now = Date.now()) {
  let f = facts, l = list;
  for (const u of updates || []) {
    if (u.scope === 'learner' && opts.learner) f = rememberFact(f, u.text);
    if (u.scope === 'character' && opts.character) l = remember(l, u.text, now);
  }
  return { facts: f, list: l };
}
