# Data retention & deletion policy

Closes #1153. Source: `src/features/scholarships/retention/`.
Route: `/scholarships/retention`.

## Related workspace capabilities

This policy is the retention reference for the capstone and research-project
workspace. The following frontend-v2 work items share its privacy boundaries and
must be read alongside it:

| Work item | Capability | Frontend source | Route |
| --- | --- | --- | --- |
| CAPSTONE-066 (#1492) | Collaborative project notes | `src/features/workspace/notes/` | `/workspace/projects/:projectId/notes` |
| CAPSTONE-067 (#1493) | Private researcher notes | `src/features/workspace/notes/` | `/workspace/projects/:projectId/notes` |
| CAPSTONE-069 (#1495) | Project discussion threads | `src/features/workspace/discussions/` | `/workspace/projects/:projectId/discussions` |
| CAPSTONE-072 (#1498) | Project activity feed | `src/features/workspace/activity/` | `/workspace/projects/:projectId/activity` |
| CAPSTONE-074 (#1500) | Configurable review rubrics | `src/features/workspace/rubrics/` | `/workspace/rubrics` |
| CAPSTONE-076 (#1502) | Blinded review modes | `src/features/workspace/reviews/blinded/` | `/workspace/reviews/blinded` |
| CAPSTONE-077 (#1503) | Fair review aggregation | `src/features/workspace/reviews/aggregation/` | `/workspace/projects/:projectId/reviews` |
| CAPSTONE-078 (#1504) | Proposal revision requests | `src/features/workspace/reviews/revisions/` | `/workspace/projects/:projectId/reviews/revisions` |

Each capability is delivered in the other repositories under the same shared
work item id (CAPSTONE-066 / 067 / 069 / 072 / 074 / 076 / 077 / 078). The
backend owns persistence, authorization enforcement, and the audit chain; this
repository owns the responsive, accessible UI, typed API clients, and role-aware
navigation. Do not ship a frontend capability ahead of its backend contract —
the client treats a missing or unauthorized endpoint as an error state, never as
empty data.

### Cross-repository coordination

- **CAPSTONE-066 (collaborative project notes)** shares the notes route with
  CAPSTONE-067. Shared notes are project- and tenant-scoped and visible to
  authorized members; private researcher notes stay owner-only. The backend
  contract must distinguish the two visibility scopes before either ships.
- **CAPSTONE-072 (activity feed)** aggregates permission-filtered changes from
  the other workspace capabilities. It depends on the audit/event contract of
  every producer (notes, discussions, rubrics, reviews, revisions); a producer
  that emits private payloads would leak through the feed, so the feed only
  renders ids, actor, type, time, and deep links.
- **CAPSTONE-074 (review rubrics)** is versioned configuration consumed by
  CAPSTONE-076/077/078. Rubric versions are immutable once used for a review;
  the frontend never edits a published version in place.
- **CAPSTONE-076 (blinded review modes)** is a projection concern: the backend
  returns blinded projections and the frontend must not reconstruct hidden
  identities from other fields, caches, or analytics.
- Coordinate contract changes with the backend, identity, audit, and
  notification repositories under the same work item ids before enabling a
  route in any tenant.

### Dependencies

- **Backend API** for collaborative and private notes, threads, activity feed,
  rubrics, blinded review projections, review aggregation, and revision
  requests, including deny-by-default authorization and tenant scoping. The
  frontend never infers permission from a hidden control; every action is
  re-checked server-side.
- **Identity/roles** for owner-only notes, project membership, rubric
  administration, and reviewer/author roles. Role-aware navigation hides
  unavailable routes but is not the authorization boundary.
- **Audit service** for lifecycle transitions. Audit records carry ids, actor,
  action, and timestamps only — never note bodies, thread content, rubric
  guidance text, review comments, revision text, or blinded identities.
- **Notification service** for mentions, revision deadlines, review outcomes,
  and rubric publication. Notifications reference ids, not private payloads.

### Privacy boundaries

- **Collaborative project notes (CAPSTONE-066)** are visible only to authorized
  project members within the tenant. Note bodies, links, and revision history
  are never sent to analytics, logs, or exports; only event names and opaque ids
  are emitted. Rendering is sanitized — stored markup is treated as untrusted.
  Archived notes are retained per policy, not deleted on archive.
- **Private researcher notes (CAPSTONE-067)** are owner-only. They are excluded
  from team views, review screens, analytics content, exports, and general logs.
  The client never sends note bodies to analytics; only event names and opaque
  ids are emitted. Notes are not written to any public ledger.
- **Discussion threads (CAPSTONE-069)** are scoped to a project and tenant.
  Mentions resolve to display names only; attachments are referenced by id and
  fetched through an authorized endpoint. Moderation hooks record the action, not
  the removed content.
- **Activity feed (CAPSTONE-072)** is permission-filtered per viewer and never
  copies private content. Entries carry actor, type, time, and a deep link; the
  feed does not embed note bodies, thread text, rubric guidance, or review
  comments. Read state is per-user and stored server-side; retention follows the
  project's retention class, and expired entries are swept, not archived into
  the feed.
- **Review rubrics (CAPSTONE-074)** define versioned criteria, weights,
  guidance, score ranges, required comments, visibility, and aggregation rules.
  Guidance text is configuration, not private content, but is still excluded
  from analytics and logs. Published versions are immutable; edits create a new
  version so past reviews remain explainable.
- **Blinded review modes (CAPSTONE-076)** hide configured participant or
  reviewer identity fields consistently across queues, exports, notifications,
  and audit-safe projections. The frontend renders only the blinded projection
  the backend returns and must not infer hidden identities from ordering,
  counts, or cached data. Blinded identities are never emitted to analytics.
- **Review aggregation (CAPSTONE-077)** exposes explainable outcomes (quorum,
  missing-review handling, calibration, tie treatment) but not individual
  reviewer identities or private comments. Scores are never silently mutated;
  recalculation is an explicit, audited action.
- **Revision requests (CAPSTONE-078)** are tied to an exact proposal version.
  Deadlines, response status, and resubmission rules are visible to the author
  and reviewers; the request text is not copied into logs or analytics.
- **Logging and analytics** must never emit private proposal, research, identity,
  safety, or financial content. Analytics events are privacy-safe: event name,
  route, role, and opaque ids only.

### Retention and moderation

- Notes and threads follow the `RetentionPolicy` above. A class with no rule is
  protected, never deleted. Legal holds block erasure of covered records first.
- Collaborative notes (CAPSTONE-066) retain their revision history for the
  project's retention window; archiving is a lifecycle state, not deletion.
- Thread retention is governed by the project's retention class; resolved
  threads are retained for the window and then expire under the same sweep.
- Activity feed entries (CAPSTONE-072) are retained per the project's retention
  class and swept on expiry. Read state is per-user metadata and is removed with
  the entry; it never outlives the entry it describes.
- Rubric versions (CAPSTONE-074) are retained with the reviews that used them so
  a decision can be explained after the fact. Blinded review projections
  (CAPSTONE-076) are retained in their blinded form; unblinding, where allowed,
  is an explicit audited action.
- Moderation actions (hide, lock, remove) are audited with actor and reason code.
  Removed content is retained per policy for review, not hard-deleted on action.
- Review aggregation snapshots and revision requests are retained with their
  proposal version so a decision can be explained after the fact.

### Rollout and rollback

- **Rollout:** publish backend contracts first, then enable routes behind the
  role-aware navigation flag per tenant. Start with collaborative notes and
  threads in a single pilot tenant, verify audit records contain no private
  payloads, then widen. Enable the activity feed only after its producer
  contracts are live. Enable review rubrics before blinded modes, aggregation,
  and revision requests, since those consume rubric versions. Validate the
  review lifecycle end to end before enabling blinded modes in a tenant.
- **Rollback:** each capability is additive and independently flaggable. Disable
  the navigation flag to hide a route; the backend remains the source of truth
  and no data is deleted by rolling back the frontend. Never roll back by
  deleting records — use the retention sweep and legal holds. Rolling back
  blinded modes must not reveal previously hidden identities in exports or
  notifications; keep the blinded projection until the backend unblinds.
- **Idempotency:** concurrent requests and retries must not duplicate notes,
  note revisions, threads, mentions, feed entries, rubric versions, review
  decisions, revision requests, or notifications. The client sends idempotency
  keys and surfaces conflicts as stable, actionable errors rather than retrying
  blindly. Stale transitions (editing an archived note, publishing over an
  existing rubric version, submitting against a superseded rubric) are rejected
  with actionable errors, never silently merged.
=======

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
