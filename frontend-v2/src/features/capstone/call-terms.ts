/**
 * Versioned published call terms (CAPSTONE-018).
 *
 * Publishing a call snapshots its eligibility, evaluation, IP, conduct, data,
 * funding, publication and completion terms as an immutable version with a
 * content digest. Applicants are bound to the version they accepted; changing
 * the terms always creates a new version and never edits an old one.
 */

export const TERM_SECTIONS = ["eligibility", "evaluation", "ip", "conduct", "data", "funding", "publication", "completion"] as const;
export type TermSection = (typeof TERM_SECTIONS)[number];

export type CallTerms = Record<TermSection, string>;

export interface TermsVersion {
  version: number;
  terms: CallTerms;
  publishedOn: string;
  /** SHA-256 over the canonical terms text. */
  digest: string;
}

export interface TermsHistory {
  callId: string;
  versions: readonly TermsVersion[];
}

export interface TermsIssue {
  section: string;
  message: string;
}

export async function sha256Hex(text: string): Promise<string> {
  const hash = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Section order is fixed, so the digest depends only on the text. */
export function canonicalTerms(terms: CallTerms): string {
  return JSON.stringify(TERM_SECTIONS.map((s) => [s, terms[s].replace(/\r\n/g, "\n").trim()]));
}

export function validateTerms(terms: Partial<CallTerms>): TermsIssue[] {
  const issues: TermsIssue[] = [];
  for (const section of TERM_SECTIONS) {
    const text = terms[section];
    if (typeof text !== "string" || text.trim().length < 10) issues.push({ section, message: "write at least 10 characters" });
    else if (text.length > 8000) issues.push({ section, message: "too long (8000 characters max)" });
  }
  return issues;
}

export function emptyHistory(callId: string): TermsHistory {
  return { callId, versions: [] };
}

export type PublishTermsResult =
  | { ok: true; history: TermsHistory; version: TermsVersion; created: boolean }
  | { ok: false; code: "INVALID_TERMS"; issues: TermsIssue[] };

/**
 * Publish terms. Identical terms to the latest version return it unchanged
 * (no new version), so a retried publish is idempotent. The history is returned
 * as a new object.
 */
export async function publishTerms(history: TermsHistory, terms: CallTerms, publishedOn: string): Promise<PublishTermsResult> {
  const issues = validateTerms(terms);
  if (issues.length > 0) return { ok: false, code: "INVALID_TERMS", issues };

  const digest = await sha256Hex(canonicalTerms(terms));
  const latest = history.versions[history.versions.length - 1];
  if (latest && latest.digest === digest) return { ok: true, history, version: latest, created: false };

  const version: TermsVersion = { version: (latest?.version ?? 0) + 1, terms: { ...terms }, publishedOn, digest };
  return { ok: true, history: { ...history, versions: [...history.versions, version] }, version, created: true };
}

export function termsVersion(history: TermsHistory, version: number): TermsVersion | undefined {
  return history.versions.find((v) => v.version === version);
}

export function latestTerms(history: TermsHistory): TermsVersion | undefined {
  return history.versions[history.versions.length - 1];
}

/** Sections whose text differs between two versions. */
export function diffTerms(a: TermsVersion, b: TermsVersion): TermSection[] {
  return TERM_SECTIONS.filter((s) => a.terms[s].trim() !== b.terms[s].trim());
}

/** Verify a stored version still matches its digest (detects tampering). */
export async function verifyTermsVersion(v: TermsVersion): Promise<boolean> {
  return (await sha256Hex(canonicalTerms(v.terms))) === v.digest;
}

export interface Acceptance {
  applicantId: string;
  callId: string;
  version: number;
  digest: string;
}

/** An acceptance binds the applicant to one version and its digest. */
export function acceptTerms(history: TermsHistory, applicantId: string, version: number): Acceptance | null {
  const v = termsVersion(history, version);
  return v ? { applicantId, callId: history.callId, version: v.version, digest: v.digest } : null;
}

/** True when an acceptance is for the latest terms; otherwise the applicant must re-accept. */
export function acceptanceIsCurrent(history: TermsHistory, acceptance: Acceptance): boolean {
  const latest = latestTerms(history);
  return latest !== undefined && acceptance.version === latest.version && acceptance.digest === latest.digest;
}
