import { describe, expect, it } from 'vitest';
import {
  auditTaxonomyChange,
  buildAliasIndex,
  deprecateExpertise,
  migrateExpertiseId,
  normalizeAlias,
  resolveExpertiseId,
  validateTaxonomy,
} from '../taxonomy/service';
import type { ExpertiseNode } from '../taxonomy/types';

function node(overrides: Partial<ExpertiseNode> = {}): ExpertiseNode {
  return {
    id: 'machine-learning',
    slug: 'machine-learning',
    label: 'Machine Learning',
    aliases: ['ML'],
    proficiencyLevels: ['awareness', 'working'],
    evidenceRequired: false,
    deprecated: false,
    updatedAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('normalizeAlias', () => {
  it('folds case, whitespace, and edge punctuation', () => {
    expect(normalizeAlias('  Machine   Learning!  ')).toBe('machine learning');
    expect(normalizeAlias('...data science...')).toBe('data science');
    expect(normalizeAlias('C++')).toBe('c');
  });

  it('collapses different spellings of the same term to one key', () => {
    expect(normalizeAlias('Data-Science')).toBe(normalizeAlias('data science'));
    expect(normalizeAlias('  ML ')).toBe(normalizeAlias('ml'));
  });
});

describe('buildAliasIndex and resolveExpertiseId', () => {
  const nodes = [
    node(),
    node({ id: 'data-science', slug: 'data-science', label: 'Data Science', aliases: ['DS'] }),
  ];

  it('resolves by label, alias, and slug', () => {
    expect(resolveExpertiseId('Machine Learning', nodes)).toBe('machine-learning');
    expect(resolveExpertiseId('ml', nodes)).toBe('machine-learning');
    expect(resolveExpertiseId('data-science', nodes)).toBe('data-science');
  });

  it('returns undefined for an unknown or empty term', () => {
    expect(resolveExpertiseId('quantum knitting', nodes)).toBeUndefined();
    expect(resolveExpertiseId('   ', nodes)).toBeUndefined();
  });

  it('throws on a duplicate alias', () => {
    const collision = [node(), node({ id: 'other', slug: 'other', label: 'Other', aliases: ['ML'] })];
    expect(() => buildAliasIndex(collision)).toThrow(/Duplicate taxonomy alias/);
  });
});

describe('validateTaxonomy', () => {
  it('accepts a well-formed tree', () => {
    const nodes = [
      node({ id: 'root', slug: 'root', label: 'Root' }),
      node({ id: 'child', slug: 'child', label: 'Child', parentId: 'root', aliases: [] }),
    ];
    expect(validateTaxonomy(nodes)).toEqual([]);
  });

  it('flags duplicate ids, slugs, and aliases', () => {
    const nodes = [
      node(),
      node({ id: 'machine-learning', label: 'Duplicate id' }),
      node({ id: 'third', slug: 'machine-learning', label: 'Duplicate slug', aliases: [] }),
    ];
    const codes = validateTaxonomy(nodes).map((item) => item.code);
    expect(codes).toContain('DUPLICATE_ID');
    expect(codes).toContain('DUPLICATE_SLUG');
    expect(codes).toContain('DUPLICATE_ALIAS');
  });

  it('flags a missing parent', () => {
    const codes = validateTaxonomy([node({ parentId: 'nope' })]).map((item) => item.code);
    expect(codes).toContain('MISSING_PARENT');
  });

  it('flags a parent cycle', () => {
    const nodes = [
      node({ id: 'a', slug: 'a', label: 'A', parentId: 'b', aliases: [] }),
      node({ id: 'b', slug: 'b', label: 'B', parentId: 'a', aliases: [] }),
    ];
    expect(validateTaxonomy(nodes).map((item) => item.code)).toContain('CYCLE');
  });

  it('requires a replacement for a deprecated node', () => {
    const codes = validateTaxonomy([node({ deprecated: true })]).map((item) => item.code);
    expect(codes).toContain('DEPRECATED_WITHOUT_REPLACEMENT');
  });

  it('flags a replacement that does not exist', () => {
    const codes = validateTaxonomy([node({ deprecated: true, replacedBy: 'nope' })]).map(
      (item) => item.code,
    );
    expect(codes).toContain('REPLACEMENT_NOT_FOUND');
  });
});

describe('deprecation and migration', () => {
  it('marks a node deprecated with its replacement', () => {
    const deprecated = deprecateExpertise(node(), 'ai', '2025-02-01T00:00:00.000Z');
    expect(deprecated.deprecated).toBe(true);
    expect(deprecated.replacedBy).toBe('ai');
    expect(deprecated.updatedAt).toBe('2025-02-01T00:00:00.000Z');
  });

  it('leaves a live reference unchanged', () => {
    const nodes = [node(), node({ id: 'ai', slug: 'ai', label: 'AI', aliases: [] })];
    expect(migrateExpertiseId('machine-learning', nodes)).toBe('machine-learning');
  });

  it('follows a replacement chain to a live node', () => {
    const nodes = [
      node({ deprecated: true, replacedBy: 'ai' }),
      node({ id: 'ai', slug: 'ai', label: 'AI', aliases: [], deprecated: true, replacedBy: 'gen-ai' }),
      node({ id: 'gen-ai', slug: 'gen-ai', label: 'Generative AI', aliases: [] }),
    ];
    expect(migrateExpertiseId('machine-learning', nodes)).toBe('gen-ai');
  });

  it('returns undefined for an unknown id', () => {
    expect(migrateExpertiseId('nope', [node()])).toBeUndefined();
  });
});

describe('auditTaxonomyChange', () => {
  it('records the changed node ids', () => {
    const previous = [node()];
    const next = [node({ label: 'Machine Learning & AI' })];
    const record = auditTaxonomyChange(previous, next, 'editor-1', new Date('2025-02-01T00:00:00.000Z'));
    expect(record.by).toBe('editor-1');
    expect(record.at).toBe('2025-02-01T00:00:00.000Z');
    expect(record.changedNodeIds).toEqual(['machine-learning']);
  });
});
