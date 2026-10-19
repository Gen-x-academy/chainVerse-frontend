# Mentorship (frontend-v2)

1-on-1 mentorship with smart-contract-backed payments. Source:
`src/features/mentorship/`. Routes live under `/mentorship`.

This directory holds the frontend documentation for the **Foundation**,
**Identity**, and **Delivery** tracks of the mentorship work item. Each document
names its shared work item so the corresponding backend, contract, and mobile
work can be located.

| Doc | Work item | Issue | Scope |
| --- | --- | --- | --- |
| [MENTOR-001 bounded contexts](./MENTOR-001-bounded-contexts.md) | MENTOR-001 | #1248 | Vocabulary, ownership, identifiers, lifecycles, invariants |
| [MENTOR-002 capability config](./MENTOR-002-capability-config.md) | MENTOR-002 | #1249 | Feature flags, limits, currencies, durations, evidence rules |
| [MENTOR-003 role matrix](./MENTOR-003-role-permission-matrix.md) | MENTOR-003 | #1250 | Least-privilege role and permission matrix |
| [MENTOR-112 abuse threat model](./MENTOR-112-mentorship-abuse-threat-model.md) | MENTOR-112 | #1359 | Abuse threat model: assets, boundaries, payments, minors, calendar, messaging |
| [MENTOR-120 rollout & migration](./MENTOR-120-rollout-migration-plan.md) | MENTOR-120 | #1367 | Rollout, flags, migrations, rollback, privacy, GA gates |
| [MENTOR-004 engagement lifecycle](./MENTOR-004-engagement-lifecycle-state-machine.md) | MENTOR-004 | #1251 | Guarded, auditable engagement state machine |
| [MENTOR-005 public identifiers](./MENTOR-005-stable-public-identifiers.md) | MENTOR-005 | #1252 | Stable, never display-derived public ids |
| [MENTOR-006 versioned contracts](./MENTOR-006-versioned-contracts.md) | MENTOR-006 | #1253 | Versioned command/query/event envelopes and primitives |
| [MENTOR-007 seed data](./MENTOR-007-seed-data.md) | MENTOR-007 | #1254 | Deterministic, synthetic demonstration dataset |
| [MENTOR-063 privacy-aware attendance](./MENTOR-063-privacy-aware-attendance.md) | MENTOR-063 | #1310 | Corroborated, partial, correctable attendance with expiring raw signals |
| [MENTOR-059 no-show reporting](./MENTOR-059-no-show-reporting.md) | MENTOR-059 | #1306 | Windowed no-show reports with limited evidence, merged duplicates, due process and policy gated consequences |
| [MENTOR-058 cancel sessions](./MENTOR-058-cancel-sessions.md) | MENTOR-058 | #1305 | Policy priced, idempotent cancellation with one settlement instruction and slot release |
| [MENTOR-057 reschedule sessions](./MENTOR-057-reschedule-sessions.md) | MENTOR-057 | #1304 | Approval based reschedule with notice policy, fee preview, stale approval protection and calendar convergence |
| [MENTOR-056 book sessions](./MENTOR-056-book-sessions.md) | MENTOR-056 | #1303 | Idempotent, conflict-safe booking from an active agreement with local plus UTC confirmation |
| [MENTOR-064 private participant notes](./MENTOR-064-private-participant-notes.md) | MENTOR-064 | #1311 | Owner-only notes; id-only search, owner-only export, no text in logs |
| [MENTOR-055 mutual session slots](./MENTOR-055-mutual-session-slots.md) | MENTOR-055 | #1302 | Deterministic, DST-safe, capacity-aware slot discovery |
| [MENTOR-054 external calendar](./MENTOR-054-external-calendar.md) | MENTOR-054 | #1301 | Revocable free/busy calendar connections with replay-safe sync |
| [MENTOR-053 recurring availability](./MENTOR-053-recurring-availability.md) | MENTOR-053 | #1300 | Weekly windows, exceptions, DST, booking policy and conflict protection |
| [MENTOR-052 agreement export](./MENTOR-052-agreement-export.md) | MENTOR-052 | #1299 | Participant-only, audited, expiring export of agreement records |

## Module layout

```
src/features/mentorship/
  glossary.ts            # MENTOR-001 — vocabulary and lifecycles
  public-identifiers.ts  # MENTOR-005 — stable public id generation
  contracts.ts           # MENTOR-006 — versioned envelopes and primitives
  rbac.ts                # MENTOR-003 — permission matrix and role-aware nav
  config/                # MENTOR-002 — capability configuration
    types.ts  service.ts  index.ts
    components/MentorshipCapabilityConfigPanel.tsx
  engagements/           # MENTOR-004 — lifecycle state machine + flows
    lifecycle-state-machine.ts
  availability/          # MENTOR-013/053/054/055 - availability, calendars, mutual slots
    recurring-availability.ts  recurring-availability.service.ts
    external-calendar.ts  external-calendar.service.ts
    slot-finder.ts  slot-finder.service.ts
    components/RecurringAvailabilityPanel.tsx  ExternalCalendarPanel.tsx  MutualSlotFinder.tsx
  attendance/            # MENTOR-063 — privacy-aware attendance
    attendance.ts  attendance.service.ts  components/AttendancePanel.tsx
  sessions/              # MENTOR-056 to 059 - booking, rescheduling, cancelling and no-shows, with shared primitives
    session-core.ts  session-booking.ts  session-booking.service.ts
    session-reschedule.ts  session-reschedule.service.ts
    session-cancellation.ts  session-cancellation.service.ts
    no-show-reports.ts  no-show-reports.service.ts
    components/SessionBookingForm.tsx  RescheduleSessionPanel.tsx  CancelSessionPanel.tsx
    components/NoShowReportForm.tsx  NoShowCasePanel.tsx  EvidenceEditor.tsx
  notes/                 # MENTOR-064 — private participant notes
    private-notes.ts  private-notes.service.ts  components/PrivateNotesPanel.tsx
  agreements/            # MENTOR-045/046/048/052 — terms, acceptance, export
    engagement-agreement.ts  agreement-acceptance.ts  agreement-export.ts
    agreement-export.service.ts  components/AgreementExportPanel.tsx
  seed/                  # MENTOR-007 — deterministic dataset
    dataset.ts  index.ts
  components/        # MentorshipPageShell, RolePermissionMatrix
  index.ts           # public entrypoint
```

## Boundaries

- Cross-feature imports must use `src/features/mentorship/index.ts` only (see
  `docs/feature-boundaries.md`).
- The frontend is authoritative for **presentation and precondition checks**
  only. Every grant is re-enforced server-side; the client guard exists to give
  a consistent access-denied state, not to protect data.

## Dependencies on other repositories

- **Backend/API** must expose the endpoints the services target:
  `/mentorship/glossary`, `/mentorship/config`, `/mentorship/access/check`.
- **Contracts** (MENTOR-001) own the canonical identifiers and lifecycle states
  mirrored here; a contract change is a breaking change to this module.
- **Mobile** re-implements the same vocabulary and matrix; this module is the
  reference for the terms and denial reasons.
