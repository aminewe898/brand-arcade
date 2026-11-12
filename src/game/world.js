// Environment: sky dome, sun, clouds, sea, track, rails, lamps, sea stacks, gate.
import * as THREE from 'three';
import { bend } from './bend.js';
import * as T from './textures.js';
import { stackMesh, lampMeshes, buildGate, balloonMesh, glowMesh } from './models.js';

const TRACK_LEN = 220;
const TRACK_NEAR = 26; // metres of track behind the player
const LAMP_GAP = 16;
const STACK_GAP = 26;
export const SEA_Y = -17;

export class World {
  constructor(scene, renderer, brand, tune) {
    this.brand = brand;
    const w = brand.world;
    this.sunDir = new THREE.Vector3(0.22, 0.2, -1).normalize();

    // ── sky ──
    this.skyUniforms = {
      uTop: { value: new THREE.Color(w.skyTop) },
      uMid: { value: new THREE.Color(w.skyMid) },
      uHorizon: { value: new THREE.Color(w.horizon) },
      uSun: { value: new THREE.Color(w.sun) },
      uSunDir: { value: this.sunDir },
      uBoost: { value: 0 },
    };
    const skyMat = new THREE.ShaderMaterial({
      uniforms: this.skyUniforms,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uTop; uniform vec3 uMid; uniform vec3 uHorizon; uniform vec3 uSun; uniform vec3 uSunDir; uniform float uBoost;
        varying vec3 vDir;
        void main() {
          vec3 d = normalize(vDir);
          float h = max(d.y, 0.0);
          vec3 c = mix(uHorizon, uMid, smoothstep(0.0, 0.3, h));
          c = mix(c, uTop, smoothstep(0.18, 0.75, h));
          float s = max(dot(d, uSunDir), 0.0);
          c += uSun * (pow(s, 6.0) * 0.35 + pow(s, 40.0) * 0.5);
          c = mix(c, uSun, smoothstep(0.9968, 0.9976, s));
          c += uHorizon * uBoost * (1.0 - smoothstep(0.0, 0.5, h)) * 0.35;
          gl_FragColor = vec4(c, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    this.sky = new THREE.Group();
    const dome = new THREE.Mesh(new THREE.SphereGeometry(450, 32, 20), skyMat);
    dome.renderOrder = -10;
    dome.frustumCulled = false;
    this.sky.add(dome);

    // image-based lighting from the sky itself → product reflections match the brand palette
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envScene = new THREE.Scene();
    envScene.add(new THREE.Mesh(new THREE.SphereGeometry(50, 32, 20), skyMat));
    scene.environment = pmrem.fromScene(envScene, 0.035).texture;
    scene.environmentIntensity = 0.9;
    pmrem.dispose();

    // clouds
    const cloudTex = T.cloudTexture();
    const rnd = seeded(7);
    for (let i = 0; i < 11; i++) {
      const mat = new THREE.MeshBasicMaterial({
        map: cloudTex, color: w.cloud, transparent: true, opacity: 0.55 + rnd() * 0.35, depthWrite: false, fog: false,
      });
      const a = -Math.PI / 2 + (rnd() - 0.5) * 2.6;
      const el = 0.1 + rnd() * 0.32;
      const r = 400;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
      m.position.set(Math.cos(a) * Math.cos(el) * r, Math.sin(el) * r, Math.sin(a) * Math.cos(el) * r);
      const sc = 90 + rnd() * 110;
      m.scale.set(sc, sc * 0.45, 1);
      m.lookAt(0, 0, 0);
      m.renderOrder = -9;
      this.sky.add(m);
    }
    if (w.stars) {
      const n = 500;
      const p = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const a = rnd() * Math.PI * 2;
        const y = 0.12 + rnd() * 0.88;
        const r = Math.sqrt(1 - y * y);
        p.set([Math.cos(a) * r * 420, y * 420, Math.sin(a) * r * 420], i * 3);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(p, 3));
      const stars = new THREE.Points(g, new THREE.PointsMaterial({ color: '#ffffff', size: 2.2, sizeAttenuation: false, fog: false, depthWrite: false, transparent: true, opacity: 0.85 }));
      stars.renderOrder = -9;
      this.sky.add(stars);
    }
    scene.add(this.sky);

    // ── lights ──
    scene.fog = new THREE.Fog(w.horizon, 70, 270);
    this.hemi = new THREE.HemisphereLight(w.lightSky, w.lightGround, 1.35);
    scene.add(this.hemi);
    const sun = new THREE.DirectionalLight(w.sunLight, 2.2);
    sun.position.copy(this.sunDir).multiplyScalar(50);
    scene.add(sun);
    const key = new THREE.DirectionalLight('#ffffff', 1.5);
    key.position.set(-3, 8, 10);
    scene.add(key);

    // ── sea ──
    this.seaTex = T.seaTexture(brand);
    this.seaTex.repeat.set(48, 15);
    const sea = new THREE.Mesh(
      new THREE.PlaneGeometry(1400, 440, 70, 44), // dense grid: the bend is per-vertex, big quads would bulge
      bend(new THREE.MeshStandardMaterial({ map: this.seaTex, roughness: 0.28, metalness: 0.35 })),
    );
    sea.rotation.x = -Math.PI / 2;
    sea.position.set(0, SEA_Y, -150);
    sea.frustumCulled = false;
    scene.add(sea);

    // ── track ──
    const W = tune.trackWidth;
    this.trackTex = T.trackTexture(brand);
    this.trackTex.repeat.set(1, TRACK_LEN / 8);
    this.trackMat = bend(new THREE.MeshStandardMaterial({ map: this.trackTex, roughness: 0.6, metalness: 0.0, emissive: w.rail, emissiveIntensity: 0 }));
    const track = new THREE.Mesh(new THREE.PlaneGeometry(W, TRACK_LEN, 1, 110), this.trackMat);
    track.rotation.x = -Math.PI / 2;
    track.position.z = TRACK_NEAR - TRACK_LEN / 2;
    track.frustumCulled = false;
    scene.add(track);

    const skirt = new THREE.Mesh(
      new THREE.BoxGeometry(W + 0.5, 0.7, TRACK_LEN, 1, 1, 110),
      bend(new THREE.MeshStandardMaterial({ color: T.shade(w.track, -0.3), roughness: 0.8 })),
    );
    skirt.position.set(0, -0.37, TRACK_NEAR - TRACK_LEN / 2);
    skirt.frustumCulled = false;
    scene.add(skirt);

    this.railMat = bend(new THREE.MeshStandardMaterial({ color: w.rail, emissive: w.rail, emissiveIntensity: 0.9, roughness: 0.4 }));
    const railGeo = new THREE.BoxGeometry(0.2, 0.26, TRACK_LEN, 1, 1, 110);
    for (const sx of [-1, 1]) {
      const rail = new THREE.Mesh(railGeo, this.railMat);
      rail.position.set(sx * (W / 2 + 0.1), 0.1, TRACK_NEAR - TRACK_LEN / 2);
      rail.frustumCulled = false;
      scene.add(rail);
    }

    // ── lamps ──
    this.lampCount = Math.ceil((TRACK_LEN - TRACK_NEAR + 10) / LAMP_GAP);
    this.lamps = lampMeshes(brand, this.lampCount * 2);
    scene.add(this.lamps.posts, this.lamps.bulbs);
    this.lampX = W / 2 + 0.1;

    // ── sea stacks ──
    this.stackCount = 16;
    this.stacks = stackMesh(brand, this.stackCount);
    this.stackData = [];
    const r2 = seeded(21);
    for (let i = 0; i < this.stackCount; i++) {
      this.stackData.push({
        side: i % 2 ? 1 : -1,
        x: 13 + r2() * 30,
        y: -5.5 + r2() * 7,
        rot: r2() * 6.28,
        sc: 0.8 + r2() * 0.9,
        off: r2() * 10,
      });
    }
    scene.add(this.stacks);

    // ── gate ──
    this.gate = buildGate(brand);
    scene.add(this.gate);

    // ── distant mountains (two hazy layers on the sky dome) ──
    const ridge = (radius, base, hMin, hMax, seed, tint) => {
      const N = 80;
      const rr = seeded(seed);
      const hs = [];
      for (let i = 0; i < N; i++) hs.push(hMin + Math.pow(rr(), 1.7) * (hMax - hMin));
      const top = new THREE.Color(w.horizon).lerp(new THREE.Color(w.skyTop), tint);
      const bot = new THREE.Color(w.horizon);
      const pos = [];
      const col = [];
      const v = (a, y, c) => {
        pos.push(Math.cos(a) * radius, y, Math.sin(a) * radius);
        col.push(c.r, c.g, c.b);
      };
      for (let i = 0; i < N; i++) {
        const a0 = (i / N) * Math.PI * 2;
        const a1 = ((i + 1) / N) * Math.PI * 2;
        const h0 = hs[i];
        const h1 = hs[(i + 1) % N];
        v(a0, base, bot); v(a1, base, bot); v(a1, base + h1, top);
        v(a0, base, bot); v(a1, base + h1, top); v(a0, base + h0, top);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, depthWrite: false, side: THREE.DoubleSide }));
      m.frustumCulled = false;
      m.renderOrder = -8;
      this.sky.add(m);
    };
    ridge(430, -14, 16, 62, 91, 0.22);
    ridge(410, -14, 8, 34, 37, 0.42);

    // ── hot-air balloons ──
    this.balloonCount = 8;
    this.balloons = balloonMesh(brand, this.balloonCount);
    this.balloonData = [];
    const r3 = seeded(55);
    for (let i = 0; i < this.balloonCount; i++) {
      this.balloonData.push({ side: i % 2 ? -1 : 1, x: 10 + r3() * 26, y: 6 + r3() * 13, off: r3() * 30, ph: r3() * 6.28, sc: 0.8 + r3() * 0.7 });
    }
    scene.add(this.balloons);

    // ── lamp halos ──
    this.lampGlow = glowMesh(this.lampCount * 2);
    const railColor = new THREE.Color(w.rail);
    for (let i = 0; i < this.lampCount * 2; i++) this.lampGlow.setColorAt(i, railColor);
    this.lampGlow.count = this.lampCount * 2;
    scene.add(this.lampGlow);

    this._o = new THREE.Object3D();
  }

  /** dist = total metres travelled; gateZ = world z of the next gate (negative = ahead). */
  update(dist, gateZ, camera, fizz, time) {
    this.sky.position.copy(camera.position);
    this.trackTex.offset.y = (dist / 8) % 1;
    this.seaTex.offset.y = (dist / 28) % 1;
    this.seaTex.offset.x = time * 0.004;

    const o = this._o;
    // lamps slide towards the player and wrap
    const lampPhase = dist % LAMP_GAP;
    let n = 0;
    for (let i = 0; i < this.lampCount; i++) {
      const z = TRACK_NEAR - 6 - i * LAMP_GAP + lampPhase;
      for (const sx of [-1, 1]) {
        o.position.set(sx * this.lampX, 0.2, z);
        o.rotation.set(0, 0, 0);
        o.scale.setScalar(1);
        o.updateMatrix();
        this.lamps.posts.setMatrixAt(n, o.matrix);
        o.position.y = 1.85;
        o.scale.setScalar(1 + fizz * 0.5 + Math.sin(time * 6 + i) * 0.06);
        o.updateMatrix();
        this.lamps.bulbs.setMatrixAt(n, o.matrix);
        o.position.z = z - 0.1;
        o.scale.setScalar(1.7 + fizz * 1.2);
        o.updateMatrix();
        this.lampGlow.setMatrixAt(n, o.matrix);
        n++;
      }
    }
    this.lamps.posts.instanceMatrix.needsUpdate = true;
    this.lamps.bulbs.instanceMatrix.needsUpdate = true;

    const span = this.stackCount * STACK_GAP;
    for (let i = 0; i < this.stackCount; i++) {
      const sd = this.stackData[i];
      const z = 40 - ((((i * STACK_GAP + sd.off - dist * 0.9) % span) + span) % span);
      o.position.set(sd.side * sd.x, sd.y, z);
      o.rotation.set(0, sd.rot, 0);
      o.scale.setScalar(sd.sc);
      o.updateMatrix();
      this.stacks.setMatrixAt(i, o.matrix);
    }
    this.stacks.instanceMatrix.needsUpdate = true;
    this.lampGlow.instanceMatrix.needsUpdate = true;

    const bSpan = this.balloonCount * 52;
    for (let i = 0; i < this.balloonCount; i++) {
      const b = this.balloonData[i];
      const z = 34 - ((((i * 52 + b.off - dist * 0.8) % bSpan) + bSpan) % bSpan);
      o.position.set(b.side * b.x, b.y + Math.sin(time * 0.7 + b.ph) * 0.6, z);
      o.rotation.set(Math.sin(time * 0.5 + b.ph) * 0.05, time * 0.15 + b.ph, 0);
      o.scale.setScalar(b.sc);
      o.updateMatrix();
      this.balloons.setMatrixAt(i, o.matrix);
    }
    this.balloons.instanceMatrix.needsUpdate = true;

    this.gate.position.z = gateZ;
    this.gate.visible = gateZ > -190 && gateZ < 30;

    this.railMat.emissiveIntensity = 0.9 + fizz * 1.4 + Math.sin(time * 8) * 0.15 * fizz;
    this.trackMat.emissiveIntensity = fizz * 0.16;
    this.skyUniforms.uBoost.value = fizz;
  }
}

function seeded(seed) {
  let a = seed;
  return () => {
    a = (a * 16807) % 2147483647;
    return (a & 0xffffff) / 0x1000000;
  };
}
