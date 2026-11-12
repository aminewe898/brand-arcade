// Every texture in the game is drawn at runtime from the brand config, so a
// re-skin needs no image files at all.
import * as THREE from 'three';

export const FONT = '"Fredoka Variable", "Fredoka", system-ui, sans-serif';

function cv(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

function tex(canvas, { repeat = false, aniso = 4 } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = aniso;
  return t;
}

export function shade(hex, amt) {
  const c = new THREE.Color(hex);
  const hsl = {};
  c.getHSL(hsl);
  c.setHSL(hsl.h, hsl.s, Math.min(1, Math.max(0, hsl.l + amt)));
  return '#' + c.getHexString();
}

export function rgba(hex, a) {
  const c = new THREE.Color(hex);
  return `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${a})`;
}

function fitText(g, text, maxW, size, weight = 700) {
  g.font = `${weight} ${size}px ${FONT}`;
  const w = g.measureText(text).width;
  if (w > maxW) {
    size = Math.floor((size * maxW) / w);
    g.font = `${weight} ${size}px ${FONT}`;
  }
  return size;
}

/** Product label wrapped around the hero (logo appears twice: front and back). */
export function labelTexture(brand, tagline) {
  const h = brand.hero;
  const ink = brand.colors.ink;
  const [c, g] = cv(1024, 512);
  const grad = g.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, shade(h.body, 0.05));
  grad.addColorStop(1, shade(h.body, -0.1));
  g.fillStyle = grad;
  g.fillRect(0, 0, 1024, 512);

  // sun discs behind each logo
  for (const cx of [256, 768]) {
    g.fillStyle = h.detail;
    g.beginPath();
    g.arc(cx, 200, 150, 0, Math.PI * 2);
    g.fill();
  }
  // double wave
  const wave = (base, amp, color) => {
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(0, 512);
    for (let x = 0; x <= 1024; x += 8) g.lineTo(x, base + Math.sin((x / 1024) * Math.PI * 8) * amp);
    g.lineTo(1024, 512);
    g.fill();
  };
  wave(352, 20, brand.colors.accent);
  wave(384, 20, h.accent);

  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  for (const cx of [256, 768]) {
    fitText(g, brand.brand.logoText, 430, 128, 700);
    g.strokeStyle = ink;
    g.lineWidth = 22;
    g.strokeText(brand.brand.logoText, cx, 214);
    g.fillStyle = h.accent;
    g.fillText(brand.brand.logoText, cx, 214);
    fitText(g, tagline.toUpperCase(), 420, 30, 600);
    g.fillStyle = ink;
    g.fillText(tagline.toUpperCase(), cx, 452);
  }
  return tex(c, { aniso: 8 });
}

/** Tiling track surface: one tile = 8 m of road. */
export function trackTexture(brand) {
  const w = brand.world;
  const [c, g] = cv(512, 512);
  g.fillStyle = w.track;
  g.fillRect(0, 0, 512, 512);
  // soft speckle so the surface doesn't look like flat plastic
  for (let i = 0; i < 900; i++) {
    g.fillStyle = rgba(i % 2 ? '#ffffff' : w.trackLine, 0.035);
    g.fillRect(Math.random() * 512, Math.random() * 512, 3, 3);
  }
  // cross bands every 4 m (speed read)
  g.fillStyle = rgba(w.trackLine, 0.05);
  g.fillRect(0, 0, 512, 128);
  g.fillRect(0, 256, 512, 128);
  // lane dashes
  g.fillStyle = rgba(w.trackLine, 0.16);
  const margin = ((6.4 - 6) / 2 / 6.4) * 512; // lanes span the central 6 m
  for (let i = 1; i < 5; i++) {
    const x = margin + ((512 - margin * 2) * i) / 5;
    g.fillRect(x - 3, 20, 6, 216);
    g.fillRect(x - 3, 276, 6, 216);
  }
  // edge bands
  g.fillStyle = w.trackEdge;
  g.fillRect(0, 0, 20, 512);
  g.fillRect(492, 0, 20, 512);
  g.fillStyle = rgba('#ffffff', 0.85);
  g.fillRect(20, 0, 5, 512);
  g.fillRect(487, 0, 5, 512);
  return tex(c, { repeat: true, aniso: 8 });
}

export function seaTexture(brand) {
  const [c, g] = cv(256, 256);
  g.fillStyle = brand.world.sea;
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 46; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const len = 14 + Math.random() * 34;
    g.fillStyle = rgba('#ffffff', 0.08 + Math.random() * 0.16);
    for (const ox of [-256, 0, 256]) {
      g.beginPath();
      g.ellipse(x + ox, y, len, 1.6 + Math.random() * 1.6, 0, 0, Math.PI * 2);
      g.fill();
    }
  }
  return tex(c, { repeat: true });
}

