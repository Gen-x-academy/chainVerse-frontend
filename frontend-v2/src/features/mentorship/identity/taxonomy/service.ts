/**
 * Mentor expertise taxonomy operations (closes #1257, MENTOR-010).
 *
 * - **Aliases are normalised and unique.** `normalizeAlias` folds case,
 *   whitespace, and punctuation; `buildAliasIndex` refuses a duplicate.
 * - **Filters use stable ids.** `resolveExpertiseId` maps any label, alias, or
 *   slug to the node id; UI never filters on the display label.
 * - **Deprecated skills migrate safely.** `migrateExpertiseId` follows the
 *   `replacedBy` chain to a live node, so a stored reference follows the
 *   rename instead of becoming a dead id.
 * - **Changes are audited.** `auditTaxonomyChange` records the changed node ids.
 */

import { apiClient } from '@/src/lib/api-client';
import type {
  ExpertiseNode,
  ProficiencyLevel,
  TaxonomyChangeRecord,
  TaxonomyError,
  TaxonomyErrorCode,
} from './types';

/** Folds case, trims, collapses internal whitespace, and strips edge punctuation. */
export function normalizeAlias(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, '');
}

/** The normalised strings a node can be addressed by. */
function searchKeys(node: ExpertiseNode): string[] {
  return [node.slug, node.label, ...node.aliases]
    .map(normalizeAlias)
    .filter((key) => key.length > 0);
}

/**
 * Maps every normalised label/alias/slug to its node id. Throws the first
 * duplicate so a collision cannot silently shadow a skill.
 */
export function buildAliasIndex(nodes: readonly ExpertiseNode[]): Map<string, string> {
  const index = new Map<string, string>();
  for (const node of nodes) {
    for (const key of searchKeys(node)) {
      const existing = index.get(key);
      if (existing && existing !== node.id) {
        throw new Error(`Duplicate taxonomy alias "${key}" for ${node.id} and ${existing}.`);
      }
      index.set(key, node.id);
    }
  }
  return index;
}

export function resolveExpertiseId(
  input: string,
  nodes: readonly ExpertiseNode[],
): string | undefined {
  const key = normalizeAlias(input);
  if (!key) return undefined;
  return buildAliasIndex(nodes).get(key);
}

function error(code: TaxonomyErrorCode, nodeId: string, message: string): TaxonomyError {
  return { code, nodeId, message };
}

/** Detects cycles by walking each node's parent chain. */
function hasCycle(nodes: readonly ExpertiseNode[]): string | undefined {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  for (const node of nodes) {
    const seen = new Set<string>([node.id]);
    let parentId = node.parentId;
    while (parentId) {
      if (seen.has(parentId)) return node.id;
      seen.add(parentId);
      parentId = byId.get(parentId)?.parentId;
    }
  }
  return undefined;
}

export function validateTaxonomy(nodes: readonly ExpertiseNode[]): TaxonomyError[] {
  const errors: TaxonomyError[] = [];
  const ids = new Set<string>();
  const slugs = new Set<string>();
  const aliases = new Map<string, string>();

  for (const node of nodes) {
    if (ids.has(node.id)) {
      errors.push(error('DUPLICATE_ID', node.id, `Duplicate node id "${node.id}".`));
    }
    ids.add(node.id);

    const slug = normalizeAlias(node.slug);
    if (slugs.has(slug)) {
      errors.push(error('DUPLICATE_SLUG', node.id, `Duplicate slug "${node.slug}".`));
    }
    slugs.add(slug);

    for (const key of searchKeys(node)) {
      const owner = aliases.get(key);
      if (owner && owner !== node.id) {
        errors.push(
          error('DUPLICATE_ALIAS', node.id, `Alias "${key}" already belongs to ${owner}.`),
        );
      }
      aliases.set(key, node.id);
    }
  }

  const byId = new Map(nodes.map((node) => [node.id, node]));
  for (const node of nodes) {
    if (node.parentId && !byId.has(node.parentId)) {
      errors.push(error('MISSING_PARENT', node.id, `Parent "${node.parentId}" does not exist.`));
    }
    if (node.deprecated) {
      if (!node.replacedBy) {
        errors.push(
          error('DEPRECATED_WITHOUT_REPLACEMENT', node.id, 'A deprecated skill needs a replacement id.'),
        );
      } else if (!byId.has(node.replacedBy)) {
        errors.push(
          error('REPLACEMENT_NOT_FOUND', node.id, `Replacement "${node.replacedBy}" does not exist.`),
        );
      }
    }
  }

  const cycle = hasCycle(nodes);
  if (cycle) {
    errors.push(error('CYCLE', cycle, `Parent chain of "${cycle}" contains a cycle.`));
  }

  return errors;
}

/** Marks a node deprecated and pointing at its replacement. */
export function deprecateExpertise(
  node: ExpertiseNode,
  replacementId: string,
  updatedAt: string,
): ExpertiseNode {
  return { ...node, deprecated: true, replacedBy: replacementId, updatedAt };
}

/**
 * Follows `replacedBy` to a live node. A reference to a live node is returned
 * unchanged; a reference to a deprecated node migrates to its replacement.
 */
export function migrateExpertiseId(
  id: string,
  nodes: readonly ExpertiseNode[],
): string | undefined {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  let current = byId.get(id);
  if (!current) return undefined;
  const seen = new Set<string>([id]);
  while (current.deprecated && current.replacedBy) {
    if (seen.has(current.replacedBy)) return undefined;
    seen.add(current.replacedBy);
    const next = byId.get(current.replacedBy);
    if (!next) return undefined;
    current = next;
  }
  return current.id;
}

export function auditTaxonomyChange(
  previous: readonly ExpertiseNode[],
  next: readonly ExpertiseNode[],
  editorId: string,
  now: Date = new Date(),
): TaxonomyChangeRecord {
  const before = new Map(previous.map((node) => [node.id, JSON.stringify(node)]));
  const after = new Map(next.map((node) => [node.id, JSON.stringify(node)]));
  const ids = new Set([...before.keys(), ...after.keys()]);
  const changedNodeIds: string[] = [];
  for (const id of ids) {
    if (before.get(id) !== after.get(id)) changedNodeIds.push(id);
  }
  return { at: now.toISOString(), by: editorId, changedNodeIds: changedNodeIds.sort() };
}

export function proficiencyLevelsFor(
  node: ExpertiseNode,
): ProficiencyLevel[] {
  return [...node.proficiencyLevels];
}

const TAXONOMY_PATH = '/mentorship/expertise-taxonomy';

export const mentorshipTaxonomyService = {
  list: (): Promise<ExpertiseNode[]> => apiClient.get<ExpertiseNode[]>(TAXONOMY_PATH),

  upsert: (node: ExpertiseNode): Promise<ExpertiseNode> =>
    apiClient.put<ExpertiseNode>(`${TAXONOMY_PATH}/${encodeURIComponent(node.id)}`, node),

  deprecate: (nodeId: string, replacementId: string): Promise<ExpertiseNode> =>
    apiClient.post<ExpertiseNode>(`${TAXONOMY_PATH}/${encodeURIComponent(nodeId)}/deprecate`, {
      replacementId,
    }),

  changes: (): Promise<TaxonomyChangeRecord[]> =>
    apiClient.get<TaxonomyChangeRecord[]>(`${TAXONOMY_PATH}/changes`),
};
