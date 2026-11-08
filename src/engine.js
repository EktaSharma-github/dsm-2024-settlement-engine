// DSM 2024 engine (CERC Reg. L-1/260/2021/CERC, with First, Second and Third Amendments). Sign convention: + receivable by entity, - payable by entity.
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

// Effective dates (principal regulation + amendments). Every dated rule reads from here.
const EFFECTIVE = {
  A1: '2024-12-23',          // First Amendment 2024
  A2: '2025-07-01',          // Second Amendment 2025
  WS_REGIME: '2026-04-01',   // Principal Reg 6(2)(b) / Note-1(ii)
  A3: '2026-08-31',          // Third Amendment 2026
  PARITY_BID: '2027-01-01',  // Reg 8(4A)(a)
  PARITY_COD: '2029-01-01',  // Reg 8(4A)(b)
};
const INFIRM_CAP = { thermal: 2.86, ess: 2.00 }; // ₹/kWh, Reg 8(8)(2) and 8(8)(2A)
const ms = d => Date.parse(d + 'T00:00:00Z');
const onOrAfter = (date, key) => ms(date) >= ms(EFFECTIVE[key]);
const DEFAULT_DATE = '2026-11-08';

// Reg 8(4A): does a WS project move to the general-seller table?
function wsParity(route, keyDate, blockDate = DEFAULT_DATE) {
  if (!keyDate || !onOrAfter(blockDate, 'A3')) return false;
  return ms(keyDate) >= ms(EFFECTIVE[route === 'bid' ? 'PARITY_BID' : 'PARITY_COD']);
}

// Reg 8(8) as substituted by A2 and amended by A3: infirm injection before the trial run completes.
function infirmPreTrial(inp, date) {
  const f = +inp.f, nr = +inp.rate, A = +inp.A;
  const kind = inp.type === 'ess' ? 'ess' : inp.plantKind === 'thermal' ? 'thermal' : 'other';
  let unit = 0, rule = 'BR-IF-01', note;
  const capFrom = { thermal: 'A2', ess: 'A3' }[kind];
  if (capFrom && onOrAfter(date, capFrom)) {
    if (f > 50.05) { rule = 'BR-IF-05'; note = 'Frequency above 50.05 Hz: infirm injection is charged at zero (Reg 8(8)(4)).'; }
    else { unit = Math.min(nr, INFIRM_CAP[kind]); rule = kind === 'thermal' ? 'BR-IF-02' : 'BR-IF-03';
      note = `Paid at NR capped at ₹${INFIRM_CAP[kind].toFixed(2)}/kWh (${kind === 'thermal' ? 'A2, from 01-07-2025' : 'A3, from 31-08-2026'}).`; }
  } else note = capFrom ? `Before ${kind === 'thermal' ? '01-07-2025' : '31-08-2026'} this infirm injection was charged at zero.` : 'Infirm injection is charged at zero for this plant type.';
  const mwh = Math.max(0, A) * BLOCK_H, amt = mwh * 1000 * unit;
  return { dev: A - +inp.S, dir: 'over', devPct: null, denom: 0, basis: 'NR', notes: [note],
    slabs: [{ label: 'Infirm injection before trial run', mw: Math.max(0, A), mwh, pct: nr ? unit / nr * 100 : 0, unit, amt, rule }], total: r2(amt) + 0 };
}

/* input: { type: 'gs'|'ess'|'ror'|'msw'|'ws'|'buyer', S, A, f, rate (₹/kWh: RR / CR / NR / ECR),
   date (block date, YYYY-MM-DD), wsTech:'solar'|'wind', regime:'pre'|'post' (optional, else from date),
   avc, conn (connectivity MW), X, route:'bid'|'other', keyDate (bid/tender date or COD),
   buyerCat:'regular'|'small'|'rerich'|'superrich', infirm:'none'|'pretrial'|'scheduled',
   plantKind:'thermal'|'other', psp62 (bool) } */
