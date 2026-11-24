'use client';

import React, { useId, useState } from 'react';
import Link from 'next/link';
import {
  computeDashboardMetrics,
  DASHBOARD_SECTIONS,
  filterDashboardByRole,
  respondToInvitation,
  type DeadlineItem,
  type InvitationItem,
  type ParticipantDashboardState,
  type SectionStatus,
} from '../participant-dashboard';
import {
  CapstoneEmptyState,
  CapstoneErrorState,
  CapstoneLoadingState,
  CapstoneSuccessState,
} from './CapstoneSharedStates';

export interface ParticipantDashboardViewProps {
  initialDashboard: ParticipantDashboardState;
  onInvitationResponded?: (invitation: InvitationItem) => void;
  onRetrySection?: (sectionKey: string) => void;
}

export function ParticipantDashboardView({
  initialDashboard,
  onInvitationResponded,
  onRetrySection,
}: ParticipantDashboardViewProps) {
  const headingId = useId();
  const [dashboard, setDashboard] = useState<ParticipantDashboardState>(() =>
    filterDashboardByRole(initialDashboard, initialDashboard.role)
  );

  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const metrics = computeDashboardMetrics(dashboard);

  const handleInvitationAction = (
    invitation: InvitationItem,
    decision: 'accept' | 'decline'
  ) => {
    setRespondingId(invitation.id);
    setActionError(null);
    setSuccessNotice(null);

    const now = new Date().toISOString();
    const requestId = `req_inv_${invitation.id}_${decision}_${Date.now()}`;

    const result = respondToInvitation(dashboard.sections.invitations.items, {
      requestId,
      invitationId: invitation.id,
      decision,
      expectedRevision: invitation.revision,
      actorId: dashboard.participantId,
      actorOrganizationId: dashboard.organizationId,
      now,
    });

    if (result.ok) {
      setDashboard((prev) => ({
        ...prev,
        sections: {
          ...prev.sections,
          invitations: {
            ...prev.sections.invitations,
            items: prev.sections.invitations.items.map((i) =>
              i.id === result.value.id ? result.value : i
            ),
          },
        },
      }));
      setSuccessNotice(
        `Invitation to '${invitation.projectTitle}' was ${
          decision === 'accept' ? 'accepted' : 'declined'
        }.`
      );
      onInvitationResponded?.(result.value);
    } else {
      setActionError(result.message);
    }

    setRespondingId(null);
  };

  return (
    <div className="space-y-8" aria-labelledby={headingId}>
      {/* Header and operational metrics */}
      <header className="border-b border-gray-200 pb-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 id={headingId} className="text-2xl font-bold tracking-tight text-gray-900">
              Participant Project Dashboard
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              Centralized view of your research commitments, deadlines, active projects, and invitations.
            </p>
          </div>
          <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 capitalize">
            Role: {dashboard.role}
          </span>
        </div>

        {/* Operational metric cards */}
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <span className="text-xs font-medium text-gray-500">Active Projects</span>
            <p className="mt-1 text-2xl font-bold text-gray-900">{metrics.activeProjectsCount}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <span className="text-xs font-medium text-gray-500">Overdue Items</span>
            <p
              className={`mt-1 text-2xl font-bold ${
                metrics.overdueDeadlinesCount > 0 ? 'text-red-600' : 'text-gray-900'
              }`}
            >
              {metrics.overdueDeadlinesCount}
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <span className="text-xs font-medium text-gray-500">Pending Invitations</span>
            <p className="mt-1 text-2xl font-bold text-gray-900">{metrics.pendingInvitationsCount}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <span className="text-xs font-medium text-gray-500">Reviews Assigned</span>
            <p className="mt-1 text-2xl font-bold text-gray-900">{metrics.pendingReviewsCount}</p>
          </div>
        </div>
      </header>

      {successNotice && <CapstoneSuccessState>{successNotice}</CapstoneSuccessState>}
      {actionError && <CapstoneErrorState message={actionError} onRetry={() => setActionError(null)} />}

      {/* Main dashboard grid */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Left Column (2 spans): Projects, Deadlines, Milestones */}
        <div className="space-y-8 lg:col-span-2">
          {/* Section: Active Projects */}
          <section aria-labelledby="section-projects-title" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 id="section-projects-title" className="text-lg font-bold text-gray-900">
                Active Projects & Work
              </h2>
            </div>

            {dashboard.sections.projects.status === 'error' && (
              <CapstoneErrorState
                message={dashboard.sections.projects.error ?? 'Failed to load projects.'}
                onRetry={() => onRetrySection?.('projects')}
              />
            )}

            {dashboard.sections.projects.status === 'ready' &&
              dashboard.sections.projects.items.length === 0 && (
                <CapstoneEmptyState
                  title="No active projects"
                  description="You are not currently enrolled in any research projects."
                />
              )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {dashboard.sections.projects.items.map((prj) => (
                <article
                  key={prj.id}
                  className="flex flex-col justify-between rounded-lg border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-gray-900">{prj.title}</h3>
                      <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 capitalize">
                        {prj.state}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 line-clamp-2">{prj.summary}</p>
                    <div className="text-xs text-gray-500">Role: <span className="font-medium text-gray-700">{prj.role}</span></div>

                    {/* Progress bar */}
                    <div className="space-y-1 pt-2">
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>Milestone Progress</span>
                        <span>{prj.progressPercent}%</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className="h-full bg-blue-600 rounded-full"
                          style={{ width: `${prj.progressPercent}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Contextual links into project tools */}
                  <div className="mt-4 flex flex-wrap gap-2 pt-3 border-t border-gray-100 text-xs font-medium">
                    <Link
                      href={`/projects/${prj.id}/workspace`}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      Workspace
                    </Link>
                    <span className="text-gray-300">•</span>
                    <Link
                      href={`/projects/${prj.id}/consent`}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      Consent
                    </Link>
                    {prj.canManagePrivacy && (
                      <>
                        <span className="text-gray-300">•</span>
                        <Link
                          href={`/projects/${prj.id}/privacy`}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          Privacy
                        </Link>
                      </>
                    )}
                    {prj.canManageSecrets && (
                      <>
                        <span className="text-gray-300">•</span>
                        <Link
                          href={`/projects/${prj.id}/secrets`}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          Secrets
                        </Link>
                      </>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>

          {/* Section: Deadlines */}
          <section aria-labelledby="section-deadlines-title" className="space-y-4">
            <h2 id="section-deadlines-title" className="text-lg font-bold text-gray-900">
              Upcoming Deadlines & Milestones
            </h2>

            {dashboard.sections.deadlines.status === 'error' && (
              <CapstoneErrorState
                message={dashboard.sections.deadlines.error ?? 'Failed to load deadlines.'}
                onRetry={() => onRetrySection?.('deadlines')}
              />
            )}

            {dashboard.sections.deadlines.status === 'ready' &&
              dashboard.sections.deadlines.items.length === 0 && (
                <CapstoneEmptyState
                  title="No deadlines pending"
                  description="All milestone deliverables and reviews are currently up to date."
                />
              )}

            <div className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white shadow-sm">
              {dashboard.sections.deadlines.items.map((dl) => (
                <div key={dl.id} className="flex items-center justify-between p-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-900">{dl.title}</span>
                      {dl.isOverdue ? (
                        <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">
                          Overdue
                        </span>
                      ) : (
                        <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 uppercase">
                          {dl.kind}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">{dl.projectTitle}</p>
                  </div>
                  <span className="text-xs font-medium text-gray-600">
                    Due: {new Date(dl.dueAt).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* Section: Milestones */}
          <section aria-labelledby="section-milestones-title" className="space-y-4">
            <h2 id="section-milestones-title" className="text-lg font-bold text-gray-900">
              Assigned Milestones
            </h2>
            <div className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white shadow-sm">
              {dashboard.sections.milestones.items.map((m) => (
                <div key={m.id} className="flex items-center justify-between p-4">
                  <div>
                    <h4 className="text-sm font-medium text-gray-900">{m.title}</h4>
                    <p className="text-xs text-gray-500">{m.projectTitle}</p>
                  </div>
                  <div className="text-right">
                    <span className="rounded bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700 capitalize">
                      {m.status}
                    </span>
                    <p className="text-xs text-gray-400 mt-1">{m.completionPercent}% Complete</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Right Column (1 span): Invitations, Reviews, Funding, Alerts */}
        <div className="space-y-8">
          {/* Section: Invitations */}
          <section aria-labelledby="section-invites-title" className="space-y-4">
            <h2 id="section-invites-title" className="text-lg font-bold text-gray-900">
              Invitations
            </h2>

            {dashboard.sections.invitations.status === 'error' && (
              <CapstoneErrorState
                message={dashboard.sections.invitations.error ?? 'Failed to load invitations.'}
                onRetry={() => onRetrySection?.('invitations')}
              />
            )}

            {dashboard.sections.invitations.status === 'ready' &&
              dashboard.sections.invitations.items.filter((i) => i.status === 'pending').length === 0 && (
                <div className="rounded-lg border border-dashed border-gray-200 p-4 text-center text-xs text-gray-500">
                  No pending invitations
                </div>
              )}

            <div className="space-y-3">
              {dashboard.sections.invitations.items
                .filter((i) => i.status === 'pending')
                .map((inv) => (
                  <div
                    key={inv.id}
                    className="rounded-lg border border-blue-200 bg-blue-50/40 p-4 space-y-3 shadow-sm"
                  >
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900">{inv.projectTitle}</h4>
                      <p className="text-xs text-gray-600">
                        From <span className="font-medium">{inv.inviterName}</span> • Role: {inv.roleOffered}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={respondingId === inv.id}
                        onClick={() => handleInvitationAction(inv, 'accept')}
                        className="flex-1 rounded bg-blue-600 px-3 py-1 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
                      >
                        Accept
                      </button>
                      <button
                        type="button"
                        disabled={respondingId === inv.id}
                        onClick={() => handleInvitationAction(inv, 'decline')}
                        className="flex-1 rounded border border-gray-300 bg-white px-3 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </section>

          {/* Section: Reviews */}
          <section aria-labelledby="section-reviews-title" className="space-y-4">
            <h2 id="section-reviews-title" className="text-lg font-bold text-gray-900">
              Reviews & Feedback
            </h2>
            <div className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white shadow-sm">
              {dashboard.sections.reviews.items.map((rev) => (
                <div key={rev.id} className="p-3">
                  <div className="flex justify-between items-start">
                    <h4 className="text-xs font-semibold text-gray-900">{rev.itemTitle}</h4>
                    <span className="rounded bg-amber-50 px-2 py-0.5 text-xs text-amber-700 font-medium capitalize">
                      {rev.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{rev.projectTitle}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Section: Funding Actions */}
          <section aria-labelledby="section-funding-title" className="space-y-4">
            <h2 id="section-funding-title" className="text-lg font-bold text-gray-900">
              Funding & Expenses
            </h2>
            <div className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white shadow-sm">
              {dashboard.sections.funding.items.map((fnd) => (
                <div key={fnd.id} className="p-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-semibold text-gray-900">{fnd.projectTitle}</span>
                    <span className="text-xs font-bold text-green-700">
                      ${Number(fnd.awardAmount).toLocaleString()} {fnd.currency}
                    </span>
                  </div>
                  <div className="flex justify-between items-center mt-2 text-xs text-gray-500">
                    <span>Status: <span className="capitalize">{fnd.state}</span></span>
                    {fnd.canClaimReimbursement && (
                      <span className="text-blue-600 hover:underline cursor-pointer">
                        Claim Reimbursement
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Section: Recent Activity Timeline */}
          <section aria-labelledby="section-activity-title" className="space-y-4">
            <h2 id="section-activity-title" className="text-lg font-bold text-gray-900">
              Recent Activity
            </h2>
            <div className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white shadow-sm">
              {dashboard.sections.activity.items.map((act) => (
                <div key={act.id} className="p-3 text-xs">
                  <p className="font-medium text-gray-800">{act.actionSummary}</p>
                  <p className="text-gray-400 mt-0.5">
                    {act.actorName} • {new Date(act.occurredAt).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
