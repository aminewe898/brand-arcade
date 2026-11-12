// The game: loop, input, rules, camera. Brand-agnostic — everything visual or
// textual comes from the brand config; everything numeric from tuning.js.
import * as THREE from 'three';
import { TUNING, clamp, lerp, mulberry32 } from './tuning.js';
import { curve } from './bend.js';
import { World } from './world.js';
import { Spawner } from './spawner.js';
import { Particles } from './fx.js';
import * as M from './models.js';

const AHEAD = 165; // metres of course kept spawned in front of the player
const ZR = 0.6; // half-depth of the collision window
const HAZARDS = new Set(['spike', 'barrier', 'crab', 'barrel', 'jelly', 'zap', 'mill', 'wasp']);
const DRAWN = ['token', 'shield', 'spike', 'barrier', 'crab', 'barrel', 'jelly', 'mill', 'wasp', 'zapPost', 'zapBeam', 'blob', 'glow'];
const ZAP_PERIOD = 1.6; // seconds: on for 1.0, off for 0.6
const PICK_SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19]; // pentatonic ladder (semitones) for the pickup sound

export class Game {
  /**
   * hooks: hud(state) · popup(kind, value) · sfx(name, opts) · event(name, data)
   *        over(result) · tap() · autoPause()
   */
  constructor(canvas, brand, tagline, hooks = {}, opts = {}) {
    this.brand = brand;
    this.hooks = hooks;
    this.t = { ...TUNING, ...(brand.tuning || {}) };
    this.bot = !!opts.bot;
    this.seed = opts.seed;
    this.noAutoPause = !!opts.noAutoPause; // automated tests run in background tabs
    this.reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

    const coarse = window.matchMedia?.('(pointer: coarse)').matches;
    this.dpr = Math.min(window.devicePixelRatio || 1, coarse ? 1.75 : 2);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, 1, 0.1, 1000);

    this.world = new World(this.scene, this.renderer, brand, this.t);
    this.hero = M.buildHero(brand, tagline);
    this.scene.add(this.hero.group);

    this.meshes = {
      slice: brand.collectibles.map((spec) => M.collectibleMesh(spec, 150)),
      token: M.tokenMesh(brand, 10),
      shield: M.shieldPickupMesh(brand, 6),
      spike: M.spikeMesh(brand, 90),
      barrier: M.barrierMesh(brand, 40),
      crab: M.crabMesh(brand, 24),
      barrel: M.barrelMesh(brand, 40),
      jelly: M.jellyMesh(brand, 60),
      mill: M.millMesh(brand, 16),
      wasp: M.waspMesh(brand, 16),
      blob: M.blobMesh(220),
      glow: M.glowMesh(260),
    };
    const zap = M.zapMeshes(brand, 30);
    this.meshes.zapPost = zap.posts;
    this.meshes.zapBeam = zap.beams;
    this.scene.add(...this.meshes.slice);
    for (const k of DRAWN) this.scene.add(this.meshes[k]);
    this.glowColors = {
      slice: brand.collectibles.map((c) => new THREE.Color(c.pulp)),
      token: new THREE.Color(brand.token.color),
      accent: new THREE.Color(brand.colors.accent),
      hazard: new THREE.Color(brand.hazards.tip),
    };

    this.fx = new Particles(700);
    this.scene.add(this.fx.points);

    this.colors = {
      slice: brand.collectibles.map((c) => c.rind),
      token: brand.token.color,
      accent: brand.colors.accent,
      hazard: brand.hazards.tip,
      hazardBody: brand.hazards.body,
      primary: brand.colors.primary,
      secondary: brand.colors.secondary,
    };

    this.ents = [];
    this.spawner = new Spawner(this.t, mulberry32(1234), brand.collectibles.length);
    this.mode = 'attract';
    this.time = 0;
    this.dist = 0;
    this.speed = 15;
    this.timeScale = 1;
    this.px = 0;
    this.targetX = 0;
    this.vx = 0;
    this.keyDir = 0;
    this.keys = new Set();
    this.shake = 0;
    this.trailAcc = 0;
    this.fovKick = 0;
    this.squash = 0;
    this.hudState = {};
    this.snapCanvas = document.createElement('canvas');
    this._o = new THREE.Object3D();
    this._v = new THREE.Vector3();
    this.perfEma = 1 / 60;
    this.perfClock = 0;

