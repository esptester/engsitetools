// 3D equipment model: a 30-tonne wheel loader, taken apart part by part.
// Built from the wheel loader viewer's source (see the scratchpad build.py); runs on the site's three.js.
// Loaded on demand by equipment.js, so none of it slows the page's first view.
import * as T from 'three';

/* ---------- Content: a typical 30-tonne wheel loader. Figures are rounded; part shapes are simplified. ---------- */
const SYSTEMS = [
  'Linkage & bucket',
  'Frames & steering',
  'Engine, cooling & fuel',
  'Drivetrain',
  'Hydraulics',
  'Operator station'
];

// Top speed in each gear (km/h)
const SPEEDS = { F: [7, 13, 24, 40], R: [8, 15, 27, 40] };

const WHOLE = {
  name: 'How a wheel loader fits together',
  sys: 'Whole machine',
  blurb: 'Two frames joined by a pivot. The engine sits at the back, where its weight balances the bucket, and the loader linkage hangs off the front. Show one system to pull just its parts out, or click any part.',
  systems: [
    'Two lift cylinders raise the arms. One tilt cylinder works the bucket through a bellcrank and link.',
    'Front and rear frames pivot on the hitch pins. Two steering cylinders bend the machine up to 40° each way.',
    'The engine sits at the back, where its weight helps balance the bucket. Cooling, exhaust aftertreatment and tanks pack in around it.',
    'A powershift transmission sends drive through shafts to both axles, so all four wheels drive.',
    'Load-sensing piston pumps feed the main valve, the cylinders and the ride control accumulators.',
    'A pressurised cab with joystick steering and a payload display, reached by a stairway on the left side.'
  ],
  aside: 'Figures are typical of a 30-tonne wheel loader, rounded. Part shapes are simplified.'
};

const PARTS = [
  /* ---- Linkage & bucket ---- */
  { id: 'bucket', n: 1, sys: 0, name: 'Bucket, general purpose', key: '5.4 m³', chips: ['General purpose'],
    blurb: 'A 5.4 m³ general purpose bucket with a bolt-on cutting edge. Machines this size take buckets from about 4 to 14 m³: the small ones for rock, the biggest for light material like woodchips.',
    specs: [['Bucket', '5.4 m³'], ['Bucket range', 'about 4–14 m³'], ['Breakout force', 'about 225 kN'],
      ['Rack back at ground', '40°'], ['Rack back at carry', '48°'], ['Rack back at full lift', '61°']] },
  { id: 'boce', n: 2, sys: 0, name: 'Bolt-on cutting edge', key: 'wear part', chips: ['Wear part'],
    blurb: 'A replaceable steel edge bolted along the bucket lip. It takes the wear from digging so the bucket’s base edge doesn’t wear away. When it’s worn, you unbolt it and fit a new one instead of rebuilding the bucket.',
    specs: [['Type', 'Bolt-on cutting edge'], ['Fitted to', 'General purpose bucket']] },
  { id: 'arms', n: 3, sys: 0, name: 'Lift arms (Z-bar)', key: 'pin 4.6 m', chips: ['Standard lift', 'High lift optional'],
    blurb: 'Two arms pivot on the loader tower and carry the bucket on hinge pins at their tips. Z-bar linkage, named for the zig-zag of tilt cylinder, bellcrank and tilt link, puts strong breakout force at the cutting edge. High-lift arms reach taller trucks and hoppers.',
    specs: [['Linkage', 'Z-bar'], ['Hinge pin height, full lift', 'about 4.6 m'], ['Hinge pin height, carry', 'about 0.6 m'],
      ['Lift arm clearance, full lift', 'about 3.9 m'], ['Lift and tilt kickouts', 'Standard']] },
  { id: 'bellcrank', n: 4, sys: 0, name: 'Bellcrank', key: 'Z-bar lever', chips: ['Standard'],
    blurb: 'The middle lever of the Z-bar. It pivots on a bracket on the cross tube between the lift arms. The tilt cylinder pushes its top end and its lower end pulls the tilt link, so the cylinder’s force reaches the bucket through a lever.',
    specs: [['Pivot', 'Cross tube between the lift arms'], ['Driven by', 'Tilt cylinder'], ['Drives', 'Tilt link to the bucket']] },
  { id: 'link', n: 5, sys: 0, name: 'Tilt link', key: 'bucket link', chips: ['Standard'],
    blurb: 'A short, heavy link from the bellcrank’s lower end to the bracket on the back of the bucket. It closes the Z: cylinder, bellcrank, link. When the bucket racks back, this link is pulling.',
    specs: [['Connects', 'Bellcrank to bucket'], ['Pins', '2']] },
  { id: 'tiltcyl', n: 6, sys: 0, name: 'Tilt cylinder', key: '1 cylinder', chips: ['Standard'],
    blurb: 'One double-acting cylinder on top of the loader tower. Extending it racks the bucket back and retracting it dumps. The tilt kickout stops it at a preset bucket angle, so the bucket comes back level for the next pass.',
    specs: [['Quantity', '1'], ['Max operating pressure', 'about 34 MPa'], ['Tilt kickout', 'Standard']] },
  { id: 'liftcyl', n: 7, sys: 0, name: 'Lift cylinders', key: '2 cylinders', chips: ['Standard'],
    blurb: 'Two cylinders between the front frame and the lift arms raise the bucket. The lift kickout stops the arms at a preset height. While travelling, ride control connects them to accumulators to soak up bucket bounce.',
    specs: [['Quantity', '2'], ['Max operating pressure', 'about 34 MPa'], ['Lift kickout', 'Standard'], ['Hinge pin height, full lift', 'about 4.6 m']] },

  /* ---- Frames & steering ---- */
  { id: 'fframe', n: 8, sys: 1, name: 'Front frame', key: 'loader tower', chips: ['Standard'],
    blurb: 'The front half of the machine. Its tall loader tower carries the lift arm pivots and the tilt cylinder, and the front axle bolts underneath. The whole front frame turns on the articulation hitch.',
    specs: [['Carries', 'Lift arms, cylinders, front axle'], ['Wheelbase', 'about 3.8 m'], ['Articulation', '40° each way']] },
  { id: 'hitch', n: 9, sys: 1, name: 'Articulation hitch', key: '40° each way', chips: ['Standard'],
    blurb: 'Upper and lower hitch pins join the front and rear frames on one vertical axis. The front frame swings up to 40° each way to steer. The front drive shaft runs through the gap between the two pins.',
    specs: [['Pins', 'Upper and lower'], ['Articulation', '40° each way'], ['Tipping load, full turn', 'about 19.7 t']] },
  { id: 'steercyl', n: 10, sys: 1, name: 'Steering cylinders', key: '2 cylinders', chips: ['Standard'],
    blurb: 'Two cylinders across the hitch push on one side and pull on the other to bend the machine in the middle. Oil comes from a dedicated load-sensing steering pump.',
    specs: [['Quantity', '2'], ['Steering pump', 'Dedicated, load sensing'], ['Steering', 'Joystick, wheel optional']] },
  { id: 'rframe', n: 11, sys: 1, name: 'Rear frame', key: 'engine cradle', chips: ['Standard'],
    blurb: 'The rear half of the machine. It carries the engine, transmission, cooling package, cab platform and counterweight. The rear axle hangs underneath on an oscillating mount.',
    specs: [['Carries', 'Engine, transmission, cooling, cab'], ['Rear axle', 'Oscillating mount'], ['Ground clearance', 'about 0.46 m']] },
  { id: 'cwt', n: 12, sys: 1, name: 'Counterweight', key: 'standard', chips: ['Standard'],
    blurb: 'A heavy steel block across the very back. Together with the engine it balances the loaded bucket hanging ahead of the front axle, which is what sets the tipping load.',
    specs: [['Rear axle to counterweight', 'about 2.7 m'], ['Tipping load, full turn', 'about 19.7 t'], ['Operating weight', 'about 30 t']] },

  /* ---- Engine, cooling & fuel ---- */
  { id: 'engine', n: 13, sys: 2, name: 'Engine', key: 'about 290 kW', chips: ['Tier 4 Final / Stage V'],
    blurb: 'A 12–13 L inline six, turbocharged and aftercooled. It sits at the back of the machine, where its weight helps counterbalance the bucket. Peak torque comes well below rated speed, so it pulls hard when the bucket digs in.',
    specs: [['Layout', 'Inline 6, turbocharged'], ['Displacement', 'about 12.5 L'], ['Net power', 'about 290 kW'], ['Net torque', 'about 2,100 N·m'], ['Biodiesel', 'Up to B20']] },
  { id: 'cem', n: 14, sys: 2, name: 'Exhaust aftertreatment', key: 'Stage V', chips: ['Standard'],
    blurb: 'Cleans the exhaust to Tier 4 Final and Stage V. An oxidation catalyst and a particulate filter deal with soot, then selective catalytic reduction uses DEF to cut NOx. Exhaust leaves through the stack on top.',
    specs: [['Stages', 'DOC, DPF, SCR'], ['Emissions', 'Tier 4 Final, Stage V'], ['Height to top of exhaust', 'about 3.8 m']] },
  { id: 'cooling', n: 15, sys: 2, name: 'Cooling package', key: 'about 50 L', chips: ['Standard'],
    blurb: 'Radiator, charge-air aftercooler and oil coolers stacked at the very back, with the fan pulling air through the rear grille. Fan speed follows cooling demand. A reversible fan and a high-debris radiator suit dusty work.',
    specs: [['Coolant', 'about 50 L'], ['Fan', 'Speed follows demand'], ['Reversible fan', 'Optional'], ['High-debris radiator', 'Optional']] },
  { id: 'hood', n: 16, sys: 2, name: 'Engine enclosure', key: 'about 3.1 m', chips: ['Standard'],
    blurb: 'The sheet-metal hood over the engine bay, with service doors on the sides and the air intake and precleaner on top. Two work lights sit at the back of the hood.',
    specs: [['Height to top of hood', 'about 3.1 m'], ['Air precleaner', 'Standard'], ['Rear work lights', '2']] },
  { id: 'fuel', n: 17, sys: 2, name: 'Fuel tank', key: 'about 425 L', chips: ['Standard'],
    blurb: 'Holds about 425 L of diesel. Fuel passes a water separator and a secondary filter on its way to the engine, and an electric priming pump refills the system after a filter change.',
    specs: [['Capacity', 'about 425 L'], ['Biodiesel', 'Up to B20'], ['Water separator', 'Standard'], ['Fast fill', 'Optional']] },
  { id: 'def', n: 18, sys: 2, name: 'DEF tank', key: 'about 20 L', chips: ['Standard'],
    blurb: 'Diesel exhaust fluid for the SCR catalyst in the aftertreatment. The filler cap is blue so it doesn’t get mixed up with the diesel fill.',
    specs: [['Capacity', 'about 20 L'], ['Feeds', 'SCR catalyst']] },

  /* ---- Drivetrain ---- */
  { id: 'trans', n: 19, sys: 3, name: 'Torque converter & transmission', key: '4F / 4R', chips: ['Standard'], speeds: true,
    blurb: 'A planetary powershift with four speeds each way that shifts on its own. The torque converter multiplies torque for digging, then its lock-up clutch makes a direct drive for efficient travel.',
    specs: [['Type', 'Planetary, automatic powershift'], ['Gears', '4 forward, 4 reverse'], ['Torque converter', 'With lock-up clutch'], ['Top speed', 'about 40 km/h']] },
  { id: 'shafts', n: 20, sys: 3, name: 'Drive shafts', key: '4WD', chips: ['Standard'],
    blurb: 'Carry torque from the transmission to both axles, so all four wheels drive. The front shaft passes through the hitch, and its universal joints flex as the machine articulates.',
    specs: [['Drive', 'All four wheels'], ['Front shaft', 'Through the articulation hitch'], ['Joints', 'Universal joints']] },
  { id: 'faxle', n: 21, sys: 3, name: 'Front axle', key: 'fixed', chips: ['Standard'],
    blurb: 'Bolted solid to the front frame, it carries most of the weight when the bucket is loaded. Differential in the middle, planetary final drives at the wheel ends and enclosed wet disc brakes. The parking brake is on this axle.',
    specs: [['Mounting', 'Fixed'], ['Differential', 'Open, limited slip optional'], ['Service brakes', 'Wet disc'], ['Parking brake', 'Spring-applied caliper']] },
  { id: 'raxle', n: 22, sys: 3, name: 'Rear axle', key: 'oscillating', chips: ['Standard'],
    blurb: 'Mounted on a trunnion so it can rock side to side. That keeps all four tyres on uneven ground and keeps the frame steadier. It has the same differential, final drives and wet brakes as the front.',
    specs: [['Mounting', 'Oscillating'], ['Differential', 'Open, limited slip optional'], ['Service brakes', 'Wet disc']] },
  { id: 'ftires', n: 23, sys: 3, name: 'Front wheels & tyres', key: '29.5R25', chips: ['Standard'],
    blurb: '29.5R25 radial tyres on 25-inch rims. Deeper treads suit rock, and others suit softer ground.',
    specs: [['Tyre size', '29.5R25 radial'], ['Tread width', 'about 2.4 m'], ['Width over tyres', 'about 3.3 m']] },
  { id: 'rtires', n: 24, sys: 3, name: 'Rear wheels & tyres', key: '29.5R25', chips: ['Standard'],
    blurb: 'The same 29.5R25 radials as the front. Traction control limits wheel spin as the bucket enters the pile, which saves tyres.',
    specs: [['Tyre size', '29.5R25 radial'], ['Wheelbase', 'about 3.8 m'], ['Tyre pressure monitoring', 'Optional']] },

  /* ---- Hydraulics ---- */
  { id: 'pumps', n: 25, sys: 4, name: 'Hydraulic pumps', key: 'about 450 L/min', chips: ['Standard'],
    blurb: 'Two variable displacement piston pumps: one for the loader, one only for steering. Both are load sensing, so they make the flow and pressure the controls ask for instead of pumping full flow all the time.',
    specs: [['Implement pump', 'Variable displacement piston'], ['Max implement flow', 'about 450 L/min'], ['Max operating pressure', 'about 34 MPa'], ['Steering pump', 'Dedicated piston pump']] },
  { id: 'mcv', n: 26, sys: 4, name: 'Main control valve', key: 'EH controls', chips: ['Standard'],
    blurb: 'Meters oil to the lift and tilt cylinders as the operator moves the controls. Electro-hydraulic controls let kickouts and ride control be handled in software. Extra valve sections run optional third and fourth functions.',
    specs: [['Implement controls', 'Electro-hydraulic'], ['Lift and tilt kickouts', 'Standard'], ['3rd and 4th functions', 'Optional'], ['Quick coupler control', 'Optional']] },
  { id: 'accum', n: 27, sys: 4, name: 'Ride control accumulators', key: 'dual', chips: ['Standard'],
    blurb: 'Two gas-charged accumulators that connect to the lift cylinders while the machine travels. They let the bucket float slightly, which damps pitching in load-and-carry work and keeps material in the bucket.',
    specs: [['Ride control', 'Two accumulators'], ['Works on', 'Lift cylinders']] },
  { id: 'hydtank', n: 28, sys: 4, name: 'Hydraulic tank', key: 'about 150 L', chips: ['Standard'],
    blurb: 'Reservoir for the implement and steering oil. Oil sampling valves come standard for condition monitoring, and biodegradable hydraulic oil is an option for sensitive sites.',
    specs: [['Capacity', 'about 150 L'], ['Oil sampling valves', 'Standard'], ['Biodegradable oil', 'Optional']] },

  /* ---- Operator station ---- */
  { id: 'cab', n: 29, sys: 5, name: 'Cab', key: 'about 72 dB(A)', chips: ['Standard'],
    blurb: 'A pressurised, sound-suppressed ROPS cab with joystick steering, electro-hydraulic implement controls, a touchscreen for payload weighing and machine settings, and a rear-view camera.',
    specs: [['Operator sound', 'about 72 dB(A)'], ['Height to top of ROPS', 'about 3.8 m'], ['Steering', 'Joystick, wheel optional'], ['Seat', 'Air suspension'],
      ['Climate', 'Automatic air conditioning'], ['Rear-view camera', 'Standard']] },
  { id: 'stairs', n: 30, sys: 5, name: 'Access stairway', key: 'left side', chips: ['Standard'],
    blurb: 'Steps and handrails on the left side lead up to the cab door, with a standing platform for cleaning the front window. A rear exit is optional as a second way down.',
    specs: [['Window cleaning platform', 'Standard'], ['Rear exit', 'Optional']] },
  { id: 'fenders', n: 31, sys: 5, name: 'Fenders', key: 'roading', chips: ['Standard'],
    blurb: 'Cover the tyres to keep mud and rock off the machine, the steps and the windows.',
    specs: [['Type', 'Roading fenders'], ['Extensions', 'Optional']] }
];
const PART = Object.fromEntries(PARTS.map((p) => [p.id, p]));

