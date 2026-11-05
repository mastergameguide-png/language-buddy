// Settings & profile form, notification schedule, backup/restore.
import { $, el, h, toast, ago } from '../util.js';
import {
  settings, state, push, setSettings, saveSettings, replaceState, persist, emit, on,
  LANGS, CEFR, IELTS, DEFAULT_SETTINGS, DEFAULT_WORKER, LIMITS, cefrOf, logActivity, storageReport,
} from '../store.js';
import { todayUsage } from '../ai.js';
import { pushStatus, enablePush, testPush, disablePush, syncPush, hh } from '../push.js';
import { sync, runSync, startSync, stopSync, deleteServerCopy, newCode, cleanCode, showCode } from '../sync.js';

const f = (id) => $(id);

// English offers IELTS bands as well as CEFR; other languages use CEFR only.
// Also used by the first-run guide (onboarding.js).
export function fillLevelSelect(sel, lang, current) {
  sel.textContent = '';
  if (lang === 'English') {
    const g = el('optgroup'); g.label = 'IELTS';
    for (const [band, cefr] of IELTS) { const o = el('option', '', `IELTS ${band} (${cefr})`); o.value = 'IELTS ' + band; g.append(o); }
    sel.append(g);
  }
  const g = el('optgroup'); g.label = 'CEFR';
  for (const [lv, th] of Object.entries(CEFR)) { const o = el('option', '', `${lv} ${th}`); o.value = lv; g.append(o); }
  sel.append(g);
  sel.value = lang === 'English' || !/^IELTS /.test(current) ? current : cefrOf(current);
  if (!sel.value) sel.value = cefrOf(current) || 'B1';
}
function fillLevels(lang, current) {
  fillLevelSelect(f('sLevel'), lang, current);
  f('variantBox').hidden = lang !== 'English';
}

// Says which server is in use. An empty field means the built-in one.
function renderWorkerState() {
  const url = f('sWorker').value.trim();
  let host = '';
  try { host = new URL(url).host; } catch {}
  f('workerState').textContent = url && host ? `กำลังใช้เซิร์ฟเวอร์ของคุณ: ${host}` : url ? 'ที่อยู่นี้ยังไม่ถูกต้อง' : 'กำลังใช้เซิร์ฟเวอร์เริ่มต้น';
}

function showSchedule() {
  f('sPushMode').value = settings.pushMode;
  f('sFrom').value = settings.pushFrom;
  f('sTo').value = settings.pushTo;
  f('sPerDay').value = String(settings.perDay || 2);
  ['sTime1', 'sTime2', 'sTime3'].forEach((id, i) => { f(id).value = (settings.pushTimes || [])[i] || ''; });
  f('pushRandom').hidden = settings.pushMode === 'fixed';
  f('pushFixed').hidden = settings.pushMode !== 'fixed';
}
function readSchedule() {
  const from = Number(f('sFrom').value);
  let to = Number(f('sTo').value);
  if (to <= from) to = Math.min(24, from + 1);
  settings.pushMode = f('sPushMode').value === 'fixed' ? 'fixed' : 'random';
  settings.pushFrom = from;
  settings.pushTo = to;
  settings.perDay = Number(f('sPerDay').value) || 2;
  settings.pushTimes = [...new Set(['sTime1', 'sTime2', 'sTime3'].map((id) => f(id).value).filter(Boolean))].sort();
  saveSettings();
}

function renderPush() {
  const s = pushStatus();
  f('pushStatus').textContent = s.text;
  f('pushOn').hidden = !s.canOn;
  f('pushTest').hidden = f('pushOff').hidden = !push.enabled;
}

function renderSync() {
  const on = !!sync.code;
  f('syncOff').hidden = on;
  f('syncOnBox').hidden = !on;
  if (on) f('syncCode').value = showCode(sync.code);
  f('syncStatus').textContent = !settings.workerUrl ? 'ใส่ที่อยู่เซิร์ฟเวอร์ก่อน'
    : !on ? 'ยังไม่ได้เปิด — ข้อมูลอยู่ในเครื่องนี้เท่านั้น'
    : sync.error ? '⚠️ ' + sync.error
    : sync.last ? `✅ เปิดอยู่ · ซิงก์ล่าสุด ${ago(sync.last)}` : 'กำลังซิงก์ครั้งแรก…';
}

