import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/coverage/**",
      "reference/**",
      "packages/desktop/src/renderer/**",
      "packages/desktop/tailwind.config.js",
      "packages/desktop/postcss.config.js",
      "packages/desktop/vite.renderer.config.ts",
      "packages/desktop/vite.preload.config.ts",
      "packages/*/vitest.config.ts",
      "packages/*/tsconfig.test.json",
      "packages/skills-web/test/**/*.ts",
      "packages/skills-email/test/**/*.ts",
      "packages/skills-weather/test/**/*.ts",
      "packages/skills-calendar/test/**/*.ts",
      "packages/skills-notion/test/**/*.ts",
      "packages/skills-secrets/test/**/*.ts",
      "packages/cron/test/**/*.ts",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.node },
      parserOptions: {
        projectService: {
          allowDefaultProject: ["*.config.ts", "*.config.js", "eslint.config.js"],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    files: ["packages/desktop-e2e/**/*.ts"],
    rules: {
      "no-empty-pattern": "off",
    },
  },
  {
    // The Electron preload script is intentionally CommonJS — the build
    // (vite.preload.config.ts) emits `dist/preload.js` as a CJS module and
    // `preload.smoke.test.ts` asserts on the presence of `require("electron")`.
    files: ["packages/desktop/src/preload.ts"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
);
