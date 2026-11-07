// 3D example models for the earthworks visualisation page.
// Three made-up example jobs built from simple shapes. Trucks run a load, haul, tip and return cycle
// on a one-way loop road, queue behind each other, and the counters add up as the job runs.
import * as THREE from 'three';
import { OrbitControls } from './vendor/OrbitControls.js';

const COL = {
  sky: 0xe7eae6,
  ground1: 0xcdbd96,
  ground2: 0xc2ae84,
  shoulder: 0xd8caa6,
  cut: 0xb08559,
  cutFloor: 0xa57b51,
  fill: 0xe0d1ad,
  road: 0xc9b894,
  orange: 0xff5a1f,
  dark: 0x2b2d32,
  tyre: 0x1c1d20,
  glass: 0x3a4552,
  steel: 0x7d828a,
  load: 0xb98f63,
  pile: 0xc49a6c,
  stock: 0xb4a78f,
  bush: 0x87916a,
  shed: 0xf0eee8,
  roof: 0xb7bbc1,
};

const PAYLOAD = 18;            // m³ per truck load
const GAP = 16;                // closest a truck gets to the one in front (m, centre to centre)
const ACCEL = 0.7;             // m/s²
const DECEL = 1.4;             // m/s²
const SPEED = { loaded: 6.0, empty: 8.5 }; // m/s on the flat
const TIP_TIME = 45;           // s
const START_HOUR = 6;

// ---------- small helpers ----------
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => t * t * (3 - 2 * t);
// 0 when d >= e0, 1 when d <= e1 (e0 > e1), straight in between: used for batters
const ramp = (d, e0, e1) => clamp((e0 - d) / (e0 - e1), 0, 1);
function angLerp(a, b, t) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
function hash(x, z) {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function vnoise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z);
  const u = ease(x - xi), v = ease(z - zi);
  return lerp(lerp(hash(xi, zi), hash(xi + 1, zi), u), lerp(hash(xi, zi + 1), hash(xi + 1, zi + 1), u), v);
}
const fbm = (x, z) => vnoise(x, z) * 0.6 + vnoise(x * 2.1, z * 2.1) * 0.3 + vnoise(x * 4.3, z * 4.3) * 0.1;
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
// Signed distance to a rounded rectangle {cx, cz, hx, hz, round}
function rrDist(x, z, r) {
  const rc = r.round ?? 12;
  const qx = Math.abs(x - r.cx) - (r.hx - rc), qz = Math.abs(z - r.cz) - (r.hz - rc);
  return Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - rc;
}
const gauss = (x, z, cx, cz, s) => Math.exp(-((x - cx) ** 2 + (z - cz) ** 2) / (2 * s * s));

const matCache = new Map();
function mat(color) {
  if (!matCache.has(color)) {
    matCache.set(color, new THREE.MeshStandardMaterial({ color, roughness: 0.82, metalness: 0, flatShading: true }));
  }
  return matCache.get(color);
}
function box(w, h, d, color, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}
function wheel(r, w, color = COL.tyre) {
  const g = new THREE.CylinderGeometry(r, r, w, 14);
  g.rotateX(Math.PI / 2);
  const m = new THREE.Mesh(g, mat(color));
  m.castShadow = true;
  return m;
}

// ---------- ground ----------
class Ground {
  constructor(def) {
    this.size = def.size;
    this.seg = def.seg;
    this.n = this.seg + 1;
    this.cell = this.size / this.seg;
    this.half = this.size / 2;
    this.h = new Float32Array(this.n * this.n);
    this.roadW = new Float32Array(this.n * this.n);
    for (let j = 0; j < this.n; j++) {
      for (let i = 0; i < this.n; i++) {
        this.h[j * this.n + i] = def.shape(-this.half + i * this.cell, -this.half + j * this.cell);
      }
    }
  }

  // Height on the same triangles the mesh draws
  at(x, z) {
    const fx = (x + this.half) / this.cell, fz = (z + this.half) / this.cell;
    const i = clamp(Math.floor(fx), 0, this.seg - 1), j = clamp(Math.floor(fz), 0, this.seg - 1);
    const u = clamp(fx - i, 0, 1), v = clamp(fz - j, 0, 1), n = this.n, h = this.h;
    const a = h[j * n + i], b = h[(j + 1) * n + i], c = h[j * n + i + 1], d = h[(j + 1) * n + i + 1];
    if (u + v <= 1) return a + (c - a) * u + (b - a) * v;
    return d + (b - d) * (1 - u) + (c - d) * (1 - v);
  }

  mesh(def) {
    const { n, seg, cell, half } = this;
    const pos = new Float32Array(n * n * 3), col = new Float32Array(n * n * 3);
    const c = new THREE.Color(), road = new THREE.Color(COL.shoulder);
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const k = j * n + i, x = -half + i * cell, z = -half + j * cell;
        pos[k * 3] = x; pos[k * 3 + 1] = this.h[k]; pos[k * 3 + 2] = z;
        def.tint(x, z, c);
        c.lerp(road, this.roadW[k] * 0.85);
        col[k * 3] = c.r; col[k * 3 + 1] = c.g; col[k * 3 + 2] = c.b;
      }
    }
    const idx = new Uint32Array(seg * seg * 6);
    let p = 0;
    for (let j = 0; j < seg; j++) {
      for (let i = 0; i < seg; i++) {
        const a = j * n + i, b = (j + 1) * n + i, cc = j * n + i + 1, d = (j + 1) * n + i + 1;
        idx[p++] = a; idx[p++] = b; idx[p++] = cc;
        idx[p++] = cc; idx[p++] = b; idx[p++] = d;
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, flatShading: true }));
    m.receiveShadow = true;
    return m;
  }
}