async function syncAction(btn, job, done) {
  btn.disabled = true;
  try { const ok = await job(); if (ok !== false && done) toast(done); else if (ok === false) toast(sync.error || 'ซิงก์ไม่สำเร็จ', true); }
  catch (e) { toast(e.message || 'ไม่สำเร็จ', true); }
  finally { btn.disabled = false; renderSync(); }
}

// How much space the data uses, the caps, and anything that was ever trimmed at a cap.
function renderStorage() {
  const box = f('storageInfo');
  if (!box) return;
  const r = storageReport();
  const pct = Math.min(100, Math.round((r.kb / r.limitKb) * 100));
  box.textContent = '';
  box.append(
    el('div', 'small', `ใช้พื้นที่ประมาณ ${r.kb.toLocaleString('th-TH')} KB จากราว ${r.limitKb.toLocaleString('th-TH')} KB ที่เบราว์เซอร์ให้ (${pct}%)`),
    h('div', { class: 'bar' + (pct >= 85 ? ' bad' : pct >= 60 ? ' warn' : ''), style: 'margin:6px 0' }, h('i', { style: `width:${pct}%` })),
  );
  box.append(el('div', 'xs muted', `แชต ${r.counts.messages} ข้อความ (เก็บล่าสุด ${LIMITS.messagesPerChar} ข้อความต่อตัวละคร) · คำศัพท์ ${r.counts.vocab} · สมุดผิด ${r.counts.mistakes} · ผลสถานการณ์ ${r.counts.results}`));
  const labels = { messages: 'ข้อความแชตเก่า', vocab: 'คำศัพท์', mistakes: 'ข้อผิด', results: 'ผลสถานการณ์' };
  const gone = Object.entries(r.trimmed).filter(([, n]) => n > 0).map(([k, n]) => `${labels[k]} ${n}`);
  if (gone.length) box.append(el('div', 'xs warn-text', `⚠️ เคยลบของเก่าที่เกินเพดานไปแล้ว: ${gone.join(' · ')} — ส่งออกข้อมูลสำรองไว้เป็นระยะเพื่อเก็บทั้งหมด`));
  if (pct >= 85) box.append(el('div', 'xs warn-text', 'พื้นที่ใกล้เต็ม — ส่งออกข้อมูลสำรอง แล้วกด "ล้างแชต" เพื่อคืนพื้นที่ (คำศัพท์และสมุดผิดยังอยู่)'));
}

export function fillSettings() {
  f('sWorker').value = settings.workerUrl === DEFAULT_WORKER ? '' : settings.workerUrl;
  renderWorkerState();
  const u = todayUsage();
  f('usageNow').textContent = `ใช้วันนี้: Gemini ${u.requests} ครั้ง` + (u.groq ? ` · Groq ${u.groq}` : '') + (u.photos ? ` · รูป ${u.photos}` : '') + (u.out ? ' · Gemini หมดแล้ววันนี้' : '');
  f('sAccess').value = settings.accessCode;
  f('sLang').value = settings.lang;
  fillLevels(settings.lang, settings.level);
  f('sVariant').value = settings.variant || 'American';
  f('sName').value = settings.name;
  f('sPersona').value = settings.persona;
  f('sLearner').value = settings.learnerName;
  f('sGoalText').value = settings.goalText;
  f('sGoalMin').value = settings.goalMinutes;
  f('sGoalMsg').value = settings.goalMessages;
  f('sGoalRev').value = settings.goalReviews;
  f('sFeedback').value = settings.feedback;
  f('sTiming').value = settings.correctionTiming || 'after_turn';
  f('sLength').value = settings.length || 'normal';
  f('sTeach').value = settings.teaching || 'medium';
  f('sTheme').value = settings.theme;
  f('sRate').value = settings.rate;
  f('sLimit').value = settings.dailyLimit || '';
  f('sAi').value = settings.ai || 'auto';
  f('sVoice').checked = settings.voice;
  f('sAutoSend').checked = settings.autoSend;
  f('sAdaptVoice').checked = settings.adaptiveVoice !== false;
  f('sMemLearner').checked = settings.memoryLearner !== false;
  f('sMemChar').checked = settings.memoryCharacter !== false;
  showSchedule();
  renderPush();
  renderSync();
  renderStorage();
  renderUndo();
}

