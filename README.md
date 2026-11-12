# Brand Arcade

A reusable 3D arcade mini-game for brand campaigns. One engine, one data file per customer.

The demo ships with two **fictional** brands:

| Brand | Game | Open with |
| --- | --- | --- |
| **Solmara** (sparkling citrus soda) | *Ruta del Sol* — sunset beach | `/` |
| **Café Lumbre** (specialty coffee) | *Turno de Noche* — night city | `/?brand=lumbre` |

Same code, different product, palette, collectibles, rewards and copy. The second brand exists to
prove the re-skin to customers.

## The game

You ride the brand's product down a winding ribbon in the sky.

- **One input.** Swipe on a phone; move the mouse or use ← → / A D on desktop. No tutorial screen.
- **Follow the trail.** Collectibles always mark a safe line. Chaining them raises the multiplier (×1 → ×5); 2 seconds without a pickup breaks the chain.
- **Greed is optional.** Gold tokens and shield bubbles sit *off* the safe line. Shaving past an obstacle pays a near-miss bonus.
- **Power mode** (FIZZ / ESPRESSO). Fills from pickups and near misses, then triggers itself: 6 seconds of invincibility, magnet, double score and smashing through obstacles.
- **Zones.** A branded gate every 400 m; speed and obstacle density ramp up.
- **Eight enemies**, introduced one at a time as the run goes on (the order and distances are the `ROSTER` table in `src/game/spawner.js`): spiky urchins, striped barriers, crabs that scuttle sideways, barrels that roll towards you, jellies that bob (slip under one at the top of its bounce for a bonus), zapper beams that switch on and off, spinning spiked windmills, and wasps that drift towards you. After 1,800 m every row picks its own. All of them are coloured from `hazards` in the brand file.
- **Rewards.** Three score tiers unlock prize codes. Progress to the next tier is always on screen.
- **Share.** A score card image is generated from the crash frame, plus a challenge link (`?c=4250`) that shows "beat 4,250 points" to whoever opens it.

## Run it

```bash
npm install
```

```bash
npm run dev
```

```bash
npm run build
```

`npm run build` writes a static site to `dist/` (about 160 kB of JavaScript gzipped, no backend).
`npm run preview` serves that build locally.

## Make a new brand (about an hour, no engine code)

1. Copy `src/brands/solmara.js` to `src/brands/<customer>.js` and edit it. It is plain data:

   | Section | What it controls |
   | --- | --- |
   | `brand` | name, logo text (drawn on the product label, the gates and the share card), tagline, call-to-action link |
   | `game` | game title, one-line pitch, names of the power mode and the zones |
   | `locale` | default language and available languages |
   | `colors` | interface palette (buttons, panels, outlines) |
   | `world` | sky, sun, sea, track, rails, lighting, scenery colours, `topper: 'palm' \| 'pine' \| 'none'`, `stars` |
   | `hero` | the product the player rides: `type: 'can' \| 'cup'` and its colours |
   | `collectibles` | 1–3 variants: `kind: 'citrus' \| 'coin' \| 'bean'` and colours |
   | `token`, `hazards` | premium pickup (colour + letter), obstacle colours |
   | `rewards` | score thresholds, prize names and codes |
   | `share` | hashtag and share message |
   | `legal` | small print |
   | `tuning` | optional overrides of anything in `src/game/tuning.js` |

2. Register it in `src/brands/index.js`.
3. Generate its link-preview image, icons and web manifest:

   ```bash
   npm run assets
   ```

4. Preview with `?brand=<customer>`, then build that customer's site:

   ```bash
   VITE_BRAND=<customer> VITE_SITE_URL=https://juego.cliente.es/ npm run build
   ```

   (PowerShell: `$env:VITE_BRAND='<customer>'; $env:VITE_SITE_URL='https://juego.cliente.es/'; npm run build`)

   `VITE_SITE_URL` must be the final public URL with a trailing slash: WhatsApp and social
   previews only accept an absolute image address.

Every texture (label, track, gate banner, collectibles, share card) is drawn at runtime from the
brand file, and every model is built from primitives, so a re-skin needs no image or 3D files.
A new product shape (bottle, box, snack bag) is a new branch in `buildHero()` in
`src/game/models.js`; a new collectible is a new branch in `collectibleMesh()`.

Interface text lives in `src/i18n.js` (Spanish and English). Language is picked from
`?lang=`, then the player's last choice, then the browser, then the brand default.

## Deploy

`dist/` is a plain static folder with relative paths, so it works at a domain root, in a
sub-folder, or inside an iframe.

- **Netlify** — connect the repository (settings are in `netlify.toml`), or drag the `dist` folder onto app.netlify.com/drop.
- **Vercel** — import the repository; framework preset "Vite", output `dist`.
- **Cloudflare Pages** — build command `npm run build`, output directory `dist`.
- **GitHub Pages / any web server / S3** — upload the contents of `dist`.

