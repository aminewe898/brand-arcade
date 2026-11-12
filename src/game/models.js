// Procedural low-poly models. Everything is built from primitives and coloured
// from the brand config, so there are no model files to license or swap.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { bend } from './bend.js';
import * as T from './textures.js';

const UP = new THREE.Vector3(0, 1, 0);

/** Non-indexed copy with a flat vertex colour (or a gradient along local Y). */
function part(geo, color, colorTop) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const pos = g.attributes.position;
  const a = new Float32Array(pos.count * 3);
  const c0 = new THREE.Color(color);
  const c1 = colorTop ? new THREE.Color(colorTop) : null;
  let minY = Infinity;
  let maxY = -Infinity;
  if (c1) {
    for (let i = 0; i < pos.count; i++) {
      minY = Math.min(minY, pos.getY(i));
      maxY = Math.max(maxY, pos.getY(i));
    }
  }
  const tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    if (c1) tmp.copy(c0).lerp(c1, (pos.getY(i) - minY) / (maxY - minY || 1));
    else tmp.copy(c0);
    tmp.toArray(a, i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}

const merge = (parts) => mergeGeometries(parts, false);

function std(opts) {
  return bend(new THREE.MeshStandardMaterial(opts));
}

// ── Hero ────────────────────────────────────────────────────────────────────
export function buildHero(brand, tagline) {
  const h = brand.hero;
  const group = new THREE.Group(); // moves on the track
  const tilt = new THREE.Group(); // banks / bobs
  group.add(tilt);

  // board
  const boardGeo = new THREE.SphereGeometry(1, 24, 12);
  const board = new THREE.Mesh(boardGeo, std({ color: h.board, roughness: 0.35 }));
  board.scale.set(0.6, 0.075, 1.18);
  board.position.y = 0.1;
  const stripe = new THREE.Mesh(boardGeo, std({ color: h.boardStripe, roughness: 0.35 }));
  stripe.scale.set(0.15, 0.082, 1.185);
  stripe.position.y = 0.1;
  tilt.add(board, stripe);

  const product = new THREE.Group();
  product.position.y = 0.17;
  tilt.add(product);

  const label = T.labelTexture(brand, tagline);
  const labelMat = std({ map: label, roughness: 0.32, metalness: h.type === 'can' ? 0.55 : 0.0 });
  const metalMat = std({ color: h.metal, roughness: 0.25, metalness: h.type === 'can' ? 0.9 : 0.1 });

  if (h.type === 'cup') {
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.25, 0.84, 36, 1, true), labelMat);
    body.position.y = 0.42;
    body.rotation.y = Math.PI / 2;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.02, 24), metalMat);
    base.position.y = 0.01;
    const lid1 = new THREE.Mesh(new THREE.CylinderGeometry(0.385, 0.385, 0.07, 36), metalMat);
    lid1.position.y = 0.86;
    const lid2 = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.36, 0.07, 36), metalMat);
    lid2.position.y = 0.93;
    product.add(body, base, lid1, lid2);
  } else {
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.8, 36, 1, true), labelMat);
    body.position.y = 0.46;
    body.rotation.y = Math.PI / 2;
    const bottom = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.27, 0.06, 36), metalMat);
    bottom.position.y = 0.03;
    const shoulder = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.33, 0.1, 36), metalMat);
    shoulder.position.y = 0.91;
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.265, 0.265, 0.025, 36), metalMat);
    lid.position.y = 0.972;
    const tab = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.012, 0.16), metalMat);
    tab.position.set(0, 0.99, 0.05);
    product.add(body, bottom, shoulder, lid, tab);
  }

  // shield bubble (hidden until picked up)
  const shield = new THREE.Mesh(
    new THREE.SphereGeometry(0.95, 24, 16),
    bend(
      new THREE.MeshStandardMaterial({
        color: brand.colors.accent,
        emissive: brand.colors.accent,
        emissiveIntensity: 0.35,
        transparent: true,
        opacity: 0.3,
        roughness: 0.05,
        metalness: 0.2,
        depthWrite: false,
      }),
    ),
  );
  shield.position.y = 0.62;
  shield.visible = false;
  group.add(shield);

  // soft contact shadow
  const blob = new THREE.Mesh(
    new THREE.PlaneGeometry(2.1, 3.2),
    bend(new THREE.MeshBasicMaterial({ map: T.blobTexture(), transparent: true, depthWrite: false, opacity: 0.8 })),
  );
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = 0.02;
  blob.renderOrder = 1;
  group.add(blob);

  return { group, tilt, product, shield, blob };
}

