// Calculators for the article pages: trench volume, slope ratios, cement-stabilised sand, and trucks per excavator.
// The maths matches the worked examples in the articles. Each calculator updates as you type.

const num = (v) => {
  const n = Number(String(v).trim().replace(',', '.'));
  return String(v).trim() === '' || !Number.isFinite(n) ? NaN : n;
};
const ok = (...vals) => vals.every((v) => Number.isFinite(v) && v >= 0);

// ---------- maths ----------
export function trench({ shape = 'battered', length, depth, base, batter = 0, levels = 1, step = 0, bulking = 0, truck = 0, pipe = 0, compaction = 0 }) {
  if (!ok(length, depth, base)) return null;
  let area, top;
  if (shape === 'vertical') {
    area = base * depth;
    top = base;
  } else if (shape === 'benched') {
    const n = Math.max(1, Math.round(levels));
    if (!ok(step)) return null;
    area = 0;
    for (let k = 0; k < n; k++) area += (base + 2 * step * k) * (depth / n);
    top = base + 2 * step * (n - 1);
  } else {
    if (!ok(batter)) return null;
    top = base + 2 * depth * batter;
    area = (depth * (base + top)) / 2;
  }
  const volume = area * length;
  const out = { area, top, volume };
  if (bulking > 0) {
    out.loose = volume * bulking;
    if (truck > 0) {
      out.loadsExact = out.loose / truck;
      out.loads = Math.ceil(out.loadsExact - 1e-9);
    }
  }
  if (pipe > 0) {
    out.pipeVolume = Math.PI * (pipe / 2) ** 2 * length;
    out.backfill = Math.max(0, volume - out.pipeVolume);
  } else {
    out.backfill = volume;
  }
  if (compaction > 0) out.order = out.backfill * compaction;
  return out;
}

// Slope of 1 vertical to H horizontal
export function slope(H) {
  if (!Number.isFinite(H) || H < 0) return null;
  if (H === 0) return { H, angle: 90, grade: Infinity };
  return { H, angle: (Math.atan(1 / H) * 180) / Math.PI, grade: (1 / H) * 100 };
}
export const hFromAngle = (deg) => (deg > 0 && deg <= 90 ? (deg === 90 ? 0 : 1 / Math.tan((deg * Math.PI) / 180)) : NaN);
export const hFromGrade = (pct) => (pct > 0 ? 100 / pct : NaN);

export function cement({ mode = 'percent', volume, density, percent, perM3, bag = 0, wastage = 0 }) {
  if (!ok(volume)) return null;
  let dryMass = null, kg;
  if (mode === 'perm3') {
    if (!ok(perM3)) return null;
    kg = volume * perM3;
  } else {
    if (!ok(density, percent)) return null;
    dryMass = volume * density; // tonnes
    kg = dryMass * 1000 * (percent / 100);
  }
  const withWaste = kg * (1 + (ok(wastage) ? wastage : 0) / 100);
  const out = { dryMass, kg, withWaste };
  if (bag > 0) {
    out.bags = Math.ceil(kg / bag - 1e-9);
    out.bagsWithWaste = Math.ceil(withWaste / bag - 1e-9);
  }
  return out;
}

export function trucks({ load, bucket, cycleS, distance, loadedSpeed, emptySpeed, dump = 0, spot = 0 }) {
  if (!ok(load, bucket, cycleS, distance, dump, spot) || !(bucket > 0) || !(loadedSpeed > 0) || !(emptySpeed > 0)) return null;
  const passes = Math.ceil(load / bucket - 1e-9);
  const loading = (passes * cycleS) / 60; // minutes
  const haul = (distance / loadedSpeed) * 60;
  const ret = (distance / emptySpeed) * 60;
  const cycle = loading + haul + dump + ret + spot;
  if (!(loading > 0)) return null;
  const needed = cycle / loading;
  const from = Math.max(1, Math.floor(needed) - 1), to = Math.max(from + 1, Math.ceil(needed) + 1);
  const rows = [];
  for (let n = from; n <= to; n++) {
    const loadsPerHour = Math.min(60 / loading, (n * 60) / cycle);
    rows.push({ n, match: (n * loading) / cycle, loadsPerHour, m3PerHour: loadsPerHour * load });
  }
  return { passes, loading, haul, ret, cycle, needed, rows };
}

// ---------- page wiring ----------
const fmt = (v, dp) => (Number.isFinite(v) ? v.toLocaleString('en-AU', { minimumFractionDigits: dp, maximumFractionDigits: dp }) : '–');
const trimZeros = (s) => (s.includes('.') ? s.replace(/0+$/, '').replace(/\.$/, '') : s);
const vol = (v) => (Number.isFinite(v) ? `${fmt(v, v < 10 ? 2 : 1)} m³` : '–');

