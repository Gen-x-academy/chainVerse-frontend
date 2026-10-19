import type { MentorshipPrincipal } from "../rbac";
import type { SessionDispute, SessionDisputeIssue } from "./types";

export type DisputeValidationCode =
  | "SUMMARY_REQUIRED"
  | "SUMMARY_TOO_LONG"
  | "EVIDENCE_REFERENCE_INVALID";

export function validateDisputeSubmission(input: {
  issue: SessionDisputeIssue;
  summary: string;
  evidenceReferences: string[];
}): DisputeValidationCode | undefined {
  if (!input.summary.trim()) return "SUMMARY_REQUIRED";
  if (input.summary.trim().length > 2000) return "SUMMARY_TOO_LONG";
  if (
    input.evidenceReferences.some(
      (reference) => !isSafeEvidenceReference(reference),
    )
  ) {
    return "EVIDENCE_REFERENCE_INVALID";
  }
  return undefined;
}

export function isSafeEvidenceReference(reference: string): boolean {
  const value = reference.trim();
  if (!value || value.length > 500) return false;
  if (/^evidence:[A-Za-z0-9._:-]{1,200}$/.test(value)) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function canSubmitDisputeResponse(
  dispute: SessionDispute,
  now = new Date(),
): boolean {
  const deadline = Date.parse(dispute.responseDeadlineAt);
  return (
    dispute.permissions.canRespond &&
    dispute.status === "awaiting-response" &&
    Number.isFinite(deadline) &&
    deadline > now.getTime() &&
    dispute.settlementStatus === "paused"
  );
}

export function canResolveSessionDispute(
  dispute: SessionDispute,
  now = new Date(),
): boolean {
  const deadline = Date.parse(dispute.responseDeadlineAt);
  const responseWindowClosed =
    Number.isFinite(deadline) && deadline <= now.getTime();
  const responseSubmitted = Boolean(dispute.response?.submittedAt);
  return (
    dispute.permissions.canResolve &&
    dispute.status !== "resolved" &&
    dispute.settlementStatus === "paused" &&
    (responseSubmitted || responseWindowClosed)
  );
}

export function canCreateSessionDispute(
  principal: MentorshipPrincipal,
): boolean {
  return principal.role === "student" || principal.role === "mentor";
}
