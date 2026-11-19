'use strict';
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret, defineString } = require('firebase-functions/params');
const admin = require('firebase-admin');
const { PROVIDERS, DEFAULT_MODELS, AiError, buildPrompt } = require('./providers');
const { parseQuestions } = require('./validate');

admin.initializeApp();

// Kalit faqat serverda: `firebase functions:secrets:set AI_API_KEY`
const AI_API_KEY = defineSecret('AI_API_KEY');
const AI_PROVIDER = defineString('AI_PROVIDER', { default: 'gemini' }); // gemini | openai | anthropic
const AI_MODEL = defineString('AI_MODEL', { default: '' });

const SUBJECT_NAMES = {
  math: 'Matematika', informatics: 'Informatika', nature: 'Tabiatshunoslik', mothertongue: 'Ona tili',
  english: 'Ingliz tili', history: 'Tarix', physics: 'Fizika', chemistry: 'Kimyo',
};

const FRIENDLY = {
  network: 'AI xizmatiga hozir ulanib bo‘lmadi. Birozdan so‘ng qayta urinib ko‘ring.',
  rate_limit: 'AI xizmati hozir band yoki limit tugagan. Keyinroq urinib ko‘ring.',
  auth: 'AI xizmati kaliti sozlanmagan yoki noto‘g‘ri. Administrator sozlamalarini tekshiring.',
  upstream: 'AI xizmati vaqtincha ishlamayapti. Keyinroq urinib ko‘ring.',
};

exports.generateTest = onCall({ secrets: [AI_API_KEY], region: 'europe-west1', timeoutSeconds: 120, memory: '256MiB' }, async (req) => {
  if (!req.auth?.token?.admin) throw new HttpsError('permission-denied', 'Faqat administrator AI test yarata oladi.');

  const d = req.data || {};
  const grade = Number(d.grade);
  const count = Number(d.count);
  const subject = SUBJECT_NAMES[d.subjectId];
  const topic = String(d.topic || '').trim().slice(0, 120);
  if (!Number.isInteger(grade) || grade < 1 || grade > 11) throw new HttpsError('invalid-argument', 'Sinf 1–11 oralig‘ida bo‘lishi kerak.');
  if (!subject) throw new HttpsError('invalid-argument', 'Noto‘g‘ri fan.');
  if (!topic) throw new HttpsError('invalid-argument', 'Mavzuni kiriting.');
  if (!Number.isInteger(count) || count < 1 || count > 30) throw new HttpsError('invalid-argument', 'Savollar soni 1–30 oralig‘ida bo‘lsin.');
  if (!['easy', 'medium', 'hard'].includes(d.difficulty)) throw new HttpsError('invalid-argument', 'Noto‘g‘ri qiyinlik.');
  if (!['uz', 'tg', 'ru', 'en'].includes(d.lang)) throw new HttpsError('invalid-argument', 'Noto‘g‘ri til.');

  const providerName = AI_PROVIDER.value();
  const provider = PROVIDERS[providerName];
  if (!provider) throw new HttpsError('failed-precondition', 'AI provayderi noto‘g‘ri sozlangan.');
  const model = AI_MODEL.value() || DEFAULT_MODELS[providerName];

  // Takrorlarni kamaytirish: shu fan/mavzudagi mavjud savollar
  const db = admin.firestore();
  const prev = await db.collection('AIGeneratedTests').where('subjectId', '==', d.subjectId).where('grade', '==', grade).limit(30).get();
  const avoid = [];
  prev.forEach((s) => (s.data().questions || []).forEach((x) => avoid.push(x.q)));

  const prompt = buildPrompt({ grade, subject, topic, count, difficulty: d.difficulty, lang: d.lang, avoid });

  let questions = [];
  try {
    // Dublikatlar tushib ketsa, bir marta qo‘shimcha urinamiz.
    for (let attempt = 0; attempt < 2 && questions.length < count; attempt++) {
      const text = await provider(prompt, { apiKey: AI_API_KEY.value(), model });
      const { questions: got } = parseQuestions(text, { avoid: [...avoid, ...questions.map((x) => x.q)], limit: count - questions.length });
      questions = questions.concat(got);
    }
  } catch (e) {
    if (e instanceof AiError) throw new HttpsError('unavailable', FRIENDLY[e.code] || FRIENDLY.upstream);
    console.error(e);
    throw new HttpsError('internal', 'Kutilmagan xatolik. Qayta urinib ko‘ring.');
  }
  if (!questions.length) throw new HttpsError('unavailable', 'AI yaroqli savollar qaytarmadi. Mavzuni o‘zgartirib qayta urinib ko‘ring.');

  const doc = {
    status: 'draft', grade, subjectId: d.subjectId, topic, difficulty: d.difficulty, lang: d.lang,
    requestedCount: count, questions, provider: providerName, model,
    createdBy: req.auth.uid, createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  const ref = await db.collection('AIGeneratedTests').add(doc);
  return { id: ref.id, count: questions.length, requested: count };
});