const int = (id, min, max, dflt) => {
  const v = Math.floor(Number(f(id).value));
  return Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : dflt;
};

// A sticky row of buttons that scroll to each settings section (built from the cards' headings,
// so a new section appears here by itself). Buttons, not links: the hash is the app's router.
function buildJumpBar() {
  const form = f('settingsForm');
  if (!form || form.querySelector('.set-jump')) return;
  const bar = el('nav', 'set-jump');
  bar.setAttribute('aria-label', 'หมวดการตั้งค่า');
  const row = el('div', 'chips');
  for (const card of form.querySelectorAll('.set-group')) {
    const title = card.querySelector('h3');
    if (!title) continue;
    const b = el('button', 'chip', title.textContent.replace(/\s*\(.*\)\s*$/, '').replace(/^⚙️ ตั้งค่า/, '⚙️ '));
    b.type = 'button';
    // The advanced section is a <details>: open it first so the person lands inside it.
    const target = card.querySelector('summary') || title;
    b.addEventListener('click', () => {
      if (card.tagName === 'DETAILS') card.open = true;
      card.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (target === title) title.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
    });
    row.append(b);
  }
  bar.append(row);
  form.prepend(bar);
}

// The page's security policy only lets the app talk to the built-in server (and localhost for
// development). Another https server works only after its domain is added to connect-src.
function ownWorkerBlocked(url) {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.origin !== new URL(DEFAULT_WORKER).origin && !/^(localhost|127\.0\.0\.1)$/.test(u.hostname);
  } catch { return false; }
}

