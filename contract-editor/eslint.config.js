import js from "@eslint/js";
import globals from "globals";

export default [
  { ignores: ["node_modules/", ".wrangler/"] },
  js.configs.recommended,
  {
    files: ["public/js/**/*.js"],
    languageOptions: {
      sourceType: "module",
      globals: { ...globals.browser, DOMPurify: "readonly" }
    }
  },
  {
    files: ["functions/**/*.js", "server/**/*.js"],
    languageOptions: { sourceType: "module", globals: { ...globals.serviceworker } }
  },
  {
    files: ["test/**/*.mjs", "scripts/**/*.mjs", "eslint.config.js"],
    // tests and scripts run in Node with jsdom providing the browser globals (test/setup.mjs)
    languageOptions: { sourceType: "module", globals: { ...globals.node, ...globals.browser } }
  },
  { rules: { "no-unused-vars": ["error", { args: "none", caughtErrors: "none" }], "no-empty": ["error", { allowEmptyCatch: true }], "no-irregular-whitespace": ["error", { skipStrings: true, skipTemplates: true, skipRegExps: true, skipComments: true }] } }
];
