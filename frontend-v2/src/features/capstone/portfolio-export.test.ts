import { describe, expect, it } from "vitest";
import { buildPortfolioExport, canonicalize, sha256Hex, verifyPortfolioExport, type PortfolioItem } from "./portfolio-export";

const items: PortfolioItem[] = [
  { id: "b-output", kind: "output", title: "Dataset", summary: "Open dataset", evidenceSha256: "a".repeat(64) },
  { id: "a-role", kind: "role", title: "Lead analyst", summary: "Led analysis" },
  { id: "secret", kind: "output", title: "Private draft", summary: "Not for sharing", restricted: true },
  { id: "pub", kind: "publication", title: "Paper", summary: "Published paper" },
];
const options = { displayName: "Ada Okoye", sharing: { audience: "recipient_only" as const, expiresOn: "2026-12-31" }, now: new Date("2026-03-01T10:00:00Z") };

describe("portfolio export", () => {
  it("exports only selected shareable items, sorted, with integrity metadata", async () => {
    const { bundle, skipped } = await buildPortfolioExport(items, ["pub", "b-output", "a-role"], options);
    expect(bundle.items.map((i) => i.id)).toEqual(["a-role", "b-output", "pub"]);
    expect(bundle.integrity).toMatchObject({ algorithm: "SHA-256", itemCount: 3 });
    expect(bundle.integrity.digest).toMatch(/^[0-9a-f]{64}$/);
    expect(skipped).toEqual([]);
    expect(bundle.exportedAt).toBe("2026-03-01T10:00:00.000Z");
  });

  it("never exports restricted items and reports what was skipped", async () => {
    const { bundle, skipped } = await buildPortfolioExport(items, ["secret", "missing", "pub", "pub"], options);
    expect(bundle.items.map((i) => i.id)).toEqual(["pub"]);
    expect(skipped).toEqual([{ id: "secret", reason: "RESTRICTED" }, { id: "missing", reason: "NOT_FOUND" }]);
    expect(JSON.stringify(bundle)).not.toMatch(/restricted|Private draft/);
  });

  it("verifies an untouched bundle and detects tampering", async () => {
    const { bundle } = await buildPortfolioExport(items, ["a-role", "pub"], options);
    expect(await verifyPortfolioExport(bundle)).toEqual({ ok: true });
    const edited = { ...bundle, items: bundle.items.map((i) => (i.id === "pub" ? { ...i, title: "Forged" } : i)) };
    expect(await verifyPortfolioExport(edited)).toEqual({ ok: false, code: "DIGEST_MISMATCH" });
    const fewer = { ...bundle, items: bundle.items.slice(1) };
    expect(await verifyPortfolioExport(fewer)).toEqual({ ok: false, code: "COUNT_MISMATCH" });
    const changedSharing = { ...bundle, sharing: { ...bundle.sharing, audience: "public" as const } };
    expect(await verifyPortfolioExport(changedSharing)).toEqual({ ok: false, code: "DIGEST_MISMATCH" });
  });

  it("is reproducible and independent of property order", async () => {
    const a = await buildPortfolioExport(items, ["pub", "a-role"], options);
    const b = await buildPortfolioExport(items, ["a-role", "pub"], options);
    expect(a.bundle.integrity.digest).toBe(b.bundle.integrity.digest);
    expect(canonicalize({ b: 1, a: [{ d: 1, c: 2 }] })).toBe(canonicalize({ a: [{ c: 2, d: 1 }], b: 1 }));
  });

  it("honours the sharing expiry and rejects unknown versions", async () => {
    const { bundle } = await buildPortfolioExport(items, ["pub"], options);
    expect(await verifyPortfolioExport(bundle, "2026-12-31")).toEqual({ ok: true });
    expect(await verifyPortfolioExport(bundle, "2027-01-01")).toEqual({ ok: false, code: "EXPIRED" });
    expect(await verifyPortfolioExport({ ...bundle, schemaVersion: 2 as never })).toEqual({ ok: false, code: "UNSUPPORTED_VERSION" });
  });

  it("computes a known SHA-256 vector", async () => {
    expect(await sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
});
