import { describe, expect, it } from "vitest";
import {
  VISIBILITY_FIELDS,
  canViewField,
  defaultVisibility,
  setFieldVisibility,
  visibleProfile,
  type VisibilitySettings,
} from "./profile-visibility";

function apply(settings: VisibilitySettings, field: string, audience: string, consent = false) {
  const r = setFieldVisibility(settings, field, audience, { consent });
  if (!r.ok) throw new Error(r.code);
  return r.settings;
}

describe("profile visibility controls", () => {
  it("defaults every field to private for everyone but the owner", () => {
    const s = defaultVisibility();
    for (const field of VISIBILITY_FIELDS) {
      expect(s.fields[field]).toBe("private");
      for (const viewer of ["team", "supervisors", "sponsors", "public"] as const) expect(canViewField(s, field, viewer)).toBe(false);
      expect(canViewField(s, field, "private", true)).toBe(true);
    }
  });

  it("shows a field to audiences no wider than its setting", () => {
    const s = apply(defaultVisibility(), "skills", "sponsors");
    expect(canViewField(s, "skills", "team")).toBe(true);
    expect(canViewField(s, "skills", "supervisors")).toBe(true);
    expect(canViewField(s, "skills", "sponsors")).toBe(true);
    expect(canViewField(s, "skills", "public")).toBe(false);
  });

  it("does not mutate the previous settings", () => {
    const before = defaultVisibility();
    apply(before, "skills", "public");
    expect(before.fields.skills).toBe("private");
  });

  it("requires explicit consent to widen contact fields past supervisors", () => {
    const s = defaultVisibility();
    expect(setFieldVisibility(s, "contactEmail", "public")).toMatchObject({ ok: false, code: "CONSENT_REQUIRED" });
    expect(setFieldVisibility(s, "contactPhone", "sponsors")).toMatchObject({ ok: false, code: "CONSENT_REQUIRED" });
    expect(setFieldVisibility(s, "contactEmail", "supervisors")).toMatchObject({ ok: true });
    const consented = apply(s, "contactEmail", "public", true);
    expect(consented.consents).toEqual(["contactEmail"]);
    expect(canViewField(consented, "contactEmail", "public")).toBe(true);
  });

  it("removes the consent when a contact field is narrowed again", () => {
    const wide = apply(defaultVisibility(), "contactEmail", "public", true);
    const narrow = apply(wide, "contactEmail", "supervisors");
    expect(narrow.consents).toEqual([]);
  });

  it("treats a wide contact setting without recorded consent as capped", () => {
    const tampered: VisibilitySettings = { fields: { ...defaultVisibility().fields, contactEmail: "public" }, consents: [] };
    expect(canViewField(tampered, "contactEmail", "public")).toBe(false);
    expect(canViewField(tampered, "contactEmail", "supervisors")).toBe(true);
  });

  it("rejects unknown fields and audiences", () => {
    expect(setFieldVisibility(defaultVisibility(), "passport", "public")).toMatchObject({ ok: false, code: "UNKNOWN_FIELD" });
    expect(setFieldVisibility(defaultVisibility(), "skills", "world")).toMatchObject({ ok: false, code: "UNKNOWN_AUDIENCE" });
  });

  it("filters a profile object to what the viewer may see", () => {
    let s = defaultVisibility();
    s = apply(s, "skills", "public");
    s = apply(s, "portfolio", "supervisors");
    const profile = { skills: ["rust"], portfolio: ["a"], contactEmail: "a@example.test", other: 1 };
    expect(visibleProfile(profile, s, "public")).toEqual({ skills: ["rust"] });
    expect(visibleProfile(profile, s, "supervisors")).toEqual({ skills: ["rust"], portfolio: ["a"] });
    expect(Object.keys(visibleProfile(profile, s, "private", true)).sort()).toEqual(["contactEmail", "portfolio", "skills"]);
  });
});
