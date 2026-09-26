/**
 * Per-event communication preferences (issue #1140).
 *
 * A recipient's channel choices are scoped (user, program, or role) and layered:
 * a user choice wins, a program choice is the fallback for that program, and a
 * role choice is the fallback for everyone in that role. Mandatory operational
 * notices are not preferences at all &mdash; they are part of running the
 * program, so they resolve to enabled no matter what any scope says.
 */

import type { Channel, ScholarshipNotificationEventName } from '../notification-events/types';

export type { Channel, ScholarshipNotificationEventName };

export type PreferenceScope = 'user' | 'program' | 'role';

export type ConsentBasis = 'service-delivery' | 'opt-in' | 'contractual';

export type EventPreference = {
  eventName: ScholarshipNotificationEventName;
  channel: Channel;
  enabled: boolean;
  mandatory: boolean;
  updatedAt: string;
  scope: PreferenceScope;
  scopeId: string;
  consentBasis: ConsentBasis;
};

export type PreferenceScopeRef = {
  scope: PreferenceScope;
  scopeId: string;
};

export type ConsentEvidence = {
  eventName: ScholarshipNotificationEventName;
  channel: Channel;
  basis: ConsentBasis;
  capturedAt: string;
  policyVersion: string;
};

export type PreferenceMatrix = {
  scopes: PreferenceScopeRef[];
  entries: EventPreference[];
  /** Consent is evidence, not a preference: it never competes for precedence. */
  consents: ConsentEvidence[];
  mandatoryEvents: ScholarshipNotificationEventName[];
};

export type PreferenceChange = {
  eventName: ScholarshipNotificationEventName;
  channel: Channel;
  enabled: boolean;
  effectiveFrom: string;
  changedAt: string;
  scope?: PreferenceScope;
  scopeId?: string;
};

export type EffectivePreference = {
  eventName: ScholarshipNotificationEventName;
  channel: Channel;
  enabled: boolean;
  mandatory: boolean;
  reason: string;
};

/** A change queued but not yet saved, shown to the recipient before applying. */
export type PendingPreferenceChange = {
  eventName: ScholarshipNotificationEventName;
  channel: Channel;
  enabled: boolean;
  effectiveFrom: string;
  consentBasis: ConsentBasis;
};
