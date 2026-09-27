'use client';

import React, { useId, useMemo, useState } from 'react';
import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  Clock,
  Coins,
  Copy,
  ExternalLink,
  FileCheck,
  History,
  Layers,
  Mail,
  Plus,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  XCircle,
} from 'lucide-react';
import {
  SPONSOR_ROLE_DEFINITIONS,
  type InviteMemberPayload,
  type MemberFilterCriteria,
  type SponsorInvitation,
  type SponsorMemberStatus,
  type SponsorTeamMember,
  type SponsorTeamRole,
  type UpdateMemberRolePayload,
} from '../types';
import {
  useInviteSponsorMember,
  useRemoveSponsorMember,
  useResendSponsorInvitation,
  useRevokeSponsorInvitation,
  useSponsorAuditEvents,
  useSponsorInvitations,
  useSponsorTeamMembers,
  useUpdateSponsorMemberRole,
} from '../hooks';
import { RoleBadge } from './RoleBadge';
import { InviteMemberModal } from './InviteMemberModal';
import { ChangeRoleModal } from './ChangeRoleModal';
import { RemoveMemberModal } from './RemoveMemberModal';
import { isInvitationExpired } from '../domain';

export interface SponsorTeamManagerProps {
  sponsorId?: string;
  sponsorName?: string;
  currentUserRole?: string; // e.g. 'owner', 'administrator', 'finance', 'reviewer'
  className?: string;
}

