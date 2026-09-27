/**
 * TEST-ONLY FIXTURES — Configurable Application Forms.
 *
 * @see ../../../../../docs/scholarships-testing.md (see "Test-only fixtures")
 */

import type { ConfigurableFormSchema } from '../../applications/forms/types';
import { computeSchemaHash } from '../../applications/forms/domain';

const baseSections = [
  {
    id: 'sec_statements',
    title: 'Personal Statement & Academic Vision',
    description: 'Provide detailed essays regarding your background and scholarship motivations.',
    order: 1,
    fields: [
      {
        id: 'field_personal_statement',
        sectionId: 'sec_statements',
        kind: 'statement' as const,
        type: 'rich_text' as const,
        label: 'Personal Statement & Motivation',
        description: 'Describe your background, leadership experiences, and how this scholarship will advance your career.',
        required: true,
        order: 1,
        statementConfig: {
          prompt: 'Why are you seeking support for your engineering education?',
          minWords: 50,
          maxWords: 500,
          guidelines: 'Focus on demonstrated leadership and technical ambitions.',
          richTextEnabled: true,
        },
      },
      {
        id: 'field_research_proposal',
        sectionId: 'sec_statements',
        kind: 'statement' as const,
        type: 'rich_text' as const,
        label: 'Proposed Research / Capstone Project',
        description: 'Provide an overview of the smart contract or protocol tool you will construct.',
        required: false,
        order: 2,
        statementConfig: {
          prompt: 'Outline your capstone project goals.',
          maxWords: 300,
        },
      },
    ],
  },
  {
    id: 'sec_questions',
    title: 'Applicant Background & Track',
    description: 'General questions and track preferences.',
    order: 2,
    fields: [
      {
        id: 'field_track_choice',
        sectionId: 'sec_questions',
        kind: 'question' as const,
        type: 'single_select' as const,
        label: 'Specialization Track',
        required: true,
        order: 1,
        questionConfig: {
          options: [
            { value: 'soroban', label: 'Soroban Smart Contracts' },
            { value: 'defi', label: 'DeFi & AMM Protocols' },
            { value: 'security', label: 'Security & Formal Auditing' },
          ],
        },
      },
      {
        id: 'field_needs_financial_aid',
        sectionId: 'sec_questions',
        kind: 'question' as const,
        type: 'boolean' as const,
        label: 'Are you requesting financial hardship aid?',
        required: true,
        order: 2,
      },
      {
        id: 'field_financial_aid_explanation',
        sectionId: 'sec_questions',
        kind: 'question' as const,
        type: 'text' as const,
        label: 'Financial Hardship Explanation',
        required: true,
        order: 3,
        // Conditional: only shown if field_needs_financial_aid is checked
        conditional: {
          targetFieldId: 'field_needs_financial_aid',
          operator: 'is_checked' as const,
          value: true,
        },
      },
    ],
  },
  {
    id: 'sec_references',
    title: 'Academic & Professional References',
    description: 'Submit referee recommendations supporting your academic standing.',
    order: 3,
    fields: [
      {
        id: 'field_academic_references',
        sectionId: 'sec_references',
        kind: 'reference' as const,
        type: 'text' as const,
        label: 'Academic Faculty Referee Email',
        required: true,
        order: 1,
        referenceConfig: {
          minReferees: 1,
          maxReferees: 2,
          requireInstitutionalEmail: true,
          allowRecommendationUpload: true,
          relationshipTypes: ['Professor', 'Advisor', 'Department Chair'],
        },
      },
    ],
  },
  {
    id: 'sec_evidence',
    title: 'Supporting Documents & Evidence',
    description: 'Upload required documentation for committee verification.',
    order: 4,
    fields: [
      {
        id: 'field_transcript_evidence',
        sectionId: 'sec_evidence',
        kind: 'evidence' as const,
        type: 'text' as const,
        label: 'Official Academic Transcript (PDF)',
        required: true,
        order: 1,
        evidenceConfig: {
          documentCategory: 'transcript',
          allowedExtensions: ['.pdf'],
          maxSizeBytes: 10 * 1024 * 1024,
          requiredOriginalScan: true,
          guidanceText: 'Provide certified scans issued within the past 12 months.',
        },
      },
      {
        id: 'field_income_evidence',
        sectionId: 'sec_evidence',
        kind: 'evidence' as const,
        type: 'text' as const,
        label: 'Proof of Household Income / Need',
        required: true,
        order: 2,
        conditional: {
          targetFieldId: 'field_needs_financial_aid',
          operator: 'is_checked' as const,
          value: true,
        },
        evidenceConfig: {
          documentCategory: 'incomeVerification',
          allowedExtensions: ['.pdf', '.png'],
          maxSizeBytes: 5 * 1024 * 1024,
          requiredOriginalScan: false,
        },
      },
    ],
  },
  {
    id: 'sec_consents',
    title: 'Legal Disclosures & Consents',
    description: 'Affirmative agreements to program policies.',
    order: 5,
    fields: [
      {
        id: 'field_terms_consent',
        sectionId: 'sec_consents',
        kind: 'consent' as const,
        type: 'boolean' as const,
        label: 'Terms of Participation & Honor Code',
        required: true,
        order: 1,
        consentConfig: {
          consentKind: 'termsOfService',
          legalNoticeText: 'I attest that all application data is truthful and authentic.',
          requiredAffirmative: true,
          version: '1.0.0',
          policyUrl: '/privacy#terms',
        },
      },
      {
        id: 'field_sponsor_disclosure_consent',
        sectionId: 'sec_consents',
        kind: 'consent' as const,
        type: 'boolean' as const,
        label: 'Sponsor Disclosure Notice',
        required: true,
        order: 2,
        consentConfig: {
          consentKind: 'sponsorDisclosure',
          legalNoticeText: 'I understand that the scholarship sponsor may receive permitted outcome reports.',
          requiredAffirmative: true,
          version: '1.0.0',
          policyUrl: '/privacy#sponsor-disclosure',
        },
      },
    ],
  },
];

