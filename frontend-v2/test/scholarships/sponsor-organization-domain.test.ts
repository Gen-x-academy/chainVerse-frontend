// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  assertTenantAccess,
  canViewPrivateContacts,
  sanitizeSponsorPublicProfile,
  validateCreateSponsorOrgPayload,
  createSponsorOrganization,
  requestSponsorVerification,
  reviewSponsorVerification,
  revokeSponsorVerification,
  addComplianceDocument,
  filterSponsorOrganizations,
} from '@/src/features/scholarships/sponsors/domain';
import {
  mockSponsorOrg,
  mockUnverifiedSponsorOrg,
  mockPendingSponsorOrg,
} from '@/src/features/scholarships/sponsors/fixtures';
import type {
  CreateSponsorOrgPayload,
  SponsorOrganization,
} from '@/src/features/scholarships/sponsors/types';

describe('Sponsor Organizations & Verified Profiles Domain Logic', () => {
  const mockTenantOwner = {
    userId: 'user-elena-owner',
    userEmail: 'elena.rostova@stellarimpact.org',
    tenantId: 'tenant-stellar-global',
    role: 'owner',
  };

  const mockOtherTenantUser = {
    userId: 'user-foreign',
    userEmail: 'foreign@other-org.com',
    tenantId: 'tenant-other-realm',
    role: 'owner',
  };

  const mockAdmin = {
    userId: 'user-platform-admin',
    userEmail: 'compliance@chainverse.org',
    role: 'administrator',
  };

  /* -------------------------------------------------------------------------- */
  /* Acceptance Criterion 1: Sponsor Ownership is Tenant-Scoped                */
  /* -------------------------------------------------------------------------- */
  describe('1. Tenant-Scoped Ownership & Boundary Enforcement', () => {
    it('permits access when actor tenantId matches organization tenantId', () => {
      expect(() =>
        assertTenantAccess(mockSponsorOrg, 'tenant-stellar-global', false)
      ).not.toThrow();
    });

    it('permits platform administrators to bypass tenant boundaries', () => {
      expect(() =>
        assertTenantAccess(mockSponsorOrg, 'tenant-unrelated', true)
      ).not.toThrow();
    });

    it('strictly throws cross-tenant access violation when tenantId mismatches', () => {
      expect(() =>
        assertTenantAccess(mockSponsorOrg, 'tenant-adversary', false)
      ).toThrowError(/cross-tenant access violation/i);
    });

    it('automatically scopes newly created organizations to creator tenantId', () => {
      const payload: CreateSponsorOrgPayload = {
        name: 'Solana Builders Fund',
        legalName: 'Solana Builders Foundation Inc.',
        legalEntityType: 'foundation',
        jurisdiction: 'CH',
        contactEmail: 'contact@solanabuilders.org',
      };

      const { org, auditEvent } = createSponsorOrganization(payload, {
        userId: 'user-creator',
        userEmail: 'creator@solanabuilders.org',
        tenantId: 'tenant-solana-workspace',
        role: 'owner',
      });

      expect(org.tenantId).toBe('tenant-solana-workspace');
      expect(org.ownerId).toBe('user-creator');
      expect(auditEvent.tenantId).toBe('tenant-solana-workspace');
      expect(auditEvent.action).toBe('profile.created');
    });
  });

  /* -------------------------------------------------------------------------- */
  /* Acceptance Criterion 2: Private Contacts Are Not Exposed Publicly          */
  /* -------------------------------------------------------------------------- */
  describe('2. Private Contact Segregation & Sanitization', () => {
    it('sanitizeSponsorPublicProfile completely strips private KYC contacts and documents', () => {
      const publicProfile = sanitizeSponsorPublicProfile(mockSponsorOrg, 5);

      // Verify public attributes are intact
      expect(publicProfile.id).toBe(mockSponsorOrg.id);
      expect(publicProfile.name).toBe(mockSponsorOrg.name);
      expect(publicProfile.isVerified).toBe(true);
      expect(publicProfile.complianceTier).toBe('tier2_enhanced');
      expect(publicProfile.publicEmail).toBe(mockSponsorOrg.publicEmail);
      expect(publicProfile.programsCount).toBe(5);

      // Verify confidential contacts are completely absent from public profile
      expect((publicProfile as any).privateContacts).toBeUndefined();
      expect((publicProfile as any).complianceDocuments).toBeUndefined();
      expect((publicProfile as any).tenantId).toBeUndefined();
      expect((publicProfile as any).ownerId).toBeUndefined();
    });

    it('canViewPrivateContacts denies access to unauthenticated or public viewers', () => {
      expect(canViewPrivateContacts(undefined, mockSponsorOrg)).toBe(false);
      expect(canViewPrivateContacts({ role: 'student' }, mockSponsorOrg)).toBe(false);
    });

    it('canViewPrivateContacts denies access to members from other tenants', () => {
      expect(
        canViewPrivateContacts(
          { tenantId: 'tenant-other', role: 'owner' },
          mockSponsorOrg
        )
      ).toBe(false);
    });

    it('canViewPrivateContacts grants access to same-tenant owners and finance managers', () => {
      expect(
        canViewPrivateContacts(
          { tenantId: 'tenant-stellar-global', role: 'owner' },
          mockSponsorOrg
        )
      ).toBe(true);

      expect(
        canViewPrivateContacts(
          { tenantId: 'tenant-stellar-global', role: 'finance' },
          mockSponsorOrg
        )
      ).toBe(true);
    });

    it('canViewPrivateContacts grants access to platform administrators across tenants', () => {
      expect(
        canViewPrivateContacts(
          { tenantId: 'any-tenant', role: 'administrator' },
          mockSponsorOrg
        )
      ).toBe(true);
    });
  });

  /* -------------------------------------------------------------------------- */
  /* Acceptance Criterion 3: Verification is Auditable                          */
  /* -------------------------------------------------------------------------- */
  describe('3. Auditable Verification Lifecycle', () => {
    it('requestSponsorVerification transitions status to pending and generates audit log', () => {
      const { updatedOrg, auditEvent } = requestSponsorVerification(
        mockUnverifiedSponsorOrg,
        {
          userId: 'user-satoshi-lead',
          userEmail: 'contact@quantumleapdao.xyz',
          tenantId: 'tenant-quantum-dao',
          role: 'owner',
        },
        { notes: 'Submitted Swiss non-profit registration paperwork.' }
      );

      expect(updatedOrg.verificationStatus).toBe('pending');
      expect(auditEvent.action).toBe('verification.requested');
      expect(auditEvent.previousStatus).toBe('unverified');
      expect(auditEvent.newStatus).toBe('pending');
      expect(auditEvent.reason).toContain('Swiss non-profit');
    });

    it('rejects duplicate verification requests when already pending or verified', () => {
      expect(() =>
        requestSponsorVerification(
          mockPendingSponsorOrg,
          {
            userId: 'user-dr-clara',
            userEmail: 'clara.oswald@apexfund.org',
            tenantId: 'tenant-apex-global',
          }
        )
      ).toThrowError(/already pending review/i);

      expect(() =>
        requestSponsorVerification(
          mockSponsorOrg,
          {
            userId: mockTenantOwner.userId,
            userEmail: mockTenantOwner.userEmail,
            tenantId: mockTenantOwner.tenantId,
          }
        )
      ).toThrowError(/already verified/i);
    });

    it('reviewSponsorVerification requires platform admin authority and audits approval', () => {
      // Non-admin attempt must fail
      expect(() =>
        reviewSponsorVerification(
          mockPendingSponsorOrg,
          { userId: 'user-hacker', userEmail: 'hacker@evil.com', role: 'student' },
          { decision: 'approved', assignedTier: 'tier2_enhanced' }
        )
      ).toThrowError(/requires platform administrator privileges/i);

      // Admin approval succeeds
      const { updatedOrg, auditEvent } = reviewSponsorVerification(
        mockPendingSponsorOrg,
        mockAdmin,
        {
          decision: 'approved',
          assignedTier: 'tier3_institutional',
          notes: 'UK Charity Commission registration validated.',
        }
      );

      expect(updatedOrg.verificationStatus).toBe('verified');
      expect(updatedOrg.isVerified).toBe(true);
      expect(updatedOrg.complianceTier).toBe('tier3_institutional');
      expect(updatedOrg.verifiedBy).toBe(mockAdmin.userId);
      expect(auditEvent.action).toBe('verification.approved');
      expect(auditEvent.newStatus).toBe('verified');
      expect(auditEvent.newTier).toBe('tier3_institutional');
    });

    it('reviewSponsorVerification handles rejection with audit logging', () => {
      const { updatedOrg, auditEvent } = reviewSponsorVerification(
        mockPendingSponsorOrg,
        mockAdmin,
        {
          decision: 'rejected',
          notes: 'Proof of address document illegible.',
        }
      );

      expect(updatedOrg.verificationStatus).toBe('rejected');
      expect(updatedOrg.isVerified).toBe(false);
      expect(auditEvent.action).toBe('verification.rejected');
      expect(auditEvent.newStatus).toBe('rejected');
      expect(auditEvent.reason).toContain('illegible');
    });

    it('revokeSponsorVerification transitions status to revoked with audit reason', () => {
      const { updatedOrg, auditEvent } = revokeSponsorVerification(
        mockSponsorOrg,
        mockAdmin,
        'Tax exempt status revoked by tax authority.'
      );

      expect(updatedOrg.verificationStatus).toBe('revoked');
      expect(updatedOrg.isVerified).toBe(false);
      expect(auditEvent.action).toBe('verification.revoked');
      expect(auditEvent.reason).toContain('Tax exempt status revoked');
    });
  });

  /* -------------------------------------------------------------------------- */
  /* Compliance Documents & Organization Filtering                              */
  /* -------------------------------------------------------------------------- */
  describe('4. Compliance Documents & Filtering', () => {
    it('addComplianceDocument registers credential under pending_review and logs audit event', () => {
      const { updatedOrg, document, auditEvent } = addComplianceDocument(
        mockUnverifiedSponsorOrg,
        {
          type: 'proof_of_address',
          title: 'Zurich Office Utility Statement',
          fileName: 'utility_bill_ch.pdf',
          fileSizeBytes: 1500000,
          mimeType: 'application/pdf',
        },
        {
          userId: 'user-satoshi-lead',
          userEmail: 'contact@quantumleapdao.xyz',
          tenantId: 'tenant-quantum-dao',
          role: 'owner',
        }
      );

      expect(document.status).toBe('pending_review');
      expect(document.title).toBe('Zurich Office Utility Statement');
      expect(updatedOrg.complianceDocuments?.length).toBe(1);
      expect(auditEvent.action).toBe('verification.document_uploaded');
    });

    it('filterSponsorOrganizations filters correctly by verification status, tier, and search', () => {
      const orgs: SponsorOrganization[] = [
        mockSponsorOrg,
        mockUnverifiedSponsorOrg,
        mockPendingSponsorOrg,
      ];

      // Verified filter
      const verifiedOnly = filterSponsorOrganizations(orgs, { verificationStatus: 'verified' });
      expect(verifiedOnly.length).toBe(1);
      expect(verifiedOnly[0].id).toBe('sponsor-stellar-impact');

      // Tier filter
      const tier2Only = filterSponsorOrganizations(orgs, { complianceTier: 'tier2_enhanced' });
      expect(tier2Only.length).toBe(2);

      // Search filter
      const searched = filterSponsorOrganizations(orgs, { search: 'quantum' });
      expect(searched.length).toBe(1);
      expect(searched[0].name).toBe('Quantum Leap DAO');
    });
  });
});
