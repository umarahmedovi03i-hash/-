import { onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { doc, getDoc, setDoc, updateDoc, addDoc, collection, query, where, orderBy, limit, getDocs, serverTimestamp, increment } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js';
import { auth, db, storage, isConfigured } from './firebase.js';
import { SUBJECTS, DIFFICULTIES, LANGS, DEFAULT_SETTINGS, AVATAR_PRESETS, IMAGE_RULES, SAMPLE_BANK } from './config.js';
import { pointsFor, tierFor, TIERS, levelProgress, ACHIEVEMENTS, applyResult, boardIds, shuffle, shuffleQuestion } from './scoring.js';
import { audio } from './audio.js';
import { confetti, stopConfetti } from './confetti.js';
import { certificatePdfBlob, downloadBlob } from './certificate.js';
import { h, toast, state, avatarEl, subjectById, fmtDate, tsToDate } from './shared.js';
import { renderAdmin } from './admin.js';

const app = document.getElementById('app');
const header = document.getElementById('header');

/* ---------------------------- yordamchilar ---------------------------- */
const AUTH_ERR = {
  'auth/invalid-credential': 'Email yoki parol noto‘g‘ri.', 'auth/wrong-password': 'Email yoki parol noto‘g‘ri.', 'auth/user-not-found': 'Email yoki parol noto‘g‘ri.',
  'auth/email-already-in-use': 'Bu email allaqachon ro‘yxatdan o‘tgan.', 'auth/weak-password': 'Parol kamida 6 ta belgi bo‘lsin.',
  'auth/invalid-email': 'Email noto‘g‘ri.', 'auth/network-request-failed': 'Internet bilan aloqa yo‘q.', 'auth/too-many-requests': 'Juda ko‘p urinish. Birozdan so‘ng qayta urining.',
};
const authMsg = (e) => AUTH_ERR[e?.code] || 'Xatolik yuz berdi. Qayta urinib ko‘ring.';

async function loadSettings() {
  try {
    const s = await getDoc(doc(db, 'Settings', 'global'));
    if (s.exists()) {
      const d = s.data();
      state.settings = { thresholds: { ...DEFAULT_SETTINGS.thresholds, ...(d.thresholds || {}) }, defaultDuck: d.defaultDuck || 'duck' };
    }
  } catch (_) { /* standart sozlamalar */ }
  if (!localStorage.getItem('tm_audio_v1')) audio.setDuck(state.settings.defaultDuck);
}
async function loadMusic() {
  try {
    const snap = await getDocs(query(collection(db, 'Music'), orderBy('createdAt', 'desc')));
    audio.setUploaded(snap.docs.map((d) => ({ id: d.id, title: d.data().title, url: d.data().url })));
  } catch (_) { audio.setUploaded([]); }
}
async function loadProfile(user, fallback) {
  const r = doc(db, 'Profiles', user.uid);
  const s = await getDoc(r);
  if (s.exists()) return s.data();
  const p = { displayName: (fallback?.name || user.email.split('@')[0]).slice(0, 40), grade: fallback?.grade || 5, photoURL: null, avatarEmoji: '🦊', xp: 0, level: 1, totalScore: 0, testsDone: 0, correctTotal: 0, subjectsPlayed: [], medals: { gold: 0, silver: 0, bronze: 0, participant: 0 }, achievements: [], createdAt: serverTimestamp() };
  await setDoc(r, p);
  return (await getDoc(r)).data();
}

/* ---------------------------- sarlavha va musiqa paneli ---------------------------- */
let offAudio = null;
function renderHeader() {
  header.replaceChildren();
  if (!state.user) return;
  const p = state.profile, lp = levelProgress(p.xp || 0);
  const musicBtn = h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Musiqa sozlamalari', onclick: () => pop.classList.toggle('hidden') }, audio.state.enabled ? '🎵' : '🔇');
  const pop = h('div', { class: 'music-pop hidden' });
  const drawPop = () => {
    pop.replaceChildren(
      h('button', { class: 'btn small', type: 'button', onclick: () => { audio.toggle(); } }, audio.state.enabled ? 'O‘chirish' : 'Yoqish'),
      h('label', { class: 'field' }, h('span', {}, 'Ovoz balandligi'), h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: audio.state.volume, oninput: (e) => audio.setVolume(+e.target.value) })),
      h('label', { class: 'field' }, h('span', {}, 'Musiqa'), h('select', { onchange: (e) => audio.setTrack(e.target.value) }, audio.tracks().map((t) => h('option', { value: t.id, selected: t.id === audio.state.trackId }, t.title)))),
      h('label', { class: 'field' }, h('span', {}, 'Test vaqtida'), h('select', { onchange: (e) => audio.setDuck(e.target.value) }, [['duck', 'Pasaytirish'], ['off', 'O‘chirish'], ['keep', 'O‘zgartirmaslik']].map(([k, v]) => h('option', { value: k, selected: audio.state.duck === k }, v)))),
      h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: audio.state.sfx, onchange: (e) => audio.setSfx(e.target.checked) }), ' Ovozli effektlar'));
  };
  drawPop();
  offAudio?.();
  offAudio = audio.onChange(() => { musicBtn.textContent = audio.state.enabled ? '🎵' : '🔇'; if (pop.classList.contains('hidden')) drawPop(); });
  header.append(
    h('a', { class: 'brand', href: '#/home' }, '🍏 TestMaktab'),
    h('nav', { class: 'nav' },
      h('a', { href: '#/home' }, 'Fanlar'), h('a', { href: '#/leaderboard' }, 'Reyting'), h('a', { href: '#/profile' }, 'Profil'), state.isAdmin && h('a', { href: '#/admin' }, 'Admin')),
    h('div', { class: 'header-right' },
      h('a', { class: 'me', href: '#/profile' }, avatarEl(p, 38), h('div', { class: 'me-info' }, h('strong', {}, p.displayName), h('div', { class: 'xpbar', title: `${p.xp || 0} XP` }, h('i', { style: { width: `${Math.round(lp.ratio * 100)}%` } })), h('small', {}, `${lp.level}-daraja`))),
      h('div', { class: 'music-wrap' }, musicBtn, pop),
      h('button', { class: 'btn small', type: 'button', onclick: () => signOut(auth) }, 'Chiqish')));
}

