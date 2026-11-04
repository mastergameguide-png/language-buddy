// AI conversation: messages, inline feedback, new words, photos, voice, role-play bar.
import { $, el, h, icon, fmtTime, toast } from '../util.js';
import {
  settings, state, persist, emit, on, addMistake, addWord, logActivity, CATEGORIES, levelShort, flag, saveSettings,
  activeChar, activeCharId, sessionOf, threadOf,
} from '../store.js';
import { getCharacter, ROLES, CHARACTER_IDS } from '../engine/characters.js';
import { nextEmotion, EMOTION_UI } from '../engine/emotion.js';
import { applyRole, roleForScenario } from '../engine/roles.js';
import { applyMemoryUpdates } from '../engine/memory.js';
import { avatarEl } from './avatar.js';
import { askAI, todayUsage, nextReset } from '../ai.js';
import { speak, unlockSpeech, listen, stopListening, listening, canListen } from '../speech.js';
import { recordMessage, recordWord, today } from '../stats.js';
import { syncPush } from '../push.js';

const PHOTO_MAX_SIDE = 1024;
const GREET_AFTER_MS = 3 * 60 * 60 * 1000;
const SHOW_LAST = 150;

let busy = false;
let waiting = false;              // true only while a request to the AI is in flight
let pendingPhoto = null;           // { dataUrl, mimeType, data } waiting to be sent
let lastInputWasVoice = false;
let showAll = false;
const photoCache = {};             // message time -> dataUrl; photos are not saved to storage (too big)

const box = () => $('messages');
const input = () => $('chatInput');
const scrollDown = () => requestAnimationFrame(() => { const b = box(); if (b) b.scrollTop = b.scrollHeight; });

// ---------- rendering ----------
function feedbackCard(c) {
  const wrap = el('div', 'feedback');
  const more = el('div', 'more');
  more.hidden = true;
  const toggle = h('button', { type: 'button', 'aria-expanded': 'false' },
    el('span', '', '✏️'),
    el('span', 'fix-right grow', c.right),
    el('span', 'chip', CATEGORIES[c.category] || 'อื่นๆ'));
  toggle.addEventListener('click', () => {
    more.hidden = !more.hidden;
    toggle.setAttribute('aria-expanded', String(!more.hidden));
  });
  const p = (label, text) => (text ? [el('span', 'label', label), el('p', '', text)] : []);
  const line = el('p');
  line.append(el('span', 'wrong', c.wrong), ' → ', el('span', 'fix-right', c.right));
  more.append(line, ...p('ทำไม', c.why), ...p('พูดแบบเจ้าของภาษา', c.natural), ...p('ตัวอย่างเพิ่ม', c.example));
  if (c.natural || c.right) {
    const say = h('button', { type: 'button', class: 'btn sm ghost', style: 'margin-top:8px' }, icon('speaker'), 'ฟังประโยคที่ถูก');
    say.addEventListener('click', () => speak(c.natural || c.right, { plain: true }));
    more.append(say);
  }
  wrap.append(toggle, more);
  return wrap;
}

function renderMessage(m) {
  const row = el('div', 'msg ' + (m.role === 'user' ? 'me' : 'bot'));
  const bubble = el('div', 'bubble');
  if (m.photo) {
    if (photoCache[m.t]) bubble.append(h('img', { src: photoCache[m.t], alt: 'รูปที่ส่ง' }));
    else bubble.append(el('div', 'xs', '📷 ส่งรูป'));
  }
  if (m.text) bubble.append(m.text);
  if (m.role === 'model') {
    bubble.title = 'แตะเพื่อฟังอีกครั้ง';
    bubble.addEventListener('click', () => speak(m.text, { emotion: m.emotion }));
  }
  row.append(bubble);
  if (m.correction) row.append(feedbackCard(m.correction));
  if (m.newWord) row.append(el('div', 'newword', `📘 คำใหม่: ${m.newWord.word}${m.newWord.meaning ? ' — ' + m.newWord.meaning : ''} · เก็บในคลังคำแล้ว`));
  const role = m.as && m.as !== activeChar().defaultRole && ROLES[m.as] ? ' · 🎭 ' + ROLES[m.as].th : '';
  const emo = m.emotion && EMOTION_UI[m.emotion.state] ? ' · ' + EMOTION_UI[m.emotion.state].emoji : '';
  const meta = el('div', 'meta', fmtTime(m.t) + role + emo + (m.ai === 'groq' ? ' · Groq' : '') + (m.voice ? ' · 🎤' : ''));
  row.append(meta);
  if (m.failed) {
    const retry = h('button', { type: 'button', class: 'btn sm danger' }, 'ส่งไม่สำเร็จ · ลองอีกครั้ง');
    retry.addEventListener('click', () => run(null, null, null, { retryMsg: m }));
    row.append(retry);
  }
  return row;
}

