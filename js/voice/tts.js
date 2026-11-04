// Text-to-speech providers. Learning features talk only to the active provider through this small
// interface, so another engine (for example a cloud voice) can be added later without touching them.
//
// Provider: {
//   id, label,
//   available(): boolean,
//   capabilities: { accents, voiceGender, rate, pitch, wordTiming },
//   speak(text, { lang, rate, pitch }): Promise<void>  (resolves when finished or cancelled),
//   cancel(), speaking(): boolean, unlock()
// }
// capabilities says what the engine can really do; the UI must not promise more than that.

const synth = () => (typeof window !== 'undefined' && window.speechSynthesis) || null;

let voices = [];
function loadVoices() { voices = synth()?.getVoices() || []; }
if (synth()) {
  loadVoices();
  synth().addEventListener?.('voiceschanged', loadVoices);
}

// The right accent (en-GB vs en-US) matters more than a nicer voice.
export function pickVoice(list, code) {
  const base = code.split('-')[0];
  const norm = (v) => v.lang.replace('_', '-');
  const cands = list.filter((v) => norm(v).startsWith(base));
  const pref = (v) => (/(premium|enhanced|natural|siri)/i.test(v.name) ? 0 : 1) + (norm(v) === code ? 0 : 2);
  return cands.sort((a, b) => pref(a) - pref(b))[0] || null;
}

let unlocked = false;
export const browserTts = {
  id: 'browser',
  label: 'เสียงในเครื่อง (เบราว์เซอร์)',
  available: () => !!synth(),
  // Browser voices: accent depends on what the device has installed; gender cannot be chosen reliably.
  capabilities: { accents: true, voiceGender: false, rate: true, pitch: true, wordTiming: false },
  speak(text, { lang = 'en-US', rate = 1, pitch = 1 } = {}) {
    const s = synth();
    if (!s || !text) return Promise.resolve();
    s.cancel();
    return new Promise((resolve) => {
      const u = new SpeechSynthesisUtterance(String(text).replace(/[*_#`]/g, ''));
      u.lang = lang;
      const v = pickVoice(voices, lang);
      if (v) u.voice = v;
      u.rate = Math.max(0.5, Math.min(1.6, rate));
      u.pitch = pitch;
      u.onend = () => resolve();
      u.onerror = () => resolve();
      s.speak(u);
    });
  },
  cancel() { synth()?.cancel(); },
  speaking: () => !!synth()?.speaking,
  // iOS only allows speech that started from a tap; speak a silent utterance once.
  unlock() {
    const s = synth();
    if (unlocked || !s) return;
    unlocked = true;
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0;
    s.speak(u);
  },
};

let active = browserTts;
export const tts = () => active;
export function setTtsProvider(p) { if (p && typeof p.speak === 'function') active = p; }
