// Conversation modes and the learner's teaching preferences, as prompt guidance.
// Pure data + small helpers so they can be tested without a browser.

// roleplay is not chosen here: it is on automatically while a scenario runs.
export const MODES = {
  natural: {
    th: 'คุยธรรมชาติ', icon: '💬',
    desc: 'คุยเหมือนเพื่อน แก้เฉพาะข้อผิดชัดเจน',
    prompt: 'MODE: natural conversation. Chat like a real friend; teaching stays in the background. Feedback only for clear errors.',
  },
  learning: {
    th: 'เรียนไปคุยไป', icon: '📚',
    desc: 'สอดแทรกคำ/โครงสร้างใหม่ และชวนให้ลองใช้',
    prompt: 'MODE: learning. Keep it a real conversation, but in most turns weave in one useful word, phrase or structure slightly above their level and ask a question that invites them to use it. Offer "new_word" more often than usual.',
  },
  correction: {
    th: 'เน้นแก้ภาษา', icon: '✏️',
    desc: 'แก้ทั้งข้อผิดและสำนวนที่ไม่เป็นธรรมชาติ',
    prompt: 'MODE: correction practice. The learner wants their language checked: give "language_feedback" for every real error or clearly unnatural phrasing (still only the most important one per turn). Keep your own message short so the focus stays on their language.',
  },
  ielts: {
    th: 'ฝึก IELTS', icon: '🎓', englishOnly: true,
    desc: 'ถามแบบ IELTS Speaking Part 1/3 ชวนตอบยาวขึ้น',
    prompt: 'MODE: IELTS speaking practice (not a test). Ask IELTS Speaking Part 1 or Part 3 style questions about everyday and abstract topics, encourage extended answers with reasons and examples, and in feedback mention the IELTS criterion it affects. Never give a band score here.',
  },
};
export const MODE_IDS = Object.keys(MODES);
export const ROLEPLAY_MODE = { th: 'ฝึกสถานการณ์', icon: '🎭' };

// Valid mode for the current language (IELTS is English only).
export function modeOf(id, isEnglish = true) {
  const m = MODES[id] ? id : 'natural';
  return MODES[m].englishOnly && !isEnglish ? 'natural' : m;
}

export const LENGTHS = {
  short: { th: 'สั้น', prompt: 'Keep your messages short: usually one sentence, at most two.' },
  normal: { th: 'ปกติ', prompt: 'Vary length: sometimes a few words, usually 1–3 sentences.' },
  long: { th: 'ยาวขึ้น', prompt: 'You may write a little more (2–4 sentences) so the learner reads more, but never a lecture.' },
};
export const TEACHING = {
  low: { th: 'น้อย', prompt: 'Teaching intensity LOW: almost pure conversation; explanations only when asked.' },
  medium: { th: 'กลาง', prompt: 'Teaching intensity MEDIUM: mostly conversation with light teaching.' },
  high: { th: 'มาก', prompt: 'Teaching intensity HIGH: actively teach — model better phrasing in your own replies and give short tips when useful.' },
};
export const TIMINGS = {
  immediate: { th: 'ทันที (แสดงคำอธิบายเลย)' },
  after_turn: { th: 'ย่อไว้ใต้ข้อความ (แตะดู)' },
  end: { th: 'เก็บไว้ดูตอนท้าย (ไม่ขัดจังหวะ)' },
};
export const pick = (table, id, dflt) => (table[id] ? id : dflt);
