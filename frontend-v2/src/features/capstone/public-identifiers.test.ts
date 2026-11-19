import { describe, expect, it } from "vitest";
import {
  PublicIdMap,
  generateCorrelationId,
  generatePublicId,
  isPublicId,
  parseVersionRef,
  versionRef,
  type ByteSource,
} from "./public-identifiers";

/** Deterministic byte source: a counter-seeded xorshift stream. */
function seeded(seed: number): ByteSource {
  let s = seed >>> 0 || 1;
  return (length) => {
    const out = new Uint8Array(length);
    for (let i = 0; i < length; i += 1) {
      s ^= s << 13;
      s >>>= 0;
      s ^= s >>> 17;
      s ^= s << 5;
      s >>>= 0;
      out[i] = s & 255;
    }
    return out;
  };
}

describe("public identifiers", () => {
  it("generates prefixed, 16-character, validated ids", () => {
    const id = generatePublicId("project", seeded(1));
    expect(id).toMatch(/^prj_[0-9A-HJKMNP-TV-Z]{16}$/);
    expect(isPublicId(id)).toBe(true);
    expect(isPublicId(id, "project")).toBe(true);
    expect(isPublicId(id, "call")).toBe(false);
  });

  it("is deterministic for a deterministic source and different across seeds", () => {
    expect(generatePublicId("call", seeded(7))).toBe(generatePublicId("call", seeded(7)));
    expect(generatePublicId("call", seeded(7))).not.toBe(generatePublicId("call", seeded(8)));
  });

  it("does not collide across many generations and is not sequential", () => {
    const bytes = seeded(42);
    const ids = Array.from({ length: 5000 }, () => generatePublicId("project", bytes));
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort().join()).not.toBe(ids.join());
  });

  it("uses the real crypto source by default", () => {
    expect(generatePublicId("team")).not.toBe(generatePublicId("team"));
    expect(generateCorrelationId()).toMatch(/^cor_[0-9A-HJKMNP-TV-Z]{16}$/);
  });

  it("rejects malformed ids", () => {
    for (const bad of ["", "prj_", "prj_123", "xxx_0000000000000000", "prj_0000000000000000U", "PRJ_0000000000000000", 5, null]) {
      expect(isPublicId(bad)).toBe(false);
    }
  });

  it("builds and parses version references", () => {
    const id = generatePublicId("proposal", seeded(3));
    expect(versionRef(id, 3)).toBe(`${id}@v3`);
    expect(parseVersionRef(`${id}@v3`)).toEqual({ publicId: id, version: 3 });
    expect(parseVersionRef(`${id}@v0`)).toBeNull();
    expect(parseVersionRef("nope@v1")).toBeNull();
    expect(() => versionRef("bad", 1)).toThrow();
    expect(() => versionRef(id, 0)).toThrow();
  });

  it("keeps internal keys linked, stable and out of the public id", () => {
    const map = new PublicIdMap(seeded(5));
    const a = map.publicIdFor("project", "internal-123");
    expect(map.publicIdFor("project", "internal-123")).toBe(a);
    expect(a).not.toContain("123");
    expect(map.internalKeyFor(a)).toBe("internal-123");
    expect(map.internalKeyFor("prj_0000000000000000")).toBeUndefined();
  });

  it("retries on a collision instead of reusing an id for a different key", () => {
    // A source that repeats the same bytes twice, then moves on.
    let calls = 0;
    const source: ByteSource = (n) => new Uint8Array(n).fill(calls++ < 2 ? 9 : calls);
    const map = new PublicIdMap(source);
    const first = map.publicIdFor("call", "k1");
    const second = map.publicIdFor("call", "k2");
    expect(first).not.toBe(second);
    expect(map.internalKeyFor(second)).toBe("k2");
  });
});
