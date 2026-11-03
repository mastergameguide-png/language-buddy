// Backup + sync across devices through the Worker's D1 (SQL) database.
// Every learner item becomes one row ("c:" chat message, "m:" mistake, "w:" word, "f:" fact,
// "r:" role-play result, "a:" activity, "d:" day stats, "s:" settings). This device remembers a
// short hash of each row it last sent or received, so a sync only uploads what changed here
// (a missing row = deleted) and downloads what other devices changed since `cursor`.
import { settings, state, load, save, persist, emit, setSettings, DEFAULT_SETTINGS, normalizeState } from './store.js';
import { workerBase, authHeaders } from './ai.js';
import { uid } from './util.js';

const KEY = 'lb_sync';
const BATCH = 250;                 // rows per upload (the Worker accepts up to 300)
const LOCAL_ONLY = ['workerUrl', 'accessCode'];

export let sync = { code: '', device: '', cursor: 0, fp: {}, last: 0, error: '', ...load(KEY, {}) };
const saveSync = () => save(KEY, sync);

// ---------- sync code ----------
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // no 0/O or 1/I
export const cleanCode = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
export const showCode = (c) => c.match(/.{1,4}/g)?.join('-') || '';
export function newCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(20));     // 100 bits
  return [...bytes].map((b) => ALPHABET[b % 32]).join('');
}

// ---------- rows ----------
// Key order must not change the hash, so objects are written with sorted keys.
function stable(v) {
  if (Array.isArray(v)) return '[' + v.map(stable).join(',') + ']';
  if (v && typeof v === 'object') return '{' + Object.keys(v).filter((k) => v[k] !== undefined).sort().map((k) => JSON.stringify(k) + ':' + stable(v[k])).join(',') + '}';
  return JSON.stringify(v ?? null);
}
function hash(s) {                 // cyrb53: fast 53-bit string hash, enough to spot a change
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}
const safeId = (s) => String(s).replace(/[^\w.-]/g, '').slice(0, 60) || hash(String(s));

function localRows() {
  const rows = new Map();
  const add = (k, v) => rows.set(k, stable(v));
  for (const m of state.messages) if (!m.failed) add(`c:${m.t}-${m.role[0]}`, (({ photoData, ...x }) => x)(m));
  for (const m of state.mistakes) add('m:' + safeId(m.id), m);
  for (const w of state.vocab) add('w:' + safeId(w.id), w);
  for (const f of state.facts) add('f:' + hash(f), f);
  for (const r of state.results) add(`r:${r.t}`, r);
  for (const a of state.activity) add(`a:${a.t}-${hash(a.text || '')}`, a);
  for (const [day, rec] of Object.entries(state.days)) add('d:' + day, rec);
  const shared = { ...settings };
  for (const k of LOCAL_ONLY) delete shared[k];
  add('s:settings', shared);
  return rows;
}

// Puts one row from another device into this device's data. Returns true if settings changed.
function applyRow(k, d) {
  const v = d === null ? null : JSON.parse(d);
  const kind = k[0];
  const upsert = (list, match) => {
    const i = list.findIndex(match);
    if (v === null) { if (i >= 0) list.splice(i, 1); }
    else if (i >= 0) list[i] = v;
    else list.push(v);
  };
  if (kind === 'c') {
    const [t, r] = k.slice(2).split('-');
    upsert(state.messages, (m) => String(m.t) === t && m.role[0] === r);
  } else if (kind === 'm') upsert(state.mistakes, (m) => 'm:' + safeId(m.id) === k);
  else if (kind === 'w') upsert(state.vocab, (w) => 'w:' + safeId(w.id) === k);
  else if (kind === 'f') upsert(state.facts, (f) => 'f:' + hash(f) === k);
  else if (kind === 'r') upsert(state.results, (r) => `r:${r.t}` === k);
  else if (kind === 'a') upsert(state.activity, (a) => `a:${a.t}-${hash(a.text || '')}` === k);
  else if (kind === 'd') {
    // Two devices studied on the same day: keep the larger count of each figure.
    const day = k.slice(2);
    if (v === null) delete state.days[day];
    else {
      const mine = state.days[day] || {};
      const merged = { ...mine };
      for (const [f, n] of Object.entries(v)) merged[f] = typeof n === 'number' ? Math.max(n, Number(mine[f]) || 0) : n;
      state.days[day] = merged;
    }
  } else if (kind === 's' && v) {
    const next = { ...settings };
    for (const [key, dflt] of Object.entries(DEFAULT_SETTINGS)) {
      if (LOCAL_ONLY.includes(key) || !(key in v)) continue;
      if (typeof v[key] === typeof dflt && Array.isArray(v[key]) === Array.isArray(dflt)) next[key] = v[key];
    }
    setSettings(next);
    return true;
  }
  return false;
}

