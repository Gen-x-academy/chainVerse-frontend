import { describe, expect, it } from "vitest";
import { hasCapacity, isCredentialCurrent, toPublicSupervisorView, validateSupervisorProfile, type SupervisorProfileInput } from "./supervisor-profile";

const input = (): SupervisorProfileInput => ({
  displayName: "Dr. Chen Novak",
  expertise: ["Statistics", "statistics", "Open Science"],
  approach: "Weekly check-ins and written feedback.",
  maxActiveProjects: 4,
  activeProjects: 2,
  languages: ["en", "fr-CA"],
  availableFrom: "2026-02-01",
  affiliations: ["Example University"],
  credentials: [
    { title: "PhD Statistics", issuer: "Example University", verified: true },
    { title: "Certified Mentor", issuer: "Mentor Org", verified: false },
    { title: "Ethics Training", issuer: "Board", verified: true, expiresOn: "2026-01-01" },
  ],
});

describe("supervisor profile", () => {
  it("validates and normalizes expertise", () => {
    const r = validateSupervisorProfile(input());
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.profile.expertise).toEqual(["statistics", "open science"]);
  });

  it("reports field-level issues", () => {
    const r = validateSupervisorProfile({ ...input(), displayName: "", expertise: [], languages: ["english"], maxActiveProjects: 30, availableFrom: "soon" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues.map((i) => i.field).sort()).toEqual(["availableFrom", "displayName", "expertise", "languages", "maxActiveProjects"]);
  });

  it("rejects an active count above capacity", () => {
    const r = validateSupervisorProfile({ ...input(), activeProjects: 5 });
    expect(r.ok).toBe(false);
    expect(hasCapacity({ maxActiveProjects: 4, activeProjects: 4 })).toBe(false);
    expect(hasCapacity({ maxActiveProjects: 4, activeProjects: 3 })).toBe(true);
  });

  it("shows only verified, unexpired credentials publicly", () => {
    const r = validateSupervisorProfile(input());
    if (!r.ok) throw new Error("invalid");
    const view = toPublicSupervisorView(r.profile, "2026-03-01");
    expect(view.verifiedCredentials).toEqual([{ title: "PhD Statistics", issuer: "Example University" }]);
    expect(isCredentialCurrent({ title: "x", issuer: "y", verified: true, expiresOn: "2026-03-01" }, "2026-03-01")).toBe(true);
    expect(isCredentialCurrent({ title: "x", issuer: "y", verified: false }, "2026-03-01")).toBe(false);
  });

  it("reports availability as a yes/no without exposing capacity numbers", () => {
    const r = validateSupervisorProfile(input());
    if (!r.ok) throw new Error("invalid");
    const view = toPublicSupervisorView(r.profile, "2026-03-01");
    expect(view.acceptingProjects).toBe(true);
    expect(JSON.stringify(view)).not.toMatch(/maxActiveProjects|activeProjects/);
    expect(toPublicSupervisorView(r.profile, "2026-01-15").acceptingProjects).toBe(false); // not yet available
    const full = validateSupervisorProfile({ ...input(), activeProjects: 4 });
    if (!full.ok) throw new Error("invalid");
    expect(toPublicSupervisorView(full.profile, "2026-03-01").acceptingProjects).toBe(false);
  });
});
