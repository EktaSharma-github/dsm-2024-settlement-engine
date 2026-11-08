// DSM 2024 engine (CERC Reg. L-1/260/2021/CERC). Sign convention: + receivable by entity, - payable by entity.
const BLOCK_H = 0.25; // 15-min time block
const r2 = x => Math.round(x * 100) / 100;
const steps = (a, b) => Math.round(Math.abs(a - b) / 0.01); // 0.01 Hz steps
const inBand = f => f >= 49.90 && f <= 50.05;

function normalRate(idam, rtm, asc) { // paise/kWh, Reg 7
  const A = idam, B = rtm, C = (idam + rtm + asc) / 3;
  const nr = Math.max(A, B, C);
  return { A, B, C: r2(C), nr: r2(nr), driver: nr === A ? 'A' : nr === B ? 'B' : 'C' };
}

// General seller (Reg 8(1)) — also standalone ESS discharge (8(5)). Returns % of RR, sign from seller's view.
function gsRate(dir, slab, f) {
  if (dir === 'over') {
    if (slab === 0) {
      if (inBand(f)) {
        if (f >= 49.97 && f <= 50.03) return { pct: 100, rule: 'BR-GS-01' };
        if (f > 50.03) return { pct: 100 - 25 * steps(f, 50.03), rule: 'BR-GS-02' };
        return { pct: Math.min(115, 100 + 2.15 * steps(f, 49.97)), rule: 'BR-GS-03' };
      }
      if (f > 50.05 && f < 50.10) return { pct: 0, rule: 'BR-GS-07' };
      if (f >= 50.10) return { pct: -10, rule: 'BR-GS-07' };
      return { pct: 115, rule: 'BR-GS-08' };
    }
    return f >= 50.10 ? { pct: -10, rule: 'BR-GS-11' } : { pct: 0, rule: 'BR-GS-11' };
  }
  // under-injection: payable (negative)
  if (slab === 0) {
    if (inBand(f)) {
      if (f >= 49.97 && f <= 50.03) return { pct: -100, rule: 'BR-GS-04' };
      if (f > 50.03) return { pct: -(100 - 7.5 * steps(f, 50.03)), rule: 'BR-GS-05' };
      return { pct: -Math.min(150, 100 + 7.15 * steps(f, 49.97)), rule: 'BR-GS-06' };
    }
    if (f > 50.05) return { pct: -85, rule: 'BR-GS-09' };
    return { pct: -150, rule: 'BR-GS-10' };
  }
  if (f >= 50.00) return { pct: -100, rule: 'BR-GS-12' };
  if (f >= 49.90) return { pct: -150, rule: 'BR-GS-12' };
  return { pct: -200, rule: 'BR-GS-12' };
}

function buyerRate(dir, slab, f) { // dir: 'under' (receivable) / 'over' (payable); slab 0..2 = VL1..VL3
  if (dir === 'under') {
    if (slab === 0) {
      if (inBand(f)) {
        if (f > 50.00) return { pct: 90 - 8 * steps(f, 50.00), rule: 'BR-BY-01' };
        return { pct: Math.min(100, 90 + 1 * steps(f, 50.00)), rule: 'BR-BY-01' };
      }
      if (f > 50.05 && f < 50.10) return { pct: 0, rule: 'BR-BY-03' };
      if (f >= 50.10) return { pct: -10, rule: 'BR-BY-03' };
      return { pct: 100, rule: 'BR-BY-03' };
    }
    if (slab === 1) {
      if (f <= 50.00) return { pct: 80, rule: 'BR-BY-05' };
      if (f <= 50.05) return { pct: 50, rule: 'BR-BY-05' };
      if (f < 50.10) return { pct: 0, rule: 'BR-BY-05' };
      return { pct: -10, rule: 'BR-BY-05' };
    }
    return f >= 50.10 ? { pct: -10, rule: 'BR-BY-07' } : { pct: 0, rule: 'BR-BY-07' };
  }
  if (slab === 0) {
    if (inBand(f)) {
      if (f > 50.00) return { pct: -(100 - 5 * steps(f, 50.00)), rule: 'BR-BY-02' };
      return { pct: -Math.min(150, 100 + 5 * steps(f, 50.00)), rule: 'BR-BY-02' };
    }
    if (f > 50.05 && f < 50.10) return { pct: -50, rule: 'BR-BY-04' };
    if (f >= 50.10) return { pct: 0, rule: 'BR-BY-04' };
    return { pct: -150, rule: 'BR-BY-04' };
  }
  if (slab === 1) {
    if (f < 50.00) return { pct: -150, rule: 'BR-BY-06' };
    if (f <= 50.05) return { pct: -100, rule: 'BR-BY-06' };
    if (f < 50.10) return { pct: -75, rule: 'BR-BY-06' };
    return { pct: 0, rule: 'BR-BY-06' };
  }
  if (f < 50.00) return { pct: -200, rule: 'BR-BY-08' };
  if (f < 50.10) return { pct: -100, rule: 'BR-BY-08' };
  return { pct: -50, rule: 'BR-BY-08' };
}

// Split |dev| (MW) into slabs given cumulative limits [l1, l2, ...]
function split(absDev, limits) {
  const out = []; let prev = 0;
  for (const lim of limits) { out.push(Math.max(0, Math.min(absDev, lim) - prev)); prev = Math.max(prev, lim); }
  out.push(Math.max(0, absDev - prev));
  return out;
}

