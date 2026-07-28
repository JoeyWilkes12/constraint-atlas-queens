import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const sourcePath = (...parts) => path.join(projectRoot, ...parts);

const [
  template,
  css,
  dataSource,
  modelSource,
  appSource,
] = await Promise.all([
  readFile(sourcePath("static", "index.template.html"), "utf8"),
  readFile(sourcePath("app", "globals.css"), "utf8"),
  readFile(sourcePath("static", "model-data.json"), "utf8"),
  readFile(sourcePath("static", "model.js"), "utf8"),
  readFile(sourcePath("static", "app.js"), "utf8"),
]);

const data = JSON.parse(dataSource);
validateData(data);

const sandbox = { CONSTRAINT_ATLAS_DATA: data };
vm.runInNewContext(modelSource, sandbox, {
  filename: sourcePath("static", "model.js"),
});
const model = sandbox.ConstraintAtlasModel;
if (!model) throw new Error("static/model.js did not expose ConstraintAtlasModel");
if (model.ADJACENT_PAIRS.length !== 156) {
  throw new Error(
    `Expected 156 undirected adjacent pairs, found ${model.ADJACENT_PAIRS.length}`,
  );
}

const initialRules = Object.fromEntries(
  model.RULE_KEYS.map((key) => [key, true]),
);
const initialResult = model.solve([], initialRules);
const initialSource = model.smtSource([], initialRules);
const expectedWitness = data.baseline
  .map((column, row) => model.id(row, column))
  .sort((left, right) => left - right);
if (
  initialResult.status !== "SAT" ||
  initialResult.witness.join(",") !== expectedWitness.join(",")
) {
  throw new Error(
    "The deterministic initial witness no longer matches the verified 7×7 baseline",
  );
}

const replacements = {
  "%%INLINE_CSS%%": escapeInlineStyle(css),
  "%%MODEL_DATA%%": escapeInlineScript(JSON.stringify(data)),
  "%%MODEL_JS%%": escapeInlineScript(modelSource),
  "%%APP_JS%%": escapeInlineScript(appSource),
  "%%COLUMN_AXES%%": data.columns
    .map(
      (column) =>
        `<div class="axis col-axis" aria-hidden="true">${escapeHtml(column)}</div>`,
    )
    .join("\n"),
  "%%ROW_AXES%%": Array.from(
    { length: data.size },
    (_, row) =>
      `<div class="axis row-axis" aria-hidden="true">${row + 1}</div>`,
  ).join("\n"),
  "%%BOARD_CELLS%%": renderBoardCells(data, model, initialResult.witness),
  "%%RULE_CONTROLS%%": renderRuleControls(data),
  "%%INITIAL_EXPLORED%%": String(initialResult.explored),
  "%%INITIAL_WITNESS_COUNT%%": String(initialResult.witness.length),
  "%%INITIAL_TRACE%%": escapeHtml(initialResult.trace[0]),
  "%%INITIAL_TRACE_COUNT%%": String(initialResult.trace.length),
  "%%INITIAL_SMT%%": escapeHtml(initialSource),
};

let html = template;
for (const [token, value] of Object.entries(replacements)) {
  if (!html.includes(token)) throw new Error(`Missing template token ${token}`);
  html = html.replaceAll(token, value);
}
const unresolvedTokens = html.match(/%%[A-Z_]+%%/g) ?? [];
if (
  unresolvedTokens.some(
    (token) => token !== "%%OG_IMAGE_URL%%",
  )
) {
  throw new Error(`Unresolved template tokens: ${unresolvedTokens.join(", ")}`);
}

const workerSource = createWorkerSource(html);
const serverOutput = sourcePath("dist", "server", "index.js");
const clientOutput = sourcePath("dist", "client", "og.png");
await Promise.all([
  mkdir(path.dirname(serverOutput), { recursive: true }),
  mkdir(path.dirname(clientOutput), { recursive: true }),
]);
await Promise.all([
  writeFile(serverOutput, workerSource, "utf8"),
  copyFile(sourcePath("public", "og.png"), clientOutput),
]);

