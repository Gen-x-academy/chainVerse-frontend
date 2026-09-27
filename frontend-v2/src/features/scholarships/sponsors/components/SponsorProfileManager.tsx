'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  Award,
  Building2,
  CheckCircle2,
  ExternalLink,
  FileCheck,
  Globe,
  History,
  Lock,
  Mail,
  Shield,
  ShieldCheck,
  UploadCloud,
  Users,
} from 'lucide-react';
import { useSponsorOrgStore } from '../orgStore';
import { canViewPrivateContacts } from '../domain';
import { VerificationBadge } from './VerificationBadge';
import { PrivateContactsCard } from './PrivateContactsCard';
import { ComplianceDocumentsPanel } from './ComplianceDocumentsPanel';
import { VerificationAuditTrail } from './VerificationAuditTrail';
import type {
  ComplianceTier,
  PublicSponsorProfile,
  SponsorOrganization,
  SponsorPrivateContacts,
} from '../types';

export interface SponsorProfileManagerProps {
  sponsorId: string;
  currentUser?: {
    userId: string;
    email: string;
    role?: string; // 'owner' | 'finance' | 'administrator' | 'student' | etc.
    tenantId?: string;
  };
  className?: string;
}

export function SponsorProfileManager({
  sponsorId,
  currentUser,
  className = '',
}: SponsorProfileManagerProps) {
  const {
    activeOrg,
    verificationAuditEvents,
    isLoading,
    isMutating,
    error,
    successMessage,
    clearMessages,
    loadOrganization,
    requestVerification,
    reviewVerification,
    uploadComplianceDoc,
    fetchVerificationAudit,
  } = useSponsorOrgStore();

  const [activeTab, setActiveTab] = useState<'about' | 'private' | 'compliance' | 'audit'>('about');
  const [showAdminReviewModal, setShowAdminReviewModal] = useState(false);
  const [adminDecision, setAdminDecision] = useState<'approved' | 'rejected'>('approved');
  const [adminTier, setAdminTier] = useState<ComplianceTier>('tier2_enhanced');
  const [adminNotes, setAdminNotes] = useState('');

  useEffect(() => {
    loadOrganization(sponsorId, currentUser);
    fetchVerificationAudit(sponsorId, currentUser);
  }, [sponsorId, currentUser, loadOrganization, fetchVerificationAudit]);

  if (isLoading || !activeOrg) {
    return (
      <div
        role="status"
        aria-busy="true"
        className="rounded-2xl border border-slate-200 bg-white p-12 text-center space-y-3"
      >
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent mx-auto" />
        <h3 className="text-sm font-semibold text-slate-800">Loading sponsor profile...</h3>
      </div>
    );
  }

  // Type narrowing between SponsorOrganization and PublicSponsorProfile
  const fullOrg = 'privateContacts' in activeOrg ? (activeOrg as SponsorOrganization) : null;
  const isAuthorizedViewer = Boolean(
    currentUser &&
      (currentUser.role === 'administrator' ||
        currentUser.role === 'admin' ||
        (fullOrg?.tenantId &&
          currentUser.tenantId === fullOrg.tenantId &&
          (currentUser.role === 'owner' || currentUser.role === 'finance')))
  );

  const isPlatformAdmin =
    currentUser?.role === 'administrator' || currentUser?.role === 'admin';

  const isOwner =
    Boolean(fullOrg?.tenantId && currentUser?.tenantId === fullOrg.tenantId) ||
    isPlatformAdmin;

  const isVerified = Boolean(activeOrg.isVerified || activeOrg.verificationStatus === 'verified');
  const isPending = activeOrg.verificationStatus === 'pending';

  const branding = activeOrg.branding || {};

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Toast Notifications */}
      {successMessage && (
        <div
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-800 flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
            <span>{successMessage}</span>
          </div>
          <button type="button" onClick={clearMessages} className="font-semibold underline">
            Dismiss
          </button>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800 flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" aria-hidden="true" />
            <span>{error}</span>
          </div>
          <button type="button" onClick={clearMessages} className="font-semibold underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Banner & Profile Hero Card */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
        {/* Banner Image */}
        <div
          className="h-36 sm:h-48 w-full bg-cover bg-center bg-indigo-900/10 relative"
          style={{
            backgroundImage: branding.bannerUrl ? `url(${branding.bannerUrl})` : undefined,
            backgroundColor: branding.primaryColor || '#4f46e5',
          }}
        >
          {isAuthorizedViewer && fullOrg?.tenantId && (
            <div className="absolute top-3 right-3 rounded-lg bg-black/60 backdrop-blur-xs px-2.5 py-1 text-[11px] font-mono text-white">
              Tenant: {fullOrg.tenantId}
            </div>
          )}
        </div>

        {/* Organization Information Header */}
        <div className="p-6 sm:p-8 relative">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-16 sm:-mt-20">
            {/* Logo Avatar */}
            <div className="relative flex h-20 w-20 sm:h-24 sm:w-24 shrink-0 items-center justify-center rounded-2xl border-4 border-white bg-indigo-600 text-white shadow-md overflow-hidden text-2xl font-bold">
              {branding.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={branding.logoUrl} alt={`${activeOrg.name} logo`} className="h-full w-full object-cover" />
              ) : (
                activeOrg.name.charAt(0)
              )}
            </div>

            {/* Quick Action Buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              {isOwner && !isVerified && !isPending && (
                <button
                  type="button"
                  onClick={() =>
                    currentUser &&
                    requestVerification(
                      activeOrg.id,
                      { notes: 'Submitted for official verification review.' },
                      {
                        userId: currentUser.userId,
                        userEmail: currentUser.email,
                        tenantId: currentUser.tenantId || fullOrg?.tenantId || 'tenant-default',
                        role: currentUser.role,
                      }
                    )
                  }
                  disabled={isMutating}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 disabled:opacity-50"
                >
                  <UploadCloud className="h-4 w-4" aria-hidden="true" />
                  <span>Request Verification</span>
                </button>
              )}

              {isPlatformAdmin && isPending && (
                <button
                  type="button"
                  onClick={() => setShowAdminReviewModal(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700"
                >
                  <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                  <span>Adjudicate Verification</span>
                </button>
              )}

              <Link
                href={`/scholarships/sponsors/${activeOrg.id}/team`}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <Users className="h-4 w-4 text-slate-500" aria-hidden="true" />
                <span>Team Members</span>
              </Link>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">{activeOrg.name}</h1>
              <VerificationBadge
                status={activeOrg.verificationStatus}
                tier={activeOrg.complianceTier}
                verifiedAt={activeOrg.verifiedAt}
              />
            </div>

            {branding.tagline && (
              <p className="text-xs sm:text-sm font-medium text-slate-600">{branding.tagline}</p>
            )}

            {/* Public Links & Details */}
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-2">
              {activeOrg.jurisdiction && (
                <span>Jurisdiction: <strong className="text-slate-700">{activeOrg.jurisdiction}</strong></span>
              )}
              {activeOrg.legalEntityType && (
                <span>Entity: <strong className="text-slate-700">{activeOrg.legalEntityType}</strong></span>
              )}
              {activeOrg.publicEmail && (
                <div className="flex items-center gap-1">
                  <Mail className="h-3 w-3 text-slate-400" aria-hidden="true" />
                  <a href={`mailto:${activeOrg.publicEmail}`} className="text-indigo-600 hover:underline">
                    {activeOrg.publicEmail}
                  </a>
                </div>
              )}
              {activeOrg.publicWebsite && (
                <div className="flex items-center gap-1">
                  <Globe className="h-3 w-3 text-slate-400" aria-hidden="true" />
                  <a
                    href={activeOrg.publicWebsite}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-600 hover:underline flex items-center gap-0.5"
                  >
                    <span>Website</span>
                    <ExternalLink className="h-2.5 w-2.5" aria-hidden="true" />
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="border-t border-slate-100 bg-slate-50/50 px-6 sm:px-8">
          <nav aria-label="Sponsor profile tabs" className="flex gap-6">
            <button
              type="button"
              onClick={() => setActiveTab('about')}
              className={`py-3 text-xs font-semibold border-b-2 transition ${
                activeTab === 'about'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              Overview &amp; Mission
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('private')}
              className={`flex items-center gap-1.5 py-3 text-xs font-semibold border-b-2 transition ${
                activeTab === 'private'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <Lock className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Private Contacts &amp; KYC</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('compliance')}
              className={`flex items-center gap-1.5 py-3 text-xs font-semibold border-b-2 transition ${
                activeTab === 'compliance'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <FileCheck className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Compliance Documents</span>
            </button>

            {isAuthorizedViewer && (
              <button
                type="button"
                onClick={() => setActiveTab('audit')}
                className={`flex items-center gap-1.5 py-3 text-xs font-semibold border-b-2 transition ${
                  activeTab === 'audit'
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <History className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Verification Audit</span>
              </button>
            )}
          </nav>
        </div>
      </div>

      {/* Tab 1: About & Public Mission */}
      {activeTab === 'about' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900">About the Organization</h3>
            <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">
              {branding.bio || 'No public mission statement provided.'}
            </p>
          </div>
        </div>
      )}

      {/* Tab 2: Private Contacts & KYC */}
      {activeTab === 'private' && (
        <PrivateContactsCard
          privateContacts={fullOrg?.privateContacts}
          isAuthorized={isAuthorizedViewer}
          tenantId={fullOrg?.tenantId}
        />
      )}

      {/* Tab 3: Compliance Documents & Verification */}
      {activeTab === 'compliance' && (
        <ComplianceDocumentsPanel
          documents={fullOrg?.complianceDocuments}
          isAuthorized={isAuthorizedViewer}
          isMutating={isMutating}
          onUploadDocument={async (payload) => {
            if (!currentUser) return false;
            return uploadComplianceDoc(activeOrg.id, payload, {
              userId: currentUser.userId,
              userEmail: currentUser.email,
              tenantId: currentUser.tenantId || fullOrg?.tenantId || 'tenant-default',
              role: currentUser.role,
            });
          }}
        />
      )}

      {/* Tab 4: Verification Audit Trail */}
      {activeTab === 'audit' && isAuthorizedViewer && (
        <VerificationAuditTrail events={verificationAuditEvents} />
      )}

      {/* Platform Administrator Review Modal */}
      {showAdminReviewModal && isPlatformAdmin && (
        <div
          role="dialog"
          aria-labelledby="review-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 id="review-modal-title" className="text-sm font-bold text-slate-900">
                Adjudicate Sponsor Verification
              </h3>
              <button
                type="button"
                onClick={() => setShowAdminReviewModal(false)}
                className="text-slate-400 hover:text-slate-600 text-xs"
              >
                Close
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Decision</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="decision"
                      checked={adminDecision === 'approved'}
                      onChange={() => setAdminDecision('approved')}
                    />
                    <span className="font-semibold text-emerald-700">Approve</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="decision"
                      checked={adminDecision === 'rejected'}
                      onChange={() => setAdminDecision('rejected')}
                    />
                    <span className="font-semibold text-rose-700">Reject</span>
                  </label>
                </div>
              </div>

              {adminDecision === 'approved' && (
                <div>
                  <label htmlFor="assign-tier" className="block font-semibold text-slate-700 mb-1">
                    Compliance Tier
                  </label>
                  <select
                    id="assign-tier"
                    value={adminTier}
                    onChange={(e) => setAdminTier(e.target.value as ComplianceTier)}
                    className="w-full rounded-lg border border-slate-300 p-2 text-xs"
                  >
                    <option value="tier1_standard">Tier 1 Standard</option>
                    <option value="tier2_enhanced">Tier 2 Enhanced</option>
                    <option value="tier3_institutional">Tier 3 Institutional</option>
                  </select>
                </div>
              )}

              <div>
                <label htmlFor="auditor-notes" className="block font-semibold text-slate-700 mb-1">
                  Audit Notes / Reason
                </label>
                <textarea
                  id="auditor-notes"
                  rows={3}
                  placeholder="Record formal verification rationale or missing documentation..."
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 p-2 text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowAdminReviewModal(false)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (currentUser) {
                    await reviewVerification(
                      activeOrg.id,
                      {
                        decision: adminDecision,
                        assignedTier: adminDecision === 'approved' ? adminTier : undefined,
                        notes: adminNotes.trim() || undefined,
                      },
                      {
                        userId: currentUser.userId,
                        userEmail: currentUser.email,
                        role: currentUser.role || 'administrator',
                      }
                    );
                    setShowAdminReviewModal(false);
                  }
                }}
                className={`rounded-lg px-4 py-1.5 text-xs font-bold text-white shadow-xs ${
                  adminDecision === 'approved'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                Submit Decision
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
