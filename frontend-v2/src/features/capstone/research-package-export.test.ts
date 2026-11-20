import { describe, expect, it } from "vitest";
import {
  buildResearchPackage,
  exportAuditRecord,
  verifyPackageIntegrity,
  type ExportRequest,
  type PackageOutput,
} from "./research-package-export";

const sha = (c: string) => c.repeat(64).slice(0, 64);
const output = (over: Partial<PackageOutput> = {}): PackageOutput => ({
  id: "out_1",
  projectId: "prj_1",
  visibility: "public",
  path: "data/set.csv",
  title: "Open dataset",
  mediaType: "text/csv",
  sizeBytes: 42,
  sha256: sha("a"),
  license: "CC-BY-4.0",
  citation: { title: "Open dataset", year: 2026 },
  dependsOn: ["dep-a"],
  ...over,
});
const request = (over: Partial<ExportRequest> = {}): ExportRequest => ({
  requestId: "req-1",
  actor: { id: "u1", role: "supervisor", organizationId: "org-1" },
  resource: { projectId: "prj_1", organizationId: "org-1", projectState: "completed", revision: 2, assignedIds: ["u1"], privatePayloads: { secret: "do not export" } },
  outputIds: ["out_1"],
  sharing: { audience: "recipient_only", expiresAt: "2026-12-01T00:00:00.000Z" },
  now: "2026-11-20T00:00:00.000Z",
  ...over,
});

describe("research package export (CAPSTONE-096)", () => {
  it("packages permitted outputs with metadata, manifest and reproducibility steps", async () => {
    const result = await buildResearchPackage(request(), [output()]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.package.integrity.outputCount).toBe(1);
    expect(result.package.manifest).toMatchObject({ dependencyIds: ["dep-a"] });
    expect(result.package.citations).toHaveLength(1);
    expect(result.package.licenses[0].license).toBe("CC-BY-4.0");
    expect(result.package.reproducibility.length).toBeGreaterThan(0);
    expect(JSON.stringify(result.package)).not.toContain("do not export");
    expect(await verifyPackageIntegrity(result.package)).toBe(true);
  });

  it("produces byte-identical packages for reordered inputs and is idempotent on retries", async () => {
    const a = await buildResearchPackage(request({ outputIds: ["out_1", "out_2"] }), [output(), output({ id: "out_2", sha256: sha("b") })]);
    const b = await buildResearchPackage(
      request({ outputIds: ["out_2", "out_1"] }),
      [output({ id: "out_2", sha256: sha("b") }), output()],
    );
    expect(a.ok && b.ok && JSON.stringify(a.package) === JSON.stringify(b.package)).toBe(true);
    const ledger = new Map();
    const first = await buildResearchPackage(request(), [output()], ledger);
    const retry = await buildResearchPackage(request(), [output()], ledger);
    expect(first.ok && retry.ok && retry.replayed).toBe(true);
    expect(retry.ok && first.ok && retry.package === first.package).toBe(true);
  });

  it("skips restricted and foreign outputs instead of leaking them", async () => {
    const result = await buildResearchPackage(
      request({ outputIds: ["out_1", "out_2", "out_3"] }),
      [output(), output({ id: "out_2", visibility: "restricted" }), output({ id: "out_3", projectId: "prj_other" })],
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.skipped).toEqual([
      { id: "out_2", reason: "NOT_PERMITTED" },
      { id: "out_3", reason: "NOT_FOUND" },
    ]);
  });

  it("denies unknown roles, cross-tenant access and unassigned supervisors", async () => {
    const role = await buildResearchPackage(request({ actor: { id: "u1", role: "student", organizationId: "org-1" } }), [output()]);
    const tenant = await buildResearchPackage(request({ actor: { id: "u1", role: "administrator", organizationId: "org-2" } }), [output()]);
    const unassigned = await buildResearchPackage(request({ resource: { ...request().resource, assignedIds: [] } }), [output()]);
    expect(role).toMatchObject({ ok: false, code: "UNKNOWN_ROLE" });
    expect(tenant).toMatchObject({ ok: false, code: "TENANT_MISMATCH" });
    expect(unassigned).toMatchObject({ ok: false, code: "NOT_PERMITTED" });
  });

  it("rejects stale, unpublished, expired and malformed requests with stable codes", async () => {
    const base = request();
    expect(await buildResearchPackage({ ...base, resource: { ...base.resource, revision: 0 } }, [output()])).toMatchObject({ ok: false, code: "STALE_REVISION" });
    expect(await buildResearchPackage({ ...base, resource: { ...base.resource, projectState: "active" } }, [output()])).toMatchObject({ ok: false, code: "NOT_EXPORTABLE" });
    expect(await buildResearchPackage({ ...base, sharing: { ...base.sharing, expiresAt: "2026-01-01T00:00:00.000Z" } }, [output()])).toMatchObject({ ok: false, code: "INVALID_EXPIRY" });
    expect(await buildResearchPackage({ ...base, outputIds: [] }, [output()])).toMatchObject({ ok: false, code: "EMPTY_PACKAGE" });
    expect(await buildResearchPackage({ ...base }, [output({ sha256: "bad" })])).toMatchObject({ ok: false, code: "INVALID_CHECKSUM" });
  });

  it("detects tampering and writes privacy-safe audit records", async () => {
    const result = await buildResearchPackage(request(), [output()]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const tampered = { ...result.package, outputs: [{ ...result.package.outputs[0], title: "Changed" }] };
    expect(await verifyPackageIntegrity(tampered)).toBe(false);
    expect(Object.keys(exportAuditRecord(result)).sort()).toEqual(["expiresAt", "outcome", "outputCount", "projectId", "replayed"]);
    expect(JSON.stringify(exportAuditRecord(result))).not.toContain("Open dataset");
  });
});
