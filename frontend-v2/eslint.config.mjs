import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * Boundary rules for scholarship test data and operator load-testing tooling.
 *
 * These are mutually exclusive file groups on purpose: flat config replaces a
 * rule wholesale rather than merging it, so each group below has to be
 * self-contained.
 */
const FIXTURE_MESSAGE =
  'Test-only scholarship fixtures must not be imported by application code (#1225). Move the import into test/, e2e/, or __tests__/, and let the production service read the API instead.';

const LOAD_TOOLING_MESSAGE =
  'Load-generation tooling is operator-only (#1224) and is not importable from the application or from tests. Run it from scripts/load-tests/ instead.';

const LOAD_TOOLING_PATTERNS = [
  '**/load-tests/**',
  '**/load-testing',
  '**/load-testing/**',
  '**/scholarship-deadline-burst',
  '**/scholarship-deadline-burst.*',
];

const FIXTURE_PATTERNS = [
  '**/scholarships/testing',
  '**/scholarships/testing/**',
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  // Application code: no fixtures, no load tooling. `duplicates/fixtures.ts` and
  // friends used to sit beside the production services that imported them and
  // were re-exported from the feature barrels, so `src/features/scholarships`
  // exported a fabricated dataset to every consumer.
  {
    files: ['**/*.{ts,tsx,js,jsx,mts,cts,mjs,cjs}'],
    ignores: [
      'scripts/**',
      'test/**',
      'e2e/**',
      '**/__tests__/**',
      '**/*.test.ts',
      '**/*.test.tsx',
      '**/*.test-d.ts',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            ...FIXTURE_PATTERNS.map((group) => ({ group: [group], message: FIXTURE_MESSAGE })),
            ...LOAD_TOOLING_PATTERNS.map((group) => ({ group: [group], message: LOAD_TOOLING_MESSAGE })),
          ],
        },
      ],
    },
  },
  // Tests may use fixtures, but still not the operator CLI's runtime wiring.
  {
    files: ['**/*.{ts,tsx,js,jsx,mts,cts,mjs,cjs}'],
    ignores: ['scripts/load-tests/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: LOAD_TOOLING_PATTERNS.map((group) => ({
            group: [group],
            message: LOAD_TOOLING_MESSAGE,
          })),
        },
      ],
    },
  },
  // The tool and its own unit tests are the only places allowed to load the tool.
  {
    files: ['scripts/load-tests/**/*.{ts,tsx,js,jsx,mts,cts,mjs,cjs}'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
]);

export default eslintConfig;