export function renderChat() {
  const b = box();
  if (!b) return;
  b.textContent = '';
  const msgs = threadOf();
  if (!msgs.length && !waiting) b.append(introCard(activeChar()));
  const start = showAll ? 0 : Math.max(0, msgs.length - SHOW_LAST);
  if (start > 0) {
    const more = h('button', { type: 'button', class: 'btn sm ghost' }, `แสดงข้อความก่อนหน้า (${start})`);
    more.addEventListener('click', () => { showAll = true; renderChat(); });
    b.append(more);
  }
  for (const m of msgs.slice(start)) b.append(renderMessage(m));
  const last = msgs[msgs.length - 1];
  showSuggestions();
  if (!settings.workerUrl) notice('ยังไม่ได้ใส่ลิงก์ Cloudflare Worker — ใส่ในหน้าตั้งค่าก่อนเริ่มคุย', false, 'เปิดตั้งค่า', () => { location.hash = '#settings'; });
  if (waiting) typing(true);
  scrollDown();
}

// Shows reply ideas for the latest message (only when nothing is in flight).
function showSuggestions() {
  const b = box();
  if (!b) return;
  b.querySelector('.suggest-box')?.remove();
  const msgs = threadOf();
  const last = msgs[msgs.length - 1];
  if (last && last.role === 'model' && last.suggestions?.length && !busy && !waiting) { b.append(suggestBox(last.suggestions)); scrollDown(); }
}

// Reply ideas under the latest message. Tapping one puts it in the box so the learner can edit it first.
function suggestBox(list) {
  const box = el('div', 'suggest-box');
  box.append(el('div', 'suggest-head', '💡 ลองตอบ — แตะเพื่อใส่ในช่องพิมพ์ แก้ได้ก่อนส่ง'));
  for (const s of list) {
    const btn = h('button', { type: 'button', class: 'suggest' }, s.label ? el('span', 'suggest-tag', s.label) : '', el('span', '', s.text));
    btn.addEventListener('click', () => { input().value = s.text; autoGrow(); refreshSend(); input().focus(); });
    box.append(btn);
  }
  return box;
}

function notice(text, isErr, btnLabel, onClick) {
  const n = el('div', 'notice' + (isErr ? ' err' : ''), text);
  if (btnLabel) {
    const b = h('button', { type: 'button', class: 'btn sm' }, btnLabel);
    b.addEventListener('click', onClick);
    n.append(el('br'), b);
  }
  box()?.append(n);
  scrollDown();
}

function typing(on) {
  let t = $('typing');
  if (on && !t) {
    t = el('div', 'msg bot');
    t.id = 'typing';
    const b = el('div', 'bubble typing');
    b.setAttribute('aria-label', 'กำลังพิมพ์');
    b.append(el('i'), el('i'), el('i'));
    t.append(b);
    box()?.append(t);
    scrollDown();
  } else if (!on && t) t.remove();
}

