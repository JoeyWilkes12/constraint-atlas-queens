# Constraint Atlas — Queens

A single-page constraint workbench that uses a compact regional Queens board to make modelling decisions inspectable. It is designed for quantitative professionals who need to distinguish a model’s semantic contract, a derived result, and a solver’s evidence.

## Table of contents

- [What the workbench does](#what-the-workbench-does)
- [Published workbench](#published-workbench)
- [Companion screenshot solver](#companion-screenshot-solver)
- [Evidence boundaries](#evidence-boundaries)
- [Regional Queens contract](#regional-queens-contract)
- [Encodings](#encodings)
- [Research ledger](#research-ledger)
- [Specification and provenance](#specification-and-provenance)
- [Production builds](#production-builds)
- [GitHub Pages deployment](#github-pages-deployment)
- [Replit deployment](#replit-deployment)

## What the workbench does

- Provides a keyboard-operable, verified 7×7 regional board with row and column labels.
- Lets a reader draft fixed queen assumptions and switch row, column, region, and adjacent-diagonal rule families independently.
- Runs a deterministic, bounded JavaScript backtracking checker for the visible draft and exposes its teaching trace.
- Produces a copyable and exportable SMT-LIB Boolean-grid encoding.
- Separates the supplied baseline, derived board analysis, and illustrative search so that the page never represents its own trace as Z3 output.

## Published workbench

- [Open Constraint Atlas on GitHub Pages](https://joeywilkes12.github.io/constraint-atlas-queens/).
- [Open the existing Sites deployment](https://constraint-atlas-queens.yoshirex12.chatgpt.site).

The Sites deployment remains available while the GitHub Pages publication is
validated. The repository keeps both build targets so the hosting decision can
be changed without rewriting the workbench.

## Companion screenshot solver

[LinkedIn Queens Screenshot Solver](https://github.com/JoeyWilkes12/Queens) is
the operational Python/Streamlit companion. It reads a blank puzzle screenshot
with OpenCV, infers the colored regions, and solves the board with Z3. The two
products share the regional Queens model and documentation, but they have
independent runtimes, releases, and repositories.

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

## Specification and provenance

[Constraint Atlas: Queens as a Constraint-Modeling Laboratory](CONSTRAINT_ATLAS_SPEC.md)
defines the mathematical contract, evidence boundaries, architecture
alternatives, acceptance criteria, and proposed Z3-backed extensions. The
specification originated in the screenshot-solver repository in commit
[`e6382023ea8c06d35e2ad301f4623f131f593cc5`](https://github.com/JoeyWilkes12/Queens/commit/e6382023ea8c06d35e2ad301f4623f131f593cc5);
its provenance note preserves that lineage after the project split.

## Project shape

The existing vinext source and Sites configuration are intentionally preserved as the design/reference implementation. No database, login, or remote state is required: the model state is purely in the current browser session.

## Production builds

Both production builds are zero-dependency and browser-native. External package
installation was unavailable in the original build environment, so the scripts
use only Node built-ins to combine:

- `static/index.template.html`, the source-controlled server-rendered page;
- `static/model-data.json`, the verified 7×7 regions, baseline, and rule copy;
- `static/model.js`, the deterministic bounded checker and SMT-LIB generator;
- `static/app.js`, the accessible draft → Run interaction layer; and
- `app/globals.css`, shared directly with the vinext reference surface.

`npm run build` emits `dist/server/index.js` as Cloudflare Worker-compatible
ESM and copies `public/og.png` to `dist/client/og.png`. The Worker derives
absolute Open Graph and Twitter image URLs from each request origin and
delegates `/og.png` to `env.ASSETS` when that binding is available.

`npm run build:pages` emits a standalone `dist/pages/index.html`,
`dist/pages/og.png`, and `.nojekyll`. The HTML contains the complete CSS, model
data, model, and interface code; only the social image is a separate asset.

Both `npm run build` and `npm test` work without an installed `node_modules`
directory. The vinext files remain available for future restoration or
comparison. The generated production outputs are not a vinext build.

## GitHub Pages deployment

The workflow at `.github/workflows/pages.yml` runs the complete model and
rendering tests, injects the GitHub project-site URL into social metadata,
uploads `dist/pages`, and deploys it through GitHub's official Pages actions.
It runs on pushes to `main` and can also be started manually.

Repository administrators must select **GitHub Actions** as the Pages source.
The workflow uses the standard `pages: write` and `id-token: write`
permissions documented by
[GitHub Pages custom workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

## Replit deployment

Constraint Atlas is suitable for a public
[Replit Static Deployment](https://docs.replit.com/cloud-services/deployments/static-deployments):
run `npm run build:pages` and publish `dist/pages`. It needs no server,
database, storage, or Reserved VM.

GitHub
[`JoeyWilkes12/constraint-atlas-queens`](https://github.com/JoeyWilkes12/constraint-atlas-queens)
`main` is the authoritative source for final deployments. Replit source
control and repository visibility are already integrated with GitHub. See
[the complete Replit deployment specification](REPLIT_DEPLOYMENT_SPEC.md) for
the release, social-metadata, operations, and acceptance contract.
