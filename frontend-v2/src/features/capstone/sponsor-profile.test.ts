import { describe, expect, it } from "vitest";
import {
  authorizeFunding,
  toParticipantSponsorView,
  toPublicSponsorView,
  validateSponsorProfile,
  type SponsorProfile,
} from "./sponsor-profile";

const sponsor = (): SponsorProfile => ({
  id: "spn_1",
  name: "Example Foundation",
  status: "approved",
  themes: ["Climate Data", "climate data", "Open Science"],
  contacts: [
    { role: "program-lead", name: "Pat Example", email: "pat@example.test" },
    { role: "finance", name: "Fin Example", email: "fin@example.test" },
  ],
  funding: { currency: "USD", maxAwardMinor: "5000000", remainingMinor: "12000000" },
  disclosure: "named",
  visibility: "public",
});

describe("sponsor profile", () => {
  it("validates and normalizes themes", () => {
    const r = validateSponsorProfile(sponsor());
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.profile.themes).toEqual(["climate data", "open science"]);
  });

  it("reports field-level issues, including an award larger than the remaining budget", () => {
    const r = validateSponsorProfile({ ...sponsor(), name: "x", themes: [], contacts: [{ role: "finance", name: "", email: "nope" }], funding: { currency: "usd", maxAwardMinor: "1", remainingMinor: "2" } });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues.map((i) => i.field).sort()).toEqual(["contacts[0].email", "contacts[0].name", "funding.currency", "name", "themes"]);
    const big = validateSponsorProfile({ ...sponsor(), funding: { currency: "USD", maxAwardMinor: "900", remainingMinor: "100" } });
    expect(big.ok).toBe(false);
  });

  it("authorizes funding only for approved sponsors within their authority", () => {
    expect(authorizeFunding(sponsor(), "USD", "5000000")).toEqual({ ok: true, remainingMinor: "7000000" });
    expect(authorizeFunding({ ...sponsor(), status: "pending" }, "USD", "1")).toEqual({ ok: false, code: "NOT_APPROVED" });
    expect(authorizeFunding({ ...sponsor(), status: "suspended" }, "USD", "1")).toEqual({ ok: false, code: "NOT_APPROVED" });
    expect(authorizeFunding(sponsor(), "EUR", "1")).toEqual({ ok: false, code: "CURRENCY_MISMATCH" });
    expect(authorizeFunding(sponsor(), "USD", "5000001")).toEqual({ ok: false, code: "EXCEEDS_AWARD_LIMIT" });
    for (const bad of ["0", "-1", "1.5", "abc"]) expect(authorizeFunding(sponsor(), "USD", bad)).toEqual({ ok: false, code: "INVALID_AMOUNT" });
    const low = { ...sponsor(), funding: { currency: "USD", maxAwardMinor: "5000000", remainingMinor: "100" } };
    expect(authorizeFunding(low, "USD", "101")).toEqual({ ok: false, code: "INSUFFICIENT_FUNDS" });
  });

  it("handles amounts beyond the safe integer range exactly", () => {
    const rich = { ...sponsor(), funding: { currency: "USD", maxAwardMinor: "99999999999999999999", remainingMinor: "100000000000000000000" } };
    expect(authorizeFunding(rich, "USD", "99999999999999999999")).toEqual({ ok: true, remainingMinor: "1" });
  });

  it("public view hides contacts and funding, and follows the disclosure policy", () => {
    const view = toPublicSponsorView(sponsor());
    expect(view).toEqual({ id: "spn_1", name: "Example Foundation", themes: ["climate data", "open science"] });
    expect(JSON.stringify(view)).not.toMatch(/example\.test|funding|Pat Example/);
    expect(toPublicSponsorView({ ...sponsor(), disclosure: "anonymous" })?.name).toBeNull();
    expect(toPublicSponsorView({ ...sponsor(), disclosure: "on_request" })?.name).toBeNull();
  });

  it("hides sponsors that are not approved or not public from the public", () => {
    expect(toPublicSponsorView({ ...sponsor(), status: "pending" })).toBeNull();
    expect(toPublicSponsorView({ ...sponsor(), visibility: "participants" })).toBeNull();
  });

  it("participants see contact roles but never names or emails", () => {
    const view = toParticipantSponsorView({ ...sponsor(), visibility: "participants" });
    expect(view?.contactRoles).toEqual(["finance", "program-lead"]);
    expect(JSON.stringify(view)).not.toMatch(/example\.test|Pat|Fin /);
    expect(toParticipantSponsorView({ ...sponsor(), visibility: "reviewers" })).toBeNull();
    expect(toParticipantSponsorView({ ...sponsor(), disclosure: "anonymous" })?.name).toBeNull();
  });
});
