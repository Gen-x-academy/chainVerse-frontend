/**
 * Sponsor Team Membership and Invitations Types.
 *
 * Enforces least-privilege access for sponsor team roles:
 * - owner: Full authority over organization, team members, programs, and disbursements.
 * - finance: Manages payments, refunds, and financial ledger; no program or review access.
 * - program: Configures programs, rounds, criteria, and milestones; no direct disbursement authority.
 * - reviewer: Double-blind review and rubric scoring; strictly blinded student access, no financial data.
 * - reporting: Reads aggregate impact, analytics, and SLIs; zero student PII and no mutation rights.
 */

export type SponsorTeamRole = 'owner' | 'finance' | 'program' | 'reviewer' | 'reporting';

export type SponsorMemberStatus = 'active' | 'suspended' | 'removed';

export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'revoked';

export type SponsorPermission =
  | 'team:manage'
  | 'team:read'
  | 'finance:manage'
  | 'finance:read'
  | 'program:manage'
  | 'program:read'
  | 'review:submit'
  | 'review:read'
  | 'reporting:view';

export type SponsorVerificationStatus =
  | 'unverified'
  | 'pending'
  | 'verified'
  | 'rejected'
  | 'revoked';

export type ComplianceTier = 'tier1_standard' | 'tier2_enhanced' | 'tier3_institutional';

export type LegalEntityType =
  | 'corporation'
  | 'foundation'
  | 'dao'
  | 'university'
  | 'non_profit'
  | 'individual';

export interface SponsorPrivateContacts {
  billingContact?: {
    name: string;
    email: string;
    phone?: string;
    billingAddress?: string;
  };
  legalContact?: {
    name: string;
    email: string;
    phone?: string;
  };
  complianceContact?: {
    name: string;
    email: string;
    phone?: string;
  };
  taxId?: string; // EIN / VAT / Company Registration ID
  registrationNumber?: string;
}

export interface SponsorBranding {
  logoUrl?: string;
  bannerUrl?: string;
  primaryColor?: string;
  tagline?: string;
  bio?: string;
  website?: string;
  socialLinks?: {
    twitter?: string;
    github?: string;
    linkedin?: string;
    discord?: string;
  };
}

export interface ComplianceDocument {
  id: string;
  sponsorId: string;
  type:
    | 'certificate_of_incorporation'
    | 'tax_exemption_proof'
    | 'proof_of_address'
    | 'bank_statement'
    | 'authorized_signatory';
  title: string;
  fileName: string;
  fileSizeBytes: number;
  mimeType: string;
  uploadedAt: string;
  uploadedBy: string;
  status: 'pending_review' | 'approved' | 'rejected';
  reviewedAt?: string;
  reviewedBy?: string;
  rejectionReason?: string;
}

export interface SponsorOrganization {
  id: string;
  name: string;
  slug: string;
  contactEmail: string;
  website?: string;
  createdAt: string;

  // Tenant scoping & ownership
  tenantId?: string;
  ownerId?: string;

  // Identity & Legal
  legalName?: string;
  legalEntityType?: LegalEntityType;
  jurisdiction?: string; // Country ISO code (e.g., 'US', 'GB', 'SG')
  foundedYear?: number;

  // Verification & Compliance
  verificationStatus?: SponsorVerificationStatus;
  complianceTier?: ComplianceTier;
  isVerified?: boolean;
  verifiedAt?: string;
  verifiedBy?: string;
  verificationNotes?: string;

  // Branding
  branding?: SponsorBranding;

  // Public Contacts
  publicEmail?: string;
  publicPhone?: string;
  publicWebsite?: string;

  // Private Contacts (Strictly Redacted from Public Views)
  privateContacts?: SponsorPrivateContacts;

  // Compliance Documents
  complianceDocuments?: ComplianceDocument[];
}

export interface PublicSponsorProfile {
  id: string;
  name: string;
  slug: string;
  legalEntityType?: LegalEntityType;
  jurisdiction?: string;
  verificationStatus: SponsorVerificationStatus;
  complianceTier: ComplianceTier;
  isVerified: boolean;
  verifiedAt?: string;
  branding: SponsorBranding;
  publicEmail: string;
  publicWebsite?: string;
  publicPhone?: string;
  createdAt: string;
  programsCount?: number;
}

export type SponsorVerificationAction =
  | 'verification.requested'
  | 'verification.approved'
  | 'verification.rejected'
  | 'verification.revoked'
  | 'verification.tier_updated'
  | 'verification.document_uploaded'
  | 'verification.document_reviewed'
  | 'profile.created'
  | 'profile.updated';

export interface SponsorVerificationAuditEvent {
  id: string;
  sequence: number;
  sponsorId: string;
  tenantId: string;
  actorId: string;
  actorEmail: string;
  actorRole: string;
  action: SponsorVerificationAction;
  previousStatus?: SponsorVerificationStatus;
  newStatus?: SponsorVerificationStatus;
  previousTier?: ComplianceTier;
  newTier?: ComplianceTier;
  documentId?: string;
  reason?: string;
  occurredAt: string;
  metadata?: Record<string, unknown>;
}

export interface CreateSponsorOrgPayload {
  name: string;
  slug?: string;
  legalName: string;
  legalEntityType: LegalEntityType;
  jurisdiction: string;
  contactEmail: string;
  publicEmail?: string;
  website?: string;
  branding?: SponsorBranding;
  privateContacts?: SponsorPrivateContacts;
}

export interface UpdateSponsorOrgPayload {
  name?: string;
  legalName?: string;
  legalEntityType?: LegalEntityType;
  jurisdiction?: string;
  contactEmail?: string;
  publicEmail?: string;
  website?: string;
  branding?: SponsorBranding;
  privateContacts?: SponsorPrivateContacts;
}

