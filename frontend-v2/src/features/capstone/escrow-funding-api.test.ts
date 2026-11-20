import { describe, expect, it } from "vitest";
import { fundingPanelModel, fromFundingApi, type FundingApiResponse } from "./escrow-funding-api";
import { confirmFunding, newFundingContext, type ConfirmFundingRequest } from "./escrow-confirmation";

const api: FundingApiResponse = {
  projectId: "prj_1",
  tenantId: "tenant_1",
  agreementId: "agr_1",
  asset: "USDC",
  destination: "GDESTINATION",
  expectedAmount: "100000",
  state: "awaiting-funding",
  revision: 4,
  observation: {
    provider: "provider-a",
    reference: "tx_1",
    finality: "final",
    asset: "USDC",
    destination: "GDESTINATION",
    amount: "100000",
    observedAt: "2026-11-20T10:00:00Z",
  },
};

const request: ConfirmFundingRequest = {
  requestId: "req_1",
  actorId: "user_1",
  actorTenantId: "tenant_1",
  actorRoles: ["funding-officer"],
  expectedRevision: 4,
  agreement: {
    id: "agr_1",
    tenantId: "tenant_1",
    projectId: "prj_1",
    asset: "USDC",
    destination: "GDESTINATION",
    amount: 100_000n,
    status: "active",
    projectState: "active",
  },
  now: "2026-11-20T10:01:00Z",
};

describe("escrow funding typed API and UI states", () => {
  it("preserves integer precision across the API boundary", () => {
    const funding = fromFundingApi(api);
    expect(funding.expectedAmount).toBe(100_000n);
    expect(funding.observation?.amount).toBe(100_000n);
    expect(() => fromFundingApi({ ...api, expectedAmount: "100000.5" })).toThrow("Invalid amount format");
  });

  it("drives loading, empty, error, conflict and success states from typed results", () => {
    expect(fundingPanelModel(undefined, { pending: true }).state).toBe("loading");
    expect(fundingPanelModel(undefined, { canConfirm: true })).toMatchObject({ state: "empty", canConfirm: true });
    const funding = fromFundingApi(api);
    const success = confirmFunding(funding, request, newFundingContext());
    expect(fundingPanelModel(success).state).toBe("success");
    const conflict = confirmFunding(funding, { ...request, requestId: "req_2", expectedRevision: 1 }, newFundingContext());
    expect(fundingPanelModel(conflict, { canConfirm: true })).toMatchObject({ state: "conflict", retryable: true, canConfirm: true });
  });
});
