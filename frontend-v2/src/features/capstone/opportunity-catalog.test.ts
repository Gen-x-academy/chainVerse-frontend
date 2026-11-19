import { describe, expect, it } from "vitest";
import { MAX_PAGE_SIZE, canSee, searchCatalog, seatStatus, type CatalogQuery, type Opportunity } from "./opportunity-catalog";

const opp = (id: string, over: Partial<Opportunity> = {}): Opportunity => ({
  id,
  kind: "call",
  title: `Opportunity ${id}`,
  disciplines: ["biology"],
  skills: ["python"],
  sponsorId: "spn1",
  cohortId: "co1",
  startsOn: "2026-09-01",
  closesOn: "2026-06-15",
  mode: "remote",
  fundingMinor: "100000",
  seatsTotal: 5,
  seatsTaken: 1,
  waitlistOpen: true,
  visibility: "public",
  organizationId: "org1",
  ...over,
});

const data: Opportunity[] = [
  opp("a", { title: "Genome analysis", disciplines: ["biology", "data science"], skills: ["python", "statistics"], closesOn: "2026-06-10", fundingMinor: "500000" }),
  opp("b", { title: "Climate dashboard", disciplines: ["climate"], skills: ["typescript"], sponsorId: "spn2", mode: "in_person", closesOn: "2026-06-20", seatsTaken: 5 }),
  opp("c", { title: "Ethics review", disciplines: ["law"], skills: ["writing"], cohortId: "co2", closesOn: "2026-06-10", seatsTaken: 5, waitlistOpen: false, fundingMinor: undefined }),
  opp("d", { title: "Org only", visibility: "organization", organizationId: "org9" }),
  opp("e", { title: "Hidden", visibility: "private" }),
];
const ids = (q: CatalogQuery, viewer = {}) => {
  const r = searchCatalog(data, q, viewer);
  if (!r.ok) throw new Error(r.error);
  return r.page.entries.map((e) => e.id);
};

describe("opportunity catalog", () => {
  it("applies visibility before filters: private and other-organization items never appear", () => {
    expect(ids({})).toEqual(["a", "c", "b"]);
    expect(ids({}, { organizationId: "org9" })).toEqual(["a", "c", "d", "b"]);
    expect(ids({ text: "hidden" })).toEqual([]);
    expect(canSee(data[3], { organizationId: "org1" })).toBe(false);
    expect(canSee(data[3], {})).toBe(false);
    expect(canSee(data[4], { organizationId: "org1" })).toBe(false);
  });

  it("filters by discipline, skill, sponsor, cohort, mode and text", () => {
    expect(ids({ disciplines: ["Climate"] })).toEqual(["b"]);
    expect(ids({ skills: ["python", "STATISTICS"] })).toEqual(["a"]);
    expect(ids({ sponsorId: "spn2" })).toEqual(["b"]);
    expect(ids({ cohortId: "co2" })).toEqual(["c"]);
    expect(ids({ modes: ["in_person"] })).toEqual(["b"]);
    expect(ids({ text: "genome python" })).toEqual(["a"]);
  });

  it("filters by dates, funding and seat status", () => {
    expect(ids({ closesBefore: "2026-06-12" })).toEqual(["a", "c"]);
    expect(ids({ startsAfter: "2026-09-02" })).toEqual([]);
    expect(ids({ minFundingMinor: "200000" })).toEqual(["a"]);
    expect(ids({ minFundingMinor: "abc" })).toEqual([]);
    expect(ids({ seatStatus: "open" })).toEqual(["a"]);
    expect(ids({ seatStatus: "waitlist" })).toEqual(["b"]);
    expect(ids({ seatStatus: "full" })).toEqual(["c"]);
    expect(seatStatus({ seatsTotal: 1, seatsTaken: 1, waitlistOpen: false })).toBe("full");
  });

  it("filters by eligibility only for signed-in viewers", () => {
    const withRule = data.map((o) => ({ ...o, eligibleFor: (id: string) => id === "u1" && o.id !== "b" }));
    const run = (viewer: object) => {
      const r = searchCatalog(withRule, { onlyEligible: true }, viewer);
      return r.ok ? r.page.entries.map((e) => e.id) : [];
    };
    expect(run({ id: "u1" })).toEqual(["a", "c"]);
    expect(run({ id: "u2" })).toEqual([]);
    expect(run({})).toEqual([]);
    const all = searchCatalog(withRule, {}, { id: "u1" });
    expect(all.ok && all.page.entries.find((e) => e.id === "b")?.eligible).toBe(false);
    const anon = searchCatalog(withRule, {}, {});
    expect(anon.ok && anon.page.entries.every((e) => e.eligible === null)).toBe(true);
  });

  it("sorts deterministically with an id tie-breaker", () => {
    expect(ids({ sort: "closes" })).toEqual(["a", "c", "b"]); // a and c tie on date; id breaks it
    expect(ids({ sort: "title" })).toEqual(["b", "c", "a"]);
    expect(ids({ sort: "funding" })).toEqual(["a", "b", "c"]);
  });

  it("paginates with stable keyset cursors and reports the total", () => {
    const many = Array.from({ length: 7 }, (_, i) => opp(`o${i}`, { closesOn: `2026-06-${String(10 + i).padStart(2, "0")}` }));
    const first = searchCatalog(many, { limit: 3 }, {});
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.page.entries.map((e) => e.id)).toEqual(["o0", "o1", "o2"]);
    expect(first.page.total).toBe(7);
    const second = searchCatalog(many, { limit: 3, cursor: first.page.nextCursor as string }, {});
    if (!second.ok) throw new Error();
    expect(second.page.entries.map((e) => e.id)).toEqual(["o3", "o4", "o5"]);
    const third = searchCatalog(many, { limit: 3, cursor: second.page.nextCursor as string }, {});
    if (!third.ok) throw new Error();
    expect(third.page.entries.map((e) => e.id)).toEqual(["o6"]);
    expect(third.page.nextCursor).toBeNull();
  });

  it("resumes correctly when the cursor item is no longer in the filtered list", () => {
    const many = Array.from({ length: 6 }, (_, i) => opp(`o${i}`, { closesOn: `2026-06-${String(10 + i).padStart(2, "0")}`, seatsTaken: 1 }));
    const first = searchCatalog(many, { limit: 2, seatStatus: "open" }, {});
    if (!first.ok) throw new Error();
    // o1 fills up between requests and drops out of the "open" filter.
    const changed = many.map((o) => (o.id === "o1" ? { ...o, seatsTaken: 5, waitlistOpen: false } : o));
    const next = searchCatalog(changed, { limit: 2, seatStatus: "open", cursor: first.page.nextCursor as string }, {});
    if (!next.ok) throw new Error();
    expect(next.page.entries.map((e) => e.id)).toEqual(["o2", "o3"]);
  });

  it("validates the limit and the cursor", () => {
    expect(searchCatalog(data, { limit: 0 }, {})).toEqual({ ok: false, error: "INVALID_LIMIT" });
    expect(searchCatalog(data, { limit: MAX_PAGE_SIZE + 1 }, {})).toEqual({ ok: false, error: "INVALID_LIMIT" });
    expect(searchCatalog(data, { cursor: "%%%" }, {})).toEqual({ ok: false, error: "INVALID_CURSOR" });
  });
});
