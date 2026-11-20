/**
 * Active charter amendments (CAPSTONE-052).
 *
 * A change to an active charter is proposed as a new version with an impact
 * preview and a set of required approvals. When everyone required has
 * approved, it takes effect on its effective date. Earlier versions are never
 * edited; the history is a list of immutable versions.
 */

export interface CharterVersion {
  version: number;
  /** Section name to section text. */
  sections: Record<string, string>;
  effectiveFrom: string;
}

export type AmendmentStatus = "proposed" | "approved" | "rejected" | "withdrawn" | "effective";

export interface Amendment {
  id: string;
  basedOnVersion: number;
  proposedBy: string;
  proposedAt: string;
  changes: Record<string, string>;
  rationale: string;
  requiredApprovers: string[];
  approvals: string[];
  rejectedBy?: string;
  effectiveOn: string;
  status: AmendmentStatus;
}

export interface CharterHistory {
  versions: CharterVersion[];
  amendments: Amendment[];
}

export type AmendmentErrorCode = "nothing_changed" | "unknown_section" | "stale_base" | "needs_rationale" | "bad_effective_date" | "open_amendment_exists" | "not_found" | "wrong_state" | "not_an_approver" | "not_ready";

export type AmendmentResult = { ok: true; history: CharterHistory } | { ok: false; code: AmendmentErrorCode; message: string };

const MESSAGES: Record<AmendmentErrorCode, string> = {
  nothing_changed: "The proposal does not change any section.",
  unknown_section: "One of the changed sections does not exist in the charter.",
  stale_base: "The charter has a newer version. Start again from the latest.",
  needs_rationale: "Explain why the change is needed.",
  bad_effective_date: "The effective date must be after today.",
  open_amendment_exists: "Another amendment is still waiting for a decision.",
  not_found: "No such amendment was found.",
  wrong_state: "This step is not available in the amendment's current state.",
  not_an_approver: "Only a required approver can do this.",
  not_ready: "Not every required approval is in yet.",
};

const fail = (code: AmendmentErrorCode): AmendmentResult => ({ ok: false, code, message: MESSAGES[code] });

export function latestVersion(history: CharterHistory): CharterVersion {
  const sorted = [...history.versions].sort((a, b) => a.version - b.version);
  return sorted[sorted.length - 1] as CharterVersion;
}

/** What would change, section by section, for the impact preview. */
export function impactPreview(base: CharterVersion, changes: Readonly<Record<string, string>>): Array<{ section: string; before: string; after: string }> {
  return Object.entries(changes)
    .filter(([section, after]) => section in base.sections && base.sections[section]?.trim() !== after.trim())
    .map(([section, after]) => ({ section, before: base.sections[section] ?? "", after }));
}

export function proposeAmendment(
  history: CharterHistory,
  input: { id: string; proposedBy: string; proposedAt: string; changes: Record<string, string>; rationale: string; requiredApprovers: string[]; effectiveOn: string; basedOnVersion: number },
): AmendmentResult {
  const latest = latestVersion(history);
  if (input.basedOnVersion !== latest.version) return fail("stale_base");
  if (input.rationale.trim().length === 0) return fail("needs_rationale");
  if (Object.keys(input.changes).some((s) => !(s in latest.sections))) return fail("unknown_section");
  if (impactPreview(latest, input.changes).length === 0) return fail("nothing_changed");
  if (!(Date.parse(input.effectiveOn) > Date.parse(input.proposedAt))) return fail("bad_effective_date");
  if (history.amendments.some((a) => a.status === "proposed" || a.status === "approved")) return fail("open_amendment_exists");
  const amendment: Amendment = { ...input, approvals: [], status: "proposed" };
  return { ok: true, history: { ...history, amendments: [...history.amendments, amendment] } };
}

function update(history: CharterHistory, id: string, change: (a: Amendment) => Amendment | AmendmentErrorCode): AmendmentResult {
  const target = history.amendments.find((a) => a.id === id);
  if (!target) return fail("not_found");
  const next = change(target);
  if (typeof next === "string") return fail(next);
  return { ok: true, history: { ...history, amendments: history.amendments.map((a) => (a === target ? next : a)) } };
}

/** Approve once; repeating an approval changes nothing. Moves to `approved` when all are in. */
export function approveAmendment(history: CharterHistory, id: string, userId: string): AmendmentResult {
  return update(history, id, (a) => {
    if (a.status !== "proposed") return "wrong_state";
    if (!a.requiredApprovers.includes(userId)) return "not_an_approver";
    if (a.approvals.includes(userId)) return a;
    const approvals = [...a.approvals, userId];
    return { ...a, approvals, status: a.requiredApprovers.every((p) => approvals.includes(p)) ? "approved" : "proposed" };
  });
}

export function rejectAmendment(history: CharterHistory, id: string, userId: string): AmendmentResult {
  return update(history, id, (a) => {
    if (a.status !== "proposed") return "wrong_state";
    if (!a.requiredApprovers.includes(userId)) return "not_an_approver";
    return { ...a, status: "rejected", rejectedBy: userId };
  });
}

export function withdrawAmendment(history: CharterHistory, id: string, userId: string): AmendmentResult {
  return update(history, id, (a) => {
    if (a.status !== "proposed" && a.status !== "approved") return "wrong_state";
    if (a.proposedBy !== userId) return "not_an_approver";
    return { ...a, status: "withdrawn" };
  });
}

/**
 * Make an approved amendment effective once its date has come. Appends a new
 * version; the earlier version is left exactly as it was.
 */
export function applyAmendment(history: CharterHistory, id: string, now: string): AmendmentResult {
  const target = history.amendments.find((a) => a.id === id);
  if (!target) return fail("not_found");
  if (target.status !== "approved") return fail(target.status === "proposed" ? "not_ready" : "wrong_state");
  if (Date.parse(now) < Date.parse(target.effectiveOn)) return fail("not_ready");
  const latest = latestVersion(history);
  if (target.basedOnVersion !== latest.version) return fail("stale_base");
  const version: CharterVersion = { version: latest.version + 1, sections: { ...latest.sections, ...target.changes }, effectiveFrom: target.effectiveOn };
  return { ok: true, history: { versions: [...history.versions, version], amendments: history.amendments.map((a) => (a === target ? { ...a, status: "effective" as const } : a)) } };
}

/** The version in force on a given date. */
export function versionOn(history: CharterHistory, date: string): CharterVersion | undefined {
  return [...history.versions].sort((a, b) => b.version - a.version).find((v) => Date.parse(v.effectiveFrom) <= Date.parse(date));
}