// ---------- haul road: a closed one-way loop ----------
function buildRoad(def, ground) {
  const curve = new THREE.CatmullRomCurve3(def.loop.map(([x, z]) => new THREE.Vector3(x, 0, z)), true, 'centripetal');
  const L = curve.getLength();
  const N = Math.round(L / 2);
  const P = curve.getSpacedPoints(N);
  P.pop();
  const ds = L / N;

  // Road levels follow the ground, smoothed so the grade is even
  let H = P.map((p) => ground.at(p.x, p.z));
  for (let it = 0; it < 8; it++) {
    const H2 = new Array(N);
    for (let i = 0; i < N; i++) {
      let s = 0;
      for (let k = -5; k <= 5; k++) s += H[(i + k + N) % N];
      H2[i] = s / 11;
    }
    H = H2;
  }

  // Cut and fill the ground to the road
  const half = def.roadWidth / 2, R = half + 8;
  const { n, cell } = ground, gh = ground.half;
  const best = new Float32Array(n * n).fill(1e9), bestH = new Float32Array(n * n);
  for (let k = 0; k < N; k++) {
    const p = P[k];
    const i0 = Math.max(0, Math.floor((p.x - R + gh) / cell)), i1 = Math.min(n - 1, Math.ceil((p.x + R + gh) / cell));
    const j0 = Math.max(0, Math.floor((p.z - R + gh) / cell)), j1 = Math.min(n - 1, Math.ceil((p.z + R + gh) / cell));
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const d = Math.hypot(-gh + i * cell - p.x, -gh + j * cell - p.z);
        const id = j * n + i;
        if (d < best[id]) { best[id] = d; bestH[id] = H[k]; }
      }
    }
  }
  for (let id = 0; id < n * n; id++) {
    if (best[id] < R) ground.h[id] = lerp(ground.h[id], bestH[id], ramp(best[id], R, half + 1));
    ground.roadW[id] = ramp(best[id], R + 3, half + 1);
  }

  // Road surface
  const verts = [];
  for (let k = 0; k <= N; k++) {
    const i = k % N, p = P[i], q = P[(i + 1) % N], o = P[(i - 1 + N) % N];
    const tx = q.x - o.x, tz = q.z - o.z, len = Math.hypot(tx, tz) || 1;
    const nx = -tz / len, nz = tx / len, y = H[i] + 0.1;
    verts.push(p.x + nx * half, y, p.z + nz * half, p.x - nx * half, y, p.z - nz * half);
  }
  const index = [];
  for (let k = 0; k < N; k++) {
    const a = 2 * k, b = 2 * k + 1, c = 2 * k + 2, d = 2 * k + 3;
    index.push(a, c, b, b, c, d);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setIndex(index);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    color: COL.road, roughness: 1, metalness: 0, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2,
  }));
  mesh.receiveShadow = true;

  const nearestS = (x, z) => {
    let bi = 0, bd = Infinity;
    for (let i = 0; i < N; i++) {
      const d = (P[i].x - x) ** 2 + (P[i].z - z) ** 2;
      if (d < bd) { bd = d; bi = i; }
    }
    return bi * ds;
  };
  const sample = (s, out) => {
    s = ((s % L) + L) % L;
    const f = s / ds, i = Math.floor(f) % N, t = f - Math.floor(f), j = (i + 1) % N;
    return out.set(lerp(P[i].x, P[j].x, t), lerp(H[i], H[j], t), lerp(P[i].z, P[j].z, t));
  };
  return { P, H, N, L, ds, mesh, sample, nearestS };
}

// ---------- machines ----------
function makeTruck() {
  const g = new THREE.Group();
  g.rotation.order = 'YZX';
  g.add(box(8.4, 0.6, 2.1, COL.dark, -0.2, 1.25, 0));
  g.add(box(1.9, 1.9, 2.6, COL.orange, 3.4, 2.45, 0));
  g.add(box(0.06, 0.8, 2.2, COL.glass, 4.36, 2.85, 0));
  g.add(box(1.1, 0.8, 0.06, COL.glass, 3.4, 2.85, 1.31));
  g.add(box(1.1, 0.8, 0.06, COL.glass, 3.4, 2.85, -1.31));
  g.add(box(0.3, 0.5, 2.6, COL.dark, 4.45, 1.05, 0));
  const wheels = [];
  for (const x of [3.3, -1.6, -3.2]) {
    for (const z of [-1.25, 1.25]) {
      const w = wheel(0.85, 0.7);
      w.position.set(x, 0.85, z);
      g.add(w);
      wheels.push(w);
    }
  }
  const tray = new THREE.Group();
  tray.position.set(-4.4, 1.7, 0);
  g.add(tray);
  tray.add(box(6.6, 0.25, 3.0, COL.orange, 3.3, 0.12, 0));
  tray.add(box(6.6, 1.5, 0.15, COL.orange, 3.3, 0.95, 1.45));
  tray.add(box(6.6, 1.5, 0.15, COL.orange, 3.3, 0.95, -1.45));
  tray.add(box(0.2, 2.0, 3.0, COL.orange, 6.5, 1.1, 0));
  tray.add(box(1.5, 0.15, 3.0, COL.orange, 7.25, 2.05, 0));
  const heapGeo = new THREE.BoxGeometry(5.8, 1.4, 2.7);
  heapGeo.translate(0, 0.7, 0);
  const heap = new THREE.Mesh(heapGeo, mat(COL.load));
  heap.position.set(3.2, 0.25, 0);
  heap.castShadow = true;
  heap.scale.y = 0.001;
  heap.visible = false;
  tray.add(heap);
  const anchor = new THREE.Object3D();
  anchor.position.set(3.3, 1.6, 0);
  tray.add(anchor);
  return { g, tray, heap, wheels, anchor };
}

// Excavator: arm targets are reached with a two-link solve in the slew plane
const BOOM = 6.6, STICK = 3.8;
function makeExcavator() {
  const g = new THREE.Group();
  g.add(box(4.6, 0.9, 0.85, COL.tyre, 0, 0.45, 1.25));
  g.add(box(4.6, 0.9, 0.85, COL.tyre, 0, 0.45, -1.25));
  g.add(box(2.4, 0.5, 1.8, COL.dark, 0, 0.75, 0));
  const house = new THREE.Group();
  house.position.y = 1.0;
  g.add(house);
  house.add(box(3.4, 1.25, 2.7, COL.orange, -0.5, 0.72, 0));
  house.add(box(0.9, 1.05, 2.6, COL.dark, -2.1, 0.62, 0));
  house.add(box(1.1, 1.5, 0.95, COL.orange, 0.65, 2.0, 0.85));
  house.add(box(0.06, 1.0, 0.85, COL.glass, 1.22, 2.1, 0.85));
  const boom = new THREE.Group();
  boom.position.set(1.0, 1.4, -0.25);
  house.add(boom);
  boom.add(box(BOOM, 0.62, 0.55, COL.orange, BOOM / 2, 0, 0));
  const stick = new THREE.Group();
  stick.position.set(BOOM, 0, 0);
  boom.add(stick);
  stick.add(box(STICK, 0.45, 0.45, COL.dark, STICK / 2, 0, 0));
  const bucket = new THREE.Group();
  bucket.position.set(STICK, 0, 0);
  stick.add(bucket);
  bucket.add(box(1.2, 0.9, 1.3, COL.dark, 0.5, -0.2, 0));
  return { g, house, boom, stick, bucket };
}