/* ---------- 3D core ---------- */
const DEG = Math.PI / 180;
const REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Live values ease toward their targets (t*) every frame.
const S = {
  explode: 0.6, lift: 0, tilt: 0, steer: 0,
  tExplode: 0.6, tLift: 0, tTilt: 0, tSteer: 0,
  labels: true, dims: false, spin: false, isolate: false, sys: -1,
  selected: null, hovered: null
};

let renderer, scene, camera, raycaster, gridHelper, dimGroup, dimMat, dimPin, UP, ACCENT, qSteer;
let dirty = true;
let BASEMAT = {};
let CUR = null;
const NODES = [];
const PICK = [];

/* Coordinates: metres. x forward (bucket end), y up, z to the machine's right.
   Origin: articulation hitch axis at ground level. Rear axle x = -1.90, front axle x = +1.90 (wheelbase 3800).
   Counterweight edge x = -4.561 (2661 behind rear axle). Hinge pin at carry (3.594, 0.632): 8155 overall length. */
const K = { P: [1.05, 2.35], C: [1.95, 0.34], b: [0.05, 0.45], rL: 0.80, rT: 0.62, Lk: 0.95,
  liftBase: [0.72, 1.00], liftArm: [1.55, -0.18], zArm: 0.68, zLift: 0.50 };
K.R = Math.hypot(3.594 - K.P[0], 0.632 - K.P[1]);
K.aCarry = Math.atan2(0.632 - K.P[1], 3.594 - K.P[0]);
K.aMax = Math.asin((4.554 - K.P[1]) / K.R);

// Z-bar four-bar solve: arm angle alpha, bucket world angle theta -> pin positions (front-frame x/y).
function solveLinkage(alpha, theta) {
  const ca = Math.cos(alpha), sa = Math.sin(alpha);
  const toW = (x, y) => [K.P[0] + x * ca - y * sa, K.P[1] + x * sa + y * ca];
  const H = toW(K.R, 0);
  const C = toW(K.C[0], K.C[1]);
  const ct = Math.cos(theta), st = Math.sin(theta);
  const B = [H[0] + K.b[0] * ct - K.b[1] * st, H[1] + K.b[0] * st + K.b[1] * ct];
  const dx = B[0] - C[0], dy = B[1] - C[1];
  const d = Math.hypot(dx, dy) || 1e-6;
  const ux = dx / d, uy = dy / d;
  const dd = Math.min(K.rL + K.Lk - 1e-4, Math.max(Math.abs(K.rL - K.Lk) + 1e-4, d));
  const a = (K.rL * K.rL - K.Lk * K.Lk + dd * dd) / (2 * dd);
  const h = Math.sqrt(Math.max(0, K.rL * K.rL - a * a));
  const Mx = C[0] + a * ux, My = C[1] + a * uy;
  const L = [Mx + h * uy, My - h * ux]; // lower branch: bellcrank foot below the C->B line
  const lx = C[0] - L[0], ly = C[1] - L[1], ll = Math.hypot(lx, ly) || 1;
  const Tp = [C[0] + K.rT * lx / ll, C[1] + K.rT * ly / ll];
  return { H, C, B, L, T: Tp, alpha, theta, toW };
}
// Tilt cylinder base on the loader tower, placed so the cylinder runs parallel to the arm at carry.
(function () {
  const ref = solveLinkage(K.aCarry, 0);
  const tx = ref.T[0] - ref.C[0], ty = ref.T[1] - ref.C[1], tl = Math.hypot(tx, ty);
  K.F = [K.P[0] + K.rT * tx / tl, K.P[1] + K.rT * ty / tl];
})();

// Keep the bucket out of the ground: raise theta toward rack back until the lowest point clears.
const BUCKET_LOW = [[1.96, -0.565], [0.45, -0.60], [0.09, -0.22]];
function bucketMinY(Hy, t) {
  let m = Infinity;
  const s = Math.sin(t), c = Math.cos(t);
  for (const p of BUCKET_LOW) m = Math.min(m, Hy + p[0] * s + p[1] * c);
  return m;
}
function clampTheta(Hy, theta) {
  if (bucketMinY(Hy, theta) >= 0.03) return { theta, clamped: false };
  let lo = theta, hi = 1.2;
  if (bucketMinY(Hy, hi) < 0.03) return { theta, clamped: false };
  for (let i = 0; i < 26; i++) {
    const mid = (lo + hi) / 2;
    if (bucketMinY(Hy, mid) >= 0.03) hi = mid; else lo = mid;
  }
  return { theta: hi, clamped: true };
}
function computeKin() {
  const alpha = K.aCarry + (K.aMax - K.aCarry) * S.lift;
  const maxRack = (48 + 13 * S.lift) * DEG;
  const Hy = K.P[1] + K.R * Math.sin(alpha);
  const c = clampTheta(Hy, Math.min(S.tilt * DEG, maxRack));
  K.cur = solveLinkage(alpha, c.theta);
  K.cur.clamped = c.clamped;
  return K.cur;
}

/* ---------- Materials ---------- */
const PAINT = '#FF5A1F'; // EngSiteTools orange
// three.js converts hex colours from sRGB itself
function col(hex) { return new T.Color(hex); }
function makeBaseMaterials() {
  const std = (hex, rough, metal, extra) => Object.assign(
    new T.MeshStandardMaterial({ color: col(hex), roughness: rough, metalness: metal }), extra || {});
  BASEMAT = {
    paint: new T.MeshPhysicalMaterial({ color: col(PAINT), roughness: 0.42, metalness: 0.1, clearcoat: 0.45, clearcoatRoughness: 0.28 }),
    paintDS: new T.MeshPhysicalMaterial({ color: col(PAINT), roughness: 0.42, metalness: 0.1, clearcoat: 0.45, clearcoatRoughness: 0.28, side: T.DoubleSide }),
    black: std('#34383B', 0.55, 0.25),
    iron: std('#5A6165', 0.55, 0.5),
    steel: std('#8E979C', 0.4, 0.6),
    chrome: std('#D9DFE3', 0.16, 0.85),
    rubber: std('#2C2F31', 0.82, 0.0, { side: T.DoubleSide }),
    wear: std('#777D81', 0.45, 0.65),
    glass: std('#35505B', 0.06, 0.4, { transparent: true, opacity: 0.38, side: T.DoubleSide }),
    blue: std('#1F5FCC', 0.4, 0.1),
    hose: std('#1C1F21', 0.45, 0.05),
    amber: std('#F2A20C', 0.3, 0.0, { emissive: col('#6B3C00') }),
    red: std('#B23A22', 0.5, 0.2),
    lens: std('#F2EAD0', 0.25, 0.0, { emissive: col('#3D3523') }),
    grille: std('#FFFFFF', 0.7, 0.35),
    screen: std('#0D1A22', 0.2, 0.2, { emissive: col('#123C55') })
  };
  const c = document.createElement('canvas');
  c.width = 8; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#4A5155'; g.fillRect(0, 0, 8, 64);
  g.fillStyle = '#1B1F21';
  for (let y = 0; y < 64; y += 8) g.fillRect(0, y, 8, 4);
  const tex = new T.CanvasTexture(c);
  tex.wrapS = tex.wrapT = T.RepeatWrapping;
  tex.repeat.set(1, 5);
  tex.colorSpace = T.SRGBColorSpace;
  BASEMAT.grille.map = tex;
}

