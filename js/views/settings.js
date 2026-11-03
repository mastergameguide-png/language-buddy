// Settings & profile form, notification schedule, backup/restore.
import { $, el, toast } from '../util.js';
import {
  settings, state, push, setSettings, saveSettings, replaceState, persist, emit, on,
  LANGS, CEFR, IELTS, DEFAULT_SETTINGS, cefrOf, logActivity,
} from '../store.js';
import { pushStatus, enablePush, testPush, disablePush, syncPush, hh } from '../push.js';

const f = (id) => $(id);

// English offers IELTS bands as well as CEFR; other languages use CEFR only.
function fillLevels(lang, current) {
  const sel = f('sLevel');
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
  f('variantBox').hidden = lang !== 'English';
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

export function fillSettings() {
  f('sWorker').value = settings.workerUrl;
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
  f('sTheme').value = settings.theme;
  f('sRate').value = settings.rate;
  f('sLimit').value = settings.dailyLimit || '';
  f('sAi').value = settings.ai || 'auto';
  f('sVoice').checked = settings.voice;
  f('sAutoSend').checked = settings.autoSend;
  showSchedule();
  renderPush();
}

const int = (id, min, max, dflt) => {
  const v = Math.floor(Number(f(id).value));
  return Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : dflt;
};

export function initSettings() {
  for (const [key, v] of Object.entries(LANGS)) { const o = el('option', '', v.label); o.value = key; f('sLang').append(o); }
  for (let h = 0; h <= 24; h++) {
    if (h < 24) { const o = el('option', '', hh(h)); o.value = h; f('sFrom').append(o); }
    if (h > 0) { const o = el('option', '', h === 24 ? '24:00 (เที่ยงคืน)' : hh(h)); o.value = h; f('sTo').append(o); }
  }
  f('sLang').addEventListener('change', () => fillLevels(f('sLang').value, f('sLevel').value));
  f('sTheme').addEventListener('change', () => applyTheme(f('sTheme').value));

  // Save on submit (fires right away in every browser).
  f('settingsForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const url = f('sWorker').value.trim();
    if (url && !/^https:\/\/[^\s]+$/i.test(url) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//i.test(url)) { toast('ลิงก์ Worker ต้องขึ้นต้นด้วย https://', true); f('sWorker').focus(); return; }
    const hadWorker = !!settings.workerUrl;
    setSettings({
      ...settings,
      workerUrl: url,
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
      theme: f('sTheme').value,
      rate: Number(f('sRate').value),
      dailyLimit: int('sLimit', 0, 100000, 0),
      ai: f('sAi').value,
      voice: f('sVoice').checked,
      autoSend: f('sAutoSend').checked,
    });
    syncPush(true);
    toast('บันทึกแล้ว');
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

  f('exportBtn').addEventListener('click', exportData);
  f('importBtn').addEventListener('click', () => f('importInput').click());
  f('importInput').addEventListener('change', (e) => { const file = e.target.files?.[0]; e.target.value = ''; if (file) importData(file); });
  f('resetBtn').addEventListener('click', () => {
    if (!confirm('ลบแชต ความจำ สมุดผิด คลังคำ และสถิติทั้งหมด?\n(การตั้งค่ายังอยู่ — แนะนำให้ส่งออกข้อมูลสำรองก่อน)')) return;
    replaceState({});
    toast('ล้างข้อมูลแล้ว');
    location.hash = '#home';
  });
}

export function applyTheme(theme) {
  document.documentElement.dataset.theme = ['dark', 'light', 'auto'].includes(theme) ? theme : 'dark';
  const dark = theme === 'dark' || (theme === 'auto' && !matchMedia('(prefers-color-scheme: light)').matches);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#10131a' : '#ffffff');
}

// ---------- backup ----------
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
  if (!confirm(`นำเข้าข้อมูลจาก ${String(data.exported || '').slice(0, 10)} (${n} ข้อความ)?\nข้อมูลในเครื่องตอนนี้จะถูกแทนที่`)) return;
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
  toast(`นำเข้าแล้ว ${n} ข้อความ`);
  syncPush(true);
}
