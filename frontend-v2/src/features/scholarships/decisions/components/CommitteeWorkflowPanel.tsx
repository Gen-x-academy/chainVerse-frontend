'use client';

import { useState } from 'react';
import {
  canVote,
  canRecuse,
  hasQuorum,
  computeFinalDecision,
  validateVote,
  activeVoters,
} from '../domain';
import { committeeDecisionService } from '../service';
import type { CommitteeDecision, DecisionType } from '../types';

const DECISION_LABELS: Record<DecisionType, string> = {
  shortlist: 'Shortlist',
  waitlist: 'Waitlist',
  award: 'Award',
  reject: 'Reject',
  recusal: 'Recusal',
};

const DECISION_COLORS: Record<DecisionType, string> = {
  award: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  shortlist: 'bg-indigo-50 border-indigo-200 text-indigo-800',
  waitlist: 'bg-amber-50 border-amber-200 text-amber-800',
  reject: 'bg-red-50 border-red-200 text-red-800',
  recusal: 'bg-slate-50 border-slate-200 text-slate-700',
};

interface Props {
  decision: CommitteeDecision;
  currentUserId: string;
  onDecisionUpdated?: (updated: CommitteeDecision) => void;
}

export function CommitteeWorkflowPanel({ decision, currentUserId, onDecisionUpdated }: Props) {
  const [localDecision, setLocalDecision] = useState<CommitteeDecision>(decision);
  const [selectedVote, setSelectedVote] = useState<DecisionType | ''>('');
  const [rationale, setRationale] = useState('');
  const [recusalReason, setRecusalReason] = useState('');
  const [voteStatus, setVoteStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>(
    'idle'
  );
  const [recusalStatus, setRecusalStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>(
    'idle'
  );
  const [finaliseStatus, setFinaliseStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [errors, setErrors] = useState<{ field: string; message: string }[]>([]);

  const votePermission = canVote(localDecision, currentUserId);
  const recusalPermission = canRecuse(localDecision, currentUserId);
  const quorumReached = hasQuorum(localDecision, localDecision.quorumPolicy);
  const projected =
    selectedVote
      ? computeFinalDecision(
          [
            ...localDecision.votes,
            {
              memberId: currentUserId,
              decision: selectedVote as DecisionType,
              rationale,
              evidenceVersion: localDecision.aggregateVersion,
              votedAt: '',
            },
          ],
          localDecision.committee
        )
      : null;

  async function handleVote() {
    if (!selectedVote) {
      setErrors([{ field: 'decision', message: 'Select a decision before submitting.' }]);
      return;
    }
    const validationErrors = validateVote(
      { rationale, evidenceVersion: localDecision.aggregateVersion },
      localDecision
    );
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }
    setErrors([]);
    setVoteStatus('submitting');
    try {
      const updated = await committeeDecisionService.castVote({
        committeeDecisionId: localDecision.id,
        memberId: currentUserId,
        decision: selectedVote as DecisionType,
        rationale,
        evidenceVersion: localDecision.aggregateVersion,
      });
      setLocalDecision(updated);
      setVoteStatus('success');
      onDecisionUpdated?.(updated);
    } catch {
      setVoteStatus('error');
    }
  }

  async function handleRecuse() {
    if (!recusalReason.trim()) {
      setErrors([{ field: 'recusalReason', message: 'A reason for recusal is required.' }]);
      return;
    }
    setErrors([]);
    setRecusalStatus('submitting');
    try {
      const updated = await committeeDecisionService.recuse({
        committeeDecisionId: localDecision.id,
        memberId: currentUserId,
        reason: recusalReason,
      });
      setLocalDecision(updated);
      setRecusalStatus('success');
      onDecisionUpdated?.(updated);
    } catch {
      setRecusalStatus('error');
    }
  }

  async function handleFinalise() {
    setFinaliseStatus('submitting');
    try {
      const updated = await committeeDecisionService.finalise(localDecision.id);
      setLocalDecision(updated);
      setFinaliseStatus('success');
      onDecisionUpdated?.(updated);
    } catch {
      setFinaliseStatus('error');
    }
  }

  const isDecided = localDecision.status === 'decided';
  const isVoided = localDecision.status === 'voided';

  return (
    <section
      aria-labelledby="committee-panel-title"
      className="mx-auto w-full max-w-4xl space-y-6 px-4 py-8 text-slate-900"
    >
      <header className="space-y-1">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-600">
          Committee workflow
        </p>
        <h2 id="committee-panel-title" className="text-3xl font-bold tracking-tight">
          Decision committee
        </h2>
        <p className="text-sm text-slate-500">
          Evidence version:{' '}
          <span className="font-mono">{localDecision.aggregateVersion}</span> · Status:{' '}
          <strong>{localDecision.status}</strong>
        </p>
      </header>

      {isDecided && localDecision.finalDecision && (
        <div
          role="status"
          className={`rounded-2xl border px-5 py-4 text-base font-semibold ${DECISION_COLORS[localDecision.finalDecision]}`}
        >
          Final decision: {DECISION_LABELS[localDecision.finalDecision]}
          {localDecision.decidedAt && (
            <span className="ml-2 text-sm font-normal">
              · {new Date(localDecision.decidedAt).toLocaleString()}
            </span>
          )}
        </div>
      )}

      {isVoided && (
        <div
          role="alert"
          className="rounded-2xl border border-slate-200 bg-slate-100 px-5 py-4 text-sm text-slate-700"
        >
          This decision has been voided.
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
        <h3 className="font-semibold text-slate-800">Committee members</h3>
        <ul className="space-y-2" role="list">
          {localDecision.committee.map((member) => {
            const hasVoted = localDecision.votes.some((v) => v.memberId === member.userId);
            const hasRecused = localDecision.recusals.some((r) => r.memberId === member.userId);
            const vote = localDecision.votes.find((v) => v.memberId === member.userId);
            return (
              <li
                key={member.userId}
                className="flex flex-wrap items-center justify-between gap-2 text-sm"
              >
                <span className="font-medium">
                  {member.name}{' '}
                  <span className="text-xs text-slate-500 capitalize">({member.role})</span>
                </span>
                <span
                  className={`rounded-full px-3 py-0.5 text-xs font-medium border
                    ${hasRecused ? 'bg-slate-50 border-slate-200 text-slate-500' : hasVoted && vote ? DECISION_COLORS[vote.decision] : 'bg-white border-slate-200 text-slate-500'}`}
                  aria-label={
                    hasRecused
                      ? `${member.name} recused`
                      : hasVoted && vote
                      ? `${member.name} voted ${DECISION_LABELS[vote.decision]}`
                      : `${member.name} pending`
                  }
                >
                  {hasRecused ? 'Recused' : hasVoted && vote ? DECISION_LABELS[vote.decision] : 'Pending'}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-2">
        <p className="text-sm text-slate-600">
          Active voters: <strong>{activeVoters(localDecision).length}</strong> · Votes cast:{' '}
          <strong>{localDecision.votes.length}</strong> · Quorum:{' '}
          <strong>{localDecision.quorumPolicy.minVotes}</strong>
        </p>
        {quorumReached ? (
          <p role="status" className="text-sm font-medium text-emerald-700">
            Quorum reached.
          </p>
        ) : (
          <p role="status" className="text-sm text-amber-700">
            Quorum not yet reached.
          </p>
        )}
      </div>

      {!isDecided && !isVoided && votePermission.allowed && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <h3 className="font-semibold text-slate-800">Cast your vote</h3>

          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">Decision</p>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Decision type">
              {(Object.keys(DECISION_LABELS) as DecisionType[])
                .filter((d) => d !== 'recusal')
                .map((d) => (
                  <label
                    key={d}
                    className={`flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-2 text-sm transition
                      ${selectedVote === d ? 'border-indigo-500 bg-indigo-50 font-medium text-indigo-900' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'}`}
                  >
                    <input
                      type="radio"
                      name="committee-vote"
                      value={d}
                      checked={selectedVote === d}
                      onChange={() => setSelectedVote(d)}
                      className="sr-only"
                    />
                    {DECISION_LABELS[d]}
                  </label>
                ))}
            </div>
          </div>

          {projected && (
            <p className="text-xs text-slate-500">
              Projected outcome if you vote now:{' '}
              <strong className="text-slate-700">{DECISION_LABELS[projected]}</strong>
            </p>
          )}

          <label className="block space-y-1 text-sm font-medium text-slate-700">
            Rationale <span className="text-red-500">*</span>
            <textarea
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
              rows={3}
              placeholder="Explain your decision in relation to the evidence."
              aria-required
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </label>

          {errors.length > 0 && (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 space-y-1"
            >
              {errors.map((e) => (
                <p key={e.field}>{e.message}</p>
              ))}
            </div>
          )}

          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => void handleVote()}
              disabled={voteStatus === 'submitting'}
              className="rounded-full bg-indigo-600 px-6 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {voteStatus === 'submitting' ? 'Submitting…' : 'Submit vote'}
            </button>
          </div>
        </div>
      )}

      <div aria-live="polite">
        {voteStatus === 'success' && (
          <p role="status" className="text-sm text-emerald-700">
            Vote recorded.
          </p>
        )}
        {voteStatus === 'error' && (
          <p role="alert" className="text-sm text-red-700">
            Could not submit vote. Please try again.
          </p>
        )}
      </div>

      {!isDecided && !isVoided && !votePermission.allowed && (
        <p className="text-sm text-slate-500" aria-live="polite">
          {votePermission.reason}
        </p>
      )}

      {!isDecided && !isVoided && recusalPermission.allowed && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <h3 className="font-semibold text-slate-800">Recuse yourself</h3>
          <label className="block space-y-1 text-sm font-medium text-slate-700">
            Reason for recusal <span className="text-red-500">*</span>
            <textarea
              value={recusalReason}
              onChange={(e) => setRecusalReason(e.target.value)}
              rows={2}
              placeholder="Describe your conflict of interest."
              aria-required
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </label>
          <div className="flex items-center gap-4" aria-live="polite">
            <button
              type="button"
              onClick={() => void handleRecuse()}
              disabled={recusalStatus === 'submitting' || !recusalReason.trim()}
              className="rounded-full border border-slate-300 bg-white px-6 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:text-slate-400"
            >
              {recusalStatus === 'submitting' ? 'Recording…' : 'Record recusal'}
            </button>
            {recusalStatus === 'success' && (
              <p role="status" className="text-sm text-emerald-700">
                Recusal recorded.
              </p>
            )}
            {recusalStatus === 'error' && (
              <p role="alert" className="text-sm text-red-700">
                Could not record recusal. Please try again.
              </p>
            )}
          </div>
        </div>
      )}

      {!isDecided && !isVoided && quorumReached && (
        <div className="flex items-center gap-4" aria-live="polite">
          <button
            type="button"
            onClick={() => void handleFinalise()}
            disabled={finaliseStatus === 'submitting'}
            className="rounded-full bg-emerald-600 px-8 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {finaliseStatus === 'submitting' ? 'Finalising…' : 'Finalise decision'}
          </button>
          {finaliseStatus === 'success' && (
            <p role="status" className="text-sm text-emerald-700">
              Decision finalised.
            </p>
          )}
          {finaliseStatus === 'error' && (
            <p role="alert" className="text-sm text-red-700">
              Could not finalise. Please try again.
            </p>
          )}
        </div>
      )}
    </section>
  );
}

export default CommitteeWorkflowPanel;
