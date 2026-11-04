// Talking to the Worker: the tutor prompt, request building, timeouts/retries, response
// validation, and the per-device quota counter.
import {
  settings, state, isEnglish, ieltsBand, levelText, cefrOf, weakAreas, load, save, emit, activeChar, sessionOf, threadOf,
} from './store.js';
import { buildSystemPrompt, buildHelperPrompt } from './engine/prompt.js';
import { parseStructured, parseHelper } from './engine/response.js';
import { modeOf, pick, LENGTHS, TEACHING } from './engine/modes.js';
import { recall } from './engine/memory.js';
import { scenarioById } from './engine/scenarios.js';
import { clampStr } from './util.js';

export const HISTORY_SENT = 24;
const TIMEOUT_MS = 45000;

// ---------- quota (counted on this device; Gemini resets at midnight Pacific time) ----------
const pacificDay = (d = new Date()) => d.toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
let usage = load('lb_usage', {});
export function todayUsage() {
  const day = pacificDay();
  if (usage.day !== day) usage = { day, requests: 0, photos: 0, tokens: 0, out: false, groq: 0 };
  usage.groq = usage.groq || 0;
  return usage;
}
export function nextReset() {
  const today = pacificDay(), t = new Date();
  t.setSeconds(0, 0);
  for (let i = 0; i < 1500 && pacificDay(t) === today; i++) t.setMinutes(t.getMinutes() + 1);
  return t;
}
// `requests` counts Gemini calls (the limit in settings is Gemini's); Groq calls are counted apart.
function recordUsage(tokens, hadPhoto, provider) {
  const u = todayUsage();
  if (provider === 'groq') u.groq += 1;
  else u.requests += 1;
  u.tokens += tokens || 0;
  if (hadPhoto) u.photos += 1;
  save('lb_usage', u);
  emit('usage');
}
function markQuotaOut() { todayUsage().out = true; save('lb_usage', usage); emit('usage'); }

// ---------- prompt ----------
function ieltsText() {
  const band = isEnglish() && ieltsBand();
  if (!band) return '';
  return `The learner is preparing for IELTS at around band ${band}. Now and then naturally use (and invite them to try) a word, collocation or structure typical of the next half band up. In feedback, when useful, name the IELTS criterion it affects.`;
}

// Everything the engine needs to write the prompt for the character the learner is talking to.
export function promptContext(extraContext = '') {
  const char = activeChar();
  const session = sessionOf(char.id);
  const thread = threadOf(char.id);
  const lastUser = [...thread].reverse().find((m) => m.role === 'user')?.text || '';
  const memOn = { learner: settings.memoryLearner !== false, character: settings.memoryCharacter !== false };
  // Recall only reads; the "used" time is stamped by the conversation once a reply arrives.
  const mems = memOn.character ? recall(state.charMemory[char.id] || [], `${lastUser} ${session.topic} ${extraContext}`, 6) : [];
  const sc = state.scene && state.scene.char === char.id ? state.scene : null;
  return {
    lang: settings.lang, isEnglish: isEnglish(), variant: settings.variant, levelText: levelText(), cefr: cefrOf(),
    ieltsText: ieltsText(), learnerName: clampStr(settings.learnerName, 40), goalText: clampStr(settings.goalText, 200), feedback: settings.feedback,
    mode: modeOf(settings.mode, isEnglish()), length: pick(LENGTHS, settings.length, 'normal'), teaching: pick(TEACHING, settings.teaching, 'medium'),
    char, session, scenario: sc ? (scenarioById(sc.id) || { custom: true, th: sc.th }) : null,
    sceneState: sc ? { variant: sc.variant, step: sc.step || 0 } : null,
    facts: memOn.learner ? state.facts : [],
    topics: memOn.learner ? Object.keys(state.topics || {}).slice(0, 5) : [],
    mistakes: state.mistakes.slice(-8).map((m) => `"${m.wrong}" → "${m.right}"`),
    weak: weakAreas().slice(0, 3).map((w) => `${w.category} (${w.count}×)`).join(', '),
    knownWords: state.vocab.slice(-30).map((v) => v.word),
    charMemories: mems.map((m) => m.text), memoryIds: mems.map((m) => m.id), memoryOn: memOn,
  };
}
export const systemPrompt = (extra) => buildSystemPrompt(promptContext(extra));

