// Gameplay tuning. Any key can be overridden per brand via `brand.tuning`.
export const TUNING = {
  lanes: [-2.4, -1.2, 0, 1.2, 2.4],
  halfWidth: 2.75, // how far the player can move from the centre
  trackWidth: 6.4,

  speedStart: 17, // m/s
  speedMax: 44,
  speedRamp: 1400, // metres for ~63% of the ramp
  difficultyRamp: 2200, // metres to reach full difficulty

  rowTimeEasy: 0.74, // seconds between obstacle rows at the start
  rowTimeHard: 0.4, // …and at full difficulty
  zoneLength: 400, // metres between gates

  // scoring
  slicePoints: 10,
  tokenPoints: 50,
  nearMissPoints: 25,
  smashPoints: 30,
  gatePoints: 100,
  comboPerMult: 10, // pickups per multiplier step
  maxMult: 5,
  comboWindow: 2.0, // seconds before the chain breaks

  // power mode
  fizzPerSlice: 0.017,
  fizzPerNearMiss: 0.08,
  fizzPerToken: 0.2,
  fizzPerGate: 0.1,
  fizzDuration: 6,
  fizzSpeed: 1.3,
  fizzScore: 2,

  tokenEvery: [260, 180], // metres between premium pickups (easy → hard)
  shieldEvery: [700, 1100], // random range in metres
};

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => t * t * (3 - 2 * t);

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
