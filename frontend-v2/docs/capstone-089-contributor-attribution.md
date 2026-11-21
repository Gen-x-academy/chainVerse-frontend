# CAPSTONE-089: Contributor attribution (frontend)

This document covers the frontend-v2 slice of shared work item **CAPSTONE-089**
(“Register contributor attribution”) in the Publishing track. It records
versioned contributor roles, declared contributions, approvals, disputes and
output linkage against a recognised taxonomy.

The implementation is the pure domain module
`src/features/capstone/contributor-attribution.ts` with its vitest suite
`contributor-attribution.test.ts`. It follows the same pattern as the other
capstone modules (`project-lifecycle`, `proposal-withdrawal`,
`project-objectives`): deterministic data-in/data-out functions that routes,
services and tests share.

## Taxonomy

Declared contributions use the 14-role **CRediT** (Contributor Roles Taxonomy)
set, including conceptualisation, methodology, software, validation, formal
analysis, investigation, resources, data curation, writing (original draft and
review/editing), visualisation, supervision, project administration and funding
acquisition. Kinds are resolved from stable ids, labels and aliases (for
example `code` → `software`) so saved filters keep working.

Attribution roles are separate from CRediT work: lead author, co-author,
contributing author, editor, reviewer, translator, data steward, supervisor,
adviser and funder.

## Lifecycle and versioning

1. A declaration is validated (at least one contribution, recognised role/kind/
   level, unique kinds, at most 500-character private notes, approvers that do
   not include the contributor, and output links that exist and belong to the
   same project).
2. `submitAttribution` moves a `draft` to `submitted` and bumps the revision.
3. `recordApproval` records one decision per assigned approver. The version
   becomes `approved` only when every required approver has approved, and
   `rejected` as soon as any approver rejects.
4. `raiseDispute` opens a dispute on a submitted or approved version.
   `resolveDispute` either keeps the version and closes the dispute or, when
   upheld, marks the version `rejected` so a correction needs a new version.
5. `reviseAttribution` creates the next immutable version from an approved or
   rejected version; the previous version is never edited. Once the newer
   version is approved, `supersedeAttribution` marks the older one
   `superseded`.

`versionHistory` and `latestVersion` expose the lineage for timelines.

## Authorization and tenancy

Authorization is deny-by-default (`authorizeAttribution` with
`attributionActionsFor`). Contributors may declare, revise, submit, view and
dispute only their own attribution. Assigned supervisors may view, approve,
dispute and read audit data for their assignments. Editors and organization
administrators may view and resolve disputes inside their organization.
Auditors are read-only. Every role is checked against the organization
boundary, and self-approval is rejected even when a contributor is also an
assigned supervisor.

## Privacy boundaries

- Contributor ids, approver ids, output ids and free-text notes never appear in
  `attributionAuditEntry`; audit entries keep only the event type, attribution
  and project ids, version/revision/status, recognised contribution kinds and
  counters.
- `summarizeAttributions` returns aggregate counts only and suppresses groups
  smaller than `ANALYTICS_MIN_GROUP` (default 3), so a small cohort cannot be
  re-identified.
- Notes on contributions, approvals and disputes are private payloads and must
  not be forwarded to public ledgers, logs or analytics.
- No account, payment or contact data is part of this capability.

## Concurrency and retries

Every mutation takes a client-generated `requestId` and an
`expectedRevision`. A retried `requestId` returns the original result with
`replayed: true`; a stale revision returns `STALE_REVISION`. Recording the same
approver twice is a no-op, a duplicate open dispute with the same raiser and
reason is returned instead of created again, and revisions always allocate the
next version rather than mutating the previous one. This prevents duplicate
membership, decisions, disputes and versions under concurrent requests.

Errors are stable and actionable through typed codes (`NOT_AUTHORIZED`,
`STALE_REVISION`, `INVALID_STATE`, `INVALID_DECLARATION`, `OPEN_DISPUTE`,
`UNKNOWN_APPROVER`, `SELF_RESOLUTION`, `DISPUTE_MISMATCH`, `NOTE_TOO_LONG`,
`INVALID_SUPERSESSION`).

## Dependencies

- `src/features/capstone/contracts-v1.ts` defines the shared stable error and
  envelope shapes this module aligns with.
- `src/features/capstone/role-permissions.ts`, `project-lifecycle.ts` and
  `public-identifiers.ts` establish the deny-by-default, revision-guarded and
  public-id conventions reused here.
- Outputs are referenced by project output ids; callers supply the project’s
  outputs so linkage is validated without embedding another context’s data.
- Corresponding **CAPSTONE-089** work in the other repositories owns the
  persistence, API endpoints, audit sink and analytics pipeline. The backend
  must enforce the same tenant, self-approval and revision rules rather than
  trusting the client.

## Rollout and rollback

- Roll out behind the existing capstone feature flag. Start with read-only
  rendering and seeded deterministic fixtures, then enable declarations and
  approvals per organization.
- The module is pure and has no persistence or schema migrations, so rollback
  is removing the feature-flag exposure and the module import. Existing audit
  entries and stored attribution versions remain readable.
- If an upstream contract changes, bump the shared contract version; the
  frontend reports unsupported versions instead of silently parsing them.

## Verification

```bash
npm run test --workspace frontend-v2 -- src/features/capstone/contributor-attribution.test.ts
npm run typecheck
npm run lint
```

The suite includes deterministic fixtures for taxonomy resolution, declaration
and output-link validation, the full authorization matrix, stale and replayed
transitions, duplicate approval/dispute suppression, version history,
supersession, audit redaction and small-group analytics suppression.
