// Chart data audit: rate points read directly from the Reg 8(1) and 8(7) tables, checked against the
// engine functions that draw the frequency charts and heatmap. Run with: node tests/rates.test.js
const E=require('../src/engine.js');
const g=(d,k,f)=>E.gsRate(d,k,f).pct, b=(d,k,f)=>E.buyerRate(d,k,f).pct;
const C=[
 // [label, got, expected-from-regulation]
 ['GS over within 50.00', g('over',0,50.00), 100], ['GS over within 50.04', g('over',0,50.04), 75], ['GS over within 50.05', g('over',0,50.05), 50],
 ['GS over within 50.07', g('over',0,50.07), 0], ['GS over within 50.10', g('over',0,50.10), -10], ['GS over within 49.85', g('over',0,49.85), 115],
 ['GS over within 49.90', g('over',0,49.90), 115], ['GS over beyond 50.00', g('over',1,50.00), 0], ['GS over beyond 50.10', g('over',1,50.10), -10],
 ['GS under within 50.05', -g('under',0,50.05), 85], ['GS under within 50.08', -g('under',0,50.08), 85], ['GS under within 49.90', -g('under',0,49.90), 150],
 ['GS under within 49.92', -g('under',0,49.92), 135.75], ['GS under within 49.85', -g('under',0,49.85), 150],
 ['GS under beyond 50.00', -g('under',1,50.00), 100], ['GS under beyond 49.92', -g('under',1,49.92), 150], ['GS under beyond 49.89', -g('under',1,49.89), 200],
 ['BY under VL1 50.00', b('under',0,50.00), 90], ['BY under VL1 50.05', b('under',0,50.05), 50], ['BY under VL1 49.90', b('under',0,49.90), 100],
 ['BY under VL1 50.07', b('under',0,50.07), 0], ['BY under VL1 50.10', b('under',0,50.10), -10], ['BY under VL1 49.85', b('under',0,49.85), 100],
 ['BY under VL2 49.85', b('under',1,49.85), 80], ['BY under VL2 50.03', b('under',1,50.03), 50], ['BY under VL3 50.00', b('under',2,50.00), 0],
 ['BY over VL1 50.05', -b('over',0,50.05), 75], ['BY over VL1 49.90', -b('over',0,49.90), 150], ['BY over VL1 50.07', -b('over',0,50.07), 50],
 ['BY over VL1 50.10', -b('over',0,50.10), 0], ['BY over VL2 49.95', -b('over',1,49.95), 150], ['BY over VL2 50.07', -b('over',1,50.07), 75],
 ['BY over VL3 49.99', -b('over',2,49.99), 200], ['BY over VL3 50.05', -b('over',2,50.05), 100], ['BY over VL3 50.10', -b('over',2,50.10), 50],
];
let bad=0; for(const [l,got,exp] of C){ if(Math.abs(got-exp)>1e-9){bad++;console.log('MISMATCH',l,got,exp);} }
console.log(`${C.length} rate points checked against the regulation tables, ${bad} mismatches`);
process.exit(bad ? 1 : 0);