function wire(root, compute) {
  const form = root.querySelector('form');
  form.addEventListener('submit', (e) => e.preventDefault());
  const get = (name) => {
    const el = form.elements.namedItem(name);
    if (!el) return undefined;
    if (el instanceof RadioNodeList) return el.value;
    return num(el.value);
  };
  const set = (name, text) => {
    const el = root.querySelector(`[data-out="${name}"]`);
    if (el) el.textContent = text;
  };
  const show = () => {
    const mode = form.querySelector('input[type="radio"]:checked')?.value;
    root.querySelectorAll('[data-when]').forEach((el) => {
      el.hidden = !el.dataset.when.split(' ').includes(mode);
    });
  };
  const run = (e) => {
    show();
    compute({ get, set, root, form, source: e?.target });
  };
  form.addEventListener('input', run);
  form.addEventListener('change', run);
  run();
}

const calculators = {
  trench({ get, set }) {
    const r = trench({
      shape: get('shape'), length: get('length'), depth: get('depth'), base: get('base'), batter: get('batter'),
      levels: get('levels'), step: get('step'), bulking: get('bulking'), truck: get('truck'), pipe: get('pipe'), compaction: get('compaction'),
    });
    set('volume', r ? vol(r.volume) : '–');
    set('area', r ? `${fmt(r.area, 2)} m²` : '–');
    set('top', r ? `${fmt(r.top, 2)} m` : '–');
    set('loose', r && r.loose !== undefined ? vol(r.loose) : '–');
    set('loads', r && r.loads !== undefined ? `${r.loads} (${fmt(r.loadsExact, 1)})` : '–');
    set('backfill', r ? vol(r.backfill) : '–');
    set('order', r && r.order !== undefined ? vol(r.order) : '–');
  },

  slope({ get, form, set, source }) {
    let H;
    const name = source?.name;
    if (name === 'angle') H = hFromAngle(get('angle'));
    else if (name === 'grade') H = hFromGrade(get('grade'));
    else if (name === 'rise' || name === 'run') H = get('rise') > 0 ? get('run') / get('rise') : NaN;
    else H = get('h');
    const r = slope(H);
    const field = (n) => form.elements.namedItem(n);
    const put = (n, v) => {
      if (n !== name) field(n).value = v;
    };
    if (r) {
      put('h', +r.H.toFixed(2));
      put('angle', +r.angle.toFixed(1));
      put('grade', Number.isFinite(r.grade) ? +r.grade.toFixed(1) : '');
      if (name !== 'rise' && name !== 'run') {
        const rise = get('rise') > 0 ? get('rise') : 1;
        field('rise').value = +rise.toFixed(3);
        field('run').value = +(rise * r.H).toFixed(3);
      }
    }
    const h = r ? trimZeros(fmt(r.H, 2)) : null;
    set('vh', r ? `1V:${h}H` : '–');
    set('hv', r ? `${h}H:1V` : '–');
    set('in', r ? (r.H === 0 ? 'Vertical' : `1 in ${h}`) : '–');
    set('angle', r ? `${fmt(r.angle, 1)}°` : '–');
    set('grade', r ? (Number.isFinite(r.grade) ? `${fmt(r.grade, 1).replace(/\.0$/, '')}%` : 'Vertical') : '–');
  },

  cement({ get, set }) {
    const r = cement({
      mode: get('mode'), volume: get('volume'), density: get('density'), percent: get('percent'),
      perM3: get('perm3'), bag: get('bag'), wastage: get('wastage'),
    });
    set('dry', r && r.dryMass !== null ? `${fmt(r.dryMass, 2)} t` : '–');
    set('kg', r ? `${fmt(r.kg, 0)} kg` : '–');
    set('bags', r && r.bags !== undefined ? `${r.bags}` : '–');
    set('kgw', r ? `${fmt(r.withWaste, 0)} kg` : '–');
    set('bagsw', r && r.bagsWithWaste !== undefined ? `${r.bagsWithWaste}` : '–');
  },

  trucks({ get, set, root }) {
    const r = trucks({
      load: get('load'), bucket: get('bucket'), cycleS: get('cycle'), distance: get('distance'),
      loadedSpeed: get('loaded'), emptySpeed: get('empty'), dump: get('dump'), spot: get('spot'),
    });
    set('passes', r ? `${r.passes}` : '–');
    set('loading', r ? `${fmt(r.loading, 1)} min` : '–');
    set('cycle', r ? `${fmt(r.cycle, 1)} min` : '–');
    set('needed', r ? fmt(r.needed, 2) : '–');
    const body = root.querySelector('[data-out="rows"]');
    if (!body) return;
    body.replaceChildren(...(r ? r.rows : []).map((row) => {
      const tr = document.createElement('tr');
      if (row.n === Math.floor(r.needed) || row.n === Math.ceil(r.needed)) tr.className = 'calc-pick';
      for (const text of [row.n, fmt(row.match, 2), fmt(row.loadsPerHour, 1), fmt(row.m3PerHour, 0)]) {
        const td = document.createElement('td');
        td.textContent = text;
        tr.append(td);
      }
      return tr;
    }));
  },
};

if (typeof document !== 'undefined') {
  document.querySelectorAll('[data-calc]').forEach((root) => {
    const compute = calculators[root.dataset.calc];
    if (compute) {
      wire(root, compute);
      root.classList.add('is-live');
    }
  });
}
