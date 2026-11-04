// Speech for the app: picks accent, speed and tone from settings and the character, then hands
// the work to the active TTS / STT provider (js/voice/). Same functions as before, so the views
// do not care which engine is behind them.
import { settings, speechCode, isEnglish, cefrOf, activeChar } from './store.js';
import { voiceFor } from './engine/emotion.js';
import { tts } from './voice/tts.js';
import { stt } from './voice/stt.js';

// Slower speech for beginners, a little faster at advanced levels.
const LEVEL_RATE = { A1: 0.8, A2: 0.87, B1: 0.95, B2: 1, C1: 1.03, C2: 1.06 };
export const SLOW = 0.7;   // "listen slowly" in shadowing and listening practice

export const unlockSpeech = () => tts().unlock?.();
export const isSpeaking = () => tts().speaking();
export const stopSpeaking = () => tts().cancel();

// opts.emotion: the character's mood for this line. opts.plain: the learner's own accent and speed
// (corrections, practice sentences). opts.slow: slower, for listening practice. Returns a promise
// that resolves when the sentence has been spoken.
export function speak(text, opts = {}) {
  if (!text || !tts().available()) return Promise.resolve();
  const char = activeChar();
  // English characters use their own accent; practice uses the variant the learner chose.
  const lang = !opts.plain && isEnglish() && char.accent ? char.accent : speechCode();
  let rate = Number(settings.rate) || 1, pitch = 1;
  if (settings.adaptiveVoice !== false) {
    rate *= LEVEL_RATE[cefrOf()] || 1;
    if (opts.emotion && !opts.plain) { const t = voiceFor(opts.emotion); rate *= t.rate; pitch = t.pitch; }
  }
  if (opts.slow) rate *= SLOW;
  return tts().speak(text, { lang, rate, pitch });
}

export const canListen = stt().available();
export let listening = false;

// onText(text) gets live transcripts; onEnd(text, confidence) runs when the user stops talking.
export function listen({ onText, onEnd, onError }) {
  unlockSpeech();
  tts().cancel();
  const started = stt().start({
    lang: speechCode(), onText,
    onEnd: (text, conf) => { listening = false; onEnd?.(text, conf); },
    onError: (e) => { listening = false; onError?.(e); },
  });
  listening = started;
  return started;
}
export function stopListening() { stt().stop(); }
