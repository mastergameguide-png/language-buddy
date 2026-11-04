// Conversation orchestration, without any DOM: sends a turn to the AI, applies the validated reply
// to the learner's data (mistakes, words, memory, mood, role, quality counters), and starts and
// ends scenes. The chat view listens to these events (store event bus):
//   'chat:busy' (bool) · 'chat:sent' {msg, photo} · 'chat:waiting' (bool)
//   'chat:reply' {msg, charId} · 'chat:failed' {msg, error} · 'chat:error' {error, retry} · 'chat:open'
import {
  settings, state, persist, emit, saveSettings, addMistake, addWord, addResult, logActivity,
  activeChar, activeCharId, sessionOf, threadOf,
} from './store.js';
import { getCharacter, ROLES, CHARACTER_IDS } from './engine/characters.js';
import { nextEmotion } from './engine/emotion.js';
import { applyRole, roleForScenario } from './engine/roles.js';
import { applyMemoryUpdates } from './engine/memory.js';
import { scoreLabel, scenarioById, progressOf, matchCriteria, VARIANTS } from './engine/scenarios.js';
import { appNotes } from './engine/prompt.js';
import { checkReply, addQuality } from './engine/checks.js';
import { askAI } from './ai.js';
import { speak, unlockSpeech } from './speech.js';
import { recordMessage, recordWord, recordHint, recordHelper, today } from './stats.js';
import { syncPush } from './push.js';
import { toast } from './util.js';

const GREET_AFTER_MS = 3 * 60 * 60 * 1000;

let busy = false;
let waiting = false;              // true only while a request to the AI is in flight
export const isBusy = () => busy;
export const isWaiting = () => waiting;

