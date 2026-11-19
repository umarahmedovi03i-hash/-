import { SUBJECTS, DEFAULT_SETTINGS } from './config.js';

export const state = { user: null, profile: null, settings: structuredClone(DEFAULT_SETTINGS), isAdmin: false, quiz: null };
export const subjectById = (id) => SUBJECTS.find((s) => s.id === id) || { id, name: id, icon: '📘', color: '#6c8cff' };

/** Kichik DOM yordamchisi. Foydalanuvchi matni har doim textContent orqali qo‘yiladi (XSS yo‘q). */
export function h(tag, props = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === false || v == null) continue;
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
    else if (k === 'value' || k === 'checked' || k === 'disabled' || k === 'selected') e[k] = v;
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false) continue;
    e.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return e;
}

export function toast(msg, kind = 'info') {
  const t = h('div', { class: `toast ${kind}`, role: 'status' }, msg);
  document.getElementById('toasts').append(t);
  setTimeout(() => t.classList.add('out'), 3600);
  setTimeout(() => t.remove(), 4200);
}

export function avatarEl(p, size = 56) {
  const box = h('div', { class: 'avatar', style: { width: `${size}px`, height: `${size}px`, fontSize: `${size * 0.55}px` } });
  if (p?.photoURL) {
    const img = h('img', { src: p.photoURL, alt: '', loading: 'lazy' });
    img.addEventListener('error', () => { img.remove(); box.textContent = p.avatarEmoji || (p.displayName || p.name || '?')[0].toUpperCase(); });
    box.append(img);
  } else box.textContent = p?.avatarEmoji || (p?.displayName || p?.name || '?')[0].toUpperCase();
  return box;
}

export const fmtDate = (d = new Date()) => d.toLocaleDateString('uz-UZ', { year: 'numeric', month: 'long', day: 'numeric' });
export const tsToDate = (ts) => (ts?.toDate ? ts.toDate() : ts ? new Date(ts) : new Date());
