/**
 * TEST-ONLY fixture barrel (issue #1225).
 *
 * Every export in this directory is synthetic test data. Importing it from
 * application code pulls synthetic applicants and organizations into the
 * production bundle, so `npm run lint:no-test-data` and
 * `scripts/check-no-test-data-imports.mjs` fail the build when anything
 * outside a test path reaches in here.
 *
 * The scholarship feature barrel (`src/features/scholarships/index.ts`)
 * deliberately does not re-export this module.
 *
 * @see ../../../../../docs/scholarships-testing.md (see "Test-only fixtures")
 */

export * from './application-validation';
export * from './configurable-forms';
export * from './deadline-windows';
export * from './duplicate-prevention';
export * from './program-scoping';
export * from './scholarship-set';
export * from './sponsors';
