/**
 * Pure Domain Logic for Application Answers Validation and Word Limits.
 *
 * Implements:
 * 1. Safe field path generation (strictly sanitized identifiers).
 * 2. Normalized rich text parsing (sanitizing XSS, stripping injection tags, normalizing unicode & whitespace).
 * 3. Accurate word counting.
 * 4. Comprehensive field validation for required, type, option set, length, date, and word limit constraints.
 * 5. Deterministic form validation guaranteeing client and server agreement.
 */

import type {
  ApplicationAnswerValue,
  ApplicationAnswersMap,
  ApplicationFieldSchema,
  ApplicationFormSchema,
  FieldValidationError,
  FormValidationResult,
  ValidationErrorCode,
} from './types';

/**
 * Generates a canonical, safe field path.
 * Strips any characters that are not alphanumeric or underscore to prevent path traversal or injection.
 */
export function buildSafeFieldPath(fieldId: string, subIndex?: number): string {
  const sanitized = fieldId.replace(/[^a-zA-Z0-9_]/g, '');
  const base = `answers.${sanitized || 'unknown'}`;
  return subIndex !== undefined ? `${base}[${Math.max(0, Math.floor(subIndex))}]` : base;
}

/**
 * Normalizes rich text content:
 * - Strips dangerous HTML/script tags (<script>, <iframe>, <object>, etc.)
 * - Removes inline execution attributes (onerror, onload, onclick, javascript:)
 * - Replaces paragraph/break tags with canonical line breaks
 * - Normalizes Unicode using NFKC
 * - Strips non-printable control characters except standard tabs and newlines
 * - Collapses excessive newlines (max 2 consecutive)
 */
export function normalizeRichText(rawText: string): string {
  if (!rawText) return '';

  let text = String(rawText);

  // Strip script, style, iframe, object, embed, svg tags and their content
  text = text.replace(/<(script|style|iframe|object|embed|svg)[^>]*>[\s\S]*?<\/\1>/gi, '');

  // Strip all remaining HTML tags
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<\/(p|div|h[1-6]|li)>/gi, '\n');
  text = text.replace(/<[^>]+>/g, '');

  // Strip javascript: pseudo-protocol strings and inline event handlers
  text = text.replace(/javascript\s*:/gi, '');
  text = text.replace(/on\w+\s*=/gi, '');

  // Unicode normalization (NFKC decomposes compatibility chars into canonical ones)
  try {
    text = text.normalize('NFKC');
  } catch {
    // Fallback if environment lacks normalization
  }

  // Strip non-printable ASCII control characters (keeping \t = 9, \n = 10, \r = 13)
  text = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // Normalize windows newlines
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Collapse 3+ newlines down to 2
  text = text.replace(/\n{3,}/g, '\n\n');

  // Normalize excessive inline whitespace (spaces/tabs)
  text = text.replace(/[ \t]{2,}/g, ' ');

  return text.trim();
}

/**
 * Accurately calculates word count from normalized text.
 * Splits on standard whitespace boundaries.
 */
export function countWords(text: string): number {
  if (!text) return 0;
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

/**
 * Helper to validate ISO-8601 date string (YYYY-MM-DD or full ISO).
 */
export function isValidDateString(dateStr: string): boolean {
  if (typeof dateStr !== 'string' || !dateStr.trim()) return false;
  // Match YYYY-MM-DD
  const regex = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])(?:T.*)?$/;
  if (!regex.test(dateStr.trim())) return false;

  const timestamp = Date.parse(dateStr);
  if (Number.isNaN(timestamp)) return false;

  // Verify date components match (e.g. reject Feb 31)
  const dateObj = new Date(timestamp);
  const parts = dateStr.split('T')[0].split('-');
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);

  return (
    dateObj.getUTCFullYear() === year &&
    dateObj.getUTCMonth() === month &&
    dateObj.getUTCDate() === day
  );
}

/**
 * Validates a single application field answer against its schema definition.
 */