/* ---------- Building helpers (add to the current node) ---------- */
const NO_GRIME = { glass: 1, lens: 1, screen: 1, decal: 1, amber: 1 };
// Surfaces near the ground get darker: a cheap stand-in for dirt and for shading where the machine meets the floor.
function addGrime(m) {
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = 'varying float vGrimeY;\n' + sh.vertexShader.replace('#include <worldpos_vertex>',
      '#include <worldpos_vertex>\n\tvec4 grimePos = vec4(transformed, 1.0);\n#ifdef USE_INSTANCING\n\tgrimePos = instanceMatrix * grimePos;\n#endif\n\tvGrimeY = (modelMatrix * grimePos).y;');
    sh.fragmentShader = 'varying float vGrimeY;\n' + sh.fragmentShader.replace('#include <color_fragment>',
      '#include <color_fragment>\n\tdiffuseColor.rgb *= mix(0.6, 1.0, smoothstep(0.05, 1.2, vGrimeY));');
  };
}
function partInit(p) {
  const cache = {};
  p.nodes = []; p.mats = []; p.meshes = [];
  p.ex = 1; // 1 = this part follows the explode slider, 0 = held assembled by the system filter
  p.m = (name) => {
    if (!cache[name]) {
      const mm = BASEMAT[name].clone();
      if (!NO_GRIME[name]) addGrime(mm);
      mm.userData.op = mm.opacity;
      mm.userData.tr = mm.transparent;
      mm.userData.em = mm.emissive.clone();
      mm.userData.col = mm.color.clone();
      cache[name] = mm;
      p.mats.push(mm);
    }
    return cache[name];
  };
}
function addNode(p, opts) {
  const g = new T.Group();
  scene.add(g);
  const n = { p, obj: g, front: !!opts.front, off: new T.Vector3().fromArray(opts.off || [0, 0, 0]),
    pose: opts.pose || null, p0: new T.Vector3(), q0: new T.Quaternion(), anchor: new T.Vector3() };
  p.nodes.push(n);
  NODES.push(n);
  CUR = { p, g };
  return n;
}
function add(geo, mat, x, y, z) {
  const m = new T.Mesh(geo, CUR.p.m(mat));
  m.position.set(x || 0, y || 0, z || 0);
  m.castShadow = true;
  m.receiveShadow = true;
  m.userData.pid = CUR.p.id;
  CUR.g.add(m);
  CUR.p.meshes.push(m);
  PICK.push(m);
  return m;
}
function rrectShape(w, h, r) {
  const s = new T.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
const PLAIN = { grille: 1, glass: 1, lens: 1, screen: 1, decal: 1 };
// Boxes get softly rounded edges so they catch highlights like real plate steel; thin or glazed parts stay plain.
function box(mat, w, h, d, x, y, z) {
  const m0 = Math.min(w, h, d);
  if (m0 < 0.045 || PLAIN[mat]) return pbox(mat, w, h, d, x, y, z);
  const b = Math.min(0.03, m0 * 0.18);
  const g = new T.ExtrudeGeometry(rrectShape(w - 2 * b, h - 2 * b, b),
    { depth: d - 2 * b, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 2, curveSegments: 3 });
  g.translate(0, 0, -(d - 2 * b) / 2);
  return add(g, mat, x, y, z);
}
function pbox(mat, w, h, d, x, y, z) { return add(new T.BoxGeometry(w, h, d), mat, x, y, z); }
function cylX(mat, r, len, x, y, z, seg) { const g = new T.CylinderGeometry(r, r, len, seg || 24); g.rotateZ(Math.PI / 2); return add(g, mat, x, y, z); }
function cylY(mat, r, len, x, y, z, seg) { return add(new T.CylinderGeometry(r, r, len, seg || 24), mat, x, y, z); }
function cylZ(mat, r, len, x, y, z, seg) { const g = new T.CylinderGeometry(r, r, len, seg || 24); g.rotateX(Math.PI / 2); return add(g, mat, x, y, z); }
function sph(mat, r, x, y, z) { return add(new T.SphereGeometry(r, 24, 16), mat, x, y, z); }
function shapeOf(pts) {
  const s = new T.Shape();
  s.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]);
  s.closePath();
  return s;
}
// Side profile (x/y) extruded across z, centred on zc.
function prism(mat, pts, depth, zc, bevel, seg) {
  const b = bevel === undefined ? 0.012 : bevel;
  const g = new T.ExtrudeGeometry(shapeOf(pts), { depth, bevelEnabled: b > 0, bevelThickness: b, bevelSize: b, bevelSegments: seg || 2, curveSegments: 8 });
  g.translate(0, 0, zc - depth / 2);
  return add(g, mat, 0, 0, 0);
}
// Thick curved strip (fenders): ring sector between radii r0..r1, angles a0..a1, centred at (x, y), extruded across z.
function band(mat, r0, r1, a0, a1, depth, x, y, zc) {
  const s = new T.Shape();
  s.absarc(0, 0, r1, a0, a1, false);
  s.absarc(0, 0, r0, a1, a0, true);
  s.closePath();
  const g = new T.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 2, curveSegments: 28 });
  g.translate(0, 0, zc - depth / 2);
  return add(g, mat, x, y, 0);
}
function tube(mat, r, a, b, seg) {
  const A = new T.Vector3().fromArray(a), Bv = new T.Vector3().fromArray(b);
  const d = new T.Vector3().subVectors(Bv, A);
  const m = add(new T.CylinderGeometry(r, r, d.length(), seg || 12), mat, (A.x + Bv.x) / 2, (A.y + Bv.y) / 2, (A.z + Bv.z) / 2);
  m.quaternion.setFromUnitVectors(UP, d.normalize());
  return m;
}
// Flexible hose or bent pipe through a list of points.
function hose(mat, r, pts, seg) {
  const curve = new T.CatmullRomCurve3(pts.map((a) => new T.Vector3(a[0], a[1], a[2])));
  return add(new T.TubeGeometry(curve, seg || 20, r, 8, false), mat, 0, 0, 0);
}
function arcPts(cx, cy, r, a0, a1, n) {
  const out = [];
  for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
  return out;
}
// Polyline -> closed outline of a plate t thick (for the bucket wrapper).
function thickPath(path, t) {
  const Lp = [], Rp = [];
  for (let i = 0; i < path.length; i++) {
    const p = path[i], a = path[Math.max(0, i - 1)], b = path[Math.min(path.length - 1, i + 1)];
    let dx = b[0] - a[0], dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1; dx /= len; dy /= len;
    Lp.push([p[0] - dy * t / 2, p[1] + dx * t / 2]);
    Rp.push([p[0] + dy * t / 2, p[1] - dx * t / 2]);
  }
  return Lp.concat(Rp.reverse());
}
// Hydraulic cylinder in the current node: barrel from A, chrome rod to B. Returns a setter.
function hydraulic(rb, rr, lb) {
  const barrelGeo = new T.CylinderGeometry(rb, rb, 1, 22); barrelGeo.translate(0, 0.5, 0);
  const rodGeo = new T.CylinderGeometry(rr, rr, 1, 16); rodGeo.translate(0, -0.5, 0);
  const barrel = add(barrelGeo, 'paint');
  const gland = cylY('iron', rb * 1.1, 0.08, 0, 0, 0);
  cylY('iron', rb * 1.06, 0.07, 0, 0.035, 0);
  const rod = add(rodGeo, 'chrome');
  cylZ('iron', rb * 0.95, 0.15, 0, 0, 0);
  const eyeB = cylZ('iron', rr * 1.9, 0.13, 0, 0, 0);
  const tmp = new T.Vector3();
  return function set(A, B, n) {
    tmp.subVectors(B, A);
    const L = tmp.length();
    const blen = Math.max(0.2, Math.min(lb, L - 0.12));
    barrel.scale.y = blen;
    gland.position.y = blen;
    rod.position.y = L;
    rod.scale.y = L - blen + 0.15;
    eyeB.position.y = L;
    n.p0.copy(A);
    n.q0.setFromUnitVectors(UP, tmp.normalize());
  };
}

/* ---------- Pose update: kinematics, then explode offsets, then steering ---------- */
const _p = { v: null }, _o = { v: null }, _q = { q: null };
function updatePoses() {
  qSteer.setFromAxisAngle(UP, S.steer * DEG);
  computeKin();
  const p = _p.v, o = _o.v, q = _q.q;
  for (const n of NODES) {
    if (n.pose) n.pose(n, K.cur);
    p.copy(n.p0);
    q.copy(n.q0);
    o.copy(n.off).multiplyScalar(S.explode * n.p.ex);
    p.add(o);
    if (n.front) { p.applyQuaternion(qSteer); q.premultiply(qSteer); }
    n.obj.position.copy(p);
    n.obj.quaternion.copy(q);
  }
  dirty = true;
}
function computeAnchors() {
  const bb = new T.Box3(), tb = new T.Box3();
  for (const n of NODES) {
    n.obj.position.set(0, 0, 0);
    n.obj.quaternion.identity();
    n.obj.updateMatrixWorld(true);
    bb.makeEmpty();
    n.obj.traverse((o) => {
      if (!o.isMesh) return;
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      tb.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld);
      bb.union(tb);
    });
    if (!bb.isEmpty()) bb.getCenter(n.anchor);
  }
}

/* ---------- Highlight and isolate ---------- */
function refreshLook() {
  if (!ACCENT) return;
  for (const p of PARTS) {
    if (!p.mats) continue;
    const sel = S.selected === p.id, hov = S.hovered === p.id;
    const ghost = S.isolate && S.selected && !sel;
    for (const m of p.mats) {
      // Selected parts take the CAD-selection blue; hover is a light glow.
      m.color.copy(m.userData.col);
      m.emissive.copy(m.userData.em);
      if (sel) { m.color.lerp(ACCENT, 0.78); m.emissive.copy(ACCENT).multiplyScalar(0.12); }
      else if (hov) m.emissive.copy(ACCENT).multiplyScalar(0.2);
      const tr = ghost || m.userData.tr;
      if (m.transparent !== tr) { m.transparent = tr; m.needsUpdate = true; }
      m.opacity = ghost ? m.userData.op * 0.1 : m.userData.op;
      m.depthWrite = !ghost && !m.userData.tr;
    }
    for (const mesh of p.meshes) mesh.castShadow = !ghost;
  }
  dirty = true;
}

/* ---------- Camera (custom orbit) ---------- */
const CAM = { theta: -58 * DEG, phi: 68 * DEG, dist: 17, distGoal: 17, fit: 1, target: null, goal: null, home: null,
  auto: true, lastIds: null, pendingFit: null };
function applyCamera() {
  const d = CAM.dist * CAM.fit, sp = Math.sin(CAM.phi);
  camera.position.set(
    CAM.target.x + d * sp * Math.cos(CAM.theta),
    CAM.target.y + d * Math.cos(CAM.phi),
    CAM.target.z + d * sp * Math.sin(CAM.theta));
  camera.lookAt(CAM.target);
}
function resetView() {
  CAM.theta = -58 * DEG;
  CAM.phi = 68 * DEG;
  frameParts(visibleIds());
}
function anchorWorld(id, out) {
  const n = PART[id].nodes[0];
  return n.obj.localToWorld(out.copy(n.anchor));
}

