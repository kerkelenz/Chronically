import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import chronically from '../eslint-rules/accessible-names.cjs'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
      // Catches images without alt text, click handlers on non-interactive
      // elements, and anchors that are not keyboard-reachable.
      //
      // It does NOT catch an <input> whose label is a sibling <p>. The one rule
      // that tries, control-has-associated-label, judges each element alone and
      // cannot see a <label htmlFor> beside it — so it flags correctly labelled
      // inputs and misses bare <select>s. That gap is covered by
      // chronically/control-has-name below instead, which reads the whole
      // file. Do not enable control-has-associated-label to "close" it.
      jsxA11y.flatConfigs.recommended,
    ],
    plugins: { chronically },
    rules: {
      // every form field needs a name a screen reader can announce — shared
      // with mobile, see eslint-rules/accessible-names.cjs
      'chronically/control-has-name': 'error',
    },
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
])
