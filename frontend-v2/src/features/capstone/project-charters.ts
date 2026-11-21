/**
 * Project charters (CAPSTONE-049).
 *
 * A charter captures scope, outcomes, roles, governance, communication,
 * timeline, funding, IP, data, publication and conduct rules, plus the term
 * versions the team accepted. A charter is a draft until it is sealed; a
 * sealed charter is immutable and has a stable content hash.
 */

export const CHARTER_SECTIONS = ["scope", "outcomes", "roles", "governance", "communication", "timeline", "funding", "intellectualProperty", "data", "publication", "conduct"] as const;
export type CharterSection = (typeof CHARTER_SECTIONS)[number];

export interface AcceptedTerm {
  /** For example "code-of-conduct" or "ip-policy". */
  termId: string;
  version: number;
}

export interface Charter {
  id: string;
  projectId: string;
  version: number;
  status: "draft" | "sealed";
  sections: Record<CharterSection, string>;
  acceptedTerms: AcceptedTerm[];
  sealedAt?: string;
}

export interface CharterIssue {
  path: string;
  message: string;
}

export const REQUIRED_TERM_IDS = ["code-of-conduct", "ip-policy", "data-policy"] as const;
export const MIN_SECTION_LENGTH = 20;
export const MAX_SECTION_LENGTH = 5000;

export function emptyCharter(id: string, projectId: string): Charter {
  const sections = Object.fromEntries(CHARTER_SECTIONS.map((s) => [s, ""])) as Record<CharterSection, string>;
  return { id, projectId, version: 1, status: "draft", sections, acceptedTerms: [] };
}

/** Draft problems: sections that are present must be sensible, but blanks are allowed while drafting. */
export function validateDraft(charter: Charter): CharterIssue[] {
  const issues: CharterIssue[] = [];
  for (const s of CHARTER_SECTIONS) {
    const text = charter.sections[s];
    if (text.length > MAX_SECTION_LENGTH) issues.push({ path: `sections.${s}`, message: `keep this section under ${MAX_SECTION_LENGTH} characters` });
  }
  const seen = new Set<string>();
  charter.acceptedTerms.forEach((t, i) => {
    if (seen.has(t.termId)) issues.push({ path: `acceptedTerms[${i}]`, message: "each term can be listed once" });
    seen.add(t.termId);
    if (!Number.isInteger(t.version) || t.version < 1) issues.push({ path: `acceptedTerms[${i}].version`, message: "the term version must be a whole number from 1" });
  });
  return issues;
}

/** Everything that must be true before sealing. */
export function validateForSeal(charter: Charter, currentTermVersions: Readonly<Record<string, number>>): CharterIssue[] {
  const issues = validateDraft(charter);
  for (const s of CHARTER_SECTIONS) {
    if (charter.sections[s].trim().length < MIN_SECTION_LENGTH) issues.push({ path: `sections.${s}`, message: `write at least ${MIN_SECTION_LENGTH} characters` });
  }
  for (const id of REQUIRED_TERM_IDS) {
    const accepted = charter.acceptedTerms.find((t) => t.termId === id);
    const current = currentTermVersions[id];
    if (!accepted) issues.push({ path: "acceptedTerms", message: `accept the ${id} terms` });
    else if (current !== undefined && accepted.version !== current) issues.push({ path: "acceptedTerms", message: `the ${id} terms changed, accept the current version` });
  }
  return issues;
}

export function updateSection(charter: Charter, section: CharterSection, text: string): Charter {
  if (charter.status === "sealed") return charter;
  return { ...charter, sections: { ...charter.sections, [section]: text } };
}

export function acceptTerm(charter: Charter, term: AcceptedTerm): Charter {
  if (charter.status === "sealed") return charter;
  const rest = charter.acceptedTerms.filter((t) => t.termId !== term.termId);
  return { ...charter, acceptedTerms: [...rest, term].sort((a, b) => a.termId.localeCompare(b.termId)) };
}

/** Text that is hashed: fixed section order and sorted terms, so equal charters hash equally. */
export function canonicalText(charter: Charter): string {
  const parts = CHARTER_SECTIONS.map((s) => `${s}=${charter.sections[s].trim()}`);
  const terms = [...charter.acceptedTerms].sort((a, b) => a.termId.localeCompare(b.termId)).map((t) => `${t.termId}@${t.version}`);
  return [`charter=${charter.id}`, `project=${charter.projectId}`, `version=${charter.version}`, ...parts, `terms=${terms.join(",")}`].join("\n");
}

/** SHA-256 of the canonical text, as lowercase hex. */
export async function charterHash(charter: Charter): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalText(charter));
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Seal a valid charter. Returns the issues instead when it is not ready. */
export function sealCharter(charter: Charter, currentTermVersions: Readonly<Record<string, number>>, sealedAt: string): { charter: Charter; issues: CharterIssue[] } {
  if (charter.status === "sealed") return { charter, issues: [] };
  const issues = validateForSeal(charter, currentTermVersions);
  if (issues.length > 0) return { charter, issues };
  return { charter: { ...charter, status: "sealed", sealedAt }, issues };
}

/** The sections that differ between two charters, for a review screen. */
export function changedSections(a: Charter, b: Charter): CharterSection[] {
  return CHARTER_SECTIONS.filter((s) => a.sections[s].trim() !== b.sections[s].trim());
}
