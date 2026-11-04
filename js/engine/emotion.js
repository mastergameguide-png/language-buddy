// Emotion engine. The model proposes an emotion for each reply; this file decides what the
// character actually shows, so moods change gradually instead of jumping around.
import { EMOTIONS } from './characters.js';

export const EMOTION_UI = {
  happy: { emoji: '😊', th: 'อารมณ์ดี' },
  curious: { emoji: '🤔', th: 'อยากรู้' },
  empathetic: { emoji: '🫶', th: 'เห็นใจ' },
  surprised: { emoji: '😮', th: 'ประหลาดใจ' },
  playful: { emoji: '😄', th: 'ขี้เล่น' },
  focused: { emoji: '🎯', th: 'ตั้งใจ' },
  encouraging: { emoji: '💪', th: 'ให้กำลังใจ' },
  neutral: { emoji: '🙂', th: 'ปกติ' },
};

const round = (n) => Math.round(n * 100) / 100;
const clamp01 = (n) => Math.max(0, Math.min(1, Number(n)));

export function baseEmotion(char) {
  return { state: char?.emotional?.baseline || 'neutral', intensity: 0.5 };
}

export function cleanEmotion(e) {
  if (!e || typeof e !== 'object' || !EMOTIONS.includes(e.state)) return null;
  const i = Number(e.intensity);
  return { state: e.state, intensity: Number.isFinite(i) ? round(clamp01(i)) : 0.5 };
}

// prev: what the character showed last turn. proposed: what the model suggests now.
// - Same mood: intensity blends toward the new value.
// - New mood: only taken if the model is fairly sure; a calm (high-stability) character
//   needs more evidence. Otherwise the old mood stays and slowly fades.
// - Never above the character's max intensity (no exaggerated reactions).
export function nextEmotion(prev, proposed, char) {
  const beh = char?.emotional || { baseline: 'neutral', max: 0.8, stability: 0.5 };
  const p = cleanEmotion(prev) || baseEmotion(char);
  const n = cleanEmotion(proposed);
  if (!n) {
    // No signal: drift back toward the character's usual mood.
    if (p.state === beh.baseline) return { state: p.state, intensity: round(p.intensity * 0.8 + 0.5 * 0.2) };
    return p.intensity <= 0.3 ? baseEmotion(char) : { state: p.state, intensity: round(p.intensity * 0.7) };
  }
  const target = Math.min(n.intensity, beh.max);
  if (n.state === p.state) return { state: p.state, intensity: round(Math.min(beh.max, p.intensity * 0.4 + target * 0.6)) };
  const threshold = 0.3 + 0.4 * (beh.stability ?? 0.5);
  if (target < threshold) return { state: p.state, intensity: round(p.intensity * 0.8) };
  // Ease into the new mood rather than starting at full strength.
  return { state: n.state, intensity: round(Math.min(beh.max, (target + 0.5) / 2 + 0.1)) };
}

// Which avatar picture fits the emotion (files listed in assets/characters/README.md).
const EXPRESSION_FOR = {
  happy: 'happy', playful: 'happy', encouraging: 'happy', curious: 'thinking',
  surprised: 'surprised', empathetic: 'empathetic', focused: 'focused', neutral: 'default',
};
export function expressionFor(emotion) {
  return EXPRESSION_FOR[emotion?.state] || 'default';
}

// Slight changes to speech so the voice matches the mood (scaled by intensity).
export function voiceFor(emotion) {
  const i = cleanEmotion(emotion)?.intensity ?? 0.5;
  const tone = {
    happy: [1.03, 1.06], playful: [1.05, 1.08], surprised: [1.02, 1.1], curious: [1, 1.04],
    empathetic: [0.92, 0.97], focused: [0.97, 1], encouraging: [1, 1.04], neutral: [1, 1],
  }[emotion?.state] || [1, 1];
  return { rate: round(1 + (tone[0] - 1) * i * 2), pitch: round(1 + (tone[1] - 1) * i * 2) };
}
