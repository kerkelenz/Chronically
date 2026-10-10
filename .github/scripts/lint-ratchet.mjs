#!/usr/bin/env node
/**
 * Lint as a ratchet rather than a cliff, for each package that has a backlog.
 *
 * Both clients carry lint errors that predate the gate — mostly fields with no
 * accessible name, found by eslint-rules/accessible-names.cjs. Making them all
 * blocking today would paint CI red on every push, which teaches everyone to
 * ignore CI — the opposite of the point. Making lint advisory teaches the same
 * lesson more slowly.
 *
 * So the committed baseline records today's counts per package and per rule,
 * and CI fails only when a count goes UP. New code cannot add a lint error; old
 * code can be paid down at its own pace. When counts drop, this prints the new
 * baseline to commit, so the ratchet tightens instead of drifting.
 *
 *   node .github/scripts/lint-ratchet.mjs client          # check one package
 *   node .github/scripts/lint-ratchet.mjs mobile
 *   node .github/scripts/lint-ratchet.mjs client --write  # record as baseline
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..");
const BASELINE = resolve(REPO, ".github", "lint-baseline.json");

// the same targets each package's own `npm run lint` uses
const PACKAGES = {
  client: { dir: "client", targets: ["src"] },
  mobile: { dir: "mobile", targets: ["app", "components", "lib", "theme", "context", "__tests__"] },
};

const args = process.argv.slice(2);
const WRITE = args.includes("--write");
const pkgName = args.find((a) => !a.startsWith("--")) || "client";
const pkg = PACKAGES[pkgName];
if (!pkg) {
  console.error(`unknown package "${pkgName}" — expected one of: ${Object.keys(PACKAGES).join(", ")}`);
  process.exit(2);
}

// ESLint exits non-zero whenever there is an error, so its status tells us
// nothing we do not already get from the JSON. Capture output, ignore status.
function runEslint() {
  try {
    return execFileSync("npx", ["eslint", ...pkg.targets, "--format", "json"], {
      cwd: resolve(REPO, pkg.dir), encoding: "utf8",
      shell: process.platform === "win32",
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (e) {
    if (e.stdout) return e.stdout;
    console.error("eslint could not be run at all:");
    console.error(e.message);
    process.exit(2);
  }
}

const raw = runEslint();
let results;
try {
  // npx can prepend noise; take the JSON array
  results = JSON.parse(raw.slice(raw.indexOf("[")));
} catch {
  console.error("could not parse eslint output as JSON:");
  console.error(raw.slice(0, 600));
  process.exit(2);
}

// A parse failure is not a lint finding to be ratcheted — it means a file
// could not be read at all, and every rule silently skipped it.
const fatal = results.flatMap((f) => f.messages.filter((m) => m.fatal)
  .map((m) => `${f.filePath}:${m.line}  ${m.message}`));
if (fatal.length) {
  console.error(`  ${pkgName}: ${fatal.length} file(s) could not be parsed:`);
  for (const f of fatal) console.error(`    ${f}`);
  process.exit(1);
}

const byRule = {};
let errors = 0;
let warnings = 0;
for (const file of results) {
  for (const m of file.messages) {
    const key = m.ruleId ?? "(no rule)";
    byRule[key] = byRule[key] || { error: 0, warning: 0 };
    if (m.severity === 2) { errors++; byRule[key].error++; }
    else { warnings++; byRule[key].warning++; }
  }
}
const current = {
  errors,
  warnings,
  byRule: Object.fromEntries(Object.entries(byRule).sort(([a], [b]) => a.localeCompare(b))),
};

// one file, keyed by package. An older single-package file is read as client.
function loadAll() {
  if (!existsSync(BASELINE)) return {};
  const data = JSON.parse(readFileSync(BASELINE, "utf8"));
  return typeof data.errors === "number" ? { client: data } : data;
}
const all = loadAll();
const fmt = (o) => JSON.stringify(o, null, 2) + "\n";

if (WRITE || !all[pkgName]) {
  all[pkgName] = current;
  const ordered = Object.fromEntries(Object.keys(PACKAGES).filter((k) => all[k]).map((k) => [k, all[k]]));
  writeFileSync(BASELINE, fmt(ordered));
  console.log(`  ${pkgName}: baseline written — ${errors} error(s), ${warnings} warning(s)`);
  process.exit(0);
}

const base = all[pkgName];
console.log(`  ${pkgName} lint: ${errors} error(s), ${warnings} warning(s)`);
console.log(`  baseline${" ".repeat(Math.max(0, pkgName.length - 3))}: ${base.errors} error(s), ${base.warnings} warning(s)\n`);

const grew = [];
if (current.errors > base.errors) {
  grew.push(`total errors ${base.errors} -> ${current.errors}`);
}
// per-rule as well, so swapping one error for another is still caught
for (const [rule, counts] of Object.entries(current.byRule)) {
  const was = base.byRule[rule]?.error ?? 0;
  if (counts.error > was) grew.push(`${rule}: ${was} -> ${counts.error} error(s)`);
}

if (grew.length) {
  console.error("  NEW LINT ERRORS — this is what the gate is for:\n");
  for (const g of grew) console.error(`    ${g}`);
  // only the rules that grew: printing the whole backlog would bury the one
  // the author just introduced
  const growing = new Set(
    Object.keys(current.byRule)
      .filter((r) => current.byRule[r].error > (base.byRule[r]?.error ?? 0)),
  );
  console.error(`\n  Every error for ${growing.size ? [...growing].join(", ") : "all rules"}:`);
  for (const file of results) {
    const errs = file.messages.filter(
      (m) => m.severity === 2 && (growing.size === 0 || growing.has(m.ruleId ?? "(no rule)")),
    );
    if (!errs.length) continue;
    const rel = file.filePath.replace(REPO, "").replace(/\\/g, "/").replace(/^\//, "");
    for (const m of errs) {
      console.error(`    ${rel}:${m.line}:${m.column}  ${m.ruleId}  ${m.message.split("\n")[0]}`);
    }
  }
  console.error("\n  Fix them, or if you genuinely meant to change the rules,");
  console.error(`  run: node .github/scripts/lint-ratchet.mjs ${pkgName} --write`);
  process.exit(1);
}

if (current.errors < base.errors) {
  console.log(`  errors went DOWN by ${base.errors - current.errors}. Tighten the ratchet:`);
  console.log(`    node .github/scripts/lint-ratchet.mjs ${pkgName} --write`);
} else {
  console.log("  no new lint errors.");
}
process.exit(0);