/* ---------------------------- marshrutlash ---------------------------- */
async function route() {
  stopConfetti();
  if (!isConfigured) return renderSetup();
  if (!state.user) return renderAuth();
  if (!state.profile) return;
  const [, page, arg] = (location.hash || '#/home').split('/');
  if (page !== 'quiz') audio.setMode('normal');
  app.replaceChildren();
  app.className = 'view';
  renderHeader();
  switch (page) {
    case 'subject': return renderSubject(arg);
    case 'quiz': return state.quiz ? renderQuestion() : (location.hash = '#/home');
    case 'ceremony': return state.ceremony ? renderCeremony(state.ceremony) : (location.hash = '#/home');
    case 'profile': return renderProfile();
    case 'leaderboard': return renderLeaderboard();
    case 'admin': return renderAdmin(app, { reloadMusic: loadMusic, reloadSettings: loadSettings });
    default: return renderHome();
  }
}
window.addEventListener('hashchange', route);

function renderSetup() {
  header.replaceChildren(); app.replaceChildren(h('section', { class: 'panel narrow' }, h('h1', {}, '🔧 Firebase sozlanmagan'),
    h('p', {}, 'public/js/firebase.js faylida firebaseConfig qiymatlarini o‘z loyihangiznikiga almashtiring (README dagi 1-qadam).')));
}