function validateData(value) {
  if (value.size !== 7) throw new Error("Constraint Atlas production board must be 7×7");
  if (
    !Array.isArray(value.columns) ||
    value.columns.length !== value.size ||
    !Array.isArray(value.baseline) ||
    value.baseline.length !== value.size ||
    !Array.isArray(value.regionNames) ||
    value.regionNames.length !== value.size ||
    !Array.isArray(value.regions) ||
    value.regions.length !== value.size
  ) {
    throw new Error("Malformed 7×7 model data");
  }
  const regionIds = new Set();
  for (const row of value.regions) {
    if (!Array.isArray(row) || row.length !== value.size) {
      throw new Error("Every region row must contain seven cells");
    }
    for (const region of row) {
      if (!Number.isInteger(region) || region < 0 || region >= value.size) {
        throw new Error(`Invalid region id: ${region}`);
      }
      regionIds.add(region);
    }
  }
  if (regionIds.size !== value.size) {
    throw new Error("Every named region must occur on the board");
  }
  for (const column of value.baseline) {
    if (!Number.isInteger(column) || column < 0 || column >= value.size) {
      throw new Error(`Invalid baseline column: ${column}`);
    }
  }
  const requiredRules = ["rows", "columns", "regions", "touching"];
  if (requiredRules.some((key) => !value.rules?.[key])) {
    throw new Error("All four independent rule families require display copy");
  }
}

function renderBoardCells(value, modelApi, witnessInput) {
  const witness = new Set(witnessInput);
  return Array.from({ length: value.size * value.size }, (_, cell) => {
    const [row, column] = modelApi.rc(cell);
    const regionIndex = value.regions[row][column];
    const isWitness = witness.has(cell);
    const isSelected = cell === 0;
    const classes = [
      "square",
      `region-${regionIndex}`,
      isWitness ? "witness" : "",
      isSelected ? "selected" : "",
    ].filter(Boolean).join(" ");
    const label = [
      `${value.columns[column]}${row + 1}`,
      value.regionNames[regionIndex],
      isWitness ? "active run witness" : "",
    ].filter(Boolean).join(", ");
    const queen = isWitness
      ? '<span data-queen aria-hidden="true">♛</span>'
      : "";
    return (
      `<button type="button" data-cell="${cell}" tabindex="${isSelected ? 0 : -1}" ` +
      `role="gridcell" aria-label="${escapeAttribute(label)}" aria-pressed="false" ` +
      `class="${classes}">${queen}<small>${escapeHtml(value.regionNames[regionIndex][0])}</small></button>`
    );
  }).join("\n");
}

function renderRuleControls(value) {
  return Object.entries(value.rules).map(([key, rule]) => (
    `<label class="rule-switch" for="rule-${escapeAttribute(key)}">` +
      `<input id="rule-${escapeAttribute(key)}" data-rule="${escapeAttribute(key)}" type="checkbox" checked>` +
      `<span><b>${escapeHtml(rule.title)}</b><small>${escapeHtml(rule.text)}</small></span>` +
      `<code>${escapeHtml(rule.formula)}</code>` +
    "</label>"
  )).join("\n");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeAttribute(value) {
  return escapeHtml(value)
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeInlineScript(value) {
  return String(value)
    .replace(/<\/script/gi, "<\\/script")
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029");
}

function escapeInlineStyle(value) {
  return String(value).replace(/<\/style/gi, "<\\/style");
}

function createWorkerSource(pageHtml) {
  const serializedPage = JSON.stringify(pageHtml)
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029");
  return `const PAGE_HTML = ${serializedPage};
const OG_IMAGE_TOKEN = "%%OG_IMAGE_URL%%";

function escapeAttribute(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderPage(origin) {
  const imageUrl = escapeAttribute(new URL("/og.png", origin).toString());
  return PAGE_HTML.replaceAll(OG_IMAGE_TOKEN, imageUrl);
}

const worker = {
  async fetch(request, env = {}) {
    const url = new URL(request.url);

    if (url.pathname === "/og.png") {
      if (env?.ASSETS && typeof env.ASSETS.fetch === "function") {
        return env.ASSETS.fetch(request);
      }
      return new Response("Not found", {
        status: 404,
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }

    if (url.pathname !== "/" && url.pathname !== "/index.html") {
      return new Response("Not found", {
        status: 404,
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method not allowed", {
        status: 405,
        headers: {
          allow: "GET, HEAD",
          "content-type": "text/plain; charset=utf-8",
        },
      });
    }

    const body = request.method === "HEAD" ? null : renderPage(url.origin);
    return new Response(body, {
      status: 200,
      headers: {
        "cache-control": "public, max-age=0, must-revalidate",
        "content-type": "text/html; charset=utf-8",
        "referrer-policy": "strict-origin-when-cross-origin",
        "x-content-type-options": "nosniff",
      },
    });
  },
};

export default worker;
`;
}