export function validateFieldAnswer(
  schema: ApplicationFieldSchema,
  rawValue: ApplicationAnswerValue
): {
  valid: boolean;
  normalizedValue: ApplicationAnswerValue;
  wordCount: number;
  error?: FieldValidationError;
} {
  const safePath = buildSafeFieldPath(schema.id);

  // 1. Required field check
  const isValueEmpty =
    rawValue === undefined ||
    rawValue === null ||
    (typeof rawValue === 'string' && rawValue.trim() === '') ||
    (Array.isArray(rawValue) && rawValue.length === 0);

  if (schema.required && isValueEmpty) {
    return {
      valid: false,
      normalizedValue: rawValue,
      wordCount: 0,
      error: {
        fieldId: schema.id,
        fieldPath: safePath,
        code: 'REQUIRED_FIELD_MISSING',
        message: `${schema.label} is required.`,
        safeValue: null,
      },
    };
  }

  // If not required and empty, valid immediately
  if (isValueEmpty) {
    return {
      valid: true,
      normalizedValue: null,
      wordCount: 0,
    };
  }

  // 2. Type-specific validation
  switch (schema.type) {
    case 'text': {
      if (typeof rawValue !== 'string') {
        return {
          valid: false,
          normalizedValue: String(rawValue),
          wordCount: 0,
          error: {
            fieldId: schema.id,
            fieldPath: safePath,
            code: 'INVALID_TYPE',
            message: `${schema.label} must be a text value.`,
            safeValue: String(rawValue).slice(0, 100),
          },
        };
      }

      const normalized = rawValue.trim();
      const words = countWords(normalized);

      if (schema.minLength !== undefined && normalized.length < schema.minLength) {
        return {
          valid: false,
          normalizedValue: normalized,
          wordCount: words,
          error: {
            fieldId: schema.id,
            fieldPath: safePath,
            code: 'MIN_LENGTH_NOT_MET',
            message: `${schema.label} must be at least ${schema.minLength} characters (currently ${normalized.length}).`,
            safeValue: normalized.slice(0, 50),
          },
        };
      }

      if (schema.maxLength !== undefined && normalized.length > schema.maxLength) {
        return {
          valid: false,
          normalizedValue: normalized,
          wordCount: words,
          error: {
            fieldId: schema.id,
            fieldPath: safePath,
            code: 'MAX_LENGTH_EXCEEDED',
            message: `${schema.label} cannot exceed ${schema.maxLength} characters (currently ${normalized.length}).`,
            safeValue: normalized.slice(0, 50),
          },
        };
      }

      if (schema.minWords !== undefined && words < schema.minWords) {
        return {
          valid: false,
          normalizedValue: normalized,
          wordCount: words,
          error: {
            fieldId: schema.id,
            fieldPath: safePath,
            code: 'MIN_WORDS_NOT_MET',
            message: `${schema.label} requires at least ${schema.minWords} words (currently ${words}).`,
            safeValue: words,
          },
        };
      }

      if (schema.maxWords !== undefined && words > schema.maxWords) {
        return {
          valid: false,
          normalizedValue: normalized,
          wordCount: words,
          error: {
            fieldId: schema.id,
            fieldPath: safePath,
            code: 'WORD_LIMIT_EXCEEDED',
            message: `${schema.label} cannot exceed ${schema.maxWords} words (currently ${words}).`,
            safeValue: words,
          },
        };
      }

      return {
        valid: true,
        normalizedValue: normalized,
        wordCount: words,
      };
    }

    case 'rich_text': {
      if (typeof rawValue !== 'string') {
        return {
          valid: false,
          normalizedValue: '',
          wordCount: 0,
          error: {
            fieldId: schema.id,
            fieldPath: safePath,
            code: 'INVALID_TYPE',
            message: `${schema.label} must be text.`,
          },
        };
      }

      const normalized = normalizeRichText(rawValue);
      const words = countWords(normalized);

      if (schema.required && normalized.length === 0) {
        return {
          valid: false,
          normalizedValue: '',
          wordCount: 0,
          error: {
            fieldId: schema.id,
            fieldPath: safePath,
            code: 'REQUIRED_FIELD_MISSING',
            message: `${schema.label} is required.`,
          },
        };
      }

      if (schema.minLength !== undefined && normalized.length < schema.minLength) {
        return {
          valid: false,
          normalizedValue: normalized,
          wordCount: words,
          error: {
            fieldId: schema.id,
            fieldPath: safePath,
            code: 'MIN_LENGTH_NOT_MET',
            message: `${schema.label} must be at least ${schema.minLength} characters (currently ${normalized.length}).`,
            safeValue: normalized.slice(0, 50),
          },
        };
      }

      if (schema.maxLength !== undefined && normalized.length > schema.maxLength) {
        return {
          valid: false,
          normalizedValue: normalized,
          wordCount: words,
          error: {
            fieldId: schema.id,
            fieldPath: safePath,
            code: 'MAX_LENGTH_EXCEEDED',
            message: `${schema.label} cannot exceed ${schema.maxLength} characters (currently ${normalized.length}).`,
            safeValue: normalized.slice(0, 50),
          },
        };
      }

      if (schema.minWords !== undefined && words < schema.minWords) {
        return {
          valid: false,
          normalizedValue: normalized,
          wordCount: words,
          error: {
            fieldId: schema.id,
            fieldPath: safePath,
            code: 'MIN_WORDS_NOT_MET',
            message: `${schema.label} requires at least ${schema.minWords} words (currently ${words}).`,
            safeValue: words,
          },
        };
      }

      if (schema.maxWords !== undefined && words > schema.maxWords) {
        return {
          valid: false,
          normalizedValue: normalized,
          wordCount: words,
          error: {
            fieldId: schema.id,
            fieldPath: safePath,
            code: 'WORD_LIMIT_EXCEEDED',
            message: `${schema.label} exceeds word limit of ${schema.maxWords} words (currently ${words}).`,
            safeValue: words,
          },
        };
      }

      return {
        valid: true,
        normalizedValue: normalized,
        wordCount: words,
      };
    }

    case 'number': {
      let numVal: number;
      if (typeof rawValue === 'number') {
        numVal = rawValue;
      } else if (typeof rawValue === 'string' && rawValue.trim() !== '') {
        numVal = Number(rawValue.trim());
      } else {
        return {
          valid: false,
          normalizedValue: rawValue,
          wordCount: 0,
          error: {
            fieldId: schema.id,
            fieldPath: safePath,
            code: 'INVALID_TYPE',
            message: `${schema.label} must be a valid number.`,
          },
        };
      }

      if (Number.isNaN(numVal) || !Number.isFinite(numVal)) {
        return {
          valid: false,
          normalizedValue: null,
          wordCount: 0,
          error: {
            fieldId: schema.id,
            fieldPath: safePath,
            code: 'INVALID_TYPE',
            message: `${schema.label} must be a valid finite number.`,
          },
        };
      }

      if (schema.min !== undefined && numVal < schema.min) {
        return {
          valid: false,
          normalizedValue: numVal,
          wordCount: 0,
          error: {
            fieldId: schema.id,
            fieldPath: safePath,
            code: 'MIN_VALUE_NOT_MET',
            message: `${schema.label} must be at least ${schema.min} (currently ${numVal}).`,
            safeValue: numVal,
          },
        };
      }

      if (schema.max !== undefined && numVal > schema.max) {
        return {
          valid: false,
          normalizedValue: numVal,
          wordCount: 0,
          error: {
            fieldId: schema.id,
            fieldPath: safePath,
            code: 'MAX_VALUE_EXCEEDED',
            message: `${schema.label} cannot exceed ${schema.max} (currently ${numVal}).`,
            safeValue: numVal,
          },
        };
      }

      return {
        valid: true,
        normalizedValue: numVal,
        wordCount: 0,
      };
    }

    case 'currency': {
      let centsVal: number;
      if (typeof rawValue === 'number') {
        centsVal = Math.round(rawValue);
      } else if (typeof rawValue === 'string' && rawValue.trim() !== '') {
        // Remove currency symbols and parse
        const clean = rawValue.replace(/[^0-9.-]/g, '');
        const parsed = parseFloat(clean);
        // If passed as dollars string like "50.00", convert to cents if decimal present, else treat as minor units
        if (clean.includes('.')) {
          centsVal = Math.round(parsed * 100);
        } else {
          centsVal = Math.round(parsed);
        }
      } else {
        return {
          valid: false,
          normalizedValue: rawValue,
          wordCount: 0,
          error: {
            fieldId: schema.id,
            fieldPath: safePath,
            code: 'INVALID_TYPE',
            message: `${schema.label} must be a valid monetary amount.`,
          },
        };
      }

      if (Number.isNaN(centsVal) || !Number.isFinite(centsVal) || centsVal < 0) {
        return {
          valid: false,
          normalizedValue: null,
          wordCount: 0,
          error: {
            fieldId: schema.id,
            fieldPath: safePath,
            code: 'MIN_VALUE_NOT_MET',
            message: `${schema.label} must be a positive currency amount.`,
          },
        };
      }

      if (schema.min !== undefined && centsVal < schema.min) {
        return {
          valid: false,
          normalizedValue: centsVal,
          wordCount: 0,
          error: {
            fieldId: schema.id,
            fieldPath: safePath,
            code: 'MIN_VALUE_NOT_MET',
            message: `${schema.label} must be at least $${(schema.min / 100).toFixed(2)}.`,
            safeValue: centsVal,
          },
        };
      }

      if (schema.max !== undefined && centsVal > schema.max) {
        return {
          valid: false,
          normalizedValue: centsVal,
          wordCount: 0,
          error: {
            fieldId: schema.id,
            fieldPath: safePath,
            code: 'MAX_VALUE_EXCEEDED',
            message: `${schema.label} cannot exceed $${(schema.max / 100).toFixed(2)}.`,
            safeValue: centsVal,
          },
        };
      }

      return {
        valid: true,
        normalizedValue: centsVal,
        wordCount: 0,
      };
    }

    case 'date': {
      if (typeof rawValue !== 'string') {
        return {
          valid: false,
          normalizedValue: rawValue,
          wordCount: 0,
          error: {
            fieldId: schema.id,
            fieldPath: safePath,
            code: 'INVALID_DATE_FORMAT',
            message: `${schema.label} must be a valid date string.`,
          },
        };
      }

      const dateStr = rawValue.trim();
      if (!isValidDateString(dateStr)) {
        return {
          valid: false,
          normalizedValue: dateStr,
          wordCount: 0,
          error: {
            fieldId: schema.id,
            fieldPath: safePath,
            code: 'INVALID_DATE_FORMAT',
            message: `${schema.label} must be a valid calendar date in YYYY-MM-DD format.`,
            safeValue: dateStr.slice(0, 20),
          },
        };
      }

      const dateIso = new Date(dateStr).toISOString().split('T')[0];

      if (schema.minDate && dateIso < schema.minDate) {
        return {
          valid: false,
          normalizedValue: dateIso,
          wordCount: 0,
          error: {
            fieldId: schema.id,
            fieldPath: safePath,
            code: 'DATE_OUT_OF_RANGE',
            message: `${schema.label} cannot be earlier than ${schema.minDate}.`,
            safeValue: dateIso,
          },
        };
      }

      if (schema.maxDate && dateIso > schema.maxDate) {
        return {
          valid: false,
          normalizedValue: dateIso,
          wordCount: 0,
          error: {
            fieldId: schema.id,
            fieldPath: safePath,
            code: 'DATE_OUT_OF_RANGE',
            message: `${schema.label} cannot be later than ${schema.maxDate}.`,
            safeValue: dateIso,
          },
        };
      }

      return {
        valid: true,
        normalizedValue: dateIso,
        wordCount: 0,
      };
    }

    case 'boolean': {
      const boolVal =
        typeof rawValue === 'boolean'
          ? rawValue
          : rawValue === 'true' || rawValue === '1';

      if (schema.required && boolVal !== true) {
        return {
          valid: false,
          normalizedValue: false,
          wordCount: 0,
          error: {
            fieldId: schema.id,
            fieldPath: safePath,
            code: 'REQUIRED_FIELD_MISSING',
            message: `You must confirm and check ${schema.label}.`,
          },
        };
      }

      return {
        valid: true,
        normalizedValue: boolVal,
        wordCount: 0,
      };
    }

    case 'single_select': {
      if (typeof rawValue !== 'string') {
        return {
          valid: false,
          normalizedValue: rawValue,
          wordCount: 0,
          error: {
            fieldId: schema.id,
            fieldPath: safePath,
            code: 'INVALID_TYPE',
            message: `Please select an option for ${schema.label}.`,
          },
        };
      }

      const selected = rawValue.trim();
      const validOptions = (schema.options ?? []).map((o) => o.value);

      if (!validOptions.includes(selected)) {
        return {
          valid: false,
          normalizedValue: selected,
          wordCount: 0,
          error: {
            fieldId: schema.id,
            fieldPath: safePath,
            code: 'INVALID_OPTION',
            message: `Selected option for ${schema.label} is invalid.`,
            safeValue: selected.slice(0, 30),
          },
        };
      }

      return {
        valid: true,
        normalizedValue: selected,
        wordCount: 0,
      };
    }

    case 'multi_select': {
      if (!Array.isArray(rawValue)) {
        return {
          valid: false,
          normalizedValue: [],
          wordCount: 0,
          error: {
            fieldId: schema.id,
            fieldPath: safePath,
            code: 'INVALID_TYPE',
            message: `${schema.label} must be a list of selections.`,
          },
        };
      }

      const validOptions = new Set((schema.options ?? []).map((o) => o.value));
      const cleanSelections: string[] = [];

      for (let i = 0; i < rawValue.length; i++) {
        const item = String(rawValue[i]).trim();
        if (!validOptions.has(item)) {
          return {
            valid: false,
            normalizedValue: rawValue,
            wordCount: 0,
            error: {
              fieldId: schema.id,
              fieldPath: buildSafeFieldPath(schema.id, i),
              code: 'INVALID_OPTION',
              message: `Option "${item.slice(0, 20)}" is not a valid selection for ${schema.label}.`,
              safeValue: item.slice(0, 30),
            },
          };
        }
        cleanSelections.push(item);
      }

      return {
        valid: true,
        normalizedValue: cleanSelections,
        wordCount: 0,
      };
    }

    default:
      return {
        valid: true,
        normalizedValue: rawValue,
        wordCount: 0,
      };
  }
}

/**
 * Validates all fields of an application form schema against supplied answers.
 * Guarantees parity between client UI evaluation and server enforcement.
 */
export function validateApplicationForm(
  formSchema: ApplicationFormSchema,
  answers: ApplicationAnswersMap
): FormValidationResult {
  const errors: FieldValidationError[] = [];
  const errorMap: Record<string, FieldValidationError> = {};
  const normalizedAnswers: ApplicationAnswersMap = {};
  const wordCounts: Record<string, number> = {};

  for (const field of formSchema.fields) {
    const rawVal = answers[field.id];
    const result = validateFieldAnswer(field, rawVal);

    normalizedAnswers[field.id] = result.normalizedValue;
    wordCounts[field.id] = result.wordCount;

    if (!result.valid && result.error) {
      errors.push(result.error);
      errorMap[field.id] = result.error;
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    errorMap,
    normalizedAnswers,
    wordCounts,
  };
}
