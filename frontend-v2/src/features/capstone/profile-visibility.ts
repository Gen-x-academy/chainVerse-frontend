/**
 * Profile visibility controls (CAPSTONE-014).
 *
 * Participants choose, per field, the widest audience that may see it. The
 * default is private. Contact-related fields are capped: they can be shown to
 * supervisors, but going wider needs an explicit, recorded consent so a single
 * misclick cannot publish contact details.
 */

export const VISIBILITY_FIELDS = ["portfolio", "skills", "affiliations", "availability", "contactEmail", "contactPhone"] as const;
export type VisibilityField = (typeof VISIBILITY_FIELDS)[number];

export const AUDIENCE_ORDER = ["private", "team", "supervisors", "sponsors", "public"] as const;
export type VisibilityAudience = (typeof AUDIENCE_ORDER)[number];

export const CONTACT_FIELDS: readonly VisibilityField[] = ["contactEmail", "contactPhone"];
/** Widest audience contact fields may have without explicit consent. */
export const CONTACT_DEFAULT_CAP: VisibilityAudience = "supervisors";

export interface VisibilitySettings {
  fields: Record<VisibilityField, VisibilityAudience>;
  /** Fields for which the user explicitly consented to a wider audience than the cap. */
  consents: VisibilityField[];
}

export function defaultVisibility(): VisibilitySettings {
  return {
    fields: Object.fromEntries(VISIBILITY_FIELDS.map((f) => [f, "private" as const])) as Record<VisibilityField, VisibilityAudience>,
    consents: [],
  };
}

const rank = (a: VisibilityAudience) => AUDIENCE_ORDER.indexOf(a);

export type VisibilityChange =
  | { ok: true; settings: VisibilitySettings }
  | { ok: false; code: "UNKNOWN_FIELD" | "UNKNOWN_AUDIENCE" | "CONSENT_REQUIRED"; message: string };

/**
 * Change one field's audience. Returns a new settings object; the input is not
 * mutated. Widening a contact field past the cap needs `consent: true`, which
 * is recorded; narrowing again removes the consent.
 */
export function setFieldVisibility(
  settings: VisibilitySettings,
  field: string,
  audience: string,
  options: { consent?: boolean } = {},
): VisibilityChange {
  if (!(VISIBILITY_FIELDS as readonly string[]).includes(field)) return { ok: false, code: "UNKNOWN_FIELD", message: `${field} is not a profile field` };
  if (!(AUDIENCE_ORDER as readonly string[]).includes(audience)) return { ok: false, code: "UNKNOWN_AUDIENCE", message: `${audience} is not an audience` };
  const f = field as VisibilityField;
  const a = audience as VisibilityAudience;

  const wideContact = CONTACT_FIELDS.includes(f) && rank(a) > rank(CONTACT_DEFAULT_CAP);
  if (wideContact && !options.consent) {
    return { ok: false, code: "CONSENT_REQUIRED", message: `Sharing ${f} with ${a} needs your explicit consent.` };
  }
  const consents = new Set(settings.consents);
  if (wideContact) consents.add(f);
  else consents.delete(f);
  return { ok: true, settings: { fields: { ...settings.fields, [f]: a }, consents: [...consents].sort() } };
}

/**
 * Can `viewer` see `field`? The owner always can. For others, the viewer's
 * audience must be no wider than the field's setting. A wide contact setting
 * without a recorded consent is treated as capped (deny by default).
 */
export function canViewField(settings: VisibilitySettings, field: VisibilityField, viewer: VisibilityAudience, isOwner = false): boolean {
  if (isOwner) return true;
  let allowed = settings.fields[field] ?? "private";
  if (CONTACT_FIELDS.includes(field) && rank(allowed) > rank(CONTACT_DEFAULT_CAP) && !settings.consents.includes(field)) allowed = CONTACT_DEFAULT_CAP;
  return rank(viewer) <= rank(allowed) && viewer !== "private";
}

/** The subset of a profile object that `viewer` may see. */
export function visibleProfile<T extends Partial<Record<VisibilityField, unknown>>>(
  profile: T,
  settings: VisibilitySettings,
  viewer: VisibilityAudience,
  isOwner = false,
): Partial<T> {
  const out: Partial<T> = {};
  for (const field of VISIBILITY_FIELDS) {
    if (field in profile && canViewField(settings, field, viewer, isOwner)) out[field as keyof T] = profile[field as keyof T];
  }
  return out;
}
