import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  CAPSTONE_CONTRACT_VERSION,
  apiError,
  commandEnvelope,
  eventEnvelope,
  evidenceRef,
  isoDate,
  isoInstant,
  money,
  page,
  pageQuery,
  parseContract,
  revision,
} from "./contracts-v1";

const pid = "prj_0123456789ABCDEF";

describe("capstone contracts v1", () => {
  it("validates money as integer minor units with a currency code", () => {
    expect(money.safeParse({ amountMinor: "123456789012345678901", currency: "USD" }).success).toBe(true);
    expect(money.safeParse({ amountMinor: "-5", currency: "XLM" }).success).toBe(true);
    for (const bad of [{ amountMinor: "1.5", currency: "USD" }, { amountMinor: "01", currency: "USD" }, { amountMinor: "5", currency: "usd" }, { amountMinor: 5, currency: "USD" }]) {
      expect(money.safeParse(bad).success).toBe(false);
    }
  });

  it("validates dates and instants", () => {
    expect(isoInstant.safeParse("2026-03-01T12:00:00Z").success).toBe(true);
    expect(isoInstant.safeParse("2026-03-01T12:00:00.123Z").success).toBe(true);
    expect(isoInstant.safeParse("2026-03-01 12:00").success).toBe(false);
    expect(isoDate.safeParse("2026-03-01").success).toBe(true);
    expect(isoDate.safeParse("03/01/2026").success).toBe(false);
  });

  it("validates evidence references and revisions", () => {
    const evidence = { id: "ref_0123456789ABCDEF", kind: "dataset", sha256: "a".repeat(64), title: "Survey data" };
    expect(evidenceRef.safeParse(evidence).success).toBe(true);
    expect(evidenceRef.safeParse({ ...evidence, sha256: "xyz" }).success).toBe(false);
    expect(revision.safeParse({ number: 2, token: "tok-12345678", updatedAt: "2026-01-01T00:00:00Z" }).success).toBe(true);
    expect(revision.safeParse({ number: 0, token: "short", updatedAt: "x" }).success).toBe(false);
  });

  it("tolerates unknown fields on read (backward/forward compatible)", () => {
    const withExtra = { schemaVersion: 1, requestId: "req-12345678", type: "project.create", payload: {}, addedLater: "ignored" };
    const parsed = parseContract(commandEnvelope, withExtra);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.value.addedLater).toBe("ignored");
    expect(apiError.safeParse({ code: "CONFLICT", message: "m", retryable: false, newField: 1 }).success).toBe(true);
  });

  it("reports a newer schema version explicitly", () => {
    const result = parseContract(commandEnvelope, { schemaVersion: CAPSTONE_CONTRACT_VERSION + 1, requestId: "req-12345678", type: "x", payload: {} });
    expect(result).toMatchObject({ ok: false, error: { code: "UNSUPPORTED_VERSION", retryable: false } });
  });

  it("returns stable field-level errors without throwing", () => {
    const result = parseContract(commandEnvelope, { schemaVersion: 1, requestId: "x", type: "", payload: {} });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION_FAILED");
      expect(result.error.fieldErrors?.map((f) => f.path).sort()).toEqual(["requestId", "type"]);
    }
  });

  it("paginates with a bounded limit and nullable cursor", () => {
    expect(pageQuery.parse({})).toEqual({ limit: 25 });
    expect(pageQuery.safeParse({ limit: 101 }).success).toBe(false);
    const schema = page(z.object({ id: z.string() }));
    expect(schema.safeParse({ items: [{ id: "a" }], nextCursor: null }).success).toBe(true);
    expect(schema.safeParse({ items: [{ id: 1 }], nextCursor: null }).success).toBe(false);
  });

  it("events carry only references and counters, never nested private payloads", () => {
    const event = { schemaVersion: 1, eventId: "evt-12345678", type: "project.state_changed", occurredAt: "2026-01-01T00:00:00Z", subject: pid, data: { from: "draft", to: "proposed", revision: 2 } };
    expect(eventEnvelope.safeParse(event).success).toBe(true);
    expect(eventEnvelope.safeParse({ ...event, data: { notes: { secret: "x" } } }).success).toBe(false);
  });
});
