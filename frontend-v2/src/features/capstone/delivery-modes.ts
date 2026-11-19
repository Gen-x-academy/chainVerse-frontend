/**
 * Project delivery modes (CAPSTONE-022).
 *
 * Remote, in-person, hybrid, laboratory and fieldwork modes, each with
 * location privacy rules and the safety requirements that apply to that mode.
 * Precise locations are never shown to people who are not yet confirmed on the
 * project: the public sees only a coarse region.
 */

export type DeliveryMode = "remote" | "in_person" | "hybrid" | "laboratory" | "fieldwork";

export const DELIVERY_MODES: readonly DeliveryMode[] = ["remote", "in_person", "hybrid", "laboratory", "fieldwork"];

export type SafetyRequirement =
  | "code_of_conduct"
  | "site_induction"
  | "lab_safety_training"
  | "risk_assessment"
  | "emergency_contact"
  | "insurance_cover"
  | "buddy_system"
  | "supervisor_on_site";

export const SAFETY_BY_MODE: Readonly<Record<DeliveryMode, readonly SafetyRequirement[]>> = {
  remote: ["code_of_conduct"],
  in_person: ["code_of_conduct", "site_induction", "emergency_contact"],
  hybrid: ["code_of_conduct", "site_induction", "emergency_contact"],
  laboratory: ["code_of_conduct", "site_induction", "emergency_contact", "lab_safety_training", "risk_assessment", "supervisor_on_site"],
  fieldwork: ["code_of_conduct", "emergency_contact", "risk_assessment", "insurance_cover", "buddy_system"],
};

export interface Location {
  /** Coarse area that is safe to show publicly, e.g. "Lagos, NG". */
  region: string;
  /** Precise address or coordinates; confirmed participants only. */
  exactAddress?: string;
}

export interface DeliveryConfig {
  mode: DeliveryMode;
  location?: Location;
  /** Fraction (0-1) of sessions held on site, for hybrid mode. */
  onSiteFraction?: number;
  /** Safety requirements the organizer has marked as satisfied. */
  satisfied: SafetyRequirement[];
}

export interface DeliveryIssue {
  field: string;
  message: string;
}

export function requiredSafety(mode: DeliveryMode): readonly SafetyRequirement[] {
  return SAFETY_BY_MODE[mode];
}

export function validateDelivery(config: DeliveryConfig): DeliveryIssue[] {
  const issues: DeliveryIssue[] = [];
  if (!DELIVERY_MODES.includes(config.mode)) return [{ field: "mode", message: `mode must be one of ${DELIVERY_MODES.join(", ")}` }];

  const needsLocation = config.mode !== "remote";
  if (needsLocation && !config.location?.region?.trim()) issues.push({ field: "location.region", message: "a region is required for this mode" });
  if (config.mode === "remote" && config.location?.exactAddress) issues.push({ field: "location.exactAddress", message: "remote projects must not store an address" });
  if (config.mode === "hybrid") {
    const f = config.onSiteFraction;
    if (typeof f !== "number" || !(f > 0 && f < 1)) issues.push({ field: "onSiteFraction", message: "hybrid needs an on-site fraction strictly between 0 and 1" });
  } else if (config.onSiteFraction !== undefined) {
    issues.push({ field: "onSiteFraction", message: "only hybrid projects have an on-site fraction" });
  }
  const missing = requiredSafety(config.mode).filter((r) => !config.satisfied.includes(r));
  for (const req of missing) issues.push({ field: `safety.${req}`, message: `${req.replace(/_/g, " ")} is required for ${config.mode.replace("_", "-")} projects` });
  return issues;
}

/** Can the project start? Everything required for its mode must be in place. */
export function readyToStart(config: DeliveryConfig): boolean {
  return validateDelivery(config).length === 0;
}

export type ViewerLevel = "public" | "applicant" | "confirmed" | "organizer";

export interface LocationView {
  mode: DeliveryMode;
  region: string | null;
  exactAddress: string | null;
}

/** Location privacy: only confirmed participants and organizers see the exact address. */
export function locationFor(config: DeliveryConfig, viewer: ViewerLevel): LocationView {
  const seesExact = viewer === "confirmed" || viewer === "organizer";
  return {
    mode: config.mode,
    region: config.location?.region ?? null,
    exactAddress: seesExact && config.mode !== "remote" ? (config.location?.exactAddress ?? null) : null,
  };
}
