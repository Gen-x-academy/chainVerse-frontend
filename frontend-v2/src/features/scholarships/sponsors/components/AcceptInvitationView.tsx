'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  ExternalLink,
  GraduationCap,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import {
  useAcceptSponsorInvitation,
  useValidateInvitationToken,
} from '../hooks';
import { RoleBadge } from './RoleBadge';
import { SPONSOR_ROLE_DEFINITIONS } from '../types';

export interface AcceptInvitationViewProps {
  token: string;
  currentUser?: {
    id: string;
    email: string;
    name: string;
  };
  onAccepted?: (sponsorId: string) => void;
}

export function AcceptInvitationView({
  token,
  currentUser = {
    id: 'user-accepted-current',
    email: 'jordan.lee@finpartners.com',
    name: 'Jordan Lee',
  },
  onAccepted,
}: AcceptInvitationViewProps) {
  const { data: validation, isLoading, isError, error, refetch } = useValidateInvitationToken(token);
  const acceptMutation = useAcceptSponsorInvitation();

  const [acceptedSuccess, setAcceptedSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div
        role="status"
        aria-busy="true"
        aria-label="Validating your sponsor invitation"
        className="flex min-h-[50vh] flex-col items-center justify-center p-6 text-center"
      >
        <div className="h-10 w-10 animate-spin rounded-full border-3 border-indigo-600 border-t-transparent" />
        <h2 className="mt-4 text-base font-semibold text-slate-800">Validating invitation token...</h2>
        <p className="mt-1 text-xs text-slate-500">Checking expiration and single-use acceptance state</p>
      </div>
    );
  }

  if (isError || !validation) {
    return (
      <div className="mx-auto max-w-md p-6" role="alert">
        <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-6 text-center">
          <AlertCircle className="mx-auto h-10 w-10 text-rose-500" aria-hidden="true" />
          <h2 className="mt-3 text-lg font-bold text-rose-900">Invitation Verification Failed</h2>
          <p className="mt-1 text-xs text-rose-700">
            {error instanceof Error ? error.message : 'Unable to verify invitation details.'}
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-rose-700"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  // Handle invalid/expired/consumed states
  if (!validation.valid) {
    const reason = validation.reason;
    let title = 'Invalid Invitation';
    let message = 'This invitation token could not be verified.';

    if (reason === 'EXPIRED') {
      title = 'Invitation Has Expired';
      message =
        'This invitation is past its expiration deadline. Sponsor invitations expire for security. Please reach out to the sponsor organization owner to request a new invitation link.';
    } else if (reason === 'ALREADY_CONSUMED') {
      title = 'Invitation Already Used';
      message =
        'This invitation has already been accepted. Sponsor team invitation tokens are strictly single-use to prevent replay abuse.';
    } else if (reason === 'REVOKED') {
      title = 'Invitation Revoked';
      message = 'This invitation was revoked by the sponsor organization owner prior to acceptance.';
    }

    return (
      <div className="mx-auto max-w-lg p-6" role="alert">
        <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-6 text-center shadow-xs">
          <AlertTriangle className="mx-auto h-12 w-12 text-amber-600" aria-hidden="true" />
          <h2 className="mt-3 text-lg font-bold text-slate-900">{title}</h2>
          <p className="mt-2 text-xs text-slate-600 leading-relaxed">{message}</p>
          <div className="mt-6 flex justify-center gap-3">
            <Link
              href="/scholarships"
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Back to Scholarships
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const invitation = validation.invitation;
  if (!invitation) return null;

  const roleDef = SPONSOR_ROLE_DEFINITIONS[invitation.role];

  async function handleAccept() {
    setErrorMessage(null);
    try {
      await acceptMutation.mutateAsync({
        token,
        userId: currentUser.id,
        email: invitation.email,
        name: currentUser.name,
      });
      setAcceptedSuccess(true);
      if (onAccepted) {
        onAccepted(invitation.sponsorId);
      }
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Failed to accept invitation. Please try again.'
      );
    }
  }

  if (acceptedSuccess) {
    return (
      <div className="mx-auto max-w-md p-6" role="status">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-8 text-center shadow-sm">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" aria-hidden="true" />
          <h2 className="mt-3 text-xl font-bold text-slate-900">Welcome to the Team!</h2>
          <p className="mt-2 text-xs text-slate-600 leading-relaxed">
            You have successfully accepted the invitation from <strong>{invitation.sponsorName}</strong>.
            Your role has been provisioned with least-privilege access.
          </p>
          <div className="mt-4 flex justify-center">
            <RoleBadge role={invitation.role} />
          </div>
          <div className="mt-6">
            <Link
              href={`/scholarships/sponsors/${encodeURIComponent(invitation.sponsorId)}/team`}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 transition"
            >
              <span>Go to Sponsor Team Workspace</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl p-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <header className="text-center pb-6 border-b border-slate-100">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
            <GraduationCap className="h-6 w-6" aria-hidden="true" />
          </div>
          <h1 className="mt-3 text-xl font-bold text-slate-900">
            Sponsor Team Invitation
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            You have been invited by <strong>{invitation.invitedByName}</strong> to join{' '}
            <strong>{invitation.sponsorName}</strong>.
          </p>
        </header>

        <div className="mt-6 space-y-4">
          <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-4 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">Invited Email:</span>
              <span className="text-slate-800 font-semibold">{invitation.email}</span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">Assigned Role:</span>
              <RoleBadge role={invitation.role} />
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                <span>Expires At:</span>
              </span>
              <span className="text-slate-700">
                {new Date(invitation.expiresAt).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>

            {invitation.note && (
              <div className="border-t border-slate-200/60 pt-2 text-xs">
                <span className="text-slate-500 block mb-0.5">Invitation Note:</span>
                <p className="text-slate-700 italic">&ldquo;{invitation.note}&rdquo;</p>
              </div>
            )}
          </div>

          {/* Least privilege disclosure */}
          <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-4 text-xs">
            <div className="flex items-center gap-1.5 font-semibold text-indigo-950">
              <ShieldCheck className="h-4 w-4 text-indigo-600" aria-hidden="true" />
              <span>Least-Privilege Role Scope</span>
            </div>
            <p className="mt-1 text-slate-600 leading-relaxed">
              {roleDef.description}
            </p>
            <div className="mt-2 text-[11px] text-indigo-800 font-medium">
              Permitted boundaries: {roleDef.leastPrivilegeScope}
            </div>
          </div>

          {errorMessage && (
            <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" aria-hidden="true" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="pt-4 border-t border-slate-100 flex flex-col gap-2">
            <button
              type="button"
              onClick={handleAccept}
              disabled={acceptMutation.isPending}
              aria-busy={acceptMutation.isPending}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 transition"
            >
              {acceptMutation.isPending ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" aria-hidden="true" />
                  <span>Joining Team...</span>
                </>
              ) : (
                <>
                  <UserCheck className="h-4 w-4" aria-hidden="true" />
                  <span>Accept Invitation &amp; Join Team</span>
                </>
              )}
            </button>
            <p className="text-center text-[11px] text-slate-400">
              Single-use token. Once accepted, this token will be consumed and cannot be reused.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
