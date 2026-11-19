// Yengil konfetti animatsiyasi (kutubxonasiz). prefers-reduced-motion hurmat qilinadi.
let raf = null, canvas = null;

export function confetti({ duration = 4500, count = 160 } = {}) {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  stopConfetti();
  canvas = document.createElement('canvas');
  canvas.className = 'confetti-canvas';
  document.body.appendChild(canvas);
  const c = canvas.getContext('2d');
  const resize = () => { canvas.width = innerWidth * devicePixelRatio; canvas.height = innerHeight * devicePixelRatio; };
  resize();
  const colors = ['#ff6b6b', '#f5c542', '#4cc38a', '#3fb8e0', '#a78bfa', '#ff9a3c', '#e4547f'];
  const parts = Array.from({ length: count }, () => ({
    x: Math.random() * canvas.width, y: -Math.random() * canvas.height * 0.5,
    r: (4 + Math.random() * 6) * devicePixelRatio, vx: (Math.random() - 0.5) * 4, vy: (2 + Math.random() * 4) * devicePixelRatio * 0.6,
    rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.3, color: colors[(Math.random() * colors.length) | 0],
  }));
  const end = performance.now() + duration;
  const frame = (now) => {
    c.clearRect(0, 0, canvas.width, canvas.height);
    const fade = Math.max(0, Math.min(1, (end - now) / 800));
    c.globalAlpha = fade;
    parts.forEach((p) => {
      p.x += p.vx; p.y += p.vy; p.rot += p.vr;
      c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.fillStyle = p.color; c.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 0.6); c.restore();
    });
    if (now < end) raf = requestAnimationFrame(frame); else stopConfetti();
  };
  raf = requestAnimationFrame(frame);
}

export function stopConfetti() {
  if (raf) cancelAnimationFrame(raf);
  raf = null;
  canvas?.remove();
  canvas = null;
}