export function SponsorTeamManager({
  sponsorId = 'sponsor-stellar-impact',
  sponsorName = 'Stellar Impact Foundation',
  currentUserRole = 'owner',
  className = '',
}: SponsorTeamManagerProps) {
  const isOwner = currentUserRole === 'owner' || currentUserRole === 'administrator';

  const [activeTab, setActiveTab] = useState<'members' | 'invitations' | 'audit'>('members');
  const [roleFilter, setRoleFilter] = useState<SponsorTeamRole | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<SponsorMemberStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modals state
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [roleChangeMember, setRoleChangeMember] = useState<SponsorTeamMember | null>(null);
  const [removeMemberTarget, setRemoveMemberTarget] = useState<SponsorTeamMember | null>(null);

  // Queries
  const memberCriteria = useMemo<MemberFilterCriteria>(() => ({
    role: roleFilter !== 'all' ? roleFilter : undefined,
    status: statusFilter !== 'all' ? statusFilter : undefined,
    search: search.trim() || undefined,
  }), [roleFilter, statusFilter, search]);

  const {
    data: members,
    isLoading: isLoadingMembers,
    isError: isMembersError,
    error: membersError,
    refetch: refetchMembers,
  } = useSponsorTeamMembers(sponsorId, memberCriteria);

  const {
    data: invitations,
    isLoading: isLoadingInvitations,
    isError: isInvitationsError,
    error: invitationsError,
    refetch: refetchInvitations,
  } = useSponsorInvitations(sponsorId);

  const {
    data: auditEvents,
    isLoading: isLoadingAudit,
    isError: isAuditError,
    error: auditError,
    refetch: refetchAudit,
  } = useSponsorAuditEvents(sponsorId);

  // Mutations
  const inviteMutation = useInviteSponsorMember(sponsorId);
  const updateRoleMutation = useUpdateSponsorMemberRole(sponsorId);
  const removeMemberMutation = useRemoveSponsorMember(sponsorId);
  const resendInviteMutation = useResendSponsorInvitation(sponsorId);
  const revokeInviteMutation = useRevokeSponsorInvitation(sponsorId);

  const pendingInvitesCount = useMemo(() => {
    return (invitations ?? []).filter((i) => i.status === 'pending' && !isInvitationExpired(i)).length;
  }, [invitations]);

  const activeMembersCount = useMemo(() => {
    return (members ?? []).filter((m) => m.status === 'active').length;
  }, [members]);

  // Handler: Invite Member
  async function handleInviteSubmit(payload: InviteMemberPayload): Promise<boolean> {
    try {
      await inviteMutation.mutateAsync(payload);
      setNotification({
        type: 'success',
        message: `Invitation successfully dispatched to ${payload.email} for ${payload.role} role.`,
      });
      return true;
    } catch (err) {
      setNotification({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to send invitation.',
      });
      return false;
    }
  }

  // Handler: Update Role
  async function handleRoleUpdateSubmit(payload: UpdateMemberRolePayload): Promise<boolean> {
    if (!roleChangeMember) return false;
    try {
      await updateRoleMutation.mutateAsync({
        memberId: roleChangeMember.id,
        payload,
      });
      setNotification({
        type: 'success',
        message: `Role changed to ${payload.newRole} for ${roleChangeMember.name}. Audited in event log.`,
      });
      return true;
    } catch (err) {
      setNotification({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to change member role.',
      });
      return false;
    }
  }

  // Handler: Remove Member (Immediate Access Revocation)
  async function handleRemoveMemberConfirm(reason?: string): Promise<boolean> {
    if (!removeMemberTarget) return false;
    try {
      await removeMemberMutation.mutateAsync({
        memberId: removeMemberTarget.id,
        payload: { reason },
      });
      setNotification({
        type: 'success',
        message: `Removed ${removeMemberTarget.name}. Member lost all permissions immediately.`,
      });
      return true;
    } catch (err) {
      setNotification({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to remove team member.',
      });
      return false;
    }
  }

  // Handler: Resend Invitation
  async function handleResendInvite(invitation: SponsorInvitation) {
    try {
      await resendInviteMutation.mutateAsync(invitation.id);
      setNotification({
        type: 'success',
        message: `Invitation resent to ${invitation.email} with new expiration window.`,
      });
    } catch (err) {
      setNotification({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to resend invitation.',
      });
    }
  }

  // Handler: Revoke Invitation
  async function handleRevokeInvite(invitation: SponsorInvitation) {
    try {
      await revokeInviteMutation.mutateAsync(invitation.id);
      setNotification({
        type: 'success',
        message: `Invitation for ${invitation.email} has been revoked.`,
      });
    } catch (err) {
      setNotification({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to revoke invitation.',
      });
    }
  }

  const isLoading = isLoadingMembers || isLoadingInvitations;
  const isError = isMembersError || isInvitationsError;

  return (
    <div className={`space-y-8 ${className}`}>
      {/* Live Region for Screen-Reader Status Announcements */}
      <div role="status" aria-live="polite" className="sr-only">
        {notification?.message}
      </div>

      {/* Header Banner */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700">
              <Shield className="h-3.5 w-3.5" aria-hidden="true" />
              Sponsor Team
            </span>
            <span className="text-xs text-slate-400">&bull;</span>
            <span className="text-xs font-medium text-slate-500">Least-Privilege Isolation</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            {sponsorName} Team &amp; Permissions
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Invite and govern finance, program, reviewer, and reporting members with least-privilege security boundaries.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {isOwner ? (
            <button
              type="button"
              onClick={() => setIsInviteOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition"
            >
              <UserPlus className="h-4 w-4" aria-hidden="true" />
              <span>Invite Member</span>
            </button>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500" title="Only sponsor owners and platform administrators can invite members">
              <span>View-only permissions (Member management requires Owner role)</span>
            </div>
          )}
        </div>
      </div>

      {/* Notification Toast/Banner */}
      {notification && (
        <div
          role={notification.type === 'error' ? 'alert' : 'status'}
          className={`flex items-center justify-between rounded-xl border p-4 text-sm ${
            notification.type === 'error'
              ? 'border-rose-200 bg-rose-50 text-rose-800'
              : 'border-emerald-200 bg-emerald-50 text-emerald-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === 'error' ? (
              <AlertCircle className="h-5 w-5 shrink-0 text-rose-600" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden="true" />
            )}
            <span>{notification.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotification(null)}
            className="text-xs font-semibold underline hover:no-underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Least-Privilege Role Architecture Guide */}
      <section aria-labelledby="roles-overview-heading" className="space-y-3">
        <h2 id="roles-overview-heading" className="text-sm font-bold uppercase tracking-wider text-slate-500">
          Least-Privilege Role Architecture
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Finance */}
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/30 p-4">
            <div className="flex items-center gap-2 text-emerald-800">
              <Coins className="h-4 w-4 shrink-0" aria-hidden="true" />
              <h3 className="font-semibold text-sm">Finance Role</h3>
            </div>
            <p className="mt-1 text-xs text-slate-600 leading-relaxed">
              Custody of disbursements, refund execution, and financial ledgers.
            </p>
            <div className="mt-2 text-[11px] font-medium text-emerald-900 border-t border-emerald-100 pt-1">
              Restricted: Cannot review students or modify programs.
            </div>
          </div>

          {/* Program */}
          <div className="rounded-2xl border border-blue-100 bg-blue-50/30 p-4">
            <div className="flex items-center gap-2 text-blue-800">
              <Layers className="h-4 w-4 shrink-0" aria-hidden="true" />
              <h3 className="font-semibold text-sm">Program Role</h3>
            </div>
            <p className="mt-1 text-xs text-slate-600 leading-relaxed">
              Curates programs, cohorts, eligibility criteria, and deadlines.
            </p>
            <div className="mt-2 text-[11px] font-medium text-blue-900 border-t border-blue-100 pt-1">
              Restricted: Cannot execute disbursements or payouts.
            </div>
          </div>

          {/* Reviewer */}
          <div className="rounded-2xl border border-amber-100 bg-amber-50/30 p-4">
            <div className="flex items-center gap-2 text-amber-800">
              <FileCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
              <h3 className="font-semibold text-sm">Reviewer Role</h3>
            </div>
            <p className="mt-1 text-xs text-slate-600 leading-relaxed">
              Double-blind rubric scoring for assigned applications.
            </p>
            <div className="mt-2 text-[11px] font-medium text-amber-900 border-t border-amber-100 pt-1">
              Restricted: No PII, zero access to payout addresses.
            </div>
          </div>

          {/* Reporting */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center gap-2 text-slate-800">
              <BarChart3 className="h-4 w-4 shrink-0" aria-hidden="true" />
              <h3 className="font-semibold text-sm">Reporting Role</h3>
            </div>
            <p className="mt-1 text-xs text-slate-600 leading-relaxed">
              Read-only aggregate impact reports, funnel metrics, and SLIs.
            </p>
            <div className="mt-2 text-[11px] font-medium text-slate-700 border-t border-slate-200 pt-1">
              Restricted: Aggregate only; zero student PII or mutations.
            </div>
          </div>
        </div>
      </section>

      {/* Tabs Navigation */}
      <div className="border-b border-slate-200">
        <nav aria-label="Sponsor team sections" className="-mb-px flex space-x-6">
          <button
            type="button"
            onClick={() => setActiveTab('members')}
            aria-current={activeTab === 'members' ? 'page' : undefined}
            className={`flex items-center gap-2 border-b-2 py-3 px-1 text-sm font-semibold transition ${
              activeTab === 'members'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
            }`}
          >
            <Users className="h-4 w-4" aria-hidden="true" />
            <span>Active Members</span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
              {activeMembersCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('invitations')}
            aria-current={activeTab === 'invitations' ? 'page' : undefined}
            className={`flex items-center gap-2 border-b-2 py-3 px-1 text-sm font-semibold transition ${
              activeTab === 'invitations'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
            }`}
          >
            <Mail className="h-4 w-4" aria-hidden="true" />
            <span>Invitations</span>
            {pendingInvitesCount > 0 && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                {pendingInvitesCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('audit')}
            aria-current={activeTab === 'audit' ? 'page' : undefined}
            className={`flex items-center gap-2 border-b-2 py-3 px-1 text-sm font-semibold transition ${
              activeTab === 'audit'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
            }`}
          >
            <History className="h-4 w-4" aria-hidden="true" />
            <span>Audit Trail</span>
          </button>
        </nav>
      </div>

      {/* TAB 1: MEMBERS */}
      {activeTab === 'members' && (
        <section aria-label="Team Members" className="space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-sm">
              <label htmlFor="member-search-input" className="sr-only">Search team members</label>
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" aria-hidden="true" />
              <input
                id="member-search-input"
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or email..."
                className="w-full rounded-xl border border-slate-300 pl-9 pr-4 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              />
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="role-filter-select" className="text-xs font-medium text-slate-600">Role:</label>
              <select
                id="role-filter-select"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as SponsorTeamRole | 'all')}
                className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              >
                <option value="all">All Roles</option>
                <option value="owner">Owner</option>
                <option value="finance">Finance</option>
                <option value="program">Program</option>
                <option value="reviewer">Reviewer</option>
                <option value="reporting">Reporting</option>
              </select>

              <label htmlFor="status-filter-select" className="text-xs font-medium text-slate-600 ml-2">Status:</label>
              <select
                id="status-filter-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as SponsorMemberStatus | 'all')}
                className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
                <option value="removed">Removed</option>
              </select>

              <button
                type="button"
                onClick={() => refetchMembers()}
                aria-label="Refresh team members"
                className="rounded-xl border border-slate-300 bg-white p-2 text-slate-600 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Loading State */}
          {isLoadingMembers && (
            <div
              role="status"
              aria-busy="true"
              aria-label="Loading team members"
              className="space-y-3"
            >
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-2xl border border-slate-200 bg-slate-100" />
              ))}
              <span className="sr-only">Loading team members...</span>
            </div>
          )}

          {/* Error State */}
          {isMembersError && (
            <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center">
              <AlertCircle className="mx-auto h-8 w-8 text-rose-500" aria-hidden="true" />
              <h3 className="mt-2 text-sm font-semibold text-rose-900">Failed to load team members</h3>
              <p className="mt-1 text-xs text-rose-700">
                {membersError instanceof Error ? membersError.message : 'Please check your connection.'}
              </p>
              <button
                type="button"
                onClick={() => refetchMembers()}
                className="mt-4 rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-rose-700"
              >
                Try again
              </button>
            </div>
          )}

          {/* Empty State */}
          {!isLoadingMembers && !isMembersError && (members ?? []).length === 0 && (
            <div
              role="status"
              className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 p-12 text-center"
            >
              <Users className="mx-auto h-10 w-10 text-slate-400" aria-hidden="true" />
              <h3 className="mt-3 text-base font-semibold text-slate-900">No team members found</h3>
              <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
                {search || roleFilter !== 'all' || statusFilter !== 'all'
                  ? 'No members match your current filter parameters. Try clearing the filters.'
                  : 'Start building your sponsor organization team by inviting colleagues.'}
              </p>
              {isOwner && (
                <button
                  type="button"
                  onClick={() => setIsInviteOpen(true)}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  <span>Invite First Member</span>
                </button>
              )}
            </div>
          )}

          {/* Members Table */}
          {!isLoadingMembers && !isMembersError && (members ?? []).length > 0 && (
            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-xs">
              <table className="w-full text-left text-sm" role="table">
                <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                  <tr>
                    <th scope="col" className="px-6 py-3.5">Member</th>
                    <th scope="col" className="px-6 py-3.5">Assigned Role</th>
                    <th scope="col" className="px-6 py-3.5">Status</th>
                    <th scope="col" className="px-6 py-3.5">Joined</th>
                    <th scope="col" className="px-6 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(members ?? []).map((member) => {
                    const isRemoved = member.status === 'removed';
                    const isSuspended = member.status === 'suspended';

                    return (
                      <tr
                        key={member.id}
                        className={`transition hover:bg-slate-50/60 ${
                          isRemoved ? 'bg-slate-50/40 opacity-70' : ''
                        }`}
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-700 font-semibold text-xs shrink-0">
                              {member.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-semibold text-slate-900">{member.name}</div>
                              <div className="text-xs text-slate-500">{member.email}</div>
                            </div>
                          </div>
                        </td>

                        <td className="px-6 py-4">
                          <RoleBadge role={member.role} />
                        </td>

                        <td className="px-6 py-4">
                          {member.status === 'active' && (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                              Active
                            </span>
                          )}
                          {member.status === 'suspended' && (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700">
                              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                              Suspended
                            </span>
                          )}
                          {member.status === 'removed' && (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-rose-700">
                              <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                              Removed (Access Denied)
                            </span>
                          )}
                        </td>

                        <td className="px-6 py-4 text-xs text-slate-500">
                          {new Date(member.joinedAt).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </td>

                        <td className="px-6 py-4 text-right">
                          {isOwner && !isRemoved ? (
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setRoleChangeMember(member)}
                                className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              >
                                Change Role
                              </button>
                              <button
                                type="button"
                                onClick={() => setRemoveMemberTarget(member)}
                                className="rounded-lg border border-rose-200 px-2.5 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50 focus:outline-none focus:ring-2 focus:ring-rose-500"
                              >
                                Remove
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400 italic">
                              {isRemoved ? 'No access' : 'Locked'}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* TAB 2: INVITATIONS */}
      {activeTab === 'invitations' && (
        <section aria-label="Team Invitations" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">
              Invitations are single-use and automatically expire after the configured duration.
            </p>
            {isOwner && (
              <button
                type="button"
                onClick={() => setIsInviteOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                <span>New Invitation</span>
              </button>
            )}
          </div>

          {isLoadingInvitations && (
            <div role="status" aria-busy="true" className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-2xl border border-slate-200 bg-slate-100" />
              ))}
            </div>
          )}

          {!isLoadingInvitations && (invitations ?? []).length === 0 && (
            <div role="status" className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 p-10 text-center">
              <Mail className="mx-auto h-9 w-9 text-slate-400" aria-hidden="true" />
              <h3 className="mt-2 text-sm font-semibold text-slate-900">No invitations found</h3>
              <p className="mt-1 text-xs text-slate-500">There are no pending or historic invitations for this sponsor.</p>
            </div>
          )}

          {!isLoadingInvitations && (invitations ?? []).length > 0 && (
            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-xs">
              <table className="w-full text-left text-sm" role="table">
                <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                  <tr>
                    <th scope="col" className="px-6 py-3.5">Invitee Email</th>
                    <th scope="col" className="px-6 py-3.5">Role</th>
                    <th scope="col" className="px-6 py-3.5">Status / Expiry</th>
                    <th scope="col" className="px-6 py-3.5">Invited By</th>
                    <th scope="col" className="px-6 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(invitations ?? []).map((invitation) => {
                    const expired = isInvitationExpired(invitation);
                    const isPending = invitation.status === 'pending' && !expired;
                    const isAccepted = invitation.status === 'accepted';
                    const isRevoked = invitation.status === 'revoked';

                    return (
                      <tr key={invitation.id} className="hover:bg-slate-50/60 transition">
                        <td className="px-6 py-4">
                          <div className="font-semibold text-slate-900">{invitation.email}</div>
                          {invitation.note && (
                            <div className="text-xs text-slate-500 italic">&ldquo;{invitation.note}&rdquo;</div>
                          )}
                        </td>

                        <td className="px-6 py-4">
                          <RoleBadge role={invitation.role} />
                        </td>

                        <td className="px-6 py-4">
                          {isPending && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 border border-amber-200">
                              <Clock className="h-3 w-3" aria-hidden="true" />
                              <span>Pending (Expires {new Date(invitation.expiresAt).toLocaleDateString()})</span>
                            </span>
                          )}
                          {expired && !isAccepted && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-medium text-rose-700 border border-rose-200">
                              <XCircle className="h-3 w-3" aria-hidden="true" />
                              <span>Expired</span>
                            </span>
                          )}
                          {isAccepted && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                              <span>Accepted &amp; Single-Used</span>
                            </span>
                          )}
                          {isRevoked && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 border border-slate-200">
                              <span>Revoked</span>
                            </span>
                          )}
                        </td>

                        <td className="px-6 py-4 text-xs text-slate-500">
                          {invitation.invitedByName}
                        </td>

                        <td className="px-6 py-4 text-right">
                          {isOwner && (
                            <div className="flex items-center justify-end gap-2">
                              {isPending && (
                                <button
                                  type="button"
                                  onClick={() => handleRevokeInvite(invitation)}
                                  className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                                >
                                  Revoke
                                </button>
                              )}
                              {(expired || isPending) && (
                                <button
                                  type="button"
                                  onClick={() => handleResendInvite(invitation)}
                                  className="rounded-lg border border-indigo-200 px-2 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-50"
                                >
                                  Resend
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* TAB 3: AUDIT TRAIL */}
      {activeTab === 'audit' && (
        <section aria-label="Team Audit Trail" className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 text-xs text-slate-600">
            <p>
              <strong>Immutable Audit Log:</strong> Every team invitation, single-use acceptance, role change, and member removal is cryptographically sequenced and audited with actor details and timestamps.
            </p>
          </div>

          {isLoadingAudit && (
            <div role="status" aria-busy="true" className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-2xl border border-slate-200 bg-slate-100" />
              ))}
            </div>
          )}

          {!isLoadingAudit && (auditEvents ?? []).length === 0 && (
            <div role="status" className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 p-10 text-center">
              <History className="mx-auto h-9 w-9 text-slate-400" aria-hidden="true" />
              <h3 className="mt-2 text-sm font-semibold text-slate-900">No audit events recorded</h3>
            </div>
          )}

          {!isLoadingAudit && (auditEvents ?? []).length > 0 && (
            <div className="space-y-3">
              {(auditEvents ?? []).map((event) => {
                let actionBadge = 'bg-slate-100 text-slate-800';
                if (event.action === 'team.invitation_created') actionBadge = 'bg-blue-50 text-blue-800 border-blue-200';
                if (event.action === 'team.invitation_accepted') actionBadge = 'bg-emerald-50 text-emerald-800 border-emerald-200';
                if (event.action === 'team.member_role_updated') actionBadge = 'bg-purple-50 text-purple-800 border-purple-200';
                if (event.action === 'team.member_removed') actionBadge = 'bg-rose-50 text-rose-800 border-rose-200';
                if (event.action === 'team.invitation_revoked') actionBadge = 'bg-amber-50 text-amber-800 border-amber-200';

                return (
                  <div
                    key={event.id}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-slate-200 bg-white p-4 text-xs shadow-2xs gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`inline-block rounded-md border px-2 py-0.5 font-semibold ${actionBadge}`}>
                          {event.action}
                        </span>
                        <span className="text-slate-400">&bull;</span>
                        <span className="text-slate-500 font-medium">Actor: {event.actorEmail}</span>
                      </div>
                      <div className="text-slate-700">
                        Target: <strong>{event.targetEmail}</strong>
                        {event.previousRole && event.newRole && (
                          <span className="ml-2 font-medium text-purple-700">
                            (Role transition: {event.previousRole} &rarr; {event.newRole})
                          </span>
                        )}
                        {!event.previousRole && event.newRole && (
                          <span className="ml-2 font-medium text-indigo-700">
                            (Role: {event.newRole})
                          </span>
                        )}
                      </div>
                      {event.reason && (
                        <p className="text-slate-500 italic">&ldquo;{event.reason}&rdquo;</p>
                      )}
                    </div>

                    <div className="text-slate-400 shrink-0 sm:text-right">
                      {new Date(event.occurredAt).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Modals */}
      <InviteMemberModal
        isOpen={isInviteOpen}
        onClose={() => setIsInviteOpen(false)}
        onSubmit={handleInviteSubmit}
        isSubmitting={inviteMutation.isPending}
      />

      <ChangeRoleModal
        isOpen={Boolean(roleChangeMember)}
        member={roleChangeMember}
        onClose={() => setRoleChangeMember(null)}
        onSubmit={handleRoleUpdateSubmit}
        isSubmitting={updateRoleMutation.isPending}
      />

      <RemoveMemberModal
        isOpen={Boolean(removeMemberTarget)}
        member={removeMemberTarget}
        onClose={() => setRemoveMemberTarget(null)}
        onConfirm={handleRemoveMemberConfirm}
        isRemoving={removeMemberMutation.isPending}
      />
    </div>
  );
}
