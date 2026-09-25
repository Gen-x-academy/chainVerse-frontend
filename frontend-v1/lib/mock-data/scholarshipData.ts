/**
 * Scholarship mock data
 *
 * These arrays are exported as mutable references so the API service layer
 * can simulate create / update / delete operations in the absence of a
 * live backend.  Replace with real API calls once endpoints are available.
 *
 * Privacy note: names and wallet addresses here are entirely fictitious.
 */

import type {
  ScholarshipProgram,
  ScholarshipApplication,
  ReviewItem,
  DisbursementRecord,
} from "@/types/scholarship.types";
import type { AdminStats } from "@/store/scholarshipStore";

// ─── Utility helpers ──────────────────────────────────────────────────────────

export function generateId(): string {
  return Math.random().toString(36).slice(2, 11);
}

export function nowIso(): string {
  return new Date().toISOString();
}

// ─── Scholarship Programs ─────────────────────────────────────────────────────

export const mockPrograms: ScholarshipProgram[] = [
  {
    id: "prog-001",
    title: "Stellar STEM Excellence Award",
    description:
      "Supporting outstanding students pursuing STEM education on the Stellar blockchain ecosystem. Recipients gain full course access plus mentorship from industry professionals.",
    category: "stem",
    status: "open",
    sponsorId: "sponsor-001",
    sponsorName: "Stellar Development Foundation",
    totalBudget: 50000,
    awardAmount: 500,
    currency: "XLM",
    maxRecipients: 100,
    awardedCount: 14,
    eligibilityCriteria: [
      "Enrolled student with a GPA of 3.5 or higher",
      "Pursuing a STEM-related course of study",
      "Demonstrated interest in blockchain technology",
    ],
    requiredDocuments: [
      "Academic transcript",
      "Letter of intent (500 words)",
      "Proof of enrollment",
    ],
    openDate: "2026-08-01",
    closeDate: "2026-11-30",
    createdAt: "2026-07-15T10:00:00Z",
    updatedAt: "2026-08-01T08:00:00Z",
  },
  {
    id: "prog-002",
    title: "Web3 Diversity & Inclusion Bursary",
    description:
      "A need-based bursary targeting under-represented communities in blockchain and Web3. Covers course fees and provides a monthly learning stipend.",
    category: "diversity",
    status: "open",
    sponsorId: "sponsor-002",
    sponsorName: "ChainVerse Foundation",
    totalBudget: 30000,
    awardAmount: 300,
    currency: "XLM",
    maxRecipients: 100,
    awardedCount: 7,
    eligibilityCriteria: [
      "Member of an under-represented community in tech",
      "Annual household income below $40,000 USD",
      "First-generation college student preferred",
    ],
    requiredDocuments: [
      "Personal statement (750 words)",
      "Proof of household income",
      "Community recommendation letter",
    ],
    openDate: "2026-07-01",
    closeDate: "2026-10-31",
    createdAt: "2026-06-20T14:00:00Z",
    updatedAt: "2026-07-01T09:00:00Z",
  },
  {
    id: "prog-003",
    title: "DeFi Innovators Merit Scholarship",
    description:
      "Merit-based scholarship for students demonstrating exceptional aptitude in decentralised finance concepts and smart contract development.",
    category: "merit",
    status: "open",
    sponsorId: "sponsor-003",
    sponsorName: "DeFi Builders DAO",
    totalBudget: 20000,
    awardAmount: 1000,
    currency: "XLM",
    maxRecipients: 20,
    awardedCount: 2,
    eligibilityCriteria: [
      "Completion of at least one DeFi course on ChainVerse",
      "Portfolio project or GitHub contribution to an open-source DeFi project",
      "Written endorsement from a course instructor",
    ],
    requiredDocuments: [
      "Portfolio / GitHub link",
      "Instructor endorsement letter",
      "Two-page project writeup",
    ],
    openDate: "2026-09-01",
    closeDate: "2026-12-15",
    createdAt: "2026-08-10T11:30:00Z",
    updatedAt: "2026-09-01T07:00:00Z",
  },
  {
    id: "prog-004",
    title: "Open Learning Access Fund",
    description:
      "An open scholarship available to any learner who demonstrates financial need and a commitment to completing their chosen course.",
    category: "need_based",
    status: "open",
    sponsorId: "sponsor-001",
    sponsorName: "Stellar Development Foundation",
    totalBudget: 10000,
    awardAmount: 200,
    currency: "XLM",
    maxRecipients: 50,
    awardedCount: 0,
    eligibilityCriteria: [
      "Any enrolled ChainVerse student",
      "Demonstrated financial hardship",
    ],
    requiredDocuments: [
      "Short financial hardship statement (250 words)",
    ],
    openDate: "2026-09-15",
    closeDate: "2026-12-31",
    createdAt: "2026-09-01T09:00:00Z",
    updatedAt: "2026-09-15T08:00:00Z",
  },
  {
    id: "prog-005",
    title: "Blockchain Fundamentals Grant (Closed)",
    description:
      "A past grant covering foundational blockchain coursework. Now closed for archival reference.",
    category: "open",
    status: "closed",
    sponsorId: "sponsor-002",
    sponsorName: "ChainVerse Foundation",
    totalBudget: 5000,
    awardAmount: 100,
    currency: "XLM",
    maxRecipients: 50,
    awardedCount: 50,
    eligibilityCriteria: ["Open to all registered students"],
    requiredDocuments: ["Enrollment confirmation"],
    openDate: "2026-01-01",
    closeDate: "2026-06-30",
    createdAt: "2025-12-15T12:00:00Z",
    updatedAt: "2026-06-30T23:59:00Z",
  },
  {
    id: "prog-006",
    title: "Sponsor Draft Program",
    description: "A draft program not yet published.",
    category: "merit",
    status: "draft",
    sponsorId: "sponsor-current",
    sponsorName: "Current Sponsor",
    totalBudget: 8000,
    awardAmount: 400,
    currency: "XLM",
    maxRecipients: 20,
    awardedCount: 0,
    eligibilityCriteria: ["TBD"],
    requiredDocuments: ["TBD"],
    openDate: "2026-10-01",
    closeDate: "2026-12-31",
    createdAt: "2026-09-20T10:00:00Z",
    updatedAt: "2026-09-20T10:00:00Z",
  },
];

