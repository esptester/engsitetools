// 3D example models for the earthworks visualisation page.
// Three made-up example jobs built from simple shapes. Trucks run a load, haul, tip and return cycle
// on a one-way loop road, queue behind each other, and the counters add up as the job runs.
import * as THREE from 'three';
import { OrbitControls } from './vendor/OrbitControls.js';

const COL = {
  sky: 0xe7eae6,
  night: 0x0b1222,
  ground1: 0xcdbd96,
  ground2: 0xc2ae84,
  shoulder: 0xd8caa6,
  cut: 0xb08559,
  cutFloor: 0xa57b51,
  fill: 0xe0d1ad,
  road: 0xc9b894,
  orange: 0xff5a1f,
  orange2: 0xe04a12,
  grey: 0xa3a8ae,
  dark: 0x2b2d32,
  tyre: 0x1c1d20,
  glass: 0x3a4552,
  steel: 0x7d828a,
  load: 0xb98f63,
  pile: 0xc49a6c,
  stock: 0xb4a78f,
  soil: 0x9f7b54,
  bush: 0x87916a,
  shed: 0xf0eee8,
  roof: 0xb7bbc1,
};

const PAYLOAD = 18;            // m³ per truck load
const GAP = 16;                // closest a truck gets to the one in front (m, centre to centre)
// How the trucks drive: they pull away slowly, ease into top speed, keep a time gap to the truck in front,
// and brake early and gently. The acceleration itself builds and eases off gradually, so nothing lurches.
const DRIVE = {
  accel: { loaded: 0.3, empty: 0.5 }, // m/s², pulling away on the flat
  brake: 1.0,                         // comfortable braking (m/s²)
  headway: 1.8,                       // seconds kept behind the truck in front
  jerk: 0.6,                          // how quickly the acceleration builds (m/s³); braking builds 2.5 times faster
  length: 9.5,                        // truck length (m)
};
const SPEED = { loaded: 6.0, empty: 8.5 }; // m/s on the flat
const GAP_TIP = 26;            // how far back trucks wait while the one in front turns and tips (m)
const TURN_R = 7;              // radius of the reverse turn into the tip head (m)
const TIP = { in: 15, settle: 1.5, raise: 12, hold: 1.5, lower: 9, out: 8 }; // s: backing in slowly, settle, raise, hold, lower, pull out
const SPILL_PER_LOAD = 520;    // pieces of material in one tipped load
const SPILL_R = 0.17;          // size of one piece (m)
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
    const inCut = def.cut && rrDist(-gh + (id % n) * cell, -gh + Math.floor(id / n) * cell, def.cut) < 0;
    if (best[id] < R && !inCut) ground.h[id] = lerp(ground.h[id], bestH[id], ramp(best[id], R, half + 1));
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
// A machine is built from many small parts, merged into one mesh per colour, so the detail stays cheap to draw
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _one = new THREE.Vector3(1, 1, 1);
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3();
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
const LAMP = new THREE.MeshStandardMaterial({ color: 0xfff8e6, emissive: 0xfff0c8, emissiveIntensity: 0.7, roughness: 0.4, flatShading: true });

class Kit {
  constructor() { this.parts = new Map(); }
  add(geo, key, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    if (g !== geo) geo.dispose();
    g.deleteAttribute('uv');
    g.applyMatrix4(_m4.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _one));
    if (!this.parts.has(key)) this.parts.set(key, []);
    this.parts.get(key).push(g);
    return this;
  }
  box(w, h, d, key, x, y, z, rx, ry, rz) {
    return this.add(new THREE.BoxGeometry(w, h, d), key, x, y, z, rx, ry, rz);
  }
  // A cylinder with its axis along x, y or z
  cyl(r, len, key, x, y, z, axis = 'z', seg = 12) {
    const rot = axis === 'x' ? [0, 0, Math.PI / 2] : axis === 'z' ? [Math.PI / 2, 0, 0] : [0, 0, 0];
    return this.add(new THREE.CylinderGeometry(r, r, len, seg), key, x, y, z, ...rot);
  }
  build(parent, shadow = true) {
    for (const [key, geos] of this.parts) {
      let n = 0;
      for (const g of geos) n += g.attributes.position.count;
      const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3);
      let o = 0;
      for (const g of geos) {
        pos.set(g.attributes.position.array, o * 3);
        nor.set(g.attributes.normal.array, o * 3);
        o += g.attributes.position.count;
        g.dispose();
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      const mesh = new THREE.Mesh(geo, typeof key === 'number' ? mat(key) : key);
      mesh.castShadow = shadow;
      mesh.receiveShadow = true;
      parent.add(mesh);
    }
    this.parts.clear();
    return parent;
  }
}

// One axle: the tyres on both sides with hub plates, turned as one piece
function makeAxle(parent, x, y, r, width, zs) {
  const axle = new THREE.Group();
  axle.position.set(x, y, 0);
  const k = new Kit();
  const outer = Math.max(...zs.map((z) => Math.abs(z)));
  for (const z of zs) {
    k.cyl(r, width, COL.tyre, 0, 0, z, 'z', 16);
    if (Math.abs(z) < outer - 0.01) continue;
    const s = Math.sign(z), face = z + s * (width / 2 + 0.015);
    k.cyl(r * 0.55, 0.03, COL.grey, 0, 0, face, 'z', 10);
    k.box(r * 0.9, 0.09, 0.03, COL.tyre, 0, 0, face + s * 0.02);
    k.box(0.09, r * 0.9, 0.03, COL.tyre, 0, 0, face + s * 0.02);
  }
  k.build(axle);
  parent.add(axle);
  return axle;
}

// Amber rotating beacon: the lens pulses and a soft glow flares with each turn
let glowTex;
// a plain white glow, for reversing lights
let whiteTex;
function whiteGlowTexture() {
  if (whiteTex !== undefined) return whiteTex;
  whiteTex = null;
  if (typeof document === 'undefined') return whiteTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.25, 'rgba(255,255,255,0.75)');
  grd.addColorStop(0.6, 'rgba(235,240,255,0.18)');
  grd.addColorStop(1, 'rgba(235,240,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  whiteTex = new THREE.CanvasTexture(c);
  whiteTex.colorSpace = THREE.SRGBColorSpace;
  return whiteTex;
}
function addReverseGlow(parent, x, y, z, size) {
  const tex = whiteGlowTexture();
  if (!tex) return null;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  s.position.set(x, y, z);
  s.scale.setScalar(size);
  parent.add(s);
  return s;
}
function glowTexture() {
  if (glowTex !== undefined) return glowTex;
  glowTex = null;
  if (typeof document === 'undefined') return glowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,240,1)');
  grd.addColorStop(0.2, 'rgba(255,205,120,0.9)');
  grd.addColorStop(0.55, 'rgba(255,150,30,0.25)');
  grd.addColorStop(1, 'rgba(255,140,0,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  glowTex = new THREE.CanvasTexture(c);
  glowTex.colorSpace = THREE.SRGBColorSpace;
  return glowTex;
}
const BEACON_BASE = new THREE.CylinderGeometry(0.15, 0.17, 0.1, 10);
const BEACON_LENS = new THREE.CylinderGeometry(0.1, 0.14, 0.24, 10);
let beaconCount = 0;
function addBeacon(parent, x, y, z) {
  const base = new THREE.Mesh(BEACON_BASE, mat(COL.dark));
  base.position.set(x, y + 0.05, z);
  const lensMat = new THREE.MeshStandardMaterial({ color: 0xffb53a, emissive: 0xff8a00, emissiveIntensity: 0.3, roughness: 0.35, flatShading: true });
  const lens = new THREE.Mesh(BEACON_LENS, lensMat);
  lens.position.set(x, y + 0.22, z);
  parent.add(base, lens);
  const beacon = { lensMat, glow: null, phase: (beaconCount++ * 0.37) % 1 };
  const tex = glowTexture();
  if (tex) {
    beacon.glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0xffb14a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    beacon.glow.position.set(x, y + 0.24, z);
    parent.add(beacon.glow);
  }
  return beacon;
}
function flashBeacons(list, time) {
  for (const b of list) {
    if (!b) continue;
    // Seen from one side, a rotating beacon gives a short bright pulse about 1.3 times a second
    const p = Math.pow(Math.max(0, Math.cos((time * 1.3 + b.phase) * Math.PI * 2)), 10);
    b.lensMat.emissiveIntensity = 0.35 + 3.2 * p;
    if (b.glow) {
      b.glow.material.opacity = 0.9 * p;
      b.glow.scale.setScalar(1 + 2.6 * p);
    }
  }
}

// Hydraulic ram between two points in its parent's x-y plane: the barrel stays put and the rod slides out
const RAM_GEO = new THREE.CylinderGeometry(1, 1, 1, 8);
function makeRam(parent, rBarrel, rRod, z = 0) {
  const g = new THREE.Group();
  const barrel = new THREE.Mesh(RAM_GEO, mat(COL.dark));
  const rod = new THREE.Mesh(RAM_GEO, mat(COL.steel));
  for (const m of [barrel, rod]) {
    m.rotation.z = -Math.PI / 2;
    m.castShadow = true;
    g.add(m);
  }
  barrel.scale.set(rBarrel, 1, rBarrel);
  rod.scale.set(rRod, 1, rRod);
  parent.add(g);
  return {
    g,
    set(ax, ay, bx, by) {
      const len = Math.max(0.05, Math.hypot(bx - ax, by - ay));
      g.position.set(ax, ay, z);
      g.rotation.z = Math.atan2(by - ay, bx - ax);
      barrel.scale.y = len * 0.58;
      barrel.position.x = len * 0.29;
      rod.scale.y = len * 0.5;
      rod.position.x = len * 0.75;
    },
  };
}

// A heaped load: a box with its top pulled in
function moundGeometry(w, h, d, taper) {
  const g = new THREE.BoxGeometry(w, h, d);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    if (p.getY(i) > 0) {
      p.setX(i, p.getX(i) * taper);
      p.setZ(i, p.getZ(i) * (taper - 0.06));
    }
  }
  g.translate(0, h / 2, 0);
  g.computeVertexNormals();
  return g;
}
const HEAP_GEO = moundGeometry(5.9, 1.3, 2.7, 0.8);
const STREAM_GEO = new THREE.BoxGeometry(1, 1, 1);

function makeTruck() {
  const g = new THREE.Group();
  g.rotation.order = 'YZX';
  const k = new Kit();
  // chassis, cab and front end
  k.box(8.6, 0.34, 0.24, COL.dark, -0.2, 1.2, 0.55).box(8.6, 0.34, 0.24, COL.dark, -0.2, 1.2, -0.55);
  k.box(0.3, 0.32, 2.6, COL.dark, 4.5, 1.15, 0);
  k.box(1.9, 1.75, 2.5, COL.orange, 3.4, 2.42, 0);
  k.box(1.98, 0.12, 2.56, COL.orange2, 3.42, 3.35, 0);
  k.box(0.22, 0.07, 2.4, COL.dark, 4.42, 3.27, 0);
  k.box(0.05, 0.78, 2.22, COL.glass, 4.36, 2.78, 0);
  k.box(1.0, 0.7, 0.05, COL.glass, 3.6, 2.8, 1.26).box(1.0, 0.7, 0.05, COL.glass, 3.6, 2.8, -1.26);
  k.box(0.06, 0.55, 1.5, COL.dark, 4.37, 1.92, 0);
  k.box(0.05, 0.16, 0.36, LAMP, 4.38, 1.72, 0.98).box(0.05, 0.16, 0.36, LAMP, 4.38, 1.72, -0.98);
  for (const s of [1, -1]) {
    k.box(0.05, 0.05, 0.32, COL.dark, 4.15, 2.95, s * 1.42);
    k.box(0.07, 0.36, 0.17, COL.dark, 4.18, 2.82, s * 1.6);
    k.box(0.45, 0.05, 0.32, COL.grey, 3.15, 1.25, s * 1.28);
    k.box(1.4, 0.08, 0.72, COL.dark, 3.3, 1.78, s * 1.22);
    k.box(0.05, 0.6, 0.78, COL.dark, -4.25, 0.78, s * 1.15);
  }
  // exhaust stack behind the cab, fuel tank and toolbox on the chassis
  k.cyl(0.075, 1.3, COL.grey, 2.3, 2.95, 1.0, 'y', 8);
  k.cyl(0.1, 0.1, COL.dark, 2.3, 3.62, 1.0, 'y', 8);
  k.cyl(0.3, 1.1, COL.grey, 1.1, 1.05, -1.0, 'x', 10);
  k.box(0.9, 0.45, 0.45, COL.dark, 0.6, 1.05, 1.02);
  k.build(g);
  // brake lights glow when it slows or stands; reversing lights flash while it backs into the tip
  const brakeMat = new THREE.MeshStandardMaterial({ color: 0xc8261e, emissive: 0xff2010, emissiveIntensity: 0.3, roughness: 0.5, flatShading: true });
  const revMat = new THREE.MeshStandardMaterial({ color: 0xf2f2ea, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.4, flatShading: true });
  new Kit()
    .box(0.05, 0.12, 0.4, brakeMat, -4.42, 1.22, 1.0).box(0.05, 0.12, 0.4, brakeMat, -4.42, 1.22, -1.0)
    .box(0.05, 0.12, 0.18, revMat, -4.42, 1.22, 0.62).box(0.05, 0.12, 0.18, revMat, -4.42, 1.22, -0.62)
    .build(g, false);
  const wheels = [
    makeAxle(g, 3.3, 0.85, 0.85, 0.62, [-1.2, 1.2]),
    makeAxle(g, -1.6, 0.85, 0.85, 0.42, [-1.36, -0.92, 0.92, 1.36]),
    makeAxle(g, -3.2, 0.85, 0.85, 0.42, [-1.36, -0.92, 0.92, 1.36]),
  ];
  const beacon = addBeacon(g, 4.0, 3.41, -0.85);
  // the tipping body, hinged at the back of the chassis
  const tray = new THREE.Group();
  tray.position.set(-4.4, 1.7, 0);
  g.add(tray);
  const tk = new Kit();
  tk.box(6.6, 0.22, 3.0, COL.orange, 3.3, 0.11, 0);
  tk.box(6.4, 0.18, 0.18, COL.dark, 3.3, -0.09, 0.55).box(6.4, 0.18, 0.18, COL.dark, 3.3, -0.09, -0.55);
  for (const s of [1, -1]) {
    tk.box(6.6, 1.45, 0.12, COL.orange, 3.3, 0.95, s * 1.44);
    tk.box(6.7, 0.14, 0.2, COL.orange2, 3.3, 1.72, s * 1.46);
    for (const x of [0.25, 1.6, 3.0, 4.4, 5.8]) tk.box(0.14, 1.4, 0.08, COL.orange2, x, 0.92, s * 1.53);
  }
  tk.box(0.18, 2.1, 3.0, COL.orange, 6.55, 1.15, 0);
  tk.box(1.6, 0.14, 3.0, COL.orange, 7.3, 2.15, 0);
  tk.build(tray);
  // tailgate, hung from the top of the back of the body: shut on the road, it swings open as the body tips
  const gate = new THREE.Group();
  gate.position.set(-0.02, 1.72, 0);
  tray.add(gate);
  new Kit()
    .box(0.12, 1.5, 2.9, COL.orange, -0.06, -0.75, 0)
    .box(0.08, 0.12, 2.9, COL.orange2, -0.15, -0.35, 0)
    .box(0.08, 0.12, 2.9, COL.orange2, -0.15, -1.05, 0)
    .box(0.1, 0.32, 0.12, COL.dark, -0.14, -1.32, 1.2)
    .box(0.1, 0.32, 0.12, COL.dark, -0.14, -1.32, -1.2)
    .cyl(0.07, 3.0, COL.dark, 0, 0, 0, 'z', 8)
    .build(gate);
  // the load, kept against the open back so it slides out first when the body tips
  const heap = new THREE.Mesh(HEAP_GEO, mat(COL.load));
  heap.position.set(3.2, 0.22, 0);
  heap.castShadow = true;
  heap.visible = false;
  tray.add(heap);
  const anchor = new THREE.Object3D();
  anchor.position.set(3.3, 1.6, 0);
  tray.add(anchor);
  const ram = makeRam(g, 0.15, 0.085);
  const stream = new THREE.Mesh(STREAM_GEO, mat(COL.load));
  stream.castShadow = true;
  stream.visible = false;
  g.add(stream);
  const revGlow = [0.62, -0.62].map((z) => addReverseGlow(g, -4.6, 1.22, z, 1.6));
  return { g, tray, gate, heap, wheels, anchor, ram, beacon, revMat, revGlow, brakeMat, stream };
}

