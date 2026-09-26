/**
 * Effective communication preferences (issue #1140).
 *
 * Resolution is layered and explainable: `isMandatoryEvent` short-circuits to
 * enabled, then consent evidence decides whether an opt-in channel may be on at
 * all, then scope precedence (`user` > `program` > `role`) picks the value.
 * Every function is pure and takes `now` explicitly.
 */

import { apiClient } from '@/src/lib/api-client';
import type {
  Channel,
  ConsentBasis,
  ConsentEvidence,
  EffectivePreference,
  EventPreference,
  PreferenceChange,
  PreferenceMatrix,
  PreferenceScope,
  ScholarshipNotificationEventName,
} from './types';

export const COMMUNICATIONS_PATH = '/scholarships/communications/preferences';

/** Scheduled send cadence, used to make preference changes predictable. */
export const PREFERENCE_CHANGE_TAKES_EFFECT_HOURS = 24;

/**
 * Operational notices a recipient must receive regardless of preference:
 * deadlines, required actions, recorded decisions, acceptance, payment
 * settlement, and payout setup.
 */
export const MANDATORY_COMMS_EVENTS: readonly ScholarshipNotificationEventName[] = [
  'deadline.approaching',
  'application.action-required',
  'decision.recorded',
  'award.acceptance-required',
  'payment.processed',
  'payout.setup-required',
];

export const OPTIONAL_COMMS_EVENTS: readonly ScholarshipNotificationEventName[] = [
  'review.assigned',
  'milestone.evidence-required',
];

export const ALL_COMMS_EVENTS: readonly ScholarshipNotificationEventName[] = [
  ...MANDATORY_COMMS_EVENTS,
  ...OPTIONAL_COMMS_EVENTS,
];

export const COMMS_CHANNELS: readonly Channel[] = ['in-app', 'email', 'sms', 'push'];

/** Channels a recipient must explicitly opt in to before they can be enabled. */
export const OPT_IN_CHANNELS: readonly Channel[] = ['email', 'sms', 'push'];

export function isMandatoryEvent(name: ScholarshipNotificationEventName): boolean {
  return MANDATORY_COMMS_EVENTS.includes(name);
}

export function requiresOptInConsent(channel: Channel): boolean {
  return OPT_IN_CHANNELS.includes(channel);
}

const SCOPE_PRECEDENCE: Record<PreferenceScope, number> = {
  user: 3,
  program: 2,
  role: 1,
};

function entryMatches(entry: EventPreference, name: ScholarshipNotificationEventName, channel: Channel) {
  return entry.eventName === name && entry.channel === channel;
}

/** Every recorded consent basis for an event/channel, strongest first. */
function consentEvidenceFor(
  matrix: PreferenceMatrix,
  name: ScholarshipNotificationEventName,
  channel: Channel
): ConsentEvidence | undefined {
  return matrix.consents
    .filter(
      (evidence) =>
        evidence.eventName === name && evidence.channel === channel && evidence.basis === 'opt-in'
    )
    .sort((a, b) => (a.capturedAt < b.capturedAt ? 1 : -1))[0];
}

/**
 * Resolves the preference that actually applies. A mandatory event is always
 * enabled; an opt-in channel without recorded consent is always disabled;
 * otherwise the highest-precedence scope wins and the rest are defaults.
 */
export function effectivePreference(
  matrix: PreferenceMatrix,
  name: ScholarshipNotificationEventName,
  channel: Channel,
  now: Date = new Date()
): EffectivePreference {
  if (isMandatoryEvent(name)) {
    return {
      eventName: name,
      channel,
      enabled: true,
      mandatory: true,
      reason: 'Required operational notice — it cannot be switched off.',
    };
  }

  const evidence = consentEvidenceFor(matrix, name, channel);
  const candidates = matrix.entries
    .filter((entry) => entryMatches(entry, name, channel))
    .sort((a, b) => {
      const byScope = SCOPE_PRECEDENCE[b.scope] - SCOPE_PRECEDENCE[a.scope];
      if (byScope !== 0) return byScope;
      return a.updatedAt < b.updatedAt ? 1 : -1;
    });

  const resolved = candidates[0];

  if (requiresOptInConsent(channel) && !evidence) {
    return {
      eventName: name,
      channel,
      enabled: false,
      mandatory: false,
      reason: `No opt-in consent recorded for ${channel} as of ${now.toISOString().slice(0, 10)}.`,
    };
  }

  if (!resolved) {
    return {
      eventName: name,
      channel,
      enabled: false,
      mandatory: false,
      reason: 'No preference recorded; the default is off.',
    };
  }

  const scope = resolved.scope;
  const scopeNote = scope === 'user' ? 'Your own choice applies.' : `${scope} default applies.`;
  return {
    eventName: name,
    channel,
    enabled: resolved.enabled,
    mandatory: false,
    reason: `${scopeNote} Updated ${resolved.updatedAt}.`,
  };
}

