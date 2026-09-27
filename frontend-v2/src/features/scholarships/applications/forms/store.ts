/**
 * Zustand Store for Configurable Application Forms Management.
 */

import { create } from 'zustand';
import { configurableFormService } from './service';
import {
  assertSchemaIsMutable,
  getActiveSectionsAndFields,
  validateConditionalLogic,
} from './domain';
import type {
  ConditionalValidationResult,
  ConfigurableFormField,
  ConfigurableFormSchema,
  FieldCondition,
  FormSection,
  FormVersionBinding,
} from './types';

export interface ConfigurableFormState {
  activeSchema: ConfigurableFormSchema | null;
  mode: 'builder' | 'preview' | 'fill';
  answers: Record<string, unknown>;
  conditionalValidation: ConditionalValidationResult | null;
  selectedSectionId: string | null;
  selectedFieldId: string | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  successMessage: string | null;
  bindingResult: FormVersionBinding | null;

  // Actions
  setMode: (mode: 'builder' | 'preview' | 'fill') => void;
  loadSchema: (schemaId: string) => Promise<void>;
  addSection: (title: string, description?: string) => void;
  updateSection: (sectionId: string, updates: Partial<FormSection>) => void;
  deleteSection: (sectionId: string) => void;
  addField: (sectionId: string, field: Omit<ConfigurableFormField, 'order' | 'sectionId'>) => void;
  updateField: (fieldId: string, updates: Partial<ConfigurableFormField>) => void;
  deleteField: (fieldId: string) => void;
  setFieldCondition: (fieldId: string, condition?: FieldCondition) => void;
  validateConditions: () => ConditionalValidationResult | null;
  publishSchema: (actor: string) => Promise<boolean>;
  forkSchema: (incrementType: 'patch' | 'minor' | 'major', actor: string) => Promise<boolean>;
  setAnswer: (fieldId: string, value: unknown) => void;
  submitAnswers: () => Promise<FormVersionBinding | null>;
  clearMessages: () => void;
}

