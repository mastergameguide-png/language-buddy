// 📊 Dashboard data: turns what this device already recorded into chart-ready series. Pure: no
// DOM, no storage, every number comes from saved records (nothing is estimated here).
import { dayKeyOf } from './analytics.js';

export const RANGES = [7, 30, 90];
const DAY = 86400000;
const startOfDay = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
const addDays = (t, n) => { const d = new Date(t); d.setDate(d.getDate() + n); return d.getTime(); };

// Practice level of one day, 0–4, from active minutes (a day with messages or reviews but under a
// minute still counts as 1).
export function dayLevel(d) {
  if (!d) return 0;
  const mins = (d.secs || 0) / 60;
  if (mins >= 40) return 4;
  if (mins >= 20) return 3;
  if (mins >= 10) return 2;
  return mins >= 1 || (d.msgs || 0) > 0 || (d.reviews || 0) > 0 ? 1 : 0;
}

// Calendar of the last `weeks` weeks, Monday first: columns of 7 days ({key, mins, msgs, reviews,
// level, future}). Days after today are marked `future`.
export function heatmap(days = {}, now = Date.now(), weeks = 12) {
  const today = startOfDay(now);
  const dow = (new Date(today).getDay() + 6) % 7;            // Monday = 0
  const first = addDays(today, -dow - (weeks - 1) * 7);
  const cols = [];
  for (let w = 0; w < weeks; w++) {
    const col = [];
    for (let i = 0; i < 7; i++) {
      const t = addDays(first, w * 7 + i);
      const key = dayKeyOf(new Date(t));
      const d = days[key];
      col.push({ key, t, mins: Math.round((d?.secs || 0) / 60), msgs: d?.msgs || 0, reviews: d?.reviews || 0, level: t > today ? 0 : dayLevel(d), future: t > today });
    }
    cols.push(col);
  }
  return cols;
}

// Buckets for a range: by day for 7 and 30, by week (7-day blocks ending today) for 90.
export function buckets(range, now = Date.now()) {
  const today = startOfDay(now);
  const size = range > 30 ? 7 : 1;
  const n = Math.ceil(range / size);
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const end = addDays(today, -i * size);
    const start = addDays(end, -(size - 1));
    out.push({ start, end: end + DAY - 1, keys: Array.from({ length: size }, (_, j) => dayKeyOf(new Date(addDays(start, j)))) });
  }
  return { size, list: out };
}

// XP per bucket from the per-day XP map (engine/levels.js totalXp().perDay).
export function xpSeries(perDay = {}, range = 30, now = Date.now()) {
  const { size, list } = buckets(range, now);
  return { size, points: list.map((b) => ({ start: b.start, end: b.end, value: b.keys.reduce((s, k) => s + (perDay[k] || 0), 0) })) };
}

// Words in the word bank at the end of each bucket (from each word's added time).
export function vocabGrowth(vocab = [], range = 30, now = Date.now()) {
  const { size, list } = buckets(range, now);
  const times = vocab.map((v) => Number(v.t) || 0).sort((a, b) => a - b);
  return { size, points: list.map((b) => ({ start: b.start, end: b.end, value: times.filter((t) => t <= b.end).length })) };
}

// IELTS practice in the range. Speaking and Writing: the practice band. Reading and Listening:
// percent correct of a short set (never turned into a band).
export function ieltsSeries(ielts = [], range = 30, now = Date.now()) {
  const since = addDays(startOfDay(now), -(range - 1));
  const inRange = ielts.filter((a) => a && a.t >= since && a.t <= now).sort((a, b) => a.t - b.t);
  const band = (kind) => inRange.filter((a) => a.kind === kind && Number.isFinite(a.overall)).map((a) => ({ t: a.t, value: a.overall }));
  const pct = (kind) => inRange.filter((a) => a.kind === kind && a.total > 0).map((a) => ({ t: a.t, value: Math.round((a.score / a.total) * 100), score: a.score, total: a.total }));
  return { since, speaking: band('speaking'), writing: band('writing'), reading: pct('reading'), listening: pct('listening') };
}

// Mistakes saved in this range against the same length just before it, per category.
export function mistakeTrend(mistakes = [], range = 30, now = Date.now(), limit = 6) {
  const since = addDays(startOfDay(now), -(range - 1));
  const before = addDays(since, -range);
  const cur = {}, prev = {};
  for (const m of mistakes) {
    const t = Number(m?.t) || 0;
    const c = m?.category || 'other';
    if (t >= since && t <= now) cur[c] = (cur[c] || 0) + 1;
    else if (t >= before && t < since) prev[c] = (prev[c] || 0) + 1;
  }
  const cats = [...new Set([...Object.keys(cur), ...Object.keys(prev)])];
  const rows = cats.map((c) => ({ category: c, now: cur[c] || 0, before: prev[c] || 0 })).filter((r) => r.now > 0)
    .sort((a, b) => b.now - a.now || a.category.localeCompare(b.category));
  return { since, rows: rows.slice(0, limit), total: rows.reduce((s, r) => s + r.now, 0), totalBefore: Object.values(prev).reduce((s, n) => s + n, 0) };
}

// Totals for the headline tiles in the range.
export function rangeTotals(days = {}, perDay = {}, range = 30, now = Date.now()) {
  const keys = buckets(range, now).list.flatMap((b) => b.keys);
  let secs = 0, msgs = 0, reviews = 0, active = 0, xp = 0;
  for (const k of keys) {
    const d = days[k];
    xp += perDay[k] || 0;
    if (!d) continue;
    secs += d.secs || 0; msgs += d.msgs || 0; reviews += d.reviews || 0;
    if (dayLevel(d) > 0) active += 1;
  }
  return { secs, msgs, reviews, active, xp, days: keys.length };
}

// "Nice" upper bound and ticks for a 0-based axis.
export function niceMax(v) {
  if (!(v > 0)) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}
