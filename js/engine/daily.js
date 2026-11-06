// 📘 Daily words: 5 English words a day, made by AI at one step above the learner's level, with a
// Thai meaning, synonyms, collocations, an IELTS-style example and a usage note. The prompt is
// based on one the owner wrote with Gemini. The reply is checked strictly; words the learner
// already has are skipped. Pure: no DOM, no storage.

export const DAILY_COUNT = 5;
// The AI is asked for a few more, because it sometimes repeats a word the learner already has
// (seen with Gemini on 2026-11-06); those are dropped here and the first 5 new ones are kept.
export const ASK_COUNT = DAILY_COUNT + 2;
const CEFR_STEPS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const POS = ['n', 'v', 'adj', 'adv', 'phrase', 'phrasal v', 'prep phrase'];

// One step above the learner's level (C2 stays C2).
export const targetCefr = (cefr) => CEFR_STEPS[Math.min(CEFR_STEPS.length - 1, Math.max(0, CEFR_STEPS.indexOf(cefr)) + 1)];
// An IELTS band one step up, shown in the prompt (e.g. 6.5 → 7.0).
export const targetBandOf = (band) => (band ? Math.min(9, Number(band) + 0.5).toFixed(1) : null);

export function buildDailyPrompt({ cefr = 'B1', band = null, exclude = [], count = ASK_COUNT }) {
  const level = targetCefr(cefr);
  const goal = band ? `IELTS band ${targetBandOf(band)}` : `CEFR ${level}`;
  const avoid = exclude.slice(-150).join(', ');
  return `You are an expert IELTS examiner and lexicographer. Generate ${count} vocabulary words for a Thai learner who is now at ${band ? `IELTS band ${band} (about CEFR ${cefr})` : `CEFR ${cefr}`} and is working towards ${goal}.

Criteria:
1. Level: mostly CEFR ${level}${level === 'C2' ? '' : `, at most one word at ${targetCefr(level)}`}. Not easier than ${cefr}.
2. Word types: verbs, adjectives, nouns and fixed phrases that are useful in IELTS Writing Task 2 and Speaking Part 3.
3. Utility: practical, current and natural in formal or academic English. No obscure, archaic or slang words.
4. Mix topics (e.g. society, work, technology, environment, education, health, public safety).
${avoid ? `5. Do NOT use any of these words the learner already has: ${avoid}.\n` : ''}
Answer with JSON only, exactly this shape:
{"words": [
  {
    "word": "the target word or phrase",
    "part_of_speech": "one of: ${POS.join(' / ')}",
    "cefr_level": "A2 / B1 / B2 / C1 / C2",
    "thai_meaning": "ความหมายภาษาไทยที่กระชับและถูกต้อง",
    "academic_synonyms": ["synonym 1", "synonym 2"],
    "common_collocations": ["collocation 1", "collocation 2"],
    "example_sentence": "One natural IELTS Writing Task 2 style sentence that uses the word.",
    "usage_note": "ข้อควรระวังหรือคำแนะนำสั้นๆ ในการใช้ (ภาษาไทย)"
  }
]}
Give exactly ${count} different words. The example must contain the word (or a form of it). The Thai meaning and usage note must be in Thai.`;
}

const s = (v, n) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const list = (v, n) => (Array.isArray(v) ? v : []).map((x) => s(x, 60)).filter(Boolean).slice(0, n);

// AI reply → [{word, pos, cefr, th, synonyms, collocations, example, note}]. Accepts {"words": [...]}
// or a bare array (the original prompt), with or without a ```json fence. Bad items are dropped.
export function parseDaily(raw, have = []) {
  let data;
  try {
    const text = String(raw || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    data = JSON.parse(text);
  } catch { return []; }
  const items = Array.isArray(data) ? data : Array.isArray(data?.words) ? data.words : [];
  const seen = new Set(have.map((w) => String(w).toLowerCase()));
  const out = [];
  for (const it of items) {
    if (!it || typeof it !== 'object') continue;
    const word = s(it.word, 60);
    const th = s(it.thai_meaning, 160);
    if (!word || !th || !/^[a-z][a-z' -]*$/i.test(word) || seen.has(word.toLowerCase())) continue;
    seen.add(word.toLowerCase());
    const pos = s(it.part_of_speech, 20).toLowerCase();
    const cefr = s(it.cefr_level, 2).toUpperCase();
    out.push({
      word, th,
      pos: POS.includes(pos) ? pos : '',
      cefr: CEFR_STEPS.includes(cefr) ? cefr : '',
      synonyms: list(it.academic_synonyms, 3),
      collocations: list(it.common_collocations, 3),
      example: s(it.example_sentence, 260),
      note: s(it.usage_note, 200),
    });
    if (out.length >= DAILY_COUNT) break;
  }
  return out;
}

// The saved set for one day: { day, cefr, words: [...], added: [word] }.
export function cleanDaily(v) {
  if (!v || typeof v !== 'object' || !/^\d{4}-\d{2}-\d{2}$/.test(String(v.day))) return null;
  const words = parseDaily(JSON.stringify((Array.isArray(v.words) ? v.words : []).map((w) => ({
    word: w?.word, thai_meaning: w?.th, part_of_speech: w?.pos, cefr_level: w?.cefr, academic_synonyms: w?.synonyms,
    common_collocations: w?.collocations, example_sentence: w?.example, usage_note: w?.note,
  }))));
  if (!words.length) return null;
  const names = new Set(words.map((w) => w.word));
  return { day: v.day, cefr: CEFR_STEPS.includes(v.cefr) ? v.cefr : '', words, added: (Array.isArray(v.added) ? v.added : []).filter((w) => names.has(w)) };
}
