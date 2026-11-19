'use strict';
// AI javobini tekshirish, tozalash va takrorlarni olib tashlash (sof funksiyalar).

function normalize(s) {
  // Bo‘shliq va tinish belgilarisiz solishtiramiz: "2 + 2 ?" va "2+2?" bir xil savol hisoblanadi.
  return String(s).toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}

function extractJson(text) {
  const t = String(text || '').trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  try { return JSON.parse(t); } catch (_) { /* fallthrough */ }
  const a = t.indexOf('{'); const b = t.lastIndexOf('}');
  if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch (_) { /* fallthrough */ } }
  return null;
}

/** Savollarni formatga keltiradi: {q, options[4], correct, explanation?}. Yaroqsizlarini tashlaydi. */
function parseQuestions(text, { avoid = [], limit = Infinity } = {}) {
  const data = extractJson(text);
  const raw = Array.isArray(data) ? data : data && Array.isArray(data.questions) ? data.questions : null;
  if (!raw) return { questions: [], dropped: 0, error: 'invalid_json' };
  const seen = new Set(avoid.map(normalize));
  const out = [];
  let dropped = 0;
  for (const item of raw) {
    const q = typeof item?.q === 'string' ? item.q.trim() : typeof item?.question === 'string' ? item.question.trim() : '';
    const options = Array.isArray(item?.options) ? item.options.map((o) => String(o).trim()) : [];
    let correct = Number.isInteger(item?.correct) ? item.correct : Number.isInteger(item?.correctIndex) ? item.correctIndex : -1;
    const okOptions = options.length === 4 && options.every(Boolean) && new Set(options.map(normalize)).size === 4;
    const key = normalize(q);
    if (!q || !okOptions || correct < 0 || correct > 3 || seen.has(key)) { dropped++; continue; }
    seen.add(key);
    const entry = { q, options, correct };
    if (typeof item.explanation === 'string' && item.explanation.trim()) entry.explanation = item.explanation.trim();
    out.push(entry);
    if (out.length >= limit) break;
  }
  return { questions: out, dropped, error: null };
}

module.exports = { normalize, extractJson, parseQuestions };
