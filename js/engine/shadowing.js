// Shadowing and listening practice: pure logic, no browser.
// - compareWords: which words of a model sentence the speech recogniser (or the learner's typing)
//   got. This measures recognised WORDS only. It is not a pronunciation score.
// - practiceItems / listeningItems: sentences built from the learner's own data.
// - checkAnswer: grading for dictation and gap-fill.

const CONTRACTIONS = {
  "i'm": 'i am', "you're": 'you are', "we're": 'we are', "they're": 'they are', "he's": 'he is', "she's": 'she is',
  "it's": 'it is', "that's": 'that is', "there's": 'there is', "what's": 'what is', "let's": 'let us',
  "i've": 'i have', "you've": 'you have', "we've": 'we have', "they've": 'they have',
  "i'll": 'i will', "you'll": 'you will', "we'll": 'we will', "they'll": 'they will', "it'll": 'it will',
  "i'd": 'i would', "you'd": 'you would', "we'd": 'we would',
  "don't": 'do not', "doesn't": 'does not', "didn't": 'did not', "can't": 'can not', "cannot": 'can not', "won't": 'will not',
  "isn't": 'is not', "aren't": 'are not', "wasn't": 'was not', "weren't": 'were not', "couldn't": 'could not',
  "wouldn't": 'would not', "shouldn't": 'should not', "haven't": 'have not', "hasn't": 'has not',
};
const NUMBERS = { zero: '0', one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9', ten: '10', eleven: '11', twelve: '12', fifteen: '15', twenty: '20', thirty: '30', fifty: '50', hundred: '100' };

// Comparison keys for one written token: lower case, no punctuation, contractions and number
// words spelled one way, so "I'm" = "I am" and "five" = "5".
export function tokenKeys(token) {
  const words = String(token || '').toLowerCase().replace(/[’‘]/g, "'").match(/[\p{L}\p{N}']+/gu) || [];
  return words.flatMap((w) => {
    const c = CONTRACTIONS[w] || w.replace(/'s$/, '');
    return c.split(' ').map((x) => NUMBERS[x] || x.replace(/'/g, ''));
  }).filter(Boolean);
}
export const normWords = (s) => String(s || '').split(/\s+/).flatMap(tokenKeys);
const tokens = (s) => String(s || '').split(/\s+/).filter(Boolean);

// Longest common subsequence alignment: word order matters, repeated words are not double-counted.
export function compareWords(reference, heard) {
  const toks = tokens(reference);
  const ref = [];                                    // { key, tok } for every comparable piece
  toks.forEach((t, i) => tokenKeys(t).forEach((key) => ref.push({ key, tok: i })));
  const got = normWords(heard);
  const n = ref.length, m = got.length;
  const L = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = ref[i].key === got[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const hit = new Array(n).fill(false);
  for (let i = 0, j = 0; i < n && j < m;) {
    if (ref[i].key === got[j]) { hit[i] = true; i++; j++; } else if (L[i + 1][j] >= L[i][j + 1]) i++; else j++;
  }
  // A written token counts as heard only if all its pieces were heard ("I'm" needs "I" and "am").
  const words = toks.map((word, i) => {
    const parts = ref.map((r, k) => (r.tok === i ? hit[k] : null)).filter((x) => x !== null);
    return { word, ok: parts.length ? parts.every(Boolean) : true, counted: parts.length > 0 };
  });
  const counted = words.filter((w) => w.counted);
  const matched = counted.filter((w) => w.ok).length;
  return { words, matched, total: counted.length, ratio: counted.length ? matched / counted.length : 0, extra: Math.max(0, m - L[0][0]) };
}

// Splits a sentence into short phrases for step-by-step shadowing.
export function splitPhrases(text, maxWords = 5) {
  const parts = String(text || '').split(/(?<=[,;:])\s+|\s+(?=(?:and|but|because|so|when|if|or|then)\s)/i).map((x) => x.trim()).filter(Boolean);
  const out = [];
  for (const p of parts) {
    const w = tokens(p);
    for (let i = 0; i < w.length; i += maxWords) {
      const chunk = w.slice(i, i + maxWords);
      // Do not leave a lonely last word.
      if (chunk.length === 1 && out.length && i > 0) out[out.length - 1] += ' ' + chunk[0];
      else out.push(chunk.join(' '));
    }
  }
  return out.length > 1 ? out : [String(text || '').trim()].filter(Boolean);
}

// Short stable key for remembering progress on a sentence.
export function itemKey(text) {
  const s = normWords(text).join(' ');
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

// Emoji end a sentence in chat ("I'm Sam 😊 What did you do?") and are not spoken, so they split and go.
const EMOJI = /\s*\p{Extended_Pictographic}[️‍\p{Extended_Pictographic}]*\s*/gu;
const sentencesOf = (t) => String(t || '').replace(EMOJI, '\n').split(/(?<=[.!?])\s+|\n+/).map((x) => x.trim()).filter(Boolean);
const wordCount = (t) => tokens(t).length;
const usable = (t, min = 3, max = 16) => { const n = wordCount(t); return n >= min && n <= max && !/…|\.\.\.|_{2,}|\[|\p{Extended_Pictographic}/u.test(t) && /[a-z]/i.test(t); };

// Sentences to shadow, most useful first: the learner's corrected mistakes, then example sentences
// from their word bank, then lines the characters said in chat, then phrases from scenarios.
export function practiceItems({ mistakes = [], vocab = [], messages = [], expressions = [] } = {}, limit = 40) {
  const out = [], seen = new Set();
  const add = (text, source, th = '') => {
    const t = String(text || '').trim();
    const k = itemKey(t);
    if (!usable(t) || seen.has(k)) return;
    seen.add(k);
    out.push({ key: k, text: t, th, source });
  };
  for (const m of [...mistakes].reverse()) add(m.natural || m.right, 'mistake', m.th || '');
  for (const w of [...vocab].reverse()) add(w.example, 'word', w.meaning ? `${w.word} = ${w.meaning}` : '');
  for (const m of [...messages].reverse().filter((x) => x.role === 'model').slice(0, 40)) for (const s of sentencesOf(m.text)) add(s, 'chat');
  for (const e of expressions) add(e, 'scenario');
  return out.slice(0, limit);
}
export const SOURCE_TH = { mistake: 'จากสมุดผิด', word: 'จากคลังคำ', chat: 'จากแชต', scenario: 'จากสถานการณ์' };

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Listening items: gap-fill from word-bank examples (hear the sentence, type the missing word) and
// dictation of short sentences (type the whole thing).
export function listeningItems({ vocab = [], mistakes = [], expressions = [] } = {}, limit = 30) {
  const out = [], seen = new Set();
  for (const w of [...vocab].reverse()) {
    const ex = String(w.example || '');
    const re = new RegExp(`\\b${escapeRe(String(w.word || '').trim())}\\b`, 'i');
    if (!w.word || !usable(ex, 3, 18) || !re.test(ex)) continue;
    const k = itemKey(ex);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ key: k, kind: 'gap', text: ex, answer: ex.match(re)[0], prompt: ex.replace(re, '_____'), th: w.meaning || '' });
  }
  const dict = [...mistakes].reverse().map((m) => ({ t: m.natural || m.right, th: m.th || '' })).concat(expressions.map((t) => ({ t, th: '' })));
  for (const { t, th } of dict) {
    if (!usable(t, 3, 12)) continue;
    const k = itemKey(t);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ key: k, kind: 'dictation', text: t, answer: t, prompt: '', th });
  }
  return out.slice(0, limit);
}

function editDistance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...new Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

// ok: correct (case and punctuation ignored). close: one small typo in a word of 5+ letters, or a
// dictation with 80%+ of the words right. Returns the word comparison for dictation.
export function checkAnswer(item, typed) {
  if (item.kind === 'gap') {
    const a = normWords(item.answer).join(' '), b = normWords(typed).join(' ');
    if (!b) return { ok: false, close: false };
    if (a === b) return { ok: true, close: false };
    return { ok: false, close: a.length >= 5 && editDistance(a, b) === 1 };
  }
  const cmp = compareWords(item.answer, typed);
  const ok = cmp.total > 0 && cmp.matched === cmp.total && cmp.extra === 0;
  return { ok, close: !ok && cmp.ratio >= 0.8, compare: cmp };
}

// Per-sentence progress kept in state.voice: { key: { kind, best (0–1 or null), n, t } }.
export const VOICE_KEEP = 400;
export function recordAttempt(voice, key, kind, ratio, now = Date.now()) {
  const prev = voice[key] || { kind, best: null, n: 0, t: 0 };
  const best = ratio == null ? prev.best : Math.max(prev.best ?? 0, ratio);
  const next = { ...voice, [key]: { kind, best, n: prev.n + 1, t: now } };
  const keys = Object.keys(next);
  if (keys.length > VOICE_KEEP) keys.sort((a, b) => next[a].t - next[b].t).slice(0, keys.length - VOICE_KEEP).forEach((k) => delete next[k]);
  return next;
}