// Excavator: arm targets are reached with a two-link solve in the slew plane
const BOOM = 6.6, STICK = 3.8;
const LOADER_SCALE = 1.3;
function makeExcavator() {
  const g = new THREE.Group();
  const k = new Kit();
  for (const s of [1, -1]) {
    const z = s * 1.25;
    k.box(4.2, 0.62, 0.82, COL.tyre, 0, 0.45, z);
    k.cyl(0.42, 0.84, COL.tyre, 2.1, 0.45, z, 'z', 12).cyl(0.42, 0.84, COL.tyre, -2.1, 0.45, z, 'z', 12);
    k.cyl(0.26, 0.86, COL.dark, 2.1, 0.45, z, 'z', 10).cyl(0.26, 0.86, COL.dark, -2.1, 0.45, z, 'z', 10);
    for (let i = 0; i < 12; i++) k.box(0.07, 0.05, 0.84, COL.dark, -1.9 + i * 0.345, 0.79, z);
    k.box(3.6, 0.3, 0.5, COL.dark, 0, 0.45, s * 0.8);
  }
  k.box(2.2, 0.45, 1.6, COL.dark, 0, 0.8, 0);
  k.cyl(1.0, 0.22, COL.dark, 0, 1.0, 0, 'y', 16);
  k.build(g);
  const house = new THREE.Group();
  house.position.y = 1.0;
  g.add(house);
  const hk = new Kit();
  hk.box(3.2, 1.15, 2.6, COL.orange, -0.6, 0.72, 0);
  hk.box(0.75, 1.0, 2.6, COL.dark, -2.25, 0.62, 0);
  hk.cyl(0.5, 2.6, COL.dark, -2.55, 0.62, 0, 'z', 14);
  hk.box(1.9, 0.1, 2.3, COL.orange2, -1.25, 1.34, 0);
  for (const x of [-1.9, -1.5, -1.1, -0.7]) hk.box(0.06, 0.04, 1.6, COL.dark, x, 1.4, 0.15);
  hk.cyl(0.08, 0.7, COL.grey, -1.7, 1.75, 0.85, 'y', 8);
  for (const s of [1, -1]) {
    hk.box(2.2, 0.05, 0.05, COL.grey, -1.2, 1.82, s * 1.22);
    for (const x of [-2.2, -0.2]) hk.box(0.05, 0.42, 0.05, COL.grey, x, 1.6, s * 1.22);
  }
  // cab on the left of the boom
  hk.box(1.25, 1.55, 1.0, COL.orange, 0.65, 2.05, -0.8);
  hk.box(1.32, 0.1, 1.08, COL.orange2, 0.65, 2.88, -0.8);
  hk.box(0.05, 1.05, 0.86, COL.glass, 1.29, 2.15, -0.8);
  hk.box(0.95, 0.9, 0.05, COL.glass, 0.6, 2.2, -1.31).box(0.95, 0.9, 0.05, COL.glass, 0.6, 2.2, -0.29);
  hk.build(house);
  const beacon = addBeacon(house, 0.35, 2.93, -1.05);
  const boom = new THREE.Group();
  boom.position.set(1.0, 1.4, 0.25);
  house.add(boom);
  const bk = new Kit();
  bk.box(BOOM, 0.62, 0.55, COL.orange, BOOM / 2, 0, 0);
  bk.box(BOOM - 0.4, 0.06, 0.5, COL.orange2, BOOM / 2, 0.33, 0);
  bk.cyl(0.24, 0.7, COL.dark, 0, 0, 0, 'z', 10).cyl(0.2, 0.66, COL.dark, BOOM, 0, 0, 'z', 10);
  bk.build(boom);
  const stick = new THREE.Group();
  stick.position.set(BOOM, 0, 0);
  boom.add(stick);
  const sk = new Kit();
  sk.box(STICK + 0.5, 0.46, 0.44, COL.orange, STICK / 2 - 0.25, 0, 0);
  sk.cyl(0.17, 0.56, COL.dark, STICK, 0, 0, 'z', 10);
  sk.build(stick);
  const bucket = new THREE.Group();
  bucket.position.set(STICK, 0, 0);
  stick.add(bucket);
  const kk = new Kit();
  kk.box(1.15, 0.85, 1.3, COL.dark, 0.5, -0.2, 0);
  kk.box(0.3, 0.12, 1.36, COL.steel, 1.05, -0.62, 0);
  for (const z of [-0.5, -0.17, 0.17, 0.5]) kk.box(0.26, 0.08, 0.12, COL.steel, 1.25, -0.62, z);
  kk.build(bucket);
  const load = new THREE.Mesh(moundGeometry(0.95, 0.4, 1.1, 0.7), mat(COL.load));
  load.position.set(0.5, 0.2, 0);
  load.castShadow = true;
  load.visible = false;
  bucket.add(load);
  const rams = { boom: makeRam(house, 0.14, 0.08, 0.25), stick: makeRam(boom, 0.13, 0.075), bucket: makeRam(stick, 0.11, 0.065) };
  return { g, house, boom, stick, bucket, load, rams, beacon };
}

// Material dropping from a bucket into the truck below
function pour(rig, dt, rate, [x0, y0, zSpread, xSpread]) {
  rig.pourAcc = (rig.pourAcc || 0) + rate * dt;
  if (rig.pourAcc < 1 || !rig.truck) return;
  rig.parts.g.updateMatrixWorld(true);
  const floorY = rig.truck.parts.tray.getWorldPosition(_v1).y + 0.3 + 1.2 * rig.truck.load;
  while (rig.pourAcc >= 1) {
    rig.pourAcc -= 1;
    const p = rig.parts.bucket.localToWorld(_v2.set(x0 + Math.random() * xSpread, y0, (Math.random() - 0.5) * zSpread));
    rig.world.spill.emit(p.x, p.y, p.z, (Math.random() - 0.5) * 0.6, -0.4 - Math.random(), (Math.random() - 0.5) * 0.6, null, floorY);
  }
}

const rot2 = (x, y, a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];

// Fuel burn (L/h). Made-up figures in a plausible range: each machine's figure follows what it's doing
// (idling, digging, climbing loaded, coasting downhill) over a couple of seconds, like a fuel gauge.
// Each machine's running cost adds up from its hire rate and the fuel it burns.
const RATES = { excavator: 165, loader: 150, truck: 140, dozer: 170, roller: 115 }; // $/h with operator, made up
const FUEL_PRICE = 1.95; // $/L
function burn(obj, target, dt) {
  obj.fuel = obj.fuel === undefined ? target : obj.fuel + (target - obj.fuel) * Math.min(1, dt / 2.5);
  obj.cost = (obj.cost || 0) + (((obj.rate || 0) + obj.fuel * FUEL_PRICE) * dt) / 3600;
}

// Speed over the ground (km/h) for a machine's label, from how far it moved; smoothed like a speedometer
function speedo(m, dt) {
  const p = m.parts.g.position;
  if (!m.lastPos) {
    m.lastPos = p.clone();
    m.kmh = 0;
    return;
  }
  const now = (Math.hypot(p.x - m.lastPos.x, p.z - m.lastPos.z) / dt) * 3.6;
  // a jump (a reset, or a truck pulling in to its mark) isn't driving
  if (now < 60) m.kmh += (now - m.kmh) * Math.min(1, dt / 0.6);
  m.lastPos.copy(p);
}

// How busy the digger has been lately: averaged over the last five minutes, so it falls quickly while it waits
const UTIL_WINDOW = 300; // s
function workload(rig, working, dt) {
  const span = Math.max(dt, Math.min(rig.world.sim.time, UTIL_WINDOW));
  rig.util += ((working ? 1 : 0) - rig.util) * Math.min(1, dt / span);
}

class ExcavatorRig {
  constructor(world, def) {
    const { ground } = world;
    this.world = world;
    this.parts = makeExcavator();
    this.ground = ground;
    const [x, z] = def.pos;
    this.parts.g.position.set(x, ground.at(x, z), z);
    // tracks pointing at the truck it loads, unless the job says otherwise
    const tray = world.sim.loadPose().tray;
    this.parts.g.rotation.y = def.facing ?? Math.atan2(-(tray.z - z), tray.x - x);
    world.scene.add(this.parts.g);
    // it works along the face of the cut, alongside its tracks
    this.along = new THREE.Vector3(Math.cos(this.parts.g.rotation.y), 0, -Math.sin(this.parts.g.rotation.y));
    this.dig0 = new THREE.Vector3(def.dig[0], 0, def.dig[1]);
    this.dig = new THREE.Vector3();
    this.digIn = new THREE.Vector3();
    this.passTime = def.passTime ?? 28;
    this.label = 'Excavator busy';
    this.id = 'EX-01';
    this.rate = RATES.excavator;
    this.lift = 7.4;
    this.reset();
  }
  // Each pass takes the next bite along the face, so it works its way along the length of the cut
  aim(pass) {
    const off = [0, -1.6, 1.6, -0.8, 0.8][pass % 5];
    const x = this.dig0.x + this.along.x * off, z = this.dig0.z + this.along.z * off;
    const b = this.parts.g.position;
    this.dig.set(x, this.ground.at(x, z) + 0.9, z);
    this.digIn.set(b.x - x, 0, b.z - z).setLength(2.2).add(this.dig);
    this.digIn.y += 0.4;
  }
  reset() {
    this.truck = null;
    this.t = 0;
    this.pass = 0;
    this.busy = 0;
    this.util = 0;
    this.cost = 0;
    this.tipPass = -1;
    this.parts.load.visible = false;
    this.aim(0);
    this.apply(this.pose(this.dig.clone().add(new THREE.Vector3(0, 1.2, 0))), -0.4);
  }
  pose(p) {
    const b = this.parts.g.position;
    return { az: Math.atan2(-(p.z - b.z), p.x - b.x), r: Math.hypot(p.x - b.x, p.z - b.z), y: p.y };
  }
  apply(pose, curl) {
    const { g, house, boom, stick, bucket, rams } = this.parts;
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
    // the rams follow the arm
    let [x, y] = rot2(2.7, -0.42, boom.rotation.z);
    rams.boom.set(0.75, 0.75, boom.position.x + x, boom.position.y + y);
    [x, y] = rot2(-0.55, 0.32, stick.rotation.z);
    rams.stick.set(3.3, 0.42, stick.position.x + x, stick.position.y + y);
    [x, y] = rot2(-0.15, 0.32, bucket.rotation.z);
    rams.bucket.set(1.4, 0.32, bucket.position.x + x, bucket.position.y + y);
  }
  start(truck, passes) {
    this.truck = truck;
    this.passes = passes;
    this.t = 0;
    this.pass = 0;
    this.tipPass = -1;
    this.aim(0);
  }
  update(dt) {
    workload(this, !!this.truck, dt);
    if (!this.truck) {
      burn(this, 9, dt);
      return;
    }
    this.busy += dt;
    this.t += dt;
    if (this.t >= this.passTime) {
      this.t -= this.passTime;
      this.pass++;
      this.aim(this.pass);
      if (this.pass >= this.passes) {
        const tr = this.truck;
        this.truck = null;
        tr.load = 1;
        this.parts.load.visible = false;
        this.world.sim.loaded(tr);
        this.apply(this.pose(this.dig.clone().add(new THREE.Vector3(0, 1.2, 0))), -0.4);
        return;
      }
    }
    const ph = this.t / this.passTime;
    this.truck.load = (this.pass + (ph > 0.76 ? 1 : 0)) / this.passes;
    // a bucketful out of the cut and into the truck
    if (ph > 0.76 && this.tipPass !== this.pass) {
      this.tipPass = this.pass;
      this.world.sim.taken += PAYLOAD / this.passes;
    }
    // digging is the hardest work, then lifting and swinging a full bucket
    burn(this, ph < 0.12 ? 20 : ph < 0.3 ? 34 : ph < 0.66 ? 30 : ph < 0.84 ? 17 : 22, dt);
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
    this.parts.load.visible = ph > 0.3 && ph < 0.73;
    if (ph > 0.71 && ph < 0.8) pour(this, dt, 40, [0.3, -0.45, 1.0, 0.5]);
  }
}

function makeWheelLoader() {
  const g = new THREE.Group();
  const k = new Kit();
  k.box(3.0, 1.3, 2.2, COL.orange, -1.9, 1.55, 0);
  k.box(2.5, 0.12, 2.0, COL.orange2, -2.05, 2.26, 0);
  k.box(0.45, 1.15, 2.25, COL.dark, -3.6, 1.5, 0);
  for (const y of [1.2, 1.45, 1.7]) k.box(0.04, 0.06, 1.6, COL.grey, -3.84, y, 0);
  k.cyl(0.08, 0.8, COL.grey, -2.7, 2.65, 0.6, 'y', 8);
  k.box(1.6, 1.65, 1.9, COL.orange, -0.5, 3.12, 0);
  k.box(1.75, 0.12, 2.05, COL.orange2, -0.5, 4.0, 0);
  k.box(0.05, 1.05, 1.7, COL.glass, 0.31, 3.3, 0);
  for (const s of [1, -1]) {
    k.box(1.3, 0.95, 0.05, COL.glass, -0.55, 3.3, s * 0.96);
    k.box(1.0, 0.08, 0.7, COL.dark, 1.4, 2.05, s * 1.3);
  }
  k.box(2.2, 1.0, 1.5, COL.dark, 1.0, 1.35, 0);
  k.cyl(0.32, 0.9, COL.dark, -0.2, 1.4, 0, 'y', 10);
  for (const s of [1, -1]) {
    k.box(0.06, 0.18, 0.34, LAMP, 0.34, 3.84, s * 0.62);
    k.box(0.06, 0.2, 0.3, LAMP, 2.12, 1.6, s * 0.52);
  }
  k.build(g);
  const brakeMat = new THREE.MeshStandardMaterial({ color: 0xc8261e, emissive: 0xff2010, emissiveIntensity: 0.3, roughness: 0.5, flatShading: true });
  const revMat = new THREE.MeshStandardMaterial({ color: 0xf2f2ea, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.4, flatShading: true });
  const lk = new Kit();
  for (const s of [1, -1]) {
    lk.box(0.05, 0.16, 0.22, brakeMat, -3.85, 1.2, s * 0.95);
    lk.box(0.05, 0.16, 0.22, revMat, -3.85, 1.2, s * 0.68);
  }
  lk.build(g, false);
  const beacon = addBeacon(g, -0.9, 4.06, 0.6);
  const wheels = [makeAxle(g, 1.4, 1.0, 1.0, 0.75, [-1.3, 1.3]), makeAxle(g, -2.2, 1.0, 1.0, 0.75, [-1.3, 1.3])];
  const arms = new THREE.Group();
  arms.position.set(1.2, 2.2, 0);
  g.add(arms);
  const ak = new Kit();
  for (const s of [1, -1]) ak.box(2.8, 0.4, 0.3, COL.orange, 1.4, 0, s * 0.75);
  ak.cyl(0.13, 1.6, COL.dark, 1.65, 0, 0, 'z', 8);
  ak.box(1.3, 0.26, 0.26, COL.orange2, 1.0, 0.45, 0);
  ak.build(arms);
  const bucket = new THREE.Group();
  bucket.position.set(2.8, 0, 0);
  arms.add(bucket);
  const bk = new Kit();
  bk.box(1.2, 1.1, 3.0, COL.steel, 0.4, -0.2, 0);
  bk.box(0.3, 0.1, 3.05, COL.dark, 0.95, -0.72, 0);
  for (let i = 0; i < 6; i++) bk.box(0.24, 0.07, 0.12, COL.dark, 1.15, -0.72, -1.25 + i * 0.5);
  bk.build(bucket);
  const load = new THREE.Mesh(moundGeometry(1.0, 0.45, 2.6, 0.7), mat(COL.load));
  load.position.set(0.4, 0.33, 0);
  load.castShadow = true;
  load.visible = false;
  bucket.add(load);
  // a big loader: about 30% larger than the parts above, so the tyres stand about 2.6 m tall
  g.scale.setScalar(LOADER_SCALE);
  const revGlow = [0.68, -0.68].map((z) => addReverseGlow(g, -4.0, 1.2, z, 1.25));
  return { g, arms, bucket, load, wheels, beacon, brakeMat, revMat, revGlow };
}