class ExcavatorRig {
  constructor(world, def) {
    const { ground } = world;
    this.world = world;
    this.parts = makeExcavator();
    const [x, z] = def.pos;
    this.parts.g.position.set(x, ground.at(x, z), z);
    this.parts.g.rotation.y = def.facing ?? 0;
    world.scene.add(this.parts.g);
    const [dx, dz] = def.dig;
    this.dig = new THREE.Vector3(dx, ground.at(dx, dz) + 0.9, dz);
    const toMachine = new THREE.Vector3(x - dx, 0, z - dz).setLength(2.2);
    this.digIn = this.dig.clone().add(toMachine).add(new THREE.Vector3(0, 0.4, 0));
    this.passTime = def.passTime ?? 28;
    this.label = 'Excavator busy';
    this.reset();
  }
  reset() {
    this.truck = null;
    this.t = 0;
    this.pass = 0;
    this.busy = 0;
    this.apply(this.pose(this.dig.clone().add(new THREE.Vector3(0, 1.2, 0))), -0.4);
  }
  pose(p) {
    const b = this.parts.g.position;
    return { az: Math.atan2(-(p.z - b.z), p.x - b.x), r: Math.hypot(p.x - b.x, p.z - b.z), y: p.y };
  }
  apply(pose, curl) {
    const { g, house, boom, stick, bucket } = this.parts;
    const b = g.position;
    house.rotation.y = pose.az - g.rotation.y;
    const r = pose.r - boom.position.x;
    const v = pose.y - (b.y + house.position.y + boom.position.y);
    const d = clamp(Math.hypot(r, v), Math.abs(BOOM - STICK) + 0.3, BOOM + STICK - 0.05);
    const phi = Math.atan2(v, r);
    const a = Math.acos(clamp((BOOM * BOOM + d * d - STICK * STICK) / (2 * BOOM * d), -1, 1));
    const c = Math.acos(clamp((BOOM * BOOM + STICK * STICK - d * d) / (2 * BOOM * STICK), -1, 1));
    const boomA = phi + a, stickA = boomA - (Math.PI - c);
    boom.rotation.z = boomA;
    stick.rotation.z = stickA - boomA;
    bucket.rotation.z = -Math.PI / 2 + curl - stickA;
  }
  start(truck, passes) {
    this.truck = truck;
    this.passes = passes;
    this.t = 0;
    this.pass = 0;
  }
  update(dt) {
    if (!this.truck) return;
    this.busy += dt;
    this.t += dt;
    if (this.t >= this.passTime) {
      this.t -= this.passTime;
      this.pass++;
      if (this.pass >= this.passes) {
        const tr = this.truck;
        this.truck = null;
        tr.load = 1;
        this.world.sim.loaded(tr);
        this.apply(this.pose(this.dig.clone().add(new THREE.Vector3(0, 1.2, 0))), -0.4);
        return;
      }
    }
    const ph = this.t / this.passTime;
    this.truck.load = (this.pass + (ph > 0.76 ? 1 : 0)) / this.passes;
    this.truck.parts.g.updateMatrixWorld(true);
    const tray = this.truck.parts.anchor.getWorldPosition(new THREE.Vector3());
    const up = (p, h) => p.clone().add(new THREE.Vector3(0, h, 0));
    const K = [
      [0.0, this.pose(up(this.dig, 1.2)), -0.4],
      [0.12, this.pose(this.dig), -0.2],
      [0.3, this.pose(this.digIn), 1.1],
      [0.42, this.pose(up(this.digIn, 4.5)), 1.2],
      [0.66, this.pose(up(tray, 3.4)), 1.2],
      [0.74, this.pose(up(tray, 2.8)), -0.7],
      [0.84, this.pose(up(tray, 3.4)), -0.6],
      [1.0, this.pose(up(this.dig, 1.2)), -0.4],
    ];
    let k = 0;
    while (k < K.length - 2 && ph > K[k + 1][0]) k++;
    const [p0, a, c0] = K[k], [p1, b, c1] = K[k + 1];
    const t = ease(clamp((ph - p0) / (p1 - p0), 0, 1));
    this.apply({ az: angLerp(a.az, b.az, t), r: lerp(a.r, b.r, t), y: lerp(a.y, b.y, t) }, lerp(c0, c1, t));
  }
}

function makeWheelLoader() {
  const g = new THREE.Group();
  g.add(box(3.4, 1.5, 2.3, COL.orange, -1.7, 1.55, 0));
  g.add(box(1.6, 1.1, 2.0, COL.orange, -3.0, 2.6, 0));
  g.add(box(1.6, 1.7, 1.9, COL.orange, -0.5, 3.15, 0));
  g.add(box(0.06, 1.0, 1.7, COL.glass, 0.31, 3.35, 0));
  g.add(box(2.2, 1.0, 1.5, COL.dark, 1.0, 1.35, 0));
  const wheels = [];
  for (const x of [1.4, -2.2]) {
    for (const z of [-1.3, 1.3]) {
      const w = wheel(1.0, 0.75);
      w.position.set(x, 1.0, z);
      g.add(w);
      wheels.push(w);
    }
  }
  const arms = new THREE.Group();
  arms.position.set(1.2, 2.2, 0);
  g.add(arms);
  arms.add(box(3.4, 0.4, 0.3, COL.dark, 1.7, 0, 0.75));
  arms.add(box(3.4, 0.4, 0.3, COL.dark, 1.7, 0, -0.75));
  const bucket = new THREE.Group();
  bucket.position.set(3.4, 0, 0);
  arms.add(bucket);
  bucket.add(box(1.2, 1.1, 3.0, COL.steel, 0.4, -0.2, 0));
  return { g, arms, bucket, wheels };
}