export interface RequestVerificationPayload {
  requestedTier?: ComplianceTier;
  notes?: string;
}

export interface ReviewVerificationPayload {
  decision: 'approved' | 'rejected';
  assignedTier?: ComplianceTier;
  notes?: string;
}

export interface UploadComplianceDocPayload {
  type: ComplianceDocument['type'];
  title: string;
  fileName: string;
  fileSizeBytes: number;
  mimeType: string;
}

export interface SponsorOrgFilterCriteria {
  verificationStatus?: SponsorVerificationStatus | 'all';
  complianceTier?: ComplianceTier | 'all';
  jurisdiction?: string | 'all';
  search?: string;
  tenantId?: string;
}


export interface SponsorTeamMember {
  id: string;
  sponsorId: string;
  userId: string;
  email: string;
  name: string;
  role: SponsorTeamRole;
  status: SponsorMemberStatus;
  joinedAt: string; // ISO-8601
  updatedAt: string; // ISO-8601
  invitedBy: string; // userId of inviter
  lastActiveAt?: string;
}

export interface SponsorInvitation {
  id: string;
  sponsorId: string;
  sponsorName: string;
  email: string;
  role: SponsorTeamRole;
  invitedBy: string; // userId of inviter
  invitedByName: string;
  invitedAt: string; // ISO-8601
  expiresAt: string; // ISO-8601
  status: InvitationStatus;
  token: string; // Cryptographic single-use nonce
  consumedAt?: string; // ISO-8601
  revokedAt?: string; // ISO-8601
  note?: string;
}

export type SponsorAuditEventAction =
  | 'team.invitation_created'
  | 'team.invitation_accepted'
  | 'team.invitation_revoked'
  | 'team.invitation_resent'
  | 'team.member_role_updated'
  | 'team.member_removed'
  | 'team.member_suspended'
  | 'team.member_reinstated';

export interface SponsorTeamAuditEvent {
  id: string;
  sequence: number;
  sponsorId: string;
  actorId: string;
  actorEmail: string;
  action: SponsorAuditEventAction;
  targetId: string;
  targetEmail: string;
  previousRole?: SponsorTeamRole;
  newRole?: SponsorTeamRole;
  occurredAt: string; // ISO-8601
  reason?: string;
  metadata?: Record<string, unknown>;
}

export interface InviteMemberPayload {
  email: string;
  role: SponsorTeamRole;
  expiresInDays?: number; // Defaults to 7 days
  note?: string;
}

export interface UpdateMemberRolePayload {
  newRole: SponsorTeamRole;
  reason?: string;
}

export interface RemoveMemberPayload {
  reason?: string;
}

export interface AcceptInvitationPayload {
  token: string;
  userId: string;
  email: string;
  name?: string;
}

export interface ValidateTokenResult {
  valid: boolean;
  invitation?: SponsorInvitation;
  reason?: 'EXPIRED' | 'ALREADY_CONSUMED' | 'REVOKED' | 'NOT_FOUND' | 'INVALID_STATUS';
}

export interface MemberFilterCriteria {
  role?: SponsorTeamRole | 'all';
  status?: SponsorMemberStatus | 'all';
  search?: string;
}

export interface InvitationFilterCriteria {
  status?: InvitationStatus | 'all';
  search?: string;
}

export interface RoleDescription {
  role: SponsorTeamRole;
  title: string;
  description: string;
  permissions: SponsorPermission[];
  leastPrivilegeScope: string;
}

export const SPONSOR_ROLE_DEFINITIONS: Record<SponsorTeamRole, RoleDescription> = {
  owner: {
    role: 'owner',
    title: 'Sponsor Owner',
    description: 'Full administrative control over sponsor programs, disbursements, and team members.',
    permissions: [
      'team:manage',
      'team:read',
      'finance:manage',
      'finance:read',
      'program:manage',
      'program:read',
      'review:submit',
      'review:read',
      'reporting:view',
    ],
    leastPrivilegeScope: 'Complete organization administration and team governance.',
  },
  finance: {
    role: 'finance',
    title: 'Finance Manager',
    description: 'Manages award funding pools, executes disbursements, handles refunds, and monitors financial ledgers.',
    permissions: ['team:read', 'finance:manage', 'finance:read', 'program:read'],
    leastPrivilegeScope: 'Financial custody and settlement only; strictly excluded from application scoring and program changes.',
  },
  program: {
    role: 'program',
    title: 'Program Manager',
    description: 'Creates and manages scholarship programs, application rounds, eligibility rules, and milestone criteria.',
    permissions: ['team:read', 'program:manage', 'program:read', 'review:read'],
    leastPrivilegeScope: 'Program governance only; cannot execute bank transfers, disburse funds, or invite team members.',
  },
  reviewer: {
    role: 'reviewer',
    title: 'Application Reviewer',
    description: 'Evaluates applicant submissions using blind scoring rubrics and declares potential conflicts.',
    permissions: ['review:submit', 'review:read'],
    leastPrivilegeScope: 'Double-blind evaluation only; strictly isolated from applicant PII, payout data, and org administration.',
  },
  reporting: {
    role: 'reporting',
    title: 'Reporting Analyst',
    description: 'Views aggregate impact reports, program funnel metrics, completion statistics, and compliance exports.',
    permissions: ['team:read', 'program:read', 'reporting:view'],
    leastPrivilegeScope: 'Read-only aggregate metrics; cannot view individual student identities or mutate any resource.',
  },
};