// V-loading in a narrow V, so the loader never turns more than 30 degrees. With a full bucket it drives
// straight to the truck and tips, backs straight away and swings 30 degrees to its right as it slows,
// drives into the stockpile and fills the bucket, then backs out and straightens up, ready to drive
// straight back to the truck. The swings are wide and gentle on the articulation joint.
const LOADER_V = Math.PI / 6; // the most it turns between the truck and the stockpile
const LOADER_R = 9;           // radius of its swings (m)

// A path through a list of points, sampled by distance along it
function track(points) {
  const cum = [0];
  for (let i = 1; i < points.length; i++) cum.push(cum[i - 1] + points[i].distanceTo(points[i - 1]));
  return { points, cum, len: cum[cum.length - 1] };
}
function trackAt(tr, d, pos, dir) {
  const { points, cum } = tr;
  let i = 1;
  while (i < cum.length - 1 && cum[i] < d) i++;
  const a = points[i - 1], b = points[i];
  pos.lerpVectors(a, b, clamp((d - cum[i - 1]) / Math.max(1e-6, cum[i] - cum[i - 1]), 0, 1));
  dir.subVectors(b, a).setY(0).normalize();
}
// Points on the circle of radius r around c, from a to b the short way round (a itself is left out)
function arcPoints(c, a, b, r, out) {
  const a0 = Math.atan2(a.z - c.z, a.x - c.x);
  let sw = Math.atan2(b.z - c.z, b.x - c.x) - a0;
  if (sw > Math.PI) sw -= 2 * Math.PI;
  if (sw < -Math.PI) sw += 2 * Math.PI;
  const n = Math.max(2, Math.ceil((Math.abs(sw) * r) / 0.25));
  for (let i = 1; i <= n; i++) {
    const t = a0 + (sw * i) / n;
    out.push(new THREE.Vector3(c.x + r * Math.cos(t), 0, c.z + r * Math.sin(t)));
  }
  return out;
}

// A long stockpile, built as a heightfield: sides at about 34 degrees, flat on top where it's wide enough.
// toe: where the bucket meets the face; along: the way the face runs back; into: into the pile.
function stockpileMesh(ground, toe, along, into, { length, near, far, height }) {
  const s = 3, k = 0.67, cell = 1.5;
  const back = Math.hypot(length + s, far - near);
  const nu = Math.ceil((length + s + 6) / cell) + 1, nv = Math.ceil((far + 6) / cell) + 1;
  const pos = new Float32Array(nu * nv * 3), inside = new Uint8Array(nu * nv);
  let volume = 0;
  for (let j = 0; j < nv; j++) {
    for (let i = 0; i < nu; i++) {
      const u = -s - 3 + i * cell, w = -3 + j * cell;
      const dBack = ((u + s) * (far - near) - (w - near) * (length + s)) / back;
      const d = Math.min(w, length - u, u + s, dBack);
      const x = toe.x + along.x * u + into.x * w, z = toe.z + along.z * u + into.z * w;
      let hh = -0.4;
      if (d > 0) {
        hh = Math.min(height, k * d);
        hh += (hash(x * 0.37, z * 0.41) - 0.5) * Math.min(0.6, hh * 0.12);
        volume += hh * cell * cell;
        inside[j * nu + i] = 1;
      }
      const o = (j * nu + i) * 3;
      pos[o] = x;
      pos[o + 1] = ground.at(x, z) + hh;
      pos[o + 2] = z;
    }
  }
  // wind the triangles so they face up, whichever way the pile runs
  const up = into.z * along.x - into.x * along.z > 0;
  const idx = [];
  for (let j = 0; j < nv - 1; j++) {
    for (let i = 0; i < nu - 1; i++) {
      const a = j * nu + i, b = a + 1, c = a + nu, d = c + 1;
      if (!(inside[a] | inside[b] | inside[c] | inside[d])) continue;
      if (up) idx.push(a, c, b, b, c, d);
      else idx.push(a, b, c, b, d, c);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, mat(COL.stock));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  // a spot on the ridge, a third of the way along, for its label
  const um = length * 0.3, wm = (near + ((far - near) * (um + s)) / (length + s)) * 0.5;
  const tx = toe.x + along.x * um + into.x * wm, tz = toe.z + along.z * um + into.z * wm;
  return { mesh, volume, top: new THREE.Vector3(tx, ground.at(tx, tz) + Math.min(height, k * wm) + 1.5, tz) };
}

class WheelLoaderRig {
  constructor(world, def) {
    const { ground, sim, scene } = world;
    this.world = world;
    this.ground = ground;
    this.parts = makeWheelLoader();
    if (world.night) addLoaderLights(this.parts);
    scene.add(this.parts.g);
    const lp = sim.loadPose();
    const v = (x, z) => new THREE.Vector3(x, 0, z);
    // facing the truck, and the loader's right hand as it does
    const fT = v(-lp.side.x, -lp.side.z);
    const right = v(-fT.z, fT.x);
    const T = v(lp.tray.x, lp.tray.z).addScaledVector(lp.side, 5.9);
    // where it digs: off to the right of the line to the truck, and clear of the road
    const { r } = def.pile;
    const C = T.clone().addScaledVector(right, def.pile.right).addScaledVector(fT, -def.pile.back);
    // facing the stockpile: turned 30 degrees right from facing the truck
    const fD = fT.clone().multiplyScalar(Math.cos(LOADER_V)).addScaledVector(right, Math.sin(LOADER_V));
    // X: where the line to the truck and the line to the stockpile cross
    const dx = T.x - C.x, dz = T.z - C.z;
    const det = -fT.x * fD.z + fD.x * fT.z;
    const u = (-dx * fD.z + fD.x * dz) / det;
    const X = T.clone().addScaledVector(fT, -u);
    // in far enough that the bucket goes a few metres into the toe of the pile
    const Dig = C.clone().addScaledVector(fD, -(r + 3.4));
    // The stockpile: a long pile, worked from its near end. Its face runs back from where the bucket goes in,
    // and it gets deeper and taller as the road falls away.
    const stock = stockpileMesh(ground, Dig.clone().addScaledVector(fD, 4), v(-fD.z, fD.x), fD, def.pile);
    scene.add(stock.mesh);
    // the two swings: each a 30 degree arc, joining one line to the other
    const tl = LOADER_R * Math.tan(LOADER_V / 2), cd = LOADER_R / Math.cos(LOADER_V / 2);
    const P1 = X.clone().addScaledVector(fT, tl), R = X.clone().addScaledVector(fD, -tl);
    const P2 = X.clone().addScaledVector(fD, tl), Q = X.clone().addScaledVector(fT, -tl);
    const c1 = X.clone().addScaledVector(fT.clone().sub(fD).normalize(), cd);
    const c2 = X.clone().addScaledVector(fD.clone().sub(fT).normalize(), cd);
    const toTruck = track([Q, T]);
    const fromTruck = track(arcPoints(c1, P1, R, LOADER_R, [T, P1]));
    const toPile = track([R, Dig]);
    const fromPile = track(arcPoints(c2, P2, Q, LOADER_R, [Dig, P2]));
    Object.assign(this, { T, Q, R, X, Dig, fT, fD, pileTop: stock.top, pileVolume: stock.volume });
    // t0, t1: share of the pass. arm: lift arms, 0 down to 1 at full height. curl: bucket, back is +, tipped is -
    // s: seconds for each part of the pass (it reverses slowly); fuel: L/h, hardest crowding into the pile
    const parts = [
      { s: 10.5, kind: 'fwd', leg: toTruck, arm: [0.3, 1], curl: [0.75, 0.75], fuel: 27 },
      { s: 3.8, kind: 'stop', at: T, face: fT, arm: [1, 1], curl: [0.75, -0.8], fuel: 15 },
      { s: 15, kind: 'rev', leg: fromTruck, arm: [1, 0.3], curl: [-0.8, 0], fuel: 19 },
      { s: 1.2, kind: 'stop', at: R, face: fD, arm: [0.3, 0.3], curl: [0, 0], fuel: 10 },
      { s: 4.4, kind: 'fwd', leg: toPile, arm: [0.3, 0], curl: [0, 0.1], fuel: 22 },
      { s: 3.6, kind: 'stop', at: Dig, face: fD, arm: [0, 0.08], curl: [0.1, 0.75], fuel: 34 },
      { s: 6.3, kind: 'rev', leg: fromPile, arm: [0.08, 0.3], curl: [0.75, 0.75], fuel: 24 },
      { s: 1.2, kind: 'stop', at: Q, face: fT, arm: [0.3, 0.3], curl: [0.75, 0.75], fuel: 10 },
    ];
    this.passTime = parts.reduce((a, x) => a + x.s, 0);
    let at = 0;
    this.segs = parts.map((x) => {
      const t0 = at / this.passTime;
      at += x.s;
      return { ...x, t0, t1: at / this.passTime };
    });
    // the moments the bucket tips into the truck, and fills at the pile
    this.tipSeg = this.segs[1];
    this.fillSeg = this.segs[5];
    this.label = 'Loader busy';
    this.id = 'WL-01';
    this.rate = RATES.loader;
    this.lift = 6.4;
    this.prev = new THREE.Vector3();
    this.pos = new THREE.Vector3();
    this.face = new THREE.Vector3();
    this.reversing = false;
    this.reset();
  }
  reset() {
    this.truck = null;
    this.cycling = false;
    this.tipped = false;
    this.t = 0;
    this.pass = 0;
    this.busy = 0;
    this.util = 0;
    this.cost = 0;
    this.parts.load.visible = true;
    this.prev.copy(this.Q);
    this.pose(1);
  }
  // where the loader is at a point in its pass (0 to 1)
  pose(ph) {
    const s = this.segs.find((x) => ph <= x.t1) || this.segs[this.segs.length - 1];
    const k = clamp((ph - s.t0) / (s.t1 - s.t0), 0, 1), e = ease(k);
    const { pos, face } = this;
    if (s.kind === 'stop') {
      pos.copy(s.at);
      face.copy(s.face);
    } else {
      trackAt(s.leg, e * s.leg.len, pos, face);
      if (s.kind === 'rev') face.negate();
    }
    this.reversing = s.kind === 'rev' && k > 0.02 && k < 0.98;
    // brake lights: stopped, or slowing at the end of a move
    this.braking = s.kind === 'stop' || k > 0.6;
    this.place(pos, Math.atan2(-face.z, face.x), lerp(s.arm[0], s.arm[1], e), lerp(s.curl[0], s.curl[1], e));
    this.parts.brakeMat.emissiveIntensity = this.braking ? 1.6 : 0.3;
  }
  place(p, h, arm, curl) {
    const { g, arms, bucket, wheels } = this.parts;
    const y = this.ground.at(p.x, p.z);
    const moved = Math.hypot(p.x - this.prev.x, p.z - this.prev.z);
    const fwd = Math.cos(h) * (p.x - this.prev.x) - Math.sin(h) * (p.z - this.prev.z);
    if (moved < 5) for (const w of wheels) w.rotation.z -= Math.sign(fwd) * moved / (1.0 * LOADER_SCALE);
    this.prev.copy(p);
    g.position.set(p.x, y, p.z);
    g.rotation.y = h;
    arms.rotation.z = lerp(-0.42, 0.62, arm);
    bucket.rotation.z = -arms.rotation.z + curl * 0.9;
  }
  // A truck has pulled in. If the loader is still filling its bucket after the last truck, it finishes that first.
  start(truck, passes) {
    this.truck = truck;
    this.passes = passes;
    this.pass = 0;
  }
  update(dt) {
    workload(this, this.cycling || !!this.truck, dt);
    if (!this.cycling) {
      // waiting with a full bucket for the next truck
      if (!this.truck) {
        this.pose(1);
        burn(this, 8, dt);
        return;
      }
      this.cycling = true;
      this.tipped = false;
      this.t = 0;
    }
    this.busy += dt;
    this.t = Math.min(this.t + dt, this.passTime);
    const ph = this.t / this.passTime;
    const tip = this.tipSeg, tipSpan = tip.t1 - tip.t0;
    if (this.truck && !this.tipped) {
      // the bucketful goes in as it tips
      this.truck.load = (this.pass + ease(clamp((ph - tip.t0 - tipSpan * 0.2) / (tipSpan * 0.55), 0, 1))) / this.passes;
      if (ph > tip.t0 + tipSpan * 0.1 && ph < tip.t1 - tipSpan * 0.1) pour(this, dt, 45, [0.2, -0.5, 2.4, 0.6]);
      if (ph >= tip.t1) {
        this.tipped = true;
        this.pass++;
        this.world.sim.taken += PAYLOAD / this.passes;
        // the last bucket: the truck goes, and the loader fills up again ready for the next one
        if (this.pass >= this.passes) {
          const tr = this.truck;
          this.truck = null;
          tr.load = 1;
          this.world.sim.loaded(tr);
        }
      }
    }
    this.parts.load.visible = ph < tip.t0 + tipSpan * 0.45 || ph > this.fillSeg.t0 + (this.fillSeg.t1 - this.fillSeg.t0) * 0.5;
    this.pose(ph);
    burn(this, (this.segs.find((x) => ph <= x.t1) || this.segs[this.segs.length - 1]).fuel, dt);
    if (ph >= 1) this.cycling = false;
  }
}

// a lumpy heap of dirt sitting on the ground: a squashed ball with its underside flattened
function lumpGeometry(rx, ry, rz, seed) {
  const g = new THREE.IcosahedronGeometry(1, 1);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const n = 0.82 + 0.36 * hash(x * 3.1 + seed, z * 2.7 + y * 1.9);
    p.setXYZ(i, x * rx * n, Math.max(0, y) * ry * n, z * rz * n);
  }
  g.computeVertexNormals();
  return g;
}
const SOIL_GEO = lumpGeometry(0.85, 0.8, 1.7, 1);
const SPOIL_GEO = lumpGeometry(1.3, 1.05, 2.2, 2);
function makeDozer() {
  const g = new THREE.Group();
  g.rotation.order = 'YZX';
  const k = new Kit();
  for (const s of [1, -1]) {
    const z = s * 1.2;
    k.box(3.2, 0.7, 0.66, COL.tyre, 0.1, 0.42, z);
    k.cyl(0.36, 0.68, COL.tyre, 1.7, 0.4, z, 'z', 12).cyl(0.46, 0.68, COL.tyre, -1.55, 0.72, z, 'z', 12);
    k.cyl(0.24, 0.7, COL.dark, 1.7, 0.4, z, 'z', 10).cyl(0.3, 0.7, COL.dark, -1.55, 0.72, z, 'z', 10);
    for (let i = 0; i < 9; i++) k.box(0.07, 0.05, 0.68, COL.dark, -1.15 + i * 0.34, 0.79, z);
  }
  k.box(2.3, 1.0, 1.6, COL.orange, 0.55, 1.45, 0);
  k.box(2.2, 0.1, 1.5, COL.orange2, 0.55, 1.98, 0);
  k.box(0.05, 0.75, 1.3, COL.dark, 1.71, 1.42, 0);
  k.cyl(0.07, 0.8, COL.grey, 1.0, 2.35, -0.45, 'y', 8);
  k.box(1.6, 1.2, 2.0, COL.orange, -1.05, 1.4, 0);
  k.box(1.25, 1.15, 1.5, COL.orange, -1.05, 2.55, 0);
  k.box(1.5, 0.1, 1.75, COL.orange2, -1.05, 3.18, 0);
  k.box(0.05, 0.8, 1.3, COL.glass, -0.41, 2.62, 0);
  for (const s of [1, -1]) k.box(1.0, 0.75, 0.05, COL.glass, -1.05, 2.62, s * 0.76);
  // ripper at the back
  k.box(0.35, 0.22, 1.7, COL.dark, -2.25, 1.15, 0);
  k.box(0.2, 1.0, 0.22, COL.dark, -2.4, 0.62, 0, 0, 0, 0.25);
  k.build(g);
  const beacon = addBeacon(g, -1.45, 3.23, 0.55);
  const blade = new THREE.Group();
  blade.position.set(2.45, 0.7, 0);
  g.add(blade);
  const bk = new Kit();
  bk.box(0.3, 1.3, 3.7, COL.orange2, 0, 0, 0);
  bk.box(0.1, 0.14, 3.7, COL.steel, 0.16, -0.6, 0);
  for (const s of [1, -1]) {
    bk.box(2.2, 0.2, 0.2, COL.dark, -1.15, -0.25, s * 1.2);
    bk.add(new THREE.CylinderGeometry(0.08, 0.08, 1.3, 8), COL.steel, -0.6, 0.85, s * 0.5, 0, 0, 1.03);
  }
  bk.build(blade);
  // the dirt it's pushing, in front of the blade at ground level
  const soil = new THREE.Mesh(SOIL_GEO, mat(COL.soil));
  soil.position.set(0.95, -0.72, 0);
  soil.castShadow = true;
  soil.visible = false;
  blade.add(soil);
  return { g, blade, beacon, soil };
}

