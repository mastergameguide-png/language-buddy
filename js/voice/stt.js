// Speech-to-text providers, behind one small interface (see tts.js for the idea).
//
// Provider: {
//   id, label,
//   available(): boolean,
//   capabilities: { interim, confidence, wordTiming, pronunciationScore },
//   start({ lang, onText(text), onEnd(text, confidence), onError(code) }): boolean,
//   stop(), listening(): boolean
// }
// The browser engine only turns speech into words. It does not measure pronunciation, so
// pronunciationScore is false and the app never shows a pronunciation score from it.

const SR = () => (typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)) || null;

let rec = null;
let on = false;
export const browserStt = {
  id: 'browser',
  label: 'ระบบฟังเสียงของเบราว์เซอร์',
  available: () => !!SR(),
  capabilities: { interim: true, confidence: true, wordTiming: false, pronunciationScore: false },
  start({ lang = 'en-US', onText, onEnd, onError } = {}) {
    const Ctor = SR();
    if (!Ctor) { onError?.('unsupported'); return false; }
    rec = new Ctor();
    rec.lang = lang;
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;
    let finalText = '', lastText = '', conf = [];
    rec.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) { finalText += r[0].transcript; if (Number.isFinite(r[0].confidence)) conf.push(r[0].confidence); }
        else interim += r[0].transcript;
      }
      lastText = (finalText + interim).trim();
      onText?.(lastText);
    };
    rec.onerror = (e) => onError?.(e.error);
    rec.onend = () => {
      on = false;
      // Confidence is the recogniser's own guess about the words, not a pronunciation score.
      onEnd?.(lastText, conf.length ? conf.reduce((a, b) => a + b, 0) / conf.length : null);
    };
    try { rec.start(); on = true; } catch { on = false; }
    return on;
  },
  stop() { try { rec?.stop(); } catch {} },
  listening: () => on,
};

let active = browserStt;
export const stt = () => active;
export function setSttProvider(p) { if (p && typeof p.start === 'function') active = p; }
