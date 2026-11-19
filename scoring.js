// Sof mantiq (brauzersiz): ball, daraja, medal, yutuqlar, reyting identifikatorlari.
import { DEFAULT_THRESHOLDS } from './config.js';

const DIFF_MULT = { easy: 1, medium: 1.5, hard: 2 };

/** Bitta to‘g‘ri javob uchun ball. streak — shu javobni qo‘shib, ketma-ket to‘g‘rilar soni. */
export function pointsFor(difficulty, streak) {
  const base = Math.round(10 * (DIFF_MULT[difficulty] || 1));
  const bonus = Math.min(Math.max(streak - 1, 0), 5) * 2; // 2-javobdan boshlab +2, ko‘pi bilan +10
  return { base, bonus, total: base + bonus };
}

export function tierFor(percent, th = DEFAULT_THRESHOLDS) {
  if (percent >= th.gold) return 'gold';
  if (percent >= th.silver) return 'silver';
  if (percent >= th.bronze) return 'bronze';
  return 'participant';
}

export const TIERS = {
  gold: { label: 'OLTIN KUBOK', icon: '🏆', color: '#f5c542' },
  silver: { label: 'KUMUSH MEDAL', icon: '🥈', color: '#c0c7d1' },
  bronze: { label: 'BRONZA MEDAL', icon: '🥉', color: '#cd7f32' },
  participant: { label: 'ISHTIROKCHI SERTIFIKATI', icon: '📜', color: '#7fb3ff' },
};

export function levelFromXp(xp) { return 1 + Math.floor(Math.sqrt(Math.max(xp, 0) / 40)); }
export function xpForLevel(level) { return 40 * Math.pow(level - 1, 2); }
export function levelProgress(xp) {
  const l = levelFromXp(xp);
  const from = xpForLevel(l), to = xpForLevel(l + 1);
  return { level: l, from, to, ratio: (xp - from) / (to - from) };
}

export function validateThresholds(t) {
  const { gold, silver, bronze } = t;
  const ok = [gold, silver, bronze].every((n) => Number.isFinite(n) && n >= 1 && n <= 100) && gold > silver && silver > bronze;
  return ok;
}

export const ACHIEVEMENTS = [
  { id: 'first_test', icon: '🌱', title: 'Birinchi qadam', desc: 'Birinchi testni yakunlang', check: (p) => p.testsDone >= 1 },
  { id: 'streak5', icon: '🔥', title: 'Olovli seriya', desc: 'Ketma-ket 5 ta to‘g‘ri javob', check: (p, r) => r.maxStreak >= 5 },
  { id: 'perfect', icon: '💯', title: 'Mukammal', desc: 'Testni 100% bajaring', check: (p, r) => r.percent === 100 && r.total >= 3 },
  { id: 'gold', icon: '🏆', title: 'Oltin kubok', desc: 'Oltin kubok yutib oling', check: (p) => (p.medals?.gold || 0) >= 1 },
  { id: 'level5', icon: '⭐', title: '5-daraja', desc: '5-darajaga yeting', check: (p) => p.level >= 5 },
  { id: 'explorer', icon: '🧭', title: 'Tadqiqotchi', desc: '3 xil fandan test topshiring', check: (p) => (p.subjectsPlayed || []).length >= 3 },
  { id: 'ten_tests', icon: '📚', title: 'Tirishqoq', desc: '10 ta test topshiring', check: (p) => p.testsDone >= 10 },
  { id: 'hundred', icon: '🎯', title: 'Aniq nishon', desc: 'Jami 100 ta to‘g‘ri javob', check: (p) => p.correctTotal >= 100 },
];

/** Natijani profil statistikasiga qo‘shadi (sof funksiya) va yangi yutuqlarni qaytaradi. */
export function applyResult(profile, result, subjectId) {
  const p = {
    xp: profile.xp || 0,
    totalScore: profile.totalScore || 0,
    testsDone: profile.testsDone || 0,
    correctTotal: profile.correctTotal || 0,
    subjectsPlayed: [...(profile.subjectsPlayed || [])],
    medals: { gold: 0, silver: 0, bronze: 0, participant: 0, ...(profile.medals || {}) },
    achievements: [...(profile.achievements || [])],
  };
  p.xp += result.score;
  p.totalScore += result.score;
  p.testsDone += 1;
  p.correctTotal += result.correct;
  if (!p.subjectsPlayed.includes(subjectId)) p.subjectsPlayed.push(subjectId);
  p.medals[result.tier] += 1;
  p.level = levelFromXp(p.xp);
  const newly = ACHIEVEMENTS.filter((a) => !p.achievements.includes(a.id) && a.check(p, result)).map((a) => a.id);
  p.achievements.push(...newly);
  return { profile: p, newAchievements: newly, leveledUp: p.level > levelFromXp(profile.xp || 0) };
}

// ISO hafta/oy identifikatorlari (UTC bo‘yicha)
export function weekId(d = new Date()) {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t - yearStart) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}
export function monthId(d = new Date()) { return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`; }
export function boardIds(subjectId, d = new Date()) {
  return ['all', `week_${weekId(d)}`, `month_${monthId(d)}`, `subject_${subjectId}`];
}

export function shuffle(arr, rnd = Math.random) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
/** Variantlarni aralashtiradi, to‘g‘ri javob indeksini saqlab qoladi. */
export function shuffleQuestion(q, rnd = Math.random) {
  const idx = shuffle(q.options.map((_, i) => i), rnd);
  return { ...q, options: idx.map((i) => q.options[i]), correct: idx.indexOf(q.correct) };
}
