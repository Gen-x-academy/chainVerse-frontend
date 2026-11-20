import { describe, expect, it } from "vitest";
import {
  buildShowcase,
  isPublicUrl,
  showcaseAnalytics,
  showcaseViewState,
  unsafePublicLinks,
  type ShowcaseSource,
} from "./project-showcase";

const source = (over: Partial<ShowcaseSource> = {}): ShowcaseSource => ({
  id: "s1",
  projectId: "p1",
  organizationId: "org1",
  revision: 1,
  abstract: { text: "An open dataset for water quality.", approved: true, visibility: "public" },
  contributors: [
    { id: "u1", displayName: "Ada Lovelace", role: "Author", consentedToPublic: true },
    { id: "u2", displayName: "Private Person", role: "Reviewer", consentedToPublic: false },
  ],
  outputs: [{ id: "o1", title: "Dataset v1", url: "https://example.org/data", approved: true, visibility: "public" }],
  demonstrations: [{ id: "d1", title: "Demo", url: "https://example.org/demo", approved: true, visibility: "public" }],
  citations: [{ id: "c1", title: "Paper", approved: true, visibility: "public" }],
  license: "CC BY 4.0",
  fundingAcknowledgement: "Funded by Example Foundation.",
  verificationLinks: [{ id: "v1", title: "DOI", url: "https://doi.org/10.1000/xyz", approved: true, visibility: "public" }],
  ...over,
});
const options = { publicShowcaseEnabled: true, approvalStatus: "approved" as const, expectedRevision: 1 };
const page = (r: ReturnType<typeof buildShowcase>) => (r.ok ? r.page : null);

describe("public showcase links", () => {
  it("accepts public HTTPS links and rejects private or credentialed ones", () => {
    expect(isPublicUrl("https://example.org/x")).toBe(true);
    expect(isPublicUrl("http://example.org/x")).toBe(false);
    expect(isPublicUrl("https://localhost:3000/x")).toBe(false);
    expect(isPublicUrl("https://192.168.1.4/x")).toBe(false);
    expect(isPublicUrl("https://user:pass@example.org/x")).toBe(false);
    expect(isPublicUrl("https://example.org/x?token=abc")).toBe(false);
    expect(isPublicUrl("not a url")).toBe(false);
  });

  it("flags only approved public items with unsafe links", () => {
    const s = source({
      outputs: [
        { id: "bad", title: "Internal", url: "https://localhost/data", approved: true, visibility: "public" },
        { id: "team", title: "Internal", url: "http://localhost/data", approved: true, visibility: "team" },
      ],
    });
    expect(unsafePublicLinks(s)).toEqual(["bad"]);
  });
});

describe("building a showcase page", () => {
  it("publishes only approved, public, consented content", () => {
    const result = buildShowcase(source(), options);
    expect(result.ok).toBe(true);
    const p = page(result)!;
    expect(p.abstract).toContain("water quality");
    expect(p.contributors.map((c) => c.displayName)).toEqual(["Ada Lovelace"]);
    expect(p.outputs).toHaveLength(1);
    expect(p.sections).toContain("verification");
    const serialized = JSON.stringify(p);
    expect(serialized).not.toContain("Private Person");
    expect(serialized).not.toContain("privateAgreementRef");
  });

  it("drops unapproved and team-only material", () => {
    const p = page(buildShowcase(source({
      abstract: { text: "Secret draft", approved: false, visibility: "team" },
      outputs: [{ id: "o1", title: "Hidden", approved: true, visibility: "team" }],
      demonstrations: [],
      citations: [],
      license: null,
      fundingAcknowledgement: null,
      verificationLinks: [],
      contributors: [],
    }), options))!;
    expect(p.abstract).toBeNull();
    expect(p.outputs).toEqual([]);
    expect(p.sections).toEqual([]);
    expect(JSON.stringify(p)).not.toContain("Secret draft");
  });

  it("enforces the feature flag, approval and revision at publish time", () => {
    expect(buildShowcase(source(), { ...options, publicShowcaseEnabled: false })).toMatchObject({ ok: false, code: "FEATURE_DISABLED" });
    expect(buildShowcase(source(), { ...options, approvalStatus: "collecting" })).toMatchObject({ ok: false, code: "NOT_APPROVED" });
    expect(buildShowcase(source(), { ...options, expectedRevision: 7 })).toMatchObject({ ok: false, code: "STALE_REVISION" });
    expect(buildShowcase(source({
      verificationLinks: [{ id: "v1", title: "Internal", url: "https://localhost/admin", approved: true, visibility: "public" }],
    }), options)).toMatchObject({ ok: false, code: "UNSAFE_LINK" });
  });
});

describe("view states and analytics", () => {
  it("maps results to loading, empty, conflict, error and success states", () => {
    expect(showcaseViewState(null).kind).toBe("loading");
    expect(showcaseViewState(null, true).kind).toBe("loading");
    expect(showcaseViewState({ ok: false, code: "STALE_REVISION", message: "reload" }).kind).toBe("conflict");
    expect(showcaseViewState({ ok: false, code: "NOT_APPROVED", message: "wait" }).kind).toBe("error");
    expect(showcaseViewState(buildShowcase(source({ abstract: undefined, contributors: [], outputs: [], demonstrations: [], citations: [], license: null, fundingAcknowledgement: null, verificationLinks: [] }), options)).kind).toBe("empty");
    expect(showcaseViewState(buildShowcase(source(), options)).kind).toBe("success");
  });

  it("reports counts only, with no titles or identities", () => {
    const p = page(buildShowcase(source(), options))!;
    expect(showcaseAnalytics(p)).toEqual({ sections: 8, contributors: 1, outputs: 1, demonstrations: 1, citations: 1, verification: 1 });
    expect(JSON.stringify(showcaseAnalytics(p))).not.toContain("Ada");
    expect(JSON.stringify(showcaseAnalytics(p))).not.toContain("water quality");
  });
});
