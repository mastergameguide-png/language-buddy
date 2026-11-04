// Chat screen: messages, inline feedback, reply ideas and hints, the Thai→English helper, photos,
// voice, and the role / mode / mood bar. Talking to the AI lives in ../conversation.js; this file
// only draws and reacts to its events.
import { $, el, h, icon, fmtTime, toast } from '../util.js';
import { settings, state, persist, on, CATEGORIES, levelShort, flag, saveSettings, isEnglish, activeChar, activeCharId, sessionOf, threadOf } from '../store.js';
import { ROLES } from '../engine/characters.js';
import { EMOTION_UI } from '../engine/emotion.js';
import { applyRole } from '../engine/roles.js';
import { MODES, MODE_IDS, ROLEPLAY_MODE, modeOf } from '../engine/modes.js';
import { scenarioById, VARIANTS } from '../engine/scenarios.js';
import { avatarEl } from './avatar.js';
import { todayUsage, nextReset, askHelper } from '../ai.js';
import { speak, unlockSpeech, listen, stopListening, listening, canListen } from '../speech.js';
import { run, isBusy, isWaiting, setCharacter, maybeGreet, endScene, unseenCorrections, markCorrectionsSeen } from '../conversation.js';

export { maybeGreet };

const PHOTO_MAX_SIDE = 1024;
const SHOW_LAST = 150;
const THAI = /[฀-๿]/;

let pendingPhoto = null;           // { dataUrl, mimeType, data } waiting to be sent
let lastInputWasVoice = false;
let showAll = false;
let hint = { t: 0, level: 0 };     // how far the learner opened the hint ladder for the latest message
let helperText = '';               // the sentence the learner took from the Thai→English helper
const photoCache = {};             // message time -> dataUrl; photos are not saved to storage (too big)

const box = () => $('messages');
const input = () => $('chatInput');
const scrollDown = () => requestAnimationFrame(() => { const b = box(); if (b) b.scrollTop = b.scrollHeight; });
const lastBot = () => { const t = threadOf(); const m = t[t.length - 1]; return m && m.role === 'model' ? m : null; };

function fillInput(text) { input().value = text; autoGrow(); refreshSend(); refreshHelper(); input().focus(); }

// ---------- rendering ----------
const FIX_KIND = {
  error: { icon: '✏️', chip: (c) => CATEGORIES[c.category] || 'อื่นๆ' },
  unnatural: { icon: '🗣️', chip: () => 'ฟังเป็นธรรมชาติกว่า' },
  style: { icon: '💡', chip: () => 'ทางเลือก (ไม่ผิด)' },
};

function feedbackCard(c) {
  const kind = FIX_KIND[c.type] || FIX_KIND.error;
  const wrap = el('div', 'feedback' + (c.type === 'style' ? ' style-tip' : ''));
  const more = el('div', 'more');
  more.hidden = settings.correctionTiming !== 'immediate';
  const toggle = h('button', { type: 'button', 'aria-expanded': String(!more.hidden) },
    el('span', '', kind.icon), el('span', 'fix-right grow', c.right), el('span', 'chip', kind.chip(c)));
  toggle.addEventListener('click', () => {
    more.hidden = !more.hidden;
    toggle.setAttribute('aria-expanded', String(!more.hidden));
  });
  more.append(...fixDetails(c));
  wrap.append(toggle, more);
  return wrap;
}

function fixDetails(c) {
  const p = (label, text) => (text ? [el('span', 'label', label), el('p', '', text)] : []);
  const line = el('p');
  line.append(el('span', 'wrong', c.wrong), ' → ', el('span', 'fix-right', c.right));
  const out = [line, ...p('ทำไม', c.why), ...p('พูดแบบเจ้าของภาษา', c.natural), ...p('แปล', c.th), ...p('ตัวอย่างเพิ่ม', c.example)];
  if (c.natural || c.right) {
    const say = h('button', { type: 'button', class: 'btn sm ghost', style: 'margin-top:8px' }, icon('speaker'), 'ฟังประโยคที่ถูก');
    say.addEventListener('click', () => speak(c.natural || c.right, { plain: true }));
    out.push(say);
  }
  return out;
}

