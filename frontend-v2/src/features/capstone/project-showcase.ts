/**
 * Capstone project showcase pages (CAPSTONE-093).
 *
 * Builds a public, read-only showcase from a project's approved material.
 * Only approved, public-visibility content is published: private agreements,
 * unconsented contributor identities, internal links and sensitive fields
 * never reach the page. Publishing checks the same revision for approval and
 * content, respects the environment flag, and yields explicit loading, empty,
 * error, conflict and success states. Analytics are counts only.
 */

export const SHOWCASE_SECTIONS = ["abstract", "contributors", "outputs", "demonstrations", "citations", "licenses", "funding", "verification"] as const;
export type ShowcaseSection = (typeof SHOWCASE_SECTIONS)[number];

export interface PublicVisibility {
  approved: boolean;
  visibility: "public" | "team";
}

export interface ShowcaseItem extends PublicVisibility {
  id: string;
  title: string;
  url?: string;
}

export interface ShowcaseContributor {
  id: string;
  displayName: string;
  role: string;
  consentedToPublic: boolean;
}

export interface ShowcaseSource {
  id: string;
  projectId: string;
  organizationId: string;
  /** Increment when approved content changes. */
  revision: number;
  abstract?: { text: string } & PublicVisibility;
  contributors: readonly ShowcaseContributor[];
  outputs: readonly ShowcaseItem[];
  demonstrations: readonly ShowcaseItem[];
  citations: readonly ShowcaseItem[];
  license: string | null;
  fundingAcknowledgement: string | null;
  verificationLinks: readonly ShowcaseItem[];
}

export interface PublishOptions {
  publicShowcaseEnabled: boolean;
  approvalStatus: "approved" | "collecting" | "rejected" | "revoked";
  expectedRevision: number;
}

export type ShowcaseErrorCode = "FEATURE_DISABLED" | "NOT_APPROVED" | "STALE_REVISION" | "UNSAFE_LINK" | "NO_PUBLIC_CONTENT";

export interface ShowcasePage {
  projectId: string;
  revision: number;
  abstract: string | null;
  contributors: { displayName: string; role: string }[];
  outputs: { title: string; url: string | null }[];
  demonstrations: { title: string; url: string | null }[];
  citations: { title: string; url: string | null }[];
  licenses: string | null;
  funding: string | null;
  verification: { title: string; url: string }[];
  sections: ShowcaseSection[];
}

export type ShowcaseResult = { ok: true; page: ShowcasePage; empty: boolean } | { ok: false; code: ShowcaseErrorCode; message: string };

const PRIVATE_HOST = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[::1\])/i;
const SENSITIVE_QUERY = /(token|secret|password|passwd|api[_-]?key|signature|sig)=/i;

/** Only absolute HTTPS links to public hosts, without credentials in the URL. */
export function isPublicUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return false;
    if (PRIVATE_HOST.test(url.hostname)) return false;
    return !SENSITIVE_QUERY.test(url.search) && !SENSITIVE_QUERY.test(url.hash);
  } catch {
    return false;
  }
}

const visibleItem = (item: ShowcaseItem) => item.approved && item.visibility === "public";

/** Check approved links before publishing so a bad link is a stable, actionable error. */
export function unsafePublicLinks(source: ShowcaseSource): string[] {
  return [...source.outputs, ...source.demonstrations, ...source.citations, ...source.verificationLinks]
    .filter(visibleItem)
    .filter((item) => item.url !== undefined && !isPublicUrl(item.url))
    .map((item) => item.id);
}

/** Build the public view. Unapproved or team-only material is dropped, never published. */
export function buildShowcase(source: ShowcaseSource, options: PublishOptions): ShowcaseResult {
  const fail = (code: ShowcaseErrorCode, message: string): ShowcaseResult => ({ ok: false, code, message });
  if (!options.publicShowcaseEnabled) return fail("FEATURE_DISABLED", "Public showcase is disabled in this environment.");
  if (options.approvalStatus !== "approved") return fail("NOT_APPROVED", "A project can only be showcased after publication approval.");
  if (options.expectedRevision !== source.revision) return fail("STALE_REVISION", `The showcase changed (revision ${source.revision}); reload before publishing.`);

  const unsafe = unsafePublicLinks(source);
  if (unsafe.length > 0) return fail("UNSAFE_LINK", `Fix the public link on: ${unsafe.join(", ")}. Use an HTTPS URL without credentials.`);

  const outputs = source.outputs.filter(visibleItem).map((i) => ({ title: i.title, url: i.url ?? null }));
  const demonstrations = source.demonstrations.filter(visibleItem).map((i) => ({ title: i.title, url: i.url ?? null }));
  const citations = source.citations.filter(visibleItem).map((i) => ({ title: i.title, url: i.url ?? null }));
  const verification = source.verificationLinks.filter(visibleItem).map((i) => ({ title: i.title, url: i.url! }));
  const abstract = source.abstract?.approved && source.abstract.visibility === "public" ? source.abstract.text.trim() : null;
  const contributors = source.contributors.filter((c) => c.consentedToPublic).map((c) => ({ displayName: c.displayName, role: c.role }));
  const sections: ShowcaseSection[] = [];
  if (abstract) sections.push("abstract");
  if (contributors.length) sections.push("contributors");
  if (outputs.length) sections.push("outputs");
  if (demonstrations.length) sections.push("demonstrations");
  if (citations.length) sections.push("citations");
  if (source.license) sections.push("licenses");
  if (source.fundingAcknowledgement) sections.push("funding");
  if (verification.length) sections.push("verification");

  const page: ShowcasePage = {
    projectId: source.projectId,
    revision: source.revision,
    abstract,
    contributors,
    outputs,
    demonstrations,
    citations,
    licenses: source.license,
    funding: source.fundingAcknowledgement,
    verification,
    sections,
  };
  return { ok: true, page, empty: sections.length === 0 };
}

export type ShowcaseViewState =
  | { kind: "loading" }
  | { kind: "error"; code: ShowcaseErrorCode; message: string }
  | { kind: "conflict"; code: ShowcaseErrorCode; message: string }
  | { kind: "empty" }
  | { kind: "success"; page: ShowcasePage };

/** Maps a publish attempt to the state a responsive, accessible UI should render. */
export function showcaseViewState(result: ShowcaseResult | null, loading = false): ShowcaseViewState {
  if (loading || result === null) return { kind: "loading" };
  if (!result.ok) {
    return result.code === "STALE_REVISION" ? { kind: "conflict", code: result.code, message: result.message } : { kind: "error", code: result.code, message: result.message };
  }
  return result.empty ? { kind: "empty" } : { kind: "success", page: result.page };
}

/** Privacy-safe analytics: counts and section names only, no titles or identities. */
export function showcaseAnalytics(page: ShowcasePage): Record<string, number> {
  return {
    sections: page.sections.length,
    contributors: page.contributors.length,
    outputs: page.outputs.length,
    demonstrations: page.demonstrations.length,
    citations: page.citations.length,
    verification: page.verification.length,
  };
}