/**
 * A change never lands mid-send: it takes effect at the next scheduled send,
 * one full cadence after the change was made.
 */
export function changesTakeEffectFrom(change: PreferenceChange, now: Date = new Date()): string {
  const changedAt = Date.parse(change.changedAt);
  const base = Number.isNaN(changedAt) ? now.getTime() : changedAt;
  const requested = Date.parse(change.effectiveFrom);
  const requestedMs = Number.isNaN(requested) ? Number.POSITIVE_INFINITY : requested;
  return new Date(Math.max(base, requestedMs) + PREFERENCE_CHANGE_TAKES_EFFECT_HOURS * 3600 * 1000).toISOString();
}

export function requiresConsent(change: PreferenceChange): boolean {
  if (!change.enabled) return false;
  if (isMandatoryEvent(change.eventName)) return false;
  return requiresOptInConsent(change.channel);
}

/**
 * Returns a new matrix with the change applied, or the same matrix when the
 * change is refused (disabling a mandatory event, or enabling an opt-in channel
 * with no consent evidence on record).
 */
export function togglePreference(
  matrix: PreferenceMatrix,
  change: PreferenceChange,
  now: Date = new Date()
): PreferenceMatrix {
  if (!change.enabled && isMandatoryEvent(change.eventName)) {
    return matrix;
  }

  if (requiresConsent(change) && !consentEvidenceFor(matrix, change.eventName, change.channel)) {
    return matrix;
  }

  const scope: PreferenceScope = change.scope ?? 'user';
  const scopeId = change.scopeId ?? 'current-user';
  const consentBasis: ConsentBasis = requiresConsent(change) ? 'opt-in' : 'service-delivery';
  const updatedAt = changesTakeEffectFrom(change, now);

  const entry: EventPreference = {
    eventName: change.eventName,
    channel: change.channel,
    enabled: change.enabled,
    mandatory: isMandatoryEvent(change.eventName),
    updatedAt,
    scope,
    scopeId,
    consentBasis,
  };

  return {
    ...matrix,
    scopes: matrix.scopes.some((s) => s.scope === scope && s.scopeId === scopeId)
      ? matrix.scopes
      : [...matrix.scopes, { scope, scopeId }],
    entries: [
      ...matrix.entries.filter(
        (existing) =>
          !(
            entryMatches(existing, change.eventName, change.channel) &&
            existing.scope === scope &&
            existing.scopeId === scopeId
          )
      ),
      entry,
    ],
  };
}

/** Records explicit opt-in consent so an optional channel can be switched on. */
export function recordOptInConsent(
  matrix: PreferenceMatrix,
  evidence: ConsentEvidence
): PreferenceMatrix {
  return { ...matrix, consents: [...matrix.consents, evidence] };
}

export function emptyPreferenceMatrix(scopes: PreferenceMatrix['scopes'] = []): PreferenceMatrix {
  return { scopes, entries: [], consents: [], mandatoryEvents: [...MANDATORY_COMMS_EVENTS] };
}

export const communicationsService = {
  get: (): Promise<PreferenceMatrix> => apiClient.get<PreferenceMatrix>(COMMUNICATIONS_PATH),

  save: (payload: {
    matrix: PreferenceMatrix;
    idempotencyKey: string;
    expectedVersion: number;
  }): Promise<PreferenceMatrix> =>
    apiClient.put<PreferenceMatrix>(COMMUNICATIONS_PATH, payload),

  recordConsent: (evidence: ConsentEvidence): Promise<ConsentEvidence> =>
    apiClient.post<ConsentEvidence>(`${COMMUNICATIONS_PATH}/consent`, evidence),
};
