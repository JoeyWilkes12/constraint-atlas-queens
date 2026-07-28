(function startConstraintAtlas(global) {
  "use strict";

  const DATA = global.CONSTRAINT_ATLAS_DATA;
  const MODEL = global.ConstraintAtlasModel;
  if (!DATA || !MODEL) throw new Error("Constraint Atlas model failed to initialize");

  const initialRules = Object.fromEntries(MODEL.RULE_KEYS.map((key) => [key, true]));
  const state = {
    rules: { ...initialRules },
    activeRules: { ...initialRules },
    draft: new Set(),
    activeDraft: new Set(),
    baselineShown: false,
    selected: MODEL.id(0, 0),
    runId: 1,
    step: 0,
    copied: false,
    copyFailed: false,
    result: null,
    source: "",
  };

  const elements = {
    adjacencyCount: document.querySelector("#adjacency-count"),
    backButton: document.querySelector("#back-button"),
    baselineButton: document.querySelector("#baseline-button"),
    board: document.querySelector(".board"),
    copyButton: document.querySelector("#copy-button"),
    derivedEvidence: document.querySelector("#derived-evidence"),
    downloadButton: document.querySelector("#download-button"),
    exactOneCount: document.querySelector("#exact-one-count"),
    nextButton: document.querySelector("#next-button"),
    resetButton: document.querySelector("#reset-button"),
    resultCopy: document.querySelector("#result-copy"),
    resultStatus: document.querySelector("#result-status"),
    runButton: document.querySelector("#run-button"),
    selectionCounts: document.querySelector("#selection-counts"),
    selectedCoordinate: document.querySelector("#selected-coordinate"),
    selectedDescription: document.querySelector("#selected-description"),
    selectedRegion: document.querySelector("#selected-region"),
    smtSource: document.querySelector("#smt-source"),
    stepCount: document.querySelector("#step-count"),
    traceList: document.querySelector("#trace-list"),
    traceRunLabel: document.querySelector("#trace-run-label"),
  };

  function sameSet(left, right) {
    if (left.size !== right.size) return false;
    for (const value of left) if (!right.has(value)) return false;
    return true;
  }

  function isDirty() {
    return (
      !sameSet(state.draft, state.activeDraft) ||
      MODEL.RULE_KEYS.some((key) => state.rules[key] !== state.activeRules[key])
    );
  }

  function recomputeActiveRun() {
    state.result = MODEL.solve(state.activeDraft, state.activeRules);
    state.source = MODEL.smtSource(state.activeDraft, state.activeRules);
    state.step = 0;
  }

  function renderBoard() {
    const witness = new Set(state.result.witness);
    for (const button of elements.board.querySelectorAll("[data-cell]")) {
      const cell = Number(button.dataset.cell);
      const [row, column] = MODEL.rc(cell);
      const regionIndex = DATA.regions[row][column];
      const isDraft = state.draft.has(cell);
      const isActiveDraft = state.activeDraft.has(cell);
      const isWitness = witness.has(cell);
      const isBaseline =
        state.baselineShown && DATA.baseline[row] === column;
      const isSelected = state.selected === cell;
      const showQueen = isDraft || isWitness || isBaseline;

      button.className = [
        "square",
        `region-${regionIndex}`,
        isBaseline ? "baseline" : "",
        isDraft ? "draft" : "",
        isWitness ? "witness" : "",
        isSelected ? "selected" : "",
      ].filter(Boolean).join(" ");
      button.tabIndex = isSelected ? 0 : -1;
      button.setAttribute("aria-pressed", String(isDraft));
      button.setAttribute(
        "aria-label",
        [
          `${DATA.columns[column]}${row + 1}`,
          DATA.regionNames[regionIndex],
          isBaseline ? "precomputed baseline queen" : "",
          isDraft ? "draft fixed queen" : "",
          isActiveDraft ? "active fixed queen" : "",
          isWitness ? "active run witness" : "",
        ].filter(Boolean).join(", "),
      );

      let queen = button.querySelector("[data-queen]");
      if (showQueen && !queen) {
        queen = document.createElement("span");
        queen.dataset.queen = "";
        queen.setAttribute("aria-hidden", "true");
        queen.textContent = "♛";
        button.insertBefore(queen, button.querySelector("small"));
      } else if (!showQueen && queen) {
        queen.remove();
      }
    }
  }

  function renderInspector() {
    const [row, column] = MODEL.rc(state.selected);
    const region = DATA.regionNames[DATA.regions[row][column]];
    elements.selectedCoordinate.textContent = `${DATA.columns[column]}${row + 1}`;
    elements.selectedRegion.textContent = `· ${region}`;
    elements.selectedDescription.textContent = state.draft.has(state.selected)
      ? "A draft fixed-queen assumption. Click again or press Space to remove it, then run the draft."
      : "No draft assumption here. A witness queen, if shown, belongs to the active run.";
  }

  function renderTrace() {
    const lastStep = Math.max(0, state.result.trace.length - 1);
    state.step = Math.min(state.step, lastStep);
    elements.traceList.replaceChildren();
    const visibleEvents = state.result.trace.slice(0, Math.max(1, state.step + 1));
    visibleEvents.forEach((event, index) => {
      const item = document.createElement("li");
      if (index === state.step) item.className = "current";
      item.textContent = event;
      elements.traceList.append(item);
    });
    elements.stepCount.textContent =
      `${Math.min(state.step + 1, state.result.trace.length)} / ${state.result.trace.length}`;
    elements.backButton.disabled = state.step === 0;
    elements.nextButton.disabled = state.step >= lastStep;
    elements.traceRunLabel.textContent =
      `Illustrative search · active run ${state.runId}`;
  }

  function renderRun() {
    const dirty = isDirty();
    const activeRuleCount = Object.values(state.activeRules).filter(Boolean).length;
    const exactOneFamilies = MODEL.PARTITION_KEYS.filter(
      (key) => state.activeRules[key],
    ).length;
    const status = state.result.status;
    const dirtyCopy = dirty ? " Draft changes are not active yet." : "";

    elements.resultStatus.className = `status ${status.toLowerCase()}`;
    elements.resultStatus.textContent = status;
    if (status === "SAT") {
      elements.resultCopy.textContent =
        `Run ${state.runId} has a witness.${dirtyCopy}`;
    } else if (status === "UNSAT") {
      elements.resultCopy.textContent =
        `Run ${state.runId} has no witness.${dirtyCopy}`;
    } else {
      elements.resultCopy.textContent =
        `Run ${state.runId} reached the teaching checker’s node bound; SAT/UNSAT is unresolved.${dirtyCopy}`;
    }

    elements.derivedEvidence.textContent =
      `Run ${state.runId}: ${activeRuleCount} active rule families · ` +
      `${state.activeDraft.size} active assumptions · ${state.result.explored} deterministic nodes.`;
    elements.runButton.disabled = !dirty;
    elements.runButton.textContent = dirty ? "Run draft" : "Draft active";
    elements.baselineButton.textContent =
      state.baselineShown ? "Baseline shown" : "Reveal baseline";
    elements.exactOneCount.textContent = String(exactOneFamilies * DATA.size);
    elements.adjacencyCount.textContent =
      state.activeRules.touching ? String(MODEL.ADJACENT_PAIRS.length) : "0";
    elements.selectionCounts.textContent =
      `${state.draft.size} / ${state.activeDraft.size} / ${state.result.witness.length}`;
    elements.smtSource.textContent = state.source;
    elements.smtSource.setAttribute(
      "aria-label",
      `SMT-LIB source for active run ${state.runId}`,
    );
    elements.copyButton.textContent = state.copied
      ? "Copied"
      : state.copyFailed
        ? "Copy failed"
        : "Copy";
  }

  function renderRules() {
    for (const input of document.querySelectorAll("[data-rule]")) {
      input.checked = state.rules[input.dataset.rule];
    }
  }

  function render() {
    renderBoard();
    renderInspector();
    renderRules();
    renderRun();
    renderTrace();
  }

  function toggleDraft(cell) {
    if (state.draft.has(cell)) state.draft.delete(cell);
    else state.draft.add(cell);
    state.copied = false;
    state.copyFailed = false;
    render();
  }

  function reset() {
    state.rules = { ...initialRules };
    state.activeRules = { ...initialRules };
    state.draft = new Set();
    state.activeDraft = new Set();
    state.baselineShown = false;
    state.selected = MODEL.id(0, 0);
    state.runId = 1;
    state.copied = false;
    state.copyFailed = false;
    recomputeActiveRun();
    render();
  }

  function runDraft() {
    if (!isDirty()) return;
    state.activeDraft = new Set(state.draft);
    state.activeRules = { ...state.rules };
    state.runId += 1;
    state.copied = false;
    state.copyFailed = false;
    recomputeActiveRun();
    render();
  }

  async function copySource() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(state.source);
      } else {
        const field = document.createElement("textarea");
        field.value = state.source;
        field.setAttribute("readonly", "");
        field.style.position = "fixed";
        field.style.opacity = "0";
        document.body.append(field);
        field.select();
        const copied = document.execCommand("copy");
        field.remove();
        if (!copied) throw new Error("Copy command was rejected");
      }
      state.copied = true;
      state.copyFailed = false;
    } catch {
      state.copied = false;
      state.copyFailed = true;
    }
    renderRun();
  }

  function downloadSource() {
    const link = document.createElement("a");
    const objectUrl = URL.createObjectURL(
      new Blob([state.source], { type: "text/plain;charset=utf-8" }),
    );
    link.href = objectUrl;
    link.download = "constraint-atlas.smt2";
    link.click();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
  }

  elements.board.addEventListener("focusin", (event) => {
    const button = event.target.closest("[data-cell]");
    if (!button) return;
    state.selected = Number(button.dataset.cell);
    renderBoard();
    renderInspector();
  });

  elements.board.addEventListener("click", (event) => {
    const button = event.target.closest("[data-cell]");
    if (!button) return;
    state.selected = Number(button.dataset.cell);
    toggleDraft(state.selected);
  });

  elements.board.addEventListener("keydown", (event) => {
    const button = event.target.closest("[data-cell]");
    if (!button || !event.key.startsWith("Arrow")) return;
    const [row, column] = MODEL.rc(Number(button.dataset.cell));
    const moves = {
      ArrowRight: [row, Math.min(DATA.size - 1, column + 1)],
      ArrowLeft: [row, Math.max(0, column - 1)],
      ArrowDown: [Math.min(DATA.size - 1, row + 1), column],
      ArrowUp: [Math.max(0, row - 1), column],
    };
    const next = moves[event.key];
    if (!next) return;
    event.preventDefault();
    const nextCell = MODEL.id(next[0], next[1]);
    state.selected = nextCell;
    elements.board.querySelector(`[data-cell="${nextCell}"]`).focus();
  });

  for (const input of document.querySelectorAll("[data-rule]")) {
    input.addEventListener("change", () => {
      state.rules[input.dataset.rule] = input.checked;
      state.copied = false;
      state.copyFailed = false;
      render();
    });
  }

  elements.resetButton.addEventListener("click", reset);
  elements.runButton.addEventListener("click", runDraft);
  elements.baselineButton.addEventListener("click", () => {
    state.baselineShown = true;
    render();
  });
  elements.backButton.addEventListener("click", () => {
    state.step = Math.max(0, state.step - 1);
    renderTrace();
  });
  elements.nextButton.addEventListener("click", () => {
    state.step = Math.min(state.result.trace.length - 1, state.step + 1);
    renderTrace();
  });
  elements.copyButton.addEventListener("click", copySource);
  elements.downloadButton.addEventListener("click", downloadSource);

  recomputeActiveRun();
  render();
})(globalThis);