class WheelLoaderRig {
  constructor(world, def) {
    const { ground, sim } = world;
    this.world = world;
    this.ground = ground;
    this.parts = makeWheelLoader();
    world.scene.add(this.parts.g);
    const pile = new THREE.Vector3(def.pile[0], 0, def.pile[2]);
    const lp = sim.loadPose();
    const toTruck = new THREE.Vector3(lp.tray.x - pile.x, 0, lp.tray.z - pile.z).normalize();
    const face = pile.clone().add(toTruck.clone().multiplyScalar(def.pile[1] * 0.78));
    // The loader works from the truck's left-hand side, in a V between the pile and the truck
    const T = lp.tray.clone().add(lp.side.clone().multiplyScalar(6.2));
    const A = face.clone().add(toTruck.clone().multiplyScalar(4.5));
    const Ain = face.clone().add(toTruck.clone().multiplyScalar(2.0));
    const B = A.clone().lerp(T, 0.5).add(lp.side.clone().multiplyScalar(4));
    const head = (from, to) => Math.atan2(-(to.z - from.z), to.x - from.x);
    const hA = head(A, face), hT = head(T, lp.tray), hB = angLerp(hA, hT, 0.5);
    this.K = [
      [0.0, A, hA, 0, 0],
      [0.12, Ain, hA, 0.05, 0.7],
      [0.3, B, hB, 0.3, 0.7],
      [0.55, T, hT, 1, 0.7],
      [0.66, T, hT, 1, -0.8],
      [0.82, B, hB, 0.4, 0],
      [1.0, A, hA, 0, 0],
    ];
    this.passTime = def.passTime ?? 40;
    this.label = 'Loader busy';
    this.prev = new THREE.Vector3();
    this.reset();
  }
  reset() {
    this.truck = null;
    this.t = 0;
    this.pass = 0;
    this.busy = 0;
    this.place(this.K[0][1], this.K[0][2], 0, 0);
  }
  place(p, h, arm, curl) {
    const { g, arms, bucket, wheels } = this.parts;
    const y = this.ground.at(p.x, p.z);
    const moved = Math.hypot(p.x - this.prev.x, p.z - this.prev.z);
    const fwd = Math.cos(h) * (p.x - this.prev.x) - Math.sin(h) * (p.z - this.prev.z);
    if (moved < 5) for (const w of wheels) w.rotation.z -= Math.sign(fwd) * moved / 1.0;
    this.prev.copy(p);
    g.position.set(p.x, y, p.z);
    g.rotation.y = h;
    arms.rotation.z = lerp(-0.42, 0.62, arm);
    bucket.rotation.z = -arms.rotation.z + curl * 0.9;
  }
  start(truck, passes) {
    this.truck = truck;
    this.passes = passes;
    this.t = 0;
    this.pass = 0;
  }
  update(dt) {
    if (!this.truck) return;
    this.busy += dt;
    this.t += dt;
    if (this.t >= this.passTime) {
      this.t -= this.passTime;
      this.pass++;
      if (this.pass >= this.passes) {
        const tr = this.truck;
        this.truck = null;
        tr.load = 1;
        this.world.sim.loaded(tr);
        this.place(this.K[0][1], this.K[0][2], 0, 0);
        return;
      }
    }
    const ph = this.t / this.passTime;
    this.truck.load = (this.pass + (ph > 0.62 ? 1 : 0)) / this.passes;
    const K = this.K;
    let k = 0;
    while (k < K.length - 2 && ph > K[k + 1][0]) k++;
    const a = K[k], b = K[k + 1];
    const t = ease(clamp((ph - a[0]) / (b[0] - a[0]), 0, 1));
    this.place(a[1].clone().lerp(b[1], t), angLerp(a[2], b[2], t), lerp(a[3], b[3], t), lerp(a[4], b[4], t));
  }
}

function makeDozer() {
  const g = new THREE.Group();
  g.add(box(3.8, 0.9, 0.7, COL.tyre, 0, 0.45, 1.15));
  g.add(box(3.8, 0.9, 0.7, COL.tyre, 0, 0.45, -1.15));
  g.add(box(3.2, 1.2, 2.0, COL.orange, -0.2, 1.4, 0));
  g.add(box(1.3, 1.3, 1.5, COL.orange, -0.9, 2.65, 0));
  g.add(box(0.06, 0.8, 1.3, COL.glass, -0.24, 2.75, 0));
  g.add(box(0.35, 1.3, 3.6, COL.dark, 2.45, 0.75, 0));
  g.add(box(0.8, 0.25, 0.25, COL.dark, 1.9, 1.2, 0.9));
  g.add(box(0.8, 0.25, 0.25, COL.dark, 1.9, 1.2, -0.9));
  return { g };
}
function makeRoller() {
  const g = new THREE.Group();
  const drum = wheel(0.85, 2.1, COL.steel);
  drum.position.set(1.8, 0.85, 0);
  g.add(drum);
  g.add(box(0.5, 0.4, 2.3, COL.orange, 1.8, 1.85, 0));
  g.add(box(2.6, 1.2, 1.8, COL.orange, -0.9, 1.3, 0));
  g.add(box(1.2, 1.3, 1.4, COL.orange, -0.7, 2.55, 0));
  g.add(box(0.06, 0.8, 1.2, COL.glass, -0.07, 2.65, 0));
  for (const z of [-0.95, 0.95]) {
    const w = wheel(0.75, 0.55);
    w.position.set(-1.4, 0.75, z);
    g.add(w);
  }
  return { g, drum };
}

// Works back and forth: forward a→b, reverse b→a, then moves over one lane
class ShuttleRig {
  constructor(world, def) {
    this.ground = world.ground;
    this.parts = def.type === 'roller' ? makeRoller() : makeDozer();
    world.scene.add(this.parts.g);
    this.a = new THREE.Vector3(def.a[0], 0, def.a[1]);
    this.b = new THREE.Vector3(def.b[0], 0, def.b[1]);
    this.step = new THREE.Vector3(def.step[0], 0, def.step[1]);
    this.lanes = def.lanes;
    this.fwd = def.type === 'roller' ? 1.6 : 1.3;
    this.rev = def.type === 'roller' ? 1.6 : 2.2;
    this.len = this.a.distanceTo(this.b);
    this.heading = Math.atan2(-(this.b.z - this.a.z), this.b.x - this.a.x);
    this.reset();
  }
  reset() {
    this.lane = 0;
    this.d = 0;
    this.dir = 1;
    this.update(0);
  }
  update(dt) {
    this.d += dt * (this.dir > 0 ? this.fwd : -this.rev);
    if (this.d >= this.len) { this.d = this.len; this.dir = -1; }
    if (this.d <= 0 && this.dir < 0) { this.d = 0; this.dir = 1; this.lane = (this.lane + 1) % this.lanes; }
    const off = this.step.clone().multiplyScalar(this.lane);
    const p = this.a.clone().lerp(this.b, this.d / this.len).add(off);
    this.parts.g.position.set(p.x, this.ground.at(p.x, p.z), p.z);
    this.parts.g.rotation.y = this.heading;
    if (this.parts.drum) this.parts.drum.rotation.z = -this.d / 0.85;
  }
}

