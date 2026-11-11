// The text of the learner's books, kept only on this device in IndexedDB (the browser's storage
// for this app). Never synced and never sent anywhere as a whole; the AI only gets one page or one
// sentence when the learner asks for it. Record: { id, title, pages: [[paragraph, …] | null, …], added }.
// A scanned book also keeps its PDF file (store "files": { id, data: ArrayBuffer }) so later pages
// can be drawn and read; it is kept apart so saving one page's text does not rewrite the file.
const DB = 'lb_books';
const STORE = 'books';
const FILES = 'files';
const INK = 'ink';           // { id: 'bookId:page', strokes } pen and highlighter marks per page

function open() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in globalThis)) { reject(new Error('เบราว์เซอร์นี้เก็บหนังสือในเครื่องไม่ได้')); return; }
    const req = indexedDB.open(DB, 3);
    req.onupgradeneeded = () => {
      for (const s of [STORE, FILES, INK]) if (!req.result.objectStoreNames.contains(s)) req.result.createObjectStore(s, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('เปิดที่เก็บหนังสือไม่ได้'));
  });
}
async function run(mode, fn, store = STORE) {
  const db = await open();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(store, mode);
      const req = fn(tx.objectStore(store));
      tx.oncomplete = () => resolve(req?.result);
      tx.onerror = () => reject(tx.error || new Error('บันทึกหนังสือไม่สำเร็จ'));
      tx.onabort = () => reject(tx.error || new Error('พื้นที่ในเครื่องไม่พอ'));
    });
  } finally { db.close(); }
}

export const putBook = (book) => run('readwrite', (s) => s.put(book));
export const getBook = (id) => run('readonly', (s) => s.get(id)).catch(() => null);
export const deleteBook = (id) => run('readwrite', (s) => s.delete(id))
  .then(() => run('readwrite', (s) => s.delete(id), FILES))
  .then(() => run('readwrite', (s) => s.delete(IDBKeyRange.bound(`${id}:`, `${id}:￿`)), INK));
export const fileExists = (id) => run('readonly', (s) => s.count(id), FILES).then((n) => n > 0).catch(() => false);
export const getInk = (key) => run('readonly', (s) => s.get(key), INK).then((r) => r?.strokes || []).catch(() => []);
export const putInk = (key, strokes) => run('readwrite', (s) => (strokes.length ? s.put({ id: key, strokes }) : s.delete(key)), INK);
export const putFile = (id, data) => run('readwrite', (s) => s.put({ id, data }), FILES);
export const getFile = (id) => run('readonly', (s) => s.get(id), FILES).then((r) => r?.data || null).catch(() => null);
export const bookIds = () => run('readonly', (s) => s.getAllKeys()).then((k) => k || []).catch(() => []);

// Asks the browser not to clear this app's storage when space runs low (best effort; iPhone home
// screen apps are usually kept anyway).
export function keepStorage() { try { navigator.storage?.persist?.().catch(() => {}); } catch {} }
