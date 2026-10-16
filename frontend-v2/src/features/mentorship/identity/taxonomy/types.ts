/**
 * Mentor expertise taxonomy types (closes #1257, MENTOR-010, Identity track).
 *
 * The taxonomy is a versioned tree of skills. A skill has a **stable id** that
 * filters and stored preferences use; its label and aliases are display data
 * that may change. Deprecated skills keep their id and point at a replacement
 * so a stored reference can migrate forward without losing meaning.
 */

export type ProficiencyLevel = 'awareness' | 'working' | 'practitioner' | 'expert';

export const PROFICIENCY_LEVELS: readonly ProficiencyLevel[] = [
  'awareness',
  'working',
  'practitioner',
  'expert',
];

export type ExpertiseNode = {
  /** Stable, opaque id. Filters and stored preferences use this, never the label. */
  id: string;
  slug: string;
  label: string;
  parentId?: string;
  /** Alternate names; normalised before uniqueness is checked. */
  aliases: string[];
  proficiencyLevels: ProficiencyLevel[];
  evidenceRequired: boolean;
  deprecated: boolean;
  /** When deprecated, the id that supersedes this node. */
  replacedBy?: string;
  updatedAt: string;
};

export type TaxonomyErrorCode =
  | 'DUPLICATE_ID'
  | 'DUPLICATE_SLUG'
  | 'DUPLICATE_ALIAS'
  | 'MISSING_PARENT'
  | 'CYCLE'
  | 'DEPRECATED_WITHOUT_REPLACEMENT'
  | 'REPLACEMENT_NOT_FOUND';

export type TaxonomyError = {
  code: TaxonomyErrorCode;
  nodeId: string;
  message: string;
};

/** One auditable change to the taxonomy: which nodes changed and by whom. */
export type TaxonomyChangeRecord = {
  at: string;
  by: string;
  changedNodeIds: string[];
};