// User text that imitates the app's own notes is defused before it reaches the model.
const defuse = (t) => String(t || '').replace(/^\s*\[\s*app\s*note/i, '(app note');

export function buildContents(extraUserTurn) {
  const recent = threadOf().filter((m) => !m.failed || m.role === 'user').slice(-HISTORY_SENT);
  const hist = recent.map((m, i) => {
    const parts = [];
    const isNewest = i === recent.length - 1 && !extraUserTurn;
    if (m.photo && isNewest && m.photoData) parts.push({ inlineData: m.photoData });
    const text = (m.photo && !(isNewest && m.photoData) ? '[sent a photo] ' : '') + (m.role === 'user' ? defuse(m.text) : m.text || '');
    parts.push({ text: text || '(photo)' });
    return { role: m.role === 'user' ? 'user' : 'model', parts };
  });
  if (extraUserTurn) hist.push({ role: 'user', parts: [{ text: extraUserTurn }] });
  // Gemini wants the first turn to be the user's; keep the buddy's opening line by adding a placeholder.
  if (hist.length && hist[0].role !== 'user') hist.unshift({ role: 'user', parts: [{ text: '(opened the chat)' }] });
  return hist;
}

// The model's JSON is untrusted: see engine/response.js.
export function parseReply(text) {
  const char = activeChar();
  return parseStructured(text, { charId: char.id, roles: state.scene?.char === char.id ? [] : char.roles });
}

export const workerBase = () => settings.workerUrl.replace(/\/+$/, '');
export function authHeaders() {
  const h = { 'Content-Type': 'application/json' };
  if (settings.accessCode) h['X-Buddy-Key'] = settings.accessCode;
  return h;
}

async function post(url, body) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { method: 'POST', headers: authHeaders(), body, signal: ctrl.signal });
  } finally { clearTimeout(timer); }
}

export class AIError extends Error {}

// Sends one request to the Worker and returns its JSON, or throws an AIError with a Thai message.
async function callWorker(system, contents) {
  if (!settings.workerUrl) throw new AIError('ยังไม่ได้ใส่ลิงก์ Worker — ไปที่ ฉัน → ตั้งค่า');
  const hadPhoto = contents.some((c) => c.parts.some((p) => p.inlineData));
  const body = JSON.stringify({ system, contents, ai: settings.ai });
  let res, data = {};
  // One quiet retry for network blips; the Worker already switches between AIs on its side.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      res = await post(settings.workerUrl, body);
      data = {};
      try { data = await res.json(); } catch {}
      break;
    } catch (e) {
      if (attempt === 1) {
        if (e.name === 'AbortError') throw new AIError('AI ใช้เวลานานเกินไป ลองส่งใหม่อีกครั้ง');
        throw new AIError(navigator.onLine === false ? 'ไม่มีอินเทอร์เน็ต — ต่อเน็ตแล้วลองใหม่' : 'เชื่อมต่อ Worker ไม่ได้ ลองใหม่อีกครั้ง');
      }
      await new Promise((r) => setTimeout(r, 1200));
    }
  }
  // Gemini said its daily quota is gone, even if Groq answered instead.
  if ((data.fellBack || []).some((f) => f.provider === 'gemini' && f.status === 429 && /per\s*day|perday|daily/i.test(f.error || ''))) markQuotaOut();
  if (!res.ok) {
    const msg = String(data.error || `HTTP ${res.status}`);
    if (res.status === 401) throw new AIError('รหัสเข้าใช้ Worker ไม่ถูกต้อง — แก้ได้ที่ ฉัน → ตั้งค่า');
    if (res.status === 429) {
      if (/per\s*day|perday|daily/i.test(msg)) { markQuotaOut(); throw new AIError('โควตาฟรีของวันนี้หมดแล้ว ใช้ได้อีกครั้งหลังเวลารีเซ็ต'); }
      throw new AIError('ส่งถี่เกินไป รอประมาณ 1 นาทีแล้วลองใหม่');
    }
    if (res.status === 413) throw new AIError('รูปใหญ่เกินไป ลองรูปอื่น');
    if (res.status === 504) throw new AIError('AI ตอบช้าเกินไป ลองส่งใหม่อีกครั้ง');
    if (/location is not supported/i.test(msg)) throw new AIError('Google ปฏิเสธการเชื่อมต่อชั่วคราว ลองส่งใหม่อีกครั้ง');
    throw new AIError(clampStr(msg, 200));
  }
  recordUsage(data.usage?.total, hadPhoto, data.provider);
  return data;
}

export async function askAI(extraUserTurn) {
  const ctx = promptContext(extraUserTurn || '');
  const data = await callWorker(buildSystemPrompt(ctx), buildContents(extraUserTurn));
  return { ...parseReply(data.text), provider: data.provider === 'groq' ? 'groq' : 'gemini', ctx };
}

// IELTS practice feedback: one separate request; the learner's answer is the user turn. Nothing goes into the chat.
export async function askIelts(system, answer) {
  const data = await callWorker(system, [{ role: 'user', parts: [{ text: clampStr(answer, 6000) }] }]);
  return data.text;
}

// "Say it in English": the learner's Thai text → up to 3 ways to say it. Nothing goes into the chat.
export async function askHelper(thaiText) {
  const char = activeChar();
  const lastBot = [...threadOf(char.id)].reverse().find((m) => m.role === 'model')?.text || '';
  const system = buildHelperPrompt({ lang: settings.lang, isEnglish: isEnglish(), variant: settings.variant, cefr: cefrOf(), charName: char.name, lastBot });
  const data = await callWorker(system, [{ role: 'user', parts: [{ text: clampStr(thaiText, 600) }] }]);
  return parseHelper(data.text);
}
