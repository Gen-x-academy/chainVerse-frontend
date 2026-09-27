# Per-event communication preferences (closes #1140)

## What this is

A per-event, per-channel preference matrix that a scholarship participant can
actually control, with two rules that cannot be overridden:

1. **Mandatory operational notices cannot be switched off.** Deadlines, required
   actions, recorded decisions, award acceptance, payment settlement, and payout
   setup resolve to `enabled: true` regardless of any scope.
2. **Optional email/SMS/push cannot be enabled without recorded opt-in
   consent.** In-app service notices need no consent.

- Module: `src/features/scholarships/communications`.
- Route: `/scholarships/communications/preferences`.
- API base path: `/scholarships/communications/preferences`.

Scope precedence is `user` > `program` > `role`; `program` and `role` entries
are only ever *defaults* that a `user`-scoped choice overrides. Consent is held
in `matrix.consents` as evidence and never competes for precedence.

## Ownership

- **Code owner:** the platform/frontend foundation team.
- **Data owner:** the participant, for the `user` scope; the program team for
  `program`; the role owner for `role`.
- **Review ownership:** feature-founder plus a privacy review for any change to
  `MANDATORY_COMMS_EVENTS` (narrowing what a participant can opt out of is a
  legal change) or to `OPT_IN_CHANNELS`.

## Privacy

- Preferences are stored per event and channel, never per message content, so
  the matrix holds no applicant data.
- `ConsentEvidence` records `eventName`, `channel`, `basis`, `capturedAt`, and
  `policyVersion` — the evidence a consent audit needs and nothing more. It is
  the record a deletion request has to honour.
- Mandatory cells are rendered checked and disabled with a `role="note"`
  explanation and are excluded from the toggle handler, so a client cannot
  misrepresent a required notice as optional.
- `mandatory` notices never travel an `opt-in` channel unless consent exists —
  `requiresConsent` returns `false` for a mandatory event because the notice is
  a service-delivery obligation, not marketing.
- Saving sends an `idempotencyKey` and an `expectedVersion`; the API must
  re-validate mandatory status and consent server-side (ADR-001: the frontend
  guard is UX only).

## Migration

- Additive only: a new module and route; no existing preference store is
  migrated or replaced.
- `changesTakeEffectFrom(change, now)` gives every change a predictable
  effective time — one `PREFERENCE_CHANGE_TAKES_EFFECT_HOURS` (24h) window
  after the change, never mid-send, and never earlier than the change itself.
  The UI shows that timestamp in the pending-change summary before saving.
- `togglePreference` returns the *same* matrix object when it refuses a change,
  which makes "refused" observable to callers and to the UI's error state.
- A matrix with no entries is a valid starting state and renders an empty state
  with a next step rather than an error.

## Operational impact

- Fails softly: load failures render a `role="alert"` panel, save failures keep
  the in-progress state and surface the API message, and a read-only viewer gets
  a `role="note"` permission notice with the save action disabled.
- Metrics to watch: save failure rate, the share of participants with no opt-in
  consent recorded (a consent-flow regression), and the count of attempted
  mandatory-event disables (a client regression, since the UI cannot send one).
- Because a change lands at the next scheduled send, a support request "I turned
  it off but still got an email" is expected inside the 24-hour window.

## Verify

- `npx vitest run src/features/scholarships/__tests__/communications.test.ts
  src/features/scholarships/communications` — mandatory protection, consent
  gating, scope precedence, effective-time predictability, plus the component's
  fieldset/legend/label semantics, pending summary, and save/permission states.
- Manual: on `/scholarships/communications/preferences`, confirm every required
  notice is checked and disabled with its explanation, that email/SMS/push cells
  are disabled until the opt-in consent is ticked, and that the pending summary
  shows the effective time before saving.