const WS_LIMITS = { // % of denominator, Reg 8(4) Note-1
  pre: { solar: [10, 15], wind: [15, 20] },
  post: { solar: [5, 10], wind: [10, 15] },
};

/* input: { type: 'gs'|'ess'|'ror'|'msw'|'ws'|'buyer', S, A, f, rate (₹/kWh, RR / CR / NR),
   wsTech:'solar'|'wind', regime:'pre'|'post', avc, X, buyerCat:'regular'|'small'|'rerich'|'superrich' } */
function settle(inp) {
  const { type, S, A } = inp; const f = +inp.f; const rate = +inp.rate;
  const dev = A - S; const abs = Math.abs(dev);
  let denom = S, limits = [], labels = [], rates = [], basis = 'RR', notes = [];
  const dir = dev >= 0 ? 'over' : 'under';
  if (type === 'gs' || type === 'ess') {
    limits = [Math.min(0.10 * S, 100)]; labels = ['≤ min(10% S, 100 MW)', 'Beyond'];
    rates = [0, 1].map(k => gsRate(dir, k, f));
  } else if (type === 'ror') {
    limits = [Math.min(0.15 * S, 150), Math.min(0.20 * S, 200)];
    labels = ['≤ min(15% S, 150 MW)', 'to min(20% S, 200 MW)', 'Beyond'];
    rates = dir === 'over'
      ? [{ pct: 100, rule: 'BR-RR-01' }, { pct: 0, rule: 'BR-RR-01' }, { pct: 0, rule: 'BR-RR-01' }]
      : [{ pct: -100, rule: 'BR-RR-02' }, { pct: -105, rule: 'BR-RR-02' }, { pct: -110, rule: 'BR-RR-02' }];
  } else if (type === 'msw') {
    basis = 'CR'; limits = [0.20 * S]; labels = ['≤ 20% S', 'Beyond'];
    rates = dir === 'over' ? [{ pct: 100, rule: 'BR-MS-01' }, { pct: 0, rule: 'BR-MS-01' }]
      : [{ pct: -100, rule: 'BR-MS-02' }, { pct: -110, rule: 'BR-MS-02' }];
  } else if (type === 'ws') {
    basis = 'CR';
    const X = inp.regime === 'post' ? +inp.X : 100;
    denom = inp.regime === 'post' ? (X / 100) * inp.avc + ((100 - X) / 100) * S : inp.avc;
    const [p1, p2] = WS_LIMITS[inp.regime][inp.wsTech];
    limits = [p1 / 100 * denom, p2 / 100 * denom];
    labels = [`VL1 ≤ ${p1}%`, `VL2 ${p1}–${p2}%`, `Beyond ${p2}%`];
    rates = dir === 'over' ? [{ pct: 100, rule: 'BR-WS-01' }, { pct: 90, rule: 'BR-WS-01' }, { pct: 0, rule: 'BR-WS-01' }]
      : [{ pct: -100, rule: 'BR-WS-02' }, { pct: -110, rule: 'BR-WS-02' }, { pct: -200, rule: 'BR-WS-02' }];
  } else if (type === 'buyer') {
    basis = 'NR';
    const c = inp.buyerCat;
    if (c === 'regular') { limits = [Math.min(0.10 * S, 100), Math.min(0.15 * S, 200)]; labels = ['VL1', 'VL2', 'VL3']; }
    if (c === 'small') { limits = [Math.min(0.20 * S, 40)]; labels = ['VL1', 'VL2']; }
    if (c === 'rerich') { limits = [200, 300]; labels = ['VL1 ≤ 200 MW', 'VL2 200–300 MW', 'VL3 > 300 MW']; }
    if (c === 'superrich') { limits = [250, 350]; labels = ['VL1 ≤ 250 MW', 'VL2 250–350 MW', 'VL3 > 350 MW']; }
    if (c === 'regular') labels = ['VL1 ≤ min(10% S, 100 MW)', 'VL2 to min(15% S, 200 MW)', 'VL3 beyond'];
    if (c === 'small') labels = ['VL1 ≤ min(20% S, 40 MW)', 'VL2 beyond'];
    rates = labels.map((_, k) => buyerRate(dir, k, f));
  }
  const vols = split(abs, limits);
  const slabs = vols.map((mw, k) => {
    const pct = rates[k].pct; const unit = rate * pct / 100; // ₹/kWh signed
    const mwh = mw * BLOCK_H; const amt = mwh * 1000 * unit;
    return { label: labels[k], mw, mwh, pct, unit, amt, rule: rates[k].rule };
  });
  const total = slabs.reduce((s, x) => s + x.amt, 0);
  const devPct = denom ? 100 * dev / denom : null;
  return { dev, dir, devPct, denom, slabs, total: r2(total) + 0, basis };
}

function lps(amount, issueDate, payDate) { // Reg 10(1): due in 10 days, 0.04%/day after
  const due = new Date(issueDate); due.setDate(due.getDate() + 10);
  const days = Math.max(0, Math.round((new Date(payDate) - due) / 86400000));
  return { due, days, surcharge: r2(amount * 0.0004 * days) };
}

if (typeof module !== 'undefined') module.exports = { settle, normalRate, lps, gsRate, buyerRate, split };
