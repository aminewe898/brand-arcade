// Sound: sample-based effects (public/sfx) + the generative soundtrack.
// The AudioContext is created on the first user gesture, as browsers require.
import { createMusic } from './music.js';

// name → [file, base gain]. Every file peaks at -1 dBFS; the gains even out their
// measured loudness (see README, "Sound") so no effect jumps out of the mix.
const SFX = {
  pick: ['pick', 0.5],
  mult: ['mult', 0.3],
  token: ['token', 0.7],
  shield: ['shield', 0.8],
  shieldBreak: ['shield-break', 0.95],
  near: ['near', 0.9],
  smash: ['smash', 1.5],
  fizz: ['fizz', 1.0],
  fizzEnd: ['fizz-end', 0.22],
  gate: ['gate', 0.7],
  crash: ['crash', 1.0],
  click: ['click', 0.5],
  reward: ['reward', 0.6],
  best: ['best', 0.5],
};

export class AudioKit {
  constructor(muted) {
    this.muted = !!muted;
    this.ctx = null;
    this.buffers = {};
    this.intensity = 0;
  }

  /** Call from a user gesture. Safe to call repeatedly. */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const ctx = (this.ctx = new AC({ latencyHint: 'interactive' }));
      this.master = ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 1;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -12;
      comp.ratio.value = 4;
      comp.attack.value = 0.004;
      comp.release.value = 0.18;
      this.master.connect(comp).connect(ctx.destination);
      this.sfxBus = ctx.createGain();
      this.sfxBus.gain.value = 0.9;
      this.sfxBus.connect(this.master);
      this.musicBus = ctx.createGain();
      this.musicBus.gain.value = 0.6;
      this.musicBus.connect(this.master);
      this.music = createMusic(ctx, this.musicBus);
      this.music.setIntensity(this.intensity);
      this.music.start(ctx.currentTime + 0.08);
      this.timer = setInterval(() => this.music.schedule(ctx.currentTime + 0.25), 60);
      this.load();
    }
    if (this.ctx.state === 'suspended' && !this.held) this.ctx.resume();
  }

  async load() {
    const base = import.meta.env.BASE_URL + 'sfx/';
    await Promise.all(
      Object.entries(SFX).map(async ([name, [file]]) => {
        try {
          const res = await fetch(`${base}${file}.mp3`);
          const data = await res.arrayBuffer();
          this.buffers[name] = await this.ctx.decodeAudioData(data);
        } catch {
          /* a missing sound must never break the game */
        }
      }),
    );
  }

  play(name, { rate = 1, gain = 1 } = {}) {
    const buf = this.buffers[name];
    if (!buf || !this.ctx || this.muted || this.ctx.state !== 'running') return;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    const g = this.ctx.createGain();
    g.gain.value = SFX[name][1] * gain;
    src.connect(g).connect(this.sfxBus);
    src.start();
  }

  setIntensity(v) {
    this.intensity = v;
    this.music?.setIntensity(v);
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 1, this.ctx.currentTime, 0.03);
  }

  /** Silence everything while the game is paused or the tab is hidden. */
  hold(on) {
    this.held = on;
    if (!this.ctx) return;
    if (on) this.ctx.suspend();
    else this.ctx.resume();
  }
}
