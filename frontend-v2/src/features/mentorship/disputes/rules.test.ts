import { describe, expect, it } from "vitest";
import {
  canResolveSessionDispute,
  canSubmitDisputeResponse,
  isSafeEvidenceReference,
  validateDisputeSubmission,
} from "./rules";
import type { SessionDispute } from "./types";

const deadline = "2030-01-01T12:00:00.000Z";
const dispute: SessionDispute = {
  publicId: "dsp_test",
  sessionId: "ses_test",
  isOpenedByCurrentUser: false,
  issue: "attendance",
  summary: "The session did not take place.",
  evidenceReferences: [],
  status: "awaiting-response",
  openedAt: "2030-01-01T10:00:00.000Z",
  responseDeadlineAt: deadline,
  settlementStatus: "paused",
  permissions: { canRespond: true, canResolve: true },
};

describe("MENTOR-067 dispute rules", () => {
  it("keeps settlement paused and enforces the response window consistently", () => {
    expect(
      canSubmitDisputeResponse(dispute, new Date("2030-01-01T11:59:59.000Z")),
    ).toBe(true);
    expect(canSubmitDisputeResponse(dispute, new Date(deadline))).toBe(false);
    expect(
      canResolveSessionDispute(dispute, new Date("2030-01-01T11:59:59.000Z")),
    ).toBe(false);
    expect(canResolveSessionDispute(dispute, new Date(deadline))).toBe(true);
    expect(
      canResolveSessionDispute(
        { ...dispute, settlementStatus: "pending" },
        new Date(deadline),
      ),
    ).toBe(false);
  });

  it("allows HTTPS and opaque evidence references, never raw or insecure content", () => {
    expect(isSafeEvidenceReference("https://evidence.example/ref/123")).toBe(
      true,
    );
    expect(isSafeEvidenceReference("evidence:ref_123")).toBe(true);
    expect(isSafeEvidenceReference("http://evidence.example/ref/123")).toBe(
      false,
    );
    expect(isSafeEvidenceReference("private note pasted here")).toBe(false);
  });

  it("validates dispute summaries and evidence before submission", () => {
    expect(
      validateDisputeSubmission({
        issue: "duration",
        summary: "  ",
        evidenceReferences: [],
      }),
    ).toBe("SUMMARY_REQUIRED");
    expect(
      validateDisputeSubmission({
        issue: "duration",
        summary: "The logged duration is incorrect.",
        evidenceReferences: ["javascript:alert(1)"],
      }),
    ).toBe("EVIDENCE_REFERENCE_INVALID");
  });
});