// ── Collectibles ────────────────────────────────────────────────────────────
export function collectibleMesh(spec, max) {
  let geo;
  let mat;
  if (spec.kind === 'bean') {
    geo = new THREE.SphereGeometry(0.3, 14, 10);
    geo.scale(0.72, 1, 0.5);
    mat = std({ color: spec.rind, emissive: spec.rind, emissiveIntensity: 0.55, roughness: 0.3 });
  } else {
    geo = new THREE.CylinderGeometry(0.4, 0.4, 0.1, 24);
    geo.rotateX(Math.PI / 2);
    const face = T.discTexture(spec);
    const faceMat = std({ map: face, emissive: '#ffffff', emissiveMap: face, emissiveIntensity: 0.42, roughness: 0.4 });
    const side = std({ color: spec.rind, emissive: spec.rind, emissiveIntensity: 0.35, roughness: 0.5 });
    mat = [side, faceMat, faceMat];
  }
  const m = new THREE.InstancedMesh(geo, mat, max);
  m.frustumCulled = false;
  m.count = 0;
  return m;
}

export function tokenMesh(brand, max) {
  const geo = new THREE.CylinderGeometry(0.5, 0.5, 0.14, 21);
  geo.rotateX(Math.PI / 2);
  const face = T.tokenTexture(brand);
  const faceMat = std({ map: face, emissive: '#ffffff', emissiveMap: face, emissiveIntensity: 0.3, roughness: 0.25, metalness: 0.6 });
  const side = std({ color: brand.token.color, roughness: 0.3, metalness: 0.8, emissive: brand.token.color, emissiveIntensity: 0.25 });
  const m = new THREE.InstancedMesh(geo, [side, faceMat, faceMat], max);
  m.frustumCulled = false;
  m.count = 0;
  return m;
}

export function shieldPickupMesh(brand, max) {
  const geo = new THREE.SphereGeometry(0.46, 20, 14);
  const mat = bend(
    new THREE.MeshStandardMaterial({
      color: brand.colors.accent,
      emissive: brand.colors.accent,
      emissiveIntensity: 0.7,
      transparent: true,
      opacity: 0.62,
      roughness: 0.05,
      metalness: 0.3,
    }),
  );
  const m = new THREE.InstancedMesh(geo, mat, max);
  m.frustumCulled = false;
  m.count = 0;
  return m;
}

// ── Hazards ─────────────────────────────────────────────────────────────────
export function spikeMesh(brand, max) {
  const hz = brand.hazards;
  const parts = [part(new THREE.IcosahedronGeometry(0.4, 1), hz.body)];
  const n = 18;
  const q = new THREE.Quaternion();
  const dir = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 1.35; // skip the underside
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const a = i * 2.39996;
    dir.set(Math.cos(a) * r, y, Math.sin(a) * r).normalize();
    const cone = part(new THREE.ConeGeometry(0.11, 0.5, 5), hz.body, hz.tip);
    cone.translate(0, 0.52, 0);
    q.setFromUnitVectors(UP, dir);
    cone.applyQuaternion(q);
    parts.push(cone);
  }
  const geo = merge(parts);
  geo.translate(0, 0.46, 0);
  const mat = std({ vertexColors: true, flatShading: true, roughness: 0.45, emissive: hz.tip, emissiveIntensity: 0.12 });
  const m = new THREE.InstancedMesh(geo, mat, max);
  m.frustumCulled = false;
  m.count = 0;
  return m;
}

