import { describe, expect, it } from "vitest";
import {
  canSupervise,
  clearSuspension,
  evaluateEligibility,
  reverify,
  suspend,
  toEligibilityDisplay,
  type EligibilityRecord,
} from "./supervisor-eligibility";

const good = (): EligibilityRecord => ({
  supervisorId: "sup_1",
  orgApproval: "approved",
  identityRef: "idref-ABCDEF123456",
  identityVerifiedOn: "2026-01-01",
  credentials: [{ ref: "cred-1", verified: true, expiresOn: "2027-01-01" }],
  conflicts: [],
  suspended: false,
  validUntil: "2026-12-31",
});
const TODAY = "2026-06-01";

describe("supervisor eligibility", () => {
  it("is eligible when approved, identity-checked, credentialed and unexpired", () => {
    expect(evaluateEligibility(good(), TODAY)).toEqual({ status: "eligible", reasons: [], expiringSoon: false, conflictsWith: [] });
  });

  it("reports each blocking reason", () => {
    const r = evaluateEligibility({ ...good(), orgApproval: "pending", identityRef: undefined, credentials: [{ ref: "c", verified: false }], suspended: true }, TODAY);
    expect(r.status).toBe("ineligible");
    expect(r.reasons.sort()).toEqual(["IDENTITY_NOT_VERIFIED", "NO_VERIFIED_CREDENTIAL", "ORG_APPROVAL_PENDING", "SUSPENDED"]);
    expect(evaluateEligibility({ ...good(), orgApproval: "rejected" }, TODAY).reasons).toContain("ORG_APPROVAL_REJECTED");
  });

  it("treats an expired credential as no credential", () => {
    const r = evaluateEligibility({ ...good(), credentials: [{ ref: "c", verified: true, expiresOn: "2026-05-31" }] }, TODAY);
    expect(r.reasons).toContain("NO_VERIFIED_CREDENTIAL");
  });

  it("asks for re-verification when only the validity window has lapsed", () => {
    const r = evaluateEligibility({ ...good(), validUntil: "2026-05-31" }, TODAY);
    expect(r).toMatchObject({ status: "reverification_due", reasons: ["VERIFICATION_EXPIRED"] });
  });

  it("warns when expiry is near", () => {
    expect(evaluateEligibility({ ...good(), validUntil: "2026-06-20" }, TODAY).expiringSoon).toBe(true);
    expect(evaluateEligibility({ ...good(), validUntil: "2026-09-01" }, TODAY).expiringSoon).toBe(false);
  });

  it("suspension blocks until cleared, and re-verification does not clear it", () => {
    const s = suspend(good());
    expect(evaluateEligibility(s, TODAY).status).toBe("ineligible");
    expect(evaluateEligibility(reverify(s, TODAY, 365), TODAY).status).toBe("ineligible");
    expect(evaluateEligibility(clearSuspension(s), TODAY).status).toBe("eligible");
  });

  it("re-verification restarts the window and keeps conflicts", () => {
    const record = reverify({ ...good(), validUntil: "2026-01-01", conflicts: ["prj_X"] }, TODAY, 365);
    expect(record.validUntil).toBe("2027-06-01");
    expect(record.conflicts).toEqual(["prj_X"]);
    expect(evaluateEligibility(record, TODAY).status).toBe("eligible");
    expect(() => reverify(good(), "bad", 1)).toThrow();
    expect(() => reverify(good(), TODAY, 0)).toThrow();
  });

  it("declared conflicts block supervision of that project only", () => {
    const record = { ...good(), conflicts: ["prj_A", "prj_A", "prj_B"] };
    expect(canSupervise(record, "prj_A", TODAY)).toBe(false);
    expect(canSupervise(record, "prj_C", TODAY)).toBe(true);
    expect(evaluateEligibility(record, TODAY).conflictsWith).toEqual(["prj_A", "prj_B"]);
  });

  it("never exposes raw references in the display form", () => {
    const display = toEligibilityDisplay(good());
    expect(display.identityRef).toBe(`${"*".repeat(14)}3456`);
    expect(JSON.stringify(display)).not.toContain("ABCDEF");
    expect(JSON.stringify(display)).not.toContain("cred-1");
    expect(display).toMatchObject({ credentialCount: 1, verifiedCredentialCount: 1 });
    expect(() => evaluateEligibility(good(), "June 1")).toThrow();
  });
});