function introCard(char) {
  const c = h('div', { class: 'intro' }, avatarEl(char, null, 'lg'), el('b', '', char.name),
    el('div', 'small muted', char.custom ? 'เพื่อนที่คุณกำหนดเอง' : `${char.tagline.th} · ${char.age} ปี · ${char.nationality} · ${char.occupation}`));
  if (!char.custom) c.append(el('p', 'xs muted', `${char.personality.join(' · ')} — บทบาท: ${char.roles.map((r) => ROLES[r].th).join(', ')}`));
  c.append(el('p', 'xs muted', 'ตัวละครเป็นตัวละคร AI สมมติ'));
  return c;
}

export function renderHeader() {
  if (!$('buddyName')) return;
  const char = activeChar();
  const s = sessionOf(char.id);
  $('buddyName').textContent = char.name;
  $('avatarSlot').replaceChildren(avatarEl(char, s.emotion, 'md'));
  $('buddyStatus').textContent = `${settings.lang} ${flag()} · ${levelShort()}${char.custom ? '' : ' · ' + char.tagline.th}`;
  renderCharBar();
  renderScene();
  renderQuota();
}

function renderCharBar() {
  const char = activeChar();
  const s = sessionOf(char.id);
  const sel = $('roleSelect');
  const roles = [...char.roles];
  if (!roles.includes(s.role)) roles.push(s.role);
  sel.replaceChildren(...roles.map((r) => {
    const o = el('option', '', (ROLES[r] || ROLES.scene).th + (r === char.defaultRole ? ' (ปกติ)' : ''));
    o.value = r;
    return o;
  }));
  sel.value = s.role;
  sel.disabled = !!s.scenario || roles.length < 2;
  const e = s.emotion || { state: char.emotional.baseline, intensity: 0.5 };
  const ui = EMOTION_UI[e.state] || EMOTION_UI.neutral;
  $('emoChip').textContent = `${ui.emoji} ${ui.th}`;
  $('emoChip').title = `อารมณ์ตอนนี้: ${ui.th} (${Math.round(e.intensity * 100)}%)`;
  $('roleReset').hidden = s.role === char.defaultRole || !!s.scenario;
}

function setRole(roleId) {
  const char = activeChar();
  const before = sessionOf(char.id);
  const s = roleId === char.defaultRole ? applyRole(before, char, null, 'default') : applyRole(before, char, roleId, 'manual');
  state.sessions[char.id] = s;
  persist();
  renderHeader();
  toast(s.role === char.defaultRole ? `${char.name} กลับเป็นตัวเองตามปกติ` : `${char.name} จะเล่นเป็น${ROLES[s.role].th}จนกว่าคุณจะเปลี่ยน`);
}

// Talk to another character (each has its own chat, memory and mood).
export function switchCharacter(id) {
  if (!CHARACTER_IDS.includes(id)) return;
  if (busy) { toast('รอให้ตอบข้อความก่อนหน้าเสร็จก่อนนะ'); return; }
  settings.character = id;
  saveSettings();
  showAll = false;
  if (location.hash === '#chat') { renderHeader(); renderChat(); maybeGreet(); } else location.hash = '#chat';
}

export function renderQuota() {
  const q = $('quota');
  if (!q) return;
  const u = todayUsage(), limit = Number(settings.dailyLimit) || 0;
  const reset = nextReset().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
  const n = u.requests.toLocaleString('th-TH');
  let text, pct = 0;
  if (u.out) { text = `Gemini วันนี้หมดแล้ว · ใช้ได้อีกหลัง ${reset} น.` + (settings.ai !== 'gemini' ? ' · ตอนนี้คุยผ่าน Groq' : ''); pct = 100; }
  else if (limit) { text = `Gemini วันนี้ ${n} / ${limit.toLocaleString('th-TH')} · เหลือ ${Math.max(limit - u.requests, 0).toLocaleString('th-TH')} · รีเซ็ต ${reset} น.`; pct = Math.min(100, (u.requests / limit) * 100); }
  else text = `Gemini วันนี้ ${n} ครั้ง · แตะเพื่อใส่โควตาต่อวัน`;
  if (u.groq) text += ` · Groq ${u.groq.toLocaleString('th-TH')}`;
  if (u.photos) text += ` · รูป ${u.photos}`;
  $('quotaText').textContent = text;
  $('quotaBar').style.width = pct + '%';
  $('quotaBarWrap').className = 'bar ' + (u.out || (limit && u.requests >= limit) ? 'bad' : limit && u.requests >= limit * 0.8 ? 'warn' : '');
  q.classList.toggle('out', !!u.out);
}