export function barrierMesh(brand, max) {
  const geo = new THREE.BoxGeometry(1, 0.62, 0.42);
  geo.translate(0, 0.45, 0);
  const map = T.barrierTexture(brand);
  const mat = std({ map, roughness: 0.5, emissive: '#ffffff', emissiveMap: map, emissiveIntensity: 0.18 });
  const m = new THREE.InstancedMesh(geo, mat, max);
  m.frustumCulled = false;
  m.count = 0;
  return m;
}

export function blobMesh(max) {
  const geo = new THREE.PlaneGeometry(1, 1);
  geo.rotateX(-Math.PI / 2);
  const mat = bend(new THREE.MeshBasicMaterial({ map: T.blobTexture(), transparent: true, depthWrite: false, opacity: 0.7 }));
  const m = new THREE.InstancedMesh(geo, mat, max);
  m.frustumCulled = false;
  m.renderOrder = 1;
  m.count = 0;
  return m;
}

// ── Scenery ─────────────────────────────────────────────────────────────────
function palm(w, x, z, lean, height) {
  const parts = [];
  const trunk = part(new THREE.CylinderGeometry(0.13, 0.24, height, 5, 3), w.trunk);
  // curve the trunk
  const p = trunk.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const t = p.getY(i) / height + 0.5;
    p.setX(i, p.getX(i) + lean * t * t);
  }
  trunk.translate(0, height / 2, 0);
  parts.push(trunk);
  for (let i = 0; i < 7; i++) {
    const leaf = part(new THREE.ConeGeometry(0.42, 2.3, 4), w.leaf, w.grass);
    leaf.rotateZ(-Math.PI / 2);
    leaf.translate(1.1, 0, 0);
    leaf.scale(1, 0.16, 1);
    leaf.rotateZ(-0.38);
    leaf.rotateY((i / 7) * Math.PI * 2 + lean);
    leaf.translate(lean, height, 0);
    parts.push(leaf);
  }
  const g = merge(parts);
  g.translate(x, 0, z);
  return g;
}

function pine(w, x, z, height) {
  const parts = [];
  const trunk = part(new THREE.CylinderGeometry(0.14, 0.2, height * 0.3, 5), w.trunk);
  trunk.translate(0, height * 0.15, 0);
  parts.push(trunk);
  for (let i = 0; i < 3; i++) {
    const cone = part(new THREE.ConeGeometry(1.2 - i * 0.28, height * 0.42, 6), w.leaf, w.grass);
    cone.translate(0, height * (0.42 + i * 0.22), 0);
    parts.push(cone);
  }
  const g = merge(parts);
  g.translate(x, 0, z);
  return g;
}

/** Sea stack with greenery on top; origin at the top surface. */
export function stackMesh(brand, max) {
  const w = brand.world;
  const parts = [];
  const rock = part(new THREE.CylinderGeometry(3, 4.6, 26, 7, 4), shadeHex(w.rock, -0.22), w.rock);
  const p = rock.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const k = Math.sin(p.getX(i) * 12.9898 + p.getY(i) * 78.233 + p.getZ(i) * 37.719) * 0.35;
    p.setX(i, p.getX(i) + k);
    p.setZ(i, p.getZ(i) + k);
  }
  rock.translate(0, -13, 0);
  parts.push(rock);
  const cap = part(new THREE.CylinderGeometry(3.25, 3.05, 0.7, 7), w.grass);
  cap.translate(0, 0.2, 0);
  parts.push(cap);
  if (w.topper === 'palm') {
    parts.push(palm(w, -0.6, 0.4, 0.9, 4.2), palm(w, 1.2, -0.8, -0.6, 3.1));
  } else if (w.topper === 'pine') {
    parts.push(pine(w, -0.8, 0.3, 4.6), pine(w, 1.1, -0.7, 3.4), pine(w, 0.3, 1.4, 2.6));
  }
  const geo = merge(parts);
  const m = new THREE.InstancedMesh(geo, std({ vertexColors: true, flatShading: true, roughness: 0.85 }), max);
  m.frustumCulled = false;
  return m;
}

function shadeHex(hex, amt) {
  return T.shade(hex, amt);
}