// ─── Applications ─────────────────────────────────────────────────────────────

export const mockApplications: ScholarshipApplication[] = [
  {
    id: "app-001",
    scholarshipId: "prog-001",
    scholarshipTitle: "Stellar STEM Excellence Award",
    applicantId: "student-current",
    applicantName: "Current Student",
    applicantEmail: "student@example.com",
    status: "under_review",
    statement:
      "I am a third-year computer science student with a deep passion for blockchain technology. The Stellar ecosystem's focus on financial inclusion aligns perfectly with my research on micropayment systems for developing economies.",
    documents: [],
    submittedAt: "2026-09-05T14:23:00Z",
    createdAt: "2026-09-04T10:00:00Z",
    updatedAt: "2026-09-05T14:23:00Z",
  },
  {
    id: "app-002",
    scholarshipId: "prog-002",
    scholarshipTitle: "Web3 Diversity & Inclusion Bursary",
    applicantId: "student-current",
    applicantName: "Current Student",
    applicantEmail: "student@example.com",
    status: "submitted",
    statement:
      "As a first-generation college student from an underserved community, this bursary would allow me to complete my Web3 development training without financial burden.",
    financialNeed:
      "My family's annual income is $28,000. I work part-time to cover living expenses and rely on scholarships to fund my education.",
    documents: [],
    submittedAt: "2026-09-10T09:15:00Z",
    createdAt: "2026-09-08T11:00:00Z",
    updatedAt: "2026-09-10T09:15:00Z",
  },
  {
    id: "app-003",
    scholarshipId: "prog-003",
    scholarshipTitle: "DeFi Innovators Merit Scholarship",
    applicantId: "student-002",
    applicantName: "Alex Rivera",
    applicantEmail: "alex@example.com",
    status: "submitted",
    statement:
      "I have built three open-source DeFi protocols and completed all DeFi courses on ChainVerse with distinction. I am ready to push the boundaries of decentralised finance.",
    documents: [],
    submittedAt: "2026-09-12T16:40:00Z",
    createdAt: "2026-09-11T08:00:00Z",
    updatedAt: "2026-09-12T16:40:00Z",
  },
  {
    id: "app-004",
    scholarshipId: "prog-001",
    scholarshipTitle: "Stellar STEM Excellence Award",
    applicantId: "student-003",
    applicantName: "Jordan Patel",
    applicantEmail: "jordan@example.com",
    status: "submitted",
    statement:
      "Blockchain technology is the future of STEM, and the Stellar network's scalability makes it ideal for real-world applications in healthcare data management.",
    documents: [],
    submittedAt: "2026-09-14T11:05:00Z",
    createdAt: "2026-09-13T09:30:00Z",
    updatedAt: "2026-09-14T11:05:00Z",
  },
  {
    id: "app-005",
    scholarshipId: "prog-002",
    scholarshipTitle: "Web3 Diversity & Inclusion Bursary",
    applicantId: "student-004",
    applicantName: "Sam Okonkwo",
    applicantEmail: "sam@example.com",
    status: "approved",
    statement:
      "Growing up in a community with limited access to technology education, this bursary represents a life-changing opportunity to break into Web3 development.",
    financialNeed: "Household income is $22,000 annually with three dependants.",
    documents: [],
    submittedAt: "2026-08-20T13:00:00Z",
    reviewedAt: "2026-09-01T10:00:00Z",
    reviewerId: "reviewer-001",
    reviewDecision: "approve",
    reviewerNotes: "Strong personal statement, clearly meets need-based criteria.",
    createdAt: "2026-08-19T14:00:00Z",
    updatedAt: "2026-09-01T10:00:00Z",
  },
  {
    id: "app-006",
    scholarshipId: "prog-002",
    scholarshipTitle: "Web3 Diversity & Inclusion Bursary",
    applicantId: "student-005",
    applicantName: "Taylor Kim",
    applicantEmail: "taylor@example.com",
    status: "rejected",
    statement: "Placeholder statement.",
    documents: [],
    submittedAt: "2026-08-22T09:00:00Z",
    reviewedAt: "2026-09-03T14:00:00Z",
    reviewerId: "reviewer-001",
    reviewDecision: "reject",
    reviewerNotes:
      "Income documentation did not meet the stated threshold. Applicant encouraged to reapply next cycle.",
    createdAt: "2026-08-21T10:00:00Z",
    updatedAt: "2026-09-03T14:00:00Z",
  },
];