function makeRoller() {
  const g = new THREE.Group();
  g.rotation.order = 'YZX';
  const drum = new THREE.Group();
  drum.position.set(1.8, 0.85, 0);
  g.add(drum);
  const dk = new Kit();
  dk.cyl(0.85, 2.1, COL.steel, 0, 0, 0, 'z', 18);
  for (const s of [1, -1]) {
    dk.cyl(0.5, 0.04, COL.dark, 0, 0, s * 1.07, 'z', 12);
    dk.box(0.9, 0.08, 0.03, COL.dark, 0, 0, s * 1.1);
  }
  dk.build(drum);
  const k = new Kit();
  k.box(1.1, 0.22, 2.5, COL.orange, 1.8, 1.82, 0);
  for (const s of [1, -1]) k.box(1.5, 1.2, 0.12, COL.orange, 1.8, 1.25, s * 1.2);
  k.box(0.12, 0.12, 2.2, COL.dark, 2.7, 0.55, 0);
  k.box(0.6, 0.55, 0.8, COL.dark, 0.85, 1.15, 0);
  k.box(2.5, 1.15, 1.8, COL.orange, -0.95, 1.3, 0);
  k.box(1.7, 0.1, 1.7, COL.orange2, -1.35, 1.93, 0);
  k.cyl(0.07, 0.7, COL.grey, -1.9, 2.25, 0.5, 'y', 8);
  k.box(1.15, 1.25, 1.4, COL.orange, -0.6, 2.5, 0);
  k.box(1.35, 0.1, 1.6, COL.orange2, -0.6, 3.18, 0);
  k.box(0.05, 0.85, 1.25, COL.glass, -0.01, 2.58, 0);
  for (const s of [1, -1]) k.box(0.9, 0.8, 0.05, COL.glass, -0.6, 2.58, s * 0.71);
  k.build(g);
  const beacon = addBeacon(g, -0.95, 3.23, 0.5);
  const wheels = [makeAxle(g, -1.4, 0.75, 0.75, 0.55, [-0.95, 0.95])];
  return { g, drum, wheels, beacon };
}

// Cubic Hermite curve (and its tangent) on the ground plane
function hermite(out, p0, t0, p1, t1, s) {
  const s2 = s * s, s3 = s2 * s;
  const a = 2 * s3 - 3 * s2 + 1, b = s3 - 2 * s2 + s, c = -2 * s3 + 3 * s2, d = s3 - s2;
  return out.set(a * p0.x + b * t0.x + c * p1.x + d * t1.x, 0, a * p0.z + b * t0.z + c * p1.z + d * t1.z);
}
function hermiteTangent(out, p0, t0, p1, t1, s) {
  const s2 = s * s;
  const a = 6 * s2 - 6 * s, b = 3 * s2 - 4 * s + 1, c = -6 * s2 + 6 * s, d = 3 * s2 - 2 * s;
  return out.set(a * p0.x + b * t0.x + c * p1.x + d * t1.x, 0, a * p0.z + b * t0.z + c * p1.z + d * t1.z);
}

// Works a strip back and forth. It pushes forward along a lane, stops and lifts the blade,
// then backs up on a gentle S-bend into the next lane, so it never jumps or snaps round.
class ShuttleRig {
  constructor(world, def) {
    this.ground = world.ground;
    this.roller = def.type === 'roller';
    this.parts = this.roller ? makeRoller() : makeDozer();
    world.scene.add(this.parts.g);
    this.a = new THREE.Vector3(def.a[0], 0, def.a[1]);
    this.b = new THREE.Vector3(def.b[0], 0, def.b[1]);
    this.stepV = new THREE.Vector3(def.step[0], 0, def.step[1]);
    this.lanes = Math.max(1, def.lanes);
    this.dir = this.b.clone().sub(this.a).normalize();
    this.len = this.a.distanceTo(this.b);
    this.speed = this.roller ? { fwd: 1.6, rev: 1.6 } : { fwd: 1.2, rev: 1.9 };
    this.lift = this.roller ? 3.9 : 4.4;
    this.rate = this.roller ? RATES.roller : RATES.dozer;
    this.P0 = new THREE.Vector3();
    this.P1 = new THREE.Vector3();
    this.T = new THREE.Vector3();
    this.pos = new THREE.Vector3();
    this.face = new THREE.Vector3();
    this.prev = new THREE.Vector3();
    this.reset();
  }
  start(i) { return this.a.clone().addScaledVector(this.stepV, i); }
  end(i) { return this.b.clone().addScaledVector(this.stepV, i); }
  go(phase) { this.phase = phase; this.t = 0; }
  reset() {
    this.lane = 0;
    this.next = 0;
    this.laneDir = 1;
    this.raise = 0;
    this.cost = 0;
    this.go('fwd');
    this.prev.copy(this.start(0));
    this.update(0);
  }
  update(dt) {
    this.t += dt;
    const { pos, face } = this;
    if (this.phase === 'fwd') {
      const k = clamp(this.t / ((this.len / this.speed.fwd) * 1.3), 0, 1);
      this.progress = k;
      pos.copy(this.start(this.lane)).lerp(this.end(this.lane), ease(k));
      face.copy(this.dir);
      this.raise = 0;
      if (k >= 1) this.go('turn');
    } else if (this.phase === 'turn') {
      pos.copy(this.end(this.lane));
      face.copy(this.dir);
      this.raise = ease(clamp(this.t, 0, 1));
      if (this.t >= 1.3) {
        let next = this.lane;
        if (this.lanes > 1) {
          next = this.lane + this.laneDir;
          if (next < 0 || next >= this.lanes) {
            this.laneDir *= -1;
            next = this.lane + this.laneDir;
          }
        }
        this.next = next;
        this.P0.copy(this.end(this.lane));
        this.P1.copy(this.start(next));
        this.T.copy(this.dir).multiplyScalar(-this.P0.distanceTo(this.P1));
        this.go('rev');
      }
    } else if (this.phase === 'rev') {
      const k = clamp(this.t / ((this.P0.distanceTo(this.P1) / this.speed.rev) * 1.3), 0, 1);
      const s = ease(k);
      hermite(pos, this.P0, this.T, this.P1, this.T, s);
      hermiteTangent(face, this.P0, this.T, this.P1, this.T, s).negate().normalize();
      this.raise = 1;
      if (k >= 1) {
        this.lane = this.next;
        this.go('set');
      }
    } else {
      pos.copy(this.start(this.lane));
      face.copy(this.dir);
      this.raise = 1 - ease(clamp(this.t / 0.9, 0, 1));
      if (this.t >= 1.0) this.go('fwd');
    }
    this.place();
    // pushing scrub is the hardest work; the roller works steadily
    const work = this.roller ? 15 : this.pushed && this.pushed.length ? 36 : 27;
    burn(this, this.phase === 'fwd' ? work : this.phase === 'rev' ? (this.roller ? 15 : 19) : this.roller ? 9 : 13, dt);
  }
  place() {
    const { g, blade, drum, wheels } = this.parts;
    const { pos, face, ground } = this;
    const moved = (pos.x - this.prev.x) * face.x + (pos.z - this.prev.z) * face.z;
    this.prev.copy(pos);
    g.position.set(pos.x, ground.at(pos.x, pos.z), pos.z);
    g.rotation.y = Math.atan2(-face.z, face.x);
    const hf = ground.at(pos.x + face.x * 2, pos.z + face.z * 2), hb = ground.at(pos.x - face.x * 2, pos.z - face.z * 2);
    g.rotation.z = Math.atan2(hf - hb, 4);
    if (blade) {
      blade.position.y = 0.7 + 0.5 * this.raise;
      blade.rotation.z = 0.1 * this.raise;
    }
    if (drum) drum.rotation.z -= moved / 0.85;
    if (wheels) for (const w of wheels) w.rotation.z -= moved / 0.75;
  }
}

// ---------- clearing scrub ----------
// The dozer clears a patch of scrub. Each pass it catches the bushes in its lane on the blade,
// rolls them along in front of it and leaves them in a windrow at the far end, scraping a strip of
// ground bare as it goes. Lanes it has left well behind grow back, so it can keep working.
const BUSH_GEO = (() => {
  const blobs = [[0, 0.12, 0, 0.62], [0.45, -0.06, 0.2, 0.46], [-0.42, -0.08, -0.16, 0.48], [0.06, 0.02, -0.46, 0.42], [-0.12, 0.36, 0.26, 0.38], [0.3, 0.3, -0.22, 0.34]];
  let n = 0;
  const geos = blobs.map(([x, y, z, r]) => {
    const g = new THREE.IcosahedronGeometry(r, 0);
    g.translate(x, y, z);
    n += g.attributes.position.count;
    return g;
  });
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3);
  let o = 0;
  for (const g of geos) {
    pos.set(g.attributes.position.array, o * 3);
    nor.set(g.attributes.normal.array, o * 3);
    o += g.attributes.position.count;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  return geo;
})();
const BUSH_GREEN = new THREE.Color(COL.bush), BUSH_DRY = new THREE.Color(0x8c7b55);
const _up = new THREE.Vector3(0, 1, 0), _q2 = new THREE.Quaternion();

function inClearing(def, x, z) {
  for (const s of def.support) {
    if (s.type !== 'clear') continue;
    const dx = s.b[0] - s.a[0], dz = s.b[1] - s.a[1], len = Math.hypot(dx, dz);
    const sl = Math.hypot(s.step[0], s.step[1]) || 1;
    const rx = x - s.a[0], rz = z - s.a[1];
    const u = (rx * dx + rz * dz) / len, v = (rx * s.step[0] + rz * s.step[1]) / sl;
    if (u > -8 && u < len + 12 && v > -7 && v < sl * (s.lanes - 1) + 7) return true;
  }
  return false;
}