/** Lamp posts along the rails: posts (lit) + bulbs (unlit, glowing). */
export function lampMeshes(brand, max) {
  const w = brand.world;
  const post = part(new THREE.CylinderGeometry(0.05, 0.07, 1.5, 5), brand.colors.ink);
  post.translate(0, 0.75, 0);
  const posts = new THREE.InstancedMesh(post, std({ vertexColors: true, roughness: 0.6 }), max);
  const bulbs = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.2, 10, 8),
    bend(new THREE.MeshBasicMaterial({ color: w.rail })),
    max,
  );
  posts.frustumCulled = bulbs.frustumCulled = false;
  return { posts, bulbs };
}

/** Gate with the brand banner. Origin on the track centre line. */
export function buildGate(brand) {
  const g = new THREE.Group();
  const c = brand.colors;
  const pillarGeo = new THREE.CylinderGeometry(0.28, 0.36, 6.2, 8, 6);
  pillarGeo.translate(0, 3.1, 0);
  const pillarMat = std({ color: c.paper, roughness: 0.5 });
  for (const x of [-4.1, 4.1]) {
    const pm = new THREE.Mesh(pillarGeo, pillarMat);
    pm.position.x = x;
    g.add(pm);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 10), bend(new THREE.MeshBasicMaterial({ color: brand.world.rail })));
    ball.position.set(x, 6.5, 0);
    g.add(ball);
  }
  const map = T.bannerTexture(brand);
  const banner = new THREE.Mesh(
    new THREE.BoxGeometry(8.6, 1.9, 0.18, 12, 1, 1),
    std({ map, roughness: 0.6, emissive: '#ffffff', emissiveMap: map, emissiveIntensity: 0.45 }),
  );
  banner.position.y = 5.1;
  g.add(banner);
  g.traverse((o) => {
    o.frustumCulled = false;
  });
  return g;
}

// ── Enemy roster ────────────────────────────────────────────────────────────
// Each enemy is one merged, vertex-coloured mesh drawn with instancing. They all
// read "dark body + hot accent" so danger is recognisable in any brand palette.
function inst(geo, mat, max) {
  const m = new THREE.InstancedMesh(geo, mat, max);
  m.frustumCulled = false;
  m.count = 0;
  return m;
}

function hazMat(hz) {
  return std({ vertexColors: true, flatShading: true, roughness: 0.45, emissive: hz.tip, emissiveIntensity: 0.14 });
}

function eyes(parts, hz, x, y, z, r) {
  for (const sx of [-1, 1]) {
    const ball = part(new THREE.SphereGeometry(r, 8, 6), '#ffffff');
    ball.translate(sx * x, y, z);
    const pupil = part(new THREE.SphereGeometry(r * 0.55, 6, 5), hz.body);
    pupil.translate(sx * x, y, z + r * 0.7);
    parts.push(ball, pupil);
  }
}

/** Crab: scuttles sideways across two or three lanes. Faces +z (the player). */
export function crabMesh(brand, max) {
  const hz = brand.hazards;
  const P = [];
  const shell = part(new THREE.SphereGeometry(0.5, 10, 7), T.shade(hz.tip, -0.18), hz.tip);
  shell.scale(1, 0.56, 0.82);
  shell.translate(0, 0.42, 0);
  P.push(shell);
  for (const sx of [-1, 1]) {
    const arm = part(new THREE.CylinderGeometry(0.07, 0.07, 0.4, 5), hz.body);
    arm.rotateZ(sx * -0.9);
    arm.translate(sx * 0.52, 0.5, 0.2);
    const claw = part(new THREE.SphereGeometry(0.25, 8, 6), hz.tip);
    claw.scale(1, 0.8, 0.9);
    claw.translate(sx * 0.74, 0.68, 0.3);
    const pincer = part(new THREE.ConeGeometry(0.11, 0.3, 4), hz.body);
    pincer.translate(sx * 0.74, 0.92, 0.3);
    P.push(arm, claw, pincer);
    for (let i = 0; i < 3; i++) {
      const leg = part(new THREE.ConeGeometry(0.06, 0.42, 4), hz.body);
      leg.rotateZ(sx * 2.2);
      leg.translate(sx * 0.52, 0.2, -0.22 + i * 0.2);
      P.push(leg);
    }
    const stalk = part(new THREE.CylinderGeometry(0.035, 0.035, 0.26, 4), hz.body);
    stalk.translate(sx * 0.17, 0.74, 0.26);
    P.push(stalk);
  }
  eyes(P, hz, 0.17, 0.9, 0.26, 0.1);
  return inst(merge(P), hazMat(hz), max);
}