/* ---------- Model: one builder per part. Explode offsets are the "off" vectors (metres at 100%). ---------- */
let ZV;
function buildModel() {
  const P = (id) => { const p = PART[id]; partInit(p); return p; };

  /* 11 Rear frame, cab platform and its handrails */
  { const p = P('rframe'); addNode(p, { off: [0, 0, 0] });
    const rail = [[-4.20, 0.60], [-2.40, 0.60], [-2.24, 1.17], [-1.56, 1.17], [-1.40, 0.60], [-0.36, 0.60], [-0.30, 1.58], [-1.20, 1.62], [-2.30, 1.40], [-4.20, 1.40]];
    prism('paint', rail, 0.08, -0.50);
    prism('paint', rail, 0.08, 0.50);
    box('paint', 0.12, 0.78, 1.08, -4.14, 1.00, 0);
    box('paint', 0.10, 0.20, 0.92, -2.35, 1.30, 0);
    box('paint', 0.22, 0.30, 0.92, -0.62, 1.40, 0);
    box('paint', 0.52, 0.08, 0.60, -0.10, 1.43, 0);
    box('paint', 0.52, 0.08, 0.60, -0.10, 0.64, 0);
    cylY('iron', 0.12, 0.10, 0, 1.43, 0);
    cylY('iron', 0.12, 0.10, 0, 0.64, 0);
    box('black', 2.45, 0.10, 1.60, -0.925, 1.97, 0);
    for (const zz of [-0.5, 0.5]) {
      box('paint', 0.20, 0.44, 0.10, -0.55, 1.75, zz);
      box('paint', 0.20, 0.52, 0.10, -1.95, 1.66, zz);
      cylZ('iron', 0.08, 0.10, -0.85, 0.95, zz * 1.18);
    }
    for (const xx of [-3.55, -2.65]) for (const zz of [-0.40, 0.40]) box('iron', 0.16, 0.06, 0.14, xx, 1.43, zz);
    for (const zz of [-0.84, 0.84]) {
      tube('paint', 0.022, [-2.12, 2.02, zz], [-2.12, 2.95, zz]);
      tube('paint', 0.022, [-1.50, 2.02, zz], [-1.50, 2.95, zz]);
      tube('paint', 0.022, [-2.12, 2.95, zz], [-1.50, 2.95, zz]);
      tube('paint', 0.018, [-2.12, 2.50, zz], [-1.50, 2.50, zz]);
    }
    // Suction line from the hydraulic tank down to the pumps; steering lines forward to the steering cylinders.
    hose('hose', 0.04, [[-1.80, 2.02, 0.50], [-1.86, 1.80, 0.50], [-1.90, 1.56, 0.44], [-1.92, 1.46, 0.38]]);
    hose('hose', 0.022, [[-1.62, 1.40, -0.30], [-1.30, 1.30, -0.40], [-1.02, 1.08, -0.52], [-0.92, 0.98, -0.58]]);
    hose('hose', 0.022, [[-1.62, 1.33, -0.24], [-1.32, 1.10, 0.05], [-1.05, 0.95, 0.45], [-0.92, 0.95, 0.58]]);
  }

  /* 8 Front frame (loader tower) */
  { const p = P('fframe'); addNode(p, { front: true, off: [0.8, 0, 0] });
    const plate = [[0.20, 0.50], [1.45, 0.50], [1.58, 1.12], [2.22, 1.12], [2.40, 0.90], [2.62, 0.90], [2.62, 1.20], [2.10, 1.30],
      [1.62, 1.62], [1.45, 2.30], [1.40, 2.62], [1.28, 3.12], [0.86, 3.12], [0.72, 2.60], [0.52, 1.62], [0.20, 1.56]];
    prism('paint', plate, 0.07, -0.34);
    prism('paint', plate, 0.07, 0.34);
    box('paint', 0.55, 0.14, 0.62, 1.00, 2.00, 0);
    box('paint', 0.90, 0.10, 0.62, 0.95, 0.56, 0);
    box('paint', 0.52, 0.08, 0.60, 0.06, 1.54, 0);
    box('paint', 0.52, 0.08, 0.60, 0.06, 0.50, 0);
    cylY('iron', 0.12, 0.10, 0, 1.54, 0);
    cylY('iron', 0.12, 0.10, 0, 0.50, 0);
    for (const s of [-1, 1]) {
      cylZ('iron', 0.13, 0.30, K.P[0], K.P[1], s * 0.45);
      cylZ('iron', 0.10, 0.20, K.liftBase[0], K.liftBase[1], s * 0.45);
      cylZ('iron', 0.07, 0.10, 0.38, 0.95, s * 0.43);
      box('iron', 0.42, 0.06, 0.12, 1.90, 1.15, s * 0.30);
    }
    cylZ('iron', 0.08, 0.66, K.F[0], K.F[1], 0);
    for (const s of [-1, 1]) box('paint', 0.34, 0.30, 0.04, K.F[0], K.F[1] - 0.04, s * 0.12);
    box('paint', 0.10, 0.70, 0.62, 1.40, 2.05, 0);
    // Hoses: control valve to the lift-cylinder ports, and up the tower to the tilt cylinder.
    for (const s of [-1, 1]) {
      for (const k of [0, 1]) {
        hose('hose', 0.028, [[1.18, 1.56 - k * 0.07, s * (0.12 + k * 0.05)], [1.10, 1.36 - k * 0.05, s * (0.26 + k * 0.03)], [0.95, 1.20, s * 0.36], [0.83, 1.12 + k * 0.06, s * 0.41]]);
        hose('hose', 0.026, [[0.93 + k * 0.05, 1.86, s * 0.06], [0.88, 2.20, s * 0.08], [0.94, 2.55, s * 0.10], [1.06 + k * 0.04, 2.78, s * 0.09]]);
      }
      sph('steel', 0.04, 0.83, 1.12, s * 0.41);
      sph('steel', 0.04, 0.83, 1.18, s * 0.41);
    }
  }

  /* 9 Articulation hitch pins */
  { const p = P('hitch');
    addNode(p, { off: [0, 1.5, 0] });
    cylY('steel', 0.065, 0.32, 0, 1.485, 0);
    cylY('iron', 0.095, 0.035, 0, 1.66, 0);
    addNode(p, { off: [0.4, 0, 0] });
    cylY('steel', 0.065, 0.32, 0, 0.57, 0);
    cylY('iron', 0.095, 0.035, 0, 0.745, 0);
  }

  /* 10 Steering cylinders (rear frame to front frame, follow articulation) */
  { const p = P('steercyl');
    for (const s of [-1, 1]) {
      const n = addNode(p, { off: [0.4, 0, s * 1.4] });
      const set = hydraulic(0.075, 0.042, 0.68);
      const A = new T.Vector3(-0.85, 0.95, s * 0.59), Bf = new T.Vector3(0.38, 0.95, s * 0.43), Bw = new T.Vector3();
      n.pose = (nn) => { Bw.copy(Bf).applyQuaternion(qSteer); set(A, Bw, nn); };
    }
  }

  /* 12 Counterweight */
  { const p = P('cwt'); addNode(p, { off: [-2.6, 0, 0] });
    prism('paint', [[-4.09, 0.59], [-4.38, 0.59], [-4.49, 0.74], [-4.49, 1.22], [-4.41, 1.34], [-4.09, 1.34]], 1.94, 0, 0.07, 4);
    pbox('black', 0.02, 0.18, 0.44, -4.565, 0.90, 0);
    pbox('black', 0.012, 0.03, 1.80, -4.562, 1.06, 0);
    for (const s of [-1, 1]) pbox('red', 0.02, 0.10, 0.20, -4.565, 1.15, s * 0.78);
  }

  /* 13 Engine */
  { const p = P('engine'); addNode(p, { off: [0, 1.6, 0] });
    box('iron', 1.22, 0.80, 0.60, -3.09, 1.82, 0);
    box('iron', 1.02, 0.20, 0.50, -3.09, 1.32, 0);
    box('iron', 1.16, 0.25, 0.52, -3.10, 2.345, 0);
    box('paint', 1.08, 0.13, 0.44, -3.12, 2.535, 0);
    cylX('iron', 0.36, 0.12, -2.42, 1.70, 0, 32);
    cylX('steel', 0.15, 0.06, -3.73, 1.62, 0);
    cylX('steel', 0.10, 0.22, -3.60, 2.08, -0.40);
    cylX('steel', 0.07, 0.30, -2.70, 1.46, -0.38);
    box('steel', 1.00, 0.12, 0.08, -3.10, 2.06, 0.34);
    box('iron', 1.00, 0.15, 0.08, -3.10, 2.12, -0.34);
    cylX('steel', 0.15, 0.20, -2.95, 2.30, 0.50);
    cylX('steel', 0.13, 0.16, -3.17, 2.30, 0.50);
    cylY('steel', 0.06, 0.22, -2.85, 1.62, 0.40);
    hose('steel', 0.055, [[-3.02, 2.42, 0.50], [-3.30, 2.64, 0.47], [-3.62, 2.66, 0.40], [-3.74, 2.52, 0.34]]);
    hose('steel', 0.05, [[-3.74, 2.30, -0.36], [-3.55, 2.27, -0.42], [-3.20, 2.24, -0.40]]);
    hose('hose', 0.035, [[-3.72, 2.05, 0.18], [-3.76, 2.12, 0.22], [-3.78, 2.22, 0.24]]);
    hose('black', 0.012, [[-2.60, 1.96, -0.31], [-3.00, 1.98, -0.315], [-3.55, 1.97, -0.31]]);
  }

  /* 14 Exhaust aftertreatment + stack */
  { const p = P('cem'); addNode(p, { off: [0, 0, 2.0] });
    cylX('steel', 0.25, 0.95, -2.70, 3.02, 0.30, 32);
    cylX('iron', 0.26, 0.04, -3.18, 3.02, 0.30, 32);
    cylX('iron', 0.26, 0.04, -2.22, 3.02, 0.30, 32);
    box('steel', 0.90, 0.36, 0.36, -2.70, 2.98, -0.24);
    box('iron', 0.08, 0.12, 0.62, -2.70, 2.82, 0.03);
    cylY('steel', 0.075, 0.66, -2.30, 3.43, 0.30);
    cylY('iron', 0.09, 0.04, -2.30, 3.744, 0.30);
    cylY('black', 0.088, 0.012, -2.33, 3.79, 0.30).rotation.z = 0.35;
  }

  /* 16 Engine enclosure: sloped hood, side louvres, rear grille */
  { const p = P('hood'); addNode(p, { off: [0, 4.0, 0] });
    prism('paint', [[-2.25, 1.53], [-2.25, 2.964], [-3.30, 2.93], [-3.85, 2.86], [-4.08, 2.76], [-4.17, 2.64], [-4.26, 1.53]], 1.40, 0, 0.10, 5);
    for (const s of [-1, 1]) {
      const zf = s * 0.805;
      pbox('grille', 0.95, 0.34, 0.01, -3.45, 2.42, zf);
      pbox('grille', 0.55, 0.34, 0.01, -2.62, 2.42, zf);
      pbox('black', 0.012, 1.15, 0.012, -2.935, 2.16, zf);
      pbox('black', 0.012, 1.15, 0.012, -3.98, 2.16, zf);
      pbox('lens', 0.03, 0.10, 0.10, -4.30, 2.50, s * 0.69);
    }
    pbox('grille', 0.03, 1.00, 1.24, -4.335, 2.09, 0).rotation.z = -0.081;
    cylY('black', 0.11, 0.26, -3.75, 3.10, -0.55);
    cylY('black', 0.16, 0.07, -3.75, 3.26, -0.55);
  }

  /* 15 Cooling package (sits inside the rear of the hood) */
  { const p = P('cooling'); addNode(p, { off: [-1.6, 0, 0] });
    pbox('grille', 0.10, 1.10, 1.36, -3.98, 2.05, 0);
    box('steel', 0.06, 1.10, 1.36, -4.09, 2.05, 0);
    box('paint', 0.34, 0.06, 1.46, -4.04, 2.63, 0);
    box('paint', 0.34, 0.06, 1.46, -4.04, 1.47, 0);
    for (const s of [-1, 1]) box('paint', 0.34, 1.22, 0.06, -4.04, 2.05, s * 0.70);
    add(new T.TorusGeometry(0.50, 0.035, 10, 40), 'black', -3.88, 2.05, 0).rotation.y = Math.PI / 2;
    cylX('iron', 0.09, 0.10, -3.86, 2.05, 0);
    for (let i = 0; i < 7; i++) {
      const a = i * 2 * Math.PI / 7;
      box('black', 0.025, 0.38, 0.13, -3.86, 2.05 + 0.26 * Math.cos(a), 0.26 * Math.sin(a)).rotation.set(a, 0.35, 0);
    }
  }

  /* 17 Fuel tank */
  { const p = P('fuel'); addNode(p, { off: [0, 0, -1.9] });
    prism('paint', [[-3.58, 0.72], [-2.58, 0.72], [-2.54, 0.80], [-2.54, 1.16], [-3.62, 1.16], [-3.62, 0.78]], 0.76, 0, 0.02);
    pbox('black', 0.20, 0.08, 0.02, -3.00, 1.00, -0.405);
    cylZ('black', 0.05, 0.08, -2.75, 1.05, -0.44);
  }

  /* 18 DEF tank */
  { const p = P('def'); addNode(p, { off: [0, 0, -1.7] });
    box('black', 0.34, 0.36, 0.24, -1.90, 2.20, -0.66);
    cylY('blue', 0.055, 0.06, -1.82, 2.41, -0.66);
  }

  /* 28 Hydraulic tank */
  { const p = P('hydtank'); addNode(p, { off: [0, 0, 2.3] });
    prism('paint', [[-2.08, 2.02], [-1.56, 2.02], [-1.56, 2.66], [-1.64, 2.74], [-2.08, 2.74]], 0.40, 0.58, 0.02);
    cylY('black', 0.05, 0.08, -1.95, 2.80, 0.58);
    pbox('glass', 0.012, 0.18, 0.08, -1.53, 2.35, 0.58);
  }

  /* 19 Torque converter & transmission */
  { const p = P('trans'); addNode(p, { off: [0, 0, 1.9] });
    cylX('iron', 0.36, 0.30, -2.21, 1.66, 0, 32);
    cylX('iron', 0.31, 0.96, -1.58, 1.60, 0, 32);
    for (const xx of [-1.92, -1.58, -1.24]) cylX('steel', 0.325, 0.04, xx, 1.60, 0, 32);
    box('steel', 0.50, 0.26, 0.10, -1.45, 1.58, 0.35);
    box('iron', 0.32, 0.76, 0.44, -0.96, 1.30, 0);
    cylX('steel', 0.08, 0.06, -1.15, 0.98, 0);
    cylX('steel', 0.08, 0.06, -0.77, 0.98, 0);
    hose('hose', 0.022, [[-1.40, 1.32, 0.30], [-1.20, 1.20, 0.28], [-1.05, 1.15, 0.24]]);
    hose('hose', 0.022, [[-1.40, 1.36, -0.30], [-1.20, 1.24, -0.28], [-1.05, 1.18, -0.24]]);
  }

  /* 25 Hydraulic pumps (on the converter pump drive) */
  { const p = P('pumps'); addNode(p, { off: [0, 0, -1.5] });
    cylX('steel', 0.09, 0.34, -1.89, 1.36, 0.36);
    box('iron', 0.10, 0.16, 0.16, -1.68, 1.36, 0.36);
    cylX('steel', 0.08, 0.28, -1.92, 1.36, -0.36);
    box('iron', 0.08, 0.14, 0.14, -1.74, 1.36, -0.36);
  }

  /* 21 / 22 Axles */
  function axle(front) {
    const x0 = front ? 1.90 : -1.90, y0 = 0.935, dir = front ? -1 : 1;
    cylZ('iron', 0.16, 1.90, x0, y0, 0, 28);
    sph('iron', 0.34, x0, y0, 0);
    cylX('iron', 0.15, 0.20, x0 + dir * 0.30, y0, 0);
    cylX('steel', 0.085, 0.05, x0 + dir * 0.425, y0, 0);
    for (const s of [-1, 1]) {
      cylZ('steel', 0.24, 0.18, x0, y0, s * 0.72, 28);
      cylZ('iron', 0.27, 0.26, x0, y0, s * 1.04, 28);
      cylZ('iron', 0.30, 0.04, x0, y0, s * 1.19, 28);
    }
    if (front) {
      cylX('steel', 0.20, 0.03, x0 + dir * 0.33, y0, 0, 28);
      box('red', 0.08, 0.10, 0.10, x0 + dir * 0.33, y0 + 0.20, 0.06);
    } else {
      box('iron', 0.50, 0.12, 0.30, x0, y0 + 0.28, 0);
    }
  }
  { const p = P('faxle'); addNode(p, { front: true, off: [0.8, -0.45, 0] }); axle(true); }
  { const p = P('raxle'); addNode(p, { off: [0, -0.45, 0] }); axle(false); }

  /* 23 / 24 Wheels and 29.5R25 tires */
  const tireGeo = new T.LatheGeometry([[0.34, -0.37], [0.52, -0.40], [0.80, -0.40], [0.865, -0.375], [0.893, -0.31], [0.90, -0.18],
    [0.90, 0.18], [0.893, 0.31], [0.865, 0.375], [0.80, 0.40], [0.52, 0.40], [0.34, 0.37]].map((a) => new T.Vector2(a[0], a[1])), 48);
  tireGeo.rotateX(Math.PI / 2);
  const lugGeo = new T.BoxGeometry(0.13, 0.075, 0.34);
  const shGeo = new T.BoxGeometry(0.11, 0.16, 0.07);
  const dishGeo = new T.CylinderGeometry(0.20, 0.33, 0.10, 32, 1, true);
  dishGeo.rotateX(Math.PI / 2);
  const rimGeo = new T.CylinderGeometry(0.34, 0.34, 0.62, 32, 1, true);
  rimGeo.rotateX(Math.PI / 2);
  const flangeGeo = new T.TorusGeometry(0.345, 0.022, 8, 40);
  function wheel(p, x, side, front) {
    addNode(p, { front, off: [front ? 0.8 : 0, 0, side * 2.3] });
    const w = new T.Group();
    w.position.set(x, 0.935, side * 1.22);
    if (side < 0) w.rotation.y = Math.PI;
    const outer = CUR.g;
    outer.add(w);
    CUR.g = w;
    add(tireGeo, 'rubber');
    const lugs = new T.InstancedMesh(lugGeo, p.m('rubber'), 52);
    const m4 = new T.Matrix4(), q = new T.Quaternion(), qa = new T.Quaternion(), qb = new T.Quaternion();
    const pos = new T.Vector3(), sc = new T.Vector3(1, 1, 1);
    let k = 0;
    for (let i = 0; i < 26; i++) {
      for (const s of [-1, 1]) {
        const a = (i + (s > 0 ? 0 : 0.5)) * 2 * Math.PI / 26;
        pos.set(0.905 * Math.cos(a), 0.905 * Math.sin(a), s * 0.20);
        qa.setFromAxisAngle(ZV, a - Math.PI / 2);
        qb.setFromAxisAngle(UP, s * 0.32);
        q.multiplyQuaternions(qa, qb);
        m4.compose(pos, q, sc);
        lugs.setMatrixAt(k++, m4);
      }
    }
    lugs.instanceMatrix.needsUpdate = true;
    lugs.castShadow = true;
    lugs.receiveShadow = true;
    lugs.frustumCulled = false;
    lugs.userData.pid = p.id;
    w.add(lugs);
    p.meshes.push(lugs);
    PICK.push(lugs);
    // Shoulder lugs carry the tread down onto the sidewall.
    const sh = new T.InstancedMesh(shGeo, p.m('rubber'), 52);
    k = 0;
    for (let i = 0; i < 26; i++) {
      for (const s of [-1, 1]) {
        const a = (i + (s > 0 ? 0 : 0.5)) * 2 * Math.PI / 26;
        pos.set(0.835 * Math.cos(a), 0.835 * Math.sin(a), s * 0.385);
        q.setFromAxisAngle(ZV, a - Math.PI / 2);
        m4.compose(pos, q, sc);
        sh.setMatrixAt(k++, m4);
      }
    }
    sh.instanceMatrix.needsUpdate = true;
    sh.castShadow = true;
    sh.receiveShadow = true;
    sh.frustumCulled = false;
    sh.userData.pid = p.id;
    w.add(sh);
    p.meshes.push(sh);
    PICK.push(sh);
    add(rimGeo, 'paintDS');
    for (const zz of [-0.30, 0.30]) add(flangeGeo, 'paint', 0, 0, zz);
    cylZ('paint', 0.335, 0.03, 0, 0, 0.10, 32);
    add(dishGeo, 'paintDS', 0, 0, 0.10);
    cylZ('iron', 0.17, 0.12, 0, 0, 0.15, 24);
    for (let i = 0; i < 10; i++) {
      const a = i * Math.PI / 5;
      cylZ('steel', 0.018, 0.06, 0.12 * Math.cos(a), 0.12 * Math.sin(a), 0.22, 8);
    }
    CUR.g = outer;
  }
  { const p = P('ftires'); wheel(p, 1.90, -1, true); wheel(p, 1.90, 1, true); }
  { const p = P('rtires'); wheel(p, -1.90, -1, false); wheel(p, -1.90, 1, false); }

  /* 3 Lift arms (built along the arm: pivot at origin, hinge pin at x = R) */
  { const p = P('arms');
    const n = addNode(p, { front: true, off: [0.8, 1.1, 0] });
    // Arched arm: deepest near the pivot, bowed up over the front tire, tapering to the bucket pin.
    const prof = [[-0.05, 0.21], [0.45, 0.30], [1.10, 0.36], [1.80, 0.33], [2.40, 0.24], [2.85, 0.15], [3.15, 0.10],
      [3.15, -0.10], [2.85, -0.12], [2.40, -0.07], [1.80, -0.04], [1.20, -0.08], [0.60, -0.17], [-0.05, -0.21]];
    for (const s of [-1, 1]) {
      prism('paint', prof, 0.13, s * K.zArm, 0.02);
      cylZ('paint', 0.20, 0.15, 0, 0, s * K.zArm);
      cylZ('paint', 0.13, 0.15, K.R, 0, s * K.zArm);
      cylZ('iron', 0.09, 0.18, K.liftArm[0], K.liftArm[1], s * 0.53);
      box('paint', 0.30, 0.26, 0.05, K.liftArm[0], -0.15, s * 0.585);
      box('paint', 0.55, 0.20, 0.05, (1.70 + K.C[0]) / 2, (0.04 + K.C[1]) / 2, s * 0.15).rotation.z = Math.atan2(K.C[1] - 0.04, K.C[0] - 1.70);
    }
    cylZ('paint', 0.12, 1.30, 1.70, 0.04, 0);
    cylZ('iron', 0.08, 0.40, K.C[0], K.C[1], 0);
    n.pose = (nn, k) => { nn.p0.set(K.P[0], K.P[1], 0); nn.q0.setFromAxisAngle(ZV, k.alpha); };
  }

  /* 4 Bellcrank (built along the lever: pivot at origin, cylinder end at +rT, link end at -rL) */
  { const p = P('bellcrank');
    const n = addNode(p, { front: true, off: [0.8, 2.1, 0] });
    prism('paint', [[-K.rL, 0.11], [K.rT, 0.09], [K.rT, -0.09], [-K.rL, -0.11]], 0.18, 0, 0.015);
    cylZ('paint', 0.15, 0.20, 0, 0, 0);
    cylZ('paint', 0.12, 0.20, K.rT, 0, 0);
    cylZ('paint', 0.12, 0.20, -K.rL, 0, 0);
    n.pose = (nn, k) => { nn.p0.set(k.C[0], k.C[1], 0); nn.q0.setFromAxisAngle(ZV, Math.atan2(k.T[1] - k.L[1], k.T[0] - k.L[0])); };
  }

  /* 5 Tilt link */
  { const p = P('link');
    const n = addNode(p, { front: true, off: [1.4, 2.1, 0] });
    box('paint', K.Lk, 0.15, 0.12, K.Lk / 2, 0, 0);
    cylZ('paint', 0.10, 0.14, 0, 0, 0);
    cylZ('paint', 0.10, 0.14, K.Lk, 0, 0);
    n.pose = (nn, k) => { nn.p0.set(k.L[0], k.L[1], 0); nn.q0.setFromAxisAngle(ZV, Math.atan2(k.B[1] - k.L[1], k.B[0] - k.L[0])); };
  }

  /* 6 Tilt cylinder (tower top to bellcrank top) */
  { const p = P('tiltcyl');
    const n = addNode(p, { front: true, off: [0.8, 3.0, 0] });
    const set = hydraulic(0.13, 0.07, 1.0);
    const A = new T.Vector3(K.F[0], K.F[1], 0), Bv = new T.Vector3();
    n.pose = (nn, k) => { Bv.set(k.T[0], k.T[1], 0); set(A, Bv, nn); };
  }

  /* 7 Lift cylinders (front frame to lift arms) */
  { const p = P('liftcyl');
    for (const s of [-1, 1]) {
      const n = addNode(p, { front: true, off: [0.8, 0, s * 1.2] });
      const set = hydraulic(0.11, 0.065, 1.45);
      const A = new T.Vector3(K.liftBase[0], K.liftBase[1], s * K.zLift), Bv = new T.Vector3();
      n.pose = (nn, k) => { const w = k.toW(K.liftArm[0], K.liftArm[1]); Bv.set(w[0], w[1], s * K.zLift); set(A, Bv, nn); };
    }
  }

  /* 1 Bucket (built around the hinge pin: floor at y = -0.56, lip forward) */
  { const p = P('bucket');
    const n = addNode(p, { front: true, off: [2.6, 0, 0] });
    const heel = arcPts(0.45, -0.20, 0.36, -Math.PI / 2, -Math.PI, 8);
    const topArc = arcPts(0.39, 0.62, 0.30, Math.PI, Math.PI / 2, 8);
    const path = [[1.80, -0.56]].concat(heel, [[0.09, 0.62]], topArc.slice(1), [[0.66, 0.95]]);
    // Side plates get a curved front edge from the lip down to the cutting edge.
    const edge = [];
    for (let i = 1; i < 6; i++) {
      const t = i / 6, u = 1 - t;
      edge.push([u * u * 0.66 + 2 * u * t * 1.45 + t * t * 1.80, u * u * 0.95 + 2 * u * t * 0.62 - t * t * 0.56]);
    }
    prism('paintDS', thickPath(path, 0.045), 3.40, 0);
    for (const s of [-1, 1]) prism('paint', path.concat(edge), 0.05, s * 1.705);
    cylZ('paint', 0.045, 3.40, 0.63, 0.955, 0);
    for (const s of [-1, 1]) {
      for (const t of [-1, 1]) box('paint', 0.34, 0.44, 0.05, 0.02, 0.02, s * K.zArm + t * 0.105);
      cylZ('iron', 0.08, 0.30, 0, 0, s * K.zArm);
      hose('wear', 0.035, [[0.66, 0.95, s * 1.75]].concat(edge.map((e) => [e[0], e[1], s * 1.75]), [[1.80, -0.56, s * 1.75]]));
    }
    for (const t of [-1, 1]) box('paint', 0.30, 0.36, 0.05, 0.10, 0.40, t * 0.10);
    cylZ('iron', 0.07, 0.30, K.b[0], K.b[1], 0);
    for (const zz of [-1.1, -0.37, 0.37, 1.1]) box('wear', 1.10, 0.025, 0.10, 1.10, -0.595, zz);
    n.pose = (nn, k) => { nn.p0.set(k.H[0], k.H[1], 0); nn.q0.setFromAxisAngle(ZV, k.theta); };
  }

  /* 2 Bolt-on cutting edge */
  { const p = P('boce');
    const n = addNode(p, { front: true, off: [3.6, 0, 0] });
    box('wear', 0.34, 0.045, 3.42, 1.79, -0.565, 0);
    for (let i = 0; i < 14; i++) cylY('steel', 0.024, 0.02, 1.70, -0.535, -1.56 + i * 0.24, 10);
    n.pose = (nn, k) => { nn.p0.set(k.H[0], k.H[1], 0); nn.q0.setFromAxisAngle(ZV, k.theta); };
  }

  /* 26 Main control valve */
  { const p = P('mcv'); addNode(p, { front: true, off: [0.8, 0, -1.3] });
    box('steel', 0.55, 0.26, 0.40, 1.00, 1.70, 0);
    for (const zz of [-0.12, 0, 0.12]) {
      cylX('iron', 0.045, 0.06, 1.305, 1.70, zz, 12);
      box('black', 0.10, 0.08, 0.08, 0.86, 1.87, zz);
    }
  }

  /* 27 Ride control accumulators */
  { const p = P('accum'); addNode(p, { front: true, off: [0.8, 0, 1.3] });
    for (const zz of [-0.15, 0.15]) {
      cylY('black', 0.09, 0.40, 0.55, 1.95, zz, 20);
      sph('black', 0.09, 0.55, 2.15, zz);
      sph('black', 0.09, 0.55, 1.75, zz);
      cylY('steel', 0.03, 0.06, 0.55, 2.27, zz, 8);
    }
    box('iron', 0.10, 0.06, 0.50, 0.55, 1.63, 0);
  }

  /* 20 Drive shafts: rear stub, front shaft to the centre bearing, front shaft through the hitch */
  { const p = P('shafts');
    const uj = (x, y) => box('steel', 0.10, 0.14, 0.14, x, y, 0);
    addNode(p, { off: [0, 0, -1.5] });
    tube('steel', 0.055, [-0.74, 0.98, 0], [-0.06, 0.97, 0]);
    uj(-0.74, 0.98);
    box('iron', 0.12, 0.20, 0.30, -0.12, 0.97, 0);
    addNode(p, { front: true, off: [0, 0, -1.5] });
    tube('steel', 0.055, [0.0, 0.97, 0], [1.42, 0.935, 0]);
    uj(0.03, 0.97);
    uj(1.42, 0.935);
    addNode(p, { off: [0, 0, -1.5] });
    tube('steel', 0.055, [-1.18, 0.98, 0], [-1.42, 0.935, 0]);
    uj(-1.20, 0.98);
    uj(-1.42, 0.935);
  }

  /* 29 Cab: curved windscreen, roof overhang, work lights, mirrors */
  { const p = P('cab'); addNode(p, { off: [0, 2.7, 0] });
    box('black', 1.70, 0.16, 1.70, -0.60, 2.10, 0);
    box('black', 1.70, 0.20, 1.70, -0.60, 2.28, 0);
    for (const xx of [-1.40, 0.10]) for (const zz of [-0.80, 0.80]) box('black', 0.10, 1.40, 0.10, xx, 3.07, zz);
    add(new T.CylinderGeometry(2.2, 2.2, 1.36, 24, 1, true, Math.PI / 2 - 0.372, 0.744), 'glass', -1.9494, 3.06, 0);
    for (const s of [-1, 1]) pbox('glass', 1.40, 1.32, 0.02, -0.65, 3.06, s * 0.82);
    pbox('glass', 0.02, 1.24, 1.50, -1.43, 3.10, 0);
    pbox('black', 0.035, 1.30, 0.035, -0.62, 3.05, -0.835);
    pbox('black', 0.12, 0.04, 0.05, -0.80, 2.72, -0.85);
    box('black', 1.82, 0.07, 1.78, -0.62, 3.745, 0);
    box('paint', 2.00, 0.08, 1.90, -0.60, 3.789, 0);
    box('black', 0.52, 0.14, 0.52, -0.80, 2.60, 0);
    box('black', 0.14, 0.72, 0.52, -1.06, 2.98, 0);
    box('black', 0.30, 0.34, 0.14, -0.70, 2.55, 0.36);
    cylY('black', 0.025, 0.14, -0.62, 2.79, 0.36, 8);
    pbox('screen', 0.04, 0.22, 0.32, -0.02, 3.00, 0.42);
    box('black', 0.10, 0.36, 0.62, -1.51, 3.25, 0);
    pbox('black', 0.012, 0.72, 0.02, 0.255, 2.86, 0.10).rotation.x = 0.45;
    tube('paint', 0.016, [-1.47, 2.45, -0.87], [-1.47, 3.40, -0.87]);
    pbox('black', 0.01, 0.16, 1.40, 0.08, 3.64, 0);
    cylY('iron', 0.075, 0.03, -1.25, 3.845, -0.66);
    cylY('amber', 0.06, 0.09, -1.25, 3.905, -0.66);
    sph('amber', 0.06, -1.25, 3.95, -0.66);
    for (const s of [-1, 1]) {
      tube('black', 0.018, [0.10, 3.40, s * 0.85], [0.36, 3.40, s * 1.04]);
      box('black', 0.05, 0.30, 0.20, 0.38, 3.32, s * 1.10);
      box('black', 0.10, 0.10, 0.16, 0.33, 3.70, s * 0.62);
      pbox('lens', 0.012, 0.08, 0.13, 0.386, 3.70, s * 0.62);
      box('black', 0.10, 0.10, 0.16, -1.53, 3.70, s * 0.62);
      pbox('lens', 0.012, 0.08, 0.13, -1.586, 3.70, s * 0.62);
    }
  }

  /* 30 Access stairway (left side) */
  { const p = P('stairs'); addNode(p, { off: [0, 0, -1.5] });
    const z1 = -0.86, z2 = -1.30, zm = (z1 + z2) / 2;
    for (const zz of [z1, z2]) tube('black', 0.03, [-0.15, 0.50, zz], [-0.85, 2.00, zz]);
    for (let i = 0; i < 5; i++) { const t = (i + 0.5) / 5; box('black', 0.20, 0.03, 0.44, -0.15 - 0.70 * t, 0.50 + 1.50 * t, zm); }
    tube('paint', 0.022, [-0.10, 1.40, z2], [-0.80, 2.90, z2]);
    tube('paint', 0.022, [-0.10, 0.60, z2], [-0.10, 1.40, z2]);
    tube('paint', 0.022, [-0.80, 2.00, z2], [-0.80, 2.90, z2]);
    box('black', 0.40, 0.03, 0.46, -0.95, 2.00, zm);
  }

  /* 31 Fenders: solid curved plates over each tire */
  { const p = P('fenders');
    for (const s of [-1, 1]) { addNode(p, { front: true, off: [0.8, 0.9, s * 2.3] }); band('paint', 1.00, 1.045, 20 * DEG, 125 * DEG, 0.86, 1.90, 0.935, s * 1.22); }
    for (const s of [-1, 1]) { addNode(p, { off: [0, 0.9, s * 2.3] }); band('paint', 1.00, 1.045, 55 * DEG, 160 * DEG, 0.86, -1.90, 0.935, s * 1.245); }
  }

  // Static nodes keep their build-time placement as the assembled pose.
  for (const n of NODES) if (!n.pose) { n.p0.set(0, 0, 0); n.q0.identity(); }
}

