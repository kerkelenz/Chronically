// https://docs.expo.dev/guides/using-eslint/
//
// Expo's own config for SDK 54: React, hooks rules, and the import checks that
// catch an unused variable or a stale import — the class of slip that let a
// dead `today` parameter and an unused `Stack` import sit unnoticed in mobile
// code with nothing linting it.
//
// Accessible names on TextInputs come from chronically/control-has-name, the
// same local rule the web client runs, so both apps are held to one standard.
// There is no maintained React Native a11y plugin worth adopting.
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");
const chronically = require("../eslint-rules/accessible-names.cjs");

module.exports = defineConfig([
  expoConfig,
  {
    plugins: { chronically },
    rules: {
      // every form field needs a name a screen reader can announce
      "chronically/control-has-name": "error",
      // An error, as it is on the web client. Expo ships it as a warning, and
      // the CI ratchet gates errors — so as a warning it would let through the
      // exact slip this config was added to catch.
      "no-unused-vars": "error",
      // Apostrophes and quotes in copy ("Couldn't save", "we'll remind you")
      // render correctly in <Text>; escaping them would make every string
      // unreadable. A stray > or } is still caught, since those are the
      // characters that usually mean a mistyped tag or expression.
      "react/no-unescaped-entities": ["error", { forbid: [">", "}"] }],
    },
  },
  {
    // tests run under Jest, which provides these as globals
    files: ["__tests__/**"],
    languageOptions: {
      globals: {
        describe: "readonly", it: "readonly", test: "readonly", expect: "readonly",
        jest: "readonly", beforeEach: "readonly", afterEach: "readonly",
        beforeAll: "readonly", afterAll: "readonly",
      },
    },
  },
  {
    ignores: [
      "dist/*",
      ".expo/*",
      "android/*",
      "ios/*",
      "node_modules/*",
    ],
  },
]);