/** Barrel: rolls down the track towards the player. Origin at its centre. */
export function barrelMesh(brand, max) {
  const hz = brand.hazards;
  const P = [];
  const body = part(new THREE.CylinderGeometry(0.46, 0.46, 1.05, 12), hz.body);
  body.rotateZ(Math.PI / 2);
  P.push(body);
  for (const x of [-0.33, 0.33]) {
    const band = part(new THREE.CylinderGeometry(0.5, 0.5, 0.13, 12), hz.tip);
    band.rotateZ(Math.PI / 2);
    band.translate(x, 0, 0);
    P.push(band);
  }
  for (const x of [-0.535, 0.535]) {
    const mark = part(new THREE.BoxGeometry(0.03, 0.74, 0.14), hz.tip); // makes the spin readable
    mark.translate(x, 0, 0);
    P.push(mark);
  }
  for (let i = 0; i < 6; i++) {
    const stud = part(new THREE.ConeGeometry(0.09, 0.2, 4), hz.tip);
    stud.translate(0, 0.54, 0);
    stud.rotateX((i / 6) * Math.PI * 2);
    P.push(stud);
  }
  return inst(merge(P), hazMat(hz), max);
}

/** Jelly: bobs up and down; you can slip underneath at the top of its bounce. Origin at the dome base. */
export function jellyMesh(brand, max) {
  const hz = brand.hazards;
  const P = [];
  const dome = part(new THREE.SphereGeometry(0.52, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), hz.tip, T.shade(hz.tip, 0.2));
  P.push(dome);
  const skirt = part(new THREE.CylinderGeometry(0.52, 0.42, 0.14, 12), T.shade(hz.tip, -0.2));
  skirt.translate(0, -0.07, 0);
  P.push(skirt);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const tent = part(new THREE.ConeGeometry(0.07, 0.75, 4), hz.body);
    tent.rotateX(Math.PI);
    tent.translate(Math.cos(a) * 0.27, -0.5, Math.sin(a) * 0.27);
    P.push(tent);
  }
  eyes(P, hz, 0.19, 0.2, 0.42, 0.09);
  return inst(merge(P), hazMat(hz), max);
}

/** Zapper: two posts with an energy beam that switches on and off. */
export function zapMeshes(brand, max) {
  const hz = brand.hazards;
  const post = part(new THREE.CylinderGeometry(0.12, 0.2, 0.8, 6), hz.body);
  post.translate(0, 0.4, 0);
  const cap = part(new THREE.IcosahedronGeometry(0.24, 0), hz.tip);
  cap.translate(0, 0.82, 0);
  const posts = inst(merge([post, cap]), hazMat(hz), max * 2);
  const beamGeo = new THREE.BoxGeometry(1, 0.2, 0.2);
  beamGeo.translate(0, 0.82, 0);
  const beams = inst(beamGeo, bend(new THREE.MeshBasicMaterial({ color: hz.tip })), max);
  return { posts, beams };
}