class ClearingRig extends ShuttleRig {
  constructor(world, def) {
    super(world, def);
    this.world = world;
    this.lat = new THREE.Vector3(-this.dir.z, 0, this.dir.x);
    const rand = rng(Math.round(Math.abs(def.a[0] * 13 + def.a[1] * 7)) + 11);
    this.bushes = [];
    this.laneData = [];
    for (let i = 0; i < this.lanes; i++) {
      const lane = { bushes: [], cleared: false, clearedAt: 0, regrow: -1, reveal: 0, stripe: this.makeStripe(i), spoil: this.makeSpoil(i), spoilAmt: 0 };
      let along = this.len * (0.14 + rand() * 0.08);
      while (along < this.len * 0.86) {
        const b = { lane: i, along, lat: (rand() - 0.5) * 2.2, size: 0.9 + rand() * 0.6, stretch: 1 + rand() * 0.4, yaw: rand() * 6.28, heading: 0, state: 'standing', pos: new THREE.Vector3(), tilt: 0, grow: 1, order: 0, lat0: 0 };
        lane.bushes.push(b);
        this.bushes.push(b);
        along += 3.2 + rand() * 3.5;
      }
      this.laneData.push(lane);
    }
    this.mesh = new THREE.InstancedMesh(BUSH_GEO, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0, flatShading: true }), this.bushes.length);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    world.scene.add(this.mesh);
    this.resetBushes();
  }
  home(b, out) {
    return out.copy(this.start(b.lane)).addScaledVector(this.dir, b.along).addScaledVector(this.lat, b.lat);
  }
  // the heap of dirt left at the end of a lane, a little bigger each pass
  makeSpoil(i) {
    const m = new THREE.Mesh(SPOIL_GEO, mat(COL.soil));
    const e = this.end(i).addScaledVector(this.dir, 3.4);
    m.position.set(e.x, this.ground.at(e.x, e.z) - 0.08, e.z);
    m.rotation.y = Math.atan2(-this.dir.z, this.dir.x);
    m.castShadow = true;
    m.receiveShadow = true;
    m.visible = false;
    this.world.scene.add(m);
    return m;
  }
  // a strip of scraped ground along a lane, revealed behind the blade
  makeStripe(i) {
    const n = Math.max(2, Math.ceil(this.len)), verts = [], index = [];
    const lat = new THREE.Vector3(-this.dir.z, 0, this.dir.x), c = new THREE.Vector3();
    for (let k = 0; k <= n; k++) {
      c.copy(this.start(i)).addScaledVector(this.dir, (k / n) * this.len);
      for (const s of [1, -1]) {
        const x = c.x + lat.x * 1.85 * s, z = c.z + lat.z * 1.85 * s;
        verts.push(x, this.ground.at(x, z) + 0.06, z);
      }
    }
    for (let k = 0; k < n; k++) {
      const a = 2 * k, b = 2 * k + 1, cc = 2 * k + 2, d = 2 * k + 3;
      index.push(a, cc, b, b, cc, d);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setIndex(index);
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
      color: 0xb08d62, roughness: 1, metalness: 0, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
    }));
    mesh.receiveShadow = true;
    mesh.userData.segs = n;
    this.world.scene.add(mesh);
    return mesh;
  }
  reveal(lane, along) {
    const L = this.laneData[lane];
    const quads = clamp(Math.floor((along / this.len) * L.stripe.userData.segs), 0, L.stripe.userData.segs);
    if (quads > L.reveal) {
      L.reveal = quads;
      L.stripe.geometry.setDrawRange(0, quads * 6);
    }
  }
  resetBushes() {
    this.pushed = [];
    this.clock = 0;
    for (const b of this.bushes) {
      b.state = 'standing';
      b.tilt = 0;
      b.grow = 1;
      this.home(b, b.pos);
    }
    for (const L of this.laneData) {
      L.cleared = false;
      L.regrow = -1;
      L.reveal = 0;
      L.stripe.geometry.setDrawRange(0, 0);
      L.stripe.material.opacity = 1;
      L.spoilAmt = 0;
      L.spoil.visible = false;
    }
    this.draw();
  }
  reset() {
    super.reset();
    if (this.laneData) this.resetBushes();
  }
  update(dt) {
    super.update(dt);
    if (!this.laneData) return;
    this.clock += dt;
    const front = _v1.copy(this.pos).addScaledVector(this.face, 2.6);
    const L = this.laneData[this.lane];
    const heading = this.parts.g.rotation.y;
    if (this.phase === 'fwd') {
      const s = this.start(this.lane);
      const along = (front.x - s.x) * this.dir.x + (front.z - s.z) * this.dir.z;
      for (const b of L.bushes) {
        if ((b.state === 'standing' || b.state === 'growing') && along >= b.along - 0.4) {
          b.state = 'pushed';
          b.order = this.pushed.length;
          b.lat0 = b.lat;
          this.pushed.push(b);
        }
      }
      this.reveal(this.lane, along - 2.2);
      if (this.pushed.length && Math.random() < dt * 0.8) this.world.dust.puff(front.x, this.ground.at(front.x, front.z), front.z);
      // dirt builds up on the blade as it pushes, bushes or not
      const soil = this.parts.soil, amt = 0.3 + 0.7 * ease(this.progress ?? 0);
      soil.visible = true;
      soil.scale.set(amt, amt, 0.75 + 0.25 * amt);
    } else if (this.phase === 'turn') {
      // the blade lifts, and the dirt stays in a heap at the end of the lane
      if (this.parts.soil.visible) {
        this.parts.soil.visible = false;
        L.spoilAmt = Math.min(1.3, L.spoilAmt + 0.5);
        L.spoil.visible = true;
        L.spoil.scale.set(L.spoilAmt, 0.6 + 0.4 * L.spoilAmt, L.spoilAmt);
      }
      for (const b of this.pushed) {
        b.state = 'windrow';
        b.heading = heading;
      }
      this.pushed = [];
      if (!L.cleared && L.regrow < 0) {
        L.cleared = true;
        L.clearedAt = this.clock;
      }
    }
    for (const b of this.pushed) {
      b.tilt = Math.min(0.5, b.tilt + dt * 0.4);
      b.heading = heading;
      b.pos.copy(front).addScaledVector(this.face, 0.8 + 0.95 * b.order).addScaledVector(this.lat, b.lat0 * 0.55);
    }
    // lanes left well behind grow back: the windrow goes, then the scrub returns
    this.laneData.forEach((lane, i) => {
      if (lane.cleared && lane.regrow < 0 && this.clock - lane.clearedAt > 60 && Math.abs(i - this.lane) >= 3 && Math.abs(i - this.next) >= 3) lane.regrow = 0;
      if (lane.regrow < 0) return;
      lane.regrow += dt;
      const k = lane.regrow;
      if (k < 20) {
        for (const b of lane.bushes) {
          if (b.state === 'windrow' || b.state === 'shrinking') { b.state = 'shrinking'; b.grow = 1 - ease(k / 20); }
        }
        lane.stripe.material.opacity = 1 - k / 20;
        if (lane.spoilAmt > 0) {
          const f = Math.max(0.001, lane.spoilAmt * (1 - ease(k / 20)));
          lane.spoil.scale.set(f, 0.6 * f + 0.001, f);
        }
      } else {
        lane.spoilAmt = 0;
        lane.spoil.visible = false;
        if (lane.reveal) {
          lane.reveal = 0;
          lane.stripe.geometry.setDrawRange(0, 0);
          lane.stripe.material.opacity = 1;
        }
        for (const b of lane.bushes) {
          if (b.state !== 'growing') { b.state = 'growing'; b.tilt = 0; this.home(b, b.pos); }
          b.grow = ease(clamp((k - 20) / 30, 0, 1));
        }
        if (k >= 50) {
          for (const b of lane.bushes) { b.state = 'standing'; b.grow = 1; }
          lane.cleared = false;
          lane.regrow = -1;
        }
      }
    });
    this.draw();
  }
  draw() {
    const ground = this.ground;
    for (let i = 0; i < this.bushes.length; i++) {
      const b = this.bushes[i];
      let sy = 0.8, lift = 0.35, f = 1, col = BUSH_GREEN;
      if (b.state === 'growing') f = b.grow;
      else if (b.state === 'pushed') { sy = 0.7; lift = 0.4; }
      let sx = 1;
      if (b.state === 'windrow' || b.state === 'shrinking') { sx = 1.25; sy = 0.5; lift = 0.2; col = BUSH_DRY; if (b.state === 'shrinking') f = b.grow; }
      const s = Math.max(0.001, b.size * f);
      if (b.state === 'standing' || b.state === 'growing') _q.setFromAxisAngle(_up, b.yaw);
      else _q.setFromEuler(_e.set(0, b.heading, -b.tilt, 'YZX')).multiply(_q2.setFromAxisAngle(_up, b.yaw));
      _m4.compose(_p.set(b.pos.x, ground.at(b.pos.x, b.pos.z) + lift * s, b.pos.z), _q, _v2.set(s * b.stretch * sx, s * sy, s * sx));
      this.mesh.setMatrixAt(i, _m4);
      this.mesh.setColorAt(i, col);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}

// ---------- tipped material ----------
// A tipped load lands as pieces that tumble into a heap, which grows as they settle
const PILE_R = 2.9, PILE_H = 1.9;
const PILE_GEO = (() => {
  const pts = [];
  for (let i = 8; i >= 0; i--) {
    const u = i / 8;
    pts.push(new THREE.Vector2(Math.max(0.001, u * PILE_R), PILE_H * (1 - Math.pow(u, 1.35))));
  }
  return new THREE.LatheGeometry(pts, 12);
})();

class Pile {
  constructor(world, x, z) {
    this.world = world;
    this.x = x;
    this.z = z;
    this.n = 0;
    this.age = 0;
    this.base = world.ground.at(x, z) - 0.06;
    this.mesh = new THREE.Mesh(PILE_GEO, mat(COL.pile));
    this.mesh.position.set(x, this.base, z);
    this.mesh.rotation.y = Math.random() * 6.28;
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.scale.setScalar(0.001);
    world.scene.add(this.mesh);
  }
  add() {
    this.n++;
    this.resize();
  }
  resize() {
    const k = Math.cbrt(Math.min(1, this.n / SPILL_PER_LOAD));
    // after a couple of minutes the dozer has spread it out
    const flat = clamp((this.age - 120) / 480, 0, 1);
    this.mesh.scale.set(k * (1 + 0.6 * flat), Math.max(0.001, k * (1 - 0.85 * flat)), k * (1 + 0.6 * flat));
  }
  surfaceAt(x, z) {
    const g = this.world.ground.at(x, z);
    const R = PILE_R * this.mesh.scale.x, H = PILE_H * this.mesh.scale.y;
    const r = Math.hypot(x - this.x, z - this.z);
    if (R < 0.01 || r >= R) return g;
    return Math.max(g, this.base + H * (1 - Math.pow(r / R, 1.35)));
  }
}

const SPILL_GEO = new THREE.IcosahedronGeometry(SPILL_R, 0);
class Spill {
  constructor(world, cap = 3000) {
    this.world = world;
    this.cap = cap;
    this.mesh = new THREE.InstancedMesh(SPILL_GEO, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0, flatShading: true }), cap);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
    const shades = [0xb98f63, 0xc49a6c, 0xa97f55, 0xd2ad7c].map((c) => new THREE.Color(c));
    for (let i = 0; i < cap; i++) this.mesh.setColorAt(i, shades[i % shades.length]);
    this.pos = new Float32Array(cap * 3);
    this.vel = new Float32Array(cap * 3);
    this.state = new Uint8Array(cap);
    this.time = new Float32Array(cap);
    this.life = new Float32Array(cap);
    this.size = new Float32Array(cap);
    this.spin = new Float32Array(cap);
    this.floor = new Float32Array(cap);
    this.pile = new Array(cap).fill(null);
    this.free = [];
    this.live = [];
    world.scene.add(this.mesh);
    this.reset();
  }
  reset() {
    this.state.fill(0);
    this.pile.fill(null);
    this.free.length = 0;
    for (let i = this.cap - 1; i >= 0; i--) this.free.push(i);
    this.live.length = 0;
    for (let i = 0; i < this.cap; i++) this.mesh.setMatrixAt(i, ZERO);
    this.mesh.instanceMatrix.needsUpdate = true;
  }
  // A piece with a floor height is caught there (dropping into a truck); otherwise it lands on its heap or the ground
  emit(x, y, z, vx, vy, vz, pile = null, floor = NaN) {
    const i = this.free.pop();
    if (i === undefined) return;
    const o = i * 3;
    this.pos[o] = x; this.pos[o + 1] = y; this.pos[o + 2] = z;
    this.vel[o] = vx; this.vel[o + 1] = vy; this.vel[o + 2] = vz;
    this.state[i] = 1;
    this.time[i] = 0;
    this.life[i] = 6 + Math.random() * 6;
    this.size[i] = 0.7 + Math.random() * 0.6;
    this.spin[i] = Math.random() * 6.28;
    this.floor[i] = floor;
    this.pile[i] = pile;
    this.live.push(i);
  }
  kill(j, i) {
    this.state[i] = 0;
    this.pile[i] = null;
    this.live[j] = this.live[this.live.length - 1];
    this.live.pop();
    this.free.push(i);
    this.mesh.setMatrixAt(i, ZERO);
  }
  surface(i, x, z) {
    const p = this.pile[i];
    return p ? p.surfaceAt(x, z) : this.world.ground.at(x, z);
  }
  update(dt) {
    if (!this.live.length) return;
    const { pos, vel } = this;
    const n = Math.max(1, Math.ceil(dt / 0.04)), h = dt / n;
    for (let sub = 0; sub < n; sub++) {
      for (let j = this.live.length - 1; j >= 0; j--) {
        const i = this.live[j], o = i * 3;
        this.time[i] += h;
        const st = this.state[i];
        if (st === 1) {
          vel[o + 1] -= 9.8 * h;
          pos[o] += vel[o] * h;
          pos[o + 1] += vel[o + 1] * h;
          pos[o + 2] += vel[o + 2] * h;
          this.spin[i] += h * 5;
          if (!Number.isNaN(this.floor[i])) {
            if (pos[o + 1] < this.floor[i]) this.kill(j, i);
            continue;
          }
          const r = SPILL_R * this.size[i];
          const surf = this.surface(i, pos[o], pos[o + 2]);
          if (pos[o + 1] - r <= surf) {
            this.state[i] = 2;
            this.time[i] = 0;
            vel[o] *= 0.45;
            vel[o + 2] *= 0.45;
            pos[o + 1] = surf + r * 0.5;
            if (this.pile[i]) this.pile[i].add();
            if (Math.random() < 0.03) this.world.dust.puff(pos[o], surf, pos[o + 2]);
          }
        } else if (st === 2) {
          const damp = Math.max(0, 1 - 3 * h);
          vel[o] *= damp;
          vel[o + 2] *= damp;
          pos[o] += vel[o] * h;
          pos[o + 2] += vel[o + 2] * h;
          pos[o + 1] = this.surface(i, pos[o], pos[o + 2]) + 0.5 * SPILL_R * this.size[i];
          this.spin[i] += h * 2;
          if (this.time[i] > 0.6) { this.state[i] = 3; this.time[i] = 0; }
        } else if (st === 3) {
          if (this.time[i] > this.life[i]) { this.state[i] = 4; this.time[i] = 0; }
        } else if (this.time[i] > 1) {
          this.kill(j, i);
        }
      }
    }
    for (const i of this.live) {
      const o = i * 3;
      const s = this.size[i] * (this.state[i] === 4 ? Math.max(0, 1 - this.time[i]) : 1);
      _m4.compose(_p.set(pos[o], pos[o + 1], pos[o + 2]), _q.setFromEuler(_e.set(this.spin[i] * 0.7, this.spin[i], 0)), _v1.set(s, s * 0.8, s));
      this.mesh.setMatrixAt(i, _m4);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

// Dust thrown up where the load hits the ground
const DUST_GEO = new THREE.IcosahedronGeometry(1, 1);
class Dust {
  constructor(scene, n = 20) {
    this.items = [];
    this.next = 0;
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(DUST_GEO, new THREE.MeshLambertMaterial({ color: 0xd9c7a2, transparent: true, opacity: 0, depthWrite: false }));
      m.visible = false;
      m.renderOrder = 2;
      scene.add(m);
      this.items.push({ m, t: 0, dur: 1, s0: 1, s1: 2 });
    }
  }
  reset() {
    for (const it of this.items) it.m.visible = false;
  }
  puff(x, y, z) {
    const it = this.items[this.next];
    this.next = (this.next + 1) % this.items.length;
    it.m.position.set(x + (Math.random() - 0.5), y + 0.3, z + (Math.random() - 0.5));
    it.t = 0;
    it.dur = 2.4 + Math.random();
    it.s0 = 0.5;
    it.s1 = 2.2 + Math.random();
    it.m.visible = true;
  }
  update(dt) {
    for (const it of this.items) {
      if (!it.m.visible) continue;
      it.t += dt;
      const k = it.t / it.dur;
      if (k >= 1) { it.m.visible = false; continue; }
      it.m.scale.setScalar(it.s0 + (it.s1 - it.s0) * (1 - (1 - k) * (1 - k)));
      it.m.position.y += dt * 0.35;
      it.m.material.opacity = 0.3 * (1 - k) * (1 - k);
    }
  }
}

// Dust off a dry haul road: soft clouds thrown up behind trucks going quickly. They billow out, hang in
// the air and drift on the breeze, then thin out and clear. Drawn as camera-facing soft discs in one batch.
const PUFF_VS = `
attribute vec4 puff;
attribute float alpha;
varying vec2 vUv;
varying float vAlpha;
#include <fog_pars_vertex>
void main() {
  vUv = uv;
  vAlpha = alpha;
  vec4 mvPosition = modelViewMatrix * vec4(puff.xyz, 1.0);
  mvPosition.xy += position.xy * puff.w;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;
const PUFF_FS = `
uniform vec3 color;
varying vec2 vUv;
varying float vAlpha;
#include <fog_pars_fragment>
void main() {
  vec2 d = vUv - 0.5;
  float r2 = dot(d, d) * 4.0;
  if (r2 >= 1.0) discard;
  float a = vAlpha * (1.0 - r2) * (1.0 - r2);
  if (a < 0.002) discard;
  gl_FragColor = vec4(color * (0.85 + 0.3 * vUv.y), a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;
const WIND = [0.45, 0.3]; // a light breeze (m/s, x and z)
class TrailDust {
  constructor(world, n = 1400) {
    this.ground = world.ground;
    this.n = n;
    this.next = 0;
    const base = new THREE.PlaneGeometry(1, 1);
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = base.index;
    geo.setAttribute('position', base.getAttribute('position'));
    geo.setAttribute('uv', base.getAttribute('uv'));
    this.puff = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.alpha = new THREE.InstancedBufferAttribute(new Float32Array(n), 1).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('puff', this.puff);
    geo.setAttribute('alpha', this.alpha);
    geo.instanceCount = n;
    const m = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { color: { value: new THREE.Color(0xece3d0) } }]),
      vertexShader: PUFF_VS,
      fragmentShader: PUFF_FS,
      transparent: true,
      depthWrite: false,
      fog: true,
    });
    this.mesh = new THREE.Mesh(geo, m);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 3;
    world.scene.add(this.mesh);
    // each puff: where it is, its drift, its age and life (life 0 = not in use), its sizes and thickness
    this.p = new Float32Array(n * 3);
    this.v = new Float32Array(n * 3);
    this.age = new Float32Array(n);
    this.life = new Float32Array(n);
    this.s0 = new Float32Array(n);
    this.s1 = new Float32Array(n);
    this.peak = new Float32Array(n);
  }
  reset() {
    this.life.fill(0);
    this.alpha.array.fill(0);
    this.puff.array.fill(0);
    this.puff.needsUpdate = true;
    this.alpha.needsUpdate = true;
  }
  // a puff off the back wheels of truck g going at speed v; k from 0 (a little) to 1 (a lot)
  emit(g, v, k) {
    const i = this.next;
    this.next = (this.next + 1) % this.n;
    const h = g.rotation.y, fx = Math.cos(h), fz = -Math.sin(h);
    const side = (Math.random() - 0.5) * 2.8;
    this.p[i * 3] = g.position.x - fx * 4.3 - fz * side;
    this.p[i * 3 + 1] = g.position.y + 0.6;
    this.p[i * 3 + 2] = g.position.z - fz * 4.3 + fx * side;
    // dragged along behind the truck a little, and thrown out to the sides and up
    this.v[i * 3] = fx * v * 0.22 + (Math.random() - 0.5) * 1.2;
    this.v[i * 3 + 1] = 0.3 + Math.random() * 0.4;
    this.v[i * 3 + 2] = fz * v * 0.22 + (Math.random() - 0.5) * 1.2;
    this.age[i] = 0;
    this.life[i] = 20 + Math.random() * 12;
    this.s0[i] = 3 + Math.random() * 1.5;
    this.s1[i] = 9 + 6 * k + Math.random() * 4;
    this.peak[i] = 0.1 + 0.22 * k;
  }
  update(dt) {
    const { p, v, age, life, s0, s1, peak, n } = this;
    const P = this.puff.array, A = this.alpha.array;
    const drag = Math.exp(-dt * 0.6);
    for (let i = 0; i < n; i++) {
      if (life[i] === 0) continue;
      age[i] += dt;
      const k = age[i] / life[i];
      if (k >= 1) {
        life[i] = 0;
        A[i] = 0;
        P[i * 4 + 3] = 0;
        continue;
      }
      const j = i * 3;
      v[j] *= drag;
      v[j + 1] *= drag;
      v[j + 2] *= drag;
      p[j] += (v[j] + WIND[0]) * dt;
      p[j + 1] += (v[j + 1] + 0.05) * dt;
      p[j + 2] += (v[j + 2] + WIND[1]) * dt;
      // billows out quickly, then spreads slowly
      const size = s0[i] + (s1[i] - s0[i]) * (1 - (1 - k) * (1 - k));
      // the cloud sits on the ground and grows up from it, rather than sinking into it
      const floor = this.ground.at(p[j], p[j + 2]) + size * 0.3;
      if (p[j + 1] < floor) p[j + 1] = floor;
      P[i * 4] = p[j];
      P[i * 4 + 1] = p[j + 1];
      P[i * 4 + 2] = p[j + 2];
      P[i * 4 + 3] = size;
      // thickens fast, hangs in the air, then thins out and clears
      A[i] = peak[i] * Math.min(1, k / 0.04) * (1 - ease(clamp((k - 0.2) / 0.8, 0, 1)));
    }
    this.puff.needsUpdate = true;
    this.alpha.needsUpdate = true;
  }
}

