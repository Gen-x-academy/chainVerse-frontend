# Data retention & deletion policy

Closes #1153. Source: `src/features/scholarships/retention/`.
Route: `/scholarships/retention`.

## What this is

A classified retention policy for scholarship records, with an erasure planner
that can be run as a dry run before anything is deleted.

Each `RecordClass` — `draft`, `rejected`, `withdrawn`, `awarded`, `financial`,
`audit`, `legal-hold` — has one `RetentionRule` stating a `retentionDays`
window (`null` = indefinite), a `basis` of `contractual` / `legal` /
`operational`, a human-readable `legalBasis`, whether the class is `deletable`,
and an `owner`. A `RetentionPolicy` is versioned and `approvedBy` a named
approver; a policy with no rules blocks everything, because nothing can expire
under an unapproved policy.

`assessRetention` evaluates in a fixed order, and the order *is* the policy:

1. **An active legal hold wins.** If a `LegalHold` — unreleased, scoped to the
   record's class, and naming either the record id or the applicant — covers the
   record, the action is `blocked-by-hold` and `protectedBy: 'legal-hold'`. This
   is checked first, so a hold also overrides the integrity guarantee below.
2. **`financial` and `audit` are never deletable.** `isDeletableClass` is the
   single source of that rule and `planErasure` uses it too, so no caller can
   route around it. Even a rule with `deletable: true` and an expired window
   yields `blocked-immutable` with `protectedBy: 'financial-integrity'` or
   `'audit-integrity'`. Breaking a settled disbursement trail or the audit chain
   is a worse outcome than retaining data past its nominal window.
3. **`retentionDays: null`** retains indefinitely.
4. **Window still open** retains, with the days remaining.
5. **Window closed today** is `expire` — the deletion sweep runs later, it is
   not immediate.
6. **Window closed and `deletable: false`** retains; the rule's own basis is the
   reason.
7. Otherwise the action is `delete`.

`planErasure` runs the assessment for one applicant and splits the result into
`deletable` (record ids that will go) and `protected` (record id, class, and the
basis it is kept on), plus `blockedByHolds`. A record whose class has no rule at
all is **protected**, never deleted — the absence of a rule is not permission.

## Ownership

- **Code owner:** platform/frontend foundation team
  (`src/features/scholarships/retention/**`).
- **Policy owner:** Privacy and Legal approve the `RetentionPolicy` version and
  own every `legalBasis` string. Finance operations own the `financial` and
  `audit` rules. A rule's `owner` is rendered in the table.
- **Hold authority:** only the officer who placed a hold should release it; the
  panel records `placedBy` and `releasedAt` on every hold.
- **Roles:** available to `administrator` and to the non-admin `finance` role.
  Without the grant the policy is read-only and hold actions are disabled with a
  `role="note"` naming who to ask.

## Privacy

- This module exists to *reduce* stored personal data. Deletion only ever
  removes the classes a policy marks deletable; the rest are retained with a
  stated basis so a subject access request can be answered with a reason rather
  than a refusal.
- The erasure preview is a dry run. Nothing on this screen deletes anything, and
  the panel says so next to the split so an operator cannot mistake it for an
  execution.
- Record ids, classes, and bases are shown; applicant contact details are not
  fetched. Logging must not emit record payloads.
- `legalBasis` text is written for a regulator and is safe to render verbatim.

## Migration

- Additive only. Nothing is deleted by this module — the API owns the deletion
  sweep, and the client only plans and reports. No existing route, module, or
  store is replaced.
- Start by publishing a `RetentionPolicy` with rules for every class the system
  actually creates. Classes with no rule are protected, so a partial policy is
  safe: it over-retains rather than over-deletes.
- Then place holds for any live dispute, verify the preview is blocked, and only
  then enable the deletion sweep on the backend.
- Historical records created before the policy exists have no `lastTouchedAt`
  anchor in some paths; `daysUntilExpiry` returns `null` for an unparseable
  date, which retains. Backfill the anchor before enabling the sweep so windows
  are computed from the right date.

## Operational impact

- An erasure run touches applicant data deletion, so it is the highest-risk
  operation in the scholarship feature. The plan must be reviewed by
  Privacy and Legal before execution.
- Metrics to watch: records per action across `retain` / `expire` / `delete` /
  `blocked-by-hold` / `blocked-immutable`; a rising `delete` share for a class
  that should be stable is a signal to check the policy. Also watch the count of
  active holds and how long they stay open — an unreleased hold silently blocks
  every erasure for that subject.
- Alerts: any attempt to delete a `financial` or `audit` record is a bug, not an
  event. Page on it.
- The panel is read-heavy (one policy, one hold list) and safe to leave open.

## Verify

- `npx vitest run src/features/scholarships/__tests__/retention.test.ts
  src/features/scholarships/retention` — drafts expiring, financial and audit
  never deletable, legal hold overriding, the erasure split, and the component's
  loading / empty / error / permission states and ARIA wiring.
- `npx tsc --noEmit` — no errors in `src/features/scholarships/retention/`.
- Route smoke: open `/scholarships/retention`, confirm the rule table renders
  with a basis per class and that the integrity statement is visible.
- Hold smoke: place a hold over `draft` for the previewed applicant and confirm
  the *Will be deleted* count drops to zero and the hold is listed as blocking.
