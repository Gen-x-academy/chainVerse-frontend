/**
 * Shareable public scholarship program pages (issue #1138).
 *
 * A program is only visible outside the authenticated product once an operator
 * explicitly publishes it. Publication is a whitelist: a program field that is
 * not publishable is never carried onto the page object at all, so it cannot
 * leak through a rendering path that forgets to hide it.
 */

export type ProgramVisibility = 'public' | 'restricted' | 'invitation-only' | 'unpublished';

export type PublicProgramField = {
  key: string;
  label: string;
  publishable: boolean;
  value: string;
};

export type PublicProgramPage = {
  slug: string;
  programId: string;
  canonicalUrl: string;
  title: string;
  summary: string;
  description: string;
  sponsorName: string;
  currency: string;
  awardAmountCents: number;
  applicationDeadline: string;
  eligibilitySummary: string[];
  publishedFields: PublicProgramField[];
  visibility: ProgramVisibility;
  revision: number;
  publishedAt?: string;
  updatedAt: string;
  structuredData: Record<string, string | number | boolean>;
};

export type PublicPageRevision = {
  slug: string;
  revision: number;
  publishedAt: string;
  publishedBy: string;
  checksum: string;
  note: string;
};

export type PublicationRefusalReason =
  | 'NOT_PUBLISHED'
  | 'INVITATION_ONLY'
  | 'UNPUBLISHED'
  | 'NO_PUBLISHABLE_FIELDS';

export type PublicationResult = {
  status: 'published' | 'refused';
  reason?: PublicationRefusalReason;
  page?: PublicProgramPage;
};

/**
 * The program shape a publication reads from. It deliberately still holds
 * private fields (`internalNotes`, `selectionCriteria`, `applicantPool`) so the
 * tests can prove those never reach a public page.
 */
export type PublishableProgram = {
  programId: string;
  title: string;
  summary: string;
  description: string;
  sponsorName: string;
  currency: string;
  awardAmountCents: number;
  applicationDeadline: string;
  eligibilitySummary: string[];
  visibility: ProgramVisibility;
  updatedAt: string;
  /** Everything below is private and must never be published. */
  internalNotes?: string;
  selectionCriteria?: string;
  applicantPool?: string;
  reviewPanel?: string;
};

export type PublicProgramSummary = {
  slug: string;
  programId: string;
  title: string;
  summary: string;
  applicationDeadline: string;
  awardAmountCents: number;
  currency: string;
  visibility: ProgramVisibility;
  updatedAt: string;
};

export type PublishOptions = {
  baseUrl?: string;
  publishedAt: string;
  publishedBy: string;
  note?: string;
};
