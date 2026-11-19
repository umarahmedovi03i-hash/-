// Admin paneli: AI generator, savollarni ko‘rib chiqish/tahrirlash/tasdiqlash, musiqa, medal chegaralari.
import { collection, query, orderBy, getDocs, doc, updateDoc, deleteDoc, addDoc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import { db, storage, functions } from './firebase.js';
import { SUBJECTS, LANGS, DIFFICULTIES, AUDIO_RULES } from './config.js';
import { validateThresholds } from './scoring.js';
import { audio } from './audio.js';
import { h, toast, state, subjectById } from './shared.js';

export async function renderAdmin(root, { reloadMusic, reloadSettings }) {
  if (!state.isAdmin) {
    root.append(h('section', { class: 'panel' }, h('h2', {}, '🔒 Faqat administrator uchun'),
      h('p', {}, 'Administrator huquqi Firebase custom claim orqali beriladi: README dagi "scripts/set-admin.js" ni ishga tushiring, so‘ng hisobdan chiqib qayta kiring.')));
    return;
  }
  const tabs = { ai: 'AI generator', tests: 'Savollar', music: 'Musiqa', settings: 'Sozlamalar' };
  const body = h('div');
  let current = 'ai';
  const nav = h('div', { class: 'tabs' });
  const show = (k) => {
    current = k;
    nav.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.k === k));
    body.replaceChildren();
    ({ ai: aiTab, tests: testsTab, music: musicTab, settings: settingsTab })[k](body, { reloadMusic, reloadSettings, goTests: () => show('tests') });
  };
  Object.entries(tabs).forEach(([k, label]) => nav.append(h('button', { 'data-k': k, class: 'tab', onclick: () => show(k) }, label)));
  root.append(h('h1', {}, '🛠️ Admin paneli'), nav, body);
  show(current);
}

function field(label, input) { return h('label', { class: 'field' }, h('span', {}, label), input); }
const select = (obj, value) => h('select', {}, Object.entries(obj).map(([k, v]) => h('option', { value: k, selected: k === value }, v)));

function aiTab(root, { goTests }) {
  const grade = h('input', { type: 'number', min: 1, max: 11, value: 5 });
  const subj = h('select', {}, SUBJECTS.map((s) => h('option', { value: s.id }, `${s.icon} ${s.name}`)));
  const topic = h('input', { type: 'text', maxlength: 120, placeholder: 'Masalan: Kasrlar bilan amallar' });
  const count = h('input', { type: 'number', min: 1, max: 30, value: 10 });
  const diff = select(DIFFICULTIES, 'medium');
  const lang = select(LANGS, 'uz');
  const msg = h('p', { class: 'muted' });
  const btn = h('button', { class: 'btn primary', type: 'button' }, '✨ Savollarni yaratish');
  btn.addEventListener('click', async () => {
    const payload = { grade: +grade.value, subjectId: subj.value, topic: topic.value.trim(), count: +count.value, difficulty: diff.value, lang: lang.value };
    if (!payload.topic) { msg.textContent = 'Mavzuni kiriting.'; return; }
    btn.disabled = true; msg.className = 'muted'; msg.textContent = 'AI savollar tuzmoqda… (30–60 soniya olishi mumkin)';
    try {
      const res = await httpsCallable(functions, 'generateTest')(payload);
      msg.textContent = `Tayyor: ${res.data.count}/${res.data.requested} ta savol qoralama sifatida saqlandi. Tasdiqlash uchun "Savollar" bo‘limiga o‘ting.`;
      toast('AI qoralama tayyor', 'ok');
      goTests();
    } catch (e) {
      msg.className = 'error';
      msg.textContent = e?.code === 'functions/not-found' || e?.code === 'functions/internal'
        ? 'AI xizmati hozir mavjud emas (Cloud Function ishlamayapti). Keyinroq urinib ko‘ring yoki sozlamalarni tekshiring.'
        : (e?.message || 'AI xizmati ishlamadi. Keyinroq urinib ko‘ring.');
    } finally { btn.disabled = false; }
  });
  root.append(h('section', { class: 'panel' }, h('h2', {}, 'AI test generatori'),
    h('p', { class: 'muted' }, 'Savollar qoralama holatida saqlanadi. O‘quvchilar faqat siz tasdiqlagan testlarni ko‘radi.'),
    h('div', { class: 'grid-form' }, field('Sinf (1–11)', grade), field('Fan', subj), field('Mavzu', topic), field('Savollar soni (1–30)', count), field('Qiyinlik', diff), field('Test tili', lang)),
    btn, msg));
}

