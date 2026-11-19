'use strict';
// AI provayderlari adapterlari. Yangi provayder qo‘shish uchun PROVIDERS ga bitta funksiya qo‘shing:
//   async (prompt, { apiKey, model }) => "AI matn javobi (JSON)"

class AiError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

async function httpJson(url, init) {
  let res;
  try { res = await fetch(url, { ...init, signal: AbortSignal.timeout(90000) }); }
  catch (e) { throw new AiError('network', `AI xizmatiga ulanib bo‘lmadi: ${e.message}`); }
  if (res.status === 429) throw new AiError('rate_limit', 'AI xizmati band yoki limit tugagan');
  if (res.status === 401 || res.status === 403) throw new AiError('auth', 'AI kaliti noto‘g‘ri yoki ruxsat yo‘q');
  if (!res.ok) throw new AiError('upstream', `AI xizmati xatosi (${res.status})`);
  return res.json();
}

const PROVIDERS = {
  async gemini(prompt, { apiKey, model }) {
    const d = await httpJson(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0.7 } }),
    });
    return d?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '';
  },

  async openai(prompt, { apiKey, model }) {
    const d = await httpJson('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, temperature: 0.7, response_format: { type: 'json_object' }, messages: [{ role: 'user', content: prompt }] }),
    });
    return d?.choices?.[0]?.message?.content || '';
  },

  async anthropic(prompt, { apiKey, model }) {
    const d = await httpJson('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model, max_tokens: 8000, messages: [{ role: 'user', content: prompt }] }),
    });
    return (d?.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
  },
};

const DEFAULT_MODELS = { gemini: 'gemini-2.5-flash', openai: 'gpt-4o-mini', anthropic: 'claude-sonnet-5-5' };

const LANG_NAMES = { uz: 'o‘zbek (lotin)', tg: 'tojik', ru: 'rus', en: 'ingliz' };
const DIFF_NAMES = { easy: 'oson', medium: 'o‘rta', hard: 'qiyin' };

function buildPrompt({ grade, subject, topic, count, difficulty, lang, avoid }) {
  return [
    `Sen maktab o‘qituvchisisan. ${grade}-sinf uchun "${subject}" fanidan "${topic}" mavzusida ${count} ta test savoli tuz.`,
    `Qiyinlik: ${DIFF_NAMES[difficulty] || difficulty}. Til: ${LANG_NAMES[lang] || lang}.`,
    'Qoidalar: har savolda aynan 4 ta bir-biridan farqli variant; faqat bitta to‘g‘ri javob; faktik jihatdan aniq; yosh darajasiga mos; savollar takrorlanmasin.',
    avoid.length ? `Quyidagi savollarga o‘xshash savol tuzma:\n- ${avoid.slice(0, 40).join('\n- ')}` : '',
    'Javobni FAQAT JSON ko‘rinishida ber: {"questions":[{"q":"...","options":["A","B","C","D"],"correct":0,"explanation":"qisqa izoh"}]} — "correct" 0..3 oralig‘idagi indeks.',
  ].filter(Boolean).join('\n');
}

module.exports = { PROVIDERS, DEFAULT_MODELS, AiError, buildPrompt };
