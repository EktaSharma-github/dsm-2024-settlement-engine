// Regression suite: expected values were worked out by hand from the CERC DSM Regulations 2024.
// Run with: node tests/engine.test.js
const E = require('../src/engine.js');
const T = [
  ['TC01 General seller +20 MW @50.00 Hz', { type: 'gs', S: 500, A: 520, f: 50.00, rate: 3 }, 15000],
  ['TC02 General seller +20 MW @50.04 Hz', { type: 'gs', S: 500, A: 520, f: 50.04, rate: 3 }, 11250],
  ['TC03 General seller -60 MW @49.95 Hz', { type: 'gs', S: 500, A: 440, f: 49.95, rate: 3 }, -54112.5],
  ['TC04 General seller +40 MW @50.12 Hz', { type: 'gs', S: 200, A: 240, f: 50.12, rate: 3 }, -3000],
  ['TC05 Run-of-River -200 MW', { type: 'ror', S: 1200, A: 1000, f: 50, rate: 4 }, -202500],
  ['TC06 WS solar post-2026 -10 MW', { type: 'ws', S: 60, A: 50, f: 50, rate: 2.5, wsTech: 'solar', regime: 'post', avc: 100, X: 50 }, -7750],
  ['TC07 WS wind pre-2026 +30 MW', { type: 'ws', S: 120, A: 150, f: 50, rate: 3, wsTech: 'wind', regime: 'pre', avc: 200 }, 22500],
  ['TC08 Regular buyer +150 MW @49.95 Hz', { type: 'buyer', S: 1000, A: 1150, f: 49.95, rate: 5, buyerCat: 'regular' }, -250000],
  ['TC09 RE-rich buyer -350 MW @50.02 Hz', { type: 'buyer', S: 3000, A: 2650, f: 50.02, rate: 4, buyerCat: 'rerich' }, 198000],
  ['TC10 Buyer <=400 MW +60 MW @50.07 Hz', { type: 'buyer', S: 300, A: 360, f: 50.07, rate: 5, buyerCat: 'small' }, -43750],
  ['TC11 MSW +5 MW', { type: 'msw', S: 20, A: 25, f: 50, rate: 7 }, 7000],
  // ---- Amendments (A1 23-12-2024, A2 01-07-2025, A3 31-08-2026) ----
  ['TC14 Thermal infirm before trial run, 01-08-2025, NR 3.40 capped 2.86', { type: 'gs', infirm: 'pretrial', plantKind: 'thermal', S: 0, A: 100, f: 50.00, rate: 3.40, date: '2025-08-01' }, 71500],
  ['TC15 Thermal infirm before trial run at 50.07 Hz', { type: 'gs', infirm: 'pretrial', plantKind: 'thermal', S: 0, A: 100, f: 50.07, rate: 3.40, date: '2025-08-01' }, 0],
  ['TC16 Thermal infirm before A2 (01-05-2025)', { type: 'gs', infirm: 'pretrial', plantKind: 'thermal', S: 0, A: 100, f: 50.00, rate: 3.40, date: '2025-05-01' }, 0],
  ['TC17 ESS infirm before trial run, 01-10-2026, NR 1.80', { type: 'ess', infirm: 'pretrial', S: 0, A: 40, f: 50.00, rate: 1.80, date: '2026-10-01' }, 18000],
  ['TC18 ESS infirm before A3 (01-07-2026)', { type: 'ess', infirm: 'pretrial', S: 0, A: 40, f: 50.00, rate: 1.80, date: '2026-07-01' }, 0],
  ['TC19 Scheduled infirm, +30 MW at 50.12 Hz', { type: 'gs', infirm: 'scheduled', S: 100, A: 130, f: 50.12, rate: 3, date: '2026-11-08' }, 0],
  ['TC20 WS AvC 120 MW capped at 100 MW connectivity', { type: 'ws', S: 60, A: 50, f: 50, rate: 2.5, wsTech: 'solar', avc: 120, conn: 100, X: 50, date: '2026-11-08' }, -7750],
  ['TC21 WS parity: bid 01-02-2027, priced as general seller', { type: 'ws', S: 60, A: 50, f: 50.00, rate: 2.5, wsTech: 'solar', avc: 100, X: 50, route: 'bid', keyDate: '2027-02-01', date: '2027-06-01' }, -6250],
  ['TC22 WS no parity: bid 15-12-2026', { type: 'ws', S: 60, A: 50, f: 50.00, rate: 2.5, wsTech: 'solar', avc: 100, X: 50, route: 'bid', keyDate: '2026-12-15', date: '2027-06-01' }, -7750],
];
let fail = 0;
for (const [name, input, exp] of T) {
  const got = E.settle(input).total; const ok = Math.abs(got - exp) < 0.005; if (!ok) fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  expected ${exp}  got ${got}`);
}
const nr = E.normalRate(450, 420, 900).nr; if (nr !== 590) fail++;
console.log(`${nr === 590 ? 'PASS' : 'FAIL'}  TC12 Normal rate = 590.00 paise/kWh  got ${nr}`);
const l = E.lps(100000, '2026-11-03', '2026-11-18').surcharge; if (l !== 200) fail++;
console.log(`${l === 200 ? 'PASS' : 'FAIL'}  TC13 Late payment surcharge = 200  got ${l}`);
const l2 = E.lps(100000, '2026-11-03', '2026-11-25', 15).surcharge; if (l2 !== 280) fail++;
console.log(`${l2 === 280 ? 'PASS' : 'FAIL'}  TC23 LPS with a 15-day procedure timeline = 280  got ${l2}`);
console.log(fail ? `\n${fail} failing` : '\nAll 23 cases pass'); process.exit(fail ? 1 : 0);