/* ---------------------------- kirish / ro‘yxatdan o‘tish ---------------------------- */
function renderAuth() {
  header.replaceChildren(); app.className = 'view auth-view';
  let mode = 'login';
  const msg = h('p', { class: 'error', role: 'alert' });
  const name = h('input', { type: 'text', maxlength: 40, placeholder: 'Ismingiz', autocomplete: 'name' });
  const grade = h('select', {}, Array.from({ length: 11 }, (_, i) => h('option', { value: i + 1, selected: i === 4 }, `${i + 1}-sinf`)));
  const email = h('input', { type: 'email', placeholder: 'Email', autocomplete: 'email', required: true });
  const pass = h('input', { type: 'password', placeholder: 'Parol (kamida 6 belgi)', autocomplete: 'current-password', required: true });
  const extra = h('div', { class: 'hidden' }, name, grade);
  const submit = h('button', { class: 'btn primary big', type: 'submit' }, 'Kirish');
  const toggle = h('button', { class: 'link', type: 'button' }, 'Ro‘yxatdan o‘tish');
  toggle.addEventListener('click', () => {
    mode = mode === 'login' ? 'register' : 'login';
    extra.classList.toggle('hidden', mode === 'login'); submit.textContent = mode === 'login' ? 'Kirish' : 'Ro‘yxatdan o‘tish';
    toggle.textContent = mode === 'login' ? 'Ro‘yxatdan o‘tish' : 'Akkauntim bor';
    pass.autocomplete = mode === 'login' ? 'current-password' : 'new-password'; msg.textContent = '';
  });
  const form = h('form', { class: 'panel narrow auth-card', novalidate: true },
    h('div', { class: 'auth-fruits', 'aria-hidden': 'true' }, '🍎🍊🍓🍌🌍🤖'), h('h1', {}, 'TestMaktab'), h('p', { class: 'muted' }, 'Bilimingni o‘yin bilan sina!'), extra, email, pass, msg, submit, toggle);
  form.addEventListener('submit', async (e) => {
    e.preventDefault(); msg.textContent = '';
    if (mode === 'register') {
      if (!name.value.trim()) return (msg.textContent = 'Ismingizni kiriting.');
      if (pass.value.length < 6) return (msg.textContent = 'Parol kamida 6 ta belgi bo‘lsin.');
    }
    submit.disabled = true;
    try {
      if (mode === 'register') { state.pending = { name: name.value.trim().slice(0, 40), grade: +grade.value }; await createUserWithEmailAndPassword(auth, email.value.trim(), pass.value); }
      else await signInWithEmailAndPassword(auth, email.value.trim(), pass.value);
    } catch (err) { msg.textContent = authMsg(err); }
    submit.disabled = false;
  });
  app.replaceChildren(form);
}

/* ---------------------------- bosh sahifa: meva kartochkalari ---------------------------- */
function renderHome() {
  const p = state.profile;
  app.append(
    h('section', { class: 'hero' }, h('h1', {}, `Salom, ${p.displayName}! 👋`), h('p', { class: 'muted' }, 'Bugun qaysi mevani “terib” olamiz? Fanni tanla va testni boshla.')),
    h('div', { class: 'fruit-grid' }, SUBJECTS.map((s, i) =>
      h('a', { class: 'fruit-card', href: `#/subject/${s.id}`, style: { '--c': s.color, '--d': `${i * 0.12}s` } },
        h('span', { class: 'fruit-icon' }, s.icon), h('strong', {}, s.name), h('small', {}, 'Testlarni ochish')))),
    h('section', { class: 'panel stats-strip' },
      stat('⭐', `${p.level || 1}-daraja`), stat('🎯', `${p.totalScore || 0} ball`), stat('✅', `${p.correctTotal || 0} to‘g‘ri`), stat('🏅', `${(p.medals?.gold || 0) + (p.medals?.silver || 0) + (p.medals?.bronze || 0)} medal`)));
}
const stat = (icon, text) => h('div', { class: 'stat' }, h('span', {}, icon), h('b', {}, text));

