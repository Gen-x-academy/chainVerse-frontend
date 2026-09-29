#!/usr/bin/env node
/**
 * Fails CI if application code imports operator-only or test-only scholarship
 * tooling (issues #1224 and #1225).
 *
 * The deadline-burst load generator used to live at
 * `src/features/scholarships/load-testing.ts` and was rendered by a client
 * component on `/scholarships/operations`, which put a synthetic traffic
 * generator in the browser bundle of a production route. It now lives under
 * `scripts/load-tests/`, and this check makes the move stick: nothing under the
 * shipped route graph may reach back into `scripts/`.
 *
 * The same pass rejects application imports of the test-only fixture tree under
 * `src/features/scholarships/testing/`, which used to sit beside the production
 * services that consumed it and was re-exported from the feature barrels.
 *
 * Files that are themselves test-only — anything under `test/`, `e2e/`,
 * `__tests__/`, or a `*.test.*` sibling — are skipped, and the fixture modules
 * may of course import each other.
 *
 * Usage: node scripts/check-no-production-imports.mjs
 * Exits 0 when clean, 1 with a report of offending imports otherwise.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, join, relative, resolve, sep } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");

/** Directories whose contents end up in a shipped bundle. */
const APPLICATION_DIRS = ["app", "src", "lib", "components", "hooks", "services", "utils"];

/** Directory segments that mark a file as test-only. */
const TEST_SEGMENTS = new Set(["test", "tests", "e2e", "__tests__", "__mocks__"]);

const OPERATOR_TOOLING_DIR = "scripts/load-tests";
const TEST_ONLY_FIXTURES_DIR = "src/features/scholarships/testing";

/** The removed in-application load generator, so a re-add cannot sneak back. */
const RETIRED_LOAD_TESTING_MODULES = new Set([
  "load-testing",
  "features/scholarships/load-testing",
  "@/src/features/scholarships/load-testing",
]);

const SCANNED_EXTENSIONS = new Set([".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"]);

const SKIPPED_DIRS = new Set(["node_modules", ".next", "out", "build", "dist", "coverage", ".git"]);

const IMPORT_PATTERN = /(?:from\s*|import\s*\(\s*|require\s*\(\s*)["']([^"']+)["']/g;

const toPosix = (value) => value.split(sep).join("/");

/** Repo-relative POSIX path of a file. */
const repoPath = (file) => toPosix(relative(projectRoot, file));

function isTestOnlyFile(relPath) {
  const segments = relPath.split("/");
  if (segments.some((segment) => TEST_SEGMENTS.has(segment))) return true;
  const name = segments[segments.length - 1];
  return /\.test(-d)?\.[cm]?[jt]sx?$/.test(name) || /\.spec\.[cm]?[jt]sx?$/.test(name);
}

function isInside(relPath, directory) {
  return relPath === directory || relPath.startsWith(`${directory}/`);
}

/** Strips leading `./` and `../` segments so module names compare consistently. */
function normalizeSpecifier(specifier) {
  return specifier.replace(/^(?:\.\.\/)+/, "").replace(/^\.\//, "");
}

/**
 * Resolves a relative specifier to a repo-relative POSIX path, or null when the
 * specifier is a bare module specifier rather than a relative path.
 */
function resolveSpecifier(fromFile, specifier) {
  if (!specifier.startsWith(".")) return null;
  return toPosix(relative(projectRoot, resolve(dirname(fromFile), specifier)));
}

function collectFiles(dir, files = []) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return files;
  }

  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    if (SKIPPED_DIRS.has(entry.name)) continue;

    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      collectFiles(full, files);
    } else if (SCANNED_EXTENSIONS.has(extname(entry.name))) {
      files.push(full);
    }
  }

  return files;
}

const violations = [];

for (const dir of APPLICATION_DIRS) {
  const absolute = join(projectRoot, dir);
  let isDirectory = false;
  try {
    isDirectory = statSync(absolute).isDirectory();
  } catch {
    continue;
  }
  if (!isDirectory) continue;

  for (const file of collectFiles(absolute)) {
    const relPath = repoPath(file);

    // Test files are allowed to use test data; the fixture modules may import
    // each other. Everything else is shipped.
    if (isTestOnlyFile(relPath)) continue;
    const importerIsFixture = isInside(relPath, TEST_ONLY_FIXTURES_DIR);

    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(IMPORT_PATTERN)) {
      const specifier = match[1];
      const target = resolveSpecifier(file, specifier);

      if (RETIRED_LOAD_TESTING_MODULES.has(normalizeSpecifier(specifier))) {
        violations.push({
          file: relPath,
          specifier,
          reason: "imports the retired in-application load generator",
        });
        continue;
      }

      if (target && isInside(target, OPERATOR_TOOLING_DIR)) {
        violations.push({
          file: relPath,
          specifier,
          reason: "imports operator-only load-testing tooling",
        });
        continue;
      }

      if (target && isInside(target, TEST_ONLY_FIXTURES_DIR) && !importerIsFixture) {
        violations.push({
          file: relPath,
          specifier,
          reason: "imports test-only scholarship fixtures",
        });
        continue;
      }

      if (!target && /(^|[/\\])(load-testing|load-tests)([/\\]|$)/.test(specifier)) {
        violations.push({
          file: relPath,
          specifier,
          reason: "imports operator-only load-testing tooling",
        });
      }
    }
  }
}

if (violations.length > 0) {
  process.stderr.write(
    `Application code must not import operator-only or test-only scholarships tooling (issues #1224, #1225):\n`,
  );
  for (const violation of violations) {
    process.stderr.write(
      `  ${violation.file}: "${violation.specifier}" ${violation.reason}\n`,
    );
  }
  process.stderr.write(
    `\nMove the import into a test under test/, e2e/, or __tests__/, or run the tool from scripts/.\n`,
  );
  process.exit(1);
}

process.stdout.write(
  `check-no-production-imports: no application file imports ${OPERATOR_TOOLING_DIR}/ or ${TEST_ONLY_FIXTURES_DIR}/\n`,
);
