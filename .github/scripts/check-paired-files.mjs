#!/usr/bin/env node
/**
 * The paired-file invariant from CLAUDE.md, enforced instead of remembered.
 *
 * Eight helpers exist twice, once per platform, and must be byte-identical. A
 * ninth pair is partial: METRIC_LABELS inside mobile/theme/metrics.js has to
 * match client/src/utils/metricLabels.js, while the rest of those files differ.
 *
 * Drift here is silent and nasty — the two apps quietly disagree about what a
 * pain level is called, or how a schedule reads — and nothing else catches it.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (p) => readFileSync(resolve(REPO, p));
const text = (p) => read(p).toString("utf8");

const PAIRS = [
  ["mobile/theme/medications.js", "client/src/utils/medicationHelpers.js"],
  ["mobile/theme/symptomCatalog.js", "client/src/utils/symptomCatalog.js"],
  ["mobile/theme/weatherFormat.js", "client/src/utils/weatherFormat.js"],
  ["mobile/theme/supportResources.js", "client/src/utils/supportResources.js"],
  ["mobile/theme/doctorHelpers.js", "client/src/utils/doctorHelpers.js"],
  ["mobile/theme/flareHelpers.js", "client/src/utils/flareHelpers.js"],
  ["mobile/theme/reportOptions.js", "client/src/utils/reportOptions.js"],
  ["mobile/theme/trendHelpers.js", "client/src/utils/trendHelpers.js"],
];

let failures = 0;
const ok = (label, pass, detail) => {
  if (!pass) failures++;
  console.log(`  ${pass ? "ok  " : "FAIL"}  ${label}${detail ? `\n          ${detail}` : ""}`);
};

console.log("  byte-identical pairs:");
for (const [a, b] of PAIRS) {
  let same, detail;
  try {
    const bufA = read(a);
    const bufB = read(b);
    same = bufA.equals(bufB);
    if (!same) {
      // name the first differing line, which is almost always enough to see why
      const la = bufA.toString("utf8").split("\n");
      const lb = bufB.toString("utf8").split("\n");
      // scan the longer side, or a file that is merely longer reports as "same"
      const n = Math.max(la.length, lb.length);
      let i = -1;
      for (let k = 0; k < n; k++) if (la[k] !== lb[k]) { i = k; break; }
      detail = i === -1
        ? `same lines, different bytes (line endings): ${bufA.length} vs ${bufB.length} bytes`
        : `${la.length} vs ${lb.length} lines; first difference at line ${i + 1}:`
          + `\n          ${a}: ${JSON.stringify((la[i] ?? "(end of file)").slice(0, 90))}`
          + `\n          ${b}: ${JSON.stringify((lb[i] ?? "(end of file)").slice(0, 90))}`;
    }
  } catch (e) {
    same = false;
    detail = e.message;
  }
  ok(`${a.split("/").pop()}`, same, detail);
}

// METRIC_LABELS: compare the table itself, not the files around it. Anchor on
// the assignment, because both files also mention the name in prose.
console.log("\n  partial pair:");
const table = (p) => {
  const s = text(p);
  const start = s.indexOf("METRIC_LABELS = {");
  if (start === -1) throw new Error(`no "METRIC_LABELS = {" in ${p}`);
  const end = s.indexOf("};", start);
  if (end === -1) throw new Error(`unterminated METRIC_LABELS in ${p}`);
  // whitespace-insensitive: the two files indent it differently
  return s.slice(start, end + 2).replace(/\s+/g, " ").trim();
};
try {
  const m = table("mobile/theme/metrics.js");
  const c = table("client/src/utils/metricLabels.js");
  ok("METRIC_LABELS matches across platforms", m === c,
    m === c ? undefined : `mobile: ${m.slice(0, 120)}\n          client: ${c.slice(0, 120)}`);
} catch (e) {
  ok("METRIC_LABELS matches across platforms", false, e.message);
}

console.log(failures === 0
  ? "\n  every paired file is in sync"
  : `\n  ${failures} pair(s) have drifted — fix the copy, do not fork it`);
process.exit(failures === 0 ? 0 : 1);
