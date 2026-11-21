import { describe, expect, it } from "vitest";
import {
  allocateFunding,
  fundingBreakdown,
  isFundingModel,
  validateFunding,
  type FundingConfiguration,
  type FundingModel,
} from "./project-funding";

const config = (model: FundingModel = "grant"): FundingConfiguration => ({
  id: "fund-1",
  tenantId: "tenant-1",
  projectId: "project-1",
  model,
  asset: { code: "USDC", issuer: "GABC" },
  payerId: "sponsor-1",
  recipients: [{ memberId: "student-1", shareBps: 7000 }, { memberId: "student-2", shareBps: 3000 }],
  fees: { platformBps: 250, flat: 100 },
  committedAmount: 100000,
  revision: 1,
});
const ctx = { tenantId: "tenant-1", projectId: "project-1", memberIds: ["sponsor-1", "student-1", "student-2"] };
const fields = (issues: { field: string }[]) => issues.map((i) => i.field);

describe("project funding configuration", () => {
  it("supports all seven models", () => {
    for (const model of ["unfunded", "grant", "milestone", "reimbursement", "stipend", "bounty", "sponsor-funded"] as const) {
      expect(isFundingModel(model)).toBe(true);
      expect(validateFunding(model === "unfunded" ? { ...config("unfunded"), committedAmount: 0, recipients: [] } : config(model), ctx)).toEqual([]);
    }
    expect(isFundingModel("loan")).toBe(false);
  });

  it("rejects unknown models and tenant mismatches", () => {
    expect(fields(validateFunding({ ...config(), model: "loan" as FundingModel }, ctx))).toContain("model");
    expect(fields(validateFunding({ ...config(), tenantId: "tenant-2" }, ctx))).toContain("tenantId");
  });

  it("requires no money for unfunded projects", () => {
    expect(fields(validateFunding(config("unfunded"), ctx))).toEqual(["committedAmount", "recipients"]);
  });

  it("requires a tenant payer and recipient shares that total 10000", () => {
    const invalid = config();
    invalid.payerId = "outsider";
    invalid.recipients = [{ memberId: "student-1", shareBps: 5000 }];
    expect(fields(validateFunding(invalid, ctx)).sort()).toEqual(["payerId", "recipients"]);
  });

  it("bounds asset details and fees", () => {
    const invalid = config();
    invalid.asset = { code: "USDC", issuer: "" };
    invalid.fees = { platformBps: 1200, flat: -1 };
    expect(fields(validateFunding(invalid, ctx)).sort()).toEqual(["asset.issuer", "fees.flat", "fees.platformBps"]);
  });

  it("computes deterministic fees and allocations", () => {
    expect(fundingBreakdown(config())).toEqual({ gross: 100000, platformFee: 2600, net: 97400 });
    expect(allocateFunding(config())).toEqual([
      { memberId: "student-1", amount: 68180 },
      { memberId: "student-2", amount: 29220 },
    ]);
  });
});
