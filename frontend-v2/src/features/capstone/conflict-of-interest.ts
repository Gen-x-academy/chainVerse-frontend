/**
 * Team conflict of interest checks (CAPSTONE-045).
 *
 * Before a team is activated, and before a reviewer is assigned, relationships
 * between the people involved are compared. Supervision, grading, employment,
 * sponsor, financial and family ties block; a declared relationship needs
 * coordinator review. Results name the kind of tie, never the private detail.
 */

export type RelationshipKind = "supervision" | "grading" | "employment" | "sponsor" | "financial" | "family" | "declared";

export interface Relationship {
  id: string;
  /** The two people the tie connects. Order does not matter. */
  between: [string, string];
  kind: RelationshipKind;
  /** ISO date the tie ended, when it has. Ended ties older than the lookback no longer count. */
  endedOn?: string;
}

export type ConflictSeverity = "blocking" | "review";

export interface Conflict {
  relationshipId: string;
  people: [string, string];
  kind: RelationshipKind;
  severity: ConflictSeverity;
  /** Safe text to show the user. */
  message: string;
}

export const LOOKBACK_YEARS = 3;

const SEVERITY: Record<RelationshipKind, ConflictSeverity> = {
  supervision: "blocking",
  grading: "blocking",
  employment: "blocking",
  sponsor: "blocking",
  financial: "blocking",
  family: "blocking",
  declared: "review",
};

const LABEL: Record<RelationshipKind, string> = {
  supervision: "a supervision tie",
  grading: "a grading tie",
  employment: "an employment tie",
  sponsor: "a sponsor tie",
  financial: "a financial tie",
  family: "a family tie",
  declared: "a declared relationship",
};

function stillCounts(rel: Relationship, now: Date): boolean {
  if (!rel.endedOn) return true;
  const cutoff = new Date(now);
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - LOOKBACK_YEARS);
  return Date.parse(rel.endedOn) >= cutoff.getTime();
}

function between(rel: Relationship, a: string, b: string): boolean {
  return (rel.between[0] === a && rel.between[1] === b) || (rel.between[0] === b && rel.between[1] === a);
}

/** Every conflict among one group of people, such as team members and their supervisor. */
export function findGroupConflicts(people: readonly string[], relationships: readonly Relationship[], now: Date): Conflict[] {
  const unique = [...new Set(people)];
  const found: Conflict[] = [];
  for (let i = 0; i < unique.length; i++) {
    for (let j = i + 1; j < unique.length; j++) {
      const a = unique[i] as string;
      const b = unique[j] as string;
      for (const rel of relationships) {
        if (!between(rel, a, b) || !stillCounts(rel, now)) continue;
        found.push({ relationshipId: rel.id, people: [a, b], kind: rel.kind, severity: SEVERITY[rel.kind], message: `These two people have ${LABEL[rel.kind]}.` });
      }
    }
  }
  return found;
}

/** Conflicts between one reviewer and every person on a team. */
export function findReviewerConflicts(reviewerId: string, teamIds: readonly string[], relationships: readonly Relationship[], now: Date): Conflict[] {
  const found: Conflict[] = [];
  for (const member of new Set(teamIds)) {
    if (member === reviewerId) {
      found.push({ relationshipId: "self", people: [reviewerId, member], kind: "declared", severity: "blocking", message: "A reviewer cannot review their own team." });
      continue;
    }
    for (const rel of relationships) {
      if (between(rel, reviewerId, member) && stillCounts(rel, now)) {
        found.push({ relationshipId: rel.id, people: [reviewerId, member], kind: rel.kind, severity: SEVERITY[rel.kind], message: `The reviewer has ${LABEL[rel.kind]} with a team member.` });
      }
    }
  }
  return found;
}

export interface ConflictDecision {
  status: "clear" | "needs_review" | "blocked";
  conflicts: Conflict[];
}

/** Blocking ties stop the action; review-only ties send it to a coordinator. */
export function decide(conflicts: readonly Conflict[], approvedRelationshipIds: readonly string[] = []): ConflictDecision {
  const open = conflicts.filter((c) => c.severity === "blocking" || !approvedRelationshipIds.includes(c.relationshipId));
  if (open.some((c) => c.severity === "blocking")) return { status: "blocked", conflicts: open };
  if (open.length > 0) return { status: "needs_review", conflicts: open };
  return { status: "clear", conflicts: [] };
}