// ---------- simulation ----------
class Sim {
  constructor(world) {
    this.world = world;
    this.trucks = [];
    this.piles = [];
    this.pileGeo = new THREE.ConeGeometry(2.5, 1.6, 7);
    this.pileGeo.translate(0, 0.8, 0);
    this.tmp = new THREE.Vector3();
    this.tmp2 = new THREE.Vector3();
  }
  get road() { return this.world.road; }

  // Where a truck stands while it's loaded, and which way its left side faces
  loadPose() {
    const p = this.road.sample(0, new THREE.Vector3());
    const a = this.road.sample(3, new THREE.Vector3()), b = this.road.sample(-3, new THREE.Vector3());
    const dir = a.sub(b).setY(0).normalize();
    return { pos: p, dir, tray: p.clone().add(dir.clone().multiplyScalar(-1.1)), side: new THREE.Vector3(dir.z, 0, -dir.x) };
  }

  reset(count) {
    const { scene } = this.world;
    for (const t of this.trucks) scene.remove(t.parts.g);
    for (const p of this.piles) scene.remove(p.mesh);
    this.trucks = [];
    this.piles = [];
    this.time = 0;
    this.loads = 0;
    this.cycles = [];
    this.world.loader.reset();
    for (const s of this.world.support) s.reset();
    const L = this.road.L;
    for (let k = 0; k < count; k++) {
      const parts = makeTruck();
      scene.add(parts.g);
      const t = { parts, s: L - 2 - GAP * 1.3 * k, v: 0, state: 'toLoad', load: 0, tip: 0, last: null, piled: false };
      this.trucks.push(t);
      this.pose(t, 0);
    }
    for (let i = 0; i < 480; i++) this.step(0.5);
  }

  loaded(t) {
    t.state = 'hauling';
  }

  pose(t, moved) {
    const { road } = this;
    const p = road.sample(t.s, this.tmp);
    const a = road.sample(t.s + 3, this.tmp2);
    const dx = a.x - p.x, dz = a.z - p.z;
    const b = road.sample(t.s - 3, new THREE.Vector3());
    const g = t.parts.g;
    g.position.copy(p);
    g.rotation.y = Math.atan2(-(a.z - b.z), a.x - b.x);
    g.rotation.z = Math.atan2(a.y - b.y, Math.hypot(a.x - b.x, a.z - b.z));
    for (const w of t.parts.wheels) w.rotation.z -= moved / 0.85;
    t.grade = (a.y - b.y) / Math.max(0.1, Math.hypot(a.x - b.x, a.z - b.z));
    return Math.hypot(dx, dz);
  }

  step(dt) {
    const { road, world } = this;
    const L = road.L, sDump = world.sDump;
    this.time += dt;
    world.loader.update(dt);
    for (const s of world.support) s.update(dt);

    for (const t of this.trucks) {
      // Distance to the truck in front
      let ahead = Infinity;
      for (const o of this.trucks) {
        if (o === t) continue;
        const d = (o.s - t.s + L) % L;
        if (d > 0.01 && d < ahead) ahead = d;
      }
      if (t.state === 'loading') { this.dress(t); continue; }
      if (t.state === 'tipping') { this.tipping(t, dt); continue; }

      const target = t.state === 'hauling' ? (sDump - t.s + L) % L : (L - t.s) % L;
      const stop = Math.min(target, ahead - GAP);
      let vmax = t.state === 'hauling' ? SPEED.loaded : SPEED.empty;
      const g = t.grade || 0;
      if (t.state === 'hauling' && g > 0) vmax *= clamp(1 - g * 7, 0.3, 1);
      else vmax *= clamp(1 - Math.abs(g) * 3, 0.55, 1);
      const vstop = Math.sqrt(2 * DECEL * Math.max(0, stop));
      const vt = Math.min(vmax, vstop);
      t.v = t.v < vt ? Math.min(vt, t.v + ACCEL * dt) : vt;
      let ds = t.v * dt;
      if (ds > stop) ds = Math.max(0, stop);
      t.s = (t.s + ds) % L;
      this.pose(t, ds);
      this.dress(t);

      const left = t.state === 'hauling' ? (sDump - t.s + L) % L : (L - t.s) % L;
      if (left < 0.6 || left > L - 0.6) {
        if (t.state === 'hauling') {
          t.state = 'tipping';
          t.tip = 0;
          t.piled = false;
          t.v = 0;
        } else if (t.state === 'toLoad' && !world.loader.truck) {
          t.s = 0;
          t.v = 0;
          this.pose(t, 0);
          t.state = 'loading';
          if (t.last !== null) {
            this.cycles.push(this.time - t.last);
            if (this.cycles.length > 12) this.cycles.shift();
          }
          t.last = this.time;
          world.loader.start(t, world.def.passes);
        }
      }
    }
    this.agePiles(dt);
  }

  dress(t) {
    const { heap } = t.parts;
    heap.visible = t.load > 0.01;
    heap.scale.y = Math.max(0.001, t.load);
  }

  tipping(t, dt) {
    t.tip += dt;
    const { tray, heap } = t.parts;
    const up = ease(clamp(t.tip / 14, 0, 1)), down = ease(clamp((t.tip - 26) / 14, 0, 1));
    tray.rotation.z = 0.85 * up * (1 - down);
    if (t.tip > 6) {
      t.load = Math.max(0, 1 - (t.tip - 6) / 8);
      this.dress(t);
    }
    if (!t.piled && t.tip > 8) {
      t.piled = true;
      const g = t.parts.g;
      const dir = new THREE.Vector3(Math.cos(g.rotation.y), 0, -Math.sin(g.rotation.y));
      const left = new THREE.Vector3(dir.z, 0, -dir.x);
      const jitter = (this.loads % 5) - 2;
      const p = g.position.clone().add(dir.multiplyScalar(-4 + jitter)).add(left.multiplyScalar(8.5 + (this.loads % 3)));
      const mesh = new THREE.Mesh(this.pileGeo, mat(COL.pile));
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.position.set(p.x, this.world.ground.at(p.x, p.z) - 0.1, p.z);
      mesh.rotation.y = this.loads * 1.7;
      mesh.scale.set(1, 0.001, 1);
      this.world.scene.add(mesh);
      this.piles.push({ mesh, age: 0 });
      if (this.piles.length > 40) this.world.scene.remove(this.piles.shift().mesh);
      this.loads++;
    }
    if (t.tip >= TIP_TIME) {
      tray.rotation.z = 0;
      t.load = 0;
      this.dress(t);
      t.state = 'toLoad';
    }
  }

