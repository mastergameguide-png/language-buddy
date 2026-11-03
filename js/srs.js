// Spaced repetition (a simplified SM-2). Grades: 0 forgot, 1 hard, 2 good, 3 easy.
const DAY = 86400000;

export function newCard(t = Date.now()) {
  return { due: t, ivl: 0, ease: 2.5, reps: 0, lapses: 0, last: 0 };
}

export function schedule(card, grade, now = Date.now()) {
  const c = { ...newCard(now), ...card };
  if (grade === 0) {
    c.reps = 0;
    c.lapses += 1;
    c.ivl = 0;
    c.ease = Math.max(1.3, c.ease - 0.2);
    c.due = now + 10 * 60 * 1000;           // see it again in this session
  } else {
    c.reps += 1;
    if (c.reps === 1) c.ivl = grade === 3 ? 3 : 1;
    else if (c.reps === 2) c.ivl = grade === 1 ? 3 : grade === 3 ? 8 : 6;
    else c.ivl = Math.max(c.ivl + 1, Math.round(c.ivl * c.ease * (grade === 1 ? 0.7 : grade === 3 ? 1.3 : 1)));
    c.ease = Math.min(3, Math.max(1.3, c.ease + (grade === 1 ? -0.15 : grade === 3 ? 0.1 : 0)));
    c.due = now + c.ivl * DAY;
  }
  c.last = now;
  return c;
}

// What each grade button would schedule, for the labels under the buttons.
export function preview(card, now = Date.now()) {
  return [0, 1, 2, 3].map((g) => {
    const d = schedule(card, g, now).due - now;
    return d < DAY ? 'ใน 10 นาที' : `${Math.round(d / DAY)} วัน`;
  });
}

export function status(card) {
  if (!card || !card.reps) return card && card.lapses ? 'learning' : 'new';
  return card.ivl >= 21 ? 'mastered' : 'learning';
}
export const STATUS_TH = { new: 'ใหม่', learning: 'กำลังจำ', mastered: 'จำได้แล้ว' };

export const isDue = (card, now = Date.now()) => !!card && card.due <= now;