/** Face of a collectible disc. */
export function discTexture(spec) {
  const [c, g] = cv(256, 256);
  const R = 128;
  g.fillStyle = spec.rind;
  g.beginPath();
  g.arc(R, R, R, 0, Math.PI * 2);
  g.fill();
  if (spec.kind === 'coin') {
    g.fillStyle = spec.pulp;
    g.beginPath();
    g.arc(R, R, 96, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = spec.rind;
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const r = i % 2 ? 30 : 68;
      g.lineTo(R + Math.cos(a) * r, R + Math.sin(a) * r);
    }
    g.fill();
  } else {
    // citrus slice
    g.fillStyle = '#FFF8E4';
    g.beginPath();
    g.arc(R, R, 108, 0, Math.PI * 2);
    g.fill();
    for (let i = 0; i < 8; i++) {
      const a0 = (i / 8) * Math.PI * 2 + 0.07;
      const a1 = ((i + 1) / 8) * Math.PI * 2 - 0.07;
      const grad = g.createRadialGradient(R, R, 10, R, R, 96);
      grad.addColorStop(0, shade(spec.pulp, 0.1));
      grad.addColorStop(1, spec.pulp);
      g.fillStyle = grad;
      g.beginPath();
      g.moveTo(R + Math.cos((a0 + a1) / 2) * 14, R + Math.sin((a0 + a1) / 2) * 14);
      g.arc(R, R, 96, a0, a1);
      g.closePath();
      g.fill();
    }
  }
  return tex(c);
}

export function tokenTexture(brand) {
  const t = brand.token;
  const [c, g] = cv(256, 256);
  const grad = g.createRadialGradient(100, 90, 10, 128, 128, 128);
  grad.addColorStop(0, shade(t.color, 0.22));
  grad.addColorStop(1, shade(t.color, -0.08));
  g.fillStyle = grad;
  g.beginPath();
  g.arc(128, 128, 128, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = shade(t.color, -0.25);
  g.lineWidth = 10;
  g.beginPath();
  g.arc(128, 128, 98, 0, Math.PI * 2);
  g.stroke();
  g.fillStyle = brand.colors.ink;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `700 150px ${FONT}`;
  g.fillText(t.glyph, 128, 138);
  return tex(c);
}

/** Gate banner with the brand logo. */
export function bannerTexture(brand) {
  const [c, g] = cv(1024, 256);
  g.fillStyle = brand.colors.primary;
  g.fillRect(0, 0, 1024, 256);
  g.fillStyle = rgba(brand.colors.secondary, 0.9);
  for (let i = -2; i < 12; i++) {
    g.beginPath();
    g.moveTo(i * 110, 256);
    g.lineTo(i * 110 + 46, 256);
    g.lineTo(i * 110 + 246, 0);
    g.lineTo(i * 110 + 200, 0);
    g.fill();
  }
  g.fillStyle = brand.colors.primary;
  g.fillRect(180, 34, 664, 188);
  g.strokeStyle = brand.colors.ink;
  g.lineWidth = 16;
  g.strokeRect(8, 8, 1008, 240);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  fitText(g, brand.brand.logoText, 600, 150, 700);
  g.lineWidth = 24;
  g.strokeText(brand.brand.logoText, 512, 134);
  g.fillStyle = brand.colors.paper;
  g.fillText(brand.brand.logoText, 512, 134);
  return tex(c, { aniso: 8 });
}

export function barrierTexture(brand) {
  const [c, g] = cv(256, 64);
  g.fillStyle = brand.hazards.body;
  g.fillRect(0, 0, 256, 64);
  g.fillStyle = brand.hazards.tip;
  for (let i = -1; i < 9; i++) {
    g.beginPath();
    g.moveTo(i * 32, 64);
    g.lineTo(i * 32 + 16, 64);
    g.lineTo(i * 32 + 48, 0);
    g.lineTo(i * 32 + 32, 0);
    g.fill();
  }
  return tex(c);
}

export function blobTexture() {
  const [c, g] = cv(128, 128);
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  grad.addColorStop(0, 'rgba(0,0,0,0.55)');
  grad.addColorStop(0.6, 'rgba(0,0,0,0.25)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  return t;
}

export function glowTexture() {
  const [c, g] = cv(128, 128);
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.45)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return tex(c);
}

export function cloudTexture() {
  const [c, g] = cv(256, 128);
  const puff = (x, y, r) => {
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, 'rgba(255,255,255,0.95)');
    grad.addColorStop(0.6, 'rgba(255,255,255,0.55)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  };
  puff(70, 78, 46);
  puff(120, 62, 58);
  puff(176, 76, 48);
  puff(128, 88, 60);
  puff(210, 90, 30);
  puff(40, 92, 28);
  return tex(c);
}
