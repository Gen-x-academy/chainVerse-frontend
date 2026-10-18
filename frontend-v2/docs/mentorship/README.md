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
  availability/          # MENTOR-013/MENTOR-054 - weekly availability and external free/busy
    external-calendar.ts  external-calendar.service.ts
    components/ExternalCalendarPanel.tsx
  availability/          # MENTOR-013/MENTOR-053 - weekly availability and exceptions
    recurring-availability.ts  recurring-availability.service.ts
    components/RecurringAvailabilityPanel.tsx
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