Set `VITE_BRAND` and `VITE_SITE_URL` as build environment variables on the host. Serve over
HTTPS: the share sheet and clipboard need it.

**Embed in a customer's site:**

```html
<iframe src="https://juego.cliente.es/" title="Ruta del Sol"
        style="width:100%;height:100svh;border:0" allow="web-share; clipboard-write; fullscreen"></iframe>
```

## Campaign analytics

`src/platform.js` emits events with no personal data: `ready`, `start`, `zone`, `power`,
`reward`, `over` (score, distance, zone, duration), `share` (method), `cta`.

Each event is pushed to `window.dataLayer` (Google Tag Manager) when it exists, dispatched as a
`brandgame` DOM event, and posted to the parent page when embedded:

```js
window.addEventListener('message', (e) => {
  if (e.data?.source === 'brand-arcade') console.log(e.data.event, e.data);
});
```

The game stores only the best score, play count, language and sound preference in
`localStorage`. It sets no cookies and loads nothing from third parties (the font is self-hosted),
so the game itself needs no consent banner. Adding a tag manager changes that.

## Real rewards

The demo keeps prize codes in the brand file, which means anyone can read them in the page
source, and scores are computed in the browser. That is fine for a demo and for low-value,
unlimited codes. For a real campaign, issue codes from a small server endpoint: send the
`over` result, apply rate limits and plausibility checks (score versus duration and distance),
and return a single-use code. The place to call it is `hooks.over` in `src/main.js`.
Prize draws in Spain also need published terms and conditions; add the link to `legal`.

## Tuning

All gameplay numbers are in `src/game/tuning.js`: speed curve, difficulty ramp, scoring,
chain window, power-mode cost and length, pickup frequency. Reward thresholds are per brand.

The current values were set from automated runs (see "What was tested"). Reward thresholds
(2,000 / 8,000 / 20,000) are an estimate; adjust them from the real score distribution in the
`over` events once a campaign has traffic.

## Sound

- **Effects** (`public/sfx/*.mp3`): 14 one-shots rendered from the earshot sound bank
  (code-synthesized sounds, not recordings). Each was checked by earshot's audit as clean; the
  first choice for the power-mode sound was rejected for a metallic ring and replaced.
  Per-sound gains in `src/audio/audio.js` even out their measured loudness.
- **Music** (`src/audio/music.js`): generated live with the Web Audio API — a 4-bar loop at
  112 BPM whose arrangement follows the game (menu / run / power mode). No audio file, no licence.
  `npm run music:render` renders it to `tools/out/` for measurement. Measured at the in-game
  bus level: run −22.4 LUFS integrated, true peak −4.1 dBTP; menu −25.6 LUFS, −6.3 dBTP.
  Effects sit above it. It is bass-led (most energy below 500 Hz), so on small phone speakers
  the melody carries it and the kick and bass mostly disappear.

Nobody has listened to the mix yet: levels and cleanliness are measured, taste is not.

## Project map

```
index.html              page shell, brand meta tags (filled in by vite.config.js)
src/main.js             wiring: brand → game ⇄ interface ⇄ audio ⇄ storage ⇄ analytics
src/brands/             one data file per customer + registry
src/game/Game.js        loop, input, rules, camera
src/game/spawner.js     course generator (safe-lane rule)
src/game/world.js       sky, sea, track, scenery, gate
src/game/models.js      procedural models
src/game/textures.js    procedural textures
src/game/fx.js          particles
src/game/bend.js        curved-world shader patch
src/game/tuning.js      gameplay numbers
src/ui.js, style.css    title, HUD, pause, game over, share sheet
src/share.js            share card, challenge links
src/audio/              effects player + generative music
src/i18n.js             interface copy (es, en)
src/platform.js         storage + analytics events
tools/make-assets.mjs   link-preview image, icons, manifest per brand
tools/render-music.mjs  offline render of the soundtrack
```

## Test hooks

- `?bot` — the game plays itself (also used for the menu background).
- `?seed=7` — fixed course.
- `?debug` — exposes `window.__arcade` and disables auto-pause in background tabs.
  `__arcade.game.simulate(seconds)` fast-forwards at a fixed 60 Hz step.

## What was tested

Run on Windows in a Chromium preview at 375×812, 667×375 and 1280×720, against both the dev
server and the production build:

- Full flow for both brands: title → run → power mode → zone gate → crash → rewards panel →
  share sheet, in Spanish, with no console errors.
- The bot survived 6 seeded courses × 240 s each at 60, 45 and 30 Hz steps, so the safe-lane
  rule holds and collisions do not depend on frame rate.
- Touch steering through synthetic pointer events; persistence of best score; all 14 effects
  decode and the music scheduler runs.

Not tested: real phones or tablets (iOS Safari, Android Chrome), real hands-on play in real
time, the native share sheet (not available in the test browser), frame rate on low-end
devices, screen readers. Difficulty and reward thresholds come from bot runs, not from people.
