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
console.log(fail ? `\n${fail} failing` : '\nAll 13 cases pass'); process.exit(fail ? 1 : 0);
