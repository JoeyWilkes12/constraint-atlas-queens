# Constraint Atlas — Queens

A single-page constraint workbench that uses a compact regional Queens board to make modelling decisions inspectable. It is designed for quantitative professionals who need to distinguish a model’s semantic contract, a derived result, and a solver’s evidence.

## Table of contents

- [What the workbench does](#what-the-workbench-does)
- [Evidence boundaries](#evidence-boundaries)
- [Regional Queens contract](#regional-queens-contract)
- [Encodings](#encodings)
- [Research ledger](#research-ledger)
- [Production build](#production-build)

## What the workbench does

- Provides a keyboard-operable, verified 7×7 regional board with row and column labels.
- Lets a reader draft fixed queen assumptions and switch row, column, region, and adjacent-diagonal rule families independently.
- Runs a deterministic, bounded JavaScript backtracking checker for the visible draft and exposes its teaching trace.
- Produces a copyable and exportable SMT-LIB Boolean-grid encoding.
- Separates the supplied baseline, derived board analysis, and illustrative search so that the page never represents its own trace as Z3 output.

## Evidence boundaries

The site makes three evidence layers visible:

1. **Precomputed Z3 result** — the supplied baseline model, labelled as precomputed SAT evidence. A separate query that blocks the returned model is UNSAT, establishing uniqueness for this instance.
2. **Derived model analysis** — counts and a witness computed from the active board configuration.
3. **Illustrative search** — a transparent browser-side backtracker. Its persistent label states that it is **not Z3’s internal trace**.

## Regional Queens contract

The baseline uses 49 Boolean variables `q[r,c]` on a seven-by-seven grid, with 21 exact-one equalities. Its Python/Z3 pipeline has 312 directed neighbor implications. The independent non-touching family forbids all 156 undirected adjacent pairs: horizontal, vertical, and diagonal. When row and column exact-one rules are active, their 84 orthogonal pairs are redundant, leaving 72 additional local diagonal exclusions. Enabled partitions require exactly one queen in each selected row, column, or coloured region. Non-touching does not forbid longer, nonadjacent classical Queen diagonals.

This corresponds to LinkedIn’s Queens variant: exactly one queen per row, column, and region, with no queens on touching diagonals. It is deliberately different from classical N-Queens, which forbids all diagonal attacks.

## Encodings

The interface compares three alternatives:

- **Boolean grid:** most direct for regional and audit-friendly constraints.
- **Integer per row:** compact for classical row/column Queens, but more indirect for regions.
- **Conflict graph:** good for sparse incompatibilities; geometry requires annotations.

## Research ledger

- [Z3: An Efficient SMT Solver](https://doi.org/10.1007/978-3-540-78800-3_24)
- [Programming Z3](https://z3prover.github.io/papers/programmingz3.html)
- [Z3 Internals](https://z3prover.github.io/papers/z3internals.html)
- [Z3 Guide: Propositional logic](https://microsoft.github.io/z3guide/docs/logic/propositional-logic/)
- [Z3 Guide: Arithmetic optimization](https://microsoft.github.io/z3guide/docs/optimization/arithmeticaloptimization/)
- [LinkedIn Queens help](https://www.linkedin.com/help/linkedin/answer/a6269510)
- [User-friendly explanations for constraint programming](https://arxiv.org/abs/cs/0111037)
- [Visualization for Structured Constraint Satisfaction Problems](https://cdn.aaai.org/ocs/ws/ws0590/2029-8494-1-PB.pdf)

## Project shape

The existing vinext source and Sites configuration are intentionally preserved as the design/reference implementation. No database, login, or remote state is required: the model state is purely in the current browser session.

## Production build

The production build is a zero-dependency, browser-native Cloudflare Worker, not a vinext build. External package installation was unavailable in this environment, so `npm run build` uses only Node built-ins to combine:

- `static/index.template.html`, the source-controlled server-rendered page;
- `static/model-data.json`, the verified 7×7 regions, baseline, and rule copy;
- `static/model.js`, the deterministic bounded checker and SMT-LIB generator;
- `static/app.js`, the accessible draft → Run interaction layer; and
- `app/globals.css`, shared directly with the vinext reference surface.

The build emits `dist/server/index.js` as Cloudflare Worker-compatible ESM and copies `public/og.png` to `dist/client/og.png`. The Worker derives absolute Open Graph and Twitter image URLs from each request origin and delegates `/og.png` to `env.ASSETS` when that binding is available.

Both `npm run build` and `npm test` work without an installed `node_modules` directory. The vinext files remain available for future restoration or comparison, but the production output must not be described as a vinext build.
