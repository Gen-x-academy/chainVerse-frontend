import { describe, expect, it } from "vitest";
import { DELIVERY_MODES, SAFETY_BY_MODE, locationFor, readyToStart, requiredSafety, validateDelivery, type DeliveryConfig } from "./delivery-modes";

const config = (over: Partial<DeliveryConfig> = {}): DeliveryConfig => ({
  mode: "in_person",
  location: { region: "Lagos, NG", exactAddress: "12 Example Street" },
  satisfied: ["code_of_conduct", "site_induction", "emergency_contact"],
  ...over,
});

describe("delivery modes", () => {
  it("defines safety requirements for every mode, remote being the lightest", () => {
    for (const mode of DELIVERY_MODES) expect(requiredSafety(mode).length).toBeGreaterThan(0);
    expect(SAFETY_BY_MODE.remote).toEqual(["code_of_conduct"]);
    expect(SAFETY_BY_MODE.laboratory).toContain("lab_safety_training");
    expect(SAFETY_BY_MODE.fieldwork).toEqual(expect.arrayContaining(["risk_assessment", "buddy_system", "insurance_cover"]));
  });

  it("accepts a complete in-person configuration", () => {
    expect(validateDelivery(config())).toEqual([]);
    expect(readyToStart(config())).toBe(true);
  });

  it("lists every missing mode-specific safety requirement", () => {
    const lab = validateDelivery(config({ mode: "laboratory", satisfied: ["code_of_conduct"] }));
    expect(lab.map((i) => i.field).sort()).toEqual(["safety.emergency_contact", "safety.lab_safety_training", "safety.risk_assessment", "safety.site_induction", "safety.supervisor_on_site"]);
    expect(readyToStart(config({ mode: "laboratory", satisfied: ["code_of_conduct"] }))).toBe(false);
  });

  it("requires a region for non-remote modes and forbids addresses for remote ones", () => {
    expect(validateDelivery(config({ location: undefined })).map((i) => i.field)).toContain("location.region");
    const remote = validateDelivery({ mode: "remote", location: { region: "Anywhere", exactAddress: "1 Main St" }, satisfied: ["code_of_conduct"] });
    expect(remote.map((i) => i.field)).toEqual(["location.exactAddress"]);
    expect(validateDelivery({ mode: "remote", satisfied: ["code_of_conduct"] })).toEqual([]);
  });

  it("validates the hybrid on-site fraction", () => {
    const hybrid = (onSiteFraction?: number) => validateDelivery(config({ mode: "hybrid", onSiteFraction })).map((i) => i.field);
    expect(hybrid(0.5)).toEqual([]);
    expect(hybrid(undefined)).toEqual(["onSiteFraction"]);
    expect(hybrid(0)).toEqual(["onSiteFraction"]);
    expect(hybrid(1)).toEqual(["onSiteFraction"]);
    expect(validateDelivery(config({ onSiteFraction: 0.5 })).map((i) => i.field)).toEqual(["onSiteFraction"]);
  });

  it("rejects unknown modes", () => {
    expect(validateDelivery({ mode: "teleport" as never, satisfied: [] })).toHaveLength(1);
  });

  it("shows the exact address only to confirmed participants and organizers", () => {
    const c = config();
    expect(locationFor(c, "public")).toEqual({ mode: "in_person", region: "Lagos, NG", exactAddress: null });
    expect(locationFor(c, "applicant").exactAddress).toBeNull();
    expect(locationFor(c, "confirmed").exactAddress).toBe("12 Example Street");
    expect(locationFor(c, "organizer").exactAddress).toBe("12 Example Street");
  });

  it("never exposes an address for remote projects", () => {
    const remote: DeliveryConfig = { mode: "remote", location: { region: "Global", exactAddress: "leaked" }, satisfied: ["code_of_conduct"] };
    expect(locationFor(remote, "organizer").exactAddress).toBeNull();
  });
});
