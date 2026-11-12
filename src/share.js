// Shareable score card (drawn on a canvas from the crash frame) + challenge links.
import { FONT, rgba } from './game/textures.js';

const W = 1080;
const H = 1350;

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

export function buildCard({ brand, snapshot, scoreText, title, brandName, beat, pointsLabel, footer }) {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  const col = brand.colors;

  // backdrop: the game frame, or the brand sky if there is none
  const sky = g.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, brand.world.skyTop);
  sky.addColorStop(0.55, brand.world.skyMid);
  sky.addColorStop(1, brand.world.horizon);
  g.fillStyle = sky;
  g.fillRect(0, 0, W, H);
  const PIC = 860; // height of the picture area; the score sits on a solid panel below it
  if (snapshot && snapshot.width > 1) {
    const s = Math.max(W / snapshot.width, PIC / snapshot.height);
    const dw = snapshot.width * s;
    const dh = snapshot.height * s;
    // keep the hero (lower-middle of the frame) inside the crop
    const dy = Math.min(0, Math.max(PIC - dh, PIC * 0.62 - dh * 0.66));
    g.save();
    g.beginPath();
    g.rect(0, 0, W, PIC);
    g.clip();
    g.drawImage(snapshot, (W - dw) / 2, dy, dw, dh);
    g.restore();
  }
  const fade = g.createLinearGradient(0, PIC - 260, 0, PIC);
  fade.addColorStop(0, rgba(col.ink, 0));
  fade.addColorStop(1, rgba(col.ink, 1));
  g.fillStyle = fade;
  g.fillRect(0, PIC - 260, W, 262);
  g.fillStyle = col.ink;
  g.fillRect(0, PIC, W, H - PIC);

  g.textBaseline = 'middle';
  g.lineJoin = 'round';

  // brand pill
  g.font = `700 54px ${FONT}`;
  const bw = g.measureText(brandName).width + 84;
  g.fillStyle = col.ink;
  roundRect(g, 56, 64, bw, 108, 54);
  g.fill();
  g.fillStyle = col.paper;
  roundRect(g, 50, 56, bw, 108, 54);
  g.fill();
  g.strokeStyle = col.ink;
  g.lineWidth = 6;
  g.stroke();
  g.fillStyle = col.ink;
  g.textAlign = 'left';
  g.fillText(brandName, 92, 112);

  // score
  g.textAlign = 'center';
  let size = 250;
  g.font = `700 ${size}px ${FONT}`;
  const sw = g.measureText(scoreText).width;
  if (sw > W - 140) size = Math.floor((size * (W - 140)) / sw);
  g.font = `700 ${size}px ${FONT}`;
  g.fillStyle = col.ink;
  g.fillText(scoreText, W / 2 + 8, 900 + 12);
  g.strokeStyle = col.ink;
  g.lineWidth = 26;
  g.strokeText(scoreText, W / 2, 900);
  g.fillStyle = col.secondary;
  g.fillText(scoreText, W / 2, 900);

  g.font = `600 52px ${FONT}`;
  g.fillStyle = col.paper;
  g.fillText(`${pointsLabel} · ${title}`.toUpperCase(), W / 2, 1050);

  // call to action
  g.font = `700 76px ${FONT}`;
  const tw = g.measureText(beat).width + 110;
  g.fillStyle = col.ink;
  roundRect(g, (W - tw) / 2 + 8, 1122 + 10, tw, 124, 62);
  g.fill();
  g.fillStyle = col.primary;
  roundRect(g, (W - tw) / 2, 1122, tw, 124, 62);
  g.fill();
  g.strokeStyle = col.ink;
  g.lineWidth = 7;
  g.stroke();
  g.fillStyle = col.paper;
  g.fillText(beat, W / 2, 1186);

  g.font = `500 34px ${FONT}`;
  g.fillStyle = rgba(col.paper, 0.75);
  g.fillText(footer, W / 2, 1298);
  return c;
}

export const canvasBlob = (canvas) => new Promise((res) => canvas.toBlob(res, 'image/png'));

/** Link that opens the game with "beat N points" on the title screen. */
export function challengeUrl(score) {
  const u = new URL(window.location.href);
  u.hash = '';
  u.searchParams.delete('bot');
  u.searchParams.delete('seed');
  u.searchParams.set('c', String(score));
  return u.toString();
}

export function readChallenge() {
  const n = parseInt(new URLSearchParams(window.location.search).get('c') || '', 10);
  return Number.isFinite(n) && n > 0 && n < 1e7 ? n : 0;
}

/** Native share sheet with the card image when the device supports it. */
export async function nativeShare({ blob, text, url, filename }) {
  if (!navigator.share) return false;
  try {
    const file = blob && new File([blob], filename, { type: 'image/png' });
    if (file && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], text: `${text} ${url}` });
    } else {
      await navigator.share({ text, url });
    }
    return true;
  } catch (err) {
    return err?.name === 'AbortError'; // user closed the sheet: treat as handled
  }
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

export function downloadBlob(blob, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
