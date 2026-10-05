// Lint scope: the new safety and mobile-API code only.
//
// The repository had no ESLint setup (the "lint" script calls `next lint`, which Next 16
// removed). Linting the whole existing site would produce thousands of findings in code
// that is deliberately not being touched, so this config is used by `npm run lint:safety`
// on the files listed there. Widen the list as areas are cleaned up.
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "no-console": ["error", { allow: ["error", "warn"] }],
      eqeqeq: ["error", "always"],
    },
  },
  {
    // The logger is the one place allowed to print.
    files: ["lib/api/v1/logger.ts", "scripts/**"],
    rules: { "no-console": "off" },
  },
  {
    // Scripts run in Node.
    files: ["scripts/**"],
    languageOptions: { globals: { console: "readonly", process: "readonly" } },
  },
);