export function initSettings() {
  buildJumpBar();
  for (const [key, v] of Object.entries(LANGS)) { const o = el('option', '', v.label); o.value = key; f('sLang').append(o); }
  for (let h = 0; h <= 24; h++) {
    if (h < 24) { const o = el('option', '', hh(h)); o.value = h; f('sFrom').append(o); }
    if (h > 0) { const o = el('option', '', h === 24 ? '24:00 (เที่ยงคืน)' : hh(h)); o.value = h; f('sTo').append(o); }
  }
  f('sLang').addEventListener('change', () => fillLevels(f('sLang').value, f('sLevel').value));
  f('sTheme').addEventListener('change', () => applyTheme(f('sTheme').value));
  f('sWorker').addEventListener('input', renderWorkerState);

  // Save on submit (fires right away in every browser).
  f('settingsForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const url = f('sWorker').value.trim();
    if (url && !/^https:\/\/[^\s]+$/i.test(url) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//i.test(url)) { toast('ที่อยู่เซิร์ฟเวอร์ต้องขึ้นต้นด้วย https://', true); f('sWorker').focus(); return; }
    const hadWorker = !!settings.workerUrl;
    setSettings({
      ...settings,
      workerUrl: url || DEFAULT_WORKER,   // empty = the built-in server
      accessCode: f('sAccess').value.trim().slice(0, 100),
      lang: f('sLang').value,
      level: f('sLevel').value,
      variant: f('sVariant').value,
      name: f('sName').value.trim().slice(0, 20) || DEFAULT_SETTINGS.name,
      persona: f('sPersona').value.trim().slice(0, 400) || DEFAULT_SETTINGS.persona,
      learnerName: f('sLearner').value.trim().slice(0, 40),
      goalText: f('sGoalText').value.trim().slice(0, 200),
      goalMinutes: int('sGoalMin', 1, 240, 15),
      goalMessages: int('sGoalMsg', 1, 200, 10),
      goalReviews: int('sGoalRev', 1, 200, 10),
      feedback: f('sFeedback').value === 'detailed' ? 'detailed' : 'gentle',
      correctionTiming: ['immediate', 'after_turn', 'end'].includes(f('sTiming').value) ? f('sTiming').value : 'after_turn',
      length: ['short', 'normal', 'long'].includes(f('sLength').value) ? f('sLength').value : 'normal',
      teaching: ['low', 'medium', 'high'].includes(f('sTeach').value) ? f('sTeach').value : 'medium',
      theme: f('sTheme').value,
      rate: Number(f('sRate').value),
      dailyLimit: int('sLimit', 0, 100000, 0),
      ai: f('sAi').value,
      voice: f('sVoice').checked,
      autoSend: f('sAutoSend').checked,
      adaptiveVoice: f('sAdaptVoice').checked,
      memoryLearner: f('sMemLearner').checked,
      memoryCharacter: f('sMemChar').checked,
    });
    syncPush(true);
    toast(ownWorkerBlocked(url) ? 'บันทึกแล้ว แต่ต้องเพิ่มโดเมนนี้ใน connect-src ของ index.html ก่อนจึงจะใช้ได้' : 'บันทึกแล้ว');
    location.hash = !hadWorker && settings.workerUrl ? '#chat' : '#me';
  });
  f('cancelSettings').addEventListener('click', () => { applyTheme(settings.theme); location.hash = '#me'; });

  for (const id of ['sPushMode', 'sFrom', 'sTo', 'sPerDay', 'sTime1', 'sTime2', 'sTime3']) {
    f(id).addEventListener('change', () => { readSchedule(); showSchedule(); renderPush(); syncPush(true); });
  }
  f('pushOn').addEventListener('click', async () => {
    const btn = f('pushOn');
    btn.disabled = true;
    try {
      readSchedule();
      if (!(await enablePush())) toast('ไม่ได้รับอนุญาตให้แจ้งเตือน');
      else toast('เปิดการแจ้งเตือนแล้ว');
    } catch (e) { toast('เปิดการแจ้งเตือนไม่สำเร็จ: ' + e.message, true); }
    finally { btn.disabled = false; renderPush(); }
  });
  f('pushTest').addEventListener('click', async () => {
    const btn = f('pushTest');
    btn.disabled = true;
    btn.textContent = 'กำลังส่ง…';
    try { await testPush(); btn.textContent = 'ส่งแล้ว ✓ ดูแจ้งเตือน'; }
    catch (e) { toast('ส่งทดสอบไม่สำเร็จ: ' + e.message, true); btn.textContent = 'ส่งทดสอบตอนนี้'; }
    finally { setTimeout(() => { btn.disabled = false; btn.textContent = 'ส่งทดสอบตอนนี้'; }, 4000); }
  });
  f('pushOff').addEventListener('click', async () => { await disablePush(); renderPush(); });
  on('push', renderPush);

  f('syncNew').addEventListener('click', () => {
    if (!settings.workerUrl) { toast('ใส่ที่อยู่เซิร์ฟเวอร์ก่อน', true); return; }
    syncAction(f('syncNew'), () => startSync(newCode()), 'เปิดซิงก์แล้ว — จดรหัสไว้ใช้บนเครื่องอื่น');
  });
  f('syncJoin').addEventListener('click', () => {
    const code = cleanCode(f('syncJoinCode').value);
    if (code.length < 16) { toast('รหัสซิงก์สั้นเกินไป', true); return; }
    if (!settings.workerUrl) { toast('ใส่ที่อยู่เซิร์ฟเวอร์ก่อน', true); return; }
    if (!confirm('รวมข้อมูลในเครื่องนี้กับข้อมูลของรหัสนี้?\n(การตั้งค่าจะใช้ของรหัสนี้)')) return;
    syncAction(f('syncJoin'), () => startSync(code), 'เชื่อมแล้ว ข้อมูลรวมกันเรียบร้อย');
    f('syncJoinCode').value = '';
  });
  f('syncShow').addEventListener('click', () => {
    const shown = f('syncCode').type === 'text';
    f('syncCode').type = shown ? 'password' : 'text';
    f('syncShow').textContent = shown ? 'แสดงรหัส' : 'ซ่อนรหัส';
  });
  f('syncCopy').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(showCode(sync.code)); toast('คัดลอกรหัสแล้ว'); }
    catch { f('syncCode').type = 'text'; f('syncCode').select(); toast('กดค้างที่รหัสแล้วเลือกคัดลอก'); }
  });
  f('syncNow').addEventListener('click', () => syncAction(f('syncNow'), runSync, 'ซิงก์แล้ว'));
  f('syncStop').addEventListener('click', () => {
    if (!confirm('ปิดซิงก์บนเครื่องนี้? ข้อมูลในเครื่องและบนเซิร์ฟเวอร์ยังอยู่ (เปิดใหม่ได้ด้วยรหัสเดิม)')) return;
    stopSync(); renderSync();
  });
  f('syncDelete').addEventListener('click', () => {
    if (!confirm('ลบข้อมูลทั้งหมดของรหัสนี้บนเซิร์ฟเวอร์? ข้อมูลในเครื่องนี้ยังอยู่ แต่เครื่องอื่นจะซิงก์ไม่ได้อีก')) return;
    syncAction(f('syncDelete'), deleteServerCopy, 'ลบข้อมูลบนเซิร์ฟเวอร์แล้ว');
  });
  on('sync', renderSync);

  f('memClear').addEventListener('click', () => {
    if (!confirm('ลบความจำทั้งหมด? (สิ่งที่ตัวละครรู้เกี่ยวกับคุณ ความจำของทุกตัวละคร และหัวข้อที่ชอบ)\nแชต สมุดผิด คลังคำ และสถิติยังอยู่')) return;
    replaceState({ ...state, facts: [], charMemory: {}, topics: {}, sessions: Object.fromEntries(Object.entries(state.sessions).map(([k, v]) => [k, { ...v, summary: '', topic: '' }])) });
    toast('ลบความจำทั้งหมดแล้ว');
  });
  f('exportBtn').addEventListener('click', exportData);
  f('undoImport').addEventListener('click', undoImport);
  f('importBtn').addEventListener('click', () => f('importInput').click());
  f('importInput').addEventListener('change', (e) => { const file = e.target.files?.[0]; e.target.value = ''; if (file) importData(file); });
  f('resetBtn').addEventListener('click', () => {
    // Only the conversation goes; mistakes, words, memory and stats stay.
    if (!confirm('ล้างข้อความแชตทั้งหมด?\n(สมุดผิด คลังคำ ความจำของตัวละคร และสถิติยังอยู่ · ถ้าเปิดซิงก์ไว้ แชตในเครื่องอื่นจะถูกล้างด้วย)')) return;
    replaceState({ ...state, messages: [], scene: null, lastSeen: 0 });
    toast('ล้างแชตแล้ว');
    location.hash = '#chat';
  });
}

