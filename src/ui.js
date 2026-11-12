// DOM interface: title, HUD, pause, game over, share sheet. No framework — the
// whole UI is one template rendered from the brand config and the i18n table.
import { loc } from './brands/index.js';

const ICON = {
  soundOn: '<svg viewBox="0 0 24 24"><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4z" fill="currentColor"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  soundOff: '<svg viewBox="0 0 24 24"><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4z" fill="currentColor"/><path d="M16 9.5l5 5M21 9.5l-5 5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
  pause: '<svg viewBox="0 0 24 24"><rect x="6" y="5" width="4.2" height="14" rx="1.4" fill="currentColor"/><rect x="13.8" y="5" width="4.2" height="14" rx="1.4" fill="currentColor"/></svg>',
  share: '<svg viewBox="0 0 24 24"><path d="M12 15V4m0 0L8 8m4-4l4 4M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  copy: '<svg viewBox="0 0 24 24"><rect x="8.5" y="8.5" width="11" height="11" rx="2.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M15.5 5.5v-.5a2 2 0 0 0-2-2H6.5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2H7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  replay: '<svg viewBox="0 0 24 24"><path d="M5 12a7 7 0 1 0 2.3-5.2M5 4.5v4h4" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  play: '<svg viewBox="0 0 24 24"><path d="M8 5.2v13.6a1 1 0 0 0 1.5.86l11-6.8a1 1 0 0 0 0-1.72l-11-6.8A1 1 0 0 0 8 5.2z" fill="currentColor"/></svg>',
  arrow: '<svg viewBox="0 0 24 24"><path d="M5 12h13m0 0l-5-5m5 5l-5 5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  medal: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="currentColor"/><path d="M12 6.8l1.5 3.2 3.5.4-2.6 2.4.7 3.5-3.1-1.8-3.1 1.8.7-3.5L7 10.4l3.5-.4z" fill="rgba(255,255,255,.75)"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  bubble: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M8.5 9.5a4 4 0 0 1 3-2.4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  close: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>',
  hand: '<svg viewBox="0 0 48 48"><path d="M19 23V10a3 3 0 0 1 6 0v10l9.6 2.2a4 4 0 0 1 3.1 4.6L36 37a6 6 0 0 1-5.9 5H23a6 6 0 0 1-4.6-2.1l-7.6-9a2.8 2.8 0 0 1 4-3.9L19 31" fill="#fff" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  download: '<svg viewBox="0 0 24 24"><path d="M12 4v11m0 0l-4-4m4 4l4-4M5 19h14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  link: '<svg viewBox="0 0 24 24"><path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
  chat: '<svg viewBox="0 0 24 24"><path d="M12 3.5a8.5 8.5 0 0 0-7.3 12.8L3.5 20.5l4.4-1.1A8.5 8.5 0 1 0 12 3.5z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/></svg>',
};

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export class UI {
  constructor(root, ctx) {
    this.root = root;
    Object.assign(this, ctx); // brand, lang, t, store, handlers, coarse
    this.cache = {};
    this.screen = null;
    root.addEventListener('click', (e) => {
      const el = e.target.closest('[data-act]');
      if (!el) return;
      const act = el.dataset.act;
      this.handlers.click?.();
      this.handlers[act]?.(el);
    });
    this.build();
  }

  L(v) {
    return loc(v, this.lang);
  }

  fmt(n) {
    try {
      return new Intl.NumberFormat(this.lang === 'es' ? 'es-ES' : this.lang, { useGrouping: 'always' }).format(n);
    } catch {
      return String(n);
    }
  }

  setLang(lang, t) {
    this.lang = lang;
    this.t = t;
    const screen = this.screen;
    this.build();
    this.show(screen);
  }

  build() {
    const { brand, t } = this;
    const b = brand.brand;
    const langs = brand.locale.available;
    const title = esc(this.L(brand.game.title));
    this.cache = {};
    this.root.innerHTML = `
      <section class="screen title" data-screen="title" hidden>
        <header class="topbar">
          <div class="brandmark">${esc(b.name)}</div>
          <div class="top-actions">
            ${langs.length > 1 ? `<button class="chip-btn" data-act="lang" aria-label="${esc(t('language'))}">${esc(this.nextLang().toUpperCase())}</button>` : ''}
            <button class="icon-btn" data-act="sound" aria-label="${esc(t('sound'))}"><span class="sound-ico"></span></button>
          </div>
        </header>
        <div class="title-main">
          <div class="kicker">${esc(t('presents', { brand: b.name }))}</div>
          <h1 class="logo">${title.replace(' ', ' <br>')}</h1>
          <p class="pitch">${esc(this.L(brand.game.pitch))}</p>
        </div>
        <div class="title-bottom">
          <div class="challenge" hidden></div>
          <button class="btn primary big" data-act="play">${ICON.play}<span>${esc(t('play'))}</span></button>
          <div class="hint">${esc(t(this.coarse ? 'hintTouch' : 'hintMouse'))}</div>
          <div class="rewards-strip" aria-label="${esc(t('rewards'))}"></div>
          <div class="best-line"></div>
          <small class="legal">${esc(this.L(brand.legal))}</small>
        </div>
      </section>

      <section class="screen hud" data-screen="hud" hidden>
        <div class="hud-top">
          <div class="hud-left">
            <div class="score-num">0</div>
            <div class="next-reward"><span class="medal">${ICON.medal}</span><div class="bar"><b></b></div><span class="nr-label"></span></div>
          </div>
          <div class="hud-right">
            <div class="hud-shield" hidden>${ICON.bubble}</div>
            <button class="icon-btn" data-act="pause" aria-label="${esc(t('pause'))}">${ICON.pause}</button>
          </div>
        </div>
        <div class="hud-row">
          <div class="chain"><span class="mult">x1</span><div class="bar"><b></b></div></div>
          <div class="power"><span class="power-name">${esc(this.L(brand.game.powerName))}</span><div class="bar"><b></b></div></div>
        </div>
        <div class="announce"></div>
        <div class="popups"></div>
        <div class="swipe-hint" hidden><span class="hand">${ICON.hand}</span><span>${esc(t(this.coarse ? 'hintTouch' : 'hintMouse'))}</span></div>
      </section>

      <section class="screen over" data-screen="over" hidden>
        <div class="panel">
          <div class="badge-best" hidden>${esc(t('newBest'))}</div>
          <h2 class="over-title">${esc(t('gameOver'))}</h2>
          <div class="final-score">0</div>
          <div class="challenge-result" hidden>${ICON.check}<span>${esc(t('challengeWon'))}</span></div>
          <div class="stats">
            <div><b data-stat="distance">0</b><span>${esc(t('distance'))}</span></div>
            <div><b data-stat="combo">0</b><span>${esc(t('combo'))}</span></div>
            <div><b data-stat="collected">0</b><span>${esc(t('collected'))}</span></div>
          </div>
          <div class="reward-card"></div>
          <div class="actions">
            <button class="btn primary" data-act="play">${ICON.replay}<span>${esc(t('playAgain'))}</span></button>
            <button class="btn secondary" data-act="share">${ICON.share}<span>${esc(t('share'))}</span></button>
          </div>
          <a class="cta" data-act="cta" href="${esc(b.url)}" target="_blank" rel="noopener">${esc(this.L(b.cta))}${ICON.arrow}</a>
          <small class="legal">${esc(this.L(brand.legal))}</small>
        </div>
      </section>

      <div class="overlay pause-overlay" hidden>
        <div class="panel small">
          <h2>${esc(t('paused'))}</h2>
          <div class="actions col">
            <button class="btn primary" data-act="resume">${ICON.play}<span>${esc(t('resume'))}</span></button>
            <button class="btn ghost" data-act="quit">${esc(t('quit'))}</button>
          </div>
        </div>
      </div>

      <div class="overlay share-overlay" hidden>
        <div class="panel sheet">
          <button class="icon-btn close" data-act="closeShare" aria-label="${esc(t('close'))}">${ICON.close}</button>
          <h2>${esc(t('shareTitle'))}</h2>
          <img class="card-preview" alt="">
          <div class="share-grid">
            ${navigator.share ? `<button class="btn primary" data-act="shareNative">${ICON.share}<span>${esc(t('shareNative'))}</span></button>` : ''}
            <button class="btn secondary" data-act="shareWhatsapp">${ICON.chat}<span>${esc(t('whatsapp'))}</span></button>
            <button class="btn secondary" data-act="shareCopy">${ICON.link}<span class="copy-label">${esc(t('copyLink'))}</span></button>
            <button class="btn secondary" data-act="shareDownload">${ICON.download}<span>${esc(t('download'))}</span></button>
          </div>
        </div>
      </div>

      <div class="toast" hidden></div>
      <div class="flash"></div>
    `;
    this.$ = (sel) => this.root.querySelector(sel);
    this.el = {
      score: this.$('.score-num'),
      mult: this.$('.mult'),
      chain: this.$('.chain'),
      chainBar: this.$('.chain .bar b'),
      power: this.$('.power'),
      powerBar: this.$('.power .bar b'),
      shield: this.$('.hud-shield'),
      nextReward: this.$('.next-reward'),
      nrBar: this.$('.next-reward .bar b'),
      nrLabel: this.$('.nr-label'),
      announce: this.$('.announce'),
      popups: this.$('.popups'),
      toast: this.$('.toast'),
      flash: this.$('.flash'),
    };
    this.setSound(this.muted);
  }

  nextLang() {
    const a = this.brand.locale.available;
    return a[(a.indexOf(this.lang) + 1) % a.length];
  }

  show(screen) {
    this.screen = screen;
    for (const s of this.root.querySelectorAll('.screen')) s.hidden = s.dataset.screen !== screen;
  }

  flash() {
    const f = this.el.flash;
    f.classList.remove('go');
    void f.offsetWidth;
    f.classList.add('go');
  }

  setSound(muted) {
    this.muted = muted;
    for (const el of this.root.querySelectorAll('.sound-ico')) el.innerHTML = muted ? ICON.soundOff : ICON.soundOn;
  }

  // ── title ────────────────────────────────────────────────────────────────
  showTitle({ best, challenge }) {
    const { brand, t } = this;
    this.$('.rewards-strip').innerHTML = brand.rewards
      .map((r) => {
        const got = best >= r.score;
        return `<div class="tier${got ? ' got' : ''}" style="--tier:${r.color}">
          <span class="medal">${got ? ICON.check : ICON.medal}</span>
          <div><b>${esc(this.L(r.prize))}</b><span>${this.fmt(r.score)} ${esc(t('points'))}</span></div>
        </div>`;
      })
      .join('');
    this.$('.best-line').textContent = best > 0 ? `${t('best')}: ${this.fmt(best)}` : '';
    const ch = this.$('.challenge');
    ch.hidden = !challenge;
    if (challenge) ch.textContent = t('challenge', { score: this.fmt(challenge) });
    this.show('title');
  }

  // ── HUD ──────────────────────────────────────────────────────────────────
  showHud(firstTime) {
    this.show('hud');
    const hint = this.$('.swipe-hint');
    hint.hidden = !firstTime;
    if (firstTime) setTimeout(() => (hint.hidden = true), 4200);
  }

  hud(s, next) {
    const c = this.cache;
    const e = this.el;
    if (c.score !== s.score) {
      c.score = s.score;
      e.score.textContent = this.fmt(s.score);
    }
    if (c.mult !== s.mult) {
      const up = s.mult > (c.mult || 1);
      c.mult = s.mult;
      e.mult.textContent = 'x' + s.mult;
      e.chain.dataset.m = s.mult;
      if (up) this.bump(e.chain);
    }
    const cf = Math.round(s.comboFrac * 50);
    if (c.cf !== cf) {
      c.cf = cf;
      e.chainBar.style.transform = `scaleX(${cf / 50})`;
    }
    const pf = Math.round(s.fizz * 100);
    if (c.pf !== pf) {
      c.pf = pf;
      e.powerBar.style.transform = `scaleX(${pf / 100})`;
    }
    if (c.fa !== s.fizzActive) {
      c.fa = s.fizzActive;
      e.power.classList.toggle('on', s.fizzActive);
      this.root.classList.toggle('powered', s.fizzActive);
    }
    if (c.shield !== s.shield) {
      c.shield = s.shield;
      e.shield.hidden = !s.shield;
    }
    // progress to the next locked reward
    const key = next ? next.id : 'none';
    if (c.nrKey !== key) {
      c.nrKey = key;
      e.nextReward.hidden = !next;
      if (next) {
        e.nextReward.style.setProperty('--tier', next.color);
        e.nrLabel.textContent = this.fmt(next.score);
      }
    }
    if (next) {
      const nf = Math.round(Math.min(1, s.score / next.score) * 60);
      if (c.nf !== nf) {
        c.nf = nf;
        e.nrBar.style.transform = `scaleX(${nf / 60})`;
      }
    }
  }

  bump(el) {
    el.classList.remove('bump');
    void el.offsetWidth;
    el.classList.add('bump');
  }

  /** Floating text near the hero. pos = {x, y} in CSS px. */
  popup(text, kind, pos) {
    const p = this.el.popups;
    if (p.childElementCount > 6) p.firstElementChild.remove();
    const el = document.createElement('span');
    el.className = `pop ${kind}`;
    el.textContent = text;
    el.style.left = `${pos.x + (Math.random() - 0.5) * 50}px`;
    el.style.top = `${pos.y}px`;
    el.addEventListener('animationend', () => el.remove());
    p.appendChild(el);
  }

  /** Big centred call-out (zone change, power mode). */
  announce(text, kind = '') {
    const a = this.el.announce;
    a.textContent = text;
    a.className = `announce ${kind}`;
    void a.offsetWidth;
    a.classList.add('go');
  }

  toast(html, color) {
    const el = this.el.toast;
    el.innerHTML = html;
    el.style.setProperty('--tier', color || 'var(--secondary)');
    el.hidden = false;
    el.classList.remove('go');
    void el.offsetWidth;
    el.classList.add('go');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => (el.hidden = true), 3200);
  }

  rewardToast(reward) {
    this.toast(`<span class="medal">${ICON.medal}</span><div><small>${esc(this.t('unlocked'))}</small><b>${esc(this.L(reward.prize))}</b></div>`, reward.color);
  }

  setPaused(on) {
    this.$('.pause-overlay').hidden = !on;
  }

  // ── game over ────────────────────────────────────────────────────────────
  showOver(result, { best, isBest, reward, next, challengeBeaten }) {
    const { t } = this;
    this.setPaused(false);
    this.el.toast.hidden = true;
    this.$('.badge-best').hidden = !isBest;
    this.$('.challenge-result').hidden = !challengeBeaten;
    this.$('[data-stat="distance"]').textContent = `${this.fmt(result.distance)} m`;
    this.$('[data-stat="combo"]').textContent = this.fmt(result.bestCombo);
    this.$('[data-stat="collected"]').textContent = this.fmt(result.slices + result.tokens);

    let html = '';
    if (reward) {
      html += `<div class="reward got" style="--tier:${reward.color}">
        <span class="medal">${ICON.medal}</span>
        <div class="reward-text"><small>${esc(t('unlocked'))} · ${esc(this.L(reward.name))}</small><b>${esc(this.L(reward.prize))}</b></div>
        <div class="code"><span>${esc(t('yourCode'))}</span><code>${esc(reward.code)}</code>
          <button class="btn mini" data-act="copyCode" data-code="${esc(reward.code)}">${ICON.copy}<span>${esc(t('copy'))}</span></button></div>
      </div>`;
    }
    if (next) {
      const frac = Math.min(1, best / next.score);
      html += `<div class="reward next" style="--tier:${next.color}">
        <span class="medal">${ICON.medal}</span>
        <div class="reward-text"><b>${esc(t('nextReward', { n: this.fmt(next.score - best), prize: this.L(next.prize) }))}</b>
        <div class="bar"><b style="transform:scaleX(${frac})"></b></div></div>
      </div>`;
    } else {
      html += `<div class="reward all"><b>${esc(t('allRewards'))}</b></div>`;
    }
    this.$('.reward-card').innerHTML = html;
    this.show('over');

    // score count-up
    const el = this.$('.final-score');
    const t0 = performance.now();
    const dur = 900;
    const step = (now) => {
      const u = Math.min(1, (now - t0) / dur);
      const eased = 1 - Math.pow(1 - u, 3);
      el.textContent = this.fmt(Math.round(result.score * eased));
      if (u < 1 && this.screen === 'over') requestAnimationFrame(step);
      else el.textContent = this.fmt(result.score);
    };
    requestAnimationFrame(step);
  }

  // ── share sheet ──────────────────────────────────────────────────────────
  openShare(imageUrl) {
    this.$('.card-preview').src = imageUrl;
    this.$('.share-overlay').hidden = false;
  }

  closeShare() {
    this.$('.share-overlay').hidden = true;
  }

  flashLabel(el, text) {
    const span = el.querySelector('span:last-child');
    if (!span) return;
    const old = span.textContent;
    span.textContent = text;
    setTimeout(() => (span.textContent = old), 1600);
  }
}
