export type ScholarshipProgramKind = 'scholarship' | 'bursary' | 'sponsorship';

export type ProgramTermRevision = {
  id: string;
  programId: string;
  programName: string;
  kind: ScholarshipProgramKind;
  version: string;
  revisionLabel: string;
  publishedAt: string;
  effectiveFrom: string;
  effectiveUntil?: string;
  summary: string;
  eligibility: string[];
  deadlines: Array<{ label: string; value: string; }>; 
  awardValue: string;
  obligations: string[];
  changelog: string[];
  immutable: true;
  integrityHash: string;
};

export type AcceptedProgramTerms = {
  applicationId: string;
  programId: string;
  revisionId: string;
  termsVersion: string;
  acceptedAt: string;
  integrityHash: string;
};

export type ProgramTermsState = {
  revisions: ProgramTermRevision[];
  loading: boolean;
  error: string | null;
  acceptedRevisionId: string | null;
};
