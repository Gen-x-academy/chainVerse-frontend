import { describe, expect, it } from "vitest";
import {
  confirmFunding,
  newFundingContext,
  reconcile,
  viewStateForResult,
  type ConfirmFundingRequest,
  type EscrowFunding,
  type FundingAgreement,
  type ProviderObservation,
} from "./escrow-confirmation";

const agreement = (over: Partial<FundingAgreement> = {}): FundingAgreement => ({
  id: "agr_1",
  tenantId: "tenant_1",
  projectId: "prj_1",
  asset: "USDC",
  destination: "GDESTINATION",
  amount: 100_000n,
  status: "active",
  projectState: "active",
  ...over,
});

const observation = (over: Partial<ProviderObservation> = {}): ProviderObservation => ({
  provider: "provider-a",
  reference: "tx_1",
  finality: "final",
  asset: "USDC",
  destination: "GDESTINATION",
  amount: 100_000n,
  observedAt: "2026-11-20T10:00:00Z",
  ...over,
});

const funding = (over: Partial<EscrowFunding> = {}): EscrowFunding => ({
  projectId: "prj_1",
  tenantId: "tenant_1",
  agreementId: "agr_1",
  asset: "USDC",
  destination: "GDESTINATION",
  expectedAmount: 100_000n,
  state: "awaiting-funding",
  revision: 4,
  privateNote: "confidential invoice note",
  ...over,
});

const request = (over: Partial<ConfirmFundingRequest> = {}): ConfirmFundingRequest => ({
  requestId: "req_1",
  actorId: "user_1",
  actorTenantId: "tenant_1",
  actorRoles: ["funding-officer"],
  expectedRevision: 4,
  agreement: agreement(),
  observation: observation(),
  now: "2026-11-20T10:01:00Z",
  ...over,
});

describe("escrow funding confirmation", () => {
  it("marks funds available only after full reconciliation", () => {
    const result = confirmFunding(funding(), request());
    expect(result).toMatchObject({ ok: true, replayed: false, funding: { state: "available", revision: 5 } });
    if (result.ok) {
      expect(result.funding.observation?.reference).toBe("tx_1");
      expect(result.audit).toMatchObject({ type: "escrow.confirm.succeeded", projectId: "prj_1" });
      expect(JSON.stringify(result.audit)).not.toContain("confidential invoice note");
      expect(JSON.stringify(result.audit)).not.toContain("GDESTINATION");
    }
  });

  it("is deny-by-default and enforces tenant boundaries", () => {
    expect(confirmFunding(funding(), request({ actorRoles: [] }))).toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(confirmFunding(funding(), request({ actorRoles: ["student"] }))).toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(confirmFunding(funding(), request({ actorTenantId: "tenant_2" }))).toMatchObject({ ok: false, code: "TENANT_MISMATCH" });
    expect(confirmFunding(funding(), request({ actorRoles: ["project-admin"] })).ok).toBe(true);
  });

  it("rejects stale and invalid states with actionable codes", () => {
    expect(confirmFunding(funding(), request({ expectedRevision: 3 }))).toMatchObject({ ok: false, code: "STALE_REVISION" });
    expect(confirmFunding(funding({ state: "disputed" }), request())).toMatchObject({ ok: false, code: "INVALID_STATE" });
    expect(confirmFunding(funding(), request({ agreement: undefined }))).toMatchObject({ ok: false, code: "AGREEMENT_MISSING" });
    expect(confirmFunding(funding(), request({ observation: undefined }))).toMatchObject({ ok: false, code: "OBSERVATION_MISSING" });
  });

  it("requires provider finality, matching asset, destination and agreement", () => {
    expect(confirmFunding(funding(), request({ observation: observation({ finality: "pending" }) }))).toMatchObject({ ok: false, code: "PROVIDER_NOT_FINAL" });
    expect(confirmFunding(funding(), request({ observation: observation({ finality: "failed" }) }))).toMatchObject({ ok: false, code: "PROVIDER_FAILED" });
    expect(confirmFunding(funding(), request({ observation: observation({ asset: "XLM" }) }))).toMatchObject({ ok: false, code: "ASSET_MISMATCH" });
    expect(confirmFunding(funding(), request({ observation: observation({ destination: "GOTHER" }) }))).toMatchObject({ ok: false, code: "DESTINATION_MISMATCH" });
    expect(confirmFunding(funding(), request({ agreement: agreement({ status: "superseded" }) }))).toMatchObject({ ok: false, code: "AGREEMENT_INVALID" });
    expect(confirmFunding(funding(), request({ agreement: agreement({ projectState: "draft" }) }))).toMatchObject({ ok: false, code: "AGREEMENT_INVALID" });
  });

  it("reports underpayment and overpayment without marking funds available", () => {
    const short = confirmFunding(funding(), request({ observation: observation({ amount: 90_000n }) }));
    expect(short).toMatchObject({ ok: false, code: "UNDERPAYMENT", shortfall: 10_000n });
    const long = confirmFunding(funding(), request({ requestId: "req_2", observation: observation({ amount: 110_000n }) }));
    expect(long).toMatchObject({ ok: false, code: "OVERPAYMENT", excess: 10_000n });
    expect(reconcile(funding(), agreement(), observation())).toBeNull();
  });

  it("cannot apply the same request id or provider reference twice", () => {
    const context = newFundingContext();
    const first = confirmFunding(funding(), request(), context);
    const retry = confirmFunding(funding(), request(), context);
    expect(first.ok && retry.ok && retry.replayed).toBe(true);
    expect(retry.ok && retry.audit.type).toBe("escrow.confirm.replayed");
    const differentProject = confirmFunding(
      funding({ projectId: "prj_2", agreementId: "agr_2", state: "awaiting-funding" }),
      request({ requestId: "req_2", agreement: agreement({ id: "agr_2", projectId: "prj_2" }) }),
      context,
    );
    expect(differentProject).toMatchObject({ ok: false, code: "REFERENCE_CONFLICT" });
    expect(viewStateForResult(differentProject)).toBe("conflict");
    expect(viewStateForResult(first)).toBe("success");
    expect(viewStateForResult(undefined)).toBe("empty");
    expect(viewStateForResult(undefined, true)).toBe("loading");
  });
});