// ---------- simulation ----------
class Sim {
  constructor(world) {
    this.world = world;
    this.trucks = [];
    this.piles = [];
    this.tmp = new THREE.Vector3();
    this.tmp2 = new THREE.Vector3();
    this.tmp3 = new THREE.Vector3();
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
    // m³ taken out of the cut (or stockpile), and m³ tipped at the fill
    this.taken = 0;
    this.placed = 0;
    this.dumpN = 0;
    this.world.spill.reset();
    this.world.dust.reset();
    this.world.trail?.reset();
    this.world.loader.reset();
    for (const s of this.world.support) s.reset();
    const L = this.road.L;
    for (let k = 0; k < count; k++) {
      const parts = makeTruck();
      if (this.world.night) addHeadlights(parts);
      scene.add(parts.g);
      const t = { parts, rate: RATES.truck, cost: 0, id: `DT-${String(k + 1).padStart(2, '0')}`, s: L - 2 - GAP * 1.3 * k, v: 0, a: 0, vlim: SPEED.empty, gap: GAP, dustAcc: 0, state: 'toLoad', phase: null, load: 0, tip: 0, last: null, dumpS: this.world.sDump };
      this.trucks.push(t);
      this.pose(t, 0);
      this.dress(t);
    }
    for (let i = 0; i < 480; i++) this.step(0.5);
  }

  // Each load tips a few metres along from the last, so the heaps spread along the edge
  loaded(t) {
    t.state = 'hauling';
    const L = this.road.L;
    t.dumpS = (this.world.sDump + ((this.dumpN++ % 5) - 2) * 3 + L) % L;
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
    const L = road.L;
    this.time += dt;
    world.loader.update(dt);
    for (const s of world.support) s.update(dt);

    for (const t of this.trucks) {
      // Distance to the truck in front, and which truck that is
      let ahead = Infinity, front = null;
      for (const o of this.trucks) {
        if (o === t) continue;
        const d = (o.s - t.s + L) % L;
        if (d > 0.01 && d < ahead) { ahead = d; front = o; }
      }
      if (t.state === 'loading') {
        this.dress(t);
        t.parts.brakeMat.emissiveIntensity = 1.6;
        burn(t, 7, dt);
        continue;
      }
      if (t.state === 'tipping') {
        this.tipping(t, dt);
        const moving = (t.phase === 'in' || t.phase === 'out') && t.tip < (t.phase === 'in' ? TIP.in : TIP.out) * 0.85;
        t.parts.brakeMat.emissiveIntensity = moving ? 0.3 : 1.6;
        // manoeuvring, then the hoist working to raise the body
        burn(t, t.phase === 'raise' ? 19 : moving ? 13 : 8, dt);
        continue;
      }

      // Stay well back from a truck that is about to turn into the tip, or is tipping
      const nearTip = front && (front.state === 'tipping' || (front.state === 'hauling' && (front.dumpS - front.s + L) % L < 40));
      t.gap += clamp((nearTip ? GAP_TIP : GAP) - t.gap, -2 * dt, 2 * dt);
      const target = t.state === 'hauling' ? (t.dumpS - t.s + L) % L : (L - t.s) % L;
      // the speed for the road: slower loaded, slower up a grade, and careful coming down one
      const loaded = t.state === 'hauling';
      const g = t.grade || 0;
      let vlim = loaded ? SPEED.loaded : SPEED.empty;
      if (loaded && g > 0) vlim *= clamp(1 - g * 7, 0.3, 1);
      else vlim *= clamp(1 - Math.abs(g) * 3, 0.55, 1);
      t.vlim = t.vlim + (vlim - t.vlim) * Math.min(1, dt / 3);
      // the intelligent driver model: speed up towards the speed for the road, and slow for whatever is ahead
      const amax = (loaded ? DRIVE.accel.loaded : DRIVE.accel.empty) * clamp(1 - Math.max(0, g) * 4, 0.4, 1);
      const v = t.v;
      let a = v <= t.vlim ? amax * (1 - (v / t.vlim) ** 4) : -Math.min(0.5, (v - t.vlim) * 0.4);
      const k2 = 2 * Math.sqrt(amax * DRIVE.brake);
      const closing = (s, s0, dv) => amax * ((s0 + Math.max(0, v * DRIVE.headway + (v * dv) / k2)) / Math.max(s, 0.05)) ** 2;
      let slow = closing(target + 0.3, 0, v);
      if (front) slow = Math.max(slow, closing(ahead - DRIVE.length, t.gap - DRIVE.length, v - front.v));
      a = clamp(a - slow, -3, amax);
      t.a += clamp(a - t.a, -DRIVE.jerk * 2.5 * dt, DRIVE.jerk * dt);
      let vNew = v + t.a * dt;
      if (vNew < 0) {
        vNew = 0;
        t.a = Math.max(t.a, 0);
      }
      let ds = ((v + vNew) / 2) * dt;
      // never past the stopping point, and never closer than 11 m to the truck in front
      const room = Math.max(0, Math.min(target, ahead - 11));
      if (ds > room) {
        ds = room;
        vNew = Math.min(vNew, room / dt);
        t.a = Math.min(t.a, 0);
      }
      t.v = vNew;
      // fuel follows the power at the wheels: climbing loaded is the heaviest, coasting downhill the lightest
      const kw = (loaded ? 42 : 24) * t.v * (t.a + 9.81 * (g + 0.03));
      burn(t, t.v < 0.05 ? 7 : kw > 0 ? Math.min(85, 7 + 0.42 * kw) : 4.5, dt);
      // brake lights: braking, not just easing off, or standing
      t.parts.brakeMat.emissiveIntensity = t.a < -0.12 || t.v < 0.05 ? 1.6 : 0.3;
      t.s = (t.s + ds) % L;
      this.pose(t, ds);
      this.dress(t);
      // dust off the road behind a truck going quickly
      if (world.trail && t.v > 4) {
        t.dustAcc += ds;
        while (t.dustAcc > 1.5) {
          t.dustAcc -= 1.5;
          world.trail.emit(t.parts.g, t.v, clamp((t.v - 4) / 4, 0, 1));
        }
      }

      const left = t.state === 'hauling' ? (t.dumpS - t.s + L) % L : (L - t.s) % L;
      if (left < 0.15 || left > L - 0.6) {
        if (t.state === 'hauling') {
          this.startTip(t);
        } else if (t.state === 'toLoad' && !world.loader.truck) {
          t.s = 0;
          t.v = 0;
          t.a = 0;
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
    for (const m of [world.loader, ...world.support, ...this.trucks]) speedo(m, dt);
    world.spill.update(dt);
    world.dust.update(dt);
    world.trail?.update(dt);
    this.agePiles(dt);
    if (world.night) this.updateNight(dt);
  }

  // High beam on an empty road; dipped when anyone is in front, and at the loader and the tip
  updateNight(dt) {
    const w = this.world;
    const others = [w.loader.parts.g.position, ...w.support.map((s) => s.parts.g.position)];
    for (const t of this.trucks) {
      const h = t.parts.head;
      if (!h) continue;
      const g = t.parts.g;
      const fx = Math.cos(g.rotation.y), fz = -Math.sin(g.rotation.y);
      let near = false;
      // someone in the beam: a truck up to 55 m ahead, or a machine up to 40 m ahead
      const look = (q, range) => {
        const dx = q.x - g.position.x, dz = q.z - g.position.z, d = Math.hypot(dx, dz);
        if (d > 1 && d < range && dx * fx + dz * fz > 0.8 * d) near = true;
      };
      for (const o of this.trucks) if (o !== t) look(o.parts.g.position, 55);
      for (const q of others) look(q, 40);
      const want = (t.state === 'hauling' || t.state === 'toLoad') && !near ? 1 : 0;
      h.beam = clamp(h.beam + clamp(want - h.beam, -dt * 2.5, dt * 2.5), 0, 1);
      const b = h.beam;
      h.spot.intensity = lerp(500, 3200, b);
      h.spot.distance = lerp(42, 110, b);
      h.spot.angle = lerp(0.5, 0.36, b);
      h.spot.target.position.set(lerp(18, 60, b), lerp(-1.6, 0.4, b), 0);
      for (const s of h.glows) {
        if (!s) continue;
        s.scale.setScalar(lerp(1.1, 2.6, b));
        s.material.opacity = lerp(0.55, 0.95, b);
      }
    }
    w.delineators.shine(this.trucks);
  }

  // The load sits full length while it's carried, then shrinks back towards the open end as it slides out
  dress(t) {
    const { heap } = t.parts;
    heap.visible = t.load > 0.01;
    if (t.state === 'tipping') {
      heap.scale.set(Math.max(0.12, t.load), Math.max(0.05, Math.sqrt(t.load)), 1);
    } else {
      heap.scale.set(1, Math.max(0.001, t.load), 1);
    }
    heap.position.x = 0.25 + 2.95 * heap.scale.x;
  }

  startTip(t) {
    const g = t.parts.g;
    const h = g.rotation.y;
    const d = new THREE.Vector3(Math.cos(h), 0, -Math.sin(h));
    t.man = { p0: g.position.clone(), pitch0: g.rotation.z, d, l: new THREE.Vector3(d.z, 0, -d.x), prev: g.position.clone() };
    t.state = 'tipping';
    t.phase = 'in';
    t.tip = 0;
    t.v = 0;
    t.a = 0;
    t.emitted = 0;
    t.emitAcc = 0;
    t.piles = [];
  }

  // u = 0: on the road. u = 1: backed round a quarter turn into the tip head, tail to the fill
  manPose(t, u) {
    const { p0, d, l, pitch0, prev } = t.man;
    const th = -Math.PI / 2 - u * Math.PI / 2;
    const cx = p0.x + TURN_R * l.x, cz = p0.z + TURN_R * l.z;
    const x = cx + TURN_R * (Math.cos(th) * d.x + Math.sin(th) * l.x);
    const z = cz + TURN_R * (Math.cos(th) * d.z + Math.sin(th) * l.z);
    const a = u * Math.PI / 2;
    const fx = Math.cos(a) * d.x - Math.sin(a) * l.x, fz = Math.cos(a) * d.z - Math.sin(a) * l.z;
    const ground = this.world.ground;
    const blend = clamp(u * 2.5, 0, 1);
    const hf = ground.at(x + fx * 3, z + fz * 3), hb = ground.at(x - fx * 3, z - fz * 3);
    const g = t.parts.g;
    g.position.set(x, lerp(p0.y, ground.at(x, z), blend), z);
    g.rotation.y = Math.atan2(-fz, fx);
    g.rotation.z = lerp(pitch0, Math.atan2(hf - hb, 6), blend);
    const moved = Math.hypot(x - prev.x, z - prev.z);
    prev.set(x, 0, z);
    return moved;
  }

  tipping(t, dt) {
    const { tray, wheels } = t.parts;
    const spin = (moved, dir) => { for (const w of wheels) w.rotation.z -= dir * moved / 0.85; };
    t.tip += dt;
    if (t.phase === 'in') {
      const k = clamp(t.tip / TIP.in, 0, 1);
      spin(this.manPose(t, ease(k)), -1);
      t.reversing = k < 0.98;
      if (k >= 1) { t.phase = 'settle'; t.tip = 0; t.reversing = false; }
    } else if (t.phase === 'settle') {
      if (t.tip >= TIP.settle) { t.phase = 'raise'; t.tip = 0; }
    } else if (t.phase === 'raise') {
      tray.rotation.z = 0.95 * ease(clamp(t.tip / TIP.raise, 0, 1));
      this.flowOut(t, dt);
      // creep forward as the load comes out, so it spreads instead of building up under the body
      spin(this.manPose(t, 1 - 0.27 * ease(t.emitted / SPILL_PER_LOAD)), 1);
      if (t.emitted >= SPILL_PER_LOAD && t.tip >= TIP.raise) { t.phase = 'hold'; t.tip = 0; }
    } else if (t.phase === 'hold') {
      if (t.tip >= TIP.hold) { t.phase = 'lower'; t.tip = 0; }
    } else if (t.phase === 'lower') {
      tray.rotation.z = 0.95 * (1 - ease(clamp(t.tip / TIP.lower, 0, 1)));
      if (t.tip >= TIP.lower) { tray.rotation.z = 0; t.phase = 'out'; t.tip = 0; }
    } else if (t.phase === 'out') {
      const k = clamp(t.tip / TIP.out, 0, 1);
      spin(this.manPose(t, 0.73 * (1 - ease(k))), 1);
      if (k >= 1) {
        t.phase = null;
        t.state = 'toLoad';
        t.load = 0;
        this.pose(t, 0);
      }
    }
    this.dress(t);
    this.updateStream(t);
    const flowing = t.parts.stream.visible;
    t.gateOpen = clamp((t.gateOpen || 0) + (flowing ? 1.5 : -1.2) * dt, 0, 1);
    t.parts.gate.rotation.z = t.state === 'tipping' ? -(tray.rotation.z + 0.4 * ease(t.gateOpen)) : 0;
    // hoist ram: from the chassis to under the body
    const a = tray.rotation.z;
    t.parts.ram.set(-1.2, 1.35, -4.4 + 2.9 * Math.cos(a) + 0.02 * Math.sin(a), 1.7 + 2.9 * Math.sin(a) - 0.02 * Math.cos(a));
  }

  // Once the body is steep enough the load slides out of the open back, a little faster the steeper it gets
  flowOut(t, dt) {
    const { tray, g } = t.parts;
    const a = tray.rotation.z;
    if (a < 0.3 || t.emitted >= SPILL_PER_LOAD) return;
    t.emitAcc += (SPILL_PER_LOAD / 8) * clamp((a - 0.3) / 0.45, 0.3, 1.3) * dt;
    if (t.emitAcc < 1) return;
    g.updateMatrixWorld(true);
    const out = this.tmp.set(-1, 0, 0).transformDirection(tray.matrixWorld);
    const across = this.tmp2.set(0, 0, 1).transformDirection(tray.matrixWorld);
    const ground = this.world.ground;
    while (t.emitAcc >= 1 && t.emitted < SPILL_PER_LOAD) {
      t.emitAcc -= 1;
      t.emitted++;
      this.placed += PAYLOAD / SPILL_PER_LOAD;
      const lip = this.tmp3.set(0.05 + Math.random() * 0.4, 0.25 + Math.random() * 0.5, (Math.random() - 0.5) * 2.5).applyMatrix4(tray.matrixWorld);
      const sp = 1.0 + Math.random() * 1.2, side = (Math.random() - 0.5) * 0.9;
      const vx = out.x * sp + across.x * side, vy = out.y * sp + (Math.random() - 0.5) * 0.3, vz = out.z * sp + across.z * side;
      // where it will come down, so it builds the right heap
      const drop = Math.max(0, lip.y - ground.at(lip.x, lip.z));
      const fall = (vy + Math.sqrt(vy * vy + 2 * 9.8 * drop)) / 9.8;
      const pile = this.pileFor(t, lip.x + vx * fall, lip.z + vz * fall);
      this.world.spill.emit(lip.x, lip.y, lip.z, vx, vy, vz, pile);
    }
    t.load = 1 - t.emitted / SPILL_PER_LOAD;
  }

  // The falling sheet of material, from the open back of the body down to the heap
  updateStream(t) {
    const { tray, stream, g } = t.parts;
    const a = tray.rotation.z;
    const flowing = t.phase === 'raise' && a >= 0.3 && t.emitted < SPILL_PER_LOAD;
    stream.visible = flowing;
    if (!flowing) return;
    const ca = Math.cos(a), sa = Math.sin(a);
    const lx = -4.4 + 0.1 * ca - 0.45 * sa, ly = 1.7 + 0.1 * sa + 0.45 * ca;
    g.updateMatrixWorld(true);
    const land = g.localToWorld(this.tmp.set(lx - 1.0, 0, 0));
    const pile = t.piles[t.piles.length - 1];
    land.y = pile ? pile.surfaceAt(land.x, land.z) : this.world.ground.at(land.x, land.z);
    g.worldToLocal(land);
    const dx = land.x - lx, dy = land.y - ly;
    const f = clamp((a - 0.3) / 0.45, 0.3, 1.3);
    stream.position.set((lx + land.x) / 2, (ly + land.y) / 2, 0);
    stream.rotation.set(0, 0, Math.atan2(dy, dx));
    stream.scale.set(Math.hypot(dx, dy), 0.22 + 0.12 * f, 1.6 + 0.6 * f);
  }

  // Up to three heaps per load, as the truck creeps forward while it empties
  pileFor(t, x, z) {
    let best = null, bd = Infinity;
    for (const p of t.piles) {
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < bd) { bd = d; best = p; }
    }
    if (best && (bd < 1.8 || t.piles.length >= 3)) return best;
    const p = new Pile(this.world, x, z);
    t.piles.push(p);
    this.piles.push(p);
    if (this.piles.length > 60) this.world.scene.remove(this.piles.shift().mesh);
    if (t.piles.length === 1) this.loads++;
    return p;
  }

  agePiles(dt) {
    for (const p of this.piles) {
      p.age += dt;
      if (p.age > 120) p.resize();
    }
    while (this.piles.length && this.piles[0].age > 900) this.world.scene.remove(this.piles.shift().mesh);
  }
}

// ---------- night shift ----------
const TOWER_LAMP = new THREE.MeshStandardMaterial({ color: 0xfffbea, emissive: 0xfff3d6, emissiveIntensity: 2.2, roughness: 0.3, flatShading: true });
const REFL_RED = new THREE.Color(0xe0352a), REFL_WHITE = new THREE.Color(0xf4f4f0), _c = new THREE.Color();

function addGlow(parent, x, y, z, size, color = 0xffe2b0, opacity = 0.8) {
  const tex = glowTexture();
  if (!tex) return null;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }));
  s.position.set(x, y, z);
  s.scale.setScalar(size);
  parent.add(s);
  return s;
}