    this.resetRun(this.dist + 30);
    this.bind(canvas);
    this.resize();
    this.last = performance.now();
    this.frame = this.frame.bind(this);
    requestAnimationFrame(this.frame);
  }

  // ── lifecycle ─────────────────────────────────────────────────────────────
  resetRun(firstRowAt) {
    this.ents.length = 0;
    this.runStart = this.dist;
    const seed = this.seed ?? (Math.random() * 0xffffffff) >>> 0;
    this.spawner.reset(firstRowAt, this.dist, mulberry32(seed));
    this.nextGate = this.dist + this.t.zoneLength;
    this.score = 0;
    this.combo = 0;
    this.comboT = 0;
    this.mult = 1;
    this.fizz = 0;
    this.fizzT = 0;
    this.invuln = 0;
    this.hasShield = false;
    this.zone = 1;
    this.stats = { slices: 0, tokens: 0, nearMisses: 0, bestCombo: 0, fizzes: 0, smashes: 0, t0: this.time };
    this.dieT = 0;
    const h = this.hero;
    h.group.visible = true;
    h.group.position.set(this.px, 0, 0);
    h.group.rotation.set(0, 0, 0);
    h.shield.visible = false;
    h.blob.visible = true;
  }

  start() {
    this.resetRun(this.dist + 40);
    this.mode = 'playing';
    this.timeScale = 1;
    this.targetX = this.px;
    this.fovKick = 6;
    this.hooks.event?.('start', {});
  }

  pause() {
    if (this.mode !== 'playing') return false;
    this.mode = 'paused';
    return true;
  }

  resume() {
    if (this.mode !== 'paused') return;
    this.mode = 'playing';
    this.timeScale = 0.25; // ease back in
    this.targetX = this.px;
  }

  /** Abandon the current run and go back to the self-playing menu scene. */
  toAttract() {
    this.mode = 'attract';
    this.timeScale = 1;
    this.resetRun(this.dist + 30);
  }

  // ── input ─────────────────────────────────────────────────────────────────
  bind(canvas) {
    const t = this.t;
    let dragId = null;
    let lastX = 0;
    canvas.addEventListener('pointerdown', (e) => {
      if (this.mode === 'attract') this.hooks.tap?.();
      if (e.pointerType !== 'mouse') {
        dragId = e.pointerId;
        lastX = e.clientX;
        try {
          canvas.setPointerCapture(e.pointerId);
        } catch {
          /* synthetic or already-released pointer */
        }
      }
    });
    canvas.addEventListener('pointermove', (e) => {
      if (this.mode !== 'playing' || this.bot) return;
      if (e.pointerType === 'mouse') {
        const ndc = (e.clientX / window.innerWidth) * 2 - 1;
        this.targetX = clamp(ndc * Math.min(this.visibleHalf, t.halfWidth * 1.7), -t.halfWidth, t.halfWidth);
      } else if (e.pointerId === dragId) {
        const sens = (t.halfWidth * 2) / (Math.min(window.innerWidth, 560) * 0.62);
        this.targetX = clamp(this.targetX + (e.clientX - lastX) * sens, -t.halfWidth, t.halfWidth);
        lastX = e.clientX;
      }
    });
    const end = (e) => {
      if (e.pointerId === dragId) dragId = null;
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    const key = (e, down) => {
      const k = e.key.toLowerCase();
      const dir = k === 'arrowleft' || k === 'a' ? -1 : k === 'arrowright' || k === 'd' ? 1 : 0;
      if (!dir) return;
      if (down) this.keys.add(dir);
      else this.keys.delete(dir);
      this.keyDir = (this.keys.has(1) ? 1 : 0) - (this.keys.has(-1) ? 1 : 0);
      e.preventDefault();
    };
    window.addEventListener('keydown', (e) => key(e, true));
    window.addEventListener('keyup', (e) => key(e, false));
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.keyDir = 0;
    });
    window.addEventListener('resize', () => this.resize());
    window.visualViewport?.addEventListener('resize', () => this.resize());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && !this.noAutoPause && this.pause()) this.hooks.autoPause?.();
      this.last = performance.now();
    });
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.baseFov = this.camera.aspect < 1 ? 70 : 60;
    const need = (this.t.trackWidth / 2 + 0.9) / (Math.tan(THREE.MathUtils.degToRad(this.baseFov) / 2) * this.camera.aspect);
    this.camD = clamp(need, 6.4, 13.5);
    this.camH = 2.2 + this.camD * 0.3;
    this.visibleHalf = Math.tan(THREE.MathUtils.degToRad(this.baseFov) / 2) * this.camera.aspect * this.camD;
    this.camera.updateProjectionMatrix();
  }

  // ── loop ──────────────────────────────────────────────────────────────────
  frame(now) {
    requestAnimationFrame(this.frame);
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt <= 0) return;
    this.adapt(dt);
    if (dt > 0.05) dt = 0.05;
    if (this.mode !== 'paused') this.update(dt * this.timeScale, dt);
    this.renderer.render(this.scene, this.camera);
    if (this.snapRequested) {
      this.snapRequested = false;
      this.takeSnapshot();
    }
  }

  /** Test hook: advance the simulation by `seconds` at a fixed step, then draw one frame. */
  simulate(seconds, step = 1 / 60) {
    for (let t = 0; t < seconds && this.mode !== 'paused'; t += step) this.update(step * this.timeScale, step);
    this.renderer.render(this.scene, this.camera);
    this.last = performance.now();
  }

  /** Drop resolution on devices that can't hold frame rate. */
  adapt(dt) {
    if (dt > 0.25) return;
    this.perfEma += (dt - this.perfEma) * 0.05;
    this.perfClock += dt;
    if (this.perfClock < 2) return;
    this.perfClock = 0;
    if (this.perfEma > 1 / 42 && this.dpr > 0.75) {
      this.dpr = Math.max(0.75, this.dpr - 0.25);
      this.resize();
      this.perfEma = 1 / 60;
    }
  }

  takeSnapshot() {
    const src = this.renderer.domElement;
    const sc = Math.min(1, 1080 / Math.max(src.width, src.height));
    this.snapCanvas.width = Math.round(src.width * sc);
    this.snapCanvas.height = Math.round(src.height * sc);
    this.snapCanvas.getContext('2d').drawImage(src, 0, 0, this.snapCanvas.width, this.snapCanvas.height);
    this.hasSnap = true;
  }

  update(dt, rawDt) {
    const t = this.t;
    const playing = this.mode === 'playing';
    const attract = this.mode === 'attract';
    const dying = this.mode === 'dying';
    this.time += dt;
    if (this.timeScale < 1 && !dying) this.timeScale = Math.min(1, this.timeScale + rawDt * 1.6);

    // speed & distance
    const rd = this.dist - this.runStart;
    let target = attract ? 15 : this.spawner.speedAt(rd);
    if (this.fizzT > 0) target *= t.fizzSpeed;
    if (dying) target = 0;
    this.speed += (target - this.speed) * Math.min(1, dt * (dying ? 4 : 2.5));
    const moved = this.speed * dt;
    this.dist += moved;
    if (playing) this.score += moved;
    this.spawner.fill(this.dist + AHEAD, this.dist - 40, this.ents);

    // steering
    const auto = attract || (playing && this.bot);
    if (auto) this.targetX = this.spawner.guideX(this.dist + 2);
    else if (playing) this.targetX = clamp(this.targetX + this.keyDir * 11 * dt, -t.halfWidth, t.halfWidth);
    const prevX = this.px;
    if (!dying) this.px += (this.targetX - this.px) * (1 - Math.exp(-dt * (auto ? 12 : 24)));
    this.vx = lerp(this.vx, (this.px - prevX) / Math.max(dt, 1e-4), Math.min(1, dt * 14));

    // timers
    if (this.comboT > 0) {
      this.comboT -= dt;
      if (this.comboT <= 0) {
        this.combo = 0;
        this.mult = 1;
      }
    }
    if (this.invuln > 0) this.invuln -= dt;
    if (this.fizzT > 0) {
      this.fizzT -= dt;
      if (this.fizzT <= 0) {
        this.invuln = 1.3;
        this.hooks.sfx?.('fizzEnd');
      }
    }

    // gates
    if (this.dist >= this.nextGate) {
      this.nextGate += t.zoneLength;
      if (playing) {
        this.zone++;
        this.score += t.gatePoints * this.zone;
        this.addFizz(t.fizzPerGate);
        this.fovKick = 5;
        this.hooks.popup?.('zone', this.zone);
        this.hooks.sfx?.('gate');
        this.hooks.event?.('zone', { zone: this.zone });
      }
    }

    this.updateEntities(dt, moved, playing, attract);
    this.updateHero(dt, playing, attract, dying);
    this.updateCamera(dt, rawDt, attract);

    const fz = this.fizzT > 0 ? Math.min(1, this.fizzT * 2, (t.fizzDuration - this.fizzT) * 4) : 0;
    this.fizzVis = fz;
    curve.value.x = Math.sin(this.dist * 0.0041) * 0.001 + Math.sin(this.dist * 0.0019 + 1.3) * 0.0007;
    curve.value.y = 0.0011 + Math.sin(this.dist * 0.0027) * 0.0003;
    this.world.update(this.dist, this.dist - this.nextGate, this.camera, fz, this.time);
    this.fx.update(dt, this.speed);
    this.fx.uniforms.uScale.value = this.renderer.domElement.height / (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2));

    if (dying) {
      this.dieT += rawDt;
      this.timeScale = this.dieT < 0.35 ? 0.3 : 1;
      if (!this.snapped && this.dieT > 0.2) {
        this.snapped = true;
        this.snapRequested = true; // frame used on the share card
      }
      if (this.dieT > 1.25) this.finish();
    }

    // HUD
    const hs = this.hudState;
    hs.playing = playing;
    hs.score = Math.floor(this.score);
    hs.mult = this.mult;
    hs.combo = this.combo;
    hs.comboFrac = this.comboT > 0 ? this.comboT / t.comboWindow : 0;
    hs.fizzActive = this.fizzT > 0;
    hs.fizz = this.fizzT > 0 ? this.fizzT / t.fizzDuration : this.fizz;
    hs.shield = this.hasShield;
    hs.zone = this.zone;
    this.hooks.hud?.(hs);
  }

  // ── entities ──────────────────────────────────────────────────────────────
  updateEntities(dt, moved, playing, attract) {
    const { ents, meshes, time, px, t } = this;
    const live = playing || attract;
    const fizzing = this.fizzT > 0;
    const o = this._o;
    const n = { slice: meshes.slice.map(() => 0) };
    for (const k of DRAWN) n[k] = 0;

    const put = (mesh, i, x, y, z, ry, sx, sy, sz, rz = 0, rx = 0) => {
      if (i >= mesh.instanceMatrix.count) return;
      o.position.set(x, y, z);
      o.rotation.set(rx, ry, rz);
      o.scale.set(sx, sy, sz);
      o.updateMatrix();
      mesh.setMatrixAt(i, o.matrix);
    };
    const shadow = (x, z, w, d = w) => put(meshes.blob, n.blob++, x, 0.03, z, 0, w, 1, d);
    const glow = (x, y, z, size, color) => {
      if (n.glow >= meshes.glow.instanceMatrix.count) return;
      meshes.glow.setColorAt(n.glow, color);
      put(meshes.glow, n.glow++, x, y, z - 0.12, 0, size, size, 1);
    };

    for (let i = ents.length - 1; i >= 0; i--) {
      const e = ents[i];
      let z = this.dist - e.s;
      let step = moved;
      if (e.k === 'barrel' && z < 0) {
        // rolls towards the player: further away than its row until the moment you reach it
        z *= 1 + e.roll;
        step *= 1 + e.roll;
      }
      if (z > 16 || e.got) {
        ents[i] = ents[ents.length - 1];
        ents.pop();
        continue;
      }
      const hazard = HAZARDS.has(e.k);

      // ── behaviour ──
      let x = e.x;
      if (e.mv) x = clamp(e.mv.c + Math.sin(time * e.mv.w + e.mv.ph) * e.mv.amp, e.mv.min, e.mv.max);
      if (e.k === 'wasp' && z > -48 && z < 0.5) {
        // drift towards the player, fenced one lane away from the safe line
        const want = e.side > 0 ? Math.max(px, e.gx + 1.25) : Math.min(px, e.gx - 1.25);
        const dxw = clamp(want, -t.halfWidth, t.halfWidth) - e.x;
        e.x += clamp(dxw, -2.4 * dt, 2.4 * dt);
        x = e.x;
      }
      if (e.k === 'jelly') e.y = 0.42 + (Math.sin(time * e.w + e.ph) * 0.5 + 0.5) * 2.3;
      if (e.k === 'zap') {
        const cyc = (time + e.ph) % ZAP_PERIOD;
        e.on = cyc < 1.0;
        e.warn = cyc > 1.32; // flickers just before it fires
      }
      if (e.k === 'mill') e.a = time * e.w + e.ph;

      // magnet while the power mode is active
      if (fizzing && !hazard && z > -11 && z < 0.5 && Math.abs(x - px) < 3.4) {
        e.x += (px - e.x) * Math.min(1, dt * 9);
        x = e.x;
      }

      // ── contact ──
      const win = e.k === 'mill' ? 1.75 : ZR;
      if (live && !e.passed) {
        const dx = Math.abs(x - px);
        if (z > -win && z - step <= win) {
          if (e.k === 'slice') {
            if (dx < 0.82) this.collectSlice(e, x, attract);
          } else if (e.k === 'token') {
            if (dx < 0.95) this.collectToken(e, x, attract);
          } else if (e.k === 'shield') {
            if (dx < 0.95) this.collectShield(e, x, attract);
          } else if (!attract && this.touches(e, x, z, dx, step)) {
            this.hitHazard(e, x);
          }
        }
        if (z > win) {
          e.passed = true;
          if (playing && hazard && !e.got && !fizzing && this.invuln <= 0 && this.grazes(e, dx)) this.nearMiss();
        }
      }
      if (e.got) continue;

      // ── draw ──
      if (e.k === 'slice') {
        const sc = 1.15 + Math.sin(time * 4 + e.s) * 0.07;
        const y = 0.78 + Math.sin(time * 3 + e.s * 0.6) * 0.08;
        put(meshes.slice[e.v], n.slice[e.v]++, x, y, z, Math.sin(time * 2.6 + e.s * 0.35) * 0.95, sc, sc, sc);
        if (z > -70) glow(x, y, z, 1.9, this.glowColors.slice[e.v]);
      } else if (e.k === 'token') {
        const y = 0.95 + Math.sin(time * 3 + e.s) * 0.12;
        put(meshes.token, n.token++, x, y, z, time * 2.4, 1.15, 1.15, 1.15);
        glow(x, y, z, 3.4 + Math.sin(time * 6) * 0.4, this.glowColors.token);
        shadow(x, z, 1.3);
      } else if (e.k === 'shield') {
        const sc = 1 + Math.sin(time * 5) * 0.1;
        put(meshes.shield, n.shield++, x, 0.85, z, 0, sc, sc, sc);
        glow(x, 0.85, z, 1.7, this.glowColors.accent);
        shadow(x, z, 1.3);
      } else if (e.k === 'spike') {
        const sc = 1 + Math.sin(time * 5 + e.s) * 0.05;
        put(meshes.spike, n.spike++, x, 0, z, e.s, sc, sc, sc);
        shadow(x, z, 1.9);
      } else if (e.k === 'barrier') {
        put(meshes.barrier, n.barrier++, x, 0, z, 0, e.hw * 2, 1, 1);
        shadow(x, z, e.hw * 2 + 1, 1.5);
      } else if (e.k === 'crab') {
        const scuttle = time * 14 + e.s;
        put(meshes.crab, n.crab++, x, Math.abs(Math.sin(scuttle)) * 0.07, z, 0, 1.25, 1.25, 1.25, Math.sin(scuttle) * 0.09);
        shadow(x, z, 2.3, 1.6);
      } else if (e.k === 'barrel') {
        put(meshes.barrel, n.barrel++, x, 0.5, z, 0, 1.08, 1.08, 1.08, 0, z / 0.5);
        shadow(x, z, 2, 1.6);
      } else if (e.k === 'jelly') {
        const sq = Math.cos(time * e.w + e.ph) * 0.14;
        put(meshes.jelly, n.jelly++, x, e.y, z, Math.sin(time * 1.3 + e.ph) * 0.4, 1.15 - sq * 0.5, 1.15 + sq, 1.15 - sq * 0.5);
        const sh = 1.9 - e.y * 0.35;
        shadow(x, z, sh);
      } else if (e.k === 'zap') {
        for (const sx of [-1, 1]) {
          put(meshes.zapPost, n.zapPost++, x + sx * e.hw, 0, z, time * 2 * sx, 1, 1, 1);
          shadow(x + sx * e.hw, z, 1.1);
        }
        const flick = e.on ? 1 + Math.sin(time * 40) * 0.18 : e.warn ? (Math.sin(time * 60) > 0 ? 0.55 : 0.1) : 0.12;
        put(meshes.zapBeam, n.zapBeam++, x, 0.82 * (1 - flick), z, 0, e.hw * 2, flick, flick);
        if (e.on) {
          glow(x - e.hw, 0.82, z, 2.2, this.glowColors.hazard);
          glow(x + e.hw, 0.82, z, 2.2, this.glowColors.hazard);
        }
      } else if (e.k === 'mill') {
        put(meshes.mill, n.mill++, x, 0, z, -e.a, 1, 1, 1);
        shadow(x, z, 1.4);
      } else if (e.k === 'wasp') {
        const y = 0.95 + Math.sin(time * 6 + e.s) * 0.12;
        put(meshes.wasp, n.wasp++, x, y, z, clamp((px - x) * 0.25, -0.6, 0.6), 1.3, 1.3, 1.3, Math.sin(time * 9 + e.s) * 0.12);
        shadow(x, z, 1.5);
      }
    }

    meshes.slice.forEach((m, i) => {
      m.count = n.slice[i];
      m.instanceMatrix.needsUpdate = true;
    });
    for (const k of DRAWN) {
      meshes[k].count = n[k];
      meshes[k].instanceMatrix.needsUpdate = true;
    }
    if (meshes.glow.instanceColor) meshes.glow.instanceColor.needsUpdate = true;
  }

  /** Does this enemy touch the player right now? (x, z = enemy position; dx = lateral gap) */
  touches(e, x, z, dx, step) {
    switch (e.k) {
      case 'spike':
        return dx < 0.72;
      case 'crab':
        return dx < 0.8;
      case 'barrel':
        return dx < 0.78;
      case 'wasp':
        return dx < 0.68;
      case 'barrier':
        return dx < e.hw + 0.3;
      case 'jelly':
        return e.y < 1.3 && dx < 0.7; // high enough → you pass underneath
      case 'zap':
        return e.on && dx < e.hw + 0.3;
      case 'mill': {
        // distance from the player to the spinning arm, sampled along this frame's travel
        const ux = Math.cos(e.a);
        const uz = Math.sin(e.a);
        for (let k = 0; k <= 2; k++) {
          const rz = -(z - (step * k) / 2);
          const rx = this.px - x;
          const along = clamp(rx * ux + rz * uz, -1.3, 1.3);
          if (Math.hypot(rx - along * ux, rz - along * uz) < 0.66) return true;
        }
        return false;
      }
      default:
        return false;
    }
  }

  /** Close shave that earns the near-miss bonus. */
  grazes(e, dx) {
    switch (e.k) {
      case 'barrier':
        return dx < e.hw + 0.72;
      case 'zap':
        return dx < e.hw + (e.on ? 0.72 : 0.3); // through a beam that just switched off
      case 'jelly':
        return dx < (e.y < 1.3 ? 1.15 : 0.7); // beside it, or right underneath
      case 'mill':
        return dx < 1.9;
      default:
        return dx < 1.15;
    }
  }

  addFizz(v) {
    if (this.fizzT > 0) return;
    this.fizz = Math.min(1, this.fizz + v);
    if (this.fizz >= 1) {
      this.fizz = 0;
      this.fizzT = this.t.fizzDuration;
      this.stats.fizzes++;
      this.fovKick = 10;
      this.shake = Math.max(this.shake, 0.25);
      this.fx.burst(this.px, 0.8, 0, this.colors.secondary, 40, 9, 0.3, 0.9);
      this.hooks.popup?.('power');
      this.hooks.sfx?.('fizz');
      this.hooks.event?.('power', {});
    }
  }

  points(base) {
    const p = Math.round(base * this.mult * (this.fizzT > 0 ? this.t.fizzScore : 1));
    this.score += p;
    return p;
  }

  collectSlice(e, x, attract) {
    e.got = true;
    this.squash = 1;
    this.fx.burst(x, 0.8, 0, this.colors.slice[e.v], attract ? 4 : 7, 4.5, 0.2, 0.45);
    if (attract) return;
    const t = this.t;
    this.combo++;
    this.comboT = t.comboWindow;
    this.stats.slices++;
    this.stats.bestCombo = Math.max(this.stats.bestCombo, this.combo);
    const mult = Math.min(t.maxMult, 1 + Math.floor(this.combo / t.comboPerMult));
    if (mult !== this.mult) {
      this.mult = mult;
      this.hooks.popup?.('mult', mult);
      this.hooks.sfx?.('mult', { rate: 1 + (mult - 2) * 0.12 });
    }
    this.points(t.slicePoints);
    this.addFizz(t.fizzPerSlice);
    const step = PICK_SCALE[Math.min(PICK_SCALE.length - 1, Math.floor(this.combo / 3))];
    this.hooks.sfx?.('pick', { rate: Math.pow(2, step / 12), gain: 0.7 });
  }

  collectToken(e, x, attract) {
    e.got = true;
    this.fx.burst(x, 1, 0, this.colors.token, 22, 7, 0.28, 0.7);
    if (attract) return;
    this.stats.tokens++;
    this.comboT = this.t.comboWindow;
    const p = this.points(this.t.tokenPoints);
    this.addFizz(this.t.fizzPerToken);
    this.hooks.popup?.('points', p);
    this.hooks.sfx?.('token');
  }

  collectShield(e, x, attract) {
    e.got = true;
    this.fx.burst(x, 0.9, 0, this.colors.accent, 16, 6, 0.26, 0.6);
    if (attract) return;
    if (this.hasShield) this.points(this.t.tokenPoints);
    this.hasShield = true;
    this.hero.shield.visible = true;
    this.hooks.popup?.('shield');
    this.hooks.sfx?.('shield');
  }

  nearMiss() {
    this.stats.nearMisses++;
    const p = this.points(this.t.nearMissPoints);
    this.addFizz(this.t.fizzPerNearMiss);
    this.hooks.popup?.('near', p);
    this.hooks.sfx?.('near');
  }

  hitHazard(e, x) {
    if (this.fizzT > 0) {
      e.got = true;
      this.stats.smashes++;
      this.points(this.t.smashPoints);
      this.fx.burst(x, 0.6, 0, this.colors.hazard, 18, 9, 0.3, 0.6);
      this.fx.burst(x, 0.6, 0, this.colors.hazardBody, 10, 7, 0.34, 0.6);
      this.shake = Math.max(this.shake, 0.3);
      this.hooks.sfx?.('smash');
      return;
    }
    if (this.invuln > 0) return;
    if (this.hasShield) {
      e.got = true;
      this.hasShield = false;
      this.hero.shield.visible = false;
      this.invuln = 1.3;
      this.shake = 0.45;
      this.fx.burst(this.px, 0.7, 0, this.colors.accent, 30, 9, 0.3, 0.7);
      this.hooks.popup?.('saved');
      this.hooks.sfx?.('shieldBreak');
      return;
    }
    this.crash(x);
  }

  crash(x) {
    this.mode = 'dying';
    this.dieT = 0;
    this.shake = 1;
    this.heroVel = { x: (this.px - x) * 5 + this.vx * 0.3, y: 9, spin: (Math.random() - 0.5) * 16 };
    this.fx.burst(this.px, 0.7, 0, this.colors.primary, 34, 10, 0.34, 0.9);
    this.fx.burst(this.px, 0.7, 0, this.colors.hazard, 20, 8, 0.3, 0.8);
    this.fx.burst(this.px, 0.7, 0, '#ffffff', 16, 12, 0.2, 0.6);
    this.hero.shield.visible = false;
    this.hero.blob.visible = false;
    this.snapped = false;
    this.hooks.sfx?.('crash');
    try {
      if (navigator.userActivation?.hasBeenActive) navigator.vibrate?.(120);
    } catch {
      /* not supported */
    }
  }

  finish() {
    const rd = this.dist - this.runStart;
    const result = {
      score: Math.floor(this.score),
      distance: Math.round(rd),
      zone: this.zone,
      duration: Math.round(this.time - this.stats.t0),
      ...this.stats,
    };
    delete result.t0;
    this.toAttract();
    this.px = this.targetX = 0;
    this.hooks.event?.('over', result);
    this.hooks.over?.(result);
  }

  // ── hero & camera ─────────────────────────────────────────────────────────
  updateHero(dt, playing, attract, dying) {
    const h = this.hero;
    const fx = this.fx;
    if (dying) {
      const v = this.heroVel;
      v.y -= 22 * dt;
      h.group.position.x += v.x * dt;
      h.group.position.y = Math.max(-3, h.group.position.y + v.y * dt);
      h.group.position.z += this.speed * dt * 0.4;
      h.group.rotation.x += v.spin * dt;
      h.group.rotation.z += v.spin * 0.6 * dt;
      return;
    }
    h.group.position.set(this.px, 0, 0);
    h.group.scale.setScalar(1.18);
    h.tilt.rotation.z = clamp(-this.vx * 0.05, -0.55, 0.55);
    h.tilt.rotation.y = clamp(-this.vx * 0.035, -0.4, 0.4);
    h.tilt.position.y = Math.sin(this.time * 5) * 0.035 + 0.03;
    this.squash = Math.max(0, this.squash - dt * 7);
    const sq = this.squash * 0.12;
    h.product.scale.set(1 + sq, 1 - sq, 1 + sq);
    h.group.visible = !(this.invuln > 0 && this.fizzT <= 0 && Math.floor(this.time * 16) % 2 === 0);
    if (h.shield.visible) {
      const s = 1 + Math.sin(this.time * 6) * 0.04;
      h.shield.scale.set(s, s, s);
    }

    // wake
    const fizzing = this.fizzT > 0;
    this.trailAcc += dt * this.speed * (fizzing ? 1.6 : 0.5);
    while (this.trailAcc > 1) {
      this.trailAcc -= 1;
      const side = Math.random() < 0.5 ? -1 : 1;
      const color = fizzing ? (Math.random() < 0.5 ? this.colors.secondary : this.colors.primary) : Math.random() < 0.7 ? '#ffffff' : this.colors.accent;
      fx.emit(this.px + side * (0.2 + Math.random() * 0.2), 0.12, 1 + Math.random() * 0.3,
        side * Math.random() * 0.8, 0.6 + Math.random() * 1.6, -this.speed * 0.55, color,
        0.1 + Math.random() * (fizzing ? 0.22 : 0.14), 0.45 + Math.random() * 0.3, -2, 1);
    }
    if (fizzing) {
      // speed streaks
      for (let i = 0; i < 2; i++) {
        const sx = (Math.random() < 0.5 ? -1 : 1) * (3.6 + Math.random() * 5);
        fx.emit(sx, 0.4 + Math.random() * 4.5, -60 - Math.random() * 20, 0, 0, 40, Math.random() < 0.5 ? '#ffffff' : this.colors.secondary, 0.16, 1.1, 0, 0);
      }
    }
  }

  updateCamera(dt, rawDt, attract) {
    const cam = this.camera;
    const t = this.t;
    const speedFrac = clamp((this.speed - t.speedStart) / (t.speedMax * t.fizzSpeed - t.speedStart), 0, 1);
    this.fovKick = Math.max(0, this.fovKick - rawDt * 12);
    const fovTarget = this.baseFov + speedFrac * 7 + (this.fizzVis || 0) * 6 + this.fovKick;
    cam.fov += (fovTarget - cam.fov) * Math.min(1, rawDt * 6);
    // on the menu the picture is shifted up so the hero sits clear of the buttons
    const shiftTarget = attract ? (cam.aspect < 1 ? 0.17 : 0.07) : 0;
    this.viewShift = lerp(this.viewShift ?? shiftTarget, shiftTarget, Math.min(1, rawDt * 3));
    const vw = this.renderer.domElement.width;
    const vh = this.renderer.domElement.height;
    cam.setViewOffset(vw, vh, 0, this.viewShift * vh, vw, vh); // also updates the projection

    this.shake = Math.max(0, this.shake - rawDt * 2.6);
    const sh = this.reducedMotion ? 0 : this.shake * this.shake * 0.5;
    const orbit = attract ? Math.sin(this.time * 0.28) : 0;
    this.camOrbit = lerp(this.camOrbit ?? orbit, orbit, Math.min(1, rawDt * 2));
    const camX = this.px * 0.55 + this.camOrbit * 2.4;
    cam.position.set(
      camX + (Math.random() - 0.5) * sh,
      this.camH - (attract ? 0.5 : 0) + (Math.random() - 0.5) * sh,
      this.camD,
    );
    this._v.set(this.px * 0.65, 0.9, -(5 + this.camD * 0.75));
    cam.lookAt(this._v);
    cam.rotateZ(clamp(-this.vx * 0.005, -0.06, 0.06) + curve.value.x * 26);
  }

  /** Hero position in CSS pixels (for floating score text). */
  heroScreen() {
    this._v.set(this.px, 1.6, 0).project(this.camera);
    return { x: (this._v.x * 0.5 + 0.5) * window.innerWidth, y: (-this._v.y * 0.5 + 0.5) * window.innerHeight };
  }
}