const loose = (s) => String(s || '').toLowerCase().replace(/[^\p{L}\p{N}']+/gu, ' ').trim();

// Applies one validated AI reply. Returns the new bot message.
export function applyAI(ai, userMsg, opts) {
  const char = getCharacter(opts.charId, settings);
  let session = sessionOf(char.id);
  const before = threadOf(char.id).filter((m) => m !== userMsg);
  // Models sometimes "correct" an earlier message; keep a correction only if it is about this one.
  if (ai.correction && (!userMsg || !loose(userMsg.text).includes(loose(ai.correction.wrong)))) ai.correction = null;
  if (userMsg) {
    const c = ai.correction;
    if (c) {
      // With "show at the end", corrections wait (seen:false) until the learner opens the summary.
      userMsg.correction = settings.correctionTiming === 'end' ? { ...c, seen: false } : { ...c };
      if (c.type !== 'style') addMistake(c);   // an optional style tip is not a mistake
    }
    recordMessage(userMsg.text, !!c && c.type !== 'style', userMsg.voice);
    if (userMsg.hint) recordHint(userMsg.hint);
    if (userMsg.helper) recordHelper();
    if (today().msgs === 1) logActivity('chat', `เริ่มคุยกับ ${char.name} วันนี้`);
  }
  // Memory changes go through the validated engine, and only if the learner allows them.
  const mem = applyMemoryUpdates({ facts: state.facts, list: state.charMemory[char.id] || [] }, ai.memoryUpdates,
    { learner: settings.memoryLearner !== false, character: settings.memoryCharacter !== false });
  state.facts = mem.facts;
  if (mem.list.length) state.charMemory[char.id] = mem.list;
  // Memories the prompt used stay fresh (they expire when unused).
  const used = new Set(ai.ctx?.memoryIds || []);
  for (const m of state.charMemory[char.id] || []) if (used.has(m.id)) m.used = Date.now();
  // Mood and role: the engines decide; the model only suggests.
  session.emotion = nextEmotion(session.emotion, ai.emotion, char);
  if (ai.activeRole && ai.activeRole !== session.role) {
    const next = applyRole(session, char, ai.activeRole, 'auto');
    if (next.role !== session.role) toast(next.role === char.defaultRole ? `${char.name} กลับเป็นตัวเองตามปกติ` : `${char.name} เปลี่ยนเป็น${ROLES[next.role].th}`);
    session = { ...session, role: next.role, roleSource: next.roleSource };
  }
  if (ai.topic) {
    const key = ai.topic.toLowerCase();
    if (key !== (session.topic || '').toLowerCase() && settings.memoryLearner !== false) state.topics[key] = (state.topics[key] || 0) + 1;
    session.topic = ai.topic;
  }
  if (ai.summary) session.summary = ai.summary;
  session.t = Date.now();
  session.turns = (session.turns || 0) + 1;
  state.sessions[char.id] = session;
  // Scenario progress: the model reports the stage; the app only moves forward and checks the id.
  const scene = state.scene && state.scene.char === char.id ? state.scene : null;
  if (scene && scene.total) {
    const idx = ai.scenarioStep ? Number(ai.scenarioStep.slice(1)) : 0;
    if (idx >= 1 && idx <= scene.total) scene.step = Math.max(scene.step || 0, idx);
    if (ai.scenarioDone && !scene.done) { scene.done = true; scene.step = scene.total; }
  }
  if (ai.assessment && userMsg) for (const [k, v] of Object.entries(ai.assessment)) state.skills[k] = [...(state.skills[k] || []), v].slice(-30);
  // Quality counters only; the reply itself is never rewritten.
  state.quality = addQuality(state.quality, checkReply(ai.reply, { cefr: ai.ctx?.cefr, charMemories: ai.ctx?.charMemories, thread: before }), ai.malformed);

  const botMsg = { role: 'model', text: ai.reply, t: Date.now(), emotion: session.emotion, as: session.role };
  if (char.id !== 'buddy') botMsg.char = char.id;
  if (ai.suggestions?.length) botMsg.suggestions = ai.suggestions;
  if (ai.hints) botMsg.hints = ai.hints;
  if (ai.provider === 'groq') botMsg.ai = 'groq';
  if (ai.newWord && addWord(ai.newWord)) {
    botMsg.newWord = { word: ai.newWord.word, meaning: ai.newWord.meaning };
    recordWord();
    logActivity('word', `คำใหม่: ${ai.newWord.word}`);
  }
  if (opts.feedbackFor) {
    const sc = opts.feedbackFor;
    const result = {
      t: Date.now(), id: sc.id || null, icon: sc.icon, scene: sc.th, char: char.id, score: ai.score, summary: ai.reply.slice(0, 400),
      variant: sc.variant || 'normal', step: sc.step || 0, total: sc.total || 0, done: !!sc.done,
      criteria: matchCriteria(ai.criteriaScores, sc.criteria),
    };
    const before = sc.id ? progressOf(state.results, sc.id) : null;
    addResult(result);
    const label = scoreLabel(result);
    const prev = before?.last && result.score != null && Number.isFinite(Number(result.score)) ? Number(result.score) - Number(before.last.score) : null;
    logActivity('roleplay', `จบสถานการณ์ ${sc.th} กับ ${char.name}${label ? ` · ${label}` : ''}${prev ? ` (${prev > 0 ? '+' : ''}${prev} จากครั้งก่อน)` : ''}`);
  }
  state.messages.push(botMsg);
  state.lastSeen = Date.now();
  persist();
  emit('chat:reply', { msg: botMsg, charId: char.id });
  emit('badges');
  if (settings.voice && activeCharId() === char.id) speak(ai.reply, { emotion: session.emotion });
  syncPush(false);
  return botMsg;
}

// userText/photo: a new user message. hiddenTurn: an [App note] instruction with no visible
// user message. opts: { voice, hint (1–4), helper, retryMsg, feedbackFor }.
export async function run(userText, hiddenTurn, photo, opts = {}) {
  if (busy) { toast('รอให้ตอบข้อความก่อนหน้าเสร็จก่อนนะ'); return false; }
  busy = true;
  emit('chat:busy', true);
  opts = { ...opts, charId: activeCharId() };
  let userMsg = opts.retryMsg || null;
  if (userMsg) { delete userMsg.failed; emit('chat:open'); }
  else if (userText || photo) {
    userMsg = { role: 'user', text: userText || '', t: Date.now() };
    if (opts.charId !== 'buddy') userMsg.char = opts.charId;
    if (opts.voice) userMsg.voice = true;
    if (opts.hint) userMsg.hint = opts.hint;
    if (opts.helper) userMsg.helper = true;
    if (photo) {
      userMsg.photo = true;
      userMsg.photoData = { mimeType: photo.mimeType, data: photo.data };
    }
    state.messages.push(userMsg);
    persist();
    emit('chat:sent', { msg: userMsg, photo });
  }
  waiting = true;
  emit('chat:waiting', true);
  let ok = false;
  try {
    const ai = await askAI(hiddenTurn);
    waiting = false;
    emit('chat:waiting', false);
    busy = false;   // before the reply event, so the view shows reply ideas and hints right away
    applyAI(ai, userMsg, opts);
    ok = true;
  } catch (e) {
    waiting = false;
    emit('chat:waiting', false);
    console.warn(e);
    busy = false;
    if (userMsg) {
      userMsg.failed = true;
      persist();
      emit('chat:failed', { msg: userMsg, error: e.message });
    } else {
      emit('chat:error', { error: e.message, retry: () => run(null, hiddenTurn, null, opts) });
    }
  } finally {
    if (userMsg && ok) delete userMsg.photoData;   // the model only sees each photo once
    busy = false;
    emit('chat:busy', false);
  }
  return ok;
}

// The character writes first when its chat is opened after a while (or for the first time).
export function maybeGreet() {
  if (!settings.workerUrl || busy) return;
  const char = activeChar();
  const thread = threadOf(char.id);
  const lastT = thread.length ? thread[thread.length - 1].t : 0;
  const gap = Date.now() - lastT;
  if (thread.length && gap < GREET_AFTER_MS) return;
  const hours = lastT ? Math.round(gap / 3600000) : null;
  const local = new Date().toLocaleString('en-GB', { weekday: 'long', hour: '2-digit', minute: '2-digit' });
  run(null, appNotes.greet({ name: char.name, hours, local }));
}

// Talk to another character (each has its own chat, memory and mood).
export function setCharacter(id) {
  if (!CHARACTER_IDS.includes(id)) return false;
  if (busy) { toast('รอให้ตอบข้อความก่อนหน้าเสร็จก่อนนะ'); return false; }
  settings.character = id;
  saveSettings();
  return true;
}

// ---------- role-play & focused practice ----------
// scenario: an entry from engine/scenarios.js, or { custom: true, icon, th } for the learner's own idea.
export function startScene(scenario, charId, variant = 'normal') {
  if (busy) { toast('รอให้ตอบข้อความก่อนหน้าเสร็จก่อนนะ'); return; }
  if (charId && CHARACTER_IDS.includes(charId)) { settings.character = charId; saveSettings(); }
  const char = activeChar();
  let s = sessionOf(char.id);
  s = applyRole(s, char, scenario.custom ? 'scene' : roleForScenario(scenario, char), 'scenario');
  s.scenario = scenario.id || 'custom';
  s.t = Date.now();
  state.sessions[char.id] = s;
  const v = VARIANTS[variant] ? variant : 'normal';
  state.scene = {
    id: scenario.custom ? null : scenario.id, icon: scenario.icon || '🎭', th: scenario.th, char: char.id, feedback: scenario.feedback || '', criteria: scenario.criteria || [],
    variant: v, total: scenario.custom ? 0 : (scenarioById(scenario.id)?.steps.length || 0), step: 0, done: false,
  };
  logActivity('roleplay', `เริ่มสถานการณ์ ${scenario.th} กับ ${char.name}${v !== 'normal' ? ` (${VARIANTS[v].th})` : ''}`);
  persist();
  emit('chat:open');
  unlockSpeech();
  run(null, appNotes.sceneStart(scenario.th));
}

export function endScene() {
  const char = activeChar();
  if (busy || !state.scene || state.scene.char !== char.id) return;
  const scene = state.scene;
  state.scene = null;
  state.sessions[char.id] = applyRole(sessionOf(char.id), char, null, 'default');
  persist();
  emit('chat:open');
  run(null, appNotes.sceneEnd({ title: scene.th, name: char.name, lang: settings.lang, feedback: scene.feedback, criteria: scene.criteria }), null, { feedbackFor: scene });
}

export function practice(category, label) {
  emit('chat:open');
  unlockSpeech();
  run(null, appNotes.practice(category, label));
}

export function quiz() {
  emit('chat:open');
  unlockSpeech();
  run(null, appNotes.quiz());
}

// Corrections the learner has not looked at yet (only collected when the timing is "end").
export const unseenCorrections = (charId = activeCharId()) =>
  threadOf(charId).filter((m) => m.role === 'user' && m.correction && m.correction.seen === false);
export function markCorrectionsSeen(charId = activeCharId()) {
  for (const m of unseenCorrections(charId)) delete m.correction.seen;
  persist();
}