export const useConfigurableFormStore = create<ConfigurableFormState>((set, get) => ({
  activeSchema: null,
  mode: 'builder',
  answers: {},
  conditionalValidation: null,
  selectedSectionId: null,
  selectedFieldId: null,
  isLoading: false,
  isSaving: false,
  error: null,
  successMessage: null,
  bindingResult: null,

  setMode: (mode) => set({ mode }),
  clearMessages: () => set({ error: null, successMessage: null }),

  loadSchema: async (schemaId: string) => {
    set({ isLoading: true, error: null });
    try {
      const schema = await configurableFormService.getSchema(schemaId);
      const validation = validateConditionalLogic(schema);
      set({
        activeSchema: schema,
        conditionalValidation: validation,
        selectedSectionId: schema.sections[0]?.id || null,
        selectedFieldId: schema.sections[0]?.fields[0]?.id || null,
        isLoading: false,
      });
    } catch (err) {
      set({
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to load form schema.',
      });
    }
  },

  addSection: (title, description) => {
    const { activeSchema } = get();
    if (!activeSchema) return;
    try {
      assertSchemaIsMutable(activeSchema);
    } catch (e) {
      set({ error: (e as Error).message });
      return;
    }

    const newSection: FormSection = {
      id: `sec_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      title,
      description,
      order: activeSchema.sections.length + 1,
      fields: [],
    };

    const updatedSchema = {
      ...activeSchema,
      sections: [...activeSchema.sections, newSection],
    };

    set({
      activeSchema: updatedSchema,
      selectedSectionId: newSection.id,
      conditionalValidation: validateConditionalLogic(updatedSchema),
    });
  },

  updateSection: (sectionId, updates) => {
    const { activeSchema } = get();
    if (!activeSchema) return;
    try {
      assertSchemaIsMutable(activeSchema);
    } catch (e) {
      set({ error: (e as Error).message });
      return;
    }

    const updatedSections = activeSchema.sections.map((s) =>
      s.id === sectionId ? { ...s, ...updates } : s
    );

    const updatedSchema = { ...activeSchema, sections: updatedSections };
    set({
      activeSchema: updatedSchema,
      conditionalValidation: validateConditionalLogic(updatedSchema),
    });
  },

  deleteSection: (sectionId) => {
    const { activeSchema } = get();
    if (!activeSchema) return;
    try {
      assertSchemaIsMutable(activeSchema);
    } catch (e) {
      set({ error: (e as Error).message });
      return;
    }

    const updatedSections = activeSchema.sections.filter((s) => s.id !== sectionId);
    const updatedSchema = { ...activeSchema, sections: updatedSections };
    set({
      activeSchema: updatedSchema,
      selectedSectionId: updatedSections[0]?.id || null,
      conditionalValidation: validateConditionalLogic(updatedSchema),
    });
  },

  addField: (sectionId, fieldData) => {
    const { activeSchema } = get();
    if (!activeSchema) return;
    try {
      assertSchemaIsMutable(activeSchema);
    } catch (e) {
      set({ error: (e as Error).message });
      return;
    }

    const targetSection = activeSchema.sections.find((s) => s.id === sectionId);
    if (!targetSection) return;

    const newField: ConfigurableFormField = {
      ...fieldData,
      sectionId,
      order: targetSection.fields.length + 1,
    };

    const updatedSections = activeSchema.sections.map((s) =>
      s.id === sectionId ? { ...s, fields: [...s.fields, newField] } : s
    );

    const updatedSchema = { ...activeSchema, sections: updatedSections };
    set({
      activeSchema: updatedSchema,
      selectedFieldId: newField.id,
      conditionalValidation: validateConditionalLogic(updatedSchema),
    });
  },

  updateField: (fieldId, updates) => {
    const { activeSchema } = get();
    if (!activeSchema) return;
    try {
      assertSchemaIsMutable(activeSchema);
    } catch (e) {
      set({ error: (e as Error).message });
      return;
    }

    const updatedSections = activeSchema.sections.map((section) => ({
      ...section,
      fields: section.fields.map((f) => (f.id === fieldId ? { ...f, ...updates } : f)),
    }));

    const updatedSchema = { ...activeSchema, sections: updatedSections };
    set({
      activeSchema: updatedSchema,
      conditionalValidation: validateConditionalLogic(updatedSchema),
    });
  },

  deleteField: (fieldId) => {
    const { activeSchema } = get();
    if (!activeSchema) return;
    try {
      assertSchemaIsMutable(activeSchema);
    } catch (e) {
      set({ error: (e as Error).message });
      return;
    }

    const updatedSections = activeSchema.sections.map((section) => ({
      ...section,
      fields: section.fields.filter((f) => f.id !== fieldId),
    }));

    const updatedSchema = { ...activeSchema, sections: updatedSections };
    set({
      activeSchema: updatedSchema,
      conditionalValidation: validateConditionalLogic(updatedSchema),
    });
  },

  setFieldCondition: (fieldId, condition) => {
    get().updateField(fieldId, { conditional: condition });
  },

  validateConditions: () => {
    const { activeSchema } = get();
    if (!activeSchema) return null;
    const res = validateConditionalLogic(activeSchema);
    set({ conditionalValidation: res });
    return res;
  },

  publishSchema: async (actor) => {
    const { activeSchema } = get();
    if (!activeSchema) return false;
    set({ isSaving: true, error: null });

    try {
      const published = await configurableFormService.publishSchema(activeSchema.id, actor);
      set({
        activeSchema: published,
        isSaving: false,
        successMessage: `Form schema v${published.version} published successfully! Schema is now immutable.`,
      });
      return true;
    } catch (err) {
      set({
        isSaving: false,
        error: err instanceof Error ? err.message : 'Failed to publish schema.',
      });
      return false;
    }
  },

  forkSchema: async (incrementType, actor) => {
    const { activeSchema } = get();
    if (!activeSchema) return false;
    set({ isSaving: true, error: null });

    try {
      const forked = await configurableFormService.forkSchema(activeSchema.id, {
        incrementType,
        actor,
      });
      set({
        activeSchema: forked,
        isSaving: false,
        successMessage: `Forked new draft v${forked.version}. You may now safely configure fields.`,
      });
      return true;
    } catch (err) {
      set({
        isSaving: false,
        error: err instanceof Error ? err.message : 'Failed to fork schema.',
      });
      return false;
    }
  },

  setAnswer: (fieldId, value) => {
    set((state) => ({
      answers: { ...state.answers, [fieldId]: value },
    }));
  },

  submitAnswers: async () => {
    const { activeSchema, answers } = get();
    if (!activeSchema) return null;
    set({ isSaving: true, error: null });

    try {
      const binding = await configurableFormService.submitAnswersWithBinding(
        activeSchema.id,
        answers
      );
      set({
        isSaving: false,
        bindingResult: binding,
        successMessage: `Answers locked and tied to form version v${binding.version} (Hash: ${binding.schemaHash}).`,
      });
      return binding;
    } catch (err) {
      set({
        isSaving: false,
        error: err instanceof Error ? err.message : 'Failed to submit answers.',
      });
      return null;
    }
  },
}));
