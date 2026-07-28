(function exposeConstraintAtlasModel(global) {
  "use strict";

  const DATA = global.CONSTRAINT_ATLAS_DATA;
  if (!DATA) throw new Error("CONSTRAINT_ATLAS_DATA must be defined before model.js");

  const SIZE = DATA.size;
  const RULE_KEYS = Object.freeze(["rows", "columns", "regions", "touching"]);
  const PARTITION_KEYS = Object.freeze(["rows", "columns", "regions"]);
  const MAX_NODES = 100000;

  const id = (row, column) => row * SIZE + column;
  const rc = (cell) => [Math.floor(cell / SIZE), cell % SIZE];

  function unitCells(kind, index) {
    if (kind === "rows") {
      return Array.from({ length: SIZE }, (_, column) => id(index, column));
    }
    if (kind === "columns") {
      return Array.from({ length: SIZE }, (_, row) => id(row, index));
    }
    return Array.from({ length: SIZE * SIZE }, (_, cell) => cell).filter((cell) => {
      const [row, column] = rc(cell);
      return DATA.regions[row][column] === index;
    });
  }

  function adjacentPairs() {
    const pairs = [];
    const forwardOffsets = [[0, 1], [1, -1], [1, 0], [1, 1]];
    for (let row = 0; row < SIZE; row += 1) {
      for (let column = 0; column < SIZE; column += 1) {
        for (const [rowDelta, columnDelta] of forwardOffsets) {
          const nextRow = row + rowDelta;
          const nextColumn = column + columnDelta;
          if (
            nextRow >= 0 &&
            nextRow < SIZE &&
            nextColumn >= 0 &&
            nextColumn < SIZE
          ) {
            pairs.push([id(row, column), id(nextRow, nextColumn)]);
          }
        }
      }
    }
    return pairs;
  }

  const ADJACENT_PAIRS = Object.freeze(
    adjacentPairs().map((pair) => Object.freeze(pair)),
  );

  function cellsConflict(cell, other, rules) {
    if (cell === other) return false;
    const [row, column] = rc(cell);
    const [otherRow, otherColumn] = rc(other);
    if (rules.rows && row === otherRow) return true;
    if (rules.columns && column === otherColumn) return true;
    if (
      rules.regions &&
      DATA.regions[row][column] === DATA.regions[otherRow][otherColumn]
    ) {
      return true;
    }
    return Boolean(
      rules.touching &&
      Math.max(
        Math.abs(row - otherRow),
        Math.abs(column - otherColumn),
      ) === 1
    );
  }

  function solve(draftInput, rulesInput, options = {}) {
    const selected = new Set(draftInput);
    const rules = Object.fromEntries(
      RULE_KEYS.map((key) => [key, Boolean(rulesInput[key])]),
    );
    const requestedLimit = Number(options.maxNodes);
    const maxNodes =
      Number.isSafeInteger(requestedLimit) && requestedLimit > 0
        ? requestedLimit
        : MAX_NODES;
    const trace = [
      "Start from the visible fixed assumptions; choose an unsatisfied partition deterministically.",
    ];
    let explored = 0;
    let limitReached = false;
    const activeUnits = PARTITION_KEYS.filter((kind) => rules[kind]);

    const conflicts = (cell, set) => {
      for (const other of set) {
        if (cellsConflict(cell, other, rules)) return true;
      }
      return false;
    };

    if ([...selected].some((cell) => conflicts(cell, selected))) {
      trace.push("A fixed assumption already conflicts with another fixed assumption.");
      return { status: "UNSAT", witness: [], explored, trace, limitReached };
    }

    const complete = (set) =>
      activeUnits.every((kind) =>
        Array.from({ length: SIZE }, (_, index) =>
          unitCells(kind, index).some((cell) => set.has(cell)),
        ).every(Boolean),
      );

    const search = () => {
      if (explored >= maxNodes) {
        limitReached = true;
        return false;
      }
      explored += 1;

      let target = null;
      for (const kind of activeUnits) {
        for (let index = 0; index < SIZE; index += 1) {
          const cells = unitCells(kind, index);
          if (
            !cells.some((cell) => selected.has(cell)) &&
            (!target || cells.length < target.length)
          ) {
            target = cells;
          }
        }
      }

      if (!target || complete(selected)) {
        trace.push("Every enabled partition is covered: witness complete.");
        return true;
      }

      for (const cell of target) {
        if (conflicts(cell, selected)) continue;
        const [row, column] = rc(cell);
        if (trace.length < 28) {
          trace.push(
            `Try ${DATA.columns[column]}${row + 1}; it satisfies the next open partition.`,
          );
        }
        selected.add(cell);
        if (search()) return true;
        selected.delete(cell);
        if (limitReached) return false;
        if (trace.length < 28) {
          trace.push(
            `Retract ${DATA.columns[column]}${row + 1}; that branch cannot complete.`,
          );
        }
      }
      return false;
    };

    const sat = search();
    if (limitReached) {
      trace.push(
        `The deterministic teaching checker stopped at its ${maxNodes.toLocaleString("en-US")}-node bound; no SAT/UNSAT claim is made.`,
      );
    } else if (!sat) {
      trace.push("All compatible branches closed: UNSAT for this draft and rule set.");
    }

    return {
      status: limitReached ? "LIMIT" : sat ? "SAT" : "UNSAT",
      witness: sat && !limitReached ? [...selected].sort((a, b) => a - b) : [],
      explored,
      trace,
      limitReached,
    };
  }

  function smtSource(draftInput, rulesInput) {
    const draft = new Set(draftInput);
    const rules = Object.fromEntries(
      RULE_KEYS.map((key) => [key, Boolean(rulesInput[key])]),
    );
    const lines = [
      "; Constraint Atlas — 7×7 Boolean-grid encoding",
      "; Baseline provenance: Z3 SAT; blocking this model is UNSAT (unique).",
      "(set-logic QF_FD)",
      "(set-option :produce-models true)",
    ];

    for (let row = 0; row < SIZE; row += 1) {
      for (let column = 0; column < SIZE; column += 1) {
        lines.push(`(declare-const q_${row}_${column} Bool)`);
      }
    }

    const symbol = (cell) => {
      const [row, column] = rc(cell);
      return `q_${row}_${column}`;
    };
    const atLeastOne = (cells) => `(or ${cells.map(symbol).join(" ")})`;
    const atMostOne = (cells) =>
      cells.flatMap((left, index) =>
        cells
          .slice(index + 1)
          .map(
            (right) =>
              `(assert (not (and ${symbol(left)} ${symbol(right)})))`,
          ),
      );

    for (const kind of PARTITION_KEYS.filter((key) => rules[key])) {
      for (let index = 0; index < SIZE; index += 1) {
        const cells = unitCells(kind, index);
        lines.push(`(assert ${atLeastOne(cells)})`, ...atMostOne(cells));
      }
    }

    if (rules.touching) {
      for (const [left, right] of ADJACENT_PAIRS) {
        lines.push(
          `(assert (not (and ${symbol(left)} ${symbol(right)})))`,
        );
      }
    }

    for (const cell of [...draft].sort((a, b) => a - b)) {
      lines.push(`(assert ${symbol(cell)})`);
    }
    lines.push("(check-sat)", "(get-model)");
    return lines.join("\n");
  }

  global.ConstraintAtlasModel = Object.freeze({
    ADJACENT_PAIRS,
    MAX_NODES,
    PARTITION_KEYS,
    RULE_KEYS,
    cellsConflict,
    id,
    rc,
    smtSource,
    solve,
    unitCells,
  });
})(globalThis);
