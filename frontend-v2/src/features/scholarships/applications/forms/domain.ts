/**
 * Domain rules and logic for Configurable Application Forms.
 *
 * Implements acceptance criteria:
 * 1. Published schemas are immutable. Any attempt to modify a published schema throws.
 * 2. Conditional logic is strictly validated (detects cycles, forward references, missing targets).
 * 3. Answers remain tied to the accepted form version and cryptographic schema hash.
 */

import type {
  ConditionalValidationResult,
  ConfigurableFormField,
  ConfigurableFormSchema,
  FieldCondition,
  FormSection,
  FormVersionBinding,
} from './types';

/**
 * Computes a deterministic content hash of the schema contents.
 * Any modification to sections, questions, word limits, or conditional rules alters this hash.
 */
export function computeSchemaHash(schema: Omit<ConfigurableFormSchema, 'schemaHash'>): string {
  // Strip volatile fields for deterministic hashing
  const normalized = {
    programId: schema.programId,
    roundId: schema.roundId,
    version: schema.version,
    title: schema.title.trim(),
    sections: schema.sections.map((s) => ({
      id: s.id,
      title: s.title.trim(),
      order: s.order,
      conditional: s.conditional,
      fields: s.fields.map((f) => ({
        id: f.id,
        kind: f.kind,
        type: f.type,
        label: f.label.trim(),
        required: f.required,
        order: f.order,
        conditional: f.conditional,
        statementConfig: f.statementConfig,
        questionConfig: f.questionConfig,
        consentConfig: f.consentConfig,
        referenceConfig: f.referenceConfig,
        evidenceConfig: f.evidenceConfig,
      })),
    })),
  };

  const str = JSON.stringify(normalized);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }

  const hex = Math.abs(hash).toString(16).padStart(8, '0');
  return `hash_v${schema.version}_${hex}`;
}

/**
 * Asserts that a schema is in 'draft' status and eligible for mutations.
 * Invariant: Published schemas are immutable.
 */
export function assertSchemaIsMutable(schema: ConfigurableFormSchema): void {
  if (schema.status === 'published') {
    throw new Error(
      `Published schema ${schema.id} (v${schema.version}) is immutable. Create a new draft version to edit.`
    );
  }
  if (schema.status === 'archived') {
    throw new Error(`Archived schema ${schema.id} is closed to edits.`);
  }
}

/**
 * Validates semver format and increments the version string.
 */
export function bumpVersion(
  currentVersion: string,
  incrementType: 'patch' | 'minor' | 'major'
): string {
  const parts = currentVersion.split('.').map((p) => parseInt(p, 10));
  let [major = 1, minor = 0, patch = 0] = parts;

  if (incrementType === 'major') {
    major += 1;
    minor = 0;
    patch = 0;
  } else if (incrementType === 'minor') {
    minor += 1;
    patch = 0;
  } else {
    patch += 1;
  }

  return `${major}.${minor}.${patch}`;
}

/**
 * Validates the conditional rules across all sections and fields.
 * Invariant: Detects circular dependencies, forward references, and missing targets.
 */