async function testsTab(root) {
  root.append(h('p', { class: 'muted' }, 'Yuklanmoqda…'));
  let snap;
  try { snap = await getDocs(query(collection(db, 'AIGeneratedTests'), orderBy('createdAt', 'desc'))); }
  catch (e) { root.replaceChildren(h('p', { class: 'error' }, 'Testlarni yuklab bo‘lmadi.')); return; }
  root.replaceChildren();
  if (snap.empty) { root.append(h('p', { class: 'muted' }, 'Hali AI testlar yo‘q.')); return; }
  snap.forEach((d) => root.append(testCard(d.id, d.data())));
}

function testCard(id, t) {
  const s = subjectById(t.subjectId);
  const card = h('section', { class: 'panel' });
  const questions = structuredClone(t.questions || []);
  const status = h('span', { class: `chip ${t.status}` }, t.status === 'approved' ? '✅ Tasdiqlangan' : '📝 Qoralama');
  const editor = h('div', { class: 'editor' });

  const redraw = () => {
    editor.replaceChildren(...questions.map((q, qi) => {
      const opts = q.options.map((o, oi) => h('div', { class: 'opt-row' },
        h('input', { type: 'radio', name: `c_${id}_${qi}`, checked: q.correct === oi, onchange: () => { q.correct = oi; } }),
        h('input', { type: 'text', value: o, oninput: (e) => { q.options[oi] = e.target.value; } })));
      return h('div', { class: 'q-edit' },
        h('div', { class: 'q-head' }, h('strong', {}, `${qi + 1}.`),
          h('input', { type: 'text', value: q.q, oninput: (e) => { q.q = e.target.value; } }),
          h('button', { class: 'btn small danger', type: 'button', title: 'Savolni o‘chirish', onclick: () => { questions.splice(qi, 1); redraw(); } }, '✕')),
        opts, h('small', { class: 'muted' }, 'Doira — to‘g‘ri javob'));
    }));
  };
  redraw();

  const valid = () => questions.length > 0 && questions.every((q) => q.q.trim() && q.options.length === 4 && q.options.every((o) => o.trim()) && q.correct >= 0 && q.correct < 4);
  const saveWith = async (extra = {}) => {
    if (!valid()) { toast('Savollarda bo‘sh maydon bor', 'error'); return false; }
    try { await updateDoc(doc(db, 'AIGeneratedTests', id), { questions, ...extra }); return true; }
    catch (e) { toast('Saqlab bo‘lmadi', 'error'); return false; }
  };
  const approveBtn = h('button', { class: 'btn primary', type: 'button' }, t.status === 'approved' ? '⏸ Qoralamaga qaytarish' : '✅ Tasdiqlash va chiqarish');
  approveBtn.addEventListener('click', async () => {
    const next = t.status === 'approved' ? 'draft' : 'approved';
    if (await saveWith({ status: next, ...(next === 'approved' ? { approvedAt: serverTimestamp() } : {}) })) {
      t.status = next; status.className = `chip ${next}`; status.textContent = next === 'approved' ? '✅ Tasdiqlangan' : '📝 Qoralama';
      approveBtn.textContent = next === 'approved' ? '⏸ Qoralamaga qaytarish' : '✅ Tasdiqlash va chiqarish';
      toast(next === 'approved' ? 'O‘quvchilarga chiqarildi' : 'Qoralamaga qaytarildi', 'ok');
    }
  });
  const body = h('div', { class: 'hidden' }, editor,
    h('div', { class: 'row' }, h('button', { class: 'btn', type: 'button', onclick: async () => { if (await saveWith()) toast('Saqlandi', 'ok'); } }, '💾 Saqlash'), approveBtn,
      h('button', { class: 'btn danger', type: 'button', onclick: async () => { if (!confirm('Bu testni butunlay o‘chirasizmi?')) return; try { await deleteDoc(doc(db, 'AIGeneratedTests', id)); card.remove(); } catch (_) { toast('O‘chirib bo‘lmadi', 'error'); } } }, '🗑 O‘chirish')));
  card.append(h('div', { class: 'row between' },
    h('div', {}, h('h3', {}, `${s.icon} ${s.name} — ${t.topic}`), h('small', { class: 'muted' }, `${t.grade}-sinf • ${DIFFICULTIES[t.difficulty]} • ${LANGS[t.lang]} • ${questions.length} ta savol`)),
    h('div', { class: 'row' }, status, h('button', { class: 'btn small', type: 'button', onclick: () => body.classList.toggle('hidden') }, 'Ko‘rish / tahrirlash'))), body);
  return card;
}