/** Windmill: a spiked arm spinning flat over the track. Origin on the ground at the pivot. */
export function millMesh(brand, max) {
  const hz = brand.hazards;
  const P = [];
  const post = part(new THREE.CylinderGeometry(0.14, 0.24, 0.7, 6), hz.body);
  post.translate(0, 0.35, 0);
  const hub = part(new THREE.SphereGeometry(0.24, 8, 6), hz.tip);
  hub.translate(0, 0.75, 0);
  const arm = part(new THREE.BoxGeometry(2.2, 0.13, 0.2), hz.body);
  arm.translate(0, 0.75, 0);
  P.push(post, hub, arm);
  const q = new THREE.Quaternion();
  for (const sx of [-1, 1]) {
    const ball = part(new THREE.IcosahedronGeometry(0.3, 0), hz.tip);
    ball.translate(sx * 1.15, 0.75, 0);
    P.push(ball);
    for (const [dx, dy, dz] of [[1, 0, 0], [0, 1, 0], [0, 0, 1], [0, 0, -1]]) {
      const sp = part(new THREE.ConeGeometry(0.09, 0.26, 4), hz.body, hz.tip);
      sp.translate(0, 0.36, 0);
      sp.applyQuaternion(q.setFromUnitVectors(UP, new THREE.Vector3(sx * dx, dy, dz).normalize()));
      sp.translate(sx * 1.15, 0.75, 0);
      P.push(sp);
    }
  }
  return inst(merge(P), hazMat(hz), max);
}

/** Wasp: hovers and drifts towards the player, but never onto the safe line. Faces +z. */
export function waspMesh(brand, max) {
  const hz = brand.hazards;
  const P = [];
  const body = part(new THREE.SphereGeometry(0.3, 10, 8), hz.body);
  body.scale(1, 0.9, 1.5);
  P.push(body);
  for (const z of [-0.16, 0.12]) {
    const stripe = part(new THREE.CylinderGeometry(0.3, 0.3, 0.1, 10), hz.tip);
    stripe.rotateX(Math.PI / 2);
    stripe.scale(1, 0.92, 1);
    stripe.translate(0, 0, z);
    P.push(stripe);
  }
  const head = part(new THREE.SphereGeometry(0.22, 8, 6), hz.body);
  head.translate(0, 0.04, 0.44);
  const sting = part(new THREE.ConeGeometry(0.1, 0.4, 5), hz.tip);
  sting.rotateX(-Math.PI / 2);
  sting.translate(0, 0, -0.62);
  P.push(head, sting);
  for (const sx of [-1, 1]) {
    const wing = part(new THREE.BoxGeometry(0.62, 0.02, 0.3), '#ffffff');
    wing.rotateZ(sx * 0.45);
    wing.translate(sx * 0.42, 0.3, -0.05);
    P.push(wing);
  }
  eyes(P, hz, 0.11, 0.1, 0.6, 0.08);
  return inst(merge(P), hazMat(hz), max);
}

/** Additive halo quads (fake bloom) behind pickups and lights. Per-instance colour. */
export function glowMesh(max) {
  const mat = bend(
    new THREE.MeshBasicMaterial({ map: T.glowTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.55 }),
  );
  const m = inst(new THREE.PlaneGeometry(1, 1), mat, max);
  m.renderOrder = 3;
  return m;
}

/** Hot-air balloons drifting beside the track, striped in the brand colours. */
export function balloonMesh(brand, max) {
  const c = brand.colors;
  const env = new THREE.SphereGeometry(1.7, 16, 12).toNonIndexed();
  env.scale(1, 1.18, 1);
  const pos = env.attributes.position;
  const col = new Float32Array(pos.count * 3);
  const a = new THREE.Color(c.primary);
  const b = new THREE.Color(c.paper);
  const d = new THREE.Color(c.secondary);
  for (let i = 0; i < pos.count; i += 3) {
    // colour whole triangles by the angle of their centre → vertical stripes
    const cx = (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3;
    const cz = (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3;
    const k = Math.floor(((Math.atan2(cz, cx) + Math.PI) / (Math.PI * 2)) * 8 + 0.001) % 8;
    const cc = k % 4 === 0 ? d : k % 2 ? a : b;
    for (let j = 0; j < 3; j++) cc.toArray(col, (i + j) * 3);
  }
  env.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const neck = part(new THREE.CylinderGeometry(0.75, 0.42, 0.9, 10), c.primary);
  neck.translate(0, -2.1, 0);
  const basket = part(new THREE.BoxGeometry(0.62, 0.5, 0.62), brand.world.trunk);
  basket.translate(0, -3.1, 0);
  const m = new THREE.InstancedMesh(merge([env, neck, basket]), std({ vertexColors: true, roughness: 0.6 }), max);
  m.frustumCulled = false;
  return m;
}