/* ---------------------------- fan: testlar ro‘yxati ---------------------------- */
async function renderSubject(id) {
  const s = subjectById(id);
  const list = h('div', { class: 'test-list' }, h('p', { class: 'muted' }, 'Yuklanmoqda…'));
  app.append(h('a', { class: 'back', href: '#/home' }, '← Fanlar'), h('div', { class: 'subject-head', style: { '--c': s.color } }, h('span', { class: 'fruit-icon big' }, s.icon), h('h1', {}, s.name)), list);
  const items = [];
  if (SAMPLE_BANK[id]?.length) items.push({ id: `sample_${id}`, title: 'Tezkor test', meta: 'Ichki savollar', difficulty: 'easy', questions: SAMPLE_BANK[id], sub: id });
  try {
    const snap = await getDocs(query(collection(db, 'AIGeneratedTests'), where('status', '==', 'approved'), where('subjectId', '==', id)));
    snap.forEach((d) => { const t = d.data(); items.push({ id: d.id, title: t.topic, meta: `${t.grade}-sinf • ${DIFFICULTIES[t.difficulty]} • ${LANGS[t.lang]} • ${t.questions.length} ta savol`, difficulty: t.difficulty, questions: t.questions, grade: t.grade, sub: id }); });
  } catch (_) { toast('Testlarni yuklab bo‘lmadi', 'error'); }
  items.sort((a, b) => Math.abs((a.grade ?? state.profile.grade) - state.profile.grade) - Math.abs((b.grade ?? state.profile.grade) - state.profile.grade));
  list.replaceChildren(...(items.length ? items.map((t) => h('button', { class: 'test-item', type: 'button', onclick: () => startQuiz(t) }, h('div', {}, h('strong', {}, t.title), h('small', {}, t.meta)), h('span', { class: 'go' }, '▶'))) : [h('p', { class: 'muted' }, 'Bu fan uchun hali test yo‘q.')]));
}

/* ---------------------------- test jarayoni ---------------------------- */
function startQuiz(t) {
  state.quiz = { test: t, qs: shuffle(t.questions).map((q) => shuffleQuestion(q)), i: 0, score: 0, correct: 0, streak: 0, maxStreak: 0, answered: false };
  audio.setMode('quiz');
  location.hash = '#/quiz';
}

function renderQuestion() {
  const Q = state.quiz, q = Q.qs[Q.i], total = Q.qs.length;
  Q.answered = false;
  const score = h('b', {}, Q.score), streak = h('b', {}, Q.streak);
  const fb = h('div', { class: 'feedback', 'aria-live': 'polite' });
  const next = h('button', { class: 'btn primary hidden', type: 'button' }, Q.i + 1 === total ? 'Yakunlash 🏁' : 'Keyingisi →');
  const letters = ['A', 'B', 'C', 'D'];
  const btns = q.options.map((o, oi) => h('button', { class: 'option', type: 'button', onclick: () => answer(oi) }, h('span', { class: 'letter' }, letters[oi]), h('span', {}, o)));
  function answer(oi) {
    if (Q.answered) return; Q.answered = true;
    const ok = oi === q.correct;
    btns.forEach((b, i) => { b.disabled = true; if (i === q.correct) b.classList.add('right'); });
    if (ok) {
      Q.streak++; Q.maxStreak = Math.max(Q.maxStreak, Q.streak); Q.correct++;
      const pts = pointsFor(Q.test.difficulty, Q.streak); Q.score += pts.total;
      fb.className = 'feedback ok'; fb.replaceChildren(h('strong', {}, `✔ To‘g‘ri! +${pts.total}`), pts.bonus ? h('span', { class: 'bonus' }, ` 🔥 seriya bonusi +${pts.bonus}`) : null);
      audio.sfxPlay('correct'); if (Q.streak >= 3) btns[oi].classList.add('pulse');
    } else {
      Q.streak = 0; btns[oi].classList.add('wrong'); fb.className = 'feedback bad'; fb.replaceChildren(h('strong', {}, '✖ Noto‘g‘ri'), h('span', {}, ` To‘g‘ri javob: ${q.options[q.correct]}`)); audio.sfxPlay('wrong');
    }
    if (q.explanation) fb.append(h('p', { class: 'explain' }, q.explanation));
    score.textContent = Q.score; streak.textContent = Q.streak; next.classList.remove('hidden'); next.focus();
  }
  next.addEventListener('click', () => { Q.i++; if (Q.i >= total) finishQuiz(); else { app.replaceChildren(); renderHeader(); renderQuestion(); } });
  app.className = 'view quiz-view';
  app.append(
    h('div', { class: 'quiz-top' }, h('button', { class: 'btn small', type: 'button', onclick: () => { if (confirm('Testdan chiqasizmi? Natija saqlanmaydi.')) { state.quiz = null; location.hash = '#/home'; } } }, '✕ Chiqish'),
      h('div', { class: 'progress' }, h('i', { style: { width: `${(Q.i / total) * 100}%` } })), h('span', { class: 'qcount' }, `${Q.i + 1}/${total}`)),
    h('div', { class: 'quiz-stats' }, h('span', {}, '🎯 ', score), h('span', {}, '🔥 ', streak)),
    h('section', { class: 'panel question' }, h('h2', {}, q.q), h('div', { class: 'options' }, btns), fb, next));
}

