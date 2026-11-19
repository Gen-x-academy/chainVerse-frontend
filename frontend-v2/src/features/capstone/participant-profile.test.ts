import { describe, expect, it } from "vitest";
import { validateParticipantProfile, viewProfileFor, normalizeTag, type ParticipantProfileInput } from "./participant-profile";

const valid = (): ParticipantProfileInput => ({
  displayName: "  Ada Okoye ",
  kind: "student",
  skills: ["Rust", " rust ", "Data  Analysis"],
  interests: ["Open Science"],
  availabilityHours: 12,
  portfolio: [{ title: "Thesis", url: "https://example.org/thesis" }],
  preferredRoles: ["Developer", "researcher"],
  accessibilityNeeds: ["Screen reader"],
});

describe("participant profile", () => {
  it("normalizes and de-duplicates skills, trims names, defaults visibility", () => {
    const r = validateParticipantProfile(valid());
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.profile.displayName).toBe("Ada Okoye");
      expect(r.profile.skills).toEqual(["rust", "data analysis"]);
      expect(r.profile.preferredRoles).toEqual(["developer", "researcher"]);
      expect(r.profile.preferenceVisibility).toBe("supervisors");
    }
    expect(normalizeTag("  Ｒust  ")).toBe("rust");
  });

  it("reports field-level issues", () => {
    const r = validateParticipantProfile({ ...valid(), displayName: "A", skills: [], availabilityHours: 70, preferredRoles: ["wizard"], preferenceVisibility: "everyone" as never });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues.map((i) => i.field).sort()).toEqual(["availabilityHours", "displayName", "preferenceVisibility", "preferredRoles", "skills"]);
  });

  it("requires https portfolio URLs without credentials", () => {
    for (const url of ["http://example.org", "https://user:pw@example.org", "not a url", "javascript:alert(1)"]) {
      const r = validateParticipantProfile({ ...valid(), portfolio: [{ title: "x", url }] });
      expect(r.ok, url).toBe(false);
    }
  });

  it("enforces list size limits", () => {
    const many = Array.from({ length: 31 }, (_, i) => `skill${i}`);
    expect(validateParticipantProfile({ ...valid(), skills: many }).ok).toBe(false);
    expect(validateParticipantProfile({ ...valid(), portfolio: Array.from({ length: 11 }, () => ({ title: "t", url: "https://example.org" })) }).ok).toBe(false);
  });

  it("never exposes accessibility needs to anyone but the owner", () => {
    const r = validateParticipantProfile({ ...valid(), preferenceVisibility: "public" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    for (const audience of ["supervisors", "sponsors", "public"] as const) {
      expect(viewProfileFor(r.profile, audience)).not.toHaveProperty("accessibilityNeeds");
    }
    expect(viewProfileFor(r.profile, "private").accessibilityNeeds).toEqual(["screen reader"]);
  });

  it("shows preferences only to audiences the owner opened them to", () => {
    const r = validateParticipantProfile({ ...valid(), preferenceVisibility: "supervisors" });
    if (!r.ok) throw new Error("invalid");
    expect(viewProfileFor(r.profile, "supervisors")).toHaveProperty("interests");
    expect(viewProfileFor(r.profile, "sponsors")).toHaveProperty("interests");
    expect(viewProfileFor(r.profile, "public")).toHaveProperty("interests");
    const strict = validateParticipantProfile({ ...valid(), preferenceVisibility: "private" });
    if (!strict.ok) throw new Error("invalid");
    expect(viewProfileFor(strict.profile, "public")).not.toHaveProperty("interests");
    expect(viewProfileFor(strict.profile, "supervisors")).not.toHaveProperty("interests");
  });
});