// ─── Review Queue ─────────────────────────────────────────────────────────────

export const mockReviewQueue: ReviewItem[] = [
  {
    applicationId: "app-003",
    applicantName: "Alex Rivera",
    applicantEmail: "alex@example.com",
    scholarshipTitle: "DeFi Innovators Merit Scholarship",
    scholarshipId: "prog-003",
    submittedAt: "2026-09-12T16:40:00Z",
    statement:
      "I have built three open-source DeFi protocols and completed all DeFi courses on ChainVerse with distinction. I am ready to push the boundaries of decentralised finance.",
    documents: [],
    currentStatus: "submitted",
  },
  {
    applicationId: "app-004",
    applicantName: "Jordan Patel",
    applicantEmail: "jordan@example.com",
    scholarshipTitle: "Stellar STEM Excellence Award",
    scholarshipId: "prog-001",
    submittedAt: "2026-09-14T11:05:00Z",
    statement:
      "Blockchain technology is the future of STEM, and the Stellar network's scalability makes it ideal for real-world applications in healthcare data management.",
    documents: [],
    currentStatus: "submitted",
  },
  {
    applicationId: "app-002",
    applicantName: "Current Student",
    applicantEmail: "student@example.com",
    scholarshipTitle: "Web3 Diversity & Inclusion Bursary",
    scholarshipId: "prog-002",
    submittedAt: "2026-09-10T09:15:00Z",
    statement:
      "As a first-generation college student from an underserved community, this bursary would allow me to complete my Web3 development training without financial burden.",
    financialNeed:
      "My family's annual income is $28,000. I work part-time to cover living expenses and rely on scholarships to fund my education.",
    documents: [],
    currentStatus: "submitted",
  },
];

// ─── Disbursements ────────────────────────────────────────────────────────────

export const mockDisbursements: DisbursementRecord[] = [
  {
    id: "disb-001",
    applicationId: "app-005",
    applicantId: "student-004",
    applicantName: "Sam Okonkwo",
    scholarshipTitle: "Web3 Diversity & Inclusion Bursary",
    sponsorName: "ChainVerse Foundation",
    amount: 300,
    currency: "XLM",
    walletAddress: "GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGKZ4Y7J5XJML3QOFMXJX",
    status: "pending",
    scheduledDate: "2026-09-25",
    createdAt: "2026-09-10T11:00:00Z",
  },
  {
    id: "disb-002",
    applicationId: "app-005",
    applicantId: "student-004",
    applicantName: "Sam Okonkwo",
    scholarshipTitle: "Blockchain Fundamentals Grant (Closed)",
    sponsorName: "ChainVerse Foundation",
    amount: 100,
    currency: "XLM",
    walletAddress: "GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGKZ4Y7J5XJML3QOFMXJX",
    status: "paid",
    txHash:
      "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
    scheduledDate: "2026-07-15",
    processedDate: "2026-07-15T14:30:00Z",
    createdAt: "2026-07-10T09:00:00Z",
  },
  {
    id: "disb-003",
    applicationId: "app-003",
    applicantId: "student-002",
    applicantName: "Alex Rivera",
    scholarshipTitle: "DeFi Innovators Merit Scholarship",
    sponsorName: "DeFi Builders DAO",
    amount: 1000,
    currency: "XLM",
    walletAddress: "GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSQHG4W37",
    status: "processing",
    scheduledDate: "2026-09-28",
    createdAt: "2026-09-18T15:00:00Z",
  },
];

// ─── Admin Stats ──────────────────────────────────────────────────────────────

export const mockAdminStats: AdminStats = {
  totalPrograms: mockPrograms.length,
  openPrograms: mockPrograms.filter((p) => p.status === "open").length,
  totalApplications: mockApplications.length,
  pendingReview: mockReviewQueue.length,
  totalDisbursed: 400, // XLM paid out so far (disb-002)
  currency: "XLM",
};
