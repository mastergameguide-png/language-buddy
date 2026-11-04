// Cheap checks on each AI reply. They do not change the reply; the app counts them so prompt
// problems (too hard for A1, invented shared history, several questions) can be seen over time.

export const MAX_WORDS = { A1: 10, A2: 14 };   // a little above the prompt's limit, to flag clear misses only
const INVENTED = /\b(you mentioned|you told me|last (week|time)|as (usual|always)|you always|your usual|that same|knowing you)\b/i;

const sentences = (t) => String(t || '').split(/(?<=[.!?])\s+|\n+/).map((x) => x.trim()).filter(Boolean);
const wordCount = (t) => String(t).split(/\s+/).filter(Boolean).length;

// ctx: { cefr, charMemories: string[], thread: [{ role, text }] } (thread = earlier messages).
export function checkReply(text, ctx = {}) {
  const limit = MAX_WORDS[ctx.cefr];
  const longest = Math.max(0, ...sentences(text).map(wordCount));
  // "you mentioned" is fine when there is something to remember: a memory or an earlier user message.
  const known = (ctx.charMemories || []).length > 0 || (ctx.thread || []).some((m) => m.role === 'user');
  return {
    tooLong: !!limit && longest > limit,
    invented: !known && INVENTED.test(String(text || '')),
    manyQuestions: (String(text || '').match(/\?/g) || []).length > 2,
  };
}

export const QUALITY_KEYS = ['replies', 'tooLong', 'invented', 'manyQuestions', 'malformed'];
export function addQuality(q, flags, malformed) {
  const out = { ...Object.fromEntries(QUALITY_KEYS.map((k) => [k, Number(q?.[k]) || 0])) };
  out.replies += 1;
  if (malformed) out.malformed += 1;
  for (const k of ['tooLong', 'invented', 'manyQuestions']) if (flags[k]) out[k] += 1;
  return out;
}
