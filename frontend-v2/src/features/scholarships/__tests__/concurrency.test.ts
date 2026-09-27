import { describe, expect, it } from 'vitest';
import {
  applyOptimistic,
  buildFieldDiffs,
  commitWrite,
  describeConflict,
  detectConflict,
  rebaseOntoServer,
} from '../concurrency/service';
import type { VersionedDocument, VersionedResource } from '../concurrency/types';

const NOW = new Date('2025-03-01T00:00:00.000Z');

function resource(overrides: Partial<VersionedResource> = {}): VersionedResource {
  return {
    resourceType: 'program',
    resourceId: 'chainverse-scholarship',
    version: 4,
    updatedAt: '2025-02-20T00:00:00.000Z',
    updatedBy: 'finance-one',
    ...overrides,
  };
}

const BASE_FIELDS = { title: 'ChainVerse Scholarship', awardCeilingCents: 4800000, notes: '' };

describe('detectConflict', () => {
  it('rejects a stale write', () => {
    const conflict = detectConflict(
      resource({ version: 4 }),
      resource({ version: 4 }),
      resource({ version: 5, updatedBy: 'reviewer-two' })
    );
    expect(conflict).not.toBeNull();
    expect(conflict?.code).toBe('VERSION_CONFLICT');
    expect(conflict?.expectedVersion).toBe(4);
    expect(conflict?.actualVersion).toBe(5);
    expect(conflict?.message).toContain('Nothing was saved');
  });

  it('accepts a write whose version still matches the server', () => {
    expect(
      detectConflict(resource({ version: 4 }), resource({ version: 4 }), resource({ version: 4 }))
    ).toBeNull();
  });

  it('reports the fields that differ when payloads are supplied', () => {
    const conflict = detectConflict(
      resource({ version: 4 }),
      resource({ version: 4 }),
      resource({ version: 5 }),
      {
        base: BASE_FIELDS,
        incoming: { ...BASE_FIELDS, title: 'My title' },
        server: { ...BASE_FIELDS, title: 'Their title', notes: 'frozen' },
      }
    );
    expect(conflict?.conflictingFields).toEqual(['notes', 'title']);
  });

  it('rejects a write aimed at a different resource', () => {
    const conflict = detectConflict(
      resource(),
      resource({ resourceId: 'other-program' }),
      resource()
    );
    expect(conflict).not.toBeNull();
    expect(conflict?.message).toContain('different resource');
  });
});

describe('commitWrite', () => {
  it('applies a matching version and increments it', () => {
    const result = commitWrite({
      base: resource({ version: 4 }),
      incoming: resource({ version: 4 }),
      server: resource({ version: 4 }),
      fields: { ...BASE_FIELDS, title: 'New title' },
      now: NOW,
    });
    expect(result.status).toBe('applied');
    if (result.status === 'applied') {
      expect(result.value.version).toBe(5);
      expect(result.value.updatedAt).toBe('2025-03-01T00:00:00.000Z');
      expect(result.value.title).toBe('New title');
    }
  });

  it('returns a conflict and no value for a stale write', () => {
    const result = commitWrite({
      base: resource({ version: 4 }),
      incoming: resource({ version: 4 }),
      server: resource({ version: 6 }),
      fields: { ...BASE_FIELDS, title: 'New title' },
      now: NOW,
    });
    expect(result.status).toBe('conflict');
    if (result.status === 'conflict') {
      expect(result.conflict.actualVersion).toBe(6);
    }
    expect('value' in result).toBe(false);
  });
});

describe('applyOptimistic never mutates its input', () => {
  it('leaves the original object untouched', () => {
    const original = { title: 'ChainVerse Scholarship', notes: '' };
    const snapshot = { ...original };
    const next = applyOptimistic(original, (draft) => {
      draft.title = 'Edited locally';
      return draft;
    });
    expect(next.title).toBe('Edited locally');
    expect(original).toEqual(snapshot);
    expect(next).not.toBe(original);
  });

  it('leaves the original untouched when the mutator throws', () => {
    const original = { title: 'ChainVerse Scholarship' };
    expect(() =>
      applyOptimistic(original, (draft) => {
        draft.title = 'Half applied';
        throw new Error('validation failed');
      })
    ).toThrow('validation failed');
    expect(original.title).toBe('ChainVerse Scholarship');
  });
});

describe('buildFieldDiffs', () => {
  it('compares yours against theirs with the common base', () => {
    const diffs = buildFieldDiffs(
      BASE_FIELDS,
      { ...BASE_FIELDS, title: 'My title' },
      { ...BASE_FIELDS, title: 'Their title', notes: 'frozen by finance' }
    );
    expect(diffs).toEqual([
      { field: 'notes', yours: '', theirs: 'frozen by finance', base: '' },
      { field: 'title', yours: 'My title', theirs: 'Their title', base: 'ChainVerse Scholarship' },
    ]);
  });

  it('returns nothing when both sides agree', () => {
    expect(buildFieldDiffs(BASE_FIELDS, BASE_FIELDS, BASE_FIELDS)).toEqual([]);
  });
});

describe('rebaseOntoServer', () => {
  it('keeps my fields on top of the current server values', () => {
    const rebased = rebaseOntoServer(
      { title: 'My title', notes: 'my note' },
      { title: 'Their title', notes: 'their note' }
    );
    expect(rebased).toEqual({ title: 'My title', notes: 'my note' });
  });

  it('does not mutate either side', () => {
    const mine = { title: 'My title' };
    const server = { title: 'Their title' };
    rebaseOntoServer(mine, server);
    expect(mine).toEqual({ title: 'My title' });
    expect(server).toEqual({ title: 'Their title' });
  });

  it('commits cleanly once the client has rebased onto the server version', () => {
    const server = resource({ version: 7 });
    const rebased = rebaseOntoServer(
      { title: 'My title', notes: 'my note' },
      { title: 'Their title', notes: 'their note' }
    );
    const result = commitWrite({
      base: server,
      incoming: server,
      server,
      fields: rebased,
      serverFields: { title: 'Their title', notes: 'their note' },
      now: NOW,
    });
    expect(result.status).toBe('applied');
  });
});

describe('describeConflict', () => {
  it('names the versions and the differing fields', () => {
    const conflict = detectConflict(
      resource({ version: 4 }),
      resource({ version: 4 }),
      resource({ version: 5 }),
      { base: BASE_FIELDS, incoming: BASE_FIELDS, server: { ...BASE_FIELDS, title: 'x' } }
    );
    expect(describeConflict(conflict!)).toContain('expected version 4');
    expect(describeConflict(conflict!)).toContain('server is at 5');
    expect(describeConflict(conflict!)).toContain('title');
  });
});

describe('VersionedDocument shape', () => {
  it('carries the resource envelope next to the fields', () => {
    const document: VersionedDocument = { resource: resource(), fields: BASE_FIELDS };
    expect(document.resource.version).toBe(4);
    expect(document.fields.awardCeilingCents).toBe(4800000);
  });
});
