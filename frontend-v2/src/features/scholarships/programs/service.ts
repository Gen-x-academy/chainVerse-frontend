import type { AcceptedProgramTerms, ProgramTermRevision } from './types';

const fallbackTerms: ProgramTermRevision[] = [
  {
    id: 'rev-scholarship-2024-09',
    programId: 'chainverse-scholarship',
    programName: 'ChainVerse Scholarship',
    kind: 'scholarship',
    version: '2024.09',
    revisionLabel: 'Published September 2024',
    publishedAt: '2024-09-01T00:00:00.000Z',
    effectiveFrom: '2024-09-01T00:00:00.000Z',
    awardValue: '$3,000 annual award',
    summary: 'Supports students demonstrating academic potential and commitment to digital learning.',
    eligibility: [
      'Completed at least one academic term with a GPA of 3.5 or higher.',
      'Must be enrolled in an accredited program or learning pathway.',
      'Demonstrate a clear contribution to the ChainVerse community.',
    ],
    deadlines: [
      { label: 'Application deadline', value: '30 September 2024' },
      { label: 'Review window', value: '1 October to 15 October 2024' },
    ],
    obligations: [
      'Maintain satisfactory academic progress throughout the award period.',
      'Complete quarterly check-ins with the support mentor.',
      'Participate in community learning or mentorship activities.',
    ],
    changelog: [
      'Added GPA and enrollment requirements.',
      'Introduced quarterly mentor review obligations.',
      'Updated award value to reflect the annual funding pool.',
    ],
    immutable: true,
    integrityHash: 'sha256:scholarship-v2024-09:eligibility-deadlines-award-value-obligations',
  },
  {
    id: 'rev-scholarship-2025-03',
    programId: 'chainverse-scholarship',
    programName: 'ChainVerse Scholarship',
    kind: 'scholarship',
    version: '2025.03',
    revisionLabel: 'Published March 2025',
    publishedAt: '2025-03-12T00:00:00.000Z',
    effectiveFrom: '2025-03-12T00:00:00.000Z',
    awardValue: '$4,000 annual award',
    summary: 'Updated scholarship terms to include community impact and mentor engagement milestones.',
    eligibility: [
      'Completed at least one full academic term with a GPA of 3.5 or higher.',
      'Must be currently enrolled in a recognized skill or degree program.',
      'Demonstrate measurable commitment to community learning and technical growth.',
    ],
    deadlines: [
      { label: 'Application deadline', value: '30 March 2025' },
      { label: 'Review window', value: '6 April to 20 April 2025' },
    ],
    obligations: [
      'Maintain satisfactory academic progress.',
      'Submit quarterly progress evidence and mentor updates.',
      'Attend one community learning event each academic term.',
    ],
    changelog: [
      'Added community contribution requirement to strengthen the program focus.',
      'Expanded mentoring obligations to support accountability.',
      'Raised award value from $3,000 to $4,000 for the annual cycle.',
    ],
    immutable: true,
    integrityHash: 'sha256:scholarship-v2025-03:eligibility-deadlines-award-value-obligations',
  },
];

const PROGRAM_TERMS_PATH = '/scholarship-programs';

function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? '';
}

export async function getPublishedProgramTerms(programId: string): Promise<ProgramTermRevision[]> {
  const baseUrl = getBaseUrl();
  if (!baseUrl) {
    return fallbackTerms.filter((term) => term.programId === programId || programId === 'all');
  }

  try {
    const response = await fetch(`${baseUrl}${PROGRAM_TERMS_PATH}?programId=${encodeURIComponent(programId)}`);
    if (!response.ok) {
      return fallbackTerms.filter((term) => term.programId === programId || programId === 'all');
    }
    const data = (await response.json()) as { revisions?: ProgramTermRevision[] };
    return data.revisions ?? fallbackTerms.filter((term) => term.programId === programId || programId === 'all');
  } catch {
    return fallbackTerms.filter((term) => term.programId === programId || programId === 'all');
  }
}

export async function getProgramTermsHistory(programId: string): Promise<ProgramTermRevision[]> {
  return getPublishedProgramTerms(programId);
}

export async function acceptProgramTerms(input: {
  applicationId: string;
  programId: string;
  revisionId: string;
  termsVersion: string;
  acceptedAt?: string;
  integrityHash: string;
}): Promise<AcceptedProgramTerms> {
  const acceptedAt = input.acceptedAt ?? new Date().toISOString();

  const acceptedTerms: AcceptedProgramTerms = {
    applicationId: input.applicationId,
    programId: input.programId,
    revisionId: input.revisionId,
    termsVersion: input.termsVersion,
    acceptedAt,
    integrityHash: input.integrityHash,
  };

  const baseUrl = getBaseUrl();
  if (!baseUrl) {
    return acceptedTerms;
  }

  try {
    const response = await fetch(`${baseUrl}${PROGRAM_TERMS_PATH}/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(acceptedTerms),
    });

    if (!response.ok) {
      return acceptedTerms;
    }

    const data = (await response.json()) as Partial<AcceptedProgramTerms>;
    return {
      ...acceptedTerms,
      ...data,
    };
  } catch {
    return acceptedTerms;
  }
}

export const scholarshipProgramsService = {
  getPublishedProgramTerms,
  getProgramTermsHistory,
  acceptProgramTerms,
};
