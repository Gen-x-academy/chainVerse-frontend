# MENTOR-003 — Role and permission matrix

Closes #1250. Source: `src/features/mentorship/rbac.ts`.
Shared work item: **MENTOR-003** (Foundation track). Route: `/mentorship/roles`.

## What this is

A single least-privilege matrix mapping eight roles to explicit actions on
twelve resources. There are no wildcards and no implicit grants: an operation is
allowed only when the role lists it **and** both global controls pass.

## Global controls (checked before the matrix)

1. **Tenant.** `principal.tenantId` must equal `resource.tenantId`. A mismatch
   is `CROSS_TENANT_DENIED` — the matrix never gets a vote.
2. **Self-approval.** For `approve`, `publish`, and `settle`, a principal may
   never act on a resource they own (`resource.ownerId === principal.userId`),
   even an administrator. This is `SELF_APPROVAL_DENIED`.
3. **Guardian scope.** A guardian may read a `mentee-profile` only for a mentee
   in their `wards`; otherwise `GUARDIAN_SCOPE_DENIED`.

Only then is the matrix consulted; a missing entry is `NO_PERMISSION`.

## Matrix (actions per resource)

Resources: `mentor-profile`, `mentee-profile`, `expertise-taxonomy`,
`verification`, `program`, `engagement`, `session`, `deliverable`, `payment`,
`dispute`, `configuration`, `audit-event`.
Actions: `read`, `create`, `update`, `delete`, `approve`, `publish`, `settle`,
`export`.

| Role | Highlights |
| --- | --- |
| student | reads programs, own engagement/session/deliverable/payment |
| tutor | reads/updates own mentor profile, reads taxonomy |
| mentor | authors profile, owns sessions, approves deliverables |
| guardian | reads a linked ward's profile, engagement, session, payment |
| organization-staff | manages programs, taxonomy; reads configuration and audit |
| moderator | owns disputes; approves verifications (never their own) |
| finance | settles payments; reads/export audit |
| administrator | full CRUD across the platform tenant |

The full table is rendered by `RolePermissionMatrix` at `/mentorship/roles`.

## Role-aware navigation

`MENTORSHIP_AREA_ACCESS` maps each menu area to the roles that may see it;
`accessibleMentorshipAreas(role)` drives the hub so a role only ever links to
areas it can open. This is a UX boundary only.

## Denial reasons

`describeMentorshipDenial` turns each reason into stable user copy. UI code
branches on the reason enum, never on the sentence.

## Privacy boundaries

The matrix itself holds no personal data. It is the mechanism that keeps
`governmentId`, `payoutAccountRef`, and `reporterIdentity` inside their owning
roles (see [MENTOR-001](./MENTOR-001-bounded-contexts.md)).

## Rollout

- Additive. The route is new and the matrix is a client constant.
- Because it is deny-by-default, shipping it changes no access until a surface
  reads it; the API remains the authority.

## Dependencies on other repositories

- **Backend** exposes `POST /mentorship/access/check` and must enforce the same
  grants; the client decision is advisory.
- **Contracts** (MENTOR-003) own role names and denial reasons.
- **Mobile** mirrors the matrix and the three global controls.

## Verify

- `npx vitest run src/features/mentorship/__tests__/rbac.test.ts` — cross-tenant
  denial, self-approval denial (including admin), guardian scope, explicit
  grants, and area navigation.
- `npx tsc --noEmit`.
- Route smoke: open `/mentorship/roles` as `administrator` (table) and as
  `mentor` (consistent access-denied state).