function renderMessage(m) {
  const row = el('div', 'msg ' + (m.role === 'user' ? 'me' : 'bot'));
  const bubble = el('div', 'bubble');
  if (m.photo) {
    if (photoCache[m.t]) bubble.append(h('img', { src: photoCache[m.t], alt: 'รูปที่ส่ง' }));
    else bubble.append(el('div', 'xs', '📷 ส่งรูป'));
  }
  if (m.text) bubble.append(m.text);
  row.append(bubble);
  if (m.role === 'model') {
    // A real button so replaying works from the keyboard too.
    const play = h('button', { type: 'button', class: 'replay', 'aria-label': 'ฟังข้อความนี้อีกครั้ง' }, icon('speaker'));
    play.addEventListener('click', () => speak(m.text, { emotion: m.emotion }));
    bubble.addEventListener('click', (e) => { if (e.target === bubble) speak(m.text, { emotion: m.emotion }); });
    row.append(play);
  }
  // With "show at the end", a correction stays hidden until the learner opens the summary.
  if (m.correction && (m.correction.seen !== false || settings.correctionTiming !== 'end')) row.append(feedbackCard(m.correction));
  if (m.newWord) row.append(el('div', 'newword', `📘 คำใหม่: ${m.newWord.word}${m.newWord.meaning ? ' — ' + m.newWord.meaning : ''} · เก็บในคลังคำแล้ว`));
  const role = m.as && m.as !== activeChar().defaultRole && ROLES[m.as] ? ' · 🎭 ' + ROLES[m.as].th : '';
  const emo = m.emotion && EMOTION_UI[m.emotion.state] ? ' · ' + EMOTION_UI[m.emotion.state].emoji : '';
  const tags = (m.hint ? ' · 💡' : '') + (m.helper ? ' · 🇹🇭→EN' : '');
  row.append(el('div', 'meta', fmtTime(m.t) + role + emo + (m.ai === 'groq' ? ' · Groq' : '') + (m.voice ? ' · 🎤' : '') + tags));
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
  if (!msgs.length && !isWaiting()) b.append(introCard(activeChar()));
  const start = showAll ? 0 : Math.max(0, msgs.length - SHOW_LAST);
  if (start > 0) {
    const more = h('button', { type: 'button', class: 'btn sm ghost' }, `แสดงข้อความก่อนหน้า (${start})`);
    more.addEventListener('click', () => { showAll = true; renderChat(); });
    b.append(more);
  }
  for (const m of msgs.slice(start)) b.append(renderMessage(m));
  showHelp();
  if (!settings.workerUrl) notice('ยังไม่ได้ใส่ลิงก์ Cloudflare Worker — ใส่ในหน้าตั้งค่าก่อนเริ่มคุย', false, 'เปิดตั้งค่า', () => { location.hash = '#settings'; });
  if (isWaiting()) typing(true);
  renderFixButton();
  scrollDown();
}

// ---------- help under the latest message: reply ideas + hint ladder ----------
function showHelp() {
  const b = box();
  if (!b) return;
  b.querySelector('.suggest-box')?.remove();
  const m = lastBot();
  if (!m || isBusy() || isWaiting() || (!m.suggestions?.length && !m.hints)) return;
  if (hint.t !== m.t) hint = { t: m.t, level: 0 };
  b.append(helpBox(m));
  scrollDown();
}

function helpBox(m) {
  const wrap = el('div', 'suggest-box');
  if (m.suggestions?.length) {
    wrap.append(el('div', 'suggest-head', '💡 ลองตอบ — แตะเพื่อใส่ในช่องพิมพ์ แก้ได้ก่อนส่ง'));
    for (const s of m.suggestions) {
      const btn = h('button', { type: 'button', class: 'suggest' }, s.label ? el('span', 'suggest-tag', s.label) : '', el('span', '', s.text));
      // A ready-made answer counts like the last hint step.
      btn.addEventListener('click', () => { hint.level = Math.max(hint.level, 4); fillInput(s.text); });
      wrap.append(btn);
    }
  }
  if (m.hints) wrap.append(hintLadder(m.hints, wrap));
  return wrap;
}

