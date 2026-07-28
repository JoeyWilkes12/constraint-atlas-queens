import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

async function loadWorker() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${Math.random()}`);
  return (await import(workerUrl.href)).default;
}

async function loadModel() {
  const [dataSource, modelSource] = await Promise.all([
    readFile(new URL("../static/model-data.json", import.meta.url), "utf8"),
    readFile(new URL("../static/model.js", import.meta.url), "utf8"),
  ]);
  const data = JSON.parse(dataSource);
  const sandbox = { CONSTRAINT_ATLAS_DATA: data };
  vm.runInNewContext(modelSource, sandbox, { filename: "static/model.js" });
  return { data, model: sandbox.ConstraintAtlasModel };
}

test("the emitted Worker server-renders the complete Constraint Atlas", async () => {
  const worker = await loadWorker();
  const response = await worker.fetch(
    new Request("https://quant.example/", {
      headers: { accept: "text/html" },
    }),
    {},
  );
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(
    html,
    /<title>Constraint Atlas — Queens is the smallest useful model<\/title>/i,
  );
  assert.match(html, /<meta property="og:image" content="https:\/\/quant\.example\/og\.png">/);
  assert.match(html, /<meta name="twitter:image" content="https:\/\/quant\.example\/og\.png">/);
  assert.equal((html.match(/data-cell="\d+"/g) ?? []).length, 49);
  assert.match(html, /role="grid"/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /Verified 7×7 baseline/);
  assert.match(html, /Draft changes are not active yet/);
  assert.match(html, /Run draft/);
  assert.match(html, /Export \.smt2/);
  assert.match(html, /Same semantics, different leverage/);
  assert.match(html, /Translate the structure, not the chessboard/);
  assert.match(html, /How Z3 fits/);
  assert.match(html, /Claims with a trail/);
  assert.match(html, /not Z3’s internal trace/);
  assert.match(html, /--navy:#0c2335/);
  assert.match(html, /ConstraintAtlasModel/);
  assert.doesNotMatch(html, /<link[^>]+rel=["']stylesheet/i);
  assert.doesNotMatch(html, /<script[^>]+src=/i);
  assert.doesNotMatch(html, /%%[A-Z_]+%%/);
  assert.doesNotMatch(
    html,
    /Your site is taking shape|Building your site|codex-preview/i,
  );
});

test("the Worker delegates the social image to ASSETS", async () => {
  const worker = await loadWorker();
  let delegatedUrl = "";
  const response = await worker.fetch(
    new Request("https://quant.example/og.png"),
    {
      ASSETS: {
        async fetch(request) {
          delegatedUrl = request.url;
          return new Response(new Uint8Array([137, 80, 78, 71]), {
            headers: { "content-type": "image/png" },
          });
        },
      },
    },
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "image/png");
  assert.equal(delegatedUrl, "https://quant.example/og.png");

  const missing = await worker.fetch(
    new Request("https://quant.example/og.png"),
    {},
  );
  assert.equal(missing.status, 404);
});

test("the GitHub Pages build is complete and uses the project-site URL", async () => {
  const html = await readFile(
    new URL("../dist/pages/index.html", import.meta.url),
    "utf8",
  );
  assert.match(
    html,
    /<meta property="og:image" content="https:\/\/joeywilkes12\.github\.io\/constraint-atlas-queens\/og\.png">/,
  );
  assert.match(
    html,
    /<meta name="twitter:image" content="https:\/\/joeywilkes12\.github\.io\/constraint-atlas-queens\/og\.png">/,
  );
  assert.equal((html.match(/data-cell="\d+"/g) ?? []).length, 49);
  assert.match(html, /ConstraintAtlasModel/);
  assert.doesNotMatch(html, /%%[A-Z_]+%%/);
});

test("the verified model and independent no-touch semantics remain intact", async () => {
  const { data, model } = await loadModel();
  assert.equal(data.size, 7);
  assert.equal(data.regions.length, 7);
  assert.ok(data.regions.every((row) => row.length === 7));
  assert.equal(new Set(data.regions.flat()).size, 7);
  assert.equal(data.baseline.join(","), "3,6,1,5,2,0,4");
  assert.equal(model.ADJACENT_PAIRS.length, 156);

  const allRules = Object.fromEntries(model.RULE_KEYS.map((key) => [key, true]));
  const result = model.solve([], allRules);
  const expectedWitness = data.baseline
    .map((column, row) => model.id(row, column))
    .sort((left, right) => left - right);
  assert.equal(result.status, "SAT");
  assert.equal(result.witness.join(","), expectedWitness.join(","));
  assert.ok(result.explored <= model.MAX_NODES);

  const touchingOnly = {
    rows: false,
    columns: false,
    regions: false,
    touching: true,
  };
  assert.equal(
    model.solve([model.id(0, 0), model.id(0, 1)], touchingOnly).status,
    "UNSAT",
    "horizontal neighbors conflict even without row constraints",
  );
  assert.equal(
    model.solve([model.id(0, 0), model.id(1, 0)], touchingOnly).status,
    "UNSAT",
    "vertical neighbors conflict even without column constraints",
  );
  assert.equal(
    model.solve([model.id(0, 0), model.id(1, 1)], touchingOnly).status,
    "UNSAT",
    "diagonal neighbors conflict",
  );
  assert.equal(
    model.solve([model.id(0, 0), model.id(0, 2)], touchingOnly).status,
    "SAT",
    "nonadjacent cells are not rejected by no-touch alone",
  );

  const touchingSource = model.smtSource([], touchingOnly);
  assert.equal(
    (touchingSource.match(/\(assert \(not \(and q_/g) ?? []).length,
    156,
  );
  assert.match(touchingSource, /\(and q_0_0 q_0_1\)/);
  assert.match(touchingSource, /\(and q_0_0 q_1_0\)/);
  assert.match(touchingSource, /\(and q_0_0 q_1_1\)/);

  const bounded = model.solve([], allRules, { maxNodes: 1 });
  assert.equal(bounded.status, "LIMIT");
  assert.equal(bounded.limitReached, true);
  assert.equal(bounded.explored, 1);
  assert.match(bounded.trace.at(-1), /no SAT\/UNSAT claim is made/i);
});

test("static sources, output asset, and zero-dependency scripts are coherent", async () => {
  const [
    template,
    app,
    model,
    build,
    page,
    layout,
    readme,
    packageSource,
    packageLockSource,
    publicOg,
    builtOg,
    pagesOg,
    noJekyll,
  ] = await Promise.all([
    readFile(new URL("../static/index.template.html", import.meta.url), "utf8"),
    readFile(new URL("../static/app.js", import.meta.url), "utf8"),
    readFile(new URL("../static/model.js", import.meta.url), "utf8"),
    readFile(new URL("../scripts/build-static.mjs", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../README.md", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../package-lock.json", import.meta.url), "utf8"),
    readFile(new URL("../public/og.png", import.meta.url)),
    readFile(new URL("../dist/client/og.png", import.meta.url)),
    readFile(new URL("../dist/pages/og.png", import.meta.url)),
    readFile(new URL("../dist/pages/.nojekyll", import.meta.url), "utf8"),
  ]);

  const packageJson = JSON.parse(packageSource);
  const packageLock = JSON.parse(packageLockSource);
  assert.equal(packageJson.scripts.build, "node scripts/build-static.mjs");
  assert.equal(
    packageJson.scripts["build:pages"],
    "node scripts/build-static.mjs --pages",
  );
  assert.equal(
    packageJson.scripts.test,
    "npm run build && npm run build:pages && node --test tests/rendered-html.test.mjs",
  );
  assert.equal(packageJson.dependencies, undefined);
  assert.equal(packageJson.devDependencies, undefined);
  assert.deepEqual(Object.keys(packageLock.packages), [""]);
  assert.equal(packageLock.packages[""].dependencies, undefined);
  assert.equal(packageLock.packages[""].devDependencies, undefined);
  assert.deepEqual(
    [...build.matchAll(/from "([^"]+)"/g)].map((match) => match[1]).sort(),
    ["node:fs/promises", "node:path", "node:url", "node:vm"],
  );
  assert.match(template, /id="run-button"/);
  assert.match(template, /id="copy-button"/);
  assert.match(template, /id="download-button"/);
  assert.match(app, /state\.activeDraft = new Set\(state\.draft\)/);
  assert.match(app, /ArrowRight/);
  assert.match(model, /Math\.max\(/);
  assert.match(model, /=== 1/);
  assert.match(page, /not Z3’s internal trace/);
  assert.match(layout, /Constraint Atlas/);
  assert.match(readme, /not a vinext build/i);
  assert.match(readme, /without an installed `node_modules`\s+directory/i);
  assert.deepEqual(builtOg, publicOg);
  assert.deepEqual(pagesOg, publicOg);
  assert.equal(noJekyll, "");
});
