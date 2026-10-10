/**
 * Every form field must have a name a screen reader can announce.
 *
 * CLAUDE.md: "Accessibility is specced, not assumed: real labels, real hit
 * targets." An audit found most form fields on both platforms had a visible
 * label sitting beside them — a <p> on web, a <Text> on mobile — with nothing
 * tying the two together, so assistive tech announced "edit, blank".
 *
 * Why a local rule rather than eslint-plugin-jsx-a11y: its one rule for this,
 * control-has-associated-label, judges each element alone. It cannot see a
 * <label htmlFor="x"> next to an <input id="x">, so it flags correctly labelled
 * fields and misses bare <select>s. This rule reads the whole file first and
 * only then decides, which is what association requires.
 *
 * One rule, both platforms, so the two apps are held to the same standard:
 *
 *   web     <input> <select> <textarea> are named by any of:
 *             aria-label / aria-labelledby / title
 *             an id matched by a <label htmlFor> in the same file
 *             being nested inside a <label>
 *   mobile  <TextInput> is named by accessibilityLabel / aria-label /
 *           accessibilityLabelledBy / aria-labelledby
 *
 * A field with a {...spread} is skipped: its name may arrive in the spread,
 * and a rule that guesses produces noise people learn to ignore.
 *
 * CommonJS on purpose: the web config is ESM and the mobile config is CJS, and
 * both can load a CJS module.
 */
"use strict";

const WEB_FIELDS = new Set(["input", "select", "textarea"]);
const RN_FIELDS = new Set(["TextInput"]);

// these input types are not free-text fields that need a label of their own:
// hidden is invisible, submit/button/reset/image are named by value or alt, and
// a file input here is always driven by a labelled button that clicks it
const UNNAMED_INPUT_TYPES = new Set(["hidden", "submit", "button", "reset", "image", "file"]);

const WEB_NAMES = ["aria-label", "aria-labelledby", "title"];
const RN_NAMES = ["accessibilityLabel", "aria-label", "accessibilityLabelledBy", "aria-labelledby"];

function elementName(node) {
  const n = node.name;
  if (!n) return null;
  if (n.type === "JSXIdentifier") return n.name;
  // <Animated.TextInput>, <Foo.Bar> — the last segment is what matters
  if (n.type === "JSXMemberExpression") return n.property && n.property.name;
  return null;
}

function attr(node, name) {
  return node.attributes.find(
    (a) => a.type === "JSXAttribute" && a.name && a.name.name === name,
  );
}

function hasSpread(node) {
  return node.attributes.some((a) => a.type === "JSXSpreadAttribute");
}

// A label's htmlFor and an input's id are compared by key: the string for a
// literal, the source text for an expression. So htmlFor={fieldId} and
// id={fieldId} match each other, without the rule pretending to evaluate them.
function keyOf(attribute, sourceCode) {
  if (!attribute || !attribute.value) return null;
  const v = attribute.value;
  if (v.type === "Literal") return `lit:${v.value}`;
  if (v.type === "JSXExpressionContainer") {
    const e = v.expression;
    if (e.type === "Literal") return `lit:${e.value}`;
    if (e.type === "TemplateLiteral" && e.expressions.length === 0) {
      return `lit:${e.quasis[0].value.cooked}`;
    }
    return `expr:${sourceCode.getText(e)}`;
  }
  return null;
}

function literalType(node) {
  const t = attr(node, "type");
  if (!t || !t.value) return null;
  if (t.value.type === "Literal") return String(t.value.value);
  if (t.value.type === "JSXExpressionContainer" && t.value.expression.type === "Literal") {
    return String(t.value.expression.value);
  }
  return null; // dynamic type — treat as a text field
}

function insideLabel(node) {
  // node is a JSXOpeningElement; its parent is the JSXElement
  let p = node.parent && node.parent.parent;
  while (p) {
    if (p.type === "JSXElement" && elementName(p.openingElement) === "label") return true;
    p = p.parent;
  }
  return false;
}

const rule = {
  meta: {
    type: "problem",
    docs: {
      description: "Form fields must have an accessible name on web and mobile",
    },
    schema: [],
    messages: {
      web:
        "<{{tag}}> has no accessible name, so a screen reader announces it as a blank field. " +
        "Tie it to a <label htmlFor>, nest it in a <label>, or give it aria-label.",
      native:
        "<TextInput> has no accessibilityLabel, so a screen reader announces it as a blank field.",
    },
  },

  create(context) {
    const sourceCode = context.sourceCode || context.getSourceCode();
    const labelKeys = new Set();
    const pending = [];

    return {
      JSXOpeningElement(node) {
        const tag = elementName(node);
        if (!tag) return;

        if (tag === "label") {
          const k = keyOf(attr(node, "htmlFor"), sourceCode);
          if (k) labelKeys.add(k);
          return;
        }

        if (hasSpread(node)) return;

        if (WEB_FIELDS.has(tag)) {
          if (tag === "input" && UNNAMED_INPUT_TYPES.has(literalType(node))) return;
          if (WEB_NAMES.some((n) => attr(node, n))) return;
          if (insideLabel(node)) return;
          // the label may come later in the file, so decide at the end
          pending.push({ node, tag, key: keyOf(attr(node, "id"), sourceCode) });
          return;
        }

        if (RN_FIELDS.has(tag)) {
          if (RN_NAMES.some((n) => attr(node, n))) return;
          context.report({ node, messageId: "native" });
        }
      },

      "Program:exit"() {
        for (const { node, tag, key } of pending) {
          if (key && labelKeys.has(key)) continue;
          context.report({ node, messageId: "web", data: { tag } });
        }
      },
    };
  },
};

module.exports = {
  meta: { name: "chronically" },
  rules: { "control-has-name": rule },
};
