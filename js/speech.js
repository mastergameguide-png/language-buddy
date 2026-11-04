// Text-to-speech and speech recognition, using the browser's built-in engines.
import { settings, speechCode, isEnglish, cefrOf, activeChar } from './store.js';
import { voiceFor } from './engine/emotion.js';

// Slower speech for beginners, a little faster at advanced levels.
const LEVEL_RATE = { A1: 0.8, A2: 0.87, B1: 0.95, B2: 1, C1: 1.03, C2: 1.06 };

let voices = [];
const loadVoices = () => { voices = window.speechSynthesis ? speechSynthesis.getVoices() : []; };
if (window.speechSynthesis) {
  loadVoices();
  speechSynthesis.addEventListener?.('voiceschanged', loadVoices);
}
function pickVoice(code) {
  const base = code.split('-')[0];
  const cands = voices.filter((v) => v.lang.replace('_', '-').startsWith(base));
  // The right accent (en-GB vs en-US) matters more than a nicer voice.
  const pref = (v) => (/(premium|enhanced|natural|siri)/i.test(v.name) ? 0 : 1) + (v.lang.replace('_', '-') === code ? 0 : 2);
  return cands.sort((a, b) => pref(a) - pref(b))[0] || null;
}

let unlocked = false;
// iOS only allows speech that started from a tap; speak a silent utterance once.
export function unlockSpeech() {
  if (unlocked || !window.speechSynthesis) return;
  unlocked = true;
  const u = new SpeechSynthesisUtterance(' ');
  u.volume = 0;
  speechSynthesis.speak(u);
}

// opts.emotion: the character's mood for this line; opts.plain: read with the learner's own
// accent and speed (used for correction examples).
export function speak(text, opts = {}) {
  if (!window.speechSynthesis || !text) return;
  speechSynthesis.cancel();
  const char = activeChar();
  // English characters use their own accent; corrections use the variant the learner chose.
  const code = !opts.plain && isEnglish() && char.accent ? char.accent : speechCode();
  const u = new SpeechSynthesisUtterance(String(text).replace(/[*_#`]/g, ''));
  u.lang = code;
  const v = pickVoice(code);
  if (v) u.voice = v;
  let rate = Number(settings.rate) || 1, pitch = 1;
  if (settings.adaptiveVoice !== false) {
    rate *= LEVEL_RATE[cefrOf()] || 1;
    if (opts.emotion) { const t = voiceFor(opts.emotion); rate *= t.rate; pitch = t.pitch; }
  }
  u.rate = Math.max(0.5, Math.min(1.6, rate));
  u.pitch = pitch;
  speechSynthesis.speak(u);
}

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
export const canListen = !!SR;
let rec = null;
export let listening = false;

// onText(text) gets live transcripts; onEnd(text) runs when the user stops talking.
export function listen({ onText, onEnd, onError }) {
  if (!SR) { onError?.('unsupported'); return false; }
  unlockSpeech();
  window.speechSynthesis?.cancel();
  rec = new SR();
  rec.lang = speechCode();
  rec.interimResults = true;
  rec.continuous = false;
  let finalText = '', lastText = '';
  rec.onresult = (e) => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) finalText += r[0].transcript;
      else interim += r[0].transcript;
    }
    lastText = (finalText + interim).trim();
    onText?.(lastText);
  };
  rec.onerror = (e) => onError?.(e.error);
  rec.onend = () => { listening = false; onEnd?.(lastText); };
  try { rec.start(); listening = true; } catch { listening = false; }
  return listening;
}
export function stopListening() { try { rec?.stop(); } catch {} }