async function finishQuiz() {
  const Q = state.quiz, total = Q.qs.length;
  const percent = Math.round((Q.correct / total) * 100);
  const tier = tierFor(percent, state.settings.thresholds);
  const result = { score: Q.score, correct: Q.correct, total, percent, maxStreak: Q.maxStreak, tier };
  const subj = Q.test.sub, s = subjectById(subj);
  const { profile: np, newAchievements, leveledUp } = applyResult(state.profile, result, subj);
  const uid = state.user.uid;
  const ceremony = { result, subjectName: s.name, newAchievements, leveledUp, date: fmtDate(), photoURL: state.profile.photoURL, emoji: state.profile.avatarEmoji, name: state.profile.displayName };
  try {
    await updateDoc(doc(db, 'Profiles', uid), { xp: np.xp, level: np.level, totalScore: np.totalScore, testsDone: np.testsDone, correctTotal: np.correctTotal, subjectsPlayed: np.subjectsPlayed, medals: np.medals, achievements: np.achievements });
    state.profile = { ...state.profile, ...np };
    await addDoc(collection(db, 'Certificates'), { uid, name: ceremony.name, subjectId: subj, subjectName: s.name, percent, score: result.score, correct: result.correct, total, tier, createdAt: serverTimestamp() });
    const pub = { uid, name: state.profile.displayName, photoURL: state.profile.photoURL || null, avatarEmoji: state.profile.avatarEmoji || null, grade: state.profile.grade, updatedAt: serverTimestamp() };
    await Promise.all(boardIds(subj).map((b) => setDoc(doc(db, 'Leaderboards', b, 'entries', uid), { ...pub, totalScore: increment(result.score) }, { merge: true })));
  } catch (e) { console.error(e); toast('Natija to‘liq saqlanmadi (internetni tekshiring)', 'error'); }
  state.quiz = null; state.ceremony = ceremony;
  location.hash = '#/ceremony'; // hashchange route() ni chaqiradi
}

/* ---------------------------- taqdirlash marosimi ---------------------------- */
function countUp(el, to, suffix = '', ms = 1400) {
  const t0 = performance.now();
  const f = (t) => { const k = Math.min(1, (t - t0) / ms); el.textContent = `${Math.round(to * (1 - Math.pow(1 - k, 3)))}${suffix}`; if (k < 1) requestAnimationFrame(f); };
  requestAnimationFrame(f);
}

