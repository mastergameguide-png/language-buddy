// AI conversation: messages, inline feedback, new words, photos, voice, role-play bar.
import { $, el, h, icon, fmtTime, toast } from '../util.js';
import {
  settings, state, persist, emit, on, addMistake, addWord, logActivity, CATEGORIES, levelShort, flag,
} from '../store.js';
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
    say.addEventListener('click', () => speak(c.natural || c.right));
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
    bubble.addEventListener('click', () => speak(m.text));
  }
  row.append(bubble);
  if (m.correction) row.append(feedbackCard(m.correction));
  if (m.newWord) row.append(el('div', 'newword', `📘 คำใหม่: ${m.newWord.word}${m.newWord.meaning ? ' — ' + m.newWord.meaning : ''} · เก็บในคลังคำแล้ว`));
  const meta = el('div', 'meta', fmtTime(m.t) + (m.ai === 'groq' ? ' · Groq' : '') + (m.voice ? ' · 🎤' : ''));
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
  const msgs = state.messages;
  const start = showAll ? 0 : Math.max(0, msgs.length - SHOW_LAST);
  if (start > 0) {
    const more = h('button', { type: 'button', class: 'btn sm ghost' }, `แสดงข้อความก่อนหน้า (${start})`);
    more.addEventListener('click', () => { showAll = true; renderChat(); });
    b.append(more);
  }
  for (const m of msgs.slice(start)) b.append(renderMessage(m));
  if (!settings.workerUrl) notice('ยังไม่ได้ใส่ลิงก์ Cloudflare Worker — ใส่ในหน้าตั้งค่าก่อนเริ่มคุย', false, 'เปิดตั้งค่า', () => { location.hash = '#settings'; });
  if (waiting) typing(true);
  scrollDown();
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

export function renderHeader() {
  if (!$('buddyName')) return;
  $('buddyName').textContent = settings.name || 'Buddy';
  $('avatar').textContent = (settings.name || 'B').trim().charAt(0).toUpperCase();
  $('buddyStatus').textContent = `${settings.lang} ${flag()} · ${levelShort()}`;
  renderScene();
  renderQuota();
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
  bar.hidden = !state.scene;
  if (state.scene) $('sceneText').textContent = `${state.scene.icon} กำลังฝึก: ${state.scene.th}`;
}

// ---------- talking to the AI ----------
function applyAI(ai, userMsg, opts) {
  if (userMsg) {
    if (ai.correction) { userMsg.correction = ai.correction; addMistake(ai.correction); }
    recordMessage(userMsg.text, !!ai.correction, userMsg.voice);
    if (today().msgs === 1) logActivity('chat', `เริ่มคุยกับ ${settings.name} วันนี้`);
  }
  for (const f of ai.remember) if (!state.facts.some((x) => x.toLowerCase() === f.toLowerCase())) state.facts.push(f);
  state.facts = state.facts.slice(-40);
  const botMsg = { role: 'model', text: ai.reply, t: Date.now() };
  if (ai.provider === 'groq') botMsg.ai = 'groq';
  if (ai.newWord && addWord(ai.newWord)) {
    botMsg.newWord = { word: ai.newWord.word, meaning: ai.newWord.meaning };
    recordWord();
    logActivity('word', `คำใหม่: ${ai.newWord.word}`);
  }
  if (opts.feedbackFor) {
    state.results.push({ t: Date.now(), icon: opts.feedbackFor.icon, scene: opts.feedbackFor.th, score: ai.score, summary: ai.reply.slice(0, 400) });
    state.results = state.results.slice(-50);
    logActivity('roleplay', `จบสถานการณ์ ${opts.feedbackFor.th}${ai.score != null ? ` · ${ai.score}/10` : ''}`);
  }
  state.messages.push(botMsg);
  state.lastSeen = Date.now();
  persist();
  renderChat();
  emit('state');
  if (settings.voice) speak(ai.reply);
  syncPush(false);
}

// userText/photo: a new user message. hiddenTurn: an [App note] instruction with no visible
// user message. opts.retryMsg: re-ask for a user message whose reply failed.
export async function run(userText, hiddenTurn, photo, opts = {}) {
  if (busy) { toast('รอให้ตอบข้อความก่อนหน้าเสร็จก่อนนะ'); return; }
  busy = true;
  refreshSend();
  let userMsg = opts.retryMsg || null;
  if (userMsg) { delete userMsg.failed; renderChat(); }
  else if (userText || photo) {
    userMsg = { role: 'user', text: userText || '', t: Date.now() };
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

// Buddy writes first when the chat is opened after a while.
export function maybeGreet() {
  if (!settings.workerUrl || busy) return;
  const gap = Date.now() - (state.lastSeen || 0);
  if (state.messages.length && gap < GREET_AFTER_MS) return;
  const hours = state.lastSeen ? Math.round(gap / 3600000) : null;
  const local = new Date().toLocaleString('en-GB', { weekday: 'long', hour: '2-digit', minute: '2-digit' });
  const why = hours == null
    ? 'This is the very first time you meet the user. Introduce yourself briefly and ask something easy to get to know them.'
    : `The user just opened the chat again after about ${hours} hour(s). Message them first like a friend would — refer to something you remember or something from your last chat if it fits.`;
  run(null, `[App note, not from the user: it is ${local} for the user. ${why} Set "correction" to null.]`);
}

// ---------- role-play & focused practice (started from other pages) ----------
export function startScene(scene) {
  if (busy) { toast('รอให้ตอบข้อความก่อนหน้าเสร็จก่อนนะ'); return; }
  state.scene = { icon: scene.icon, th: scene.th, en: scene.en, feedback: scene.feedback || '' };
  logActivity('roleplay', `เริ่มสถานการณ์ ${scene.th}`);
  persist();
  location.hash = '#chat';
  renderScene();
  unlockSpeech();
  run(null, `[App note, not from the user: the user chose a role-play. ${scene.en} Start the scene now with your first line in character. Set "correction" to null.]`);
}

function endScene() {
  if (busy || !state.scene) return;
  const scene = state.scene;
  state.scene = null;
  persist();
  renderScene();
  const what = scene.feedback || `Give friendly feedback: what they did well, 2–3 useful ${settings.lang} phrases for this situation (with Thai meaning), and one thing to practise. Keep it short.`;
  run(null, `[App note, not from the user: the role-play "${scene.th}" has ended. Step out of the role and, as ${settings.name}, ${what} Also set "score" to how well they handled it, 0–10. For THIS message only, write "reply" in Thai (keep ${settings.lang} words and example sentences in ${settings.lang}). Set "correction" to null.]`, null, { feedbackFor: scene });
}

export function practice(category, label) {
  location.hash = '#chat';
  unlockSpeech();
  run(null, `[App note, not from the user: the user wants to practise "${category}" (${label}), one of their weak areas. Start a short, friendly mini-practice inside the chat: ask ONE question or give ONE short task that makes them use this. After their answer, correct it and give the next one. Keep it playful. Set "correction" to null.]`);
}

export function quiz() {
  location.hash = '#chat';
  unlockSpeech();
  run(null, '[App note, not from the user: the user tapped "quiz me". Give ONE short, friendly quiz question that practises one of their recent mistakes (fill-in-the-blank or "how would you say…"). Wait for their answer before giving the next one. Set "correction" to null.]');
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
  $('quota').addEventListener('click', () => { location.hash = '#settings'; });
  on('usage', renderQuota);
  on('settings', renderHeader);
  renderHeader();
}

export const isBusy = () => busy;
