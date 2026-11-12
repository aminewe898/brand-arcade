// Entry point: picks the brand, then wires Game ⇄ UI ⇄ Audio ⇄ storage ⇄ analytics.
import '@fontsource-variable/fredoka';
import './style.css';
import { brands, DEFAULT_BRAND, loc } from './brands/index.js';
import { makeT } from './i18n.js';
import { makeStore, track } from './platform.js';
import { Game } from './game/Game.js';
import { UI } from './ui.js';
import { AudioKit } from './audio/audio.js';
import * as share from './share.js';

const params = new URLSearchParams(window.location.search);
const buildBrand = import.meta.env.VITE_BRAND;
const brandId = brands[params.get('brand')] ? params.get('brand') : brands[buildBrand] ? buildBrand : DEFAULT_BRAND;
const brand = brands[brandId];
const store = makeStore(brand.id);
const emit = (name, data) => track(brand.id, name, data);

// ── language ────────────────────────────────────────────────────────────────
const available = brand.locale.available;
const browserLang = (navigator.language || '').slice(0, 2).toLowerCase();
let lang = [params.get('lang'), store.get('lang'), browserLang, brand.locale.default].find((l) => available.includes(l)) || available[0];
let t = makeT(lang);
const L = (v) => loc(v, lang);

function applyBrand() {
  const s = document.documentElement.style;
  for (const [k, v] of Object.entries(brand.colors)) s.setProperty(`--${k}`, v);
  document.documentElement.lang = lang;
  document.title = `${L(brand.game.title)} · ${brand.brand.name}`;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', brand.colors.ink);
}
applyBrand();

const boot = document.getElementById('boot');
const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;

