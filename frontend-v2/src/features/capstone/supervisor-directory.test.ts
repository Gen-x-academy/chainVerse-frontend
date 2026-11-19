import { describe, expect, it } from "vitest";
import { MAX_LIMIT, searchSupervisors, type DirectoryEntry, type DirectoryQuery } from "./supervisor-directory";

const e = (id: string, over: Partial<DirectoryEntry> = {}): DirectoryEntry => ({
  id,
  displayName: `Dr ${id}`,
  expertise: ["statistics"],
  methods: ["bayesian"],
  languages: ["en"],
  affiliations: ["Example University"],
  deliveryModes: ["remote"],
  availableFrom: "2026-02-01",
  acceptingProjects: true,
  verified: ["identity"],
  eligible: true,
  ...over,
});
const data: DirectoryEntry[] = [
  e("a", { displayName: "Ada Stats", expertise: ["statistics", "genomics"], languages: ["en", "fr"], verified: ["identity", "credential"] }),
  e("b", { displayName: "Bola Ecology", expertise: ["ecology"], methods: ["field survey"], deliveryModes: ["fieldwork", "in_person"], availableFrom: "2026-06-01", acceptingProjects: false }),
  e("c", { displayName: "Chen Climate", expertise: ["climate", "statistics"], affiliations: ["Other Institute"], languages: ["zh", "en"] }),
  e("d", { displayName: "Hidden", eligible: false }),
];
const ids = (q: DirectoryQuery) => {
  const r = searchSupervisors(data, q);
  if (!r.ok) throw new Error(r.error);
  return r.result.supervisors.map((s) => s.id);
};

describe("supervisor directory search", () => {
  it("lists only eligible supervisors, ordered by name", () => {
    expect(ids({})).toEqual(["a", "b", "c"]);
  });

  it("filters by expertise, methods, languages, affiliation and delivery mode", () => {
    expect(ids({ expertise: ["Statistics"] })).toEqual(["a", "c"]);
    expect(ids({ expertise: ["statistics", "genomics"] })).toEqual(["a"]);
    expect(ids({ methods: ["field survey"] })).toEqual(["b"]);
    expect(ids({ languages: ["fr"] })).toEqual(["a"]);
    expect(ids({ affiliation: "other inst" })).toEqual(["c"]);
    expect(ids({ deliveryMode: "fieldwork" })).toEqual(["b"]);
    expect(ids({ text: "ada stats" })).toEqual(["a"]);
  });

  it("filters by availability, acceptance and verified indicators", () => {
    expect(ids({ availableBy: "2026-03-01" })).toEqual(["a", "c"]);
    expect(ids({ acceptingOnly: true })).toEqual(["a", "c"]);
    expect(ids({ verifiedOnly: ["credential"] })).toEqual(["a"]);
    expect(ids({ verifiedOnly: ["identity", "credential"] })).toEqual(["a"]);
  });

  it("ranks by the number of matched filters, then name", () => {
    const r = searchSupervisors(data, { expertise: ["statistics"], languages: ["en"] });
    if (!r.ok) throw new Error();
    expect(r.result.supervisors.map((s) => [s.id, s.matched])).toEqual([["a", 2], ["c", 2]]);
    const more = searchSupervisors(data, { acceptingOnly: true, verifiedOnly: ["credential"] });
    if (!more.ok) throw new Error();
    expect(more.result.supervisors[0]).toMatchObject({ id: "a", matched: 2 });
  });

  it("returns a public projection without capacity, methods or delivery details", () => {
    const r = searchSupervisors(data, {});
    if (!r.ok) throw new Error();
    expect(Object.keys(r.result.supervisors[0]).sort()).toEqual(["acceptingProjects", "affiliations", "displayName", "expertise", "id", "languages", "matched", "verified"]);
    expect(JSON.stringify(r)).not.toMatch(/capacity|activeProjects|email/i);
  });

  it("paginates and validates paging parameters", () => {
    const first = searchSupervisors(data, { limit: 2 });
    const second = searchSupervisors(data, { limit: 2, offset: 2 });
    if (!first.ok || !second.ok) throw new Error();
    expect(first.result.total).toBe(3);
    expect(first.result.supervisors.map((s) => s.id)).toEqual(["a", "b"]);
    expect(second.result.supervisors.map((s) => s.id)).toEqual(["c"]);
    expect(searchSupervisors(data, { limit: 0 })).toEqual({ ok: false, error: "INVALID_LIMIT" });
    expect(searchSupervisors(data, { limit: MAX_LIMIT + 1 })).toEqual({ ok: false, error: "INVALID_LIMIT" });
    expect(searchSupervisors(data, { offset: -1 })).toEqual({ ok: false, error: "INVALID_OFFSET" });
  });

  it("is deterministic regardless of input order", () => {
    const a = searchSupervisors(data, { expertise: ["statistics"] });
    const b = searchSupervisors([...data].reverse(), { expertise: ["statistics"] });
    expect(a).toEqual(b);
  });
});
