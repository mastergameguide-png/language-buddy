// Book handwriting ⇄ sync. The marks live in IndexedDB (js/bookdb.js); here they become one sync
// row per stroke ("n:<bookId>:<page>:<strokeId>"), and rows from other devices are written back.
// A stroke is only deleted on the server when the learner removed it here (erase, undo, clear,
// delete the book): those keys are remembered below. Marks that are simply missing (the browser
// cleared this device's storage) are downloaded again instead of being deleted everywhere.
import { emit } from './store.js';
import { allInk, getInk, putInk } from './bookdb.js';
import { cleanStrokes, packStroke, unpackStroke, inkRowKey, parseInkRowKey, mergeInk } from './engine/book.js';

const KEY = 'lb_inkdel';
const MAX_DEAD = 5000;
let dead;
function deadSet() {
  if (!dead) { try { dead = new Set(JSON.parse(localStorage.getItem(KEY) || '[]')); } catch { dead = new Set(); } }
  return dead;
}
function saveDead() { try { localStorage.setItem(KEY, JSON.stringify([...deadSet()].slice(-MAX_DEAD))); } catch {} }

// The learner removed these strokes from a page ("<bookId>:<page>").
export function inkDeleted(pageKey, ids) {
  if (!ids?.length) return;
  for (const id of ids) deadSet().add(inkRowKey(pageKey, id));
  saveDead();
}
export const wasDeleted = (k) => deadSet().has(k);
export function forgetDeleted(keys) {
  let any = false;
  for (const k of keys) any = deadSet().delete(k) || any;
  if (any) saveDead();
}

// Every stroke on this device as sync rows: Map(key → packed stroke). Throws if storage cannot be read.
export async function inkLocalRows() {
  const rows = new Map();
  for (const rec of await allInk()) {
    if (!/^[\w.-]+:\d+$/.test(String(rec?.id))) continue;
    for (const s of cleanStrokes(rec.strokes)) rows.set(inkRowKey(rec.id, s.id), packStroke(s));
  }
  return rows;
}

// A row from another device → { pageKey, id, stroke | null }, or null when it is not a valid ink row.
export function readInkRow(k, v) {
  const key = parseInkRowKey(k);
  if (!key) return null;
  if (v === null) return { ...key, stroke: null };
  const stroke = unpackStroke(key.id, v);
  return stroke ? { ...key, stroke } : null;
}

// Writes changes from other devices into each page, and tells an open page to redraw.
export async function applyInk(changes) {
  const pages = new Map();
  for (const c of changes) { if (!pages.has(c.pageKey)) pages.set(c.pageKey, []); pages.get(c.pageKey).push(c); }
  for (const [pageKey, list] of pages) {
    await putInk(pageKey, mergeInk(await getInk(pageKey), list));
    emit('ink', { pageKey, changes: list });
  }
}

// The learner deleted a whole book: its marks are deleted on the other devices too.
export async function inkDeleteBook(id) {
  try {
    for (const rec of await allInk()) if (String(rec?.id).startsWith(`${id}:`)) inkDeleted(rec.id, cleanStrokes(rec.strokes).map((s) => s.id));
  } catch {}
}
