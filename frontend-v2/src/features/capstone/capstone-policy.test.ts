import { describe, expect, it } from "vitest";
import { isAssetAllowed, resolveCapstonePolicy, resolveEnvironment } from "./capstone-policy";

describe("capstone policy and limits", () => {
  it("resolves safe defaults and treats unknown environments as production", () => {
    expect(resolveEnvironment(undefined)).toBe("production");
    expect(resolveEnvironment("prod-ish")).toBe("production");
    expect(resolveEnvironment("staging")).toBe("staging");
    const { policy, issues } = resolveCapstonePolicy("production");
    expect(issues).toEqual([]);
    expect(policy.flags).toEqual({ proposalsOpen: false, teamFormation: false, peerReview: false, publicShowcase: false });
    expect(policy.limits.teamSizeMax).toBe(5);
  });

  it("has environment-specific flag defaults", () => {
    expect(resolveCapstonePolicy("development").policy.flags.publicShowcase).toBe(true);
    expect(resolveCapstonePolicy("staging").policy.flags.publicShowcase).toBe(false);
  });

  it("applies valid overrides", () => {
    const { policy, issues } = resolveCapstonePolicy("production", {
      flags: { proposalsOpen: true },
      limits: { teamSizeMax: 8, maxFileSizeMb: 50 },
      windows: { reviewWindowDays: 21 },
      retention: { draftDays: 30 },
    });
    expect(issues).toEqual([]);
    expect(policy.flags.proposalsOpen).toBe(true);
    expect(policy.limits).toMatchObject({ teamSizeMax: 8, maxFileSizeMb: 50 });
    expect(policy.windows.reviewWindowDays).toBe(21);
    expect(policy.retention.draftDays).toBe(30);
  });

  it("falls back to the default and reports an issue for out-of-bounds or malformed values", () => {
    const { policy, issues } = resolveCapstonePolicy("production", {
      limits: { maxFileSizeMb: 5000, teamSizeMax: 2.5 as never, maxFilesPerSubmission: "5" as never },
      windows: { reviewWindowDays: 0 },
    });
    expect(policy.limits.maxFileSizeMb).toBe(25);
    expect(policy.limits.teamSizeMax).toBe(5);
    expect(policy.limits.maxFilesPerSubmission).toBe(10);
    expect(policy.windows.reviewWindowDays).toBe(14);
    expect(issues.map((i) => i.key).sort()).toEqual(["maxFileSizeMb", "maxFilesPerSubmission", "reviewWindowDays", "teamSizeMax"]);
  });

  it("rejects an inverted team size range", () => {
    const { policy, issues } = resolveCapstonePolicy("production", { limits: { teamSizeMin: 6, teamSizeMax: 3 } });
    expect(policy.limits).toMatchObject({ teamSizeMin: 1, teamSizeMax: 5 });
    expect(issues.some((i) => /cannot exceed/.test(i.message))).toBe(true);
  });

  it("reports unknown or non-boolean flags and leaves them unchanged", () => {
    const { policy, issues } = resolveCapstonePolicy("production", { flags: { peerReview: "yes" as never, nope: true } as never });
    expect(policy.flags.peerReview).toBe(false);
    expect(issues).toHaveLength(2);
  });

  it("filters supported assets to known types and falls back when none remain", () => {
    expect(resolveCapstonePolicy("production", { supportedAssets: ["pdf", "exe", "pdf"] })).toMatchObject({
      policy: { supportedAssets: ["pdf"] },
      issues: [{ key: "supportedAssets" }],
    });
    expect(resolveCapstonePolicy("production", { supportedAssets: ["exe"] }).policy.supportedAssets).toContain("docx");
  });

  it("checks asset type and size against the policy", () => {
    const { policy } = resolveCapstonePolicy("production");
    expect(isAssetAllowed(policy, "pdf", 25)).toBe(true);
    expect(isAssetAllowed(policy, "pdf", 25.1)).toBe(false);
    expect(isAssetAllowed(policy, "exe", 1)).toBe(false);
    expect(isAssetAllowed(policy, "pdf", 0)).toBe(false);
  });
});
