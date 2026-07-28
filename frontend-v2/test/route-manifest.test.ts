/**
 * Route ownership guard for issue #820.
 * frontend-v2 has route files under both `app/` and `src/app/`, making
 * Next.js route discovery ambiguous. `dashboard/student/transactions` is a
 * pre-existing duplicate tracked for consolidation; this test ratchets
 * against any *new* route being defined in both trees.
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '..');
const ROUTE_FILE = /^page\.(t|j)sx?$/;
const KNOWN_DUPLICATES = new Set(['dashboard/student/transactions']);

function collectRoutes(base: string): Set<string> {
  const routes = new Set<string>();
  if (!fs.existsSync(base)) return routes;

  function walk(dir: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (ROUTE_FILE.test(entry.name)) {
        routes.add(path.relative(base, dir).split(path.sep).join('/'));
      }
    }
  }
  walk(base);
  return routes;
}

describe('route ownership', () => {
  it('has no new route defined in both app/ and src/app/', () => {
    const appRoutes = collectRoutes(path.join(ROOT, 'app'));
    const srcAppRoutes = collectRoutes(path.join(ROOT, 'src', 'app'));

    const duplicates = [...appRoutes].filter((route) => srcAppRoutes.has(route));
    const unexpected = duplicates.filter((route) => !KNOWN_DUPLICATES.has(route));

    expect(unexpected, `New duplicate routes in app/ and src/app/: ${unexpected.join(', ')}`).toEqual(
      [],
    );
  });
});
