// Generates the per-brand static assets from the brand file:
//   public/brand/<id>/og.png (1200×630 link preview) · icon-192.png · icon-512.png · manifest.webmanifest
// Usage: npm run assets            (all brands)
//        npm run assets -- lumbre  (one brand)
import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'node:fs';
import { brands, loc } from '../src/brands/index.js';

const FONT = "Fredoka, 'Arial Rounded MT Bold', 'Segoe UI', Arial, sans-serif";
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

function scene(b, w, h) {
  const wd = b.world;
  const horizon = h * 0.62;
  return `
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${wd.skyTop}"/><stop offset="0.6" stop-color="${wd.skyMid}"/><stop offset="1" stop-color="${wd.horizon}"/>
    </linearGradient>
    <radialGradient id="glow"><stop offset="0" stop-color="${wd.sun}" stop-opacity="0.9"/><stop offset="1" stop-color="${wd.sun}" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="${w}" height="${horizon}" fill="url(#sky)"/>
  <circle cx="${w * 0.78}" cy="${horizon * 0.55}" r="${h * 0.42}" fill="url(#glow)"/>
  <circle cx="${w * 0.78}" cy="${horizon * 0.55}" r="${h * 0.13}" fill="${wd.sun}"/>
  <rect y="${horizon}" width="${w}" height="${h - horizon}" fill="${wd.sea}"/>
  <polygon points="${w * 0.5 - h * 0.05},${horizon} ${w * 0.5 + h * 0.05},${horizon} ${w * 0.5 + h * 0.62},${h} ${w * 0.5 - h * 0.62},${h}" fill="${wd.track}"/>
  <polygon points="${w * 0.5 - h * 0.05},${horizon} ${w * 0.5 - h * 0.62},${h} ${w * 0.5 - h * 0.72},${h}" fill="${wd.rail}"/>
  <polygon points="${w * 0.5 + h * 0.05},${horizon} ${w * 0.5 + h * 0.62},${h} ${w * 0.5 + h * 0.72},${h}" fill="${wd.rail}"/>`;
}

function product(b, cx, cy, s) {
  const hr = b.hero;
  const ink = b.colors.ink;
  return `
  <g transform="translate(${cx} ${cy}) scale(${s})">
    <ellipse cx="0" cy="118" rx="120" ry="30" fill="${ink}" opacity="0.25"/>
    <ellipse cx="0" cy="104" rx="104" ry="24" fill="${hr.board}" stroke="${ink}" stroke-width="8"/>
    <rect x="-58" y="-96" width="116" height="196" rx="20" fill="${hr.body}" stroke="${ink}" stroke-width="8"/>
    <rect x="-46" y="-112" width="92" height="26" rx="10" fill="${hr.metal}" stroke="${ink}" stroke-width="8"/>
    <circle cx="0" cy="-6" r="40" fill="${hr.detail}"/>
    <path d="M-54 52 q27 -22 54 0 t54 0 v40 h-108 z" fill="${hr.accent}"/>
  </g>`;
}

async function build(b) {
  const lang = b.locale.default;
  const dir = `public/brand/${b.id}`;
  mkdirSync(dir, { recursive: true });
  const title = loc(b.game.title, lang);
  const c = b.colors;

  const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
    ${scene(b, 1200, 630)}
    ${product(b, 600, 470, 0.95)}
    <g font-family="${FONT}" font-weight="700" text-anchor="middle">
      <text x="600" y="232" font-size="150" fill="${c.ink}" stroke="${c.ink}" stroke-width="34" stroke-linejoin="round">${esc(title)}</text>
      <text x="600" y="246" font-size="150" fill="${c.ink}" stroke="${c.ink}" stroke-width="34" stroke-linejoin="round">${esc(title)}</text>
      <text x="600" y="232" font-size="150" fill="${c.secondary}">${esc(title)}</text>
      <rect x="${600 - (b.brand.name.length * 26 + 60) / 2}" y="40" width="${b.brand.name.length * 26 + 60}" height="68" rx="34" fill="${c.paper}" stroke="${c.ink}" stroke-width="6"/>
      <text x="600" y="88" font-size="42" fill="${c.ink}">${esc(b.brand.name)}</text>
    </g>
  </svg>`;
  await sharp(Buffer.from(og)).png().toFile(`${dir}/og.png`);

  const icon = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
    <rect width="512" height="512" fill="${b.world.skyMid}"/>
    ${scene(b, 512, 512)}
    ${product(b, 256, 300, 1.25)}
  </svg>`;
  await sharp(Buffer.from(icon)).png().toFile(`${dir}/icon-512.png`);
  await sharp(Buffer.from(icon)).resize(192, 192).png().toFile(`${dir}/icon-192.png`);

  const manifest = {
    name: `${title} · ${b.brand.name}`,
    short_name: title,
    description: loc(b.game.pitch, lang),
    lang,
    start_url: '../../',
    scope: '../../',
    display: 'fullscreen',
    orientation: 'any',
    background_color: c.ink,
    theme_color: c.ink,
    icons: [
      { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
    ],
  };
  writeFileSync(`${dir}/manifest.webmanifest`, JSON.stringify(manifest, null, 2));
  console.log('assets →', dir);
}

const only = process.argv[2];
for (const b of Object.values(brands)) if (!only || only === b.id) await build(b);
