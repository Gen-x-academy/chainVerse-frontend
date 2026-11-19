/**
 * Research expertise taxonomy (CAPSTONE-011).
 *
 * A hierarchy of disciplines, methods and technologies with aliases,
 * proficiency levels, deprecations and stable filter identifiers. The ids are
 * the stable keys: labels and aliases may change, ids never do, so saved
 * filters keep working.
 */

export type TaxonomyKind = "discipline" | "method" | "technology";

export const PROFICIENCY_LEVELS = ["novice", "working", "advanced", "expert"] as const;
export type Proficiency = (typeof PROFICIENCY_LEVELS)[number];

export interface TaxonomyNodeInput {
  /** Stable lowercase slug, e.g. "stats.bayesian". */
  id: string;
  label: string;
  kind: TaxonomyKind;
  parentId?: string;
  aliases?: string[];
  /** Present when the node is deprecated; `replacedBy` is the id to use instead. */
  deprecated?: { replacedBy?: string };
}

export interface TaxonomyIssue {
  id: string;
  message: string;
}

export interface Taxonomy {
  nodes: ReadonlyMap<string, TaxonomyNodeInput>;
  children: ReadonlyMap<string, readonly string[]>;
}

const ID = /^[a-z][a-z0-9]*(\.[a-z0-9][a-z0-9-]*)*$/;

export const normalizeTerm = (text: string): string => text.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");

export type TaxonomyBuild = { ok: true; taxonomy: Taxonomy } | { ok: false; issues: TaxonomyIssue[] };

/** Validate and index a set of nodes. Reports every problem found, not just the first. */
export function buildTaxonomy(inputs: readonly TaxonomyNodeInput[]): TaxonomyBuild {
  const issues: TaxonomyIssue[] = [];
  const nodes = new Map<string, TaxonomyNodeInput>();
  for (const node of inputs) {
    if (!ID.test(node.id)) issues.push({ id: node.id, message: "id must be a lowercase slug" });
    if (nodes.has(node.id)) issues.push({ id: node.id, message: "duplicate id" });
    nodes.set(node.id, node);
  }

  const terms = new Map<string, string>();
  for (const node of nodes.values()) {
    if (node.parentId !== undefined) {
      const parent = nodes.get(node.parentId);
      if (!parent) issues.push({ id: node.id, message: `parent ${node.parentId} does not exist` });
      else if (parent.kind !== node.kind) issues.push({ id: node.id, message: "a node must have the same kind as its parent" });
    }
    if (node.deprecated?.replacedBy !== undefined && !nodes.has(node.deprecated.replacedBy)) {
      issues.push({ id: node.id, message: `replacement ${node.deprecated.replacedBy} does not exist` });
    }
    for (const term of [node.label, ...(node.aliases ?? [])].map(normalizeTerm)) {
      const owner = terms.get(term);
      if (owner !== undefined && owner !== node.id) issues.push({ id: node.id, message: `term "${term}" is already used by ${owner}` });
      terms.set(term, node.id);
    }
  }

  // Cycle check: walking parents from every node must terminate.
  for (const node of nodes.values()) {
    const seen = new Set<string>();
    let cursor: TaxonomyNodeInput | undefined = node;
    while (cursor?.parentId !== undefined) {
      if (seen.has(cursor.id)) {
        issues.push({ id: node.id, message: "parent chain contains a cycle" });
        break;
      }
      seen.add(cursor.id);
      cursor = nodes.get(cursor.parentId);
    }
  }

  if (issues.length > 0) return { ok: false, issues };
  const children = new Map<string, string[]>();
  for (const node of [...nodes.values()].sort((a, b) => a.id.localeCompare(b.id))) {
    if (node.parentId !== undefined) children.set(node.parentId, [...(children.get(node.parentId) ?? []), node.id]);
  }
  return { ok: true, taxonomy: { nodes, children } };
}

/** Terms (labels and aliases) resolve to a node; deprecated nodes resolve to their replacement. */
export function resolveTerm(taxonomy: Taxonomy, text: string): TaxonomyNodeInput | undefined {
  const wanted = normalizeTerm(text);
  for (const node of taxonomy.nodes.values()) {
    if ([node.label, ...(node.aliases ?? [])].some((t) => normalizeTerm(t) === wanted)) return followReplacement(taxonomy, node);
  }
  return undefined;
}

export function followReplacement(taxonomy: Taxonomy, node: TaxonomyNodeInput): TaxonomyNodeInput {
  let current = node;
  const seen = new Set<string>();
  while (current.deprecated?.replacedBy !== undefined && !seen.has(current.id)) {
    seen.add(current.id);
    const next = taxonomy.nodes.get(current.deprecated.replacedBy);
    if (!next) break;
    current = next;
  }
  return current;
}

export function ancestors(taxonomy: Taxonomy, id: string): string[] {
  const out: string[] = [];
  let parent = taxonomy.nodes.get(id)?.parentId;
  while (parent !== undefined) {
    out.push(parent);
    parent = taxonomy.nodes.get(parent)?.parentId;
  }
  return out;
}

export function descendants(taxonomy: Taxonomy, id: string): string[] {
  const out: string[] = [];
  const stack = [...(taxonomy.children.get(id) ?? [])];
  while (stack.length > 0) {
    const next = stack.shift() as string;
    out.push(next);
    stack.push(...(taxonomy.children.get(next) ?? []));
  }
  return out;
}

/** Stable identifier used in saved filters and URLs. */
export const filterId = (id: string): string => `tax:${id}`;

export function parseFilterId(value: string): string | null {
  return value.startsWith("tax:") && ID.test(value.slice(4)) ? value.slice(4) : null;
}

/** A filter on a node matches the node and everything below it. */
export function filterMatches(taxonomy: Taxonomy, filter: string, nodeId: string): boolean {
  const target = parseFilterId(filter);
  if (target === null || !taxonomy.nodes.has(target)) return false;
  return nodeId === target || ancestors(taxonomy, nodeId).includes(target);
}

export const compareProficiency = (a: Proficiency, b: Proficiency): number => PROFICIENCY_LEVELS.indexOf(a) - PROFICIENCY_LEVELS.indexOf(b);
export const meetsProficiency = (have: Proficiency, need: Proficiency): boolean => compareProficiency(have, need) >= 0;