/* ---------- Scene setup, overlay, input, render loop ---------- */
const appEl = document.querySelector('[data-xv]');
const stageEl = document.getElementById('stage');
const canvasEl = document.getElementById('gl');
const tipEl = document.getElementById('tip');
const leadersEl = document.getElementById('leaders');
const tagsEl = document.getElementById('tags');
const dimsEl = document.getElementById('dims');
const TAGS = {};
const DIMLABELS = [];
let pinLabel = null;
let hoverPt = null;
let floorMat, gridMat, groundMat;

function makeEnv() {
  const env = new T.Scene();
  const geo = new T.SphereGeometry(50, 32, 16);
  const pos = geo.attributes.position, cols = [];
  for (let i = 0; i < pos.count; i++) {
    const t = (pos.getY(i) / 50 + 1) / 2;
    cols.push(0.04 + 0.36 * t, 0.045 + 0.36 * t, 0.05 + 0.37 * t);
  }
  geo.setAttribute('color', new T.Float32BufferAttribute(cols, 3));
  env.add(new T.Mesh(geo, new T.MeshBasicMaterial({ vertexColors: true, side: T.BackSide })));
  const panel = new T.MeshBasicMaterial({ color: 0xffffff });
  const a = new T.Mesh(new T.PlaneGeometry(36, 14), panel); a.position.set(0, 32, 8); a.lookAt(0, 0, 0); env.add(a);
  const b = new T.Mesh(new T.PlaneGeometry(22, 10), panel); b.position.set(-38, 12, -12); b.lookAt(0, 0, 0); env.add(b);
  const pm = new T.PMREMGenerator(renderer);
  const tex = pm.fromScene(env, 0.02).texture;
  pm.dispose();
  return tex;
}

