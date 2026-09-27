# Scholarships — versioned communication templates

Closes **#1142**. Route: `/scholarships/templates`.
Module: `src/features/scholarships/templates/`.

## What this is

Award confirmations, disbursement notices, review outcomes, and deadline reminders
are authored once as a **template** with a declared variable contract, then
rendered per recipient. Every change creates a new `TemplateVersion`; nothing is
edited in place, so a delivered message can always be traced back to the exact
version that produced it.

- `TemplateChannel` is `in-app`, `email`, `sms`, or `push`.
- Copy uses `{{variable}}` tokens that must all be declared in `variables`.
- Channel limits are hard: SMS 480 characters, push 140 body / 90 subject,
  subject lines 120 characters, and `email`/`push` require a subject.
- Publication is blocked while `validateTemplate` reports any error
  (`EMPTY_BODY`, `UNCLOSED_TOKEN`, `UNKNOWN_VARIABLE`, `MISSING_VARIABLE`,
  `CHANNEL_LIMIT`) and while no approver is recorded. `canPublish` is the single
  gate the UI and the service both consult.
- `publishTemplate` never renumbers a version; it flips the draft to `published`
  and moves the previously published version of the same key to `rolled-back`.
  `rollbackTemplate` re-points the live template at an earlier version.
- `renderTemplate` throws rather than returning a partial message when a token
  is undeclared or a required value is missing.
- A `DeliveryRecord` always carries `templateVersion` and an opaque
  `recipientRef`, plus a `redactedLog` string with every `pii: true` value
  replaced by `[redacted]`.

`ScholarshipTemplateStudio` renders the key/channel/locale selectors, the body
editor, a live validation panel wired to the textarea with `aria-invalid` and
`aria-describedby`, a preview with personal-data tokens masked, a publish control
that stays disabled until validation passes and an approver is supplied, and the
approval/rollback history. `templateService` talks to `/scholarships/templates`
and sends an `idempotencyKey` plus `expectedVersion` on every write.

## Ownership

- **Code owner:** the platform/frontend foundation team
  (`src/features/scholarships/templates/**`, this file).
- **Content owner:** the programme communications lead approves copy; an
  administrator performs the publication.
- **Review ownership:** a change to `CHANNEL_LIMITS` or to the publish gate
  (`canPublish`) needs a second reviewer from the notifications team.

## Privacy

- A variable flagged `pii: true` is masked in the in-app preview and replaced
  with `[redacted]` in any log line. `redactForLog` and
  `buildDeliveryRecord` are the only sanctioned paths to a log string.
- Delivery records reference an opaque `recipientRef`; an email address or a
  student name is never stored in the client.
- Rollback history is retained so a mis-sent message can be identified, but the
  retained copy is the redacted one, not the rendered body.

## Migration

- Additive only. No existing notification path is rewritten; templates are a new
  authoring surface that the backend can adopt per `templateKey`.
- Until the backend serves `/scholarships/templates`, the studio renders its
  loading, error, and empty states rather than seeded fake copy.

## Operational impact

- Publication failures surface inline with the server's message; the drafts stay
  in the editor so nothing has to be retyped.
- An idempotency key per `(templateKey, version)` means a retried publish cannot
  create a second live version.
- Metrics to watch: publish rejection rate (a spike means authors are hitting
  the channel limits) and rollback count per template key.

## Verify

- `npx vitest run src/features/scholarships/__tests__/templates.test.ts` — token
  extraction, unknown/missing variable detection, channel limits, the publish
  gate, rollback, PII redaction, and delivery-record versioning.
- `npx vitest run src/features/scholarships/templates` — component states and
  the publish control.
- Route smoke: visit `/scholarships/templates`, break one token, and confirm the
  error appears next to the body and the publish button is disabled.
