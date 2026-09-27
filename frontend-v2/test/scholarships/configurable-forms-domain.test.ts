// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  assertSchemaIsMutable,
  bindAnswersToFormVersion,
  bumpVersion,
  computeSchemaHash,
  evaluateCondition,
  forkFormSchema,
  getActiveSectionsAndFields,
  publishFormSchema,
  validateConditionalLogic,
  verifyAnswerBinding,
} from '@/src/features/scholarships/applications/forms/domain';
import {
  mockFormSchemaDraft,
  mockPublishedFormSchema,
} from '@/src/features/scholarships/testing/fixtures/configurable-forms';
import type {
  ConfigurableFormSchema,
  FormSection,
} from '@/src/features/scholarships/applications/forms/types';

describe('Configurable Application Forms Domain & Invariants', () => {
  /* -------------------------------------------------------------------------- */
  /* Acceptance Criterion 1: Published Schemas are Immutable                    */
  /* -------------------------------------------------------------------------- */
  describe('1. Schema Immutability & Version Governance', () => {
    it('allows mutation on draft schemas and blocks mutation on published schemas', () => {
      // Draft schema is mutable
      expect(() => assertSchemaIsMutable(mockFormSchemaDraft)).not.toThrow();

      // Published schema is immutable
      expect(() => assertSchemaIsMutable(mockPublishedFormSchema)).toThrowError(
        /is immutable/
      );
    });

    it('publishing transitions draft to published, seals timestamp, and updates hash', () => {
      const now = new Date('2026-09-27T12:00:00.000Z');
      const published = publishFormSchema(mockFormSchemaDraft, 'user-admin-1', now);

      expect(published.status).toBe('published');
      expect(published.publishedAt).toBe(now.toISOString());
      expect(published.publishedBy).toBe('user-admin-1');
      expect(published.schemaHash).toMatch(/^hash_v1\.0\.0_[a-f0-9]{8}$/);
    });

    it('forking creates an editable draft with bumped semver and clones sections', () => {
      const now = new Date('2026-09-27T12:00:00.000Z');

      // Minor bump (1.0.0 -> 1.1.0)
      const forkedMinor = forkFormSchema(mockPublishedFormSchema, 'minor', 'user-admin-1', now);
      expect(forkedMinor.version).toBe('1.1.0');
      expect(forkedMinor.status).toBe('draft');
      expect(forkedMinor.publishedAt).toBeUndefined();
      expect(() => assertSchemaIsMutable(forkedMinor)).not.toThrow();

      // Patch bump (1.0.0 -> 1.0.1)
      const forkedPatch = forkFormSchema(mockPublishedFormSchema, 'patch', 'user-admin-1', now);
      expect(forkedPatch.version).toBe('1.0.1');

      // Major bump (1.0.0 -> 2.0.0)
      const forkedMajor = forkFormSchema(mockPublishedFormSchema, 'major', 'user-admin-1', now);
      expect(forkedMajor.version).toBe('2.0.0');
    });

    it('computes deterministic schema hash matching identical structure and values', () => {
      const hash1 = computeSchemaHash(mockFormSchemaDraft);
      const hash2 = computeSchemaHash({ ...mockFormSchemaDraft });
      expect(hash1).toBe(hash2);

      // Mutating section title changes hash
      const mutatedSections = mockFormSchemaDraft.sections.map((s, i) =>
        i === 0 ? { ...s, title: 'Altered Title' } : s
      );
      const mutatedHash = computeSchemaHash({ ...mockFormSchemaDraft, sections: mutatedSections });
      expect(mutatedHash).not.toBe(hash1);
    });
  });

  /* -------------------------------------------------------------------------- */
  /* Acceptance Criterion 2: Conditional Logic is Validated                     */
  /* -------------------------------------------------------------------------- */
  describe('2. Conditional Logic Validation', () => {
    it('passes clean validation for valid conditional dependencies', () => {
      const result = validateConditionalLogic(mockFormSchemaDraft);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('detects references to nonexistent target fields', () => {
      const brokenSection: FormSection = {
        id: 'sec_test',
        title: 'Broken Section',
        order: 1,
        fields: [
          {
            id: 'field_dependent',
            sectionId: 'sec_test',
            kind: 'question',
            type: 'text',
            label: 'Dependent Field',
            required: true,
            order: 1,
            conditional: {
              targetFieldId: 'field_nonexistent',
              operator: 'is_checked',
              value: true,
            },
          },
        ],
      };

      const result = validateConditionalLogic({ sections: [brokenSection] });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('nonexistent field'))).toBe(true);
    });

    it('detects forward reference dependencies', () => {
      const forwardRefSection: FormSection = {
        id: 'sec_forward',
        title: 'Forward Ref Section',
        order: 1,
        fields: [
          {
            id: 'field_first',
            sectionId: 'sec_forward',
            kind: 'question',
            type: 'text',
            label: 'First Field',
            required: true,
            order: 1,
            // Depends on field_second which comes AFTER field_first!
            conditional: {
              targetFieldId: 'field_second',
              operator: 'equals',
              value: 'test',
            },
          },
          {
            id: 'field_second',
            sectionId: 'sec_forward',
            kind: 'question',
            type: 'text',
            label: 'Second Field',
            required: true,
            order: 2,
          },
        ],
      };

      const result = validateConditionalLogic({ sections: [forwardRefSection] });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('forward reference'))).toBe(true);
    });

    it('detects circular dependency cycles across conditional fields', () => {
      const cyclicSection: FormSection = {
        id: 'sec_cyclic',
        title: 'Cyclic Section',
        order: 1,
        fields: [
          {
            id: 'field_a',
            sectionId: 'sec_cyclic',
            kind: 'question',
            type: 'boolean',
            label: 'Field A',
            required: true,
            order: 1,
            conditional: {
              targetFieldId: 'field_b',
              operator: 'is_checked',
              value: true,
            },
          },
          {
            id: 'field_b',
            sectionId: 'sec_cyclic',
            kind: 'question',
            type: 'boolean',
            label: 'Field B',
            required: true,
            order: 2,
            conditional: {
              targetFieldId: 'field_a',
              operator: 'is_checked',
              value: true,
            },
          },
        ],
      };

      const result = validateConditionalLogic({ sections: [cyclicSection] });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('Circular conditional dependency'))).toBe(true);
    });

    it('evaluates conditional operators accurately', () => {
      expect(
        evaluateCondition(
          { targetFieldId: 'aid', operator: 'is_checked', value: true },
          { aid: true }
        )
      ).toBe(true);

      expect(
        evaluateCondition(
          { targetFieldId: 'aid', operator: 'is_checked', value: true },
          { aid: false }
        )
      ).toBe(false);

      expect(
        evaluateCondition(
          { targetFieldId: 'track', operator: 'equals', value: 'soroban' },
          { track: 'soroban' }
        )
      ).toBe(true);

      expect(
        evaluateCondition(
          { targetFieldId: 'track', operator: 'not_equals', value: 'defi' },
          { track: 'soroban' }
        )
      ).toBe(true);

      expect(
        evaluateCondition(
          { targetFieldId: 'role', operator: 'in', value: ['student', 'mentor'] },
          { role: 'student' }
        )
      ).toBe(true);

      expect(
        evaluateCondition(
          { targetFieldId: 'gpa', operator: 'greater_than', value: 3.5 },
          { gpa: 3.8 }
        )
      ).toBe(true);
    });

    it('resolves active sections and fields dynamically based on answers', () => {
      // When field_needs_financial_aid is false, financial aid explanation and income evidence are hidden
      const noAidAnswers = {
        field_needs_financial_aid: false,
      };
      const noAidActive = getActiveSectionsAndFields(mockFormSchemaDraft, noAidAnswers);
      const activeIds = noAidActive.activeFields.map((f) => f.id);

      expect(activeIds).not.toContain('field_financial_aid_explanation');
      expect(activeIds).not.toContain('field_income_evidence');
      expect(activeIds).toContain('field_personal_statement');

      // When field_needs_financial_aid is true, conditioned fields appear
      const withAidAnswers = {
        field_needs_financial_aid: true,
      };
      const withAidActive = getActiveSectionsAndFields(mockFormSchemaDraft, withAidAnswers);
      const withAidIds = withAidActive.activeFields.map((f) => f.id);

      expect(withAidIds).toContain('field_financial_aid_explanation');
      expect(withAidIds).toContain('field_income_evidence');
    });
  });

  /* -------------------------------------------------------------------------- */
  /* Acceptance Criterion 3: Answers Tied to Accepted Form Version              */
  /* -------------------------------------------------------------------------- */
  describe('3. Version-Bound Answers and Binding Verification', () => {
    it('binds answers strictly to schema version and content hash', () => {
      const now = new Date('2026-09-27T12:00:00.000Z');
      const answers = {
        field_personal_statement: 'My personal statement response...',
        field_track_choice: 'soroban',
      };

      const binding = bindAnswersToFormVersion(mockPublishedFormSchema, answers, now);

      expect(binding.schemaId).toBe(mockPublishedFormSchema.id);
      expect(binding.version).toBe('1.0.0');
      expect(binding.schemaHash).toBe(mockPublishedFormSchema.schemaHash);
      expect(binding.verified).toBe(true);
      expect(binding.submittedAt).toBe(now.toISOString());
    });

    it('rejects binding answers against an unpublished draft schema', () => {
      expect(() =>
        bindAnswersToFormVersion(mockFormSchemaDraft, { field_a: 'test' })
      ).toThrowError(/unpublished draft/);
    });

    it('verifies valid binding and rejects version or hash mismatches', () => {
      const answers = { field_personal_statement: 'Valid content' };
      const binding = bindAnswersToFormVersion(mockPublishedFormSchema, answers);

      // Matches exactly
      expect(verifyAnswerBinding(mockPublishedFormSchema, binding).valid).toBe(true);

      // Version mismatch
      expect(
        verifyAnswerBinding(mockPublishedFormSchema, { ...binding, version: '2.0.0' }).valid
      ).toBe(false);

      // Hash mismatch
      expect(
        verifyAnswerBinding(mockPublishedFormSchema, { ...binding, schemaHash: 'hash_tampered' })
          .valid
      ).toBe(false);
    });
  });
});
