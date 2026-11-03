// "Buddy messages first": Web Push subscription, profile sync and the inbox of messages the
// Worker wrote while the app was closed.
import { settings, state, push, savePush, persist, emit, levelText, isEnglish } from './store.js';
import { workerBase, authHeaders } from './ai.js';

export const pushSupported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
export const standalone = navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
export const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export function pushProfile() {
  return {
    name: settings.name, persona: settings.persona, lang: settings.lang, level: levelText(), variant: isEnglish() ? settings.variant : '',
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone, perDay: Number(settings.perDay) || 0,
    mode: settings.pushMode, from: settings.pushFrom, to: settings.pushTo, times: settings.pushTimes,
    facts: state.facts.slice(-20),
    recent: state.messages.slice(-6).map((m) => ({ role: m.role, text: (m.photo ? '[sent a photo] ' : '') + (m.text || '') })),
  };
}

async function pushApi(path, payload, method = 'POST') {
  const url = `${workerBase()}/push/${path}` + (method === 'GET' ? `?id=${encodeURIComponent(push.id)}` : '');
  const headers = authHeaders();
  const res = await fetch(url, method === 'GET'
    ? { headers: settings.accessCode ? { 'X-Buddy-Key': settings.accessCode } : {} }
    : { method, headers, body: JSON.stringify({ id: push.id, ...payload }) });
  let data = {};
  try { data = await res.json(); } catch {}
  if (!res.ok) { const err = new Error(data.error || `HTTP ${res.status}`); err.status = res.status; throw err; }
  return data;
}

// Keep the Worker's copy of the profile fresh (at most every 10 minutes) and mark the user active.
export async function syncPush(force) {
  if (!push.enabled || !settings.workerUrl) return;
  if (!force && Date.now() - push.lastSync < 10 * 60 * 1000) return;
  try {
    await pushApi('sync', { profile: pushProfile() });
    push.lastSync = Date.now();
    savePush();
  } catch (e) {
    if (e.status === 404) { push.enabled = false; savePush(); emit('push'); }
  }
}

// Returns the messages added to the chat (possibly none).
export async function fetchInbox() {
  if (!push.enabled || !settings.workerUrl) return [];
  try {
    const { messages = [] } = await pushApi('inbox', null, 'GET');
    if (!messages.length) return [];
    for (const m of messages) state.messages.push({ role: 'model', text: String(m.text).slice(0, 4000), t: Number(m.t) || Date.now() });
    state.messages.sort((a, b) => a.t - b.t);
    state.lastSeen = Date.now();
    persist();
    emit('state');
    return messages;
  } catch { return []; }
}

export function pushStatus() {
  if (!settings.workerUrl) return { text: 'ใส่ลิงก์ Worker ก่อน', canOn: false };
  if (isIOS && !standalone) return { text: 'บน iPhone ต้อง "เพิ่มไปยังหน้าจอโฮม" แล้วเปิดแอปจากไอคอนก่อน ถึงจะเปิดการแจ้งเตือนได้ (iOS 16.4 ขึ้นไป)', canOn: false };
  if (!pushSupported) return { text: 'เครื่อง/เบราว์เซอร์นี้ไม่รองรับการแจ้งเตือนของเว็บแอป', canOn: false };
  if (Notification.permission === 'denied') return { text: 'การแจ้งเตือนถูกปิดไว้ ไปที่ การตั้งค่า > การแจ้งเตือน > Buddy แล้วเปิด "อนุญาตการแจ้งเตือน"', canOn: false };
  if (push.enabled) return { text: '✅ เปิดอยู่ — ' + scheduleText(), canOn: false };
  return { text: 'ยังไม่ได้เปิด', canOn: true };
}

export const hh = (h) => String(h).padStart(2, '0') + ':00';
export function scheduleText() {
  if (settings.pushMode === 'fixed') {
    const t = settings.pushTimes || [];
    return t.length ? `${settings.name} จะทักมาตอน ${t.join(', ')} น. ทุกวัน` : 'ยังไม่ได้ใส่เวลา — ใส่อย่างน้อย 1 เวลา';
  }
  return `${settings.name} จะทักมาวันละไม่เกิน ${settings.perDay} ครั้ง สุ่มเวลาระหว่าง ${hh(settings.pushFrom)}–${hh(settings.pushTo)} (ไม่ทักซ้ำถ้ายังไม่ได้อ่าน และไม่ทักถ้าเพิ่งคุยกันไป)`;
}

const b64ToBytes = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));

// Must be called straight from a tap: iOS only shows the permission prompt then.
export async function enablePush() {
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return false;
  const { key } = await (await fetch(`${workerBase()}/push/key`, { headers: settings.accessCode ? { 'X-Buddy-Key': settings.accessCode } : {} })).json();
  if (!key) throw new Error('Worker ยังไม่ได้ตั้งค่าระบบแจ้งเตือน');
  const reg = await navigator.serviceWorker.ready;
  const old = await reg.pushManager.getSubscription();
  if (old) await old.unsubscribe();
  const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(key) });
  push.id = push.id || crypto.randomUUID();
  await pushApi('subscribe', { sub: sub.toJSON(), profile: pushProfile() });
  push.enabled = true;
  push.lastSync = Date.now();
  savePush();
  emit('push');
  return true;
}
export async function testPush() { return pushApi('test', { profile: pushProfile() }); }
export async function disablePush() {
  try { await pushApi('unsubscribe', {}); } catch {}
  try { const reg = await navigator.serviceWorker.ready; await (await reg.pushManager.getSubscription())?.unsubscribe(); } catch {}
  push.enabled = false;
  savePush();
  emit('push');
}