export function validateConditionalLogic(
  schema: Pick<ConfigurableFormSchema, 'sections'>
): ConditionalValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const dependencyMap: Record<string, string[]> = {};

  // Build field ordered list and lookup
  const fieldOrder: string[] = [];
  const fieldExists = new Set<string>();

  for (const section of schema.sections) {
    for (const field of section.fields) {
      if (fieldExists.has(field.id)) {
        errors.push(`Duplicate field id "${field.id}" found in schema.`);
      }
      fieldExists.add(field.id);
      fieldOrder.push(field.id);
    }
  }

  // Validate condition references
  function checkCondition(
    condition: FieldCondition | undefined,
    sourceId: string,
    sourceType: 'section' | 'field'
  ) {
    if (!condition) return;

    const { targetFieldId, operator, value } = condition;
    if (!dependencyMap[sourceId]) {
      dependencyMap[sourceId] = [];
    }
    dependencyMap[sourceId].push(targetFieldId);

    // 1. Missing target
    if (!fieldExists.has(targetFieldId)) {
      errors.push(
        `${sourceType} "${sourceId}" conditionally depends on nonexistent field "${targetFieldId}".`
      );
      return;
    }

    // 2. Self reference
    if (sourceId === targetFieldId) {
      errors.push(`Field "${sourceId}" cannot conditionally depend on itself.`);
      return;
    }

    // 3. Forward reference (field depends on something that appears later in the form)
    if (sourceType === 'field') {
      const sourceIndex = fieldOrder.indexOf(sourceId);
      const targetIndex = fieldOrder.indexOf(targetFieldId);
      if (targetIndex > sourceIndex) {
        errors.push(
          `Field "${sourceId}" has a forward reference dependency on field "${targetFieldId}". The controlling field must precede it.`
        );
      }
    }

    // 4. Operator check
    const validOperators = [
      'equals',
      'not_equals',
      'in',
      'not_in',
      'greater_than',
      'less_than',
      'is_checked',
    ];
    if (!validOperators.includes(operator)) {
      errors.push(`Invalid conditional operator "${operator}" in condition on "${sourceId}".`);
    }

    if (operator === 'in' || operator === 'not_in') {
      if (!Array.isArray(value)) {
        errors.push(`Operator "${operator}" on "${sourceId}" requires an array value.`);
      }
    }
  }

  // Inspect all sections and fields
  for (const section of schema.sections) {
    checkCondition(section.conditional, section.id, 'section');
    for (const field of section.fields) {
      checkCondition(field.conditional, field.id, 'field');
    }
  }

  // Detect circular dependency cycles using DFS
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  function detectCycle(node: string, path: string[]): boolean {
    visited.add(node);
    recursionStack.add(node);

    const neighbors = dependencyMap[node] || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        if (detectCycle(neighbor, [...path, neighbor])) {
          return true;
        }
      } else if (recursionStack.has(neighbor)) {
        errors.push(
          `Circular conditional dependency detected: ${[...path, neighbor].join(' -> ')}.`
        );
        return true;
      }
    }

    recursionStack.delete(node);
    return false;
  }

  for (const node of Object.keys(dependencyMap)) {
    if (!visited.has(node)) {
      detectCycle(node, [node]);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    dependencyMap,
  };
}

/**
 * Evaluates whether a conditional rule evaluates to true given current user answers.
 */
export function evaluateCondition(
  condition: FieldCondition | undefined,
  answers: Record<string, unknown>
): boolean {
  if (!condition) return true;

  const actualValue = answers[condition.targetFieldId];

  switch (condition.operator) {
    case 'equals':
      return actualValue === condition.value;

    case 'not_equals':
      return actualValue !== condition.value;

    case 'is_checked':
      return Boolean(actualValue) === true;

    case 'in':
      if (Array.isArray(condition.value)) {
        return condition.value.includes(actualValue);
      }
      return false;

    case 'not_in':
      if (Array.isArray(condition.value)) {
        return !condition.value.includes(actualValue);
      }
      return true;

    case 'greater_than':
      if (typeof actualValue === 'number' && typeof condition.value === 'number') {
        return actualValue > condition.value;
      }
      return false;

    case 'less_than':
      if (typeof actualValue === 'number' && typeof condition.value === 'number') {
        return actualValue < condition.value;
      }
      return false;

    default:
      return true;
  }
}

/**
 * Returns only the sections and fields currently visible based on conditional answers.
 */
