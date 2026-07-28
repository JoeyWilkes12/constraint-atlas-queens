"use client";

import { useEffect, useMemo, useState } from "react";

type RuleKey = "rows" | "columns" | "regions" | "touching";
type Result = { status: "SAT" | "UNSAT"; witness: number[]; explored: number; trace: string[] };

const SIZE = 7;
const BASELINE = [3, 6, 1, 5, 2, 0, 4];
const INITIAL_RULES: Record<RuleKey, boolean> = {
  rows: true,
  columns: true,
  regions: true,
  touching: true,
};
const REGION_NAMES = ["Amber", "Beryl", "Cobalt", "Dahlia", "Ember", "Fern", "Garnet"];
const REGIONS = [
  [0, 0, 4, 4, 4, 0, 6], [0, 0, 0, 0, 4, 0, 6], [0, 0, 0, 0, 0, 0, 6],
  [0, 0, 0, 0, 0, 5, 6], [0, 0, 3, 0, 0, 5, 5], [2, 2, 3, 0, 0, 1, 5],
  [2, 2, 3, 3, 1, 1, 1],
];
const COLS = ["A", "B", "C", "D", "E", "F", "G"];
const RULE_COPY: Record<RuleKey, { title: string; formula: string; text: string }> = {
  rows: { title: "Rows", formula: "∀r. Σc qᵣ,ᶜ = 1", text: "exactly one selection per row" },
  columns: { title: "Columns", formula: "∀c. Σr qᵣ,ᶜ = 1", text: "exactly one selection per column" },
  regions: { title: "Regions", formula: "∀g. Σ(r,c)∈g qᵣ,ᶜ = 1", text: "exactly one selection per coloured region" },
  touching: {
    title: "Non-touching",
    formula: "max(|Δr|, |Δc|) = 1 ⇒ qᵤ + qᵥ ≤ 1",
    text: "adjacent cells, including diagonals, cannot both be selected",
  },
};

const id = (r: number, c: number) => r * SIZE + c;
const rc = (cell: number) => [Math.floor(cell / SIZE), cell % SIZE] as const;

function unitCells(kind: RuleKey, index: number) {
  if (kind === "rows") return Array.from({ length: SIZE }, (_, c) => id(index, c));
  if (kind === "columns") return Array.from({ length: SIZE }, (_, r) => id(r, index));
  return Array.from({ length: SIZE * SIZE }, (_, cell) => cell).filter((cell) => {
    const [r, c] = rc(cell); return REGIONS[r][c] === index;
  });
}

function solve(draft: Set<number>, rules: Record<RuleKey, boolean>): Result {
  const selected = new Set(draft);
  const trace: string[] = ["Start from the visible fixed assumptions; choose an unsatisfied partition deterministically."];
  let explored = 0;
  const activeUnits = (["rows", "columns", "regions"] as RuleKey[]).filter((kind) => rules[kind]);
  const conflicts = (cell: number, set: Set<number>) => {
    const [r, c] = rc(cell);
    for (const other of set) {
      if (other === cell) continue;
      const [or, oc] = rc(other);
      if (rules.rows && r === or) return true;
      if (rules.columns && c === oc) return true;
      if (rules.regions && REGIONS[r][c] === REGIONS[or][oc]) return true;
      if (
        rules.touching &&
        Math.max(Math.abs(r - or), Math.abs(c - oc)) === 1
      ) {
        return true;
      }
    }
    return false;
  };
  if ([...selected].some((cell) => conflicts(cell, selected))) {
    trace.push("A fixed assumption already conflicts with another fixed assumption.");
    return { status: "UNSAT", witness: [], explored, trace };
  }
  const complete = (set: Set<number>) => activeUnits.every((kind) =>
    Array.from({ length: SIZE }, (_, i) => unitCells(kind, i).some((cell) => set.has(cell))).every(Boolean));
  const search = (): boolean => {
    explored += 1;
    let target: number[] | null = null;
    for (const kind of activeUnits) for (let i = 0; i < SIZE; i += 1) {
      const cells = unitCells(kind, i);
      if (!cells.some((cell) => selected.has(cell)) && (!target || cells.length < target.length)) target = cells;
    }
    if (!target || complete(selected)) { trace.push("Every enabled partition is covered: witness complete."); return true; }
    for (const cell of target) {
      if (conflicts(cell, selected)) continue;
      const [r, c] = rc(cell);
      if (trace.length < 28) trace.push(`Try ${COLS[c]}${r + 1}; it satisfies the next open partition.`);
      selected.add(cell);
      if (search()) return true;
      selected.delete(cell);
      if (trace.length < 28) trace.push(`Retract ${COLS[c]}${r + 1}; that branch cannot complete.`);
    }
    return false;
  };
  const sat = search();
  if (!sat) trace.push("All compatible branches closed: UNSAT for this draft and rule set.");
  return { status: sat ? "SAT" : "UNSAT", witness: sat ? [...selected] : [], explored, trace };
}