async function main() {
  // the label, gate and share card are drawn with the brand font: wait for it
  try {
    await Promise.race([
      Promise.all([document.fonts.load('700 64px "Fredoka Variable"'), document.fonts.load('500 20px "Fredoka Variable"')]),
      new Promise((r) => setTimeout(r, 2500)),
    ]);
  } catch {
    /* fall back to system font */
  }

  const audio = new AudioKit(store.get('muted', false));
  const challenge = share.readChallenge();
  let best = store.get('best', 0);
  let toasted = new Set();
  let lastResult = null;
  let card = null; // { blob, url }
  let powered = false;
  let ui;
  let game;

  const tierFor = (score) => [...brand.rewards].reverse().find((r) => score >= r.score) || null;
  const nextTier = (score) => brand.rewards.find((r) => r.score > score) || null;

  const hooks = {
    hud(s) {
      if (!s.playing) return;
      ui.hud(s, nextTier(Math.max(best, s.score)));
      if (s.fizzActive !== powered) {
        powered = s.fizzActive;
        audio.setIntensity(powered ? 2 : 1);
      }
      // reward unlocked mid-run (only the first time it is ever reached)
      for (const r of brand.rewards) {
        if (s.score >= r.score && best < r.score && !toasted.has(r.id)) {
          toasted.add(r.id);
          ui.rewardToast(r);
          audio.play('reward');
          emit('reward', { reward: r.id, score: s.score });
        }
      }
    },
    popup(kind, value) {
      const pos = game.heroScreen();
      if (kind === 'zone') ui.announce(t('zone', { name: L(brand.game.zoneName), n: value }));
      else if (kind === 'power') ui.announce(`${L(brand.game.powerName)}!`, 'power');
      else if (kind === 'mult') ui.popup(`x${value}`, 'mult', pos);
      else if (kind === 'near') ui.popup(`${t('near')} +${value}`, 'near', pos);
      else if (kind === 'points') ui.popup(`+${value}`, 'good', pos);
      else if (kind === 'shield') ui.popup(t('shield'), 'good', pos);
      else if (kind === 'saved') ui.popup(t('saved'), 'near', pos);
    },
    sfx: (name, opts) => audio.play(name, opts),
    event: (name, data) => {
      if (name !== 'over') emit(name, data);
    },
    tap() {
      if (ui.screen === 'title') play();
    },
    autoPause() {
      ui.setPaused(true);
      audio.hold(true);
    },
    over(result) {
      lastResult = result;
      card = null;
      const isBest = result.score > best;
      const beaten = challenge > 0 && result.score > challenge;
      if (isBest) {
        best = result.score;
        store.set('best', best);
      }
      store.set('plays', store.get('plays', 0) + 1);
      audio.setIntensity(0);
      powered = false;
      document.getElementById('ui').classList.remove('powered');
      if (isBest && result.score > 0) audio.play('best');
      ui.showOver(result, { best, isBest: isBest && result.score > 0, reward: tierFor(best), next: nextTier(best), challengeBeaten: beaten });
      emit('over', { score: result.score, distance: result.distance, zone: result.zone, duration: result.duration, best: isBest });
    },
  };

  try {
    game = new Game(document.getElementById('scene'), brand, L(brand.brand.tagline), hooks, {
      bot: params.has('bot'),
      noAutoPause: params.has('debug'),
      seed: params.has('seed') ? Number(params.get('seed')) : undefined,
    });
  } catch (err) {
    console.error(err);
    boot.innerHTML = `<div>${t('noWebgl')}</div>`;
    return;
  }

  function play() {
    audio.unlock();
    audio.hold(false);
    audio.setIntensity(1);
    toasted = new Set();
    ui.closeShare();
    ui.flash();
    const first = !store.get('seenHint', false);
    store.set('seenHint', true);
    ui.showHud(first);
    game.start();
  }

  async function ensureCard() {
    if (card || !lastResult) return card;
    const canvas = share.buildCard({
      brand,
      snapshot: game.hasSnap ? game.snapCanvas : null,
      scoreText: ui.fmt(lastResult.score),
      title: L(brand.game.title),
      brandName: brand.brand.name,
      beat: t('cardBeat'),
      pointsLabel: t('score'),
      footer: `${brand.share.hashtag} · ${window.location.host}`,
    });
    const blob = await share.canvasBlob(canvas);
    card = { blob, url: URL.createObjectURL(blob) };
    return card;
  }

  const shareText = () =>
    L(brand.share.text)
      .replace('{score}', ui.fmt(lastResult.score))
      .replace('{game}', L(brand.game.title))
      .replace('{brand}', brand.brand.name) + ` ${brand.share.hashtag}`;
  const shareUrl = () => share.challengeUrl(lastResult.score);
  const fileName = () => `${brand.id}-${lastResult.score}.png`;

  const handlers = {
    click: () => {
      audio.unlock();
      audio.play('click');
    },
    play,
    pause() {
      if (game.pause()) {
        ui.setPaused(true);
        audio.hold(true);
      }
    },
    resume() {
      ui.setPaused(false);
      audio.hold(false);
      game.resume();
    },
    quit() {
      ui.setPaused(false);
      audio.hold(false);
      audio.setIntensity(0);
      document.getElementById('ui').classList.remove('powered');
      game.toAttract();
      ui.showTitle({ best, challenge });
    },
    sound() {
      const muted = !audio.muted;
      audio.setMuted(muted);
      store.set('muted', muted);
      ui.setSound(muted);
    },
    lang() {
      lang = ui.nextLang();
      store.set('lang', lang);
      t = makeT(lang);
      applyBrand();
      ui.setLang(lang, t);
      ui.showTitle({ best, challenge });
    },
    async share() {
      if (!lastResult) return;
      const c = await ensureCard();
      emit('share', { method: 'open', score: lastResult.score });
      // phones: go straight to the native sheet with the image attached
      if (coarse && navigator.share) {
        const ok = await share.nativeShare({ blob: c.blob, text: shareText(), url: shareUrl(), filename: fileName() });
        if (ok) return;
      }
      ui.openShare(c.url);
    },
    closeShare: () => ui.closeShare(),
    async shareNative() {
      const c = await ensureCard();
      emit('share', { method: 'native', score: lastResult.score });
      await share.nativeShare({ blob: c.blob, text: shareText(), url: shareUrl(), filename: fileName() });
    },
    shareWhatsapp() {
      emit('share', { method: 'whatsapp', score: lastResult.score });
      window.open(`https://wa.me/?text=${encodeURIComponent(`${shareText()} ${shareUrl()}`)}`, '_blank', 'noopener');
    },
    async shareCopy(el) {
      emit('share', { method: 'copy', score: lastResult.score });
      if (await share.copyText(`${shareText()} ${shareUrl()}`)) ui.flashLabel(el, t('copied'));
    },
    async shareDownload() {
      const c = await ensureCard();
      emit('share', { method: 'download', score: lastResult.score });
      share.downloadBlob(c.blob, fileName());
    },
    async copyCode(el) {
      if (await share.copyText(el.dataset.code)) ui.flashLabel(el, t('copied'));
    },
    cta: () => emit('cta', { url: brand.brand.url }),
  };

  ui = new UI(document.getElementById('ui'), { brand, lang, t, store, handlers, coarse, muted: audio.muted });
  ui.showTitle({ best, challenge });

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (e.key === ' ' || e.key === 'Enter') {
      if (document.activeElement?.closest?.('button, a')) return;
      if (ui.screen === 'title' || ui.screen === 'over') {
        e.preventDefault();
        play();
      }
    } else if (e.key === 'Escape' || e.key.toLowerCase() === 'p') {
      if (game.mode === 'playing') handlers.pause();
      else if (game.mode === 'paused') handlers.resume();
    } else if (e.key.toLowerCase() === 'm') handlers.sound();
  });
  // browsers only allow audio after a gesture
  window.addEventListener('pointerdown', () => audio.unlock(), { once: true });

  boot.classList.add('done');
  setTimeout(() => boot.remove(), 600);
  emit('ready', { lang });
  if (import.meta.env.DEV || params.has('debug')) window.__arcade = { game, ui, audio, brand };
}

main();
