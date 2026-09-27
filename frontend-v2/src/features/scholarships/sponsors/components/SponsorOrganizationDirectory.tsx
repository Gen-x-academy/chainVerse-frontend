'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Building2,
  CheckCircle2,
  Filter,
  Globe,
  Plus,
  Search,
  Shield,
  ShieldCheck,
} from 'lucide-react';
import { useSponsorOrgStore } from '../orgStore';
import { VerificationBadge } from './VerificationBadge';
import type { ComplianceTier, SponsorVerificationStatus } from '../types';

export interface SponsorOrganizationDirectoryProps {
  currentUser?: {
    userId?: string;
    role?: string;
    tenantId?: string;
  };
  className?: string;
}

export function SponsorOrganizationDirectory({
  currentUser,
  className = '',
}: SponsorOrganizationDirectoryProps) {
  const {
    organizations,
    isLoading,
    error,
    filterVerification,
    filterTier,
    searchQuery,
    setFilterVerification,
    setFilterTier,
    setSearchQuery,
    fetchOrganizations,
  } = useSponsorOrgStore();

  useEffect(() => {
    fetchOrganizations({
      verificationStatus: filterVerification,
      complianceTier: filterTier,
      search: searchQuery,
    });
  }, [fetchOrganizations, filterVerification, filterTier, searchQuery]);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header with Search and Create CTA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Sponsor Organizations</h1>
          <p className="text-xs text-slate-500">
            Discover verified foundations, corporate benefactors, and DAOs funding bursaries.
          </p>
        </div>

        <Link
          href="/scholarships/sponsors/new"
          className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 self-start sm:self-center"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span>Register Organization</span>
        </Link>
      </div>

      {/* Filters Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" aria-hidden="true" />
          <input
            type="text"
            placeholder="Search by organization name or legal entity..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2 text-xs text-slate-900 focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={filterVerification}
            onChange={(e) => setFilterVerification(e.target.value as SponsorVerificationStatus | 'all')}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700"
            aria-label="Filter by verification status"
          >
            <option value="all">All Verification States</option>
            <option value="verified">Verified Only</option>
            <option value="pending">Pending Review</option>
            <option value="unverified">Unverified</option>
          </select>

          <select
            value={filterTier}
            onChange={(e) => setFilterTier(e.target.value as ComplianceTier | 'all')}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700"
            aria-label="Filter by compliance tier"
          >
            <option value="all">All Tiers</option>
            <option value="tier1_standard">Tier 1 Standard</option>
            <option value="tier2_enhanced">Tier 2 Enhanced</option>
            <option value="tier3_institutional">Tier 3 Institutional</option>
          </select>
        </div>
      </div>

      {/* Loading Skeleton */}
      {isLoading && (
        <div
          role="status"
          aria-busy="true"
          className="rounded-2xl border border-slate-200 bg-white p-12 text-center"
        >
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent mx-auto" />
          <span className="mt-2 block text-xs text-slate-500">Loading sponsor directory...</span>
        </div>
      )}

      {/* Error Alert */}
      {error && !isLoading && (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800"
        >
          {error}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && organizations.length === 0 && (
        <div
          role="status"
          className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-12 text-center space-y-2"
        >
          <Building2 className="mx-auto h-8 w-8 text-slate-400" aria-hidden="true" />
          <h3 className="text-sm font-semibold text-slate-900">No organizations found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Try adjusting your search terms or verification filter criteria.
          </p>
        </div>
      )}

      {/* Organizations Grid */}
      {!isLoading && !error && organizations.length > 0 && (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {organizations.map((org) => {
            const branding = org.branding || {};
            return (
              <div
                key={org.id}
                className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-xs hover:border-slate-300 transition"
              >
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white font-bold overflow-hidden">
                      {branding.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={branding.logoUrl}
                          alt={`${org.name} logo`}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        org.name.charAt(0)
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/scholarships/sponsors/${org.id}`}
                        className="font-bold text-slate-900 hover:text-indigo-600 truncate block text-sm"
                      >
                        {org.name}
                      </Link>
                      <p className="text-[11px] text-slate-400 truncate">
                        {org.legalName || org.legalEntityType || 'Sponsor'}
                      </p>
                    </div>
                  </div>

                  <VerificationBadge
                    status={org.verificationStatus}
                    tier={org.complianceTier}
                    verifiedAt={org.verifiedAt}
                  />

                  {branding.tagline && (
                    <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                      {branding.tagline}
                    </p>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span>{org.jurisdiction ? `Country: ${org.jurisdiction}` : 'Global'}</span>
                  <Link
                    href={`/scholarships/sponsors/${org.id}`}
                    className="font-semibold text-indigo-600 hover:underline"
                  >
                    View Profile &rarr;
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