function smtSource(draft: Set<number>, rules: Record<RuleKey, boolean>) {
  const lines = ["; Constraint Atlas — 7×7 Boolean-grid encoding", "; Baseline provenance: Z3 SAT; blocking this model is UNSAT (unique).", "(set-logic QF_FD)", "(set-option :produce-models true)"];
  for (let r = 0; r < SIZE; r += 1) for (let c = 0; c < SIZE; c += 1) lines.push(`(declare-const q_${r}_${c} Bool)`);
  const or = (cells: number[]) => `(or ${cells.map((cell) => { const [r, c] = rc(cell); return `q_${r}_${c}`; }).join(" ")})`;
  const atMost = (cells: number[]) => cells.flatMap((a, i) => cells.slice(i + 1).map((b) => { const [ar, ac] = rc(a); const [br, bc] = rc(b); return `(assert (not (and q_${ar}_${ac} q_${br}_${bc})))`; }));
  (["rows", "columns", "regions"] as RuleKey[]).filter((k) => rules[k]).forEach((kind) => Array.from({ length: SIZE }, (_, i) => unitCells(kind, i)).forEach((cells) => { lines.push(`(assert ${or(cells)})`, ...atMost(cells)); }));
  if (rules.touching) {
    const neighborOffsets = [[0, 1], [1, -1], [1, 0], [1, 1]];
    for (let r = 0; r < SIZE; r += 1) {
      for (let c = 0; c < SIZE; c += 1) {
        for (const [dr, dc] of neighborOffsets) {
          const nr = r + dr;
          const nc = c + dc;
          if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE) {
            lines.push(
              `(assert (not (and q_${r}_${c} q_${nr}_${nc})))`,
            );
          }
        }
      }
    }
  }
  draft.forEach((cell) => { const [r, c] = rc(cell); lines.push(`(assert q_${r}_${c})`); });
  return [...lines, "(check-sat)", "(get-model)"].join("\n");
}