/* Studio floor: a soft pool of light under the machine (so shadows read in both themes),
   the shadow catcher, and a 1 m grid that fades out toward the edges. */
function buildFloor() {
  const fc = document.createElement('canvas');
  fc.width = fc.height = 256;
  const g = fc.getContext('2d');
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.6)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  floorMat = new T.MeshBasicMaterial({ map: new T.CanvasTexture(fc), transparent: true, depthWrite: false, toneMapped: false });
  const pool = new T.Mesh(new T.PlaneGeometry(32, 22), floorMat);
  pool.rotation.x = -Math.PI / 2;
  pool.position.set(0.5, 0.001, 0);
  pool.renderOrder = -3;
  scene.add(pool);
  groundMat = new T.ShadowMaterial({ opacity: 0.24, depthWrite: false });
  const ground = new T.Mesh(new T.PlaneGeometry(90, 90), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0.002;
  ground.receiveShadow = true;
  ground.renderOrder = -2;
  scene.add(ground);
  gridMat = new T.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uColor: { value: new T.Color('#6E787E') }, uOpacity: { value: 0.25 } },
    vertexShader: 'varying vec2 vXZ;\nvoid main() {\n  vec4 w = modelMatrix * vec4(position, 1.0);\n  vXZ = w.xz;\n  gl_Position = projectionMatrix * viewMatrix * w;\n}',
    fragmentShader: 'uniform vec3 uColor;\nuniform float uOpacity;\nvarying vec2 vXZ;\nvoid main() {\n' +
      '  vec2 g = abs(fract(vXZ - 0.5) - 0.5) / fwidth(vXZ);\n' +
      '  float line = 1.0 - min(min(g.x, g.y), 1.0);\n' +
      '  float fade = 1.0 - smoothstep(0.35, 1.0, length((vXZ - vec2(0.5, 0.0)) / vec2(13.0, 9.0)));\n' +
      '  float a = line * fade * uOpacity;\n' +
      '  if (a < 0.004) discard;\n' +
      '  gl_FragColor = vec4(uColor, a);\n  #include <colorspace_fragment>\n}'
  });
  const grid = new T.Mesh(new T.PlaneGeometry(40, 30), gridMat);
  grid.rotation.x = -Math.PI / 2;
  grid.position.set(0.5, 0.003, 0);
  grid.renderOrder = -1;
  scene.add(grid);
}

// Colours for the selection and the grid come from the viewer's own CSS
function readTheme() {
  const cs = getComputedStyle(appEl);
  const tok = (name, fallback) => (cs.getPropertyValue(name) || '').trim() || fallback;
  ACCENT.set(tok('--xv-select', '#0A78A8'));
  gridMat.uniforms.uColor.value.set(tok('--xv-grid', '#6E787E'));
  gridMat.uniforms.uOpacity.value = 0.28;
  floorMat.color.set('#F7F9F5');
  groundMat.opacity = 0.24;
  if (dimMat) dimMat.color.copy(ACCENT);
  refreshLook();
  dirty = true;
}

/* Dimension lines, drawn to the spec-sheet values (shown when assembled and steered straight). */
function buildDims() {
  dimMat = new T.LineBasicMaterial({ color: ACCENT.clone(), depthTest: false, transparent: true, toneMapped: false });
  dimGroup = new T.Group();
  scene.add(dimGroup);
  const segs = [];
  const seg = (a, b) => segs.push(a[0], a[1], a[2], b[0], b[1], b[2]);
  const defs = [
    { a: [-1.90, 0.03, 2.05], b: [1.90, 0.03, 2.05], t: [0, 0, 0.1], text: 'Wheelbase 3.80 m',
      ext: [[[-1.90, 0.03, 1.63], [-1.90, 0.03, 2.15]], [[1.90, 0.03, 1.63], [1.90, 0.03, 2.15]]] },
    { a: [-4.561, 0.03, -2.05], b: [3.594, 0.03, -2.05], t: [0, 0, 0.1], text: 'Length without bucket 8.15 m',
      ext: [[[-4.561, 0.03, -1.05], [-4.561, 0.03, -2.15]], [[3.594, 0.03, -0.68], [3.594, 0.03, -2.15]]] },
    { a: [-0.60, 0, -2.05], b: [-0.60, 3.829, -2.05], t: [0.1, 0, 0], text: 'Top of cab 3.83 m',
      ext: [[[-0.60, 3.829, -0.92], [-0.60, 3.829, -2.15]]] },
    { a: [-3.15, 0.03, -1.63], b: [-3.15, 0.03, 1.63], t: [0.1, 0, 0], text: 'Over tyres 3.26 m',
      ext: [[[-1.90, 0.03, -1.63], [-3.25, 0.03, -1.63]], [[-1.90, 0.03, 1.63], [-3.25, 0.03, 1.63]]] }
  ];
  for (const d of defs) {
    seg(d.a, d.b);
    for (const end of [d.a, d.b]) seg([end[0] - d.t[0], end[1] - d.t[1], end[2] - d.t[2]], [end[0] + d.t[0], end[1] + d.t[1], end[2] + d.t[2]]);
    for (const e of d.ext) seg(e[0], e[1]);
    const el = document.createElement('div');
    el.className = 'dim-label';
    el.textContent = d.text;
    dimsEl.appendChild(el);
    DIMLABELS.push({ el, at: new T.Vector3((d.a[0] + d.b[0]) / 2, (d.a[1] + d.b[1]) / 2, (d.a[2] + d.b[2]) / 2) });
  }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(segs, 3));
  const lines = new T.LineSegments(g, dimMat);
  lines.renderOrder = 10;
  dimGroup.add(lines);
  const pg = new T.BufferGeometry();
  pg.setAttribute('position', new T.Float32BufferAttribute(new Array(18).fill(0), 3));
  dimPin = new T.LineSegments(pg, dimMat);
  dimPin.renderOrder = 10;
  dimPin.frustumCulled = false;
  dimGroup.add(dimPin);
  pinLabel = document.createElement('div');
  pinLabel.className = 'dim-label';
  dimsEl.appendChild(pinLabel);
  DIMLABELS.push({ el: pinLabel, at: new T.Vector3() });
  dimGroup.visible = false;
}
function updatePinDim() {
  const k = K.cur, x = k.H[0], y = k.H[1], z = -2.05;
  const a = dimPin.geometry.attributes.position;
  const pts = [[x, 0, z], [x, y, z], [x, y, -0.68], [x, y, z - 0.1], [x - 0.1, 0, z], [x + 0.1, 0, z]];
  pts.forEach((p, i) => a.setXYZ(i, p[0], p[1], p[2]));
  a.needsUpdate = true;
  DIMLABELS[DIMLABELS.length - 1].at.set(x, y / 2, z);
  pinLabel.textContent = 'Hinge pin ' + y.toFixed(2) + ' m';
}

/* Numbered balloons with leader lines, like a parts-book plate. */
const _v = { a: null, c: null };
function updateOverlay() {
  const w = stageEl.clientWidth, h = stageEl.clientHeight;
  const v = _v.a;
  const pts = [];
  let cx = 0, cy = 0, cnt = 0;
  for (const p of PARTS) {
    anchorWorld(p.id, v);
    v.project(camera);
    const x = (v.x * 0.5 + 0.5) * w, y = (-v.y * 0.5 + 0.5) * h;
    const ok = v.z > -1 && v.z < 1 && x > -8 && x < w + 8 && y > -8 && y < h + 8;
    pts.push({ p, x, y, ok });
    if (ok) { cx += x; cy += y; cnt++; }
  }
  if (cnt) { cx /= cnt; cy /= cnt; }
  const iso = S.isolate && S.selected;
  const vis = [];
  for (const q of pts) {
    const t = TAGS[q.p.id];
    if (!t) continue;
    const show = S.labels && q.ok && !(iso && S.selected !== q.p.id) && (S.sys < 0 || q.p.sys === S.sys);
    t.el.hidden = !show;
    t.line.style.display = show ? '' : 'none';
    t.dot.style.display = show ? '' : 'none';
    if (!show) continue;
    const dx = q.x - cx, dy = q.y - cy;
    const dl = Math.hypot(dx, dy) || 1;
    q.t = t;
    q.bx = q.x + dx / dl * 38;
    q.by = q.y + dy / dl * 38;
    vis.push(q);
  }
  // Push overlapping balloons apart, keeping them inside the stage.
  const MIN = 27;
  for (let it = 0; it < 10; it++) {
    for (let i = 0; i < vis.length; i++) {
      const a = vis[i];
      for (let j = i + 1; j < vis.length; j++) {
        const b = vis[j];
        let ex = b.bx - a.bx, ey = b.by - a.by;
        let d = Math.hypot(ex, ey);
        if (d >= MIN) continue;
        if (d < 0.01) { ex = 1; ey = 0; d = 1; } else { ex /= d; ey /= d; }
        const push = (MIN - d) / 2;
        a.bx -= ex * push; a.by -= ey * push;
        b.bx += ex * push; b.by += ey * push;
      }
    }
    for (const a of vis) {
      a.bx = Math.max(14, Math.min(w - 58, a.bx));
      a.by = Math.max(46, Math.min(h - 14, a.by));
    }
  }
  for (const q of vis) {
    const t = q.t;
    const lx = q.bx - q.x, ly = q.by - q.y;
    const ll = Math.hypot(lx, ly) || 1;
    const ex2 = ll > 12 ? q.bx - lx / ll * 12 : q.x, ey2 = ll > 12 ? q.by - ly / ll * 12 : q.y;
    t.el.style.transform = 'translate(' + q.bx.toFixed(1) + 'px,' + q.by.toFixed(1) + 'px)';
    t.line.setAttribute('x1', q.x.toFixed(1)); t.line.setAttribute('y1', q.y.toFixed(1));
    t.line.setAttribute('x2', ex2.toFixed(1)); t.line.setAttribute('y2', ey2.toFixed(1));
    t.dot.setAttribute('cx', q.x.toFixed(1)); t.dot.setAttribute('cy', q.y.toFixed(1));
    const on = S.selected === q.p.id;
    t.el.classList.toggle('on', on);
    t.el.classList.toggle('hot', S.hovered === q.p.id);
    t.line.classList.toggle('on', on);
    t.dot.classList.toggle('on', on);
  }
  const dimsOn = S.dims && S.explode < 0.02 && Math.abs(S.steer) < 0.5;
  if (dimsOn) updatePinDim();
  if (dimGroup.visible !== dimsOn) { dimGroup.visible = dimsOn; dirty = true; }
  for (const d of DIMLABELS) {
    d.el.hidden = !dimsOn;
    if (!dimsOn) continue;
    v.copy(d.at).project(camera);
    d.el.style.transform = 'translate(' + ((v.x * 0.5 + 0.5) * w).toFixed(1) + 'px,' + ((-v.y * 0.5 + 0.5) * h).toFixed(1) + 'px) translate(-50%,-50%)';
  }
}

