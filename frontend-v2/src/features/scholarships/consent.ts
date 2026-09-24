import { apiClient } from '@/src/lib/api-client';

export type ConsentKind =
  | 'acceptedTerms'
  | 'privacyNotice'
  | 'dataSharing'
  | 'sponsorDisclosure';

export type ConsentRecord = {
  kind: ConsentKind;
  version: string;
  accepted: boolean;
  acceptedAt?: string;
  revokedAt?: string;
  revocable: boolean;
};

export type ConsentRequirement = {
  kind: ConsentKind;
  title: string;
  description: string;
  version: string;
  required: boolean;
  revocable: boolean;
  documentUrl: string;
};

export type ConsentState = {
  requirements: ConsentRequirement[];
  records: ConsentRecord[];
};

export type ConsentSubmission = {
  kind: ConsentKind;
  version: string;
  accepted: true;
  acceptedAt: string;
};

export const consentRequirements: ConsentRequirement[] = [
  {
    kind: 'acceptedTerms',
    title: 'Scholarship terms',
    description: 'I agree to the scholarship application and award terms.',
    version: '2026-09-01',
    required: true,
    revocable: false,
    documentUrl: '/terms',
  },
  {
    kind: 'privacyNotice',
    title: 'Privacy notice',
    description: 'I have read how application evidence is collected, used, retained, and protected.',
    version: '2026-09-01',
    required: true,
    revocable: true,
    documentUrl: '/privacy',
  },
  {
    kind: 'dataSharing',
    title: 'Application data sharing',
    description: 'I allow necessary application data to be shared with reviewers for this scholarship.',
    version: '2026-09-01',
    required: true,
    revocable: true,
    documentUrl: '/privacy#data-sharing',
  },
  {
    kind: 'sponsorDisclosure',
    title: 'Sponsor disclosure',
    description: 'I understand that the scholarship sponsor may receive permitted outcome information.',
    version: '2026-09-01',
    required: true,
    revocable: true,
    documentUrl: '/privacy#sponsor-disclosure',
  },
];

export function needsReconsent(
  requirement: ConsentRequirement,
  record: ConsentRecord | undefined
): boolean {
  return !record || !record.accepted || record.version !== requirement.version;
}

export function buildConsentSubmission(
  requirements: ConsentRequirement[],
  acceptedKinds: ReadonlySet<ConsentKind>,
  now = new Date()
): ConsentSubmission[] {
  return requirements
    .filter((requirement) => requirement.required && acceptedKinds.has(requirement.kind))
    .map((requirement) => ({
      kind: requirement.kind,
      version: requirement.version,
      accepted: true,
      acceptedAt: now.toISOString(),
    }));
}

export const scholarshipConsentService = {
  get: (applicationId: string): Promise<ConsentState> =>
    apiClient.get<ConsentState>(`/scholarships/applications/${applicationId}/consent`),

  submit: (applicationId: string, submissions: ConsentSubmission[]): Promise<ConsentState> =>
    apiClient.post<ConsentState>(`/scholarships/applications/${applicationId}/consent`, {
      consents: submissions,
    }),

  revoke: (applicationId: string, kind: ConsentKind): Promise<ConsentState> =>
    apiClient.post<ConsentState>(`/scholarships/applications/${applicationId}/consent/${kind}/revoke`, {}),
};
