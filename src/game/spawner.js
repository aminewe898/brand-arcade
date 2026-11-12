// Course generator.
//
// Fairness rule: a "safe lane" random-walks down the course. Enemies only ever occupy
// the other lanes (moving ones are fenced so they cannot reach it), and the collectible
// trail follows the safe lane, so the trail is always a survivable line and reads as a
// hint. Premium pickups sit OFF the trail, so greed is the player's own risk.
//
// Enemy roster, in the order a run introduces them (metres into the run):
//   spike    0     static urchin
//   barrier  150   wall with a door
//   crab     350   scuttles sideways over 2–3 lanes
//   barrel   550   rolls down the track towards you
//   jelly    800   bobs up and down — slip under it at the top of its bounce
//   zap      1050  energy beam that switches on and off
//   mill     1300  spinning spiked arm
//   wasp     1550  hovers and drifts towards you
//   mix      1800  every row picks its own type
import { clamp, lerp, smooth } from './tuning.js';

export const ROSTER = [
  { type: 'spikes', at: 0, weight: 0.3, len: [3, 6] },
  { type: 'wall', at: 150, weight: 0.2, len: [2, 3] },
  { type: 'crabs', at: 350, weight: 0.2, len: [3, 4] },
  { type: 'barrels', at: 550, weight: 0.2, len: [3, 5] },
  { type: 'jelly', at: 800, weight: 0.2, len: [3, 4] },
  { type: 'zap', at: 1050, weight: 0.2, len: [2, 3] },
  { type: 'mill', at: 1300, weight: 0.2, len: [3, 4] },
  { type: 'wasp', at: 1550, weight: 0.18, len: [3, 4] },
  { type: 'mix', at: 1800, weight: 0.45, len: [5, 8] },
];

export class Spawner {
  constructor(tune, rng, variants) {
    this.t = tune;
    this.rng = rng;
    this.variants = variants;
    this.guide = [];
  }

  speedAt(rd) {
    const t = this.t;
    return t.speedStart + (t.speedMax - t.speedStart) * (1 - Math.exp(-Math.max(0, rd) / t.speedRamp));
  }

  difficulty(rd) {
    return clamp(rd / this.t.difficultyRamp, 0, 1);
  }

  reset(s0, runStart, rng) {
    if (rng) this.rng = rng;
    this.s = s0;
    this.runStart = runStart;
    this.lane = 2;
    this.prev = { s: s0, x: 0 };
    this.guide = [
      { s: s0 - 400, x: 0 },
      { s: s0, x: 0 },
    ];
    this.seg = { type: 'trail', left: 3 };
    this.shown = new Set(['spikes']); // enemy types the player has already met this run
    this.variant = 0;
    this.sinceToken = 60;
    this.nextShield = 500 + this.rng() * 300;
  }

  /** Lateral position of the safe line at course position s. */
  guideX(s) {
    const g = this.guide;
    for (let i = g.length - 1; i > 0; i--) {
      if (g[i - 1].s <= s) {
        const a = g[i - 1];
        const b = g[i];
        return lerp(a.x, b.x, smooth(clamp((s - a.s) / (b.s - a.s || 1), 0, 1)));
      }
    }
    return g.length ? g[0].x : 0;
  }

  fill(until, behind, ents) {
    while (this.s < until) this.row(ents);
    while (this.guide.length > 3 && this.guide[1].s < behind) this.guide.shift();
  }

  nextSeg(rd) {
    const r = this.rng;
    const open = ROSTER.filter((o) => rd >= o.at);
    // a newly unlocked enemy gets its own introduction, after a short breather
    const fresh = open.find((o) => !this.shown.has(o.type));
    let pick;
    if (fresh && this.seg.type === 'trail') pick = fresh;
    else if (fresh || (this.seg.type !== 'trail' && r() < 0.22)) pick = { type: 'trail', len: [2, 3] };
    else {
      const options = open.filter((o) => o.type !== this.seg.type || open.length === 1);
      let total = 0;
      for (const o of options) total += o.weight;
      let roll = r() * total;
      pick = options[options.length - 1];
      for (const o of options) {
        roll -= o.weight;
        if (roll <= 0) {
          pick = o;
          break;
        }
      }
    }
    this.shown.add(pick.type);
    this.seg = { type: pick.type, left: pick.len[0] + ((r() * (pick.len[1] - pick.len[0] + 1)) | 0) - 1 };
    this.variant = (this.variant + 1 + ((r() * (this.variants - 1)) | 0)) % this.variants;
  }

