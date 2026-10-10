/**
 * Tests for chronically/control-has-name, run under every ESLint this repo
 * ships: the web client is on ESLint 10 and mobile is on 9, and both load this
 * same rule. Passing under one proves nothing about the other.
 *
 *   node eslint-rules/accessible-names.test.cjs
 */
"use strict";

const path = require("path");
const plugin = require("./accessible-names.cjs");

const ROOT = path.resolve(__dirname, "..");
const INSTALLS = [
  { label: "web (client)", dir: path.join(ROOT, "client") },
  { label: "mobile", dir: path.join(ROOT, "mobile") },
];

const jsx = { ecmaVersion: 2022, sourceType: "module", parserOptions: { ecmaFeatures: { jsx: true } } };
const RULE = "control-has-name";

const valid = [
  // ── web: the ways a field legitimately gets its name ──
  { name: "label htmlFor before the input", code: `<div><label htmlFor="n">How many</label><input id="n" type="number" /></div>` },
  { name: "label htmlFor AFTER the input (decided at end of file)", code: `<div><input id="n" /><label htmlFor="n">How many</label></div>` },
  { name: "input nested in a label", code: `<label>Name <input type="text" /></label>` },
  { name: "deeply nested in a label", code: `<label><span><input /></span></label>` },
  { name: "aria-label", code: `<input aria-label="Name" />` },
  { name: "aria-labelledby", code: `<input aria-labelledby="h" />` },
  { name: "title", code: `<input title="Name" />` },
  { name: "matching expression ids", code: `<div><label htmlFor={fieldId}>X</label><input id={fieldId} /></div>` },
  { name: "matching template-literal ids", code: "<div><label htmlFor={`a`}>X</label><input id=\"a\" /></div>" },
  { name: "select with aria-label", code: `<select aria-label="Pick"><option>a</option></select>` },
  { name: "textarea with label", code: `<div><label htmlFor="t">Note</label><textarea id="t" /></div>` },
  { name: "hidden input", code: `<input type="hidden" />` },
  { name: "submit input", code: `<input type="submit" />` },
  { name: "file input (driven by a labelled button)", code: `<input type="file" />` },
  { name: "spread props: may carry the name", code: `<input {...props} />` },
  { name: "not a field at all", code: `<div><p>Label</p><span /></div>` },
  // ── mobile ──
  { name: "TextInput accessibilityLabel", code: `<TextInput accessibilityLabel="Name" />` },
  { name: "TextInput aria-label", code: `<TextInput aria-label="Name" />` },
  { name: "TextInput accessibilityLabelledBy", code: `<TextInput accessibilityLabelledBy="h" />` },
  { name: "TextInput spread", code: `<TextInput {...p} />` },
];

const invalid = [
  // the exact pattern the audit found 47 times on web
  { name: "a <p> beside the input names nothing", code: `<div><p className="label">How many on hand</p><input type="number" /></div>`, errors: [{ messageId: "web", data: { tag: "input" } }] },
  { name: "bare select", code: `<select><option>a</option></select>`, errors: [{ messageId: "web", data: { tag: "select" } }] },
  { name: "bare textarea", code: `<textarea />`, errors: [{ messageId: "web", data: { tag: "textarea" } }] },
  { name: "htmlFor and id do not match", code: `<div><label htmlFor="a">X</label><input id="b" /></div>`, errors: [{ messageId: "web" }] },
  { name: "different expressions do not match", code: `<div><label htmlFor={x}>X</label><input id={y} /></div>`, errors: [{ messageId: "web" }] },
  { name: "dynamic type is still a text field", code: `<input type={kind} />`, errors: [{ messageId: "web" }] },
  { name: "a label elsewhere does not name a field with no id", code: `<div><label htmlFor="a">X</label><input /></div>`, errors: [{ messageId: "web" }] },
  { name: "two unnamed fields, two reports", code: `<div><input /><input /></div>`, errors: [{ messageId: "web" }, { messageId: "web" }] },
  // the pattern the audit found 32 times on mobile
  { name: "TextInput with only a placeholder", code: `<TextInput placeholder="Name" />`, errors: [{ messageId: "native" }] },
  { name: "Animated.TextInput", code: `<Animated.TextInput />`, errors: [{ messageId: "native" }] },
];

let failed = 0;
let tested = 0;
for (const { label, dir } of INSTALLS) {
  let eslint;
  try {
    eslint = require(require.resolve("eslint", { paths: [dir] }));
  } catch {
    console.log(`  skip    ${label}: eslint not installed there`);
    continue;
  }
  const version = require(require.resolve("eslint/package.json", { paths: [dir] })).version;

  // RuleTester throws on the first failure; describe/it make it report each
  // case by name instead of stopping silently
  let pass = 0;
  const tester = eslint.RuleTester;
  tester.describe = (_, fn) => fn();
  tester.it = (name, fn) => {
    try {
      fn();
      pass++;
    } catch (e) {
      failed++;
      console.log(`  FAIL    [${label}] ${name}\n          ${String(e.message).split("\n")[0]}`);
    }
  };
  tester.itOnly = tester.it;

  new tester({ languageOptions: jsx }).run(RULE, plugin.rules[RULE], { valid, invalid });
  tested++;
  console.log(`  ok      ${label} on ESLint ${version}: ${pass}/${valid.length + invalid.length} cases`);
}

if (failed) {
  console.log(`\n  ${failed} case(s) failed`);
  process.exit(1);
}
// each CI job installs one package, so one install is normal — none is not:
// a test that ran zero cases must not report success
if (tested === 0) {
  console.log("\n  no ESLint install found anywhere — nothing was tested");
  process.exit(1);
}
console.log(`\n  passed on ${tested} of ${INSTALLS.length} ESLint install(s) present`);