function addStars(scene) {
  const rand = rng(77);
  const n = 420, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const u = rand() * Math.PI * 2, el = Math.asin(0.06 + rand() * 0.9), r = 1500;
    pos[i * 3] = r * Math.cos(el) * Math.cos(u);
    pos[i * 3 + 1] = r * Math.sin(el);
    pos[i * 3 + 2] = r * Math.cos(el) * Math.sin(u);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  scene.add(new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xdfe6ff, size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.85 })));
}

// Lighting plant: a trailer with a generator, a mast and a bar of lamps aimed at a work area
function addLightTower(world, [x, z], [ax, az]) {
  const { scene, ground } = world;
  const g = new THREE.Group();
  g.position.set(x, ground.at(x, z), z);
  g.rotation.y = Math.atan2(-(az - z), ax - x);
  const k = new Kit();
  k.box(3.6, 0.16, 1.2, COL.dark, -0.3, 0.5, 0);
  k.box(1.5, 0.08, 0.1, COL.dark, -2.6, 0.5, 0);
  k.box(2.4, 1.1, 1.3, COL.orange, -0.5, 1.15, 0);
  k.box(2.5, 0.08, 1.38, COL.orange2, -0.5, 1.74, 0);
  for (const x2 of [1.15, -1.75]) {
    k.box(0.1, 0.1, 3.2, COL.dark, x2, 0.2, 0);
    for (const s of [1, -1]) k.box(0.18, 0.06, 0.18, COL.dark, x2, 0.03, s * 1.55);
  }
  k.box(0.2, 8.2, 0.2, COL.grey, 0.75, 5.8, 0);
  k.box(0.14, 0.14, 2.3, COL.dark, 0.8, 9.85, 0);
  for (const zz of [-0.84, -0.28, 0.28, 0.84]) {
    k.box(0.32, 0.46, 0.46, COL.dark, 0.95, 9.6, zz, 0, 0, -0.45);
    k.box(0.04, 0.38, 0.38, TOWER_LAMP, 1.12, 9.53, zz, 0, 0, -0.45);
  }
  k.build(g);
  makeAxle(g, -0.4, 0.42, 0.42, 0.28, [-0.7, 0.7]);
  scene.add(g);
  addGlow(g, 1.3, 9.45, 0, 5.5, 0xfff0cc, 0.75);
  const spot = new THREE.SpotLight(0xfff1d8, 1500, 95, 0.86, 0.7, 2);
  spot.position.set(x + Math.cos(g.rotation.y) * 1.1, g.position.y + 9.5, z - Math.sin(g.rotation.y) * 1.1);
  spot.target.position.set(ax, ground.at(ax, az), az);
  scene.add(spot, spot.target);
}

// Headlights: one beam per truck, dipped or on high beam, with a glow at each lamp
function addHeadlights(parts) {
  const spot = new THREE.SpotLight(0xfff0d4, 0, 40, 0.45, 0.5, 2);
  spot.position.set(4.6, 1.75, 0);
  spot.target.position.set(20, -1.5, 0);
  parts.g.add(spot, spot.target);
  const glows = [0.98, -0.98].map((z) => addGlow(parts.g, 4.5, 1.72, z, 1.2, 0xfff2d0, 0.6));
  parts.head = { spot, glows, beam: 0 };
}

// The loader's work lights at night: a beam ahead and a glow at each roof lamp
function addLoaderLights(parts) {
  const spot = new THREE.SpotLight(0xfff0d4, 900, 45, 0.7, 0.6, 2);
  spot.position.set(0.4, 3.85, 0);
  spot.target.position.set(9, 0, 0);
  parts.g.add(spot, spot.target);
  for (const z of [0.62, -0.62]) addGlow(parts.g, 0.42, 3.84, z, 1.0, 0xfff2d0, 0.7);
}


// Guide posts along both edges of the haul road, as AS 1742.2 sets them out: a driver sees red reflectors
// on the left and white on the right, and the back of each post carries the other colour, as on a
// two-way road. They're left out where the loader works and where trucks back into the tip. At night a
// reflector shines back when a headlight falls on its face.
const POST_GEO = new THREE.BoxGeometry(0.12, 1.15, 0.12).translate(0, 0.575, 0);
const REFL_GEO = new THREE.BoxGeometry(0.03, 0.2, 0.1);
class Delineators {
  constructor(world) {
    const { road, def, ground, scene } = world;
    const L = road.L, half = def.roadWidth / 2 + 0.9;
    const near = (s, c, before, after) => {
      const d = (((s - c) % L) + L) % L;
      return d <= after || d >= L - before;
    };
    this.items = [];
    for (let i = 0; i < road.N; i += 10) {
      const s = i * road.ds;
      const p = road.P[i], q = road.P[(i + 1) % road.N], o = road.P[(i - 1 + road.N) % road.N];
      const dx = q.x - o.x, dz = q.z - o.z, len = Math.hypot(dx, dz) || 1;
      const lx = dz / len, lz = -dx / len;
      for (const side of [1, -1]) {
        if (side === 1 && (near(s, 0, 30, 20) || near(s, world.sDump, 24, 16))) continue;
        const x = p.x + lx * half * side, z = p.z + lz * half * side;
        this.items.push({ x, y: ground.at(x, z), z, heading: Math.atan2(-dz, dx), fx: dx / len, fz: dz / len, red: side === 1 });
      }
    }
    const n = this.items.length;
    this.posts = new THREE.InstancedMesh(POST_GEO, mat(0xf0f0ea), n);
    // two reflectors on each post: the front one faces the trucks coming along the road, the back one the other way
    this.refl = new THREE.InstancedMesh(REFL_GEO, new THREE.MeshBasicMaterial({ color: 0xffffff }), n * 2);
    this.posts.castShadow = true;
    this.posts.receiveShadow = true;
    this.night = world.night;
    this.items.forEach((it, i) => {
      _q.setFromAxisAngle(_up, it.heading);
      _m4.compose(_p.set(it.x, it.y - 0.05, it.z), _q, _one);
      this.posts.setMatrixAt(i, _m4);
      for (const back of [0, 1]) {
        const o = back ? 0.075 : -0.075;
        _m4.compose(_p.set(it.x + it.fx * o, it.y + 0.92, it.z + it.fz * o), _q, _one);
        this.refl.setMatrixAt(i * 2 + back, _m4);
        _c.copy(this.tint(it, back)).multiplyScalar(this.night ? 0.08 : 1);
        this.refl.setColorAt(i * 2 + back, _c);
      }
    });
    scene.add(this.posts, this.refl);
  }
  // red facing the drivers it's on the left of, white facing the drivers it's on the right of
  tint(it, back) {
    return it.red !== Boolean(back) ? REFL_RED : REFL_WHITE;
  }
  // reflectors shine back when a headlight falls on them
  shine(trucks) {
    if (!this.night) return;
    const heads = [];
    for (const t of trucks) {
      if (!t.parts.head) continue;
      const g = t.parts.g;
      heads.push({ x: g.position.x, z: g.position.z, fx: Math.cos(g.rotation.y), fz: -Math.sin(g.rotation.y), reach: lerp(45, 120, t.parts.head.beam) });
    }
    const lit = [0, 0];
    this.items.forEach((it, i) => {
      lit[0] = lit[1] = 0;
      for (const h of heads) {
        const dx = it.x - h.x, dz = it.z - h.z, d = Math.hypot(dx, dz);
        if (d < 2 || d > h.reach) continue;
        // in the beam, and which face the light falls on: the front if the truck is coming along the road to it
        const c = (dx * h.fx + dz * h.fz) / d;
        if (c < 0.82) continue;
        const v = ((c - 0.82) / 0.18) * Math.sqrt(1 - d / h.reach);
        const k = (dx * it.fx + dz * it.fz) / d;
        if (k > 0) lit[0] = Math.max(lit[0], v * k);
        else lit[1] = Math.max(lit[1], -v * k);
      }
      for (const back of [0, 1]) {
        _c.copy(this.tint(it, back)).multiplyScalar(0.08 + 1.1 * Math.min(1, lit[back] * 1.6));
        this.refl.setColorAt(i * 2 + back, _c);
      }
    });
    this.refl.instanceColor.needsUpdate = true;
  }
}

// ---------- the example jobs ----------
const LOAD_OUT = {
  id: 'load-out',
  aria: 'Example 3D model of a stockpile load-out on night shift: under lighting towers, a wheel loader loads trucks from a stockpile, the trucks haul with their headlights along a road marked with guide posts to an embankment where a roller works, and a dozer clears scrub nearby.',
  night: true,
  startHour: 19,
  towers: [
    { pos: [-98, -53], aim: [-105, -24] },
    { pos: [140, -10], aim: [162, -10] },
    { pos: [110, 32], aim: [112, 11] },
    { pos: [35, -18], aim: [35, -40] },
  ],
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
  // a stockpile of about 10,000 m³: 100 m long, 9 m high, 9 m deep at the loading end and 40 m at the far end
  loader: { type: 'wheel', pile: { right: 7.9, back: 6.5, r: 5.4, length: 101, near: 9, far: 40, height: 9 } },
  areas: { source: { name: 'Stockpile', at: 'pile', start: 'pile' }, fill: { name: 'Fill', at: [170, -21] } },
  support: [
    { type: 'clear', a: [22, -26], b: [22, -52], step: [4.5, 0], lanes: 7 },
    { type: 'roller', a: [80, 11], b: [150, 11], step: [0, 0], lanes: 1 },
  ],
  stockpiles: [[-178, 16, 17, 8], [-135, 52, 12, 5.5]],
  sheds: [[-60, 70, 0.2], [-48, 76, 0.2]],
  views: {
    site: { t: [-20, 0, -4], o: [-100, 150, 220] },
    // the truck in front, the loader at the near end of the stockpile, and the stockpile running back behind
    load: { t: [-112, 2, -22], o: [36, 22, 34] },
    dump: { t: [160, 8, -9], o: [30, 17, -21] },
    clear: { t: [35, 4, -40], o: [24, 17, -26] },
  },
  avoid(x, z) {
    return rrDist(x, z, this.pad) < 18 || Math.hypot(x + 150, z + 10) < 82;
  },
};

const HILL = {
  id: 'hill',
  aria: 'Example 3D model of a haul up a hill: an excavator loads trucks in a cut, loaded trucks climb a grade to a spoil dump, and a dozer clears scrub nearby.',
  size: 900, seg: 150, roadWidth: 11, trucks: 4, passes: 4,
  // the cut runs along the excavator's right-hand side
  cut: { cx: -153.25, cz: -17.75, hx: 31.75, hz: 32.25, round: 5 },
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
  // on the bench at the corner of the cut, tracks towards the truck: it digs on its right and swings 90 degrees to load
  loader: { type: 'excavator', pos: [-118, 13.6], dig: [-125, 11], passTime: 28 },
  areas: { source: { name: 'Cut', at: [-131, 3], start: 10000 }, fill: { name: 'Fill', at: [166, -22] } },
  support: [
    { type: 'clear', a: [-40, -24], b: [-40, -50], step: [4.5, 0], lanes: 7 },
  ],
  stockpiles: [],
  sheds: [[-180, 62, 0], [-180, 74, 0]],
  views: {
    site: { t: [20, 10, 10], o: [-120, 160, 220] },
    // from behind the excavator: the truck in front of it, the cut on its right
    load: { t: [-122, 1, 15], o: [22, 21, -25] },
    dump: { t: [158, 36, -9], o: [30, 17, -21] },
    clear: { t: [-26, 10, -38], o: [24, 17, -26] },
  },
  avoid(x, z) {
    return rrDist(x, z, this.cut) < 12 || rrDist(x, z, this.pad) < 14;
  },
};

