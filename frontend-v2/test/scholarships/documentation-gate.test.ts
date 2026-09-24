// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { checkDocContents } from '@/src/features/scholarships/documentation';
import type { DocumentationManifest } from '@/src/features/scholarships/documentation';

const manifest = JSON.parse(
  readFileSync(resolve(process.cwd(), 'docs/scholarships-docs-manifest.json'), 'utf8')
) as DocumentationManifest;

const readDoc = (path: string): string | null => {
  try {
    return readFileSync(resolve(process.cwd(), path), 'utf8');
  } catch {
    return null;
  }
};

describe('scholarships documentation gate', () => {
  it('declares the scholarships feature in the manifest', () => {
    expect(manifest.feature).toBe('scholarships');
  });

  it('includes user-facing and operator-facing guides with owners', () => {
    const audiences = manifest.docs.map((doc) => doc.audience);
    expect(audiences).toContain('users');
    expect(audiences).toContain('operators');
    expect(manifest.docs.every((doc) => doc.owner.trim().length > 0)).toBe(true);
  });

  it('passes with every documented file present and complete', () => {
    const result = checkDocContents(manifest, readDoc);

    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.checks.every((check) => check.present && check.ok)).toBe(true);
  });

  it('flips to blocking when a documented file goes missing', () => {
    const result = checkDocContents(manifest, (path) => (path === 'docs/scholarships-user-guide.md' ? null : readDoc(path)));

    expect(result.ok).toBe(false);
    expect(result.errors.some((error) => error.includes('scholarships-user-guide.md'))).toBe(true);
  });

  it('flips to blocking when a required section is dropped', () => {
    const result = checkDocContents(manifest, (path) =>
      path === 'docs/scholarships-operator-guide.md' ? '# Operators\n\nNo privacy section here.' : readDoc(path)
    );

    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});