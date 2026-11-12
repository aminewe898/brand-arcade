// One pooled GPU point system for every burst, bubble and spark (a single draw call).
import * as THREE from 'three';
import { curve } from './bend.js';

export class Particles {
  constructor(max = 700) {
    this.max = max;
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.size = new Float32Array(max);
    this.alpha = new Float32Array(max);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.size0 = new Float32Array(max);
    this.grav = new Float32Array(max);
    this.drag = new Float32Array(max);
    this.next = 0;

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1));
    for (const k of ['position', 'aColor', 'aSize', 'aAlpha']) g.attributes[k].setUsage(THREE.DynamicDrawUsage);
    this.uniforms = { uCurve: curve, uScale: { value: 600 } };
    const m = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      vertexShader: /* glsl */ `
        attribute vec3 aColor; attribute float aSize; attribute float aAlpha;
        uniform vec2 uCurve; uniform float uScale;
        varying vec3 vColor; varying float vAlpha;
        void main() {
          vColor = aColor; vAlpha = aAlpha;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          float bz = mvPosition.z * mvPosition.z;
          mvPosition.x += uCurve.x * bz; mvPosition.y -= uCurve.y * bz;
          gl_Position = projectionMatrix * mvPosition;
          gl_PointSize = aSize * uScale / max(0.5, -mvPosition.z);
        }`,
      fragmentShader: /* glsl */ `
        varying vec3 vColor; varying float vAlpha;
        void main() {
          vec2 p = gl_PointCoord - 0.5;
          float d = length(p);
          if (d > 0.5) discard;
          float a = smoothstep(0.5, 0.4, d);
          float hi = smoothstep(0.2, 0.0, length(p + vec2(0.14, 0.14)));
          vec3 c = mix(vColor, vec3(1.0), hi * 0.65);
          gl_FragColor = vec4(c, a * vAlpha);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    this.points = new THREE.Points(g, m);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    this._c = new THREE.Color();
  }

  emit(x, y, z, vx, vy, vz, color, size, life, grav = 0, drag = 0) {
    const i = this.next;
    this.next = (i + 1) % this.max;
    this.pos[i * 3] = x;
    this.pos[i * 3 + 1] = y;
    this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx;
    this.vel[i * 3 + 1] = vy;
    this.vel[i * 3 + 2] = vz;
    this._c.set(color);
    this._c.toArray(this.col, i * 3);
    this.size0[i] = size;
    this.life[i] = this.maxLife[i] = life;
    this.grav[i] = grav;
    this.drag[i] = drag;
  }

  burst(x, y, z, color, count, speed, size = 0.2, life = 0.6) {
    for (let n = 0; n < count; n++) {
      const a = Math.random() * Math.PI * 2;
      const u = Math.random() * 2 - 1;
      const r = Math.sqrt(1 - u * u);
      const sp = speed * (0.4 + Math.random() * 0.6);
      this.emit(x, y, z, Math.cos(a) * r * sp, Math.abs(u) * sp + speed * 0.3, Math.sin(a) * r * sp, color,
        size * (0.6 + Math.random() * 0.8), life * (0.6 + Math.random() * 0.6), 9, 1.5);
    }
  }

  update(dt, worldSpeed) {
    const { pos, vel, life, maxLife, size, size0, alpha, grav, drag } = this;
    for (let i = 0; i < this.max; i++) {
      if (life[i] <= 0) continue;
      life[i] -= dt;
      if (life[i] <= 0) {
        size[i] = 0;
        alpha[i] = 0;
        continue;
      }
      const k = Math.max(0, 1 - drag[i] * dt);
      vel[i * 3] *= k;
      vel[i * 3 + 1] = vel[i * 3 + 1] * k - grav[i] * dt;
      vel[i * 3 + 2] *= k;
      pos[i * 3] += vel[i * 3] * dt;
      pos[i * 3 + 1] += vel[i * 3 + 1] * dt;
      pos[i * 3 + 2] += (vel[i * 3 + 2] + worldSpeed) * dt;
      const t = life[i] / maxLife[i];
      size[i] = size0[i] * (0.35 + 0.65 * Math.min(1, t * 2.2));
      alpha[i] = Math.min(1, t * 3);
    }
    const a = this.points.geometry.attributes;
    a.position.needsUpdate = a.aColor.needsUpdate = a.aSize.needsUpdate = a.aAlpha.needsUpdate = true;
  }

  clear() {
    this.life.fill(0);
    this.size.fill(0);
    this.alpha.fill(0);
  }
}