export function applyTheme(theme) {
  document.documentElement.dataset.theme = ['dark', 'light', 'auto'].includes(theme) ? theme : 'dark';
  const dark = theme === 'dark' || (theme === 'auto' && !matchMedia('(prefers-color-scheme: light)').matches);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#10131a' : '#ffffff');
}

// ---------- backup ----------
// The data as it was before the last import, kept for 7 days so an import can be undone.
const UNDO_KEY = 'lb_undo_import';
const UNDO_DAYS = 7;
function saveUndo() {
  try {
    localStorage.setItem(UNDO_KEY, JSON.stringify({ t: Date.now(), settings, state: { ...state, messages: state.messages.map(({ photoData, ...m }) => m) } }));
    return true;
  } catch { return false; }
}
function readUndo() {
  try {
    const u = JSON.parse(localStorage.getItem(UNDO_KEY) || 'null');
    if (u && Date.now() - u.t < UNDO_DAYS * 86400000 && u.state) return u;
    localStorage.removeItem(UNDO_KEY);
  } catch {}
  return null;
}
function renderUndo() {
  const u = readUndo();
  f('undoImport').hidden = !u;
  if (u) f('undoImport').textContent = `ย้อนการนำเข้าล่าสุด (ข้อมูลก่อน ${new Date(u.t).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })})`;
}
function undoImport() {
  const u = readUndo();
  if (!u) { renderUndo(); return; }
  if (!confirm('กลับไปใช้ข้อมูลก่อนการนำเข้าครั้งล่าสุด?\n(ข้อมูลที่นำเข้าและสิ่งที่ทำหลังจากนั้นจะถูกแทนที่)')) return;
  // The Worker link and access code stay as they are on this device.
  const keep = { workerUrl: settings.workerUrl, accessCode: settings.accessCode };
  setSettings({ ...DEFAULT_SETTINGS, ...(u.settings || {}), ...keep });
  replaceState(u.state);
  try { localStorage.removeItem(UNDO_KEY); } catch {}
  logActivity('import', 'ย้อนการนำเข้าข้อมูล');
  persist();
  applyTheme(settings.theme);
  fillSettings();
  toast('กลับไปใช้ข้อมูลเดิมแล้ว');
  syncPush(true);
}

