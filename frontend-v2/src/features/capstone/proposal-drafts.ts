/**
 * Capstone proposal drafts (CAPSTONE-033).
 *
 * A draft captures title, abstract, problem, objectives, methods, expected
 * outputs, timeline, risks, resources, preferred roles and the linked call.
 * Drafts may be saved incomplete; submission requires every field to be valid
 * and the timeline to fit inside the linked call's project window.
 */

export const PROPOSAL_FIELDS = ["title", "abstract", "problem", "objectives", "methods", "expectedOutputs", "timeline", "risks", "resources", "preferredRoles", "callId"] as const;
export type ProposalField = (typeof PROPOSAL_FIELDS)[number];

export interface ProposalTimeline {
  startsOn?: string;
  endsOn?: string;
  milestones?: Array<{ title: string; dueOn: string }>;
}

export interface ProposalDraft {
  id: string;
  ownerId: string;
  callId?: string;
  title: string;
  abstract: string;
  problem: string;
  objectives: string[];
  methods: string;
  expectedOutputs: string[];
  timeline: ProposalTimeline;
  risks: string[];
  resources: string;
  preferredRoles: string[];
  status: "draft" | "submitted";
  revision: number;
}

export interface CallWindow {
  id: string;
  projectsStartOn: string;
  projectsEndOn: string;
  open: boolean;
}

export interface DraftIssue {
  field: ProposalField;
  message: string;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const LIMITS = { title: 120, abstract: 2000, problem: 4000, methods: 4000, resources: 2000, listItem: 300, listLength: 12 } as const;

export function newDraft(id: string, ownerId: string, callId?: string): ProposalDraft {
  return { id, ownerId, ...(callId ? { callId } : {}), title: "", abstract: "", problem: "", objectives: [], methods: "", expectedOutputs: [], timeline: {}, risks: [], resources: "", preferredRoles: [], status: "draft", revision: 1 };
}

/** Limits that apply even to an incomplete draft, so autosave cannot store unbounded text. */
export function validateLimits(d: ProposalDraft): DraftIssue[] {
  const issues: DraftIssue[] = [];
  const text = (field: ProposalField, value: string, max: number) => value.length > max && issues.push({ field, message: `${field} can be at most ${max} characters` });
  text("title", d.title, LIMITS.title);
  text("abstract", d.abstract, LIMITS.abstract);
  text("problem", d.problem, LIMITS.problem);
  text("methods", d.methods, LIMITS.methods);
  text("resources", d.resources, LIMITS.resources);
  const list = (field: ProposalField, value: string[]) => {
    if (value.length > LIMITS.listLength) issues.push({ field, message: `${field} can have at most ${LIMITS.listLength} items` });
    else if (value.some((v) => v.length > LIMITS.listItem)) issues.push({ field, message: `each ${field} item can be at most ${LIMITS.listItem} characters` });
  };
  list("objectives", d.objectives);
  list("expectedOutputs", d.expectedOutputs);
  list("risks", d.risks);
  list("preferredRoles", d.preferredRoles);
  return issues;
}

export function updateField<K extends ProposalField>(d: ProposalDraft, field: K, value: ProposalDraft[K]): { ok: true; draft: ProposalDraft } | { ok: false; error: "SUBMITTED" | "TOO_LONG"; issues: DraftIssue[] } {
  if (d.status === "submitted") return { ok: false, error: "SUBMITTED", issues: [] };
  const next = { ...d, [field]: value, revision: d.revision + 1 } as ProposalDraft;
  const issues = validateLimits(next).filter((i) => i.field === field);
  return issues.length > 0 ? { ok: false, error: "TOO_LONG", issues } : { ok: true, draft: next };
}

/** What is still missing or invalid before the draft can be submitted. */
export function validateForSubmit(d: ProposalDraft, call: CallWindow | undefined): DraftIssue[] {
  const issues = validateLimits(d);
  const need = (cond: boolean, field: ProposalField, message: string) => cond || issues.push({ field, message });

  need(d.title.trim().length >= 5, "title", "give the proposal a title of at least 5 characters");
  need(d.abstract.trim().length >= 50, "abstract", "the abstract needs at least 50 characters");
  need(d.problem.trim().length >= 50, "problem", "describe the problem in at least 50 characters");
  need(d.objectives.filter((o) => o.trim()).length >= 1, "objectives", "add at least one objective");
  need(d.methods.trim().length >= 30, "methods", "describe your methods in at least 30 characters");
  need(d.expectedOutputs.filter((o) => o.trim()).length >= 1, "expectedOutputs", "list at least one expected output");
  need(d.risks.filter((o) => o.trim()).length >= 1, "risks", "name at least one risk");
  need(d.preferredRoles.length >= 1, "preferredRoles", "choose at least one preferred role");

  need(d.callId !== undefined, "callId", "link the proposal to a call");
  if (d.callId !== undefined) {
    if (!call || call.id !== d.callId) issues.push({ field: "callId", message: "the linked call was not found" });
    else if (!call.open) issues.push({ field: "callId", message: "the linked call is not accepting proposals" });
  }

  const { startsOn, endsOn } = d.timeline;
  if (!startsOn || !endsOn || !DATE.test(startsOn) || !DATE.test(endsOn)) issues.push({ field: "timeline", message: "set a start and end date (YYYY-MM-DD)" });
  else {
    if (!(startsOn < endsOn)) issues.push({ field: "timeline", message: "the end date must be after the start date" });
    else if (call && call.id === d.callId && (startsOn < call.projectsStartOn || endsOn > call.projectsEndOn)) {
      issues.push({ field: "timeline", message: `the timeline must fit between ${call.projectsStartOn} and ${call.projectsEndOn}` });
    }
    for (const m of d.timeline.milestones ?? []) {
      if (!DATE.test(m.dueOn) || m.dueOn < startsOn || m.dueOn > endsOn) issues.push({ field: "timeline", message: `milestone "${m.title}" must fall inside the timeline` });
    }
  }
  return issues;
}

/** Fraction of required sections that currently pass, for a progress indicator. */
export function completeness(d: ProposalDraft, call: CallWindow | undefined): { done: number; total: number } {
  const failing = new Set(validateForSubmit(d, call).map((i) => i.field));
  const total = PROPOSAL_FIELDS.length;
  return { done: total - failing.size, total };
}

export function submitDraft(d: ProposalDraft, call: CallWindow | undefined): { ok: true; draft: ProposalDraft } | { ok: false; issues: DraftIssue[] } {
  if (d.status === "submitted") return { ok: true, draft: d }; // idempotent
  const issues = validateForSubmit(d, call);
  return issues.length > 0 ? { ok: false, issues } : { ok: true, draft: { ...d, status: "submitted", revision: d.revision + 1 } };
}