function renderCeremony(c) {
  const { result: r } = c, tier = TIERS[r.tier];
  app.replaceChildren(); header.replaceChildren(); app.className = 'view ceremony-view';
  const pct = h('b', { class: 'big-pct' }, '0%'), sc = h('b', {}, '0'), ok = h('b', {}, `0/${r.total}`);
  const pdfBtn = h('button', { class: 'btn primary', type: 'button' }, '📄 Sertifikatni PDF yuklab olish');
  pdfBtn.addEventListener('click', async () => {
    pdfBtn.disabled = true;
    try { downloadBlob(await certificatePdfBlob({ name: c.name, subject: c.subjectName, percent: r.percent, score: r.score, correct: r.correct, total: r.total, tier: r.tier, date: c.date, photoURL: c.photoURL, emoji: c.emoji }), `sertifikat-${c.subjectName}.pdf`); }
    catch (e) { console.error(e); toast('PDF yaratib bo‘lmadi', 'error'); }
    pdfBtn.disabled = false;
  });
  const badges = c.newAchievements.map((id) => ACHIEVEMENTS.find((a) => a.id === id)).filter(Boolean);
  const scene = h('div', { class: `ceremony tier-${r.tier}`, style: { '--tc': tier.color } },
    h('div', { class: 'curtain left' }), h('div', { class: 'curtain right' }),
    h('div', { class: 'spot' }),
    h('div', { class: 'stage' },
      h('div', { class: 'winner' }, avatarEl({ photoURL: c.photoURL, avatarEmoji: c.emoji, displayName: c.name }, 132), h('h2', {}, c.name), h('p', { class: 'muted' }, c.subjectName)),
      h('div', { class: 'trophy', 'aria-label': tier.label }, tier.icon),
      h('div', { class: 'award-name' }, tier.label),
      pct,
      h('div', { class: 'result-cards' }, h('div', {}, h('small', {}, 'Ball'), sc), h('div', {}, h('small', {}, 'To‘g‘ri javoblar'), ok), h('div', {}, h('small', {}, 'Eng uzun seriya'), h('b', {}, `🔥 ${r.maxStreak}`))),
      c.leveledUp ? h('div', { class: 'levelup' }, `⭐ Yangi daraja: ${state.profile.level}!`) : null,
      badges.length ? h('div', { class: 'new-badges' }, badges.map((b) => h('span', { class: 'badge-new', title: b.desc }, `${b.icon} ${b.title}`))) : null,
      h('div', { class: 'row center actions' }, pdfBtn, h('button', { class: 'btn', type: 'button', onclick: () => { state.ceremony = null; location.hash = '#/home'; } }, 'Bosh sahifa'), h('a', { class: 'btn', href: '#/leaderboard', onclick: () => { state.ceremony = null; } }, 'Reyting'))));
  app.append(scene);
  audio.setMode('ceremony'); audio.fanfare(r.tier);
  setTimeout(() => { confetti({ count: r.tier === 'participant' ? 70 : 220, duration: r.tier === 'gold' ? 7000 : 4500 }); }, 1500);
  setTimeout(() => { countUp(pct, r.percent, '%'); countUp(sc, r.score); const t0 = performance.now(); const f = (t) => { const k = Math.min(1, (t - t0) / 1400); ok.textContent = `${Math.round(r.correct * k)}/${r.total}`; if (k < 1) requestAnimationFrame(f); }; requestAnimationFrame(f); }, 2300);
  if (badges.length) setTimeout(() => audio.sfxPlay('badge'), 3800);
  if (c.leveledUp) setTimeout(() => audio.sfxPlay('levelup'), 3200);
}

