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

// Controls whose name comes from their content. When the content is nothing
// but an icon, there is no name: a screen reader says "button" and stops.
const WEB_BUTTONS = new Set(["button"]);
const RN_TOUCHABLES = new Set(["TouchableOpacity", "TouchableHighlight", "TouchableWithoutFeedback", "Pressable"]);
// react-icons (FiX, BsPin, GiSpoon…), Expo's vector icon sets, and anything
// named *Icon. An <svg> is an icon too.
const ICON_NAME = /^((Fi|Bs|Gi|Io|Md|Ai|Hi|Ri|Tb)[A-Z]\w*|Ionicons|MaterialCommunityIcons|MaterialIcons|Feather|FontAwesome\d?|AntDesign|Entypo|\w*Icon|svg)$/;

// Could this child only ever render an icon, or nothing? Follows conditionals,
// so {open ? <FiX /> : <FiMenu />} counts as icon-only — the shape an earlier
// audit missed. Anything else (text, a variable, a call) might be a name.
function iconOnly(n) {
  if (!n) return true;
  switch (n.type) {
    case "JSXText": return n.value.trim() === "";
    case "JSXElement": {
      const tag = elementName(n.openingElement);
      return !!tag && ICON_NAME.test(tag);
    }
    case "JSXExpressionContainer": return iconOnly(n.expression);
    case "JSXEmptyExpression": return true;
    case "ConditionalExpression": return iconOnly(n.consequent) && iconOnly(n.alternate);
    case "LogicalExpression": return iconOnly(n.right);
    case "Literal": return n.value === null || n.value === false || n.value === "";
    case "JSXFragment": return n.children.every(iconOnly);
    default: return false;
  }
}
function hasOnlyIcons(element) {
  const kids = element.children.filter((c) => !(c.type === "JSXText" && c.value.trim() === ""));
  return kids.length > 0 && kids.every(iconOnly);
}

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

// An element removed from the accessibility tree is never announced, so it
// needs no name — and giving one to, say, a spam honeypot would expose a field
// that is meant to be invisible to everyone. Only a literal true counts:
// aria-hidden="false" or a dynamic value leaves the field visible.
function isTrue(attribute) {
  if (!attribute) return false;
  const v = attribute.value;
  if (v === null) return true; // bare attribute: <input aria-hidden />
  if (v.type === "Literal") return v.value === true || v.value === "true";
  if (v.type === "JSXExpressionContainer" && v.expression.type === "Literal") {
    return v.expression.value === true || v.expression.value === "true";
  }
  return false;
}
function hiddenFromAT(node) {
  if (isTrue(attr(node, "aria-hidden"))) return true;
  if (isTrue(attr(node, "accessibilityElementsHidden"))) return true;
  const ifa = attr(node, "importantForAccessibility");
  return !!(ifa && ifa.value && ifa.value.type === "Literal"
    && /^no(-hide-descendants)?$/.test(ifa.value.value));
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
      webButton:
        "This <button> contains only an icon, so a screen reader announces it as just \"button\". Give it aria-label.",
      nativeButton:
        "This <{{tag}}> contains only an icon, so a screen reader announces it as just \"button\". Give it accessibilityLabel.",
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
        if (hiddenFromAT(node)) return;

        if (WEB_BUTTONS.has(tag)) {
          if (WEB_NAMES.some((n) => attr(node, n))) return;
          if (hasOnlyIcons(node.parent)) context.report({ node, messageId: "webButton" });
          return;
        }

        if (RN_TOUCHABLES.has(tag)) {
          if (RN_NAMES.some((n) => attr(node, n))) return;
          // a touchable with no handler is a layout wrapper, not a control
          if (!attr(node, "onPress") && !attr(node, "onLongPress")) return;
          if (hasOnlyIcons(node.parent)) context.report({ node, messageId: "nativeButton", data: { tag } });
          return;
        }

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
