// Records the learner's own voice so they can listen back and compare with the model sentence.
// Audio stays in memory as a blob: URL; nothing is uploaded or saved.

const media = () => (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia ? navigator.mediaDevices : null);
export const canRecord = () => !!media() && typeof MediaRecorder !== 'undefined';

// Safari records mp4/aac, Chrome and Firefox webm/opus.
function mimeType() {
  for (const t of ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg']) {
    if (MediaRecorder.isTypeSupported?.(t)) return t;
  }
  return '';
}

const MAX_MS = 30000;   // a sentence never needs longer; also stops a forgotten recording

// Starts recording. Returns { stop(): Promise<{ url, ms }> }, or throws an Error with a Thai message.
export async function startRecording() {
  if (!canRecord()) throw new Error('เครื่องนี้อัดเสียงในเบราว์เซอร์ไม่ได้');
  let stream;
  try { stream = await media().getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); }
  catch (e) { throw new Error(e?.name === 'NotAllowedError' ? 'ไม่ได้รับอนุญาตให้ใช้ไมค์ — เปิดสิทธิ์ไมโครโฟนให้แอปก่อน' : 'เปิดไมค์ไม่ได้'); }
  const type = mimeType();
  const mr = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
  const chunks = [];
  const t0 = Date.now();
  mr.ondataavailable = (e) => { if (e.data?.size) chunks.push(e.data); };
  const done = new Promise((resolve) => {
    mr.onstop = () => {
      for (const tr of stream.getTracks()) tr.stop();
      const blob = new Blob(chunks, { type: mr.mimeType || type || 'audio/webm' });
      resolve({ url: URL.createObjectURL(blob), ms: Date.now() - t0 });
    };
  });
  mr.start();
  const timer = setTimeout(() => { if (mr.state !== 'inactive') mr.stop(); }, MAX_MS);
  return {
    stop() { clearTimeout(timer); if (mr.state !== 'inactive') mr.stop(); return done; },
    done,
  };
}