/* ---------------------------- profil ---------------------------- */
async function renderProfile() {
  const p = state.profile, uid = state.user.uid;
  const msg = h('p', { class: 'muted' });
  const avatarBox = h('div', { class: 'avatar-big' }, avatarEl(p, 120));
  const refreshAvatar = () => { avatarBox.replaceChildren(avatarEl(state.profile, 120)); renderHeader(); };
  const file = h('input', { type: 'file', accept: IMAGE_RULES.types.join(','), class: 'hidden' });
  file.addEventListener('change', async () => {
    const f = file.files[0]; file.value = '';
    if (!f) return;
    if (!IMAGE_RULES.types.includes(f.type)) return toast('Faqat JPG, PNG yoki WebP rasm', 'error');
    if (f.size > IMAGE_RULES.maxBytes) return toast('Rasm 2 MB dan oshmasin', 'error');
    msg.textContent = 'Yuklanmoqda…';
    try {
      const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[f.type];
      const path = `avatars/${uid}/avatar_${Date.now()}.${ext}`;
      const r = ref(storage, path); await uploadBytes(r, f, { contentType: f.type });
      const url = await getDownloadURL(r);
      const old = state.profile.photoPath;
      await updateDoc(doc(db, 'Profiles', uid), { photoURL: url, photoPath: path });
      if (old) deleteObject(ref(storage, old)).catch(() => {});
      state.profile = { ...state.profile, photoURL: url, photoPath: path }; refreshAvatar(); msg.textContent = ''; toast('Rasm yangilandi', 'ok');
    } catch (e) { console.error(e); msg.textContent = ''; toast('Rasmni yuklab bo‘lmadi', 'error'); }
  });
  const presets = h('div', { class: 'presets' }, AVATAR_PRESETS.map((em) => h('button', { type: 'button', class: 'preset', onclick: async () => {
    try { await updateDoc(doc(db, 'Profiles', uid), { avatarEmoji: em, photoURL: null }); state.profile = { ...state.profile, avatarEmoji: em, photoURL: null }; refreshAvatar(); } catch (_) { toast('Saqlab bo‘lmadi', 'error'); }
  } }, em)));
  const name = h('input', { type: 'text', maxlength: 40, value: p.displayName });
  const grade = h('select', {}, Array.from({ length: 11 }, (_, i) => h('option', { value: i + 1, selected: p.grade === i + 1 }, `${i + 1}-sinf`)));
  const saveBtn = h('button', { class: 'btn primary', type: 'button' }, 'Saqlash');
  saveBtn.addEventListener('click', async () => {
    const dn = name.value.trim();
    if (!dn) return toast('Ism bo‘sh bo‘lmasin', 'error');
    try {
      await updateDoc(doc(db, 'Profiles', uid), { displayName: dn.slice(0, 40), grade: +grade.value });
      state.profile = { ...state.profile, displayName: dn.slice(0, 40), grade: +grade.value }; renderHeader(); toast('Saqlandi', 'ok');
    } catch (_) { toast('Saqlab bo‘lmadi', 'error'); }
  });
  const m = p.medals || {};
  const lp = levelProgress(p.xp || 0);
  const certList = h('div', { class: 'cert-list' }, h('p', { class: 'muted' }, 'Yuklanmoqda…'));
  app.append(
    h('section', { class: 'panel profile-head' }, avatarBox,
      h('div', { class: 'profile-edit' }, h('div', { class: 'row' }, h('button', { class: 'btn small', type: 'button', onclick: () => file.click() }, '📷 Rasm yuklash'), file), msg,
        h('small', { class: 'muted' }, 'JPG/PNG/WebP, 2 MB gacha. Yoki qahramon tanlang:'), presets,
        h('label', { class: 'field' }, h('span', {}, 'Ism'), name), h('label', { class: 'field' }, h('span', {}, 'Sinf'), grade), saveBtn)),
    h('section', { class: 'panel' }, h('h2', {}, 'Natijalarim'),
      h('div', { class: 'stats-strip' }, stat('⭐', `${lp.level}-daraja (${p.xp || 0} XP)`), stat('🎯', `${p.totalScore || 0} ball`), stat('📝', `${p.testsDone || 0} test`), stat('✅', `${p.correctTotal || 0} to‘g‘ri`)),
      h('div', { class: 'xpbar wide' }, h('i', { style: { width: `${Math.round(lp.ratio * 100)}%` } })), h('small', { class: 'muted' }, `Keyingi darajagacha: ${lp.to - (p.xp || 0)} XP`)),
    h('section', { class: 'panel' }, h('h2', {}, 'Medallarim'),
      h('div', { class: 'medal-row' }, ['gold', 'silver', 'bronze', 'participant'].map((k) => h('div', { class: 'medal' }, h('span', {}, TIERS[k].icon), h('b', {}, m[k] || 0), h('small', {}, TIERS[k].label))))),
    h('section', { class: 'panel' }, h('h2', {}, 'Yutuqlarim'),
      h('div', { class: 'ach-grid' }, ACHIEVEMENTS.map((a) => { const got = (p.achievements || []).includes(a.id); return h('div', { class: `ach ${got ? 'got' : ''}` }, h('span', {}, got ? a.icon : '🔒'), h('b', {}, a.title), h('small', {}, a.desc)); }))),
    h('section', { class: 'panel' }, h('h2', {}, 'Sertifikatlarim'), certList));
  try {
    const snap = await getDocs(query(collection(db, 'Certificates'), where('uid', '==', uid)));
    const rows = snap.docs.map((d) => d.data()).sort((a, b) => tsToDate(b.createdAt) - tsToDate(a.createdAt)).slice(0, 20);
    certList.replaceChildren(...(rows.length ? rows.map((c) => h('div', { class: 'row between cert-row' },
      h('span', {}, `${TIERS[c.tier].icon} ${c.subjectName} — ${c.percent}% (${fmtDate(tsToDate(c.createdAt))})`),
      h('button', { class: 'btn small', type: 'button', onclick: async () => { try { downloadBlob(await certificatePdfBlob({ name: state.profile.displayName, subject: c.subjectName, percent: c.percent, score: c.score, correct: c.correct, total: c.total, tier: c.tier, date: fmtDate(tsToDate(c.createdAt)), photoURL: state.profile.photoURL, emoji: state.profile.avatarEmoji }), `sertifikat-${c.subjectName}.pdf`); } catch (_) { toast('PDF yaratib bo‘lmadi', 'error'); } } }, 'PDF'))) : [h('p', { class: 'muted' }, 'Hali sertifikat yo‘q — birinchi testni topshiring!')]));
  } catch (_) { certList.replaceChildren(h('p', { class: 'error' }, 'Yuklab bo‘lmadi.')); }
}

