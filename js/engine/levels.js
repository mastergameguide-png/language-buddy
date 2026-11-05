// Lv. system: XP is worked out from what this device already measured (active time, messages,
// reviews, voice practice, IELTS practice, days in a row). Nothing is guessed or added by AI.
// Every 5 Lv. there is a gate test (English only for now), checked offline; the Lv. stops at the
// gate until the test is passed, while XP keeps adding up. Pure: no DOM, no storage.
import { dayKeyOf } from './analytics.js';

// XP for one day of stats. Each kind is capped so one very long day cannot replace steady practice.
export const XP_RULES = [
  { key: 'mins', th: 'เวลาเรียน', per: 'นาที', xp: 1, cap: 60 },
  { key: 'msgs', th: 'ข้อความที่คุย', per: 'ข้อความ', xp: 2, cap: 100 },
  { key: 'reviews', th: 'ทบทวน', per: 'ข้อ', xp: 1, cap: 50 },
  { key: 'voice', th: 'พูดตาม / ฟัง', per: 'ประโยค', xp: 1, cap: 30 },
  { key: 'ielts', th: 'ฝึก IELTS', per: 'ครั้ง', xp: 15, cap: 45 },
];
export const DAY_BONUS = 10;                 // a day with real practice
export const STREAK_XP = 2;                  // × days in a row, up to STREAK_CAP
export const STREAK_CAP = 10;
export const GATE_EVERY = 5;
export const PASS = 10;                       // out of 12
export const TRIES_PER_DAY = 3;

export const isActiveDay = (d) => !!d && ((d.msgs || 0) > 0 || (d.reviews || 0) > 0 || (d.secs || 0) >= 120);

function dayXp(d, ieltsCount, inRow) {
  const amount = { mins: Math.floor((d.secs || 0) / 60), msgs: d.msgs || 0, reviews: d.reviews || 0, voice: (d.shadow || 0) + (d.listen || 0), ielts: ieltsCount };
  const parts = {};
  let total = 0;
  for (const r of XP_RULES) { parts[r.key] = Math.min(r.cap, amount[r.key] * r.xp); total += parts[r.key]; }
  const active = isActiveDay(d) || ieltsCount > 0;
  parts.bonus = active ? DAY_BONUS + STREAK_XP * Math.min(STREAK_CAP, inRow) : 0;
  return { total: total + parts.bonus, parts, active };
}

const nextKey = (k) => { const [y, m, d] = k.split('-').map(Number); return dayKeyOf(new Date(y, m - 1, d + 1)); };

// days: { 'YYYY-MM-DD': {secs, msgs, …} }; ielts: [{t}]. Returns the total and a per-kind breakdown.
export function totalXp(days = {}, ielts = []) {
  const perDayIelts = {};
  for (const a of ielts) if (Number(a?.t)) { const k = dayKeyOf(new Date(a.t)); perDayIelts[k] = (perDayIelts[k] || 0) + 1; }
  const keys = [...new Set([...Object.keys(days), ...Object.keys(perDayIelts)])].filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(k)).sort();
  const by = Object.fromEntries([...XP_RULES.map((r) => [r.key, 0]), ['bonus', 0]]);
  let xp = 0, inRow = 0, prev = null, best = 0, activeDays = 0;
  for (const k of keys) {
    const d = days[k] || {};
    const active = isActiveDay(d) || perDayIelts[k] > 0;
    inRow = active ? (prev && nextKey(prev) === k ? inRow + 1 : 1) : 0;
    if (active) { prev = k; activeDays += 1; best = Math.max(best, inRow); }
    const r = dayXp(d, perDayIelts[k] || 0, inRow);
    xp += r.total;
    for (const [p, v] of Object.entries(r.parts)) by[p] += v;
  }
  return { xp, by, activeDays, bestRow: best };
}

// XP needed to go from Lv. n to n + 1.
export const needFor = (n) => 100 + 20 * (n - 1);
// Total XP needed to reach Lv. n (Lv. 1 needs 0).
export const xpToReach = (n) => { let s = 0; for (let i = 1; i < n; i++) s += needFor(i); return s; };

export function rawLevel(xp) {
  let lv = 1;
  while (xp >= xpToReach(lv + 1)) lv += 1;
  return lv;
}

// The Lv. shown: limited by the first gate not passed yet. `gates` false = no gates (not English).
export function levelInfo(xp, passed = [], gates = true) {
  const raw = rawLevel(xp);
  let lv = raw, gate = null;
  if (gates) {
    for (let g = GATE_EVERY; g < raw; g += GATE_EVERY) if (!passed.includes(g)) { lv = g; gate = g; break; }
    if (!gate && raw % GATE_EVERY === 0 && !passed.includes(raw)) gate = raw;   // reached a gate; not blocked yet
  }
  const blocked = gate != null && raw > gate;
  const from = xpToReach(lv), to = xpToReach(lv + 1);
  return {
    lv, raw, gate, blocked,
    // ready: the test can be taken now (at a gate Lv.). The next Lv. waits for it.
    ready: gate != null && lv === gate,
    into: Math.max(0, xp - from), need: to - from, xp,
    banked: blocked ? xp - xpToReach(gate) : 0,
    tier: tierOf(gate || nextGate(lv)),
  };
}
export const nextGate = (lv) => Math.ceil((lv + 1) / GATE_EVERY) * GATE_EVERY;
export const tierOf = (gate) => (gate <= 5 ? 'A2' : gate <= 10 ? 'B1' : gate <= 15 ? 'B2' : 'C1');

export function triesToday(tries = [], gate, now = Date.now()) {
  const k = dayKeyOf(new Date(now));
  return tries.filter((t) => t.gate === gate && dayKeyOf(new Date(t.t)) === k).length;
}

export function cleanLevels(v) {
  const o = v && typeof v === 'object' ? v : {};
  const passed = [...new Set((Array.isArray(o.passed) ? o.passed : []).map(Number).filter((g) => g > 0 && g % GATE_EVERY === 0 && g <= 500))].sort((a, b) => a - b);
  const tries = (Array.isArray(o.tries) ? o.tries : []).filter((t) => t && Number(t.t) > 0 && Number(t.gate) > 0)
    .map((t) => { const total = Math.max(1, Math.min(50, Math.floor(Number(t.total) || 12))); return { t: Number(t.t), gate: Number(t.gate), score: Math.max(0, Math.min(total, Math.floor(Number(t.score) || 0))), total }; })
    .sort((a, b) => a.t - b.t).slice(-60);
  return { passed, tries };
}
// Two devices: keep every gate either one passed and every try either one made.
export function mergeLevels(a, b) {
  const x = cleanLevels(a), y = cleanLevels(b);
  const tries = [...new Map([...x.tries, ...y.tries].map((t) => [`${t.t}:${t.gate}`, t])).values()];
  return cleanLevels({ passed: [...x.passed, ...y.passed], tries });
}
