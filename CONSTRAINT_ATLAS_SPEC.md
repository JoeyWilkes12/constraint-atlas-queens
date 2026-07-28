# Constraint Atlas: Queens as a Constraint-Modeling Laboratory

Status: implemented companion experience, with a Python-backed Z3 extension
identified as the next technical phase.

Provenance: this specification originated in the Queens screenshot-solver
repository in commit
[`e6382023ea8c06d35e2ad301f4623f131f593cc5`](https://github.com/JoeyWilkes12/Queens/commit/e6382023ea8c06d35e2ad301f4623f131f593cc5)
and moved into the independently versioned Constraint Atlas repository when
the two products became sibling projects.

## Table of contents

- [Purpose](#purpose)
- [Current system](#current-system)
- [Product decision](#product-decision)
- [Evidence and provenance contract](#evidence-and-provenance-contract)
- [Mathematical model](#mathematical-model)
- [Interactive experience](#interactive-experience)
- [Encoding laboratory](#encoding-laboratory)
- [Transfer laboratory](#transfer-laboratory)
- [Z3 concepts to teach](#z3-concepts-to-teach)
- [Architecture alternatives](#architecture-alternatives)
- [Visual and accessibility direction](#visual-and-accessibility-direction)
- [Research basis](#research-basis)
- [Acceptance criteria](#acceptance-criteria)
- [Future phases](#future-phases)

## Purpose

Constraint Atlas uses LinkedIn Queens as a compact, spatially legible entry point
to professional constraint modeling. The board is not the destination. It is a
small example of a reusable workflow:

1. define decision variables and their domains;
2. state hard and soft constraints;
3. ask whether the model is feasible;
4. inspect a witness or a contradiction;
5. compare equivalent formulations; and
6. transfer the same grammar to another decision problem.

The primary audience is quantitative professionals with mathematics, computer
science, operations research, engineering, finance, or analytical backgrounds.
The tone should therefore be exact, compact, and auditable rather than
game-like.

The central product statement is:

> **Queens is the smallest useful model.**

## Current system

The existing project remains the operational screenshot solver. Its pipeline:

1. accepts a pasted or uploaded puzzle screenshot;
2. rectifies the board with OpenCV;
3. ranks possible grid sizes from edge periodicity;
4. clusters cell colors into regions;
5. builds the Boolean Z3 model;
6. validates the returned assignment independently; and
7. renders a downloadable solution.

The working solver should not be destabilized for the educational experience.
Constraint Atlas is therefore an independently versioned companion project in
the `constraint-atlas-queens` repository.
The selected release is privately deployed at
[Constraint Atlas — Queens](https://constraint-atlas-queens.yoshirex12.chatgpt.site).

The verified 7 × 7 teaching instance is extracted from
`Samples/Queens Board Grid Size 7 Date 45635.png`. The current Z3 model returns
the unique one-based placement:

```text
(1,4), (2,7), (3,2), (4,6), (5,3), (6,1), (7,5)
```

A separate blocking-clause query is unsatisfiable for that seed, establishing
uniqueness under the current rules.

## Product decision

The selected first release is a hosted, client-side companion workbench:

- a verified regional board and precomputed Z3 baseline model;
- an explicit, deterministic teaching checker for user experiments;
- linked board, formal constraints, and model projections;
- a stepwise illustrative search that is never represented as Z3's trace;
- encoding comparisons;
- transfer cases; and
- a primary-source research ledger.

This release is deliberately bounded. It teaches modeling and semantic
consequences without claiming to expose engine internals that the current Python
API does not record.

### Why this is the first release

- It can be hosted as a private, low-latency site without uploading puzzle or
  user data.
- It keeps the verified Python screenshot solver unchanged.
- It demonstrates the most transferable ideas immediately.
- It provides a precise interface contract for a later Z3-backed API.
- It avoids the latency, bundle size, and browser-compatibility risk of an
  unvalidated Z3/WebAssembly integration.

## Evidence and provenance contract

Every computational claim in the interface belongs to one of three layers.

| Label | Meaning | Examples |
|---|---|---|
| **Precomputed Z3 result** | Output produced by the project’s Python Z3 solver and preserved as a verified fixture | baseline `sat` model; uniqueness established by a blocking-clause query |
| **Derived model analysis** | A deterministic projection or calculation from the model or active rules | highlighted row, region membership, candidate mask, formula and count summaries |
| **Illustrative search** | A transparent instructional algorithm implemented for the interface | depth-first choices, rejection, and backtracking |

Required wording:

- Use “a model returned by Z3,” not “Z3’s moves.”
- Use “derived from the model,” not “Z3 placed these queens in this order.”
- Keep “not Z3’s internal trace” visible anywhere an illustrative search is
  shown.
- Describe an unsatisfiable core as a conflicting subset, not necessarily the
  unique or minimal explanation.
- Describe a product-minimized conflict only with its method and verification
  limit.

This distinction follows the public Z3 interface, which exposes satisfiability
results, models, cores, proofs when configured, consequences, and statistics,
but does not expose a stable human narrative of its internal search.

## Mathematical model

Let the board be \(V=[n]\times[n]\), and let
\(R_1,\ldots,R_n\) be the colored regions. Define
\(x_{r,c}\in\{0,1\}\) to mean that cell \((r,c)\) contains a queen.

Exactly one queen is placed in each row:

\[
\sum_{c=1}^{n} x_{r,c}=1 \quad \forall r.
\]

Exactly one queen is placed in each column:

\[
\sum_{r=1}^{n} x_{r,c}=1 \quad \forall c.
\]

Exactly one queen is placed in each colored region:

\[
\sum_{(r,c)\in R_k} x_{r,c}=1 \quad \forall k.
\]

Touching cells may not both contain queens:

\[
x_{r,c}+x_{u,v}\leq1
\quad\text{when}\quad
\max(|r-u|,|c-v|)=1.
\]

Because the row and column equations already exclude orthogonally adjacent
queens, the nonredundant local rule is the diagonal-neighbor exclusion:

\[
x_{r,c}+x_{r+1,c\pm1}\leq1.
\]

This distinction matters: LinkedIn Queens forbids only touching diagonal
neighbors. Classical N-Queens forbids every pair that shares any diagonal.

For the 7 × 7 seed, the current Python encoding contains:

- 49 Boolean variables;
- 21 exact-one equalities; and
- 312 directed neighbor implications.

The directed implementation asserts both directions for each neighboring pair
and includes orthogonal implications that are redundant with the row and column
equalities. A normalized mathematical formulation needs only 72 undirected
diagonal-neighbor exclusions for this board.

## Interactive experience

### First viewport

The opening workspace contains:

- the research thesis and evidence legend;
- the 7 × 7 regional board;
- active rule-family controls;
- a draft-assumption strip;
- a run result and witness;
- a cell/constraint inspector; and
- a formal source view.

The first interaction should make the semantic workflow visible:

1. select a cell;
2. add or remove a draft fixed-queen assumption;
3. run the bounded teaching checker;
4. inspect `SAT` or `UNSAT`;
5. compare the witness with the verified baseline; and
6. inspect which constraint families apply to the selected cell.

Base scenario, draft assumptions, and active run must remain visually distinct.
Changing a draft must never silently relabel a prior result.

### Rule experiments

Users can independently enable or disable:

- one per row;
- one per column;
- one per region; and
- no touching queens.

The interface predicts the semantic consequence of a disabled family before a
run. It does not predict an internal solver path.

### Illustrative search

The teaching checker may expose a bounded, deterministic depth-first search:

- choose a row and candidate cell;
- reject locally inconsistent candidates;
- advance after a consistent choice;
- backtrack when no candidate remains; and
- stop after the first witness or a stated event limit.

The event list is useful for teaching search, propagation, and heuristic
trade-offs. It is explicitly not a replay of Z3, whose Boolean/PB preprocessing,
branching, learning, and restart policies are separate and version-dependent.

### Source export

The active experiment can be serialized to readable SMT-LIB:

- Boolean declarations;
- exact-one cardinality constraints;
- touching exclusions;
- named fixed-cell assumptions; and
- `check-sat` / `get-model`.

The export teaches a portable solver interface and makes the model auditable.

## Encoding laboratory

The same semantic problem should be compared through several formulations.

### Boolean incidence matrix

Semantic contract: \(x_{r,c}\) states whether cell \((r,c)\) is selected.

Strengths:

- direct mapping to the board;
- natural row, column, and region cardinalities;
- natural transfer to allocation and selection;
- clean pseudo-Boolean formulation.

Costs:

- \(n^2\) variables;
- exactly-one constraints need a chosen encoding when reduced to CNF;
- pairwise conflict structures can become large.

### Integer per row

Semantic contract: \(q_r\) is the selected column in row \(r\).

Strengths:

- only \(n\) primary variables;
- column uniqueness becomes `Distinct(q)`;
- classical N-Queens diagonals become
  `Distinct(q[r] + r)` and `Distinct(q[r] - r)`.

Costs:

- an irregular colored region needs an indicator or membership expression;
- LinkedIn’s local diagonal rule is
  \(|q_{r+1}-q_r|\ne1\), not the classical global diagonal constraint;
- the spatial mapping is less immediate for new readers.

### Conflict graph

Semantic contract: every cell is a vertex, and edges connect choices that
cannot coexist.

A solution is an independent set of size \(n\) subject to the row, column, and
region partitions. This formulation makes incompatibility explicit and
transfers well to portfolio exclusions, channel assignment, verification
configurations, and scheduling conflicts.

Use an adjacency matrix or filtered neighborhood view instead of an unreadable
dense node-link graph.

### Exact cover and optimization variants

An exact-cover matrix can use row, column, and region requirements as primary
columns. Diagonal-touching pairs become secondary at-most-one columns.

An optimization variant adds:

\[
\max \sum_{r,c} w_{r,c}x_{r,c}
\]

or soft constraints for minimum-edit repair. This moves the lesson from
feasibility to MaxSAT/Optimization Modulo Theories without changing the core
selection grammar.

## Transfer laboratory

The transfer section removes the chess metaphor while preserving the
mathematical structure.

| Domain | Variable | Exactly-one / partition | Conflict | Optional objective |
|---|---|---|---|---|
| Analyst assignment | analyst \(a\) serves mandate \(m\) | one mandate per analyst; coverage per desk | segregation, capacity, skill or independence rules | maximize fit; minimize reassignment |
| Scheduling | job \(j\) starts in slot \(t\) | one start per job; one use per constrained resource | overlap, cooldown, precedence or unavailable adjacency | minimize makespan or lateness |
| Portfolio mandates | asset \(i\) is selected | one representative per sleeve, issuer group, or risk bucket | correlation, liquidity, concentration or policy incompatibility | maximize expected utility under soft limits |
| Configuration and test generation | option \(o\) is active | one choice per feature family; coverage groups | incompatible versions, unsafe combinations, platform exclusions | minimize test count or configuration cost |
| Compute placement | workload \(i\) uses host \(h\) | one host per workload; capacity groups | affinity, anti-affinity, failure-domain and network rules | minimize active hosts or operating cost |

Each case must show a four-column mapping:

1. Queens concept;
2. domain concept;
3. formal constraint;
4. what changes when the policy is relaxed.

## Z3 concepts to teach

### Satisfiability and models

`sat` means at least one assignment satisfies every active assertion. A model is
a witness, not necessarily the only witness. `unsat` means no assignment
satisfies the conjunction. `unknown` is a meaningful solver outcome for some
logics and limits and must not be presented as a generic application failure.

### SAT, SMT, and pseudo-Boolean constraints

Queens is primarily a finite-domain Boolean/cardinality model. It is an
excellent gateway to Z3, but it does not by itself demonstrate all of SMT.
Later cases should introduce arithmetic, bit-vectors, arrays, and uninterpreted
functions where those theories are natural.

### Conceptual CDCL(T) pipeline

A high-level explanation can show:

1. modeling/API or SMT-LIB input;
2. simplification and encoding;
3. Boolean decisions and propagation;
4. theory checks and theory propagation when applicable;
5. conflict explanation and learned exclusions;
6. backjump/restart; and
7. a model, contradiction, or `unknown`.

This is a conceptual architecture diagram, not a trace of a particular Queens
run.

### Assumptions, cores, and repair

A later Z3-backed interface should name user assumptions and ask for an
unsatisfiable core. The user can then disable one assumption and rerun the
experiment. A correction-set or soft-constraint mode can suggest a minimum-cost
repair, with explicit bounds and objective semantics.

## Architecture alternatives

### A. Hosted client-side companion — selected

Use a deterministic JavaScript teaching checker plus verified, precomputed Z3
fixtures.

Advantages:

- simplest private hosting;
- fast and data-minimal;
- ideal for model semantics and transfer;
- no risk to the screenshot solver.

Limitations:

- live experiments are not Z3 calls;
- no raw cores, proofs, tactics, or statistics;
- parity must be maintained for any new fixtures.

### B. Extend the Python/Streamlit application — recommended next

Refactor the Python solver into a model builder that returns:

- the Z3 solver;
- cell variables;
- labeled constraint families;
- assumptions;
- model-blocking helpers; and
- serializable solver state.

Add uniqueness, enumeration, consequences, cores, statistics, timeouts, and
SMT-LIB export. This is the shortest path to genuine live Z3 results and
screenshot-to-explanation continuity.

Public deployment would require a Python-capable host, upload byte/pixel limits,
solver timeouts, session-memory limits, input-region validation, and a review of
third-party image and clipboard dependencies.

### C. Z3/WebAssembly in the browser — research option

The official JavaScript bindings and WebAssembly build can provide genuine Z3
without a Python service.

Advantages:

- private, client-local solving;
- direct models and cores;
- portable static hosting.

Risks:

- large initial bundle and startup cost;
- Worker/bundler and WebAssembly asset compatibility;
- more complex error handling;
- OpenCV screenshot processing still needs a separate browser port or service;
- version and parity tests become mandatory.

This option should be prototyped in isolation before it becomes a production
dependency.

## Visual and accessibility direction

The experience is an analytical studio:

- warm bone workspace;
- deep ink/navy structure;
- restrained teal interaction state;
- coral reserved for contradictions;
- editorial serif display type with compact sans-serif controls;
- a coordinate grid instead of ornamental chess imagery; and
- no gamified score or faux solver spectacle.

Accessibility requirements:

- WCAG 2.2 AA contrast;
- keyboard-operable grid with arrow navigation and Enter/Space activation;
- visible focus and 44 × 44 CSS-pixel touch targets where practical;
- no color-only region, state, or error meaning;
- textual table/formula alternatives for visual relationships;
- polite live-region result announcements;
- reduced-motion support; and
- mobile layouts that sequence the board, rules, inspector, and source instead
  of shrinking a desktop multi-pane layout.

## Research basis

Primary and canonical sources:

- Leonardo de Moura and Nikolaj Bjørner,
  [“Z3: An Efficient SMT Solver”](https://doi.org/10.1007/978-3-540-78800-3_24),
  TACAS 2008.
- Nikolaj Bjørner, Leonardo de Moura, Lev Nachmanson, and Christoph
  Wintersteiger,
  [“Programming Z3”](https://z3prover.github.io/papers/programmingz3.html).
- The Z3 project,
  [“Z3 Internals”](https://z3prover.github.io/papers/z3internals.html).
- The Z3 Guide,
  [propositional and pseudo-Boolean constraints](https://microsoft.github.io/z3guide/docs/logic/propositional-logic/).
- The Z3 Guide,
  [arithmetical optimization](https://microsoft.github.io/z3guide/docs/optimization/arithmeticaloptimization/).
- The SMT-LIB initiative,
  [language standard and benchmark library](https://smt-lib.org/language.shtml).
- LinkedIn Help,
  [official Queens rules](https://www.linkedin.com/help/linkedin/answer/a6269510).
- Narendra Jussien and Samir Ouis,
  [“User-friendly explanations for constraint programming”](https://arxiv.org/abs/cs/0111037).
- Xingjian Li and Susan L. Epstein,
  [“Visualization for Structured Constraint Satisfaction Problems”](https://cdn.aaai.org/ocs/ws/ws0590/2029-8494-1-PB.pdf).
- Ken Bayer, Josh Snyder, and Berthe Y. Choueiry,
  [“An Interactive Constraint-Based Approach to Minesweeper”](https://cdn.aaai.org/AAAI/2006/AAAI06-344.pdf).
- Daniel Bodemer, Rolf Ploetzner, Katrin Bruchmüller, and Sonja Häcker,
  [“Supporting learning with interactive multimedia through active integration of representations”](https://doi.org/10.1007/s11251-004-7685-z).

The product implications are:

- link formal and spatial representations by selection;
- project low-level explanations into meaningful constraint families;
- prefer matrices or filtered neighborhoods for dense conflicts;
- ask users to predict and modify before revealing an outcome; and
- keep execution provenance explicit.

## Acceptance criteria

The companion release is ready when:

- the verified 7 × 7 regions and baseline model render correctly;
- the baseline is identified as precomputed Z3 output;
- live draft assumptions produce deterministic `SAT`/`UNSAT` teaching-engine
  results;
- the page never labels the teaching search as Z3 execution;
- rule toggles change the active model and counts;
- keyboard users can inspect and draft every board cell;
- results are announced to assistive technology;
- SMT-LIB export reflects the active board, rules, and assumptions;
- encoding alternatives explain semantic contracts and trade-offs;
- at least four professional transfer cases show exact mappings;
- every research citation opens its primary or canonical source;
- the project builds with the Sites-compatible runtime;
- the hosted experience is privately deployed; and
- both the implementation and specification have explicit model/version
  lineage in local Git history.

## Future phases

1. Refactor the Python solver into a labeled, introspectable model builder.
2. Add validated `PuzzleInstance` boundaries and region-partition checks.
3. Add live uniqueness and bounded enumeration.
4. Add named assumptions, raw cores, and verified core minimization.
5. Add solver resource limits, `unknown`, and statistics.
6. Link the screenshot solver to the educational workbench with a sanitized
   run artifact.
7. Add formulation parity tests across Boolean, pseudo-Boolean, and
   integer-per-row encodings.
8. Add classical N-Queens, optimization/repair, and exact-cover variants.
9. Prototype Z3/WebAssembly separately and measure bundle, startup, browser,
   and hosting compatibility before adoption.
