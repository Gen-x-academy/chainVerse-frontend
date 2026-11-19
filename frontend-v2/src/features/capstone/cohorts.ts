/**
 * Call cohorts and academic periods (CAPSTONE-019).
 *
 * Group projects by cohort, term, program and intake dates with a capacity,
 * coordinators and cohort-specific deadlines. Dates are plain YYYY-MM-DD
 * strings (no timezone arithmetic), compared lexicographically.
 */

export type Term = "spring" | "summer" | "fall" | "winter";

export interface CohortDeadlines {
  applications: string;
  teamFormation: string;
  midReview: string;
  finalSubmission: string;
}

export interface CohortInput {
  id: string;
  program: string;
  term: Term;
  year: number;
  intakeOpensOn: string;
  intakeClosesOn: string;
  capacity: number;
  coordinators: string[];
  deadlines: CohortDeadlines;
}

export interface CohortIssue {
  field: string;
  message: string;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TERMS: readonly Term[] = ["spring", "summer", "fall", "winter"];

function isRealDate(value: string): boolean {
  if (!DATE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function validateCohort(input: CohortInput): CohortIssue[] {
  const issues: CohortIssue[] = [];
  if (!input.program?.trim()) issues.push({ field: "program", message: "program is required" });
  if (!TERMS.includes(input.term)) issues.push({ field: "term", message: `term must be one of ${TERMS.join(", ")}` });
  if (!Number.isInteger(input.year) || input.year < 2000 || input.year > 2100) issues.push({ field: "year", message: "year must be between 2000 and 2100" });
  if (!Number.isInteger(input.capacity) || input.capacity < 1 || input.capacity > 5000) issues.push({ field: "capacity", message: "capacity must be a whole number from 1 to 5000" });
  if (!Array.isArray(input.coordinators) || input.coordinators.length === 0) issues.push({ field: "coordinators", message: "assign at least one coordinator" });
  else if (new Set(input.coordinators).size !== input.coordinators.length) issues.push({ field: "coordinators", message: "coordinators must be unique" });

  const dates: Array<[string, string]> = [
    ["intakeOpensOn", input.intakeOpensOn],
    ["intakeClosesOn", input.intakeClosesOn],
    ["deadlines.applications", input.deadlines?.applications],
    ["deadlines.teamFormation", input.deadlines?.teamFormation],
    ["deadlines.midReview", input.deadlines?.midReview],
    ["deadlines.finalSubmission", input.deadlines?.finalSubmission],
  ];
  let datesOk = true;
  for (const [field, value] of dates) {
    if (typeof value !== "string" || !isRealDate(value)) {
      issues.push({ field, message: "must be a real YYYY-MM-DD date" });
      datesOk = false;
    }
  }
  if (datesOk) {
    const d = input.deadlines;
    const ordered: Array<[string, string, string]> = [
      ["intakeClosesOn", input.intakeOpensOn, input.intakeClosesOn],
      ["deadlines.applications", input.intakeOpensOn, d.applications],
      ["deadlines.teamFormation", d.applications, d.teamFormation],
      ["deadlines.midReview", d.teamFormation, d.midReview],
      ["deadlines.finalSubmission", d.midReview, d.finalSubmission],
    ];
    for (const [field, before, after] of ordered) if (!(before < after)) issues.push({ field, message: "must be after the previous date in the cohort timeline" });
  }
  return issues;
}

export interface CohortProject {
  id: string;
  cohortId: string;
}

/** Assign a project to a cohort, refusing when the cohort is full or the project is already in one. */
export function assignToCohort(
  cohort: Pick<CohortInput, "id" | "capacity">,
  assignedProjectIds: readonly string[],
  project: CohortProject,
): { ok: true; assigned: string[] } | { ok: false; code: "ALREADY_ASSIGNED" | "COHORT_FULL" | "WRONG_COHORT" } {
  if (project.cohortId !== cohort.id) return { ok: false, code: "WRONG_COHORT" };
  if (assignedProjectIds.includes(project.id)) return { ok: false, code: "ALREADY_ASSIGNED" };
  if (assignedProjectIds.length >= cohort.capacity) return { ok: false, code: "COHORT_FULL" };
  return { ok: true, assigned: [...assignedProjectIds, project.id] };
}

export type CohortPhase = "before_intake" | "intake" | "applications_closed" | "team_formation" | "in_progress" | "final_review" | "ended";

/** Where a cohort is on `today`, from its deadlines. */
export function cohortPhase(c: CohortInput, today: string): CohortPhase {
  if (today < c.intakeOpensOn) return "before_intake";
  if (today <= c.deadlines.applications) return "intake";
  if (today <= c.intakeClosesOn) return "applications_closed";
  if (today <= c.deadlines.teamFormation) return "team_formation";
  if (today <= c.deadlines.midReview) return "in_progress";
  if (today <= c.deadlines.finalSubmission) return "final_review";
  return "ended";
}

/** Group a list of projects by cohort id; projects keep their input order. */
export function groupByCohort<T extends CohortProject>(projects: readonly T[]): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const p of projects) out.set(p.cohortId, [...(out.get(p.cohortId) ?? []), p]);
  return out;
}
