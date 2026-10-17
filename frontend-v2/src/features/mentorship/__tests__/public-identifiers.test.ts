import { describe, expect, it } from 'vitest';
import {
  MENTORSHIP_IDENTIFIER_VERSION,
  buildStablePublicId,
  deriveCorrelationId,
  generateMentorshipOpaqueId,
  generateMentorshipId,
  isStablePublicId,
  opaqueIsDisplayLike,
  assertNotDisplayDerived,
} from '../public-identifiers';

describe('stable public mentorship identifiers (MENTOR-005, #1252)', () => {
  it('is versioned', () => {
    expect(MENTORSHIP_IDENTIFIER_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('derives the same public id from the same source key, and different ids from different keys', () => {
    const first = buildStablePublicId('program', { apiKey: 'uuid-abc-123' });
    const replay = buildStablePublicId('program', { apiKey: 'uuid-abc-123' });
    const other = buildStablePublicId('program', { apiKey: 'uuid-def-456' });
    expect(replay).toBe(first);
    expect(other).not.toBe(first);
  });

  it('uses the canonical glossary prefix for the aggregate', () => {
    const id = buildStablePublicId('mentor', { apiKey: 'usr_999' });
    expect(id.startsWith('mtr_')).toBe(true);
    expect(isStablePublicId('mentor', id)).toBe(true);
    expect(isStablePublicId('program', id)).toBe(false);
  });

  it('never derives ids from display data (emails, names, blanks)', () => {
    expect(opaqueIsDisplayLike('ada@chainverse.dev')).toBe(true);
    expect(opaqueIsDisplayLike('Ada Okafor')).toBe(true);
    expect(opaqueIsDisplayLike('   ')).toBe(true);
    expect(opaqueIsDisplayLike('uuid-abc-123')).toBe(false);
    for (const bad of ['ada@chainverse.dev', 'Ada Okafor', '   ']) {
      expect(() => buildStablePublicId('mentee', { apiKey: bad })).toThrow();
    }
    expect(() => assertNotDisplayDerived('mentee', 'mte_key-1')).not.toThrow();
  });

  it('generates fresh opaque keys that never collide in practice', () => {
    const seen = new Set<string>();
    for (let index = 0; index < 250; index += 1) {
      seen.add(generateMentorshipOpaqueId());
    }
    expect(seen.size).toBe(250);
  });

  it('generated ids pass glossary validation', () => {
    for (const aggregate of ['mentor', 'mentee', 'program', 'engagement'] as const) {
      const id = generateMentorshipId(aggregate);
      expect(isStablePublicId(aggregate, id)).toBe(true);
    }
  });

  it('pairs every public id with a deterministic correlation id', () => {
    const id = buildStablePublicId('engagement', { apiKey: 'usr_42' });
    expect(deriveCorrelationId(id)).toBe(deriveCorrelationId(id));
    expect(deriveCorrelationId(id)).toMatch(/^corr_/);
    expect(deriveCorrelationId(id)).not.toBe(deriveCorrelationId(buildStablePublicId('engagement', { apiKey: 'usr_43' })));
  });
});
