/** MENTOR-016: version published program terms; published versions are immutable. */
export interface ProgramTerms {
  summary: string;
  commitmentHoursPerMonth: number;
  durationWeeks: number;
  conductPolicyVersion: number;
  refundPolicy?: string;
}

export interface TermsVersion {
  programId: string;
  version: number;
  status: 'draft' | 'published';
  terms: ProgramTerms;
  publishedAt?: string;
  /** Digest at publish time, to prove published terms were not altered. */
  digest?: string;
}

function digest(t: ProgramTerms): string {
  const text = JSON.stringify(t, Object.keys(t).sort());
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

export const latestPublished = (versions: TermsVersion[]): TermsVersion | undefined =>
  [...versions].filter((v) => v.status === 'published').sort((a, b) => b.version - a.version)[0];

/** Start a draft from the latest version; only one draft may exist at a time. */
export function startDraft(versions: TermsVersion[], programId: string): TermsVersion[] {
  if (versions.some((v) => v.status === 'draft')) throw new Error('A draft already exists');
  const base = [...versions].sort((a, b) => b.version - a.version)[0];
  const terms: ProgramTerms = base
    ? { ...base.terms }
    : { summary: '', commitmentHoursPerMonth: 4, durationWeeks: 12, conductPolicyVersion: 1 };
  return [...versions, { programId, version: (base?.version ?? 0) + 1, status: 'draft', terms }];
}

export function updateDraft(versions: TermsVersion[], changes: Partial<ProgramTerms>): TermsVersion[] {
  const draft = versions.find((v) => v.status === 'draft');
  if (!draft) throw new Error('No draft to edit; published versions are immutable');
  return versions.map((v) => (v === draft ? { ...v, terms: { ...v.terms, ...changes } } : v));
}

export function publishDraft(versions: TermsVersion[], now: Date = new Date()): TermsVersion[] {
  const draft = versions.find((v) => v.status === 'draft');
  if (!draft) throw new Error('No draft to publish');
  const t = draft.terms;
  if (!t.summary.trim()) throw new Error('Add a summary before publishing');
  if (t.commitmentHoursPerMonth <= 0 || t.durationWeeks <= 0) throw new Error('Commitment and duration must be positive');
  return versions.map((v) => (v === draft ? { ...v, status: 'published' as const, publishedAt: now.toISOString(), digest: digest(t) } : v));
}

export const isTampered = (v: TermsVersion): boolean => v.status === 'published' && v.digest !== digest(v.terms);