/* ---------- Input: orbit, pan, zoom, pick ---------- */
function pickAt(clientX, clientY) {
  const r = canvasEl.getBoundingClientRect();
  const ndc = new T.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const hits = raycaster.intersectObjects(PICK, false);
  for (const hit of hits) {
    const pid = hit.object.userData.pid;
    if (S.isolate && S.selected && pid !== S.selected) continue;
    return pid;
  }
  return null;
}
function panBy(dx, dy) {
  const s = CAM.dist * CAM.fit * 0.0012;
  const right = new T.Vector3().setFromMatrixColumn(camera.matrix, 0);
  const up = new T.Vector3().setFromMatrixColumn(camera.matrix, 1);
  CAM.goal = null;
  CAM.auto = false;
  CAM.pendingFit = null;
  CAM.target.addScaledVector(right, -dx * s).addScaledVector(up, dy * s);
  CAM.target.y = Math.max(0.2, Math.min(6, CAM.target.y));
  dirty = true;
}
function bindPointer() {
  const ptrs = new Map();
  let mode = null, down = null, pinch = 0;
  const mid = () => { const a = [...ptrs.values()]; return { x: (a[0].x + a[1].x) / 2, y: (a[0].y + a[1].y) / 2, d: Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) }; };
  canvasEl.addEventListener('contextmenu', (e) => e.preventDefault());
  canvasEl.addEventListener('pointerdown', (e) => {
    canvasEl.setPointerCapture(e.pointerId);
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.size === 1) {
      mode = (e.button === 2 || e.shiftKey) ? 'pan' : 'orbit';
      down = { x: e.clientX, y: e.clientY, t: performance.now(), moved: 0 };
    } else if (ptrs.size === 2) {
      mode = 'pinch';
      down = null;
      pinch = mid();
    }
    canvasEl.classList.add('dragging');
    hideTip();
  });
  canvasEl.addEventListener('pointermove', (e) => {
    if (!ptrs.has(e.pointerId)) {
      if (e.pointerType === 'mouse') hoverPt = { x: e.clientX, y: e.clientY };
      return;
    }
    const prev = ptrs.get(e.pointerId);
    const dx = e.clientX - prev.x, dy = e.clientY - prev.y;
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (down) down.moved += Math.abs(dx) + Math.abs(dy);
    if (mode === 'orbit') {
      CAM.theta += dx * 0.0065;
      CAM.phi = Math.max(0.12, Math.min(1.53, CAM.phi - dy * 0.0065));
      dirty = true;
    } else if (mode === 'pan') {
      panBy(dx, dy);
    } else if (mode === 'pinch' && ptrs.size === 2) {
      const m = mid();
      if (pinch.d > 0 && m.d > 0) CAM.distGoal = CAM.dist = Math.max(4, Math.min(70, CAM.dist * pinch.d / m.d));
      panBy(m.x - pinch.x, m.y - pinch.y);
      pinch = m;
    }
  });
  const end = (e) => {
    if (!ptrs.has(e.pointerId)) return;
    ptrs.delete(e.pointerId);
    if (down && e.type === 'pointerup' && down.moved < 6 && performance.now() - down.t < 600) {
      const pid = pickAt(e.clientX, e.clientY);
      selectPart(pid, 'stage');
    }
    if (ptrs.size === 0) { mode = null; down = null; canvasEl.classList.remove('dragging'); }
    else if (ptrs.size === 1) { mode = 'orbit'; down = null; }
  };
  canvasEl.addEventListener('pointerup', end);
  canvasEl.addEventListener('pointercancel', end);
  canvasEl.addEventListener('pointerleave', () => { hoverPt = null; if (S.hovered && !ptrs.size) setHover(null); });
  canvasEl.addEventListener('wheel', (e) => {
    e.preventDefault();
    const dy = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY;
    CAM.distGoal = Math.max(4, Math.min(70, CAM.distGoal * Math.exp(dy * 0.0012)));
    CAM.auto = false;
    CAM.pendingFit = null;
    dirty = true;
  }, { passive: false });
}
function setHover(pid, x, y) {
  if (S.hovered !== pid) {
    S.hovered = pid;
    refreshLook();
    markListHover(pid);
  }
  canvasEl.classList.toggle('pointing', !!pid);
  if (!pid) { hideTip(); return; }
  const p = PART[pid];
  const r = stageEl.getBoundingClientRect();
  tipEl.innerHTML = '<b>' + p.n + '</b>' + p.name;
  tipEl.hidden = false;
  const tx = Math.min(x - r.left + 14, r.width - tipEl.offsetWidth - 8);
  const ty = Math.min(y - r.top + 16, r.height - tipEl.offsetHeight - 8);
  tipEl.style.transform = 'translate(' + Math.max(8, tx) + 'px,' + Math.max(8, ty) + 'px)';
}
function hideTip() { tipEl.hidden = true; }

/* Fit the camera to a set of parts from the current viewing angle. Each node's box corners are
   projected so the parts (not the empty corners of one big box) decide the distance. */
function fitView(ids, instant) {
  const boxes = [], all = new T.Box3(), tb = new T.Box3();
  for (const id of ids) {
    for (const n of PART[id].nodes) {
      const b = new T.Box3();
      n.obj.updateMatrixWorld(true);
      n.obj.traverse((o) => {
        if (!o.isMesh) return;
        if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
        b.union(tb.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld));
      });
      if (!b.isEmpty()) { boxes.push(b); all.union(b); }
    }
  }
  if (!boxes.length) return;
  const c = all.getCenter(new T.Vector3());
  const sp = Math.sin(CAM.phi);
  const o = new T.Vector3(sp * Math.cos(CAM.theta), Math.cos(CAM.phi), sp * Math.sin(CAM.theta));
  const right = new T.Vector3().crossVectors(UP, o).normalize();
  const up = new T.Vector3().crossVectors(o, right);
  const tv = Math.tan(camera.fov * DEG / 2), th = tv * camera.aspect;
  const p = new T.Vector3();
  let D = 0;
  for (const b of boxes) {
    for (let i = 0; i < 8; i++) {
      p.set(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z).sub(c);
      const x = Math.abs(p.dot(right)), y = p.dot(up), z = p.dot(o);
      // Leave room for the system buttons along the top edge.
      D = Math.max(D, x / (th * 0.9) + z, y > 0 ? y / (tv * 0.8) + z : -y / (tv * 0.92) + z);
    }
  }
  CAM.goal = c;
  CAM.distGoal = Math.min(70, Math.max(4.5, D));
  if (instant) { CAM.target.copy(c); CAM.dist = CAM.distGoal; CAM.goal = null; }
  dirty = true;
}
// Ask for a fit once the parts have finished moving.
function frameParts(ids) {
  CAM.lastIds = ids;
  CAM.auto = true;
  CAM.pendingFit = ids;
  dirty = true;
}

function resize() {
  const w = stageEl.clientWidth, h = stageEl.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  if (CAM.auto && CAM.lastIds) fitView(CAM.lastIds, true);
  dirty = true;
}

/* ---------- Loop ---------- */
const EASED = [['explode', 'tExplode'], ['lift', 'tLift'], ['tilt', 'tTilt'], ['steer', 'tSteer']];
// No drawing while the viewer is scrolled out of sight
let onScreen = true, seen = null, sizer = null;
// A short break between start-up steps, so the page can respond to the reader in between
const pause = () => new Promise((r) => setTimeout(r, 0));
function frame() {
  requestAnimationFrame(frame);
  if (!onScreen) return;
  let moving = false;
  for (const [k, tk] of EASED) {
    const d = S[tk] - S[k];
    if (d === 0) continue;
    S[k] = Math.abs(d) < 1e-3 || REDUCED ? S[tk] : S[k] + d * 0.16;
    moving = true;
  }
  for (const p of PARTS) {
    const t = S.sys < 0 || p.sys === S.sys ? 1 : 0;
    const d = t - p.ex;
    if (d === 0) continue;
    p.ex = Math.abs(d) < 1e-3 || REDUCED ? t : p.ex + d * 0.16;
    moving = true;
  }
  if (S.spin) { CAM.theta += 0.0022; dirty = true; }
  if (!moving && CAM.pendingFit) {
    const ids = CAM.pendingFit;
    CAM.pendingFit = null;
    fitView(ids);
  }
  if (CAM.goal) {
    CAM.target.lerp(CAM.goal, REDUCED ? 1 : 0.12);
    if (CAM.target.distanceTo(CAM.goal) < 0.002) { CAM.target.copy(CAM.goal); CAM.goal = null; }
    dirty = true;
  }
  if (Math.abs(CAM.distGoal - CAM.dist) > 0.001) { CAM.dist += (CAM.distGoal - CAM.dist) * (REDUCED ? 1 : 0.2); dirty = true; }
  if (moving) { updatePoses(); updateOutputs(); }
  if (hoverPt) {
    const pid = pickAt(hoverPt.x, hoverPt.y);
    setHover(pid, hoverPt.x, hoverPt.y);
    hoverPt = null;
  }
  if (!dirty) return;
  dirty = false;
  applyCamera();
  scene.updateMatrixWorld();
  renderer.render(scene, camera);
  updateOverlay();
}