function renderScene() {
  const bar = $('sceneBar');
  if (!bar) return;
  const sc = state.scene && state.scene.char === activeCharId() ? state.scene : null;
  bar.hidden = !sc;
  if (sc) $('sceneText').textContent = `${sc.icon} กำลังฝึก: ${sc.th}`;
}

// ---------- talking to the AI ----------
const loose = (s) => String(s || '').toLowerCase().replace(/[^\p{L}\p{N}']+/gu, ' ').trim();

function applyAI(ai, userMsg, opts) {
  const char = getCharacter(opts.charId, settings);
  let session = sessionOf(char.id);
  // Models sometimes "correct" an earlier message; keep a correction only if it is about this one.
  if (ai.correction && (!userMsg || !loose(userMsg.text).includes(loose(ai.correction.wrong)))) ai.correction = null;
  if (userMsg) {
    if (ai.correction) { userMsg.correction = ai.correction; addMistake(ai.correction); }
    recordMessage(userMsg.text, !!ai.correction, userMsg.voice);
    if (today().msgs === 1) logActivity('chat', `เริ่มคุยกับ ${char.name} วันนี้`);
  }
  // Memory changes go through the validated engine, and only if the learner allows them.
  const mem = applyMemoryUpdates({ facts: state.facts, list: state.charMemory[char.id] || [] }, ai.memoryUpdates,
    { learner: settings.memoryLearner !== false, character: settings.memoryCharacter !== false });
  state.facts = mem.facts;
  if (mem.list.length) state.charMemory[char.id] = mem.list;
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
  if (ai.assessment && userMsg) for (const [k, v] of Object.entries(ai.assessment)) state.skills[k] = [...(state.skills[k] || []), v].slice(-30);

  const botMsg = { role: 'model', text: ai.reply, t: Date.now(), emotion: session.emotion, as: session.role };
  if (char.id !== 'buddy') botMsg.char = char.id;
  if (ai.suggestions?.length) botMsg.suggestions = ai.suggestions;
  if (ai.provider === 'groq') botMsg.ai = 'groq';
  if (ai.newWord && addWord(ai.newWord)) {
    botMsg.newWord = { word: ai.newWord.word, meaning: ai.newWord.meaning };
    recordWord();
    logActivity('word', `คำใหม่: ${ai.newWord.word}`);
  }
  if (opts.feedbackFor) {
    state.results.push({ t: Date.now(), icon: opts.feedbackFor.icon, scene: opts.feedbackFor.th, char: char.id, score: ai.score, summary: ai.reply.slice(0, 400) });
    state.results = state.results.slice(-50);
    logActivity('roleplay', `จบสถานการณ์ ${opts.feedbackFor.th} กับ ${char.name}${ai.score != null ? ` · ${ai.score}/10` : ''}`);
  }
  state.messages.push(botMsg);
  state.lastSeen = Date.now();
  persist();
  if (activeCharId() === char.id) { renderHeader(); renderChat(); }
  emit('state');
  if (settings.voice && activeCharId() === char.id) speak(ai.reply, { emotion: session.emotion });
  syncPush(false);
}

// userText/photo: a new user message. hiddenTurn: an [App note] instruction with no visible
// user message. opts.retryMsg: re-ask for a user message whose reply failed.
export async function run(userText, hiddenTurn, photo, opts = {}) {
  if (busy) { toast('รอให้ตอบข้อความก่อนหน้าเสร็จก่อนนะ'); return; }
  busy = true;
  refreshSend();
  box()?.querySelector('.suggest-box')?.remove();
  opts = { ...opts, charId: activeCharId() };
  let userMsg = opts.retryMsg || null;
  if (userMsg) { delete userMsg.failed; renderChat(); }
  else if (userText || photo) {
    userMsg = { role: 'user', text: userText || '', t: Date.now() };
    if (opts.charId !== 'buddy') userMsg.char = opts.charId;
    if (opts.voice) userMsg.voice = true;
    if (photo) {
      userMsg.photo = true;
      userMsg.photoData = { mimeType: photo.mimeType, data: photo.data };
      photoCache[userMsg.t] = photo.dataUrl;
    }
    state.messages.push(userMsg);
    persist();
    box()?.append(renderMessage(userMsg));
  }
  waiting = true;
  typing(true);
  let ok = false;
  try {
    const ai = await askAI(hiddenTurn);
    waiting = false;
    typing(false);
    applyAI(ai, userMsg, opts);
    ok = true;
  } catch (e) {
    waiting = false;
    typing(false);
    console.warn(e);
    if (userMsg) {
      userMsg.failed = true;
      persist();
      renderChat();
      toast(e.message, true);
    } else {
      notice('ส่งไม่สำเร็จ: ' + e.message, true, 'ลองอีกครั้ง', () => run(null, hiddenTurn, null, opts));
    }
  } finally {
    if (userMsg && ok) delete userMsg.photoData;   // the model only sees each photo once
    busy = false;
    refreshSend();
    if (ok) showSuggestions();
  }
  return ok;
}

function send() {
  const text = input().value.trim();
  if ((!text && !pendingPhoto) || busy) return;
  const photo = pendingPhoto;
  const voice = lastInputWasVoice;
  input().value = '';
  lastInputWasVoice = false;
  clearPhoto();
  autoGrow();
  unlockSpeech();
  run(text, null, photo, { voice });
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
  const why = hours == null
    ? `This is the first time you (${char.name}) talk with the learner. Introduce yourself briefly with one or two details from your background, mention lightly that you are an AI character, and ask one easy question.`
    : `The learner just opened your chat again after about ${hours} hour(s). Message them first in your own way, and refer to something you remember if it fits. Do not repeat the greeting you used last time.`;
  run(null, `[App note, not from the user: it is ${local} for the learner. ${why} Set "language_feedback" to null.]`);
}

// ---------- role-play & focused practice (started from other pages) ----------
// scenario: an entry from engine/scenarios.js, or { custom: true, icon, th } for the learner's own idea.
export function startScene(scenario, charId) {
  if (busy) { toast('รอให้ตอบข้อความก่อนหน้าเสร็จก่อนนะ'); return; }
  if (charId && CHARACTER_IDS.includes(charId)) { settings.character = charId; saveSettings(); }
  const char = activeChar();
  let s = sessionOf(char.id);
  s = applyRole(s, char, scenario.custom ? 'scene' : roleForScenario(scenario, char), 'scenario');
  s.scenario = scenario.id || 'custom';
  s.t = Date.now();
  state.sessions[char.id] = s;
  state.scene = { id: scenario.custom ? null : scenario.id, icon: scenario.icon || '🎭', th: scenario.th, char: char.id, feedback: scenario.feedback || '', criteria: scenario.criteria || [] };
  logActivity('roleplay', `เริ่มสถานการณ์ ${scenario.th} กับ ${char.name}`);
  persist();
  showAll = false;
  if (location.hash !== '#chat') location.hash = '#chat'; else { renderHeader(); renderChat(); }
  unlockSpeech();
  run(null, `[App note, not from the user: the learner started the role-play "${scenario.th}". You are now in your scenario role. Start the scene with your first line in that role. Set "language_feedback" to null.]`);
}

function endScene() {
  const char = activeChar();
  if (busy || !state.scene || state.scene.char !== char.id) return;
  const scene = state.scene;
  state.scene = null;
  state.sessions[char.id] = applyRole(sessionOf(char.id), char, null, 'default');
  persist();
  renderHeader();
  const crit = scene.criteria?.length ? ` Judge mainly: ${scene.criteria.join(', ')}.` : '';
  const what = scene.feedback || `Give friendly feedback: what they did well, 2–3 useful ${settings.lang} phrases for this situation (with Thai meaning), and one thing to practise. Keep it short.${crit}`;
  run(null, `[App note, not from the user: the role-play "${scene.th}" has ended. Step out of the role and, as yourself (${char.name}, back to your usual role), ${what} Also set "score" to how well they handled it, 0–10. For THIS message only, write "message" in Thai (keep ${settings.lang} words and example sentences in ${settings.lang}). Set "language_feedback" to null.]`, null, { feedbackFor: scene });
}

export function practice(category, label) {
  location.hash = '#chat';
  unlockSpeech();
  run(null, `[App note, not from the user: the learner wants to practise "${category}" (${label}), one of their weak areas. Start a short, friendly mini-practice inside the chat, in your own style: ask ONE question or give ONE short task that makes them use this. After their answer, give feedback and the next one. Set "language_feedback" to null.]`);
}

export function quiz() {
  location.hash = '#chat';
  unlockSpeech();
  run(null, '[App note, not from the user: the learner tapped "quiz me". Give ONE short, friendly quiz question that practises one of their recent mistakes (fill-in-the-blank or "how would you say…"). Wait for their answer before giving the next one. Set "language_feedback" to null.]');
}

// ---------- photos ----------
async function preparePhoto(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('เปิดรูปนี้ไม่ได้'));
      i.src = url;
    });
    const scale = Math.min(1, PHOTO_MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    return { dataUrl, mimeType: 'image/jpeg', data: dataUrl.split(',')[1] };
  } finally { URL.revokeObjectURL(url); }
}
function clearPhoto() {
  pendingPhoto = null;
  $('preview').hidden = true;
  $('previewImg').removeAttribute('src');
  $('photoInput').value = '';
  refreshSend();
}