function settle(inp) {
  const date = inp.date || DEFAULT_DATE;
  if (inp.infirm === 'pretrial' && inp.type !== 'buyer') return infirmPreTrial(inp, date);
  const { S, A } = inp; const f = +inp.f; const rate = +inp.rate;
  const dev = A - S; const abs = Math.abs(dev);
  let denom = S, limits = [], labels = [], rates = [], basis = 'RR'; const notes = [];
  const dir = dev >= 0 ? 'over' : 'under';
  let type = inp.type;
  if (type === 'ws' && wsParity(inp.route, inp.keyDate, date)) {
    type = 'gs'; basis = 'CR';
    notes.push(`Priced as a general seller under Reg 8(4A) (A3): ${inp.route === 'bid' ? 'bid or tender date on or after 01-01-2027' : 'COD on or after 01-01-2029'} (BR-WS-05).`);
  }
  if (type === 'gs' || type === 'ess') {
    if (inp.type === 'ess' && inp.psp62) { basis = 'ECR'; notes.push('Pumped hydro under Section 62: priced at the energy charge rate (Reg 8(5) Note, A3, BR-ES-04).'); }
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
    const regime = inp.regime || (onOrAfter(date, 'WS_REGIME') ? 'post' : 'pre');
    let avc = +inp.avc;
    if (inp.conn && onOrAfter(date, 'A1') && avc > +inp.conn) { avc = +inp.conn; notes.push(`Available capacity capped at connectivity granted, ${avc} MW (Reg 3(1)(g), A1, BR-DV-05).`); }
    const X = regime === 'post' ? +inp.X : 100;
    denom = regime === 'post' ? (X / 100) * avc + ((100 - X) / 100) * S : avc;
    const [p1, p2] = WS_LIMITS[regime][inp.wsTech];
    limits = [p1 / 100 * denom, p2 / 100 * denom];
    labels = [`VL1 ≤ ${p1}%`, `VL2 ${p1}–${p2}%`, `Beyond ${p2}%`];
    rates = dir === 'over' ? [{ pct: 100, rule: 'BR-WS-01' }, { pct: 90, rule: 'BR-WS-01' }, { pct: 0, rule: 'BR-WS-01' }]
      : [{ pct: -100, rule: 'BR-WS-02' }, { pct: -110, rule: 'BR-WS-02' }, { pct: -200, rule: 'BR-WS-02' }];
  } else if (type === 'buyer') {
    basis = 'NR';
    const c = inp.buyerCat;
    if (c === 'regular') { limits = [Math.min(0.10 * S, 100), Math.min(0.15 * S, 200)]; labels = ['VL1 ≤ min(10% S, 100 MW)', 'VL2 to min(15% S, 200 MW)', 'VL3 beyond']; }
    if (c === 'small') { limits = [Math.min(0.20 * S, 40)]; labels = ['VL1 ≤ min(20% S, 40 MW)', 'VL2 beyond']; }
    if (c === 'rerich') { limits = [200, 300]; labels = ['VL1 ≤ 200 MW', 'VL2 200–300 MW', 'VL3 > 300 MW']; }
    if (c === 'superrich') { limits = [250, 350]; labels = ['VL1 ≤ 250 MW', 'VL2 250–350 MW', 'VL3 > 350 MW']; }
    rates = labels.map((_, k) => buyerRate(dir, k, f));
  }
  // Scheduled infirm power after the trial run: over-injection at f > 50.05 Hz is zero (A1 proviso, A2 8(8)(4)).
  if (inp.infirm === 'scheduled' && dir === 'over' && f > 50.05 && onOrAfter(date, 'A1')) {
    rates = rates.map(() => ({ pct: 0, rule: 'BR-IF-05' }));
    notes.push('Scheduled infirm power, frequency above 50.05 Hz: over-injection is charged at zero (BR-IF-05).');
  }
  const vols = split(abs, limits);
  const slabs = vols.map((mw, k) => {
    const pct = rates[k].pct; const unit = rate * pct / 100; // ₹/kWh signed
    const mwh = mw * BLOCK_H; const amt = mwh * 1000 * unit;
    return { label: labels[k], mw, mwh, pct, unit, amt, rule: rates[k].rule };
  });
  const total = slabs.reduce((s, x) => s + x.amt, 0);
  const devPct = denom ? 100 * dev / denom : null;
  return { dev, dir, devPct, denom, slabs, total: r2(total) + 0, basis, notes, pricedAs: type };
}

// Reg 10(1) as amended by A3: due in 10 days, or the NDASPA Detailed Procedure timeline; 0.04%/day after.
function lps(amount, issueDate, payDate, dueDays = 10) {
  const due = new Date(issueDate); due.setDate(due.getDate() + dueDays);
  const days = Math.max(0, Math.round((new Date(payDate) - due) / 86400000));
  return { due, days, surcharge: r2(amount * 0.0004 * days) };
}

if (typeof module !== 'undefined') module.exports = { settle, normalRate, lps, gsRate, buyerRate, split, wsParity, EFFECTIVE };