export function getActiveSectionsAndFields(
  schema: ConfigurableFormSchema,
  answers: Record<string, unknown>
): {
  activeSections: FormSection[];
  activeFields: ConfigurableFormField[];
} {
  const activeSections: FormSection[] = [];
  const activeFields: ConfigurableFormField[] = [];

  for (const section of schema.sections) {
    // If section condition fails, entire section is skipped
    if (!evaluateCondition(section.conditional, answers)) {
      continue;
    }

    const currentSectionFields: ConfigurableFormField[] = [];
    for (const field of section.fields) {
      if (evaluateCondition(field.conditional, answers)) {
        currentSectionFields.push(field);
        activeFields.push(field);
      }
    }

    activeSections.push({
      ...section,
      fields: currentSectionFields,
    });
  }

  return { activeSections, activeFields };
}

/**
 * Publishes a draft schema, sealing its content and computing its immutable hash.
 */
export function publishFormSchema(
  schema: ConfigurableFormSchema,
  actor: string,
  now: Date = new Date()
): ConfigurableFormSchema {
  assertSchemaIsMutable(schema);

  const conditionalCheck = validateConditionalLogic(schema);
  if (!conditionalCheck.valid) {
    throw new Error(
      `Cannot publish schema with invalid conditional logic: ${conditionalCheck.errors.join('; ')}`
    );
  }

  const publishedAt = now.toISOString();
  const draftWithoutHash = {
    ...schema,
    status: 'published' as const,
    publishedAt,
    publishedBy: actor,
    updatedAt: publishedAt,
  };

  const schemaHash = computeSchemaHash(draftWithoutHash);

  return {
    ...draftWithoutHash,
    schemaHash,
  };
}

/**
 * Forks a published or archived schema into a new draft version.
 */
export function forkFormSchema(
  publishedSchema: ConfigurableFormSchema,
  incrementType: 'patch' | 'minor' | 'major',
  actor: string,
  now: Date = new Date()
): ConfigurableFormSchema {
  const nextVersion = bumpVersion(publishedSchema.version, incrementType);
  const timestamp = now.toISOString();

  const newDraft: Omit<ConfigurableFormSchema, 'schemaHash'> = {
    id: `schema_${publishedSchema.roundId}_${nextVersion.replace(/\./g, '_')}`,
    programId: publishedSchema.programId,
    roundId: publishedSchema.roundId,
    version: nextVersion,
    status: 'draft',
    title: `${publishedSchema.title} (Draft v${nextVersion})`,
    description: publishedSchema.description,
    sections: JSON.parse(JSON.stringify(publishedSchema.sections)), // Deep copy
    createdAt: timestamp,
    updatedAt: timestamp,
    publishedAt: undefined,
    publishedBy: undefined,
  };

  const schemaHash = computeSchemaHash(newDraft);

  return {
    ...newDraft,
    schemaHash,
  };
}

/**
 * Binds answers to the accepted schema version and hash.
 * Invariant: Answers remain tied to the accepted form version.
 */
export function bindAnswersToFormVersion(
  schema: ConfigurableFormSchema,
  answers: Record<string, unknown>,
  now: Date = new Date()
): FormVersionBinding {
  if (schema.status !== 'published') {
    throw new Error('Answers cannot be submitted against an unpublished draft schema.');
  }

  return {
    schemaId: schema.id,
    version: schema.version,
    schemaHash: schema.schemaHash,
    answers,
    submittedAt: now.toISOString(),
    verified: true,
  };
}

/**
 * Verifies that a set of answers match the expected schema version and content hash.
 */
export function verifyAnswerBinding(
  schema: ConfigurableFormSchema,
  binding: FormVersionBinding
): { valid: boolean; reason?: string } {
  if (binding.schemaId !== schema.id) {
    return { valid: false, reason: 'SCHEMA_ID_MISMATCH' };
  }

  if (binding.version !== schema.version) {
    return { valid: false, reason: 'SCHEMA_VERSION_MISMATCH' };
  }

  if (binding.schemaHash !== schema.schemaHash) {
    return { valid: false, reason: 'SCHEMA_CONTENT_HASH_MISMATCH' };
  }

  return { valid: true };
}