async function musicTab(root, { reloadMusic }) {
  const title = h('input', { type: 'text', maxlength: 60, placeholder: 'Musiqa nomi' });
  const file = h('input', { type: 'file', accept: 'audio/*' });
  const license = h('input', { type: 'checkbox' });
  const list = h('div');
  const upload = h('button', { class: 'btn primary', type: 'button' }, '⬆️ Yuklash');
  upload.addEventListener('click', async () => {
    const f = file.files[0];
    if (!title.value.trim() || !f) return toast('Nom va faylni tanlang', 'error');
    if (!AUDIO_RULES.types.includes(f.type)) return toast('Faqat audio fayl (mp3, ogg, wav, aac…)', 'error');
    if (f.size > AUDIO_RULES.maxBytes) return toast('Fayl 15 MB dan oshmasin', 'error');
    if (!license.checked) return toast('Faylni ishlatish huquqini tasdiqlang', 'error');
    upload.disabled = true;
    try {
      const path = `music/${Date.now()}_${f.name.replace(/[^\w.-]/g, '_')}`;
      const r = ref(storage, path);
      await uploadBytes(r, f, { contentType: f.type });
      const url = await getDownloadURL(r);
      await addDoc(collection(db, 'Music'), { title: title.value.trim(), url, path, licenseConfirmed: true, createdAt: serverTimestamp() });
      title.value = ''; file.value = ''; license.checked = false;
      toast('Musiqa qo‘shildi', 'ok'); await reloadMusic(); await draw();
    } catch (e) { toast('Yuklab bo‘lmadi. Ruxsat yoki hajmni tekshiring.', 'error'); }
    upload.disabled = false;
  });
  async function draw() {
    list.replaceChildren();
    try {
      const snap = await getDocs(query(collection(db, 'Music'), orderBy('createdAt', 'desc')));
      if (snap.empty) list.append(h('p', { class: 'muted' }, 'Yuklangan musiqa yo‘q. Ichki sintez treklari doim mavjud.'));
      snap.forEach((d) => {
        const m = d.data();
        list.append(h('div', { class: 'row between music-row' }, h('span', {}, `🎵 ${m.title}`), h('audio', { controls: true, preload: 'none', src: m.url }),
          h('button', { class: 'btn small danger', type: 'button', onclick: async () => {
            if (!confirm('O‘chirasizmi?')) return;
            try { await deleteDoc(doc(db, 'Music', d.id)); if (m.path) await deleteObject(ref(storage, m.path)).catch(() => {}); await reloadMusic(); draw(); } catch (_) { toast('O‘chirib bo‘lmadi', 'error'); }
          } }, 'O‘chirish')));
      });
    } catch (_) { list.append(h('p', { class: 'error' }, 'Ro‘yxatni yuklab bo‘lmadi.')); }
  }
  root.append(h('section', { class: 'panel' }, h('h2', {}, 'Fon musiqasi'),
    h('p', { class: 'muted' }, 'Faqat o‘zingizga tegishli yoki ruxsat olingan (litsenziyali) audio fayllarni yuklang. Maks. 15 MB.'),
    h('div', { class: 'grid-form' }, field('Nomi', title), field('Audio fayl', file)),
    h('label', { class: 'check' }, license, ' Bu faylni platformada ishlatishga huquqim bor'), upload), h('section', { class: 'panel' }, h('h3', {}, 'Ro‘yxat'), list));
  draw();
}

function settingsTab(root, { reloadSettings }) {
  const th = state.settings.thresholds;
  const gold = h('input', { type: 'number', min: 2, max: 100, value: th.gold });
  const silver = h('input', { type: 'number', min: 2, max: 99, value: th.silver });
  const bronze = h('input', { type: 'number', min: 1, max: 98, value: th.bronze });
  const duck = h('select', {}, [['duck', 'Test vaqtida pasaytirish'], ['off', 'Test vaqtida o‘chirish'], ['keep', 'O‘zgartirmaslik']].map(([k, v]) => h('option', { value: k, selected: state.settings.defaultDuck === k }, v)));
  const save = h('button', { class: 'btn primary', type: 'button' }, '💾 Saqlash');
  save.addEventListener('click', async () => {
    const t = { gold: +gold.value, silver: +silver.value, bronze: +bronze.value };
    if (!validateThresholds(t)) return toast('Chegaralar: oltin > kumush > bronza, 1–100 oralig‘ida', 'error');
    try { await setDoc(doc(db, 'Settings', 'global'), { thresholds: t, defaultDuck: duck.value, updatedAt: serverTimestamp() }); await reloadSettings(); toast('Saqlandi', 'ok'); }
    catch (_) { toast('Saqlab bo‘lmadi', 'error'); }
  });
  root.append(h('section', { class: 'panel' }, h('h2', {}, 'Medal chegaralari (%)'),
    h('div', { class: 'grid-form' }, field('🏆 Oltin kubok (dan)', gold), field('🥈 Kumush medal (dan)', silver), field('🥉 Bronza medal (dan)', bronze)),
    h('p', { class: 'muted' }, 'Bronzadan past natija — ishtirokchi sertifikati.'),
    h('h3', {}, 'Standart musiqa rejimi'), field('Test vaqtida', duck), save));
}