  agePiles(dt) {
    for (const p of this.piles) {
      p.age += dt;
      const grow = ease(clamp(p.age / 6, 0, 1));
      const flat = clamp((p.age - 120) / 480, 0, 1);
      p.mesh.scale.set(1 + 0.6 * flat, Math.max(0.001, grow * (1 - 0.85 * flat)), 1 + 0.6 * flat);
    }
    while (this.piles.length && this.piles[0].age > 900) this.world.scene.remove(this.piles.shift().mesh);
  }
}

// ---------- the three example jobs ----------
const CUT_FILL = {
  id: 'cut-fill',
  aria: 'Example 3D model of a cut to fill job: an excavator loads trucks in a cut, and the trucks tip on a fill area where a dozer and a roller work.',
  size: 900, seg: 150, roadWidth: 11, trucks: 3, passes: 4,
  cut: { cx: -110, cz: -58, hx: 58, hz: 36, round: 14 },
  pad: { cx: 150, cz: 8, hx: 62, hz: 50, round: 16 },
  shape(x, z) {
    let h = 1.3 * Math.sin(x / 110) + 1.0 * Math.cos(z / 85) + 2.2 * fbm(x / 70 + 3, z / 70);
    h = lerp(h, -5, ramp(rrDist(x, z, this.cut), 0, -8));
    h = lerp(h, 3.6, ramp(rrDist(x, z, this.pad), 10, 0));
    return h;
  },
  tint(x, z, c) {
    c.setHex(COL.ground1).lerp(new THREE.Color(COL.ground2), fbm(x / 25, z / 25));
    const dc = rrDist(x, z, this.cut), dp = rrDist(x, z, this.pad);
    if (dc < 1) c.setHex(dc < -8 ? COL.cutFloor : COL.cut);
    else if (dp < 10) c.lerp(new THREE.Color(COL.fill), ramp(dp, 10, 6));
  },
  loop: [[-80, -6], [-20, -6], [40, -6], [95, -6], [138, -6], [156, -6], [170, -1], [177, 11], [170, 23], [156, 28], [110, 28], [40, 28], [-30, 28], [-86, 28], [-98, 23], [-103, 11], [-98, -1]],
  dump: [138, -6],
  loader: { type: 'excavator', pos: [-85, -15], dig: [-87, -23.5], facing: Math.PI / 2, passTime: 28 },
  support: [
    { type: 'dozer', a: [118, -17], b: [118, -38], step: [5, 0], lanes: 7 },
    { type: 'roller', a: [192, -36], b: [192, -10], step: [3, 0], lanes: 5 },
  ],
  stockpiles: [],
  sheds: [[-150, 52, 0], [-150, 64, 0]],
  views: {
    site: { t: [10, 0, 0], o: [-110, 150, 210] },
    load: { t: [-84, 0, -14], o: [-34, 26, 44] },
    dump: { t: [138, 4, -16], o: [44, 32, 56] },
  },
  avoid(x, z) {
    return rrDist(x, z, this.cut) < 12 || rrDist(x, z, this.pad) < 18;
  },
};

const LOAD_OUT = {
  id: 'load-out',
  aria: 'Example 3D model of a stockpile load-out: a wheel loader loads trucks from a stockpile, and the trucks haul to an embankment where a dozer and a roller work.',
  size: 900, seg: 150, roadWidth: 11, trucks: 3, passes: 3,
  pad: { cx: 128, cz: 10, hx: 84, hz: 24, round: 10 },
  shape(x, z) {
    let h = 1.0 * Math.sin(x / 130 + 1) + 1.1 * Math.cos(z / 95) + 2.0 * fbm(x / 70 + 9, z / 70 + 4);
    h += 7 * gauss(x, z, -10, -120, 55);
    h = lerp(h, 4.2, ramp(rrDist(x, z, this.pad), 11, 0));
    return h;
  },
  tint(x, z, c) {
    c.setHex(COL.ground1).lerp(new THREE.Color(COL.ground2), fbm(x / 25 + 5, z / 25));
    const dp = rrDist(x, z, this.pad);
    if (dp < 11) c.lerp(new THREE.Color(COL.fill), ramp(dp, 11, 7));
    const dy = Math.hypot(x + 150, z + 10);
    if (dy < 75) c.lerp(new THREE.Color(COL.shoulder), ramp(dy, 75, 50) * 0.8);
  },
  loop: [[-100, -10], [-40, -10], [10, -2], [70, 0], [130, 0], [168, 0], [180, 0], [188, 4], [191, 11], [188, 18], [180, 22], [120, 22], [60, 22], [0, 32], [-60, 38], [-104, 30], [-122, 24], [-130, 10], [-124, -4]],
  dump: [168, 0],
  loader: { type: 'wheel', pile: [-150, 22, -46], passTime: 40 },
  support: [
    { type: 'dozer', a: [140, -6], b: [140, -18], step: [4, 0], lanes: 8 },
    { type: 'roller', a: [80, 11], b: [150, 11], step: [0, 0], lanes: 1 },
  ],
  stockpiles: [[-150, -46, 22, 10], [-178, 16, 17, 8], [-135, 52, 12, 5.5]],
  sheds: [[-60, 70, 0.2], [-48, 76, 0.2]],
  views: {
    site: { t: [-20, 0, -4], o: [-100, 150, 220] },
    load: { t: [-112, 2, -22], o: [-36, 30, 46] },
    dump: { t: [166, 5, -6], o: [42, 32, 56] },
  },
  avoid(x, z) {
    return rrDist(x, z, this.pad) < 18 || Math.hypot(x + 150, z + 10) < 82;
  },
};