// Step by step: 1 clue → 2 words → 3 sentence pattern → 4 full example.
function hintLadder(hs, wrap) {
  const steps = [
    hs.clue && (() => el('div', 'hint-step', `1 · ${hs.clue}`)),
    hs.vocab.length && (() => {
      const row = h('div', { class: 'hint-step chips' }, el('span', 'xs muted', '2 · คำที่ใช้ได้:'));
      for (const v of hs.vocab) {
        const c = h('button', { type: 'button', class: 'chip' }, v.th ? `${v.word} — ${v.th}` : v.word);
        c.addEventListener('click', () => { const cur = input().value.trim(); fillInput(cur ? `${cur} ${v.word}` : v.word); });
        row.append(c);
      }
      return row;
    }),
    hs.structure && (() => {
      const c = h('button', { type: 'button', class: 'suggest' }, el('span', 'suggest-tag', '3 · รูปประโยค'), el('span', '', hs.structure));
      c.addEventListener('click', () => fillInput(hs.structure.replace(/_{2,}/g, '…')));
      return c;
    }),
    hs.example && (() => {
      const say = h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'ฟังตัวอย่าง' }, icon('speaker'));
      say.addEventListener('click', () => speak(hs.example, { plain: true }));
      const use = h('button', { type: 'button', class: 'btn sm' }, 'ใช้ประโยคนี้');
      use.addEventListener('click', () => fillInput(hs.example));
      return h('div', { class: 'hint-step' }, el('div', '', `4 · ${hs.example}`), hs.example_th ? el('div', 'xs muted', hs.example_th) : '', h('div', { class: 'row' }, say, use));
    }),
  ].filter(Boolean);
  const box2 = el('div', 'hint-ladder');
  const shown = el('div', 'hint-shown');
  const next = h('button', { type: 'button', class: 'btn sm ghost' });
  const draw = () => {
    shown.textContent = '';
    for (const s of steps.slice(0, hint.level)) shown.append(s());
    next.hidden = hint.level >= steps.length;
    next.textContent = hint.level === 0 ? '🆘 ไม่รู้จะตอบยังไง — ขอคำใบ้' : `ใบ้เพิ่ม (${hint.level}/${steps.length})`;
  };
  next.addEventListener('click', () => { hint.level = Math.min(steps.length, hint.level + 1); draw(); scrollDown(); });
  draw();
  box2.append(shown, next);
  return box2;
}

