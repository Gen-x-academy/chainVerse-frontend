/**
 * Zustand Store for Application Answers Validation and State Management.
 */

import { create } from 'zustand';
import { applicationValidationService } from './service';
import { validateApplicationForm, validateFieldAnswer } from './domain';
import type {
  ApplicationAnswerValue,
  ApplicationAnswersMap,
  ApplicationFormSchema,
  FieldValidationError,
  FormValidationResult,
  SubmitAnswersResponse,
} from './types';

export interface ApplicationValidationState {
  roundId: string;
  schema: ApplicationFormSchema | null;
  answers: ApplicationAnswersMap;
  errors: Record<string, FieldValidationError>;
  touched: Record<string, boolean>;
  dirty: Record<string, boolean>;
  wordCounts: Record<string, number>;
  isLoading: boolean;
  isSubmitting: boolean;
  submitError: string | null;
  submissionResult: SubmitAnswersResponse | null;

  // Actions
  loadSchema: (roundId: string) => Promise<void>;
  setAnswer: (fieldId: string, value: ApplicationAnswerValue) => void;
  touchField: (fieldId: string) => void;
  validateField: (fieldId: string) => boolean;
  validateAll: () => FormValidationResult | null;
  submit: (studentId: string) => Promise<SubmitAnswersResponse | null>;
  reset: () => void;
}

export const useApplicationValidationStore = create<ApplicationValidationState>((set, get) => ({
  roundId: '',
  schema: null,
  answers: {},
  errors: {},
  touched: {},
  dirty: {},
  wordCounts: {},
  isLoading: false,
  isSubmitting: false,
  submitError: null,
  submissionResult: null,

  loadSchema: async (roundId: string) => {
    set({ isLoading: true, submitError: null });
    try {
      const schema = await applicationValidationService.getFormSchema(roundId);
      const initialAnswers: ApplicationAnswersMap = {};
      for (const field of schema.fields) {
        initialAnswers[field.id] = field.defaultValue ?? (field.type === 'multi_select' ? [] : '');
      }

      set({
        roundId,
        schema,
        answers: initialAnswers,
        isLoading: false,
      });
    } catch (err) {
      set({
        isLoading: false,
        submitError: err instanceof Error ? err.message : 'Failed to load questionnaire.',
      });
    }
  },

  setAnswer: (fieldId, value) => {
    const { schema, answers, touched } = get();
    if (!schema) return;

    const newAnswers = { ...answers, [fieldId]: value };
    const fieldSchema = schema.fields.find((f) => f.id === fieldId);

    if (fieldSchema) {
      const fieldValidation = validateFieldAnswer(fieldSchema, value);
      const newWordCounts = { ...get().wordCounts, [fieldId]: fieldValidation.wordCount };

      set((state) => {
        const nextErrors = { ...state.errors };
        if (!fieldValidation.valid && fieldValidation.error) {
          nextErrors[fieldId] = fieldValidation.error;
        } else {
          delete nextErrors[fieldId];
        }

        return {
          answers: newAnswers,
          dirty: { ...state.dirty, [fieldId]: true },
          errors: nextErrors,
          wordCounts: newWordCounts,
        };
      });
    } else {
      set((state) => ({
        answers: newAnswers,
        dirty: { ...state.dirty, [fieldId]: true },
      }));
    }
  },

  touchField: (fieldId) => {
    set((state) => ({
      touched: { ...state.touched, [fieldId]: true },
    }));
    get().validateField(fieldId);
  },

  validateField: (fieldId) => {
    const { schema, answers } = get();
    if (!schema) return true;

    const fieldSchema = schema.fields.find((f) => f.id === fieldId);
    if (!fieldSchema) return true;

    const res = validateFieldAnswer(fieldSchema, answers[fieldId]);
    set((state) => {
      const nextErrors = { ...state.errors };
      if (!res.valid && res.error) {
        nextErrors[fieldId] = res.error;
      } else {
        delete nextErrors[fieldId];
      }
      return {
        errors: nextErrors,
        wordCounts: { ...state.wordCounts, [fieldId]: res.wordCount },
      };
    });

    return res.valid;
  },

  validateAll: () => {
    const { schema, answers } = get();
    if (!schema) return null;

    const result = validateApplicationForm(schema, answers);

    // Mark all fields as touched
    const allTouched: Record<string, boolean> = {};
    for (const field of schema.fields) {
      allTouched[field.id] = true;
    }

    set({
      errors: result.errorMap,
      touched: allTouched,
      wordCounts: result.wordCounts,
    });

    return result;
  },

  submit: async (studentId: string) => {
    const { schema, answers, roundId } = get();
    if (!schema) return null;

    const validation = get().validateAll();
    if (!validation || !validation.valid) {
      set({ submitError: 'Please correct the validation errors before submitting.' });
      return null;
    }

    set({ isSubmitting: true, submitError: null });
    try {
      const response = await applicationValidationService.submitAnswers({
        roundId,
        studentId,
        answers: validation.normalizedAnswers,
        clientValidated: true,
      });

      set({
        isSubmitting: false,
        submissionResult: response,
      });
      return response;
    } catch (err) {
      set({
        isSubmitting: false,
        submitError: err instanceof Error ? err.message : 'Submission failed.',
      });
      return null;
    }
  },

  reset: () => {
    set({
      answers: {},
      errors: {},
      touched: {},
      dirty: {},
      wordCounts: {},
      submitError: null,
      submissionResult: null,
    });
  },
}));