const HILL = {
  id: 'hill',
  aria: 'Example 3D model of a haul up a hill: an excavator loads trucks in a cut, and loaded trucks climb a grade to a spoil dump where a dozer works.',
  size: 900, seg: 150, roadWidth: 11, trucks: 4, passes: 4,
  cut: { cx: -138, cz: -26, hx: 52, hz: 31, round: 14 },
  pad: { cx: 168, cz: -8, hx: 50, hz: 46, round: 18 },
  shape(x, z) {
    let h = 1.2 * Math.sin(x / 120) + 1.0 * Math.cos(z / 90) + 2.4 * fbm(x / 70 + 1, z / 70 + 7);
    h += 30 * gauss(x, z, 170, -10, 120);
    h = lerp(h, -4, ramp(rrDist(x, z, this.cut), 0, -8));
    h = lerp(h, 31, ramp(rrDist(x, z, this.pad), 3, -4));
    return h;
  },
  tint(x, z, c) {
    c.setHex(COL.ground1).lerp(new THREE.Color(COL.ground2), fbm(x / 25 + 2, z / 25 + 2));
    const dc = rrDist(x, z, this.cut), dp = rrDist(x, z, this.pad);
    if (dc < 1) c.setHex(dc < -8 ? COL.cutFloor : COL.cut);
    else if (dp < 4) c.lerp(new THREE.Color(COL.fill), ramp(dp, 4, -2));
  },
  loop: [[-120, 22], [-50, 24], [10, 38], [62, 30], [108, 8], [140, 0], [166, 0], [180, 0], [193, 6], [198, 18], [193, 30], [180, 36], [134, 40], [82, 60], [20, 66], [-50, 58], [-110, 50], [-130, 45], [-139, 35], [-134, 25]],
  dump: [166, 0],
  loader: { type: 'excavator', pos: [-123, 12.5], dig: [-125, 3.5], facing: Math.PI / 2, passTime: 28 },
  support: [
    { type: 'dozer', a: [150, -12], b: [150, -44], step: [5, 0], lanes: 7 },
  ],
  stockpiles: [],
  sheds: [[-180, 62, 0], [-180, 74, 0]],
  views: {
    site: { t: [20, 10, 10], o: [-120, 160, 220] },
    load: { t: [-122, 0, 12], o: [-36, 26, 46] },
    dump: { t: [164, 32, -14], o: [46, 34, 58] },
  },
  avoid(x, z) {
    return rrDist(x, z, this.cut) < 12 || rrDist(x, z, this.pad) < 14;
  },
};

const JOBS = { 'cut-fill': CUT_FILL, 'load-out': LOAD_OUT, hill: HILL };

function addShed(scene, ground, [x, z, rot]) {
  const g = new THREE.Group();
  g.add(box(12, 3, 3.2, COL.shed, 0, 1.5, 0));
  g.add(box(12.3, 0.18, 3.5, COL.roof, 0, 3.1, 0));
  g.add(box(0.9, 2, 0.06, COL.dark, 3, 1.1, 1.63));
  g.add(box(1.4, 0.8, 0.06, COL.glass, -2, 1.9, 1.63));
  g.position.set(x, ground.at(x, z), z);
  g.rotation.y = rot;
  scene.add(g);
}

function buildWorld(def) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(COL.sky);
  scene.fog = new THREE.Fog(COL.sky, 520, 1250);

  scene.add(new THREE.HemisphereLight(0xf6f3ea, 0x9c8664, 1.5));
  const sun = new THREE.DirectionalLight(0xfff3df, 2.4);
  sun.position.set(-170, 300, 150);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -300, right: 300, top: 300, bottom: -300, near: 20, far: 900 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.8;
  scene.add(sun);
  scene.add(sun.target);

  const world = { def, scene, support: [] };
  const ground = new Ground(def);
  world.ground = ground;
  const road = buildRoad(def, ground);
  world.road = road;
  world.sDump = road.nearestS(def.dump[0], def.dump[1]);
  scene.add(ground.mesh(def));
  scene.add(road.mesh);

  for (const [x, z, r, h] of def.stockpiles) {
    const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 11), mat(COL.stock));
    m.position.set(x, ground.at(x, z) + h / 2 - 0.3, z);
    m.castShadow = true;
    m.receiveShadow = true;
    scene.add(m);
  }
  for (const s of def.sheds) addShed(scene, ground, s);

  // Scrub, kept clear of the roads and the work areas
  const rand = rng(def.id.length * 7919);
  const bushes = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), mat(COL.bush), 420);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3();
  let count = 0;
  for (let tries = 0; tries < 4000 && count < 420; tries++) {
    const x = (rand() - 0.5) * 820, z = (rand() - 0.5) * 820;
    if (def.avoid(x, z)) continue;
    const id = Math.round((z + ground.half) / ground.cell) * ground.n + Math.round((x + ground.half) / ground.cell);
    if (ground.roadW[id] > 0.01) continue;
    let near = false;
    for (let i = 0; i < road.N; i += 3) {
      if (Math.abs(road.P[i].x - x) < 16 && Math.abs(road.P[i].z - z) < 16) { near = true; break; }
    }
    if (near) continue;
    const s = 0.8 + rand() * 1.6;
    sc.set(s * (1 + rand() * 0.5), s * 0.8, s);
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand() * 6.28);
    ps.set(x, ground.at(x, z) + s * 0.35, z);
    bushes.setMatrixAt(count++, m4.compose(ps, q, sc));
  }
  bushes.count = count;
  bushes.castShadow = true;
  scene.add(bushes);

  world.sim = new Sim(world);
  world.loader = def.loader.type === 'wheel' ? new WheelLoaderRig(world, def.loader) : new ExcavatorRig(world, def.loader);
  world.support = def.support.map((s) => new ShuttleRig(world, s));
  world.trucks = def.trucks;
  world.sim.reset(world.trucks);
  return world;
}

// ---------- page wiring ----------
export { JOBS, buildWorld };