/* ---------------------------- reyting ---------------------------- */
function renderLeaderboard() {
  let kind = 'all', subj = SUBJECTS[0].id;
  const list = h('div', { class: 'lb-list' });
  const tabs = h('div', { class: 'tabs' });
  const subSel = h('select', { class: 'hidden', onchange: (e) => { subj = e.target.value; load(); } }, SUBJECTS.map((s) => h('option', { value: s.id }, `${s.icon} ${s.name}`)));
  const labels = { all: 'Eng yaxshilar', week: 'Haftalik', month: 'Oylik', subject: 'Fanlar bo‘yicha' };
  Object.entries(labels).forEach(([k, l]) => tabs.append(h('button', { class: `tab ${k === kind ? 'active' : ''}`, 'data-k': k, type: 'button', onclick: () => { kind = k; tabs.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.k === k)); subSel.classList.toggle('hidden', k !== 'subject'); load(); } }, l)));
  async function load() {
    list.replaceChildren(h('p', { class: 'muted' }, 'Yuklanmoqda…'));
    const ids = boardIds(subj);
    const id = { all: ids[0], week: ids[1], month: ids[2], subject: ids[3] }[kind];
    try {
      const snap = await getDocs(query(collection(db, 'Leaderboards', id, 'entries'), orderBy('totalScore', 'desc'), limit(20)));
      if (snap.empty) return list.replaceChildren(h('p', { class: 'muted' }, 'Hozircha bu reytingda hech kim yo‘q. Birinchi bo‘ling! 🚀'));
      list.replaceChildren(...snap.docs.map((d, i) => { const e = d.data(); return h('div', { class: `lb-row ${e.uid === state.user.uid ? 'me' : ''}` }, h('span', { class: 'rank' }, ['🥇', '🥈', '🥉'][i] || i + 1), avatarEl({ photoURL: e.photoURL, avatarEmoji: e.avatarEmoji, displayName: e.name }, 40), h('div', { class: 'lb-name' }, h('strong', {}, e.name), h('small', {}, `${e.grade}-sinf`)), h('b', {}, `${e.totalScore} ball`)); }));
    } catch (_) { list.replaceChildren(h('p', { class: 'error' }, 'Reytingni yuklab bo‘lmadi.')); }
  }
  app.append(h('h1', {}, '🏆 Reyting'), tabs, subSel, h('section', { class: 'panel' }, list));
  load();
}

/* ---------------------------- ishga tushirish ---------------------------- */
if (!isConfigured) route();
else onAuthStateChanged(auth, async (user) => {
  state.user = user; state.profile = null; state.isAdmin = false;
  if (!user) { audio.pause(); return route(); }
  try {
    const tok = await user.getIdTokenResult();
    state.isAdmin = tok.claims.admin === true;
    state.profile = await loadProfile(user, state.pending); state.pending = null;
    await Promise.all([loadSettings(), loadMusic()]);
  } catch (e) { console.error(e); toast('Ma’lumotlarni yuklab bo‘lmadi. Internetni tekshiring.', 'error'); return; }
  route();
});
