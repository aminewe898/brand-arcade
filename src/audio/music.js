// Generative soundtrack (no audio files, no licence): a 4-bar loop in D major whose
// arrangement follows the game state. Works on any BaseAudioContext, so
// tools/render-music.mjs can render it offline for loudness checks.
//
// intensity 0 = menu (soft, filtered) · 1 = run · 2 = power mode
const BPM = 112;
export const STEP = 60 / BPM / 4; // one 16th note

const CHORDS = [
  { root: 38, notes: [62, 66, 69] }, // D
  { root: 35, notes: [62, 66, 71] }, // Bm
  { root: 31, notes: [62, 67, 71] }, // G
  { root: 33, notes: [61, 64, 69] }, // A
];
// prettier-ignore
const MELODY = [
  74, 0, 0, 78, 0, 0, 81, 0, 0, 78, 0, 0, 76, 0, 74, 0,
  71, 0, 0, 74, 0, 0, 78, 0, 0, 74, 0, 0, 71, 0, 69, 0,
  67, 0, 0, 71, 0, 0, 74, 0, 0, 79, 0, 0, 78, 0, 74, 0,
  69, 0, 0, 73, 0, 0, 76, 0, 81, 0, 0, 79, 0, 76, 0, 0,
];
const BASS = [1, 0, 0, 1, 0, 0, 2, 0, 1, 0, 0, 1, 0, 0, 2, 0]; // 2 = octave up

const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

export function createMusic(ctx, out) {
  const bus = ctx.createGain();
  bus.gain.value = 1;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 2200;
  filter.Q.value = 0.4;
  bus.connect(filter).connect(out);

  // dotted-eighth echo for the lead
  const delay = ctx.createDelay(1);
  delay.delayTime.value = STEP * 3;
  const fb = ctx.createGain();
  fb.gain.value = 0.3;
  const wet = ctx.createGain();
  wet.gain.value = 0.28;
  delay.connect(fb).connect(delay);
  delay.connect(wet).connect(bus);

  const noise = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
  const nd = noise.getChannelData(0);
  let seed = 1;
  for (let i = 0; i < nd.length; i++) {
    seed = (seed * 16807) % 2147483647;
    nd[i] = (seed / 2147483647) * 2 - 1;
  }

  let intensity = 0;
  let step = 0;
  let nextTime = 0;
  let running = false;

  function env(g, t, peak, attack, decay) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  function kick(t, level) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(46, t + 0.11);
    env(g, t, level, 0.004, 0.24);
    o.connect(g).connect(bus);
    o.start(t);
    o.stop(t + 0.3);
  }

  function noiseHit(t, type, freq, q, level, decay) {
    const s = ctx.createBufferSource();
    s.buffer = noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    env(g, t, level, 0.002, decay);
    s.connect(f).connect(g).connect(bus);
    s.start(t, (step * 0.013) % 0.3);
    s.stop(t + decay + 0.05);
  }

  function bass(t, midi) {
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = hz(midi);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(1100, t);
    f.frequency.exponentialRampToValueAtTime(260, t + 0.18);
    const g = ctx.createGain();
    env(g, t, 0.22, 0.006, 0.2);
    o.connect(f).connect(g).connect(bus);
    o.start(t);
    o.stop(t + 0.26);
  }

  function stab(t, notes, level) {
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(2400, t);
    f.frequency.exponentialRampToValueAtTime(500, t + 0.16);
    const g = ctx.createGain();
    env(g, t, level, 0.005, 0.17);
    f.connect(g).connect(bus);
    for (const n of notes) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = hz(n);
      o.detune.value = (n % 3) * 4 - 4;
      o.connect(f);
      o.start(t);
      o.stop(t + 0.22);
    }
  }

  function lead(t, midi, level) {
    const g = ctx.createGain();
    env(g, t, level, 0.006, 0.3);
    for (const [type, det, lv] of [['triangle', 0, 1], ['sine', 1200, 0.25]]) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = hz(midi);
      o.detune.value = det;
      const og = ctx.createGain();
      og.gain.value = lv;
      o.connect(og).connect(g);
      o.start(t);
      o.stop(t + 0.36);
    }
    g.connect(bus);
    g.connect(delay);
  }

  function playStep(i, t) {
    const s = i % 16;
    const bar = Math.floor(i / 16) % 4;
    const chord = CHORDS[bar];
    const run = intensity >= 1;

    if (run ? s % 4 === 0 : s === 0 || s === 8) kick(t, run ? 0.6 : 0.36);
    if (run && (s === 4 || s === 12)) noiseHit(t, 'bandpass', 1900, 0.9, 0.4, 0.13);
    if (s % 4 === 2) noiseHit(t, 'highpass', 7500, 0.5, run ? 0.22 : 0.1, 0.04);
    if (intensity >= 2 && s % 2 === 1) noiseHit(t, 'highpass', 9000, 0.5, 0.13, 0.025);
    if (BASS[s]) bass(t, chord.root + (BASS[s] === 2 ? 12 : 0));
    if (s % 4 === 2 || (intensity >= 2 && s % 4 === 3)) stab(t, chord.notes, run ? 0.2 : 0.13);
    const m = MELODY[i % 64];
    if (m) lead(t, m + (intensity >= 2 ? 12 : 0), run ? 0.42 : 0.34);
  }

  return {
    get running() {
      return running;
    },
    start(t0) {
      running = true;
      step = 0;
      nextTime = t0;
    },
    stop() {
      running = false;
    },
    /** Schedule every step that starts before `until` (AudioContext time). */
    schedule(until) {
      if (!running) return;
      if (nextTime < ctx.currentTime - 0.2) nextTime = ctx.currentTime + 0.05; // after a suspend
      while (nextTime < until) {
        playStep(step, nextTime);
        step++;
        nextTime += STEP;
      }
    },
    setIntensity(v) {
      if (v === intensity) return;
      intensity = v;
      const t = ctx.currentTime;
      filter.frequency.cancelScheduledValues(t);
      filter.frequency.setTargetAtTime(v === 0 ? 2200 : v === 1 ? 9000 : 16000, t, 0.25);
    },
  };
}