async function init3D() {
  if (!T) throw new Error('three.js did not load');
  UP = new T.Vector3(0, 1, 0);
  ZV = new T.Vector3(0, 0, 1);
  _p.v = new T.Vector3(); _o.v = new T.Vector3(); _q.q = new T.Quaternion();
  _v.a = new T.Vector3(); _v.c = new T.Vector3();
  qSteer = new T.Quaternion();
  ACCENT = new T.Color();
  renderer = new T.WebGLRenderer({ canvas: canvasEl, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.setClearColor(0x000000, 0);
  scene = new T.Scene();
  camera = new T.PerspectiveCamera(32, 1, 0.1, 200);
  raycaster = new T.Raycaster();
  await pause();
  scene.environment = makeEnv();
  // Key light rakes in from the front-left and above, so top, front and side faces read as three different tones.
  scene.add(new T.HemisphereLight(0xffffff, 0x45484a, 0.16 * Math.PI));
  const sun = new T.DirectionalLight(0xfff6ea, 1.75 * Math.PI);
  sun.position.set(9.6, 14.2, -5.5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -13, right: 13, top: 13, bottom: -13, near: 1, far: 45 });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  scene.add(sun);
  const rim = new T.DirectionalLight(0xdde6ff, 0.5 * Math.PI);
  rim.position.set(-9, 7.3, 5.2);
  scene.add(rim);
  buildFloor();
  await pause();

  makeBaseMaterials();
  buildModel();
  await pause();
  updatePoses();
  computeAnchors();
  updatePoses();
  buildDims();
  CAM.target = new T.Vector3(0.4, 2.2, 0);
  CAM.home = CAM.target.clone();
  readTheme();
  bindPointer();
  if (window.ResizeObserver) {
    sizer = new ResizeObserver(resize);
    sizer.observe(stageEl);
  }
  window.addEventListener('resize', resize);
  resize();
  CAM.lastIds = PARTS.map((p) => p.id);
  fitView(CAM.lastIds, true);
  // keep hold of the observer, or the browser can throw it away and the view never wakes up again
  if (window.IntersectionObserver) {
    seen = new IntersectionObserver((e) => { onScreen = e[e.length - 1].isIntersecting; if (onScreen) dirty = true; });
    seen.observe(stageEl);
  }
  await pause();
  await renderer.compileAsync(scene, camera);
  requestAnimationFrame(frame);
}

/* ---------- Inspector, parts list, controls ---------- */
const $ = (id) => document.getElementById(id);
const cardEl = $('panel-details');
const plistEl = $('panel-parts');
const has3D = { ok: false };
let hotRow = null;
let listScroll = 0;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const visibleIds = () => PARTS.filter((p) => S.sys < 0 || p.sys === S.sys).map((p) => p.id);

function speedsHTML() {
  const max = 40;
  const row = (g, v) => '<span class="g">' + g + '</span><span class="track"><span class="bar" style="width:' + (v / max * 100).toFixed(1) +
    '%"></span></span><span class="v">' + v + ' km/h</span>';
  return SPEEDS.F.map((v, i) => row('F' + (i + 1), v)).join('') + '<span class="sep"></span>' + SPEEDS.R.map((v, i) => row('R' + (i + 1), v)).join('');
}
function specsHTML(rows) {
  return '<dl class="specs">' + rows.map((r) => '<dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + (r[2] ? '<small>' + esc(r[2]) + '</small>' : '') + '</dd>').join('') + '</dl>';
}
function renderCard(p) {
  if (!p) {
    cardEl.innerHTML =
      '<div class="card-head"><span class="card-num whole" aria-hidden="true">All</span><span class="card-sys">' + esc(WHOLE.sys) + '</span></div>' +
      '<h2>' + esc(WHOLE.name) + '</h2>' +
      '<p>' + esc(WHOLE.blurb) + '</p>' +
      '<ul class="sysrows">' + SYSTEMS.map((s, i) => '<li><div><b>' + esc(s) + '</b><span>' + esc(WHOLE.systems[i]) + '</span></div>' +
        (has3D.ok ? '<button class="xv-btn" type="button" data-act="sys" data-sys="' + i + '" aria-pressed="' + (S.sys === i ? 'true' : 'false') + '">Show</button>' : '') +
        '</li>').join('') + '</ul>' +
      '<p class="aside">' + esc(WHOLE.aside) + '</p>';
    return;
  }
  cardEl.innerHTML =
    '<div class="card-head"><span class="card-num">' + p.n + '</span><span class="card-sys">' + esc(SYSTEMS[p.sys]) + '</span></div>' +
    '<h2>' + esc(p.name) + '</h2>' +
    '<div class="chips">' + p.chips.map((c) => '<span class="chip' + (c === 'Standard' ? ' std' : '') + '">' + esc(c) + '</span>').join('') + '</div>' +
    '<p>' + esc(p.blurb) + '</p>' +
    (p.speeds ? '<div class="speeds" aria-label="Maximum travel speed by gear">' + speedsHTML() + '</div>' : '') +
    specsHTML(p.specs) +
    '<div class="card-actions">' +
      '<button class="xv-btn" type="button" data-act="prev">← Prev</button>' +
      '<button class="xv-btn" type="button" data-act="next">Next →</button>' +
      (has3D.ok ? '<button class="xv-btn" type="button" data-act="iso" aria-pressed="' + (S.isolate ? 'true' : 'false') + '">Isolate</button>' : '') +
      '<button class="xv-btn" type="button" data-act="all">Whole machine</button>' +
    '</div>';
}

/* Tabs: Details / All parts. The list keeps its scroll position between visits. */
function setTab(which) {
  const parts = which === 'parts';
  if (!parts && !plistEl.hidden) listScroll = plistEl.scrollTop;
  $('tab-details').setAttribute('aria-selected', parts ? 'false' : 'true');
  $('tab-parts').setAttribute('aria-selected', parts ? 'true' : 'false');
  $('tab-details').tabIndex = parts ? -1 : 0;
  $('tab-parts').tabIndex = parts ? 0 : -1;
  cardEl.hidden = parts;
  plistEl.hidden = !parts;
  if (parts) plistEl.scrollTop = listScroll;
}
function wireTabs() {
  const tabs = [$('tab-details'), $('tab-parts')];
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => setTab(i ? 'parts' : 'details'));
    t.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      const next = i ? 0 : 1;
      setTab(next ? 'parts' : 'details');
      tabs[next].focus();
    });
  });
}

function buildList() {
  let html = '';
  SYSTEMS.forEach((s, si) => {
    html += '<h3>' + esc(s) + '</h3><ul>' + PARTS.filter((p) => p.sys === si).map((p) =>
      '<li><button class="prow" type="button" data-id="' + p.id + '" aria-current="false"><span class="n">' + p.n + '</span><span class="nm">' +
      esc(p.name) + '</span><span class="k">' + esc(p.key) + '</span></button></li>').join('') + '</ul>';
  });
  plistEl.innerHTML = html;
  plistEl.addEventListener('click', (e) => {
    const b = e.target.closest('.prow');
    if (b) selectPart(b.dataset.id, 'list');
  });
  plistEl.addEventListener('mouseover', (e) => {
    if (!has3D.ok) return;
    const b = e.target.closest('.prow');
    const id = b ? b.dataset.id : null;
    if (S.hovered !== id) { S.hovered = id; refreshLook(); }
  });
  plistEl.addEventListener('mouseleave', () => {
    if (has3D.ok && S.hovered) { S.hovered = null; refreshLook(); }
  });
}
function markListHover(pid) {
  if (hotRow) hotRow.classList.remove('hot');
  hotRow = pid ? plistEl.querySelector('.prow[data-id="' + pid + '"]') : null;
  if (hotRow) hotRow.classList.add('hot');
}

function buildTags() {
  const NS = 'http://www.w3.org/2000/svg';
  for (const p of PARTS) {
    const line = document.createElementNS(NS, 'line');
    const dot = document.createElementNS(NS, 'circle');
    dot.setAttribute('r', '2.5');
    line.style.display = 'none';
    dot.style.display = 'none';
    leadersEl.appendChild(line);
    leadersEl.appendChild(dot);
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'tag';
    el.textContent = p.n;
    el.tabIndex = -1;
    el.title = p.name;
    el.setAttribute('aria-label', p.n + ' ' + p.name);
    el.hidden = true;
    el.addEventListener('click', () => selectPart(p.id, 'tag'));
    el.addEventListener('mouseenter', () => { if (S.hovered !== p.id) { S.hovered = p.id; refreshLook(); markListHover(p.id); } });
    el.addEventListener('mouseleave', () => { if (S.hovered === p.id) { S.hovered = null; refreshLook(); markListHover(null); } });
    tagsEl.appendChild(el);
    TAGS[p.id] = { el, line, dot };
  }
}

function selectPart(id, src) {
  const p = id ? PART[id] : null;
  // A part outside the current system filter would be hidden inside the assembled machine.
  if (p && S.sys >= 0 && p.sys !== S.sys) { S.sys = -1; markSys(); }
  if (p && src === 'link' && S.tExplode < 0.3) { S.tExplode = 0.6; $('sl-explode').value = 60; updateOutputs(); }
  S.selected = p ? p.id : null;
  if (!p) S.isolate = false;
  renderCard(p);
  for (const b of plistEl.querySelectorAll('.prow')) b.setAttribute('aria-current', b.dataset.id === S.selected ? 'true' : 'false');
  setTab('details');
  cardEl.scrollTop = 0;
  if (has3D.ok) {
    refreshLook();
    if (src !== 'stage') frameParts(p ? [p.id] : visibleIds());
    dirty = true;
  }
}
function stepPart(dir) {
  const i = S.selected ? PART[S.selected].n - 1 : -1;
  const next = PARTS[(i + dir + PARTS.length) % PARTS.length];
  selectPart(next.id, 'step');
}
cardEl.addEventListener('click', (e) => {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const act = b.dataset.act;
  if (act === 'prev') stepPart(-1);
  else if (act === 'next') stepPart(1);
  else if (act === 'all') selectPart(null, 'card');
  else if (act === 'sys') setSystem(S.sys === +b.dataset.sys ? -1 : +b.dataset.sys);
  else if (act === 'iso') {
    S.isolate = !S.isolate;
    b.setAttribute('aria-pressed', S.isolate ? 'true' : 'false');
    if (has3D.ok) refreshLook();
  }
});

function updateOutputs() {
  $('o-explode').textContent = Math.round(S.tExplode * 100) + '%';
  const alpha = K.aCarry + (K.aMax - K.aCarry) * S.tLift;
  const Hy = K.P[1] + K.R * Math.sin(alpha);
  const c = clampTheta(Hy, Math.min(S.tTilt * DEG, (48 + 13 * S.tLift) * DEG));
  $('o-lift').textContent = 'pin ' + Hy.toFixed(2) + ' m';
  const deg = Math.round(c.theta / DEG);
  $('o-tilt').textContent = deg === 0 ? 'level' : (deg > 0 ? 'rack back ' + deg + '°' : 'dump ' + (-deg) + '°') + (c.clamped ? ' · on ground' : '');
  const st = Math.round(-S.tSteer);
  $('o-steer').textContent = st === 0 ? 'straight' : (st > 0 ? 'right ' : 'left ') + Math.abs(st) + '°';
}
function setPressed(id, on) { $(id).setAttribute('aria-pressed', on ? 'true' : 'false'); }
function setDims(on) {
  S.dims = on;
  setPressed('b-dims', on);
  if (on) {
    if (S.sys >= 0) { S.sys = -1; markSys(); }
    S.tExplode = 0; S.tSteer = 0;
    $('sl-explode').value = 0;
    $('sl-steer').value = 0;
    updateOutputs();
    if (has3D.ok) frameParts(PARTS.map((p) => p.id));
  }
  dirty = true;
}

/* System filter: only the chosen system's parts pull apart and get balloons; the rest stays assembled. */
const SYS_SHORT = ['Linkage', 'Frames', 'Engine', 'Drivetrain', 'Hydraulics', 'Cab'];
function buildSysbar() {
  const bar = $('sysbar');
  const opts = [['All', -1]].concat(SYS_SHORT.map((s, i) => [s, i]));
  bar.innerHTML = opts.map(([label, i]) => '<button class="sysbtn" type="button" data-sys="' + i + '" aria-pressed="' + (i === S.sys ? 'true' : 'false') +
    '" title="' + esc(i < 0 ? 'Show every system' : SYSTEMS[i]) + '">' + esc(label) + '</button>').join('');
  bar.addEventListener('click', (e) => {
    const b = e.target.closest('.sysbtn');
    if (b) setSystem(+b.dataset.sys);
  });
}
function markSys() {
  for (const b of document.querySelectorAll('.sysbtn, #panel-details [data-act="sys"]')) {
    b.setAttribute('aria-pressed', +b.dataset.sys === S.sys ? 'true' : 'false');
  }
}
function setSystem(i) {
  S.sys = i;
  markSys();
  if (S.dims) setDims(false);
  if (i >= 0 && S.tExplode < 0.3) { S.tExplode = 0.6; $('sl-explode').value = 60; updateOutputs(); }
  if (S.selected && i >= 0 && PART[S.selected].sys !== i) {
    S.selected = null;
    S.isolate = false;
    renderCard(null);
    for (const b of plistEl.querySelectorAll('.prow')) b.setAttribute('aria-current', 'false');
    if (has3D.ok) refreshLook();
  }
  if (has3D.ok) frameParts(visibleIds());
  if (i >= 0) {
    setTab('parts');
    const h = plistEl.querySelectorAll('h3')[i];
    if (h) plistEl.scrollTop += h.getBoundingClientRect().top - plistEl.getBoundingClientRect().top;
  }
  dirty = true;
}

function wireControls() {
  $('sl-explode').addEventListener('input', (e) => { S.tExplode = e.target.value / 100; if (S.dims && S.tExplode > 0) setDims(false); updateOutputs(); });
  $('sl-lift').addEventListener('input', (e) => { S.tLift = e.target.value / 100; updateOutputs(); });
  $('sl-tilt').addEventListener('input', (e) => { S.tTilt = +e.target.value; updateOutputs(); });
  $('sl-steer').addEventListener('input', (e) => { S.tSteer = -e.target.value; if (S.dims && S.tSteer !== 0) setDims(false); updateOutputs(); });
  $('b-labels').addEventListener('click', () => { S.labels = !S.labels; setPressed('b-labels', S.labels); dirty = true; });
  $('b-dims').addEventListener('click', () => setDims(!S.dims));
  $('b-spin').addEventListener('click', () => { S.spin = !S.spin; setPressed('b-spin', S.spin); dirty = true; });
  $('b-reset').addEventListener('click', () => { if (has3D.ok) resetView(); });
  $('b-more').addEventListener('click', () => {
    const open = !$('controls').classList.contains('open');
    $('controls').classList.toggle('open', open);
    $('b-more').setAttribute('aria-expanded', open ? 'true' : 'false');
    $('b-more').textContent = open ? 'Fewer controls' : 'More controls';
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && S.selected) selectPart(null, 'key'); });
}

async function main() {
  buildList();
  wireTabs();
  renderCard(null);
  try {
    await init3D();
    has3D.ok = true;
    buildTags();
    buildSysbar();
    renderCard(null);
    setTab('details');
    $('notice').hidden = true;
    for (const id of ['sl-explode', 'sl-lift', 'sl-tilt', 'sl-steer', 'b-labels', 'b-dims', 'b-spin', 'b-reset', 'b-more']) $(id).disabled = false;
    appEl.classList.add('is-live');
  } catch (err) {
    $('notice').hidden = false;
    $('notice').textContent = 'The 3D view could not start (' + ((err && err.message) || 'WebGL is unavailable') + '). The parts list still works.';
    setTab('parts');
    appEl.classList.add('is-failed');
  }
  if (stageEl.clientWidth < 560) { S.labels = false; setPressed('b-labels', false); }
  wireControls();
  updateOutputs();
}

// Started by equipment.js once the viewer is in view, or tapped open on a phone
let mounted = false;
export function mount() {
  if (mounted) return;
  mounted = true;
  return main();
}
