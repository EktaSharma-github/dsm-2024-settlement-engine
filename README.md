# DSM 2024 Settlement Engine — Functional BA Case Study

A Functional Business Analyst portfolio project. It turns the **CERC (Deviation Settlement Mechanism and Related Matters) Regulations, 2024** (No. L-1/260/2021/CERC, 05 Aug 2024) into a full requirements pack and a working, tested settlement engine for Indian power markets.

**Live demo:** open `index.html` in any browser. It's a single file with no build step or dependencies.

## What's inside

| BA deliverable | Where |
|---|---|
| Problem statement, objectives, success measures, stakeholder map | `index.html` → Context |
| Weekly settlement process (RLDC → RPC → payment → LPS / LC) and flowchart | `index.html` → Process |
| 49 business rules, each traced to a regulation clause (`BR-GS-01` … `BR-PY-03`) | `index.html` → Business rules |
| Single-block calculator for every entity type, plus normal rate and late-payment-surcharge calculators | `index.html` → Calculator |
| 96-block day simulator with CSV input, chart and product insights | `index.html` → Day simulator |
| Regression suite: 13 hand-calculated cases, run live in the page and from the command line | `index.html` → Test suite, `tests/` |
| User stories with Given/When/Then acceptance criteria (MoSCoW) | `index.html` → User stories |
| Clarification log: 12 ambiguities in the regulation, each with a working assumption | `index.html` → Clarification log |
| Data inputs, non-functional requirements, phased roadmap | `index.html` → Data & delivery |

## Entities covered

General seller · standalone ESS · Run-of-River hydro · MSW plant · wind / solar / hybrid (WS) seller under both regimes (to 31-03-2026 and from 01-04-2026) · buyers (regular, up to 400 MW, RE-rich, RE super-rich).

## Sample findings from the clarification log

- **G-01:** "10% D<sub>GS</sub> or 100 MW". D<sub>GS</sub> is defined as the deviation itself, so the limit is read as min(10% × schedule, 100 MW).
- **G-02:** The weighting *X* in the WS denominator from 01-04-2026 hasn't been notified yet, so it's kept as dated configuration.
- **G-04:** The step rates don't reach the stated end points: 7 × 2.15% = 15.05% (the regulation says 115%) and 7 × 7.15% = 50.05% (it says 150%).
- **G-06:** A buyer with exactly 400 MW scheduled fits two volume-limit categories.

## Run the tests

```bash
node tests/engine.test.js
```

## Structure

```
index.html            Case study and interactive prototype (engine inlined)
src/engine.js         Settlement engine (pure functions, Node and browser)
tests/engine.test.js  Hand-calculated regression suite
docs/                 Source regulation (CERC notification)
```

## Sign convention

A positive amount is receivable by the entity. A negative amount is payable to the Deviation and Ancillary Service Pool Account. Each block is 15 minutes, so MWh = MW × 0.25.

---
This is a portfolio work sample, not legal or commercial advice. The day simulator uses synthetic data.
