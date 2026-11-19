// Fon musiqasi + ovozli effektlar. Ichki treklar WebAudio bilan sintez qilinadi (mualliflik huquqi muammosi yo‘q).
// Admin yuklagan audio fayllar (Storage) ham ro‘yxatga qo‘shiladi. Brauzer cheklovi: ovoz faqat foydalanuvchi bosgandan keyin boshlanadi.
const LS = 'tm_audio_v1';

const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);
const SYNTH_TRACKS = {
  'synth-calm': { title: 'Sokin (ichki)', bpm: 72, wave: 'sine', notes: [60, 64, 67, 71, 69, 65, 62, 64, 60, 67, 64, 59] },
  'synth-happy': { title: 'Quvnoq (ichki)', bpm: 108, wave: 'triangle', notes: [72, 76, 79, 76, 74, 77, 81, 77, 72, 79, 76, 72] },
  'synth-chill': { title: 'Yengil (ichki)', bpm: 84, wave: 'sine', notes: [57, 60, 64, 60, 55, 59, 62, 59, 53, 57, 60, 57] },
};

const state = { enabled: false, volume: 0.4, trackId: 'synth-calm', duck: 'duck', mode: 'normal', sfx: true };
try { Object.assign(state, JSON.parse(localStorage.getItem(LS) || '{}')); } catch (_) { /* ignore */ }
state.enabled = false; // avtomatik ijro yo‘q: foydalanuvchi o‘zi yoqadi

let ctx = null, master = null, timer = null, step = 0, el = null, uploaded = [];
const listeners = new Set();
const save = () => { try { localStorage.setItem(LS, JSON.stringify({ volume: state.volume, trackId: state.trackId, duck: state.duck, sfx: state.sfx })); } catch (_) { /* ignore */ } listeners.forEach((f) => f(state)); };

function ensureCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC(); master = ctx.createGain(); master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function effectiveVolume() {
  if (state.mode === 'quiz') return state.duck === 'off' ? 0 : state.duck === 'duck' ? state.volume * 0.2 : state.volume;
  return state.volume;
}
function applyVolume() {
  const v = effectiveVolume();
  if (master) master.gain.setTargetAtTime(v * 0.5, ctx.currentTime, 0.15);
  if (el) el.volume = Math.min(1, v);
}

function tone(freq, t0, dur, type, gain, dest) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.03);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(dest); o.start(t0); o.stop(t0 + dur + 0.05);
}

function startSynth() {
  const tr = SYNTH_TRACKS[state.trackId] || SYNTH_TRACKS['synth-calm'];
  if (!ensureCtx()) return;
  stopSynth();
  const beat = 60 / tr.bpm;
  const tick = () => {
    const t = ctx.currentTime + 0.05;
    const n = tr.notes[step % tr.notes.length];
    tone(NOTE(n), t, beat * 1.6, tr.wave, 0.25, master);
    if (step % 4 === 0) tone(NOTE(n - 24), t, beat * 3.5, 'sine', 0.3, master);
    step++;
  };
  tick();
  timer = setInterval(tick, beat * 1000);
  applyVolume();
}
function stopSynth() { if (timer) { clearInterval(timer); timer = null; } }
function stopFile() { if (el) { el.pause(); el = null; } }

function play() {
  if (state.mode === 'quiz' && state.duck === 'off') return; // test vaqtida o‘chirilgan
  stopSynth(); stopFile();
  const up = uploaded.find((t) => t.id === state.trackId);
  if (up) {
    el = new Audio(up.url); el.loop = true; el.crossOrigin = 'anonymous';
    el.volume = Math.min(1, effectiveVolume());
    el.play().catch(() => { state.enabled = false; save(); });
  } else startSynth();
  state.enabled = true; applyVolume(); save();
}
function pause() { stopSynth(); stopFile(); state.enabled = false; save(); }

export const audio = {
  state,
  onChange(f) { listeners.add(f); return () => listeners.delete(f); },
  tracks() { return [...Object.entries(SYNTH_TRACKS).map(([id, t]) => ({ id, title: t.title })), ...uploaded.map((t) => ({ id: t.id, title: t.title }))]; },
  setUploaded(list) { uploaded = list; },
  toggle() { state.enabled ? pause() : play(); },
  play, pause,
  setVolume(v) { state.volume = v; applyVolume(); save(); },
  setTrack(id) { state.trackId = id; if (state.enabled) play(); else save(); },
  setDuck(mode) { state.duck = mode; this.setMode(state.mode); save(); },
  setSfx(on) { state.sfx = on; save(); },
  /** 'quiz' — test vaqti (musiqa pasayadi yoki o‘chadi), 'normal' — oddiy holat. */
  setMode(mode) {
    const was = state.mode; state.mode = mode;
    if (mode === 'quiz' && state.duck === 'off' && state.enabled) { stopSynth(); stopFile(); state.resume = true; }
    else if (was === 'quiz' && state.resume) { state.resume = false; play(); }
    else applyVolume();
  },
  sfxPlay(kind) {
    if (!state.sfx || !ensureCtx()) return;
    const t = ctx.currentTime + 0.01, out = ctx.createGain(); out.gain.value = 0.5; out.connect(ctx.destination);
    const seq = { correct: [[76, 0], [83, 0.09]], wrong: [[52, 0], [48, 0.12]], levelup: [[72, 0], [76, 0.1], [79, 0.2], [84, 0.3]], badge: [[79, 0], [84, 0.12], [88, 0.24]] }[kind] || [];
    seq.forEach(([n, dt]) => tone(NOTE(n), t + dt, 0.28, kind === 'wrong' ? 'sawtooth' : 'triangle', kind === 'wrong' ? 0.12 : 0.3, out));
  },
  /** Taqdirlash marosimi fanfarasi (fon musiqasi yoqilgan-yoqilmaganidan qat’i nazar, effekt yoqilgan bo‘lsa). */
  fanfare(tier) {
    if (!state.sfx || !ensureCtx()) return;
    const t = ctx.currentTime + 0.05, out = ctx.createGain(); out.gain.value = 0.55; out.connect(ctx.destination);
    const win = tier === 'participant' ? [[67, 0], [72, 0.2], [76, 0.4], [79, 0.7]] : [[67, 0], [67, 0.18], [67, 0.36], [72, 0.6], [76, 0.9], [79, 1.1], [84, 1.4], [88, 1.8]];
    win.forEach(([n, dt]) => { tone(NOTE(n), t + dt, 0.5, 'triangle', 0.3, out); tone(NOTE(n - 12), t + dt, 0.5, 'sine', 0.2, out); });
  },
};
// Brauzer ovoz kontekstini birinchi bosishda ochadi.
window.addEventListener('pointerdown', () => { if (ctx && ctx.state === 'suspended') ctx.resume(); }, { passive: true });