// ---------- network ----------
async function api(path, payload) {
  const res = await fetch(`${workerBase()}/sync${path}`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ code: sync.code, ...payload }) });
  let data = {};
  try { data = await res.json(); } catch {}
  if (!res.ok) {
    const msg = res.status === 501 ? 'Worker ยังไม่ได้ตั้งค่าฐานข้อมูล' : res.status === 429 ? 'ซิงก์ถี่เกินไป รอสักครู่' : res.status === 401 ? 'รหัสเข้าใช้ Worker ไม่ถูกต้อง' : data.error || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

let running = null;
// Uploads this device's changes and downloads everyone else's. Safe to call often.
export function runSync() {
  if (!sync.code || !settings.workerUrl) return Promise.resolve(false);
  running ||= doSync().finally(() => { running = null; });
  return running;
}

async function doSync() {
  const firstTime = !sync.cursor && !Object.keys(sync.fp).length;
  let changed = false;
  try {
    // A device joining an existing code downloads first, so its defaults do not overwrite the
    // learner's real settings and nothing already on the server is uploaded again.
    if (firstTime) changed = await pull();
    const local = localRows();
    const up = [];
    for (const [k, s] of local) if (sync.fp[k] !== hash(s)) up.push({ k, d: s });
    for (const k of Object.keys(sync.fp)) if (!local.has(k)) up.push({ k, d: null });
    do {
      const part = up.splice(0, BATCH);
      const sentCursor = sync.cursor;
      const res = await api('', { device: sync.device, cursor: sync.cursor, rows: part });
      if (res.rev < sentCursor) {
        // The server copy was deleted (from another device): start again from this device's data.
        sync.cursor = 0; sync.fp = {}; saveSync();
        return doSync();
      }
      for (const r of part) { if (r.d === null) delete sync.fp[r.k]; else sync.fp[r.k] = hash(r.d); }
      changed = applyAll(res.rows) || changed;
      sync.cursor = res.cursor;
      saveSync();
      if (res.more && !up.length) changed = (await pull()) || changed;   // more waiting on the server
    } while (up.length);
    sync.last = Date.now();
    sync.error = '';
  } catch (e) {
    sync.error = e.message || 'ซิงก์ไม่สำเร็จ';
  }
  saveSync();
  if (changed) { state.messages.sort((a, b) => a.t - b.t); replaceStateQuiet(); }
  emit('sync');
  return !sync.error;
}

async function pull() {
  let changed = false, more = true;
  while (more) {
    const res = await api('', { device: sync.device, cursor: sync.cursor, rows: [] });
    changed = applyAll(res.rows) || changed;
    sync.cursor = res.cursor;
    more = res.more;
    saveSync();
  }
  return changed;
}

function applyAll(rows) {
  let changed = false;
  for (const { k, d } of rows || []) {
    try {
      applyRow(k, d);
      if (d === null) delete sync.fp[k]; else sync.fp[k] = hash(d);
      changed = true;
    } catch (e) { console.warn('sync row skipped', k, e); }
  }
  return changed;
}

// Re-validate what arrived from other devices, save it and redraw the screen.
function replaceStateQuiet() {
  Object.assign(state, normalizeState(state));
  persist();
  emit('state');
}

// ---------- turning it on/off ----------
export async function startSync(code) {
  sync = { code: cleanCode(code), device: sync.device || uid(), cursor: 0, fp: {}, last: 0, error: '' };
  saveSync();
  return runSync();
}
export function stopSync() {
  sync = { code: '', device: sync.device, cursor: 0, fp: {}, last: 0, error: '' };
  saveSync();
  emit('sync');
}
export async function deleteServerCopy() {
  await api('/delete', {});
  stopSync();
}

// Sync now and then while the app is open, and when it goes to the background.
let timer;
export function startAutoSync() {
  if (!sync.device) { sync.device = uid(); saveSync(); }
  runSync();
  clearInterval(timer);
  timer = setInterval(() => { if (document.visibilityState === 'visible') runSync(); }, 3 * 60 * 1000);
  document.addEventListener('visibilitychange', () => runSync());
}
