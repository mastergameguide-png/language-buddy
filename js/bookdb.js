// The text of the learner's books, kept only on this device in IndexedDB (the browser's storage
// for this app). Never synced and never sent anywhere as a whole; the AI only gets one page or one
// sentence when the learner asks for it. Record: { id, title, pages: [[paragraph, …], …], added }.
const DB = 'lb_books';
const STORE = 'books';

function open() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in globalThis)) { reject(new Error('เบราว์เซอร์นี้เก็บหนังสือในเครื่องไม่ได้')); return; }
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: 'id' }); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('เปิดที่เก็บหนังสือไม่ได้'));
  });
}
async function run(mode, fn) {
  const db = await open();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req?.result);
      tx.onerror = () => reject(tx.error || new Error('บันทึกหนังสือไม่สำเร็จ'));
      tx.onabort = () => reject(tx.error || new Error('พื้นที่ในเครื่องไม่พอ'));
    });
  } finally { db.close(); }
}

export const putBook = (book) => run('readwrite', (s) => s.put(book));
export const getBook = (id) => run('readonly', (s) => s.get(id)).catch(() => null);
export const deleteBook = (id) => run('readwrite', (s) => s.delete(id));
export const bookIds = () => run('readonly', (s) => s.getAllKeys()).then((k) => k || []).catch(() => []);

// Asks the browser not to clear this app's storage when space runs low (best effort; iPhone home
// screen apps are usually kept anyway).
export function keepStorage() { try { navigator.storage?.persist?.().catch(() => {}); } catch {} }