// ---------- input ----------
function autoGrow() { const i = input(); i.style.height = 'auto'; i.style.height = Math.min(i.scrollHeight, 130) + 'px'; }
function refreshSend() { const b = $('sendBtn'); if (b) b.disabled = busy || (!input().value.trim() && !pendingPhoto); }

export function initChat() {
  $('chatInput').addEventListener('input', () => { lastInputWasVoice = false; autoGrow(); refreshSend(); });
  $('chatInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(); }
  });
  $('sendBtn').addEventListener('click', send);
  $('micBtn').addEventListener('click', () => {
    if (listening) { stopListening(); return; }
    if (!canListen) { toast('เครื่องนี้ไม่รองรับการฟังเสียงในเบราว์เซอร์ ใช้ไมค์บนคีย์บอร์ด iPhone (Dictation) แทนได้', true); input().focus(); return; }
    const started = listen({
      onText: (t) => { input().value = t; lastInputWasVoice = true; autoGrow(); refreshSend(); },
      onEnd: () => { $('micBtn').classList.remove('on'); if (settings.autoSend && input().value.trim()) send(); },
      onError: (err) => {
        if (err === 'not-allowed' || err === 'service-not-allowed') toast('ไม่ได้รับอนุญาตให้ใช้ไมค์ — ไปที่ การตั้งค่า > Safari > ไมโครโฟน แล้วเลือก "อนุญาต"', true);
      },
    });
    $('micBtn').classList.toggle('on', started);
  });
  $('photoBtn').addEventListener('click', () => { unlockSpeech(); $('photoInput').click(); });
  $('previewClear').addEventListener('click', clearPhoto);
  $('photoInput').addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      pendingPhoto = await preparePhoto(file);
      $('previewImg').src = pendingPhoto.dataUrl;
      $('preview').hidden = false;
      input().focus();
    } catch (err) { clearPhoto(); toast(err.message, true); }
    refreshSend();
  });
  $('sceneEnd').addEventListener('click', endScene);
  $('roleSelect').addEventListener('change', (e) => setRole(e.target.value));
  $('roleReset').addEventListener('click', () => setRole(activeChar().defaultRole));
  $('quota').addEventListener('click', () => { location.hash = '#settings'; });
  on('usage', renderQuota);
  on('settings', renderHeader);
  renderHeader();
}

export const isBusy = () => busy;
