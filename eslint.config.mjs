import js from "@eslint/js";
import vitest from "@vitest/eslint-plugin";
import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

const sourceFiles = ["src/**/*.ts"];
const testFiles = ["tests/**/*.ts"];
const typescriptFiles = [...sourceFiles, ...testFiles, "*.config.ts"];
const codeFiles = ["**/*.{js,mjs,cjs,ts}"];

export default defineConfig(
  globalIgnores([
    "**/node_modules/**",
    "**/dist/**",
    "**/build/**",
    "**/coverage/**",
    "**/.next/**",
    "**/.nuxt/**",
    "**/generated/**",
    "**/__generated__/**",
    "**/*.min.js",
    "main.js"
  ]),
  {
    name: "heading-mind-map-revamp/javascript",
    files: ["**/*.{js,mjs,cjs}"],
    extends: [js.configs.recommended]
  },
  {
    name: "heading-mind-map-revamp/typescript",
    files: typescriptFiles,
    extends: [js.configs.recommended, ...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ["*.config.ts"]
        },
        tsconfigRootDir: import.meta.dirname
      }
    }
  },
  {
    name: "heading-mind-map-revamp/browser-source",
    files: sourceFiles,
    languageOptions: {
      globals: globals.browser
    }
  },
  {
    name: "heading-mind-map-revamp/node-tooling",
    files: ["*.{js,mjs,cjs}", "*.config.ts", "scripts/**/*.{js,mjs,cjs,ts}"],
    languageOptions: {
      globals: globals.node
    }
  },
  {
    name: "heading-mind-map-revamp/vitest",
    files: testFiles,
    extends: [vitest.configs.recommended],
    languageOptions: {
      globals: globals.node
    }
  },
  {
    name: "heading-mind-map-revamp/maintainability",
    files: codeFiles,
    rules: {
      "max-lines": ["warn", {
        max: 500,
        skipBlankLines: true,
        skipComments: true
      }],
      "max-lines-per-function": ["warn", {
        max: 100,
        skipBlankLines: true,
        skipComments: true,
        IIFEs: true
      }],
      complexity: ["warn", 15],
      "max-depth": ["warn", 4],
      "max-params": ["warn", 5],
      "max-statements": ["warn", 40]
    }
  },
  {
    // Test suites group independent cases and multi-line Markdown samples inside describe callbacks, so they use test-specific limits.
    name: "heading-mind-map-revamp/declarative-test-suites",
    files: testFiles,
    rules: {
      "max-lines": ["warn", {
        max: 1000,
        skipBlankLines: true,
        skipComments: true
      }],
      "max-lines-per-function": ["warn", {
        max: 800,
        skipBlankLines: true,
        skipComments: true,
        IIFEs: true
      }]
    }
  },
  {
    // The real Obsidian E2E is a single sequential scenario script; keeping it linear makes failures easier to diagnose.
    name: "heading-mind-map-revamp/obsidian-e2e-scenario",
    files: ["scripts/verify-obsidian-e2e.mjs"],
    rules: {
      "max-lines": ["warn", {
        max: 800,
        skipBlankLines: true,
        skipComments: true
      }],
      "max-lines-per-function": ["warn", {
        max: 600,
        skipBlankLines: true,
        skipComments: true,
        IIFEs: true
      }],
      "max-statements": ["warn", 80]
    }
  }
);
