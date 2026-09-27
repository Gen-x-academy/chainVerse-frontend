/**
 * TEST-ONLY FIXTURES — Application Answers and Form Schemas.
 *
 * @see ../../../../../docs/scholarships-testing.md (see "Test-only fixtures")
 */

import type {
  ApplicationAnswersMap,
  ApplicationFormSchema,
} from '../../applications/validation/types';

export const mockApplicationFormSchema: ApplicationFormSchema = {
  id: 'schema-fellowship-2026',
  roundId: 'round-stellar-2026',
  programId: 'prog-stellar-2026',
  title: 'Stellar Fellowship Application Questionnaire',
  description:
    'Please complete the required questions below. Rich text statements are normalized and word limits are strictly enforced.',
  version: '1.0.0',
  fields: [
    {
      id: 'personalStatement',
      label: 'Personal Statement & Technical Vision',
      description:
        'Detail your technical background, interest in decentralized finance, and how this scholarship will advance your career.',
      helpText: 'Minimum 50 words, maximum 500 words. Rich text will be normalized.',
      placeholder: 'Share your background, academic aspirations, and planned open-source contributions...',
      type: 'rich_text',
      required: true,
      minWords: 50,
      maxWords: 500,
      minLength: 150,
    },
    {
      id: 'institutionName',
      label: 'Educational Institution',
      description: 'The accredited university, bootcamp, or academy where you are enrolled.',
      placeholder: 'e.g. University of Lagos or ChainVerse Web3 Academy',
      type: 'text',
      required: true,
      minLength: 3,
      maxLength: 120,
    },
    {
      id: 'trackChoice',
      label: 'Primary Specialization Track',
      description: 'Select the focus track you wish to specialize in during the program.',
      type: 'single_select',
      required: true,
      options: [
        {
          value: 'soroban_smart_contracts',
          label: 'Soroban Smart Contract Engineering',
          description: 'Rust development, WASM bytecode optimization, and state storage.',
        },
        {
          value: 'defi_protocols',
          label: 'DeFi & Automated Market Maker Protocols',
          description: 'Liquidity pools, cross-border payments, and DEX architecture.',
        },
        {
          value: 'security_auditing',
          label: 'Smart Contract Security & Formal Verification',
          description: 'Vulnerability triage, invariant fuzzing, and cryptographic checks.',
        },
      ],
    },
    {
      id: 'focusAreas',
      label: 'Specific Focus Modules',
      description: 'Select all modules relevant to your research goals.',
      type: 'multi_select',
      required: true,
      options: [
        { value: 'core_protocol', label: 'Stellar Core & Consensus' },
        { value: 'cross_border', label: 'Cross-Border Settlement' },
        { value: 'zero_knowledge', label: 'Zero-Knowledge Privacy Proofs' },
        { value: 'wallets_sdk', label: 'Wallet Kits & Client SDKs' },
      ],
    },
    {
      id: 'gpaValue',
      label: 'Cumulative Grade Point Average (GPA)',
      description: 'Enter your cumulative GPA on a standard 4.0 scale.',
      placeholder: 'e.g. 3.85',
      type: 'number',
      required: true,
      min: 2.0,
      max: 4.0,
    },
    {
      id: 'requestedStipendCents',
      label: 'Requested Bursary Funding (USD)',
      description: 'Enter your required stipend in USD (e.g. 2,500.00). Max award is $5,000.',
      placeholder: '2500',
      type: 'currency',
      required: true,
      min: 50000, // $500.00
      max: 500000, // $5,000.00
    },
    {
      id: 'expectedGraduationDate',
      label: 'Expected Graduation Date',
      description: 'Anticipated degree or certificate completion date.',
      type: 'date',
      required: true,
      minDate: '2026-06-01',
      maxDate: '2030-12-31',
    },
    {
      id: 'honorCodeAffirmation',
      label: 'Academic Integrity & Affirmative Commitment',
      description: 'I confirm that all submitted statements and evidence represent my own authentic work.',
      type: 'boolean',
      required: true,
    },
  ],
};

export const mockValidAnswers: ApplicationAnswersMap = {
  personalStatement:
    'I am a passionate computer science undergraduate specializing in distributed ledger technologies and cryptographic systems. Throughout my coursework at the university, I have constructed decentralized verification tools and conducted security benchmarks on open-source Rust repositories. Receiving this fellowship will allow me to cover my final-year tuition fees and dedicate 20 hours each week to contributing to Soroban developer toolkits and open documentation. I look forward to working closely with our academic mentors and sharing my research findings with the wider ecosystem.',
  institutionName: 'ChainVerse Global Institute of Technology',
  trackChoice: 'soroban_smart_contracts',
  focusAreas: ['core_protocol', 'cross_border'],
  gpaValue: 3.85,
  requestedStipendCents: 250000, // $2,500.00
  expectedGraduationDate: '2027-06-15',
  honorCodeAffirmation: true,
};

export const mockMalformedAnswers: ApplicationAnswersMap = {
  personalStatement:
    '<script>alert("XSS")</script><iframe src="javascript:alert(1)"></iframe>Too short.',
  institutionName: '   ', // whitespace only
  trackChoice: 'invalid_tampered_track_value',
  focusAreas: ['core_protocol', 'untrusted_module_injection'],
  gpaValue: 5.5, // Exceeds max 4.0
  requestedStipendCents: -100, // Negative amount
  expectedGraduationDate: 'not-a-date',
  honorCodeAffirmation: false,
};
