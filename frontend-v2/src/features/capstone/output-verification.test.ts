import { describe, expect, it } from "vitest";
import {
  isVerificationCode,
  verifyOutput,
  verificationAudit,
  type VerificationRecord,
  type VerificationRegistry,
} from "./output-verification";

const CODE = "vrf_0123456789ABCDEG";
const OTHER = "vrf_ZHJKMNPQRSTVWXYZ";
const record = (over: Partial<VerificationRecord> = {}): VerificationRecord => ({
  projectId: "prj_1",
  outputId: "out_1",
  state: "valid",
  ...over,
});
const registry = (r: VerificationRecord): VerificationRegistry => new Map([[CODE, r]]);
const now = "2026-11-20T00:00:00.000Z";

describe("public output verification (CAPSTONE-095)", () => {
  it("accepts only well-formed public codes", () => {
    expect(isVerificationCode(CODE)).toBe(true);
    expect(isVerificationCode(OTHER)).toBe(true);
    expect(isVerificationCode("vrf_0123456789abcdeg")).toBe(false);
    expect(isVerificationCode("vrf_0123456789ABCDEI")).toBe(false);
    expect(isVerificationCode(undefined)).toBe(false);
  });

  it("returns valid with only public references and a digest", () => {
    const result = verifyOutput(CODE, registry(record({ sha256: "a".repeat(64) })), now);
    expect(result).toEqual({ state: "valid", code: "VALID", projectId: "prj_1", outputId: "out_1", sha256: "a".repeat(64) });
  });

  it("reports each documented state with stable codes", () => {
    expect(verifyOutput(CODE, registry(record({ state: "revoked" })), now)).toMatchObject({ state: "revoked", code: "REVOKED" });
    expect(verifyOutput(CODE, registry(record({ state: "superseded", supersededBy: OTHER })), now)).toEqual({ state: "superseded", code: "SUPERSEDED", supersededBy: OTHER });
    expect(verifyOutput(CODE, registry(record({ state: "embargoed", embargoUntil: "2026-12-01T00:00:00.000Z" })), now)).toEqual({ state: "embargoed", code: "UNDER_EMBARGO" });
    expect(verifyOutput(OTHER, registry(record()), now)).toEqual({ state: "unknown", code: "UNKNOWN_CODE" });
    expect(verifyOutput("nope", registry(record()), now)).toEqual({ state: "malformed", code: "MALFORMED_CODE" });
  });

  it("lifts expired embargoes and revokes expired access", () => {
    expect(verifyOutput(CODE, registry(record({ state: "embargoed", embargoUntil: "2026-11-01T00:00:00.000Z" })), now)).toMatchObject({ state: "valid", code: "EMBARGO_LIFTED" });
    expect(verifyOutput(CODE, registry(record({ validUntil: "2026-11-01T00:00:00.000Z" })), now)).toMatchObject({ state: "revoked", code: "ACCESS_EXPIRED" });
  });

  it("never discloses fields for embargoed or unknown codes", () => {
    const embargoed = verifyOutput(CODE, registry(record({ state: "embargoed", embargoUntil: "2027-01-01T00:00:00.000Z", sha256: "b".repeat(64) })), now);
    expect(Object.keys(embargoed).sort()).toEqual(["code", "state"]);
    const unknown = verifyOutput(OTHER, registry(record()), now);
    expect(Object.keys(unknown).sort()).toEqual(["code", "state"]);
  });

  it("records privacy-safe audits and is pure across repeated calls", () => {
    const r = registry(record());
    expect(verifyOutput(CODE, r, now)).toEqual(verifyOutput(CODE, r, now));
    expect(verificationAudit(CODE, verifyOutput(CODE, r, now))).toEqual({ code: CODE, state: "valid", reason: "VALID" });
    expect(verificationAudit("nope", verifyOutput("nope", r, now))).toEqual({ code: "MALFORMED", state: "malformed", reason: "MALFORMED_CODE" });
  });
});
