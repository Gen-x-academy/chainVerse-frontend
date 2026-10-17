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

## Module layout

```
src/features/mentorship/
  glossary.ts        # MENTOR-001 — vocabulary and lifecycles
  rbac.ts            # MENTOR-003 — permission matrix and role-aware nav
  config/            # MENTOR-002 — capability configuration
    types.ts  service.ts  index.ts
    components/MentorshipCapabilityConfigPanel.tsx
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