export default function Home() {
  const [rules, setRules] =
    useState<Record<RuleKey, boolean>>(INITIAL_RULES);
  const [draft, setDraft] = useState<Set<number>>(new Set());
  const [activeRules, setActiveRules] =
    useState<Record<RuleKey, boolean>>(INITIAL_RULES);
  const [activeDraft, setActiveDraft] = useState<Set<number>>(new Set());
  const [runId, setRunId] = useState(1);
  const [baselineShown, setBaselineShown] = useState(false);
  const [selected, setSelected] = useState<number>(id(0, 0));
  const [step, setStep] = useState(0);
  const [copied, setCopied] = useState(false);
  const result = useMemo(
    () => solve(activeDraft, activeRules),
    [activeDraft, activeRules],
  );
  const source = useMemo(
    () => smtSource(activeDraft, activeRules),
    [activeDraft, activeRules],
  );
  useEffect(() => setStep(0), [activeDraft, activeRules]);
  const witness = new Set(result.witness);
  const toggleCell = (cell: number) => setDraft((current) => { const next = new Set(current); next.has(cell) ? next.delete(cell) : next.add(cell); return next; });
  const reset = () => {
    setDraft(new Set());
    setActiveDraft(new Set());
    setBaselineShown(false);
    setRules(INITIAL_RULES);
    setActiveRules(INITIAL_RULES);
    setSelected(id(0, 0));
    setRunId(1);
    setCopied(false);
  };
  const runDraft = () => {
    setActiveDraft(new Set(draft));
    setActiveRules({ ...rules });
    setRunId((value) => value + 1);
    setCopied(false);
  };
  const reveal = () => setBaselineShown(true);
  const download = () => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([source], { type: "text/plain" })); a.download = "constraint-atlas.smt2"; a.click(); URL.revokeObjectURL(a.href); };
  const activeCount = Object.values(activeRules).filter(Boolean).length;
  const draftKey = [...draft].sort((a, b) => a - b).join(",");
  const activeDraftKey = [...activeDraft].sort((a, b) => a - b).join(",");
  const isDirty =
    draftKey !== activeDraftKey ||
    (Object.keys(rules) as RuleKey[]).some(
      (key) => rules[key] !== activeRules[key],
    );
  const moveSelection = (button: HTMLButtonElement, cell: number) => {
    setSelected(cell);
    requestAnimationFrame(() => {
      const next = button.parentElement?.querySelector<HTMLButtonElement>(
        `[data-cell="${cell}"]`,
      );
      next?.focus();
    });
  };
  const [sr, sc] = rc(selected);
  return (
    <main>
      <header className="site-header"><a className="wordmark" href="#top">Constraint Atlas <span>· Queens</span></a><nav aria-label="Section navigation"><a href="#workbench">Workbench</a><a href="#encodings">Encodings</a><a href="#transfer">Transfer</a><a href="#ledger">Ledger</a></nav></header>
      <section id="top" className="hero"><p className="eyebrow">A constraint workbench for quantitative professionals</p><h1>Queens is the <em>smallest useful model.</em></h1><p className="lede">A regional board turns strategy into an explicit model: variables, partitions, conflicts, a solver contract, and evidence you can inspect rather than merely trust.</p><div className="hero-notes"><span>Boolean grid</span><span>Finite domains</span><span>Transparent search</span></div></section>

      <section id="workbench" className="workbench" aria-labelledby="workbench-title"><div className="section-kicker"><p className="eyebrow">01 / live model</p><h2 id="workbench-title">Regional Queens</h2><p>Draft assumptions and rule changes, then run the bounded teaching checker. The baseline remains a separate, supplied solver evidence layer.</p></div>
        <div className="evidence-strip"><div><strong>Precomputed Z3 result</strong><span>Verified 7×7 baseline: SAT and unique; a separate blocking-clause query was UNSAT.</span></div><div><strong>Derived model analysis</strong><span>Run {runId}: {activeCount} active rule families · {activeDraft.size} active assumptions · {result.explored} deterministic nodes.</span></div><div><strong>Illustrative search</strong><span>Teaching trace only — <b>not Z3’s internal trace.</b></span></div></div>
        <div className="lab-grid"><section className="board-panel" aria-label="Regional Queens board"><div className="board-toolbar"><div><span className={`status ${result.status.toLowerCase()}`}>{result.status}</span><span className="result-copy" aria-live="polite">{result.status === "SAT" ? `Run ${runId} has a witness.${isDirty ? " Draft changes are not active yet." : ""}` : `Run ${runId} has no witness.${isDirty ? " Draft changes are not active yet." : ""}`}</span></div><div className="actions"><button onClick={reset}>Reset</button><button className="button-accent" onClick={runDraft} disabled={!isDirty}>{isDirty ? "Run draft" : "Draft active"}</button><button onClick={reveal}>{baselineShown ? "Baseline shown" : "Reveal baseline"}</button></div></div><div className="board-wrap"><div className="corner" />{COLS.map((col) => <div className="axis col-axis" key={col}>{col}</div>)}{Array.from({ length: SIZE }, (_, r) => <div className="axis row-axis" key={`row-${r}`}>{r + 1}</div>)}<div className="board" role="grid" aria-label="Constraint board; use arrow keys to move and Enter or Space to toggle a draft queen assumption">{Array.from({ length: SIZE * SIZE }, (_, cell) => { const [r, c] = rc(cell); const isDraft = draft.has(cell); const isWitness = witness.has(cell); const isBaseline = baselineShown && BASELINE[r] === c; const isSelected = selected === cell; return <button key={cell} data-cell={cell} tabIndex={isSelected ? 0 : -1} role="gridcell" aria-label={`${COLS[c]}${r + 1}, ${REGION_NAMES[REGIONS[r][c]]}${isBaseline ? ", precomputed baseline queen" : ""}${isDraft ? ", draft fixed queen" : ""}${activeDraft.has(cell) ? ", active fixed queen" : ""}${isWitness ? ", active run witness" : ""}`} aria-pressed={isDraft} className={`square region-${REGIONS[r][c]} ${isBaseline ? "baseline" : ""} ${isDraft ? "draft" : ""} ${isWitness ? "witness" : ""} ${isSelected ? "selected" : ""}`} onFocus={() => setSelected(cell)} onClick={() => { setSelected(cell); toggleCell(cell); }} onKeyDown={(e) => { if (e.key === "ArrowRight") { e.preventDefault(); moveSelection(e.currentTarget, id(r, Math.min(SIZE - 1, c + 1))); } if (e.key === "ArrowLeft") { e.preventDefault(); moveSelection(e.currentTarget, id(r, Math.max(0, c - 1))); } if (e.key === "ArrowDown") { e.preventDefault(); moveSelection(e.currentTarget, id(Math.min(SIZE - 1, r + 1), c)); } if (e.key === "ArrowUp") { e.preventDefault(); moveSelection(e.currentTarget, id(Math.max(0, r - 1), c)); } }}>{(isDraft || isWitness || isBaseline) && <span aria-hidden="true">♛</span>}<small>{REGION_NAMES[REGIONS[r][c]][0]}</small></button>; })}</div></div><div className="legend"><span><i className="baseline-dot" /> Precomputed baseline</span><span><i className="draft-dot" /> Draft assumption</span><span><i className="witness-dot" /> Active run witness</span><span><i className="region-dot" /> Region partition</span></div></section>
          <aside className="control-panel"><div className="inspector"><p className="micro-label">Selected cell</p><h3>{COLS[sc]}{sr + 1} <span>· {REGION_NAMES[REGIONS[sr][sc]]}</span></h3><p>{draft.has(selected) ? "A draft fixed-queen assumption. Click again or press Space to remove it, then run the draft." : "No draft assumption here. A witness queen, if shown, belongs to the active run."}</p></div><fieldset><legend>Draft constraint families</legend>{(Object.keys(RULE_COPY) as RuleKey[]).map((key) => <label className="rule-switch" key={key}><input type="checkbox" checked={rules[key]} onChange={() => setRules((v) => ({ ...v, [key]: !v[key] }))} /><span><b>{RULE_COPY[key].title}</b><small>{RULE_COPY[key].text}</small></span><code>{RULE_COPY[key].formula}</code></label>)}</fieldset><div className="counts"><div><span>Variables</span><b>49 Bool</b></div><div><span>Active exact-one</span><b>{(["rows", "columns", "regions"] as RuleKey[]).filter((k) => activeRules[k]).length * SIZE}</b></div><div><span>Active adjacency pairs</span><b>{activeRules.touching ? 156 : 0}</b></div><div><span>Draft / active / witness</span><b>{draft.size} / {activeDraft.size} / {result.witness.length}</b></div></div><p className="provenance">The Python baseline uses 21 exact-one equalities and 312 directed neighbor implications. The normalized model has 156 undirected adjacent pairs; with row and column rules active, 84 orthogonal pairs are redundant and 72 diagonal pairs remain.</p></aside></div>
        <div className="trace-source"><section className="trace-panel"><div className="panel-heading"><div><p className="micro-label">Illustrative search · active run {runId}</p><h3>Step trace</h3></div><span>not Z3’s internal trace</span></div><ol>{result.trace.slice(0, Math.max(1, step + 1)).map((event, i) => <li className={i === step ? "current" : ""} key={`${event}-${i}`}>{event}</li>)}</ol><div className="step-controls"><button onClick={() => setStep((v) => Math.max(0, v - 1))} disabled={step === 0}>Back</button><span>{Math.min(step + 1, result.trace.length)} / {result.trace.length}</span><button onClick={() => setStep((v) => Math.min(result.trace.length - 1, v + 1))} disabled={step >= result.trace.length - 1}>Next</button></div></section><section className="source-panel"><div className="panel-heading"><div><p className="micro-label">Portable active run</p><h3>SMT-LIB source</h3></div><div className="actions"><button onClick={() => { navigator.clipboard?.writeText(source); setCopied(true); }}>{copied ? "Copied" : "Copy"}</button><button className="button-accent" onClick={download}>Export .smt2</button></div></div><pre aria-label={`SMT-LIB source for active run ${runId}`}>{source}</pre></section></div>
      </section>

      <section id="encodings" className="content-section"><p className="eyebrow">02 / representations</p><h2>Same semantics, different leverage.</h2><div className="encoding-grid"><article><p className="card-index">A</p><h3>Boolean grid</h3><code>q[r,c] ∈ Bool</code><p><b>Contract:</b> a cell is selected or not; all requested partitions are exact-one.</p><p><b>Trade-off:</b> most transparent for audits and regional rules; 49 variables here, quadratic pairwise exclusions.</p></article><article><p className="card-index">B</p><h3>Integer per row</h3><code>col[r] ∈ 0..6</code><p><b>Contract:</b> each row chooses one column; distinctness captures columns.</p><p><b>Trade-off:</b> compact for classical Queens; regions and conditional rules need element/lookup constraints.</p></article><article><p className="card-index">C</p><h3>Conflict graph</h3><code>∀(u,v)∈E. xᵤ + xᵥ ≤ 1</code><p><b>Contract:</b> vertices are choices; edges are incompatible pairs; partitions encode coverage.</p><p><b>Trade-off:</b> makes sparse conflicts legible; loses row/column geometry without annotations.</p></article></div></section>

      <section id="transfer" className="content-section transfer"><p className="eyebrow">03 / transfer lab</p><h2>Translate the structure, not the chessboard.</h2><div className="transfer-grid"><article><h3>Assignment</h3><p><b>Variables:</b> person × role choices. <b>Partitions:</b> each person and role. <b>Conflicts:</b> unavailable pairs or incompatible certifications. <b>Objective:</b> maximize fit or minimize cost.</p></article><article><h3>Scheduling</h3><p><b>Variables:</b> job × time-slot choices. <b>Partitions:</b> each job and resource. <b>Conflicts:</b> overlap, setup, adjacency. <b>Objective:</b> minimize makespan or lateness.</p></article><article><h3>Portfolio / mandate</h3><p><b>Variables:</b> mandate × instrument selections. <b>Partitions:</b> mandates, sleeves, exposure buckets. <b>Conflicts:</b> concentration and policy exclusions. <b>Objective:</b> maximize expected utility under limits.</p></article><article><h3>Configuration / verification</h3><p><b>Variables:</b> component × setting choices. <b>Partitions:</b> required interfaces and zones. <b>Conflicts:</b> incompatible versions or safety rules. <b>Objective:</b> feasible configuration, then preferred cost/performance.</p></article></div></section>

      <section className="content-section z3"><p className="eyebrow">04 / solver context</p><h2>How Z3 fits</h2><p>Z3 is a general-purpose satisfiability modulo theories solver. In a Boolean encoding, a SAT-style engine proposes assignments and learns from conflicts; theory solvers add disciplined reasoning for domains such as arithmetic, arrays, and bit-vectors. CDCL(T) is the useful conceptual pipeline: <b>encode</b> a contract → <b>search</b> a Boolean skeleton → <b>check</b> theory consistency → <b>learn</b> a blocking explanation → <b>return</b> SAT with a model, UNSAT, or UNKNOWN. This page’s trace is deliberately a small transparent backtracker, not a reconstruction of that internal process.</p></section>

      <section id="ledger" className="content-section ledger"><p className="eyebrow">05 / research ledger</p><h2>Claims with a trail.</h2><p>The LinkedIn Queens variant used here requires exactly one queen in every row, column, and coloured region, while forbidding queens in adjacent cells, including diagonally. Because the row and column equations already exclude orthogonal neighbors, its extra diagonal restriction is local to <em>touching</em> cells. Classical N-Queens instead forbids attacks across full diagonals.</p><ul><li><a href="https://doi.org/10.1007/978-3-540-78800-3_24" target="_blank" rel="noreferrer">Z3: An Efficient SMT Solver</a> — original architecture paper.</li><li><a href="https://z3prover.github.io/papers/programmingz3.html" target="_blank" rel="noreferrer">Programming Z3</a> and <a href="https://z3prover.github.io/papers/z3internals.html" target="_blank" rel="noreferrer">Z3 Internals</a> — primary technical references.</li><li><a href="https://microsoft.github.io/z3guide/docs/logic/propositional-logic/" target="_blank" rel="noreferrer">Z3 Guide: propositional logic</a> and <a href="https://microsoft.github.io/z3guide/docs/optimization/arithmeticaloptimization/" target="_blank" rel="noreferrer">arithmetic optimization</a>.</li><li><a href="https://www.linkedin.com/help/linkedin/answer/a6269510" target="_blank" rel="noreferrer">LinkedIn Queens help</a> — game rule source.</li><li><a href="https://arxiv.org/abs/cs/0111037" target="_blank" rel="noreferrer">User-friendly explanations for constraint programming</a> and <a href="https://cdn.aaai.org/ocs/ws/ws0590/2029-8494-1-PB.pdf" target="_blank" rel="noreferrer">Visualization for Structured Constraint Satisfaction Problems</a>.</li></ul></section>
      <footer>Constraint Atlas · A compact field guide to inspectable constraints.</footer>
    </main>
  );
}