export function mount(root) {
  const stage = root.querySelector('.mv-stage');
  const status = root.querySelector('[data-mv-status]');
  const canvas = document.createElement('canvas');
  canvas.className = 'mv-canvas';
  canvas.setAttribute('role', 'img');
  stage.prepend(canvas);

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  } catch (err) {
    canvas.remove();
    status.textContent = 'The 3D examples need WebGL, which isn’t available in this browser.';
    root.classList.add('is-failed');
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const camera = new THREE.PerspectiveCamera(38, 16 / 9, 1, 3000);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 12;
  controls.maxDistance = 720;
  controls.maxPolarAngle = 1.42;
  controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
  canvas.style.touchAction = 'pan-y'; // one finger up and down still scrolls the page

  // Plain mouse-wheel scrolls the page; Ctrl + wheel (or a trackpad pinch) zooms the model
  const hint = root.querySelector('[data-mv-hint]');
  let hintTimer;
  stage.addEventListener('wheel', (e) => {
    if (e.ctrlKey || e.metaKey) return;
    e.stopPropagation();
    if (hint) {
      hint.classList.add('is-flash');
      clearTimeout(hintTimer);
      hintTimer = setTimeout(() => hint.classList.remove('is-flash'), 1200);
    }
  }, { capture: true });

  const dolly = (f) => {
    const off = camera.position.clone().sub(controls.target);
    off.setLength(clamp(off.length() * f, controls.minDistance, controls.maxDistance));
    camera.position.copy(controls.target).add(off);
    fly = null;
  };
  root.querySelector('[data-zoom="in"]').addEventListener('click', () => dolly(0.7));
  root.querySelector('[data-zoom="out"]').addEventListener('click', () => dolly(1.4));

  const worlds = {};
  let world = null;
  let view = 'site';
  let fly = null;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let playing = !reduce;
  let speed = 10;

  const viewButtons = [...root.querySelectorAll('[data-view]')];
  const setPressed = (list, el) => list.forEach((b) => b.setAttribute('aria-pressed', String(b === el)));

  function viewTarget(name) {
    if (name === 'follow') {
      const g = world.sim.trucks[0].parts.g;
      const dir = new THREE.Vector3(Math.cos(g.rotation.y), 0, -Math.sin(g.rotation.y));
      const t = g.position.clone().add(new THREE.Vector3(0, 2, 0));
      const side = new THREE.Vector3(dir.z, 0, -dir.x);
      return { t, p: t.clone().addScaledVector(dir, -24).addScaledVector(side, -12).add(new THREE.Vector3(0, 12, 0)) };
    }
    const v = world.def.views[name];
    const t = new THREE.Vector3(...v.t);
    return { t, p: t.clone().add(new THREE.Vector3(...v.o)) };
  }
  function setView(name, instant = false) {
    view = name;
    setPressed(viewButtons, viewButtons.find((b) => b.dataset.view === name));
    const { t, p } = viewTarget(name);
    if (instant) {
      controls.target.copy(t);
      camera.position.copy(p);
      fly = null;
    } else {
      fly = { k: 0, t0: controls.target.clone(), p0: camera.position.clone(), follow: name === 'follow', t1: t, p1: p };
    }
  }
  viewButtons.forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));
  controls.addEventListener('start', () => {
    fly = null;
    hint?.classList.add('is-used');
  });

  const sceneButtons = [...root.querySelectorAll('[data-scene]')];
  const truckOut = root.querySelector('[data-mv-trucks]');
  const busyLabel = root.querySelector('[data-stat-label="busy"]');
  function setJob(id) {
    if (!worlds[id]) worlds[id] = buildWorld(JOBS[id]);
    world = worlds[id];
    setPressed(sceneButtons, sceneButtons.find((b) => b.dataset.scene === id));
    canvas.setAttribute('aria-label', world.def.aria);
    truckOut.textContent = world.trucks;
    busyLabel.textContent = world.loader.label;
    setView('site', true);
    stats();
  }
  sceneButtons.forEach((b) => b.addEventListener('click', () => setJob(b.dataset.scene)));

  root.querySelectorAll('[data-trucks]').forEach((b) => b.addEventListener('click', () => {
    world.trucks = clamp(world.trucks + Number(b.dataset.trucks), 1, 8);
    truckOut.textContent = world.trucks;
    world.sim.reset(world.trucks);
    if (view === 'follow') setView('follow');
    stats();
  }));

  const playBtn = root.querySelector('[data-mv-play]');
  const syncPlay = () => {
    playBtn.setAttribute('aria-pressed', String(playing));
    playBtn.textContent = playing ? 'Pause' : 'Play';
  };
  playBtn.addEventListener('click', () => { playing = !playing; syncPlay(); });
  const speedButtons = [...root.querySelectorAll('[data-speed]')];
  speedButtons.forEach((b) => b.addEventListener('click', () => {
    speed = Number(b.dataset.speed);
    setPressed(speedButtons, b);
  }));
  syncPlay();

  const out = {
    clock: root.querySelector('[data-mv-clock]'),
    loads: root.querySelector('[data-stat="loads"]'),
    moved: root.querySelector('[data-stat="moved"]'),
    cycle: root.querySelector('[data-stat="cycle"]'),
    busy: root.querySelector('[data-stat="busy"]'),
  };
  function stats() {
    const s = world.sim;
    const mins = Math.floor(s.time / 60) + START_HOUR * 60;
    out.clock.textContent = `${String(Math.floor(mins / 60) % 24).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
    out.loads.textContent = s.loads.toLocaleString('en-AU');
    out.moved.textContent = `${(s.loads * PAYLOAD).toLocaleString('en-AU')} m³`;
    out.cycle.textContent = s.cycles.length ? `${(s.cycles.reduce((a, b) => a + b, 0) / s.cycles.length / 60).toFixed(1)} min` : '–';
    out.busy.textContent = s.time > 60 ? `${Math.round((world.loader.busy / s.time) * 100)}%` : '–';
  }

  const resize = () => {
    const w = stage.clientWidth, h = stage.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(stage);

  let visible = true;
  new IntersectionObserver((entries) => { visible = entries[0].isIntersecting; }).observe(root);

  const params = new URLSearchParams(window.location.search);
  setJob(JOBS[params.get('job')] ? params.get('job') : 'cut-fill');
  if (['follow', 'load', 'dump'].includes(params.get('view'))) setView(params.get('view'), true);
  resize();
  status.hidden = true;
  root.classList.add('is-ready');

  const clock = new THREE.Clock();
  let statT = 0;
  const frame = () => {
    const real = Math.min(clock.getDelta(), 0.1);
    if (!visible || document.hidden) return;
    if (playing) {
      const simDt = real * speed;
      const n = Math.max(1, Math.ceil(simDt / 0.25));
      for (let i = 0; i < n; i++) world.sim.step(simDt / n);
    }
    if (fly) {
      if (fly.follow) {
        const v = viewTarget('follow');
        fly.t1 = v.t;
        fly.p1 = v.p;
      }
      fly.k = Math.min(1, fly.k + real / 1.3);
      const k = ease(fly.k);
      controls.target.lerpVectors(fly.t0, fly.t1, k);
      camera.position.lerpVectors(fly.p0, fly.p1, k);
      if (fly.k >= 1) fly = null;
    } else if (view === 'follow') {
      const t = world.sim.trucks[0].parts.g.position.clone().add(new THREE.Vector3(0, 2, 0));
      const d = t.clone().sub(controls.target);
      controls.target.add(d);
      camera.position.add(d);
    }
    controls.target.x = clamp(controls.target.x, -330, 330);
    controls.target.z = clamp(controls.target.z, -330, 330);
    controls.update();
    renderer.render(world.scene, camera);
    statT += real;
    if (statT > 0.25) { statT = 0; stats(); }
  };
  renderer.setAnimationLoop(() => {
    try {
      frame();
    } catch (err) {
      renderer.setAnimationLoop(null);
      status.hidden = false;
      status.textContent = `The 3D example stopped (${err.message}). Please refresh the page.`;
      root.classList.remove('is-ready');
      root.classList.add('is-failed');
      console.error(err);
    }
  });
}