const JOBS = { hill: HILL, 'load-out': LOAD_OUT };

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
  const night = !!def.night;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(night ? COL.night : COL.sky);
  scene.fog = new THREE.Fog(night ? COL.night : COL.sky, night ? 240 : 520, night ? 950 : 1250);

  scene.add(new THREE.HemisphereLight(night ? 0x34466e : 0xf6f3ea, night ? 0x0c0b0b : 0x9c8664, night ? 0.95 : 1.5));
  const sun = new THREE.DirectionalLight(night ? 0xa3b6ff : 0xfff3df, night ? 0.6 : 2.4);
  sun.position.set(-170, 300, 150);
  sun.castShadow = !night;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -300, right: 300, top: 300, bottom: -300, near: 20, far: 900 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.8;
  scene.add(sun);
  scene.add(sun.target);

  const world = { def, scene, support: [], night };
  const ground = new Ground(def);
  world.ground = ground;
  const road = buildRoad(def, ground);
  world.road = road;
  world.sDump = road.nearestS(def.dump[0], def.dump[1]);
  scene.add(ground.mesh(def));
  scene.add(road.mesh);
  world.delineators = new Delineators(world);
  if (night) {
    addStars(scene);
    for (const tw of def.towers) addLightTower(world, tw.pos, tw.aim);
  }

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
  const bushes = new THREE.InstancedMesh(BUSH_GEO, mat(COL.bush), 420);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3();
  let count = 0;
  for (let tries = 0; tries < 4000 && count < 420; tries++) {
    const x = (rand() - 0.5) * 820, z = (rand() - 0.5) * 820;
    if (def.avoid(x, z) || inClearing(def, x, z)) continue;
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

  world.spill = new Spill(world);
  world.dust = new Dust(scene);
  // on a dry day shift the trucks raise dust; at night it's left out
  world.trail = night ? null : new TrailDust(world);
  world.sim = new Sim(world);
  world.loader = def.loader.type === 'wheel' ? new WheelLoaderRig(world, def.loader) : new ExcavatorRig(world, def.loader);
  world.support = def.support.map((s) => (s.type === 'clear' ? new ClearingRig(world, s) : new ShuttleRig(world, s)));
  const nums = {};
  for (const s of world.support) {
    const code = s.roller ? 'RL' : 'DZ';
    nums[code] = (nums[code] || 0) + 1;
    s.id = `${code}-${String(nums[code]).padStart(2, '0')}`;
  }
  // where the labels for the cut (or stockpile) and the fill sit
  const spot = (at) => {
    if (at === 'pile') return world.loader.pileTop.clone();
    return new THREE.Vector3(at[0], ground.at(at[0], at[1]) + 3, at[1]);
  };
  // the fill label stands over the newest heaps, so it follows where the material is going
  const fillAt = spot(def.areas.fill.at), heaps = new THREE.Vector3();
  const fillNow = () => {
    const piles = world.sim.piles, n = Math.min(6, piles.length);
    if (!n) return fillAt;
    heaps.set(0, 0, 0);
    for (let i = piles.length - n; i < piles.length; i++) heaps.x += piles[i].x / n, heaps.z += piles[i].z / n;
    return heaps.setY(ground.at(heaps.x, heaps.z) + 3.5);
  };
  const sourceAt = spot(def.areas.source.at);
  world.areas = [
    { kind: 'source', name: def.areas.source.name, start: def.areas.source.start === 'pile' ? Math.round(world.loader.pileVolume / 100) * 100 : def.areas.source.start, at: () => sourceAt },
    { kind: 'fill', name: def.areas.fill.name, at: fillNow },
  ];
  world.beacons = () => [world.loader.parts.beacon, ...world.support.map((s) => s.parts.beacon), ...world.sim.trucks.map((t) => t.parts.beacon)];
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
  let speed = reduce ? 0 : 10;
  let playing = speed > 0;

  const viewButtons = [...root.querySelectorAll('[data-view]')];
  const setPressed = (list, el) => list.forEach((b) => b.setAttribute('aria-pressed', String(b === el)));

  function viewTarget(name) {
    // narrow viewers (phones) see less from side to side, so the camera stands further back
    const k = clamp(1.7 / camera.aspect, 1, 1.6);
    if (name === 'follow') {
      const g = world.sim.trucks[0].parts.g;
      const dir = new THREE.Vector3(Math.cos(g.rotation.y), 0, -Math.sin(g.rotation.y));
      const t = g.position.clone().add(new THREE.Vector3(0, 2, 0));
      const side = new THREE.Vector3(dir.z, 0, -dir.x);
      return { t, p: t.clone().addScaledVector(dir, -24 * k).addScaledVector(side, -12 * k).add(new THREE.Vector3(0, 12 * k, 0)) };
    }
    const v = world.def.views[name];
    const t = new THREE.Vector3(...v.t);
    return { t, p: t.clone().addScaledVector(new THREE.Vector3(...v.o), k) };
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
    root.classList.toggle('is-night', world.night);
    tagsFor = null;
    truckOut.textContent = world.trucks;
    busyLabel.textContent = world.loader.label;
    setView('load', true);
    rebase();
    stats();
  }
  sceneButtons.forEach((b) => b.addEventListener('click', () => setJob(b.dataset.scene)));

  root.querySelectorAll('[data-trucks]').forEach((b) => b.addEventListener('click', () => {
    world.trucks = clamp(world.trucks + Number(b.dataset.trucks), 1, 8);
    truckOut.textContent = world.trucks;
    world.sim.reset(world.trucks);
    if (view === 'follow') setView('follow');
    rebase();
    stats();
  }));

  // pause, play (10 times real speed) and fast forward (30 times)
  const speedButtons = [...root.querySelectorAll('[data-speed]')];
  const syncSpeed = () => setPressed(speedButtons, speedButtons.find((b) => Number(b.dataset.speed) === speed));
  speedButtons.forEach((b) => b.addEventListener('click', () => {
    speed = Number(b.dataset.speed);
    playing = speed > 0;
    syncSpeed();
  }));
  syncSpeed();

  // Labels on the map: the cut (or stockpile) counting down as it's taken away, the fill counting up as
  // it's tipped, and a tag over each machine with its asset number and fuel burn.
  const layer = root.querySelector('[data-mv-labels]');
  const labelsBtn = root.querySelector('[data-mv-labels-toggle]');
  let tags = [], tagsFor = null;
  const m3 = (v) => `${Math.round(v).toLocaleString('en-AU')} m³`;
  // small icons for the lines on a machine's label: fuel pump, dollar, speedometer
  const LINE_ICON = {
    fuel: '<path d="M5 20V5.5A1.5 1.5 0 0 1 6.5 4h6A1.5 1.5 0 0 1 14 5.5V20M4 20h11M5 10h9M14 8l3.5 2.5V17a1.5 1.5 0 0 0 3 0V9l-2.5-3"/>',
    cost: '<circle cx="12" cy="12" r="8.5"/><path d="M14.6 9.2c-.5-.8-1.4-1.2-2.6-1.2-1.5 0-2.6.7-2.6 1.9 0 2.7 5.4 1.4 5.4 4.2 0 1.2-1.1 2-2.8 2-1.2 0-2.2-.5-2.7-1.4M12 6.3v1.5M12 16.2v1.5"/>',
    speed: '<path d="M3.5 17.5a9 9 0 1 1 17 0"/><path d="m12 13.5 4-4"/>',
  };
  const makeTag = (cls, name, lines) => {
    const el = document.createElement('div');
    el.className = cls;
    const box = document.createElement('span');
    box.className = 'mv-pin-box';
    const b = document.createElement('b');
    b.textContent = name;
    box.append(b);
    const values = lines.map((line) => {
      const row = document.createElement('span');
      if (line.key) {
        row.className = 'mv-pin-line';
        row.dataset.line = line.key;
        row.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${LINE_ICON[line.key]}</svg>`;
      }
      const text = document.createElement('span');
      row.append(text);
      box.append(row);
      return text;
    });
    el.append(box);
    layer.append(el);
    return { el, box, values, lines: lines.map((line) => line.fn), last: lines.map(() => ''), shown: true, area: cls.includes('area') ? 1 : 0, bw: 0, bh: 0 };
  };
  function buildTags() {
    layer.textContent = '';
    tagsFor = world.sim.trucks;
    tags = [];
    for (const a of world.areas) {
      const tag = makeTag('mv-pin mv-pin-area', a.name, [{ fn: a.kind === 'source' ? () => `${m3(Math.max(0, a.start - world.sim.taken))} left` : () => `${m3(world.sim.placed)} placed` }]);
      tag.at = a.at;
      tags.push(tag);
    }
    for (const m of [world.loader, ...world.support, ...world.sim.trucks]) {
      const tag = makeTag('mv-pin', m.id, [
        { key: 'fuel', fn: () => `${Math.round(m.fuel ?? 0)} L/h` },
        { key: 'cost', fn: () => aud(m.cost ?? 0) },
        { key: 'speed', fn: () => `${Math.round(m.kmh ?? 0)} km/h` },
      ]);
      const at = new THREE.Vector3();
      const lift = m.lift ?? 4.7;
      tag.at = () => at.copy(m.parts.g.position).setY(m.parts.g.position.y + lift);
      tags.push(tag);
    }
    tagText(true);
  }
  const _pt = new THREE.Vector3();
  const visTags = [], placed = [];
  function placeTags() {
    if (layer.hidden) return;
    if (tagsFor !== world.sim.trucks) buildTags();
    const w = stage.clientWidth, h = stage.clientHeight, small = w < 560;
    visTags.length = 0;
    for (const tag of tags) {
      const p = tag.at();
      tag.dist = p.distanceTo(camera.position);
      _pt.copy(p).project(camera);
      tag.want = _pt.z < 1 && Math.abs(_pt.x) < 1.1 && Math.abs(_pt.y) < 1.1;
      if (!tag.want) continue;
      tag.sx = ((_pt.x + 1) / 2) * w;
      tag.sy = ((1 - _pt.y) / 2) * h;
      if (!tag.bw) {
        tag.bw = tag.box.offsetWidth;
        tag.bh = tag.box.offsetHeight;
      }
      visTags.push(tag);
    }
    for (const tag of tags) {
      if (tag.want === tag.shown) continue;
      tag.el.style.visibility = tag.want ? '' : 'hidden';
      tag.shown = tag.want;
    }
    // Keep the labels from covering each other: the cut and fill go first, then the nearest machines,
    // and a label that would sit on one already placed is lifted clear of it on a longer stem.
    visTags.sort((a, b) => b.area - a.area || a.dist - b.dist);
    placed.length = 0;
    for (const tag of visTags) {
      let stem = tag.area ? (small ? 22 : 30) : small ? 15 : 22;
      // near the edge of the viewer the box slides in, while its stem still points at the machine
      const x0 = tag.sx - tag.bw / 2;
      const dx = x0 < 4 ? 4 - x0 : x0 + tag.bw > w - 4 ? w - 4 - x0 - tag.bw : 0;
      const left = x0 + dx, right = left + tag.bw;
      for (let n = 0; n < 5; n++) {
        const bottom = tag.sy - stem, top = bottom - tag.bh;
        const hit = placed.find((r) => left < r.right + 4 && right > r.left - 4 && top < r.bottom + 4 && bottom > r.top - 4);
        if (!hit) break;
        stem = tag.sy - hit.top + 4;
      }
      // and never off the top of the viewer: with no room above, it hangs below its point instead
      const below = tag.sy - stem - tag.bh < 4;
      if (below) stem = 16;
      if (below !== tag.below) {
        tag.el.classList.toggle('is-below', below);
        tag.below = below;
      }
      placed.push(below
        ? { left, right, top: tag.sy + stem, bottom: tag.sy + stem + tag.bh }
        : { left, right, bottom: tag.sy - stem, top: tag.sy - stem - tag.bh });
      if (stem !== tag.stem) {
        tag.el.style.setProperty('--stem', `${Math.round(stem)}px`);
        tag.stem = stem;
      }
      if (dx !== tag.dx) {
        tag.el.style.setProperty('--dx', `${Math.round(dx)}px`);
        tag.dx = dx;
      }
      tag.el.style.transform = `translate3d(${tag.sx.toFixed(1)}px, ${tag.sy.toFixed(1)}px, 0)`;
    }
  }
  function tagText(force) {
    if (!force && (layer.hidden || tagsFor !== world.sim.trucks)) return;
    for (const tag of tags) {
      tag.lines.forEach((line, i) => {
        const s = line();
        if (s === tag.last[i]) return;
        // a new width only when the text gets longer or shorter
        if (s.length !== tag.last[i].length) tag.bw = 0;
        tag.values[i].textContent = tag.last[i] = s;
      });
    }
  }
  // choose what the machine labels show: fuel burn, running cost, speed
  const chips = [...root.querySelectorAll('[data-mv-show]')];
  chips.forEach((c) => c.addEventListener('click', () => {
    const on = c.getAttribute('aria-pressed') !== 'true';
    c.setAttribute('aria-pressed', String(on));
    layer.classList.toggle(`hide-${c.dataset.mvShow}`, !on);
    for (const tag of tags) tag.bw = 0;
  }));
  labelsBtn.addEventListener('click', () => {
    layer.hidden = !layer.hidden;
    labelsBtn.setAttribute('aria-pressed', String(!layer.hidden));
    for (const c of chips) c.disabled = layer.hidden;
  });

  const out = {
    clock: root.querySelector('[data-mv-clock]'),
    loads: root.querySelector('[data-stat="loads"]'),
    moved: root.querySelector('[data-stat="moved"]'),
    cycle: root.querySelector('[data-stat="cycle"]'),
    busy: root.querySelector('[data-stat="busy"]'),
    cost: root.querySelector('[data-stat="cost"]'),
  };
  const aud = (v) => `$${Math.round(v).toLocaleString('en-AU')}`;
  // Each figure flashes green for a moment when it gets better. A longer average cycle flashes red.
  // The digger's busy figure turns red while it's falling (less production), and stays red until it
  // picks up again, when it flashes green and goes back to normal.
  const seen = { loads: null, cycle: null, busy: null, low: false };
  const timers = {};
  const flash = (key, cls) => {
    const el = out[key];
    el.classList.remove('is-up', 'is-down');
    el.classList.add(cls);
    clearTimeout(timers[key]);
    timers[key] = setTimeout(() => el.classList.remove(cls), 1100);
  };
  const hold = (key, cls) => {
    clearTimeout(timers[key]);
    out[key].classList.remove('is-up', 'is-down');
    out[key].classList.add(cls);
  };
  // after a new job or a change in trucks: start comparing afresh
  const rebase = () => {
    seen.loads = seen.cycle = seen.busy = null;
    seen.low = false;
    for (const key of ['loads', 'moved', 'cycle', 'busy']) {
      clearTimeout(timers[key]);
      out[key].classList.remove('is-up', 'is-down');
    }
  };
  function stats() {
    const s = world.sim;
    const mins = Math.floor(s.time / 60) + (world.def.startHour ?? START_HOUR) * 60;
    out.clock.textContent = `${String(Math.floor(mins / 60) % 24).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
    out.loads.textContent = s.loads.toLocaleString('en-AU');
    out.moved.textContent = `${(s.loads * PAYLOAD).toLocaleString('en-AU')} m³`;
    const cycle = s.cycles.length ? Math.round(s.cycles.reduce((a, b) => a + b, 0) / s.cycles.length / 6) / 10 : null;
    out.cycle.textContent = cycle === null ? '–' : `${cycle.toFixed(1)} min`;
    const busy = s.time > 60 ? Math.round(world.loader.util * 100) : null;
    out.cost.textContent = aud(world.loader.cost + world.support.reduce((a, m) => a + m.cost, 0) + s.trucks.reduce((a, m) => a + m.cost, 0));
    out.busy.textContent = busy === null ? '–' : `${busy}%`;

    if (seen.loads !== null && s.loads > seen.loads) {
      flash('loads', 'is-up');
      flash('moved', 'is-up');
    }
    seen.loads = s.loads;
    if (cycle !== null && seen.cycle !== null && cycle !== seen.cycle) flash('cycle', cycle < seen.cycle ? 'is-up' : 'is-down');
    seen.cycle = cycle;
    // busy moves a point at a time, so it takes a change of two points to count
    if (busy === null) return;
    if (seen.busy === null) {
      seen.busy = busy;
    } else if (seen.low) {
      if (busy < seen.busy) seen.busy = busy;
      else if (busy >= seen.busy + 2) {
        seen.low = false;
        seen.busy = busy;
        flash('busy', 'is-up');
      }
    } else if (busy <= seen.busy - 2) {
      seen.low = true;
      seen.busy = busy;
      hold('busy', 'is-down');
    } else if (busy >= seen.busy + 2) {
      seen.busy = busy;
      flash('busy', 'is-up');
    }
  }

  const resize = () => {
    const w = stage.clientWidth, h = stage.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  // observers are kept in variables: one nothing refers to can be thrown away by the browser
  const sizer = new ResizeObserver(resize);
  sizer.observe(stage);

  let visible = true;
  const watcher = new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; });
  watcher.observe(root);
  root.mvObservers = [sizer, watcher];

  const params = new URLSearchParams(window.location.search);
  resize();
  setJob(JOBS[params.get('job')] ? params.get('job') : 'hill');
  if (['site', 'follow', 'dump', 'clear'].includes(params.get('view'))) setView(params.get('view'), true);
  root.querySelectorAll('button[disabled]').forEach((b) => { b.disabled = false; });
  status.hidden = true;
  root.classList.add('is-ready');

  const clock = new THREE.Clock();
  let statT = 0;
  let beaconTime = 0;
  const frame = () => {
    const real = Math.min(clock.getDelta(), 0.1);
    if (!visible || document.hidden) return;
    if (playing) {
      const simDt = real * speed;
      const n = Math.max(1, Math.ceil(simDt / 0.25));
      for (let i = 0; i < n; i++) world.sim.step(simDt / n);
      beaconTime += real;
    }
    flashBeacons(world.beacons(), beaconTime);
    // reversing lights: on, steady and bright, whenever a truck or the loader backs up
    const reverse = (parts, on) => {
      if (!parts.revMat) return;
      parts.revMat.emissiveIntensity = on ? 5 : 0;
      for (const s of parts.revGlow) if (s) s.material.opacity = on ? 0.95 : 0;
    };
    for (const t of world.sim.trucks) reverse(t.parts, t.reversing);
    reverse(world.loader.parts, world.loader.reversing);
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
    placeTags();
    statT += real;
    if (statT > 0.25) {
      statT = 0;
      stats();
      tagText();
    }
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