async function exportData() {
  const { accessCode, ...safeSettings } = settings;   // the access code stays on this device
  const data = {
    app: 'language-buddy', version: 2, exported: new Date().toISOString(),
    settings: safeSettings, state: { ...state, messages: state.messages.map(({ photoData, ...m }) => m) },
  };
  const name = `language-buddy-${new Date().toISOString().slice(0, 10)}.json`;
  const file = new File([JSON.stringify(data, null, 1)], name, { type: 'application/json' });
  try {
    if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: name }); return; }
  } catch (e) { if (e.name === 'AbortError') return; }
  const a = el('a');
  a.href = URL.createObjectURL(file);
  a.download = name;
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

async function importData(file) {
  if (file.size > 10 * 1024 * 1024) { toast('ไฟล์ใหญ่เกินไป', true); return; }
  let data;
  try { data = JSON.parse(await file.text()); } catch { toast('ไฟล์นี้อ่านไม่ได้', true); return; }
  if (data?.app !== 'language-buddy' || !data.state || !Array.isArray(data.state.messages)) { toast('ไฟล์นี้ไม่ใช่ข้อมูลสำรองของ Language Buddy', true); return; }
  const n = data.state.messages.length;
  if (!confirm(`นำเข้าข้อมูลจาก ${String(data.exported || '').slice(0, 10)} (${n} ข้อความ)?\nข้อมูลในเครื่องตอนนี้จะถูกแทนที่ (แอปเก็บสำเนาไว้ ย้อนกลับได้ใน 7 วัน)`)) return;
  if (!saveUndo() && !confirm('เก็บสำเนาข้อมูลเดิมไม่ได้ (พื้นที่ในเครื่องไม่พอ)\nกด "ยกเลิก" แล้วส่งออกข้อมูลเก็บไว้ก่อน หรือกด "ตกลง" เพื่อนำเข้าเลย (ข้อมูลเดิมจะหาย)')) return;
  // Only known settings keys of the right type are taken from the file.
  const incoming = data.settings && typeof data.settings === 'object' ? data.settings : {};
  const next = { ...settings };
  for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) {
    if (k === 'workerUrl' || k === 'accessCode') continue;
    if (k in incoming && typeof incoming[k] === typeof v && (!Array.isArray(v) || Array.isArray(incoming[k]))) next[k] = incoming[k];
  }
  setSettings(next);
  replaceState(data.state);
  logActivity('import', `นำเข้าข้อมูลสำรอง ${n} ข้อความ`);
  persist();
  emit('state');
  applyTheme(settings.theme);
  fillSettings();
  renderUndo();
  toast(`นำเข้าแล้ว ${n} ข้อความ`);
  syncPush(true);
}
