/**
 * Proposal evidence attachments (CAPSTONE-036).
 *
 * An attachment is a constrained reference to a file held elsewhere. It records
 * why it was added, that the owner consented to sharing it, its malware-scan
 * state, who may open it, how long it is kept, integrity metadata and whether
 * it has been deleted. File contents never pass through this module.
 */

export type AttachmentPurpose = "evidence" | "prior_work" | "letter_of_support" | "ethics_approval" | "budget";
export type ScanState = "pending" | "clean" | "infected" | "failed";
export type AccessPolicy = "call_owner" | "assigned_reviewers" | "team_only";
export type DeletionStatus = "active" | "pending_deletion" | "deleted";

export interface AttachmentRef {
  id: string;
  proposalId: string;
  name: string;
  purpose: AttachmentPurpose;
  mimeType: string;
  sizeBytes: number;
  /** Lowercase hex SHA-256 of the file, supplied by the upload service. */
  sha256: string;
  consentGiven: boolean;
  scanState: ScanState;
  accessPolicy: AccessPolicy;
  retentionDays: number;
  addedAt: string;
  deletionStatus: DeletionStatus;
}

export interface AttachmentIssue {
  path: string;
  message: string;
}

export const ALLOWED_MIME_TYPES = ["application/pdf", "image/png", "image/jpeg", "text/plain", "text/csv"] as const;
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const MAX_ATTACHMENTS_PER_PROPOSAL = 10;
export const MIN_RETENTION_DAYS = 30;
export const MAX_RETENTION_DAYS = 3650;

/** Problems with one attachment reference, or an empty list when valid. */
export function validateAttachment(ref: AttachmentRef): AttachmentIssue[] {
  const issues: AttachmentIssue[] = [];
  const bad = (path: string, message: string) => issues.push({ path, message });
  if (ref.name.trim().length === 0 || /[\\/]/.test(ref.name)) bad("name", "use a plain file name without folders");
  if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(ref.mimeType)) bad("mimeType", "this file type is not accepted");
  if (!Number.isFinite(ref.sizeBytes) || ref.sizeBytes <= 0 || ref.sizeBytes > MAX_ATTACHMENT_BYTES) bad("sizeBytes", "the file must be between 1 byte and 10 MB");
  if (!/^[0-9a-f]{64}$/.test(ref.sha256)) bad("sha256", "the integrity hash must be 64 lowercase hex characters");
  if (!ref.consentGiven) bad("consentGiven", "the owner must agree to share this file");
  if (!Number.isInteger(ref.retentionDays) || ref.retentionDays < MIN_RETENTION_DAYS || ref.retentionDays > MAX_RETENTION_DAYS) {
    bad("retentionDays", `keep files between ${MIN_RETENTION_DAYS} and ${MAX_RETENTION_DAYS} days`);
  }
  return issues;
}

/** Problems with the whole attachment list on a proposal. */
export function validateAttachmentList(refs: readonly AttachmentRef[]): AttachmentIssue[] {
  const issues: AttachmentIssue[] = [];
  const active = refs.filter((r) => r.deletionStatus === "active");
  if (active.length > MAX_ATTACHMENTS_PER_PROPOSAL) issues.push({ path: "attachments", message: `attach at most ${MAX_ATTACHMENTS_PER_PROPOSAL} files` });
  const seen = new Set<string>();
  for (const r of active) {
    if (seen.has(r.sha256)) issues.push({ path: `attachments.${r.id}`, message: "this file is already attached" });
    seen.add(r.sha256);
  }
  return issues;
}

/** Whether submission may go ahead: every active file must have passed its scan. */
export function submissionBlockers(refs: readonly AttachmentRef[]): AttachmentIssue[] {
  const blockers: AttachmentIssue[] = [];
  for (const r of refs) {
    if (r.deletionStatus !== "active") continue;
    if (r.scanState === "pending") blockers.push({ path: `attachments.${r.id}`, message: "wait for the virus scan to finish" });
    else if (r.scanState === "failed") blockers.push({ path: `attachments.${r.id}`, message: "the scan failed, upload the file again" });
    else if (r.scanState === "infected") blockers.push({ path: `attachments.${r.id}`, message: "the file did not pass the virus scan, remove it" });
  }
  return blockers;
}

export type Viewer = "owner" | "team_member" | "assigned_reviewer" | "call_owner" | "other";

/** Deny by default: a file is only readable when clean, active and allowed for the viewer. */
export function canOpen(ref: AttachmentRef, viewer: Viewer): boolean {
  if (ref.deletionStatus !== "active" || ref.scanState !== "clean") return false;
  if (viewer === "owner" || viewer === "team_member") return true;
  if (ref.accessPolicy === "team_only") return false;
  if (ref.accessPolicy === "assigned_reviewers") return viewer === "assigned_reviewer" || viewer === "call_owner";
  return viewer === "call_owner";
}

/** When the file stops being retained, as an ISO timestamp. */
export function retainUntil(ref: AttachmentRef): string {
  return new Date(Date.parse(ref.addedAt) + ref.retentionDays * 86_400_000).toISOString();
}

export function isPastRetention(ref: AttachmentRef, now: Date): boolean {
  return now.getTime() >= Date.parse(retainUntil(ref));
}

/** Deletion only moves forward: active, then pending, then deleted. */
export function advanceDeletion(ref: AttachmentRef, to: DeletionStatus): AttachmentRef {
  const order: DeletionStatus[] = ["active", "pending_deletion", "deleted"];
  if (order.indexOf(to) < order.indexOf(ref.deletionStatus)) return ref;
  return { ...ref, deletionStatus: to };
}
