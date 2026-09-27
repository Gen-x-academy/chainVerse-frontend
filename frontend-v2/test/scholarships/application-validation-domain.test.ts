// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  buildSafeFieldPath,
  countWords,
  isValidDateString,
  normalizeRichText,
  validateApplicationForm,
  validateFieldAnswer,
} from '@/src/features/scholarships/applications/validation/domain';
import {
  mockApplicationFormSchema,
  mockMalformedAnswers,
  mockValidAnswers,
} from '@/src/features/scholarships/applications/validation/fixtures';
import { applicationValidationService } from '@/src/features/scholarships/applications/validation/service';
import type { ApplicationFieldSchema } from '@/src/features/scholarships/applications/validation/types';

describe('Application Answers Validation & Word Limits Domain Logic', () => {
  /* -------------------------------------------------------------------------- */
  /* Acceptance Criterion 1: Client and Server Rules Agree                     */
  /* -------------------------------------------------------------------------- */
  describe('1. Client and Server Validation Agreement', () => {
    it('client and server return identical validation outcomes for valid answers', async () => {
      // Client-side pure evaluation
      const clientResult = validateApplicationForm(mockApplicationFormSchema, mockValidAnswers);

      // Server-side service evaluation
      const serverResult = await applicationValidationService.validateAnswers(
        mockApplicationFormSchema.roundId,
        mockValidAnswers
      );

      expect(clientResult.valid).toBe(true);
      expect(serverResult.valid).toBe(true);
      expect(clientResult.errors).toEqual([]);
      expect(serverResult.errors).toEqual([]);
      expect(clientResult.wordCounts).toEqual(serverResult.wordCounts);
    });

    it('client and server return identical rejection errors for malformed answers', async () => {
      const clientResult = validateApplicationForm(mockApplicationFormSchema, mockMalformedAnswers);
      const serverResult = await applicationValidationService.validateAnswers(
        mockApplicationFormSchema.roundId,
        mockMalformedAnswers
      );

      expect(clientResult.valid).toBe(false);
      expect(serverResult.valid).toBe(false);
      expect(clientResult.errors.length).toBe(serverResult.errors.length);

      const clientCodes = clientResult.errors.map((e) => `${e.fieldPath}:${e.code}`).sort();
      const serverCodes = serverResult.errors.map((e) => `${e.fieldPath}:${e.code}`).sort();
      expect(clientCodes).toEqual(serverCodes);
    });
  });

  /* -------------------------------------------------------------------------- */
  /* Acceptance Criterion 2: Malformed Content is Rejected                     */
  /* -------------------------------------------------------------------------- */
  describe('2. Malformed Content Rejection', () => {
    it('rejects missing or whitespace-only required fields', () => {
      const field: ApplicationFieldSchema = {
        id: 'applicantName',
        label: 'Full Name',
        type: 'text',
        required: true,
      };

      const emptyRes = validateFieldAnswer(field, '');
      expect(emptyRes.valid).toBe(false);
      expect(emptyRes.error?.code).toBe('REQUIRED_FIELD_MISSING');

      const whitespaceRes = validateFieldAnswer(field, '    ');
      expect(whitespaceRes.valid).toBe(false);
      expect(whitespaceRes.error?.code).toBe('REQUIRED_FIELD_MISSING');

      const nullRes = validateFieldAnswer(field, null);
      expect(nullRes.valid).toBe(false);
      expect(nullRes.error?.code).toBe('REQUIRED_FIELD_MISSING');
    });

    it('rejects unlisted or tampered option values for single_select and multi_select', () => {
      const singleSelect: ApplicationFieldSchema = {
        id: 'track',
        label: 'Track',
        type: 'single_select',
        required: true,
        options: [
          { value: 'defi', label: 'DeFi' },
          { value: 'security', label: 'Security' },
        ],
      };

      const validSingle = validateFieldAnswer(singleSelect, 'defi');
      expect(validSingle.valid).toBe(true);

      const invalidSingle = validateFieldAnswer(singleSelect, 'tampered_sql_injection');
      expect(invalidSingle.valid).toBe(false);
      expect(invalidSingle.error?.code).toBe('INVALID_OPTION');

      const multiSelect: ApplicationFieldSchema = {
        id: 'modules',
        label: 'Modules',
        type: 'multi_select',
        required: true,
        options: [
          { value: 'm1', label: 'Module 1' },
          { value: 'm2', label: 'Module 2' },
        ],
      };

      const validMulti = validateFieldAnswer(multiSelect, ['m1', 'm2']);
      expect(validMulti.valid).toBe(true);

      const invalidMulti = validateFieldAnswer(multiSelect, ['m1', 'unapproved_module']);
      expect(invalidMulti.valid).toBe(false);
      expect(invalidMulti.error?.code).toBe('INVALID_OPTION');
    });

    it('rejects invalid numbers, NaNs, and out-of-range numeric/currency values', () => {
      const gpaField: ApplicationFieldSchema = {
        id: 'gpa',
        label: 'GPA',
        type: 'number',
        required: true,
        min: 2.0,
        max: 4.0,
      };

      expect(validateFieldAnswer(gpaField, 'not-a-number').valid).toBe(false);
      expect(validateFieldAnswer(gpaField, 1.8).error?.code).toBe('MIN_VALUE_NOT_MET');
      expect(validateFieldAnswer(gpaField, 4.5).error?.code).toBe('MAX_VALUE_EXCEEDED');
      expect(validateFieldAnswer(gpaField, 3.8).valid).toBe(true);

      const currencyField: ApplicationFieldSchema = {
        id: 'stipend',
        label: 'Stipend',
        type: 'currency',
        required: true,
        min: 10000, // $100.00
        max: 500000, // $5,000.00
      };

      expect(validateFieldAnswer(currencyField, -500).valid).toBe(false);
      expect(validateFieldAnswer(currencyField, 5000).error?.code).toBe('MIN_VALUE_NOT_MET');
      expect(validateFieldAnswer(currencyField, 600000).error?.code).toBe('MAX_VALUE_EXCEEDED');
      expect(validateFieldAnswer(currencyField, 250000).valid).toBe(true);
    });

    it('rejects malformed calendar dates and dates outside allowed bounds', () => {
      const dateField: ApplicationFieldSchema = {
        id: 'graduationDate',
        label: 'Graduation Date',
        type: 'date',
        required: true,
        minDate: '2026-01-01',
        maxDate: '2028-12-31',
      };

      expect(validateFieldAnswer(dateField, 'invalid-date-string').error?.code).toBe('INVALID_DATE_FORMAT');
      expect(validateFieldAnswer(dateField, '2026-02-31').error?.code).toBe('INVALID_DATE_FORMAT'); // Feb 31 invalid
      expect(validateFieldAnswer(dateField, '2025-11-30').error?.code).toBe('DATE_OUT_OF_RANGE'); // Before min
      expect(validateFieldAnswer(dateField, '2029-01-01').error?.code).toBe('DATE_OUT_OF_RANGE'); // After max
      expect(validateFieldAnswer(dateField, '2027-05-15').valid).toBe(true);
    });

    it('rejects answers that violate word count limits (minWords & maxWords)', () => {
      const essayField: ApplicationFieldSchema = {
        id: 'essay',
        label: 'Statement',
        type: 'rich_text',
        required: true,
        minWords: 5,
        maxWords: 10,
      };

      // 3 words: below minimum 5
      const underWords = validateFieldAnswer(essayField, 'One two three.');
      expect(underWords.valid).toBe(false);
      expect(underWords.error?.code).toBe('MIN_WORDS_NOT_MET');

      // 12 words: above maximum 10
      const overWords = validateFieldAnswer(
        essayField,
        'One two three four five six seven eight nine ten eleven twelve.'
      );
      expect(overWords.valid).toBe(false);
      expect(overWords.error?.code).toBe('WORD_LIMIT_EXCEEDED');

      // 7 words: within [5, 10] range
      const validWords = validateFieldAnswer(
        essayField,
        'This sentence contains exactly seven clean words.'
      );
      expect(validWords.valid).toBe(true);
      expect(validWords.wordCount).toBe(7);
    });
  });

  /* -------------------------------------------------------------------------- */
  /* Acceptance Criterion 3: Validation Errors Identify Safe Field Paths        */
  /* -------------------------------------------------------------------------- */
  describe('3. Safe Field Path Resolution', () => {
    it('produces safe canonical paths for top-level and indexed fields', () => {
      expect(buildSafeFieldPath('personalStatement')).toBe('answers.personalStatement');
      expect(buildSafeFieldPath('focusAreas', 2)).toBe('answers.focusAreas[2]');
    });

    it('sanitizes malicious or path-traversal identifiers', () => {
      expect(buildSafeFieldPath('../attack')).toBe('answers.attack');
      expect(buildSafeFieldPath('<script>alert(1)</script>')).toBe('answers.scriptalert1script');
      expect(buildSafeFieldPath('__proto__')).toBe('answers.__proto__');
    });

    it('attaches safe field paths to every validation error', () => {
      const result = validateApplicationForm(mockApplicationFormSchema, {
        personalStatement: 'Too short',
        gpaValue: 9.9,
      });

      expect(result.valid).toBe(false);
      for (const error of result.errors) {
        expect(error.fieldPath).toMatch(/^answers\.[a-zA-Z0-9_]+(\[\d+\])?$/);
      }
    });
  });

  /* -------------------------------------------------------------------------- */
  /* Rich Text Normalization & Word Counting                                    */
  /* -------------------------------------------------------------------------- */
  describe('4. Rich Text Normalization & Accurate Word Counting', () => {
    it('strips dangerous HTML scripts, iframes, and inline event handlers', () => {
      const malicious =
        '<p>Hello world.</p><script>alert("hacked")</script><iframe src="x"></iframe><div onerror=alert(1)>Text</div>';
      const clean = normalizeRichText(malicious);

      expect(clean).not.toContain('<script>');
      expect(clean).not.toContain('<iframe>');
      expect(clean).not.toContain('onerror=');
      expect(clean).toContain('Hello world.');
      expect(clean).toContain('Text');
    });

    it('collapses excessive whitespace and newlines down to clean paragraphs', () => {
      const bloated = 'Paragraph one.\n\n\n\n\nParagraph two with     many    spaces.';
      const clean = normalizeRichText(bloated);

      expect(clean).toBe('Paragraph one.\n\nParagraph two with many spaces.');
    });

    it('accurately counts words regardless of punctuation, tabs, and line breaks', () => {
      expect(countWords('')).toBe(0);
      expect(countWords('   ')).toBe(0);
      expect(countWords('One')).toBe(1);
      expect(countWords('Word one, word two! Word three?')).toBe(6);
      expect(countWords('Tab\tseparated\twords\nwith\nnewlines')).toBe(5);
    });

    it('validates ISO-8601 calendar dates accurately', () => {
      expect(isValidDateString('2026-10-15')).toBe(true);
      expect(isValidDateString('2026-02-28')).toBe(true);
      expect(isValidDateString('2026-02-29')).toBe(false); // 2026 is not a leap year
      expect(isValidDateString('2026-04-31')).toBe(false); // April has 30 days
      expect(isValidDateString('not-a-date')).toBe(false);
    });
  });
});