// ---------- "with show at the end": the correction summary ----------
function renderFixButton() {
  const btn = $('fixBtn');
  if (!btn) return;
  const n = settings.correctionTiming === 'end' ? unseenCorrections().length : 0;
  btn.hidden = !n;
  btn.textContent = `✏️ คำแก้ ${n}`;
}
function showFixSummary() {
  const list = unseenCorrections();
  if (!list.length) return;
  const card = h('div', { class: 'card fix-summary' }, el('h3', '', `สรุปคำแก้ (${list.length})`));
  for (const m of list) {
    const kind = FIX_KIND[m.correction.type] || FIX_KIND.error;
    card.append(h('div', { class: 'fix-item' }, el('div', 'xs muted', `${kind.icon} ${kind.chip(m.correction)} · ${fmtTime(m.t)}`), ...fixDetails(m.correction)));
  }
  markCorrectionsSeen();
  box()?.append(card);
  renderFixButton();
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
  renderFixButton();
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
  // Mode: role-play takes over while a scenario runs.
  const ms = $('modeSelect');
  const inScene = !!(state.scene && state.scene.char === char.id);
  const ids = MODE_IDS.filter((id) => !MODES[id].englishOnly || isEnglish());
  ms.replaceChildren(...(inScene ? [Object.assign(el('option', '', `${ROLEPLAY_MODE.icon} ${ROLEPLAY_MODE.th}`), { value: 'roleplay' })]
    : ids.map((id) => Object.assign(el('option', '', `${MODES[id].icon} ${MODES[id].th}`), { value: id }))));
  ms.value = inScene ? 'roleplay' : modeOf(settings.mode, isEnglish());
  ms.disabled = inScene;
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

function setMode(id) {
  settings.mode = modeOf(id, isEnglish());
  saveSettings();
  toast(`โหมด: ${MODES[settings.mode].th} — ${MODES[settings.mode].desc}`);
}

// Talk to another character (each has its own chat, memory and mood).
export function switchCharacter(id) {
  if (!setCharacter(id)) return;
  showAll = false;
  clearHelper();
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

// The running scene: title, difficulty and how far it has got (stage names from the scenario data).
function renderScene() {
  const bar = $('sceneBar');
  if (!bar) return;
  const sc = state.scene && state.scene.char === activeCharId() ? state.scene : null;
  bar.hidden = !sc;
  if (!sc) return;
  const v = sc.variant && sc.variant !== 'normal' ? ` · ${VARIANTS[sc.variant]?.th || ''}` : '';
  $('sceneText').textContent = `${sc.icon} กำลังฝึก: ${sc.th}${v}`;
  const steps = scenarioById(sc.id)?.steps || [];
  $('sceneProgWrap').hidden = !sc.total;
  $('sceneProg').style.width = sc.total ? `${Math.round((sc.step / sc.total) * 100)}%` : '0';
  const cur = steps[Math.min(steps.length - 1, Math.max(0, sc.step - 1))];
  $('sceneStep').textContent = sc.done ? '✅ ทำครบตามเป้าหมายแล้ว — กดจบเพื่อรับคะแนนและคำแนะนำ'
    : sc.total ? `ขั้น ${sc.step}/${sc.total}${sc.step && cur ? ` · ${cur.th}` : ' · เริ่มต้น'}` : '';
  $('sceneEnd').classList.toggle('primary', !!sc.done);
  bar.classList.toggle('done', !!sc.done);
}

// ---------- Thai → English helper ----------
function refreshHelper() {
  const b = $('thaiBtn');
  if (b) b.hidden = !THAI.test(input().value) || isBusy();
}
function clearHelper() { box()?.querySelector('.helper-box')?.remove(); }
async function runHelper() {
  const text = input().value.trim();
  if (!text || isBusy()) return;
  const btn = $('thaiBtn');
  btn.disabled = true;
  btn.textContent = '…';
  clearHelper();
  try {
    const options = await askHelper(text);
    if (!options.length) { toast('ยังแปลไม่ได้ ลองพิมพ์ใหม่อีกครั้ง', true); return; }
    const wrap = h('div', { class: 'suggest-box helper-box' }, el('div', 'suggest-head', `🇹🇭→${isEnglish() ? '🇬🇧' : settings.lang}: "${text.slice(0, 60)}" พูดได้แบบนี้ — แตะเพื่อใช้`));
    for (const o of options) {
      const b = h('button', { type: 'button', class: 'suggest' }, o.label ? el('span', 'suggest-tag', o.label) : '', h('span', {}, o.text, o.note ? el('small', 'muted', ' — ' + o.note) : ''));
      b.addEventListener('click', () => { helperText = o.text; fillInput(o.text); clearHelper(); });
      wrap.append(b);
    }
    box()?.append(wrap);
    scrollDown();
  } catch (e) {
    toast(e.message, true);
  } finally {
    btn.disabled = false;
    btn.textContent = '🇹🇭→EN';
    refreshHelper();
  }
}

// ---------- input ----------
function send() {
  const text = input().value.trim();
  if ((!text && !pendingPhoto) || isBusy()) return;
  const photo = pendingPhoto;
  const voice = lastInputWasVoice;
  const m = lastBot();
  const hintLevel = m && hint.t === m.t ? hint.level : 0;
  const helper = !!helperText && text === helperText;
  input().value = '';
  lastInputWasVoice = false;
  helperText = '';
  clearPhoto();
  clearHelper();
  autoGrow();
  refreshHelper();
  unlockSpeech();
  run(text, null, photo, { voice, hint: hintLevel || 0, helper });
}

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

function autoGrow() { const i = input(); i.style.height = 'auto'; i.style.height = Math.min(i.scrollHeight, 130) + 'px'; }
function refreshSend() { const b = $('sendBtn'); if (b) b.disabled = isBusy() || (!input().value.trim() && !pendingPhoto); }

// ---------- conversation events ----------
const here = (charId) => location.hash === '#chat' && activeCharId() === charId;
function listenToConversation() {
  on('chat:busy', () => { refreshSend(); refreshHelper(); });
  on('chat:sent', ({ msg, photo }) => {
    if (photo) photoCache[msg.t] = photo.dataUrl;
    box()?.querySelector('.suggest-box')?.remove();
    box()?.append(renderMessage(msg));
    scrollDown();
  });
  on('chat:waiting', (w) => { if (w) box()?.querySelector('.suggest-box')?.remove(); typing(w); });
  on('chat:reply', ({ charId }) => { if (here(charId)) { renderHeader(); renderChat(); } });
  on('chat:failed', ({ error }) => { renderChat(); toast(error, true); });
  on('chat:error', ({ error, retry }) => notice('ส่งไม่สำเร็จ: ' + error, true, 'ลองอีกครั้ง', retry));
  on('chat:open', () => { showAll = false; if (location.hash !== '#chat') location.hash = '#chat'; else { renderHeader(); renderChat(); } });
}

export function initChat() {
  $('chatInput').addEventListener('input', () => { lastInputWasVoice = false; autoGrow(); refreshSend(); refreshHelper(); });
  $('chatInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(); }
  });
  $('sendBtn').addEventListener('click', send);
  $('thaiBtn').addEventListener('click', runHelper);
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
  $('modeSelect').addEventListener('change', (e) => setMode(e.target.value));
  $('roleReset').addEventListener('click', () => setRole(activeChar().defaultRole));
  $('fixBtn').addEventListener('click', showFixSummary);
  $('quota').addEventListener('click', () => { location.hash = '#settings'; });
  on('usage', renderQuota);
  on('settings', renderHeader);
  listenToConversation();
  renderHeader();
}
