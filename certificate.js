// Sertifikat: canvas'da chizilib, qo‘lda yig‘ilgan PDF (kutubxonasiz) sifatida yuklab olinadi.
import { TIERS } from './scoring.js';

/** JPEG baytlaridan bir sahifali A4 (landshaft) PDF yig‘adi. */
export function buildPdf(jpeg, imgW, imgH) {
  const enc = new TextEncoder();
  const parts = []; let len = 0; const offs = [];
  const push = (b) => { const u = typeof b === 'string' ? enc.encode(b) : b; parts.push(u); len += u.length; };
  const W = 842, H = 595;
  const obj = (n, body) => { offs[n] = len; push(`${n} 0 obj\n${body}\nendobj\n`); };
  push('%PDF-1.4\n');
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  obj(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  obj(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`);
  offs[4] = len;
  push(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${imgW} /Height ${imgH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`);
  push(jpeg); push('\nendstream\nendobj\n');
  const content = `q ${W} 0 0 ${H} 0 0 cm /Im0 Do Q`;
  obj(5, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  const xref = len;
  let x = 'xref\n0 6\n0000000000 65535 f \n';
  for (let n = 1; n <= 5; n++) x += `${String(offs[n]).padStart(10, '0')} 00000 n \n`;
  push(`${x}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
  const out = new Uint8Array(len); let p = 0;
  parts.forEach((u) => { out.set(u, p); p += u.length; });
  return out;
}

function loadImage(url) {
  return new Promise((res) => {
    if (!url) return res(null);
    const i = new Image(); i.crossOrigin = 'anonymous';
    i.onload = () => res(i); i.onerror = () => res(null); i.src = url;
  });
}

/** data: {name, subject, percent, score, correct, total, tier, date, photoURL, emoji} */
export async function drawCertificate(data) {
  const W = 1754, H = 1240; // A4 landshaft ~150 dpi
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  const tier = TIERS[data.tier];
  const grad = g.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, '#fff8e7'); grad.addColorStop(1, '#eaf4ff');
  g.fillStyle = grad; g.fillRect(0, 0, W, H);
  g.strokeStyle = tier.color; g.lineWidth = 18; g.strokeRect(50, 50, W - 100, H - 100);
  g.lineWidth = 4; g.strokeRect(85, 85, W - 170, H - 170);
  g.textAlign = 'center'; g.fillStyle = '#23304a';
  g.font = '700 84px Georgia, serif'; g.fillText('SERTIFIKAT', W / 2, 250);
  g.font = '34px Georgia, serif'; g.fillStyle = '#5a6882'; g.fillText('TestMaktab ta’lim va o‘yin platformasi', W / 2, 305);

  const cx = W / 2, cy = 480;
  const img = await loadImage(data.photoURL);
  g.save(); g.beginPath(); g.arc(cx, cy, 110, 0, Math.PI * 2); g.closePath(); g.clip();
  if (img) g.drawImage(img, cx - 110, cy - 110, 220, 220);
  else { g.fillStyle = '#dbe7ff'; g.fillRect(cx - 110, cy - 110, 220, 220); g.font = '120px serif'; g.textBaseline = 'middle'; g.fillStyle = '#23304a'; g.fillText(data.emoji || (data.name || '?')[0].toUpperCase(), cx, cy + 8); g.textBaseline = 'alphabetic'; }
  g.restore();
  g.strokeStyle = tier.color; g.lineWidth = 10; g.beginPath(); g.arc(cx, cy, 114, 0, Math.PI * 2); g.stroke();

  g.fillStyle = '#23304a'; g.font = '700 78px Georgia, serif'; g.fillText(data.name, W / 2, 680);
  g.font = '36px Georgia, serif'; g.fillStyle = '#5a6882';
  g.fillText(`“${data.subject}” fanidan test natijasi uchun taqdirlanadi`, W / 2, 745);
  g.font = '700 88px Georgia, serif'; g.fillStyle = tier.color; g.fillText(`${tier.icon} ${tier.label}`, W / 2, 870);
  g.font = '42px Georgia, serif'; g.fillStyle = '#23304a';
  g.fillText(`Natija: ${data.percent}%   •   To‘g‘ri javoblar: ${data.correct}/${data.total}   •   Ball: ${data.score}`, W / 2, 970);
  g.font = '30px Georgia, serif'; g.fillStyle = '#5a6882'; g.fillText(`Sana: ${data.date}`, W / 2, 1090);
  return c;
}

export async function certificatePdfBlob(data) {
  const canvas = await drawCertificate(data);
  const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
  const bin = atob(dataUrl.split(',')[1]);
  const jpeg = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) jpeg[i] = bin.charCodeAt(i);
  return new Blob([buildPdf(jpeg, canvas.width, canvas.height)], { type: 'application/pdf' });
}

export function downloadBlob(blob, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