  row(ents) {
    const t = this.t;
    const r = this.rng;
    const L = t.lanes;
    const rd = this.s - this.runStart;
    const d = this.difficulty(rd);
    const gap = Math.max(9, this.speedAt(rd) * lerp(t.rowTimeEasy, t.rowTimeHard, d));
    const s = this.s + gap;

    if (--this.seg.left < 0) this.nextSeg(rd);
    let type = this.seg.type;
    if (type === 'mix') {
      const open = ROSTER.filter((o) => rd >= o.at && o.type !== 'mix');
      type = open[(r() * open.length) | 0].type;
    }

    // move the safe lane
    let lane = this.lane;
    if (r() < (type === 'trail' ? 0.85 : 0.72)) {
      let step = r() < 0.5 ? -1 : 1;
      if (d > 0.35 && r() < 0.18) step *= 2;
      lane += step;
      if (lane < 0 || lane > 4) lane = this.lane - step;
      lane = clamp(lane, 0, 4);
    }
    const x = L[lane];
    const others = () => [0, 1, 2, 3, 4].filter((l) => l !== lane && !blocked.has(l));
    const pickSome = (n) => {
      const out = [];
      while (n-- > 0) {
        const free = others();
        if (!free.length) break;
        const l = free[(r() * free.length) | 0];
        blocked.add(l);
        out.push(l);
      }
      return out;
    };
    /** Runs of adjacent blocked lanes → wide obstacles; single lanes → `single`. */
    const runs = (wide, single) => {
      let l = 0;
      while (l < 5) {
        if (!blocked.has(l)) {
          l++;
          continue;
        }
        let e = l;
        while (e + 1 < 5 && blocked.has(e + 1)) e++;
        const n = e - l + 1;
        if (n === 1) single(L[l]);
        else wide((L[l] + L[e]) / 2, (n * 1.2 - 0.3) / 2);
        l = e + 1;
      }
    };
    const blockAllButDoor = () => {
      for (let l = 0; l < 5; l++) if (l !== lane) blocked.add(l);
      if (r() < (1 - d) * 0.7) {
        const extra = lane + (r() < 0.5 ? -1 : 1);
        if (extra >= 0 && extra <= 4) blocked.delete(extra); // early on, a second door
      }
    };

    // enemies on this row
    const blocked = new Set();
    const count = 1 + (r() < d * 0.9 + 0.15 ? 1 : 0) + (r() < d * 0.7 ? 1 : 0);
    if (type === 'spikes') {
      for (const l of pickSome(count + (d > 0.6 && r() < 0.35 ? 1 : 0))) ents.push({ k: 'spike', s, x: L[l], hw: 0 });
    } else if (type === 'wall') {
      blockAllButDoor();
      runs(
        (cx, hw) => ents.push({ k: 'barrier', s, x: cx, hw }),
        (sx) => ents.push({ k: 'spike', s, x: sx, hw: 0 }),
      );
    } else if (type === 'crabs') {
      const centres = [0, 1, 2, 3, 4].filter((c) => Math.abs(c - lane) >= 2);
      const c = centres[(r() * centres.length) | 0];
      for (const l of [c - 1, c, c + 1]) blocked.add(l);
      ents.push({
        k: 'crab', s, x: L[c], hw: 0,
        mv: { c: L[c], amp: 1.2, w: 1.6 + r() * 1.6 + d, ph: r() * 6.28, min: L[0], max: L[4] },
      });
      if (d > 0.5 && r() < 0.5) for (const l of pickSome(1)) ents.push({ k: 'spike', s, x: L[l], hw: 0 });
    } else if (type === 'barrels') {
      for (const l of pickSome(Math.min(3, count))) ents.push({ k: 'barrel', s, x: L[l], hw: 0, roll: 0.5 + r() * 0.6 });
    } else if (type === 'jelly') {
      if (r() < 0.45 + d * 0.3) {
        for (let l = 0; l < 5; l++) if (l !== lane) blocked.add(l);
      } else pickSome(2 + (r() < d ? 1 : 0));
      const ph = r() * 6.28;
      for (const l of blocked) ents.push({ k: 'jelly', s, x: L[l], hw: 0, w: 2.4 + d * 1.2, ph: ph + l * 1.3 });
    } else if (type === 'zap') {
      blockAllButDoor();
      const ph = r() * 1.6;
      runs(
        (cx, hw) => ents.push({ k: 'zap', s, x: cx, hw, ph }),
        (sx) => ents.push({ k: 'spike', s, x: sx, hw: 0 }),
      );
    } else if (type === 'mill') {
      const centres = [0, 1, 2, 3, 4].filter((c) => Math.abs(c - lane) >= 2);
      const c = centres[(r() * centres.length) | 0];
      for (const l of [c - 1, c, c + 1]) blocked.add(l);
      ents.push({ k: 'mill', s, x: L[c], hw: 0, w: (r() < 0.5 ? -1 : 1) * (2 + r() + d * 1.4), ph: r() * 6.28 });
      if (d > 0.5 && r() < 0.5) for (const l of pickSome(1)) ents.push({ k: 'spike', s, x: L[l], hw: 0 });
    } else if (type === 'wasp') {
      const far = [0, 1, 2, 3, 4].filter((l) => Math.abs(l - lane) >= 2);
      const l = far[(r() * far.length) | 0];
      // gx = the safe line at this row: the wasp is fenced one lane away from it
      ents.push({ k: 'wasp', s, x: L[l], hw: 0, gx: x, side: L[l] < x ? -1 : 1 });
      if (d > 0.4 && r() < 0.5) {
        blocked.add(l);
        for (const l2 of pickSome(1)) if (Math.sign(L[l2] - x) !== Math.sign(L[l] - x)) ents.push({ k: 'spike', s, x: L[l2], hw: 0 });
      }
    }

    // collectible trail along the safe line (prev row → this row)
    const n = Math.max(2, Math.floor(gap / Math.max(3.2, this.speedAt(rd) * 0.2)));
    const sparse = type !== 'trail' && r() < 0.18;
    for (let i = 1; i <= n; i++) {
      const u = i / n;
      if (sparse && u < 0.6) continue;
      ents.push({ k: 'slice', v: this.variant, s: lerp(this.prev.s, s, u), x: lerp(this.prev.x, x, smooth(u)), hw: 0 });
    }

    // premium pickups: mid-gap, away from the safe line
    const mid = lerp(this.prev.s, s, 0.5);
    const offLane = () => {
      const far = [0, 1, 2, 3, 4].filter((l) => Math.abs(L[l] - x) >= 2.3 && Math.abs(L[l] - this.prev.x) >= 1.1);
      return far.length ? far[(r() * far.length) | 0] : -1;
    };
    this.sinceToken += gap;
    if (rd > 120 && this.sinceToken > lerp(t.tokenEvery[0], t.tokenEvery[1], d)) {
      const l = offLane();
      if (l >= 0) {
        ents.push({ k: 'token', s: mid, x: L[l], hw: 0 });
        this.sinceToken = 0;
      }
    }
    if (rd > this.nextShield) {
      const l = offLane();
      if (l >= 0) {
        ents.push({ k: 'shield', s: mid + 2, x: L[l], hw: 0 });
        this.nextShield = rd + lerp(t.shieldEvery[0], t.shieldEvery[1], r());
      }
    }

    this.prev = { s, x };
    this.lane = lane;
    this.s = s;
    this.guide.push({ s, x });
  }
}