const draftBase = {
  id: 'schema-round-stellar-draft',
  programId: 'prog-stellar-2026',
  roundId: 'round-stellar-2026',
  version: '1.0.0',
  status: 'draft' as const,
  title: 'Stellar Fellowship 2026 Application Form',
  description: 'Multi-section configurable application form for engineering candidates.',
  sections: baseSections,
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
};

export const mockFormSchemaDraft: ConfigurableFormSchema = {
  ...draftBase,
  schemaHash: computeSchemaHash(draftBase),
};

const publishedBase = {
  id: 'schema-round-stellar-v1_0_0',
  programId: 'prog-stellar-2026',
  roundId: 'round-stellar-2026',
  version: '1.0.0',
  status: 'published' as const,
  title: 'Stellar Fellowship 2026 Application Form',
  description: 'Multi-section configurable application form for engineering candidates.',
  sections: baseSections,
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-02T10:00:00.000Z',
  publishedAt: '2026-08-02T10:00:00.000Z',
  publishedBy: 'user-admin-1',
};

export const mockPublishedFormSchema: ConfigurableFormSchema = {
  ...publishedBase,
  schemaHash: computeSchemaHash(publishedBase),
};

const publishedV11Base = {
  id: 'schema-round-stellar-v1_1_0',
  programId: 'prog-stellar-2026',
  roundId: 'round-stellar-2026',
  version: '1.1.0',
  status: 'published' as const,
  title: 'Stellar Fellowship 2026 Application Form (v1.1)',
  description: 'Updated criteria with enhanced referee verification.',
  sections: baseSections,
  createdAt: '2026-08-10T00:00:00.000Z',
  updatedAt: '2026-08-12T14:00:00.000Z',
  publishedAt: '2026-08-12T14:00:00.000Z',
  publishedBy: 'user-admin-1',
};

export const mockPublishedFormSchemaV11: ConfigurableFormSchema = {
  ...publishedV11Base,
  schemaHash: computeSchemaHash(publishedV11Base),
};
