# CAPSTONE-090: Project output provenance (frontend)

This document covers the frontend-v2 slice of shared work item **CAPSTONE-090**
(“Capture project output provenance”) in the Publishing track. It records, per
output version, the source datasets, methods, tools, commits, transformations,
licenses, authorship and integrity commitments behind an output.

The implementation is the pure domain module
`src/features/capstone/output-provenance.ts` with its vitest suite
`output-provenance.test.ts`. It follows the existing capstone pattern
(`project-lifecycle`, `contributor-attribution`, `portfolio-export`):
deterministic functions that routes, services and tests share.

## Captured provenance

Each output version records:

- **Sources** — dataset id, optional public name/version, access class
  (`public`, `restricted`, `private`) and an optional SHA-256 digest. Only
  public sources may carry a resolvable location.
- **Methods** — id, name and optional citation/protocol reference.
- **Tools** — id, name, optional version and vendor.
- **Commits** — repository, 7–64 character hexadecimal commit id and optional
  branch.
- **Transformations** — ordered, described steps with optional tool, input and
  output references and a reproducibility class (`scripted`, `manual`,
  `unknown`). Inputs must be sources or earlier transformations; outputs must be
  later transformations or the output itself. Cycles are rejected.
- **Licenses** — id, name and optional SPDX identifier.
- **Authorship** — project-member author ids, an author role and optional CRediT
  contribution kinds. At least one lead author is required.
- **Integrity commitments** — SHA-256 digest, scope (`output`, `sources`,
  `transformation`), covered ids and the commitment time. At least one
  output-scoped commitment is required.

## Lifecycle and versioning

1. `validateProvenance` checks tenant, project and output boundaries, component
   ids, author membership, transformation graph, licenses and integrity
   commitments.
2. `submitProvenance` moves a `draft` to `submitted` and bumps the revision.
3. `publishProvenance` moves a `submitted` version to `published` after
   revalidation. Authors cannot publish their own output; an assigned supervisor
   or editor must publish.
4. `reviseProvenance` registers the next immutable version from a published or
   rejected version; the previous version is never edited.
5. `supersedeProvenance` marks the immediately previous published version
   `superseded` once the next published version exists.
6. `versionHistory` and `latestVersion` expose the lineage.

## Integrity verification

`computeProvenanceDigest` hashes a canonical form of the version (sources,
methods, tools, commits, transformations, licenses, authors and stable output
metadata). `outputIntegrityCommitment` builds the output-scoped SHA-256
commitment, and `verifyProvenanceIntegrity` recomputes the digest on demand.
Revision, status, `updatedAt` and `publishedAt` are excluded from the digest, so
a commitment remains valid when the same version is submitted or published.

## Authorization and tenancy

Authorization is deny-by-default (`authorizeProvenance` with
`provenanceActionsFor`). Credited authors may declare, revise, submit and view
their own output. Authors credited with the `supervisor` role may publish only
their assigned outputs, and cannot publish if they are also a credited author.
Editors may publish inside their organization. Organization administrators and
auditors are read-only for publishing. Auditors may read audit data. Every role
is checked against the organization boundary.

## Privacy boundaries

- `provenanceAuditEntry` omits author identities, source names and locations,
  repository names, URLs and free-text notes; only ids, counts, recognised
  taxonomy values and integrity algorithms remain.
- `summarizeProvenance` returns aggregate counts only and suppresses groups
  smaller than `ANALYTICS_MIN_GROUP` (default 3) for output kinds and source
  access classes.
- Restricted and private sources must be referenced by id and digest; the
  validator rejects a `uri` on them with `PRIVATE_LOCATION_EXPOSED`.
- Source and transformation notes are private payloads and must not be sent to
  public ledgers, logs or analytics.
- No account, payment or contact data is part of this capability.

## Concurrency and retries

Every mutation takes a client-generated `requestId` and an `expectedRevision`.
A retried `requestId` returns the original result with `replayed: true`; a stale
revision returns `STALE_REVISION`. A revision always allocates the next version
instead of mutating the previous one, so retries cannot duplicate versions or
publish a stale record.

Errors use stable codes (`NOT_AUTHORIZED`, `STALE_REVISION`, `INVALID_STATE`,
`INVALID_PROVENANCE`, `INVALID_SUPERSESSION`) and field-level validation codes
such as `PRIVATE_LOCATION_EXPOSED`, `TRANSFORMATION_CYCLE` and
`NO_OUTPUT_COMMITMENT`.

## Dependencies

- `src/features/capstone/portfolio-export.ts` provides the canonical JSON
  serializer and SHA-256 digest used by integrity commitments.
- `src/features/capstone/contracts-v1.ts` defines shared stable error and
  envelope shapes this module aligns with.
- `src/features/capstone/contributor-attribution.ts` owns contributor roles and
  CRediT contribution kinds; authorship here references project members without
  duplicating identity data.
- `src/features/capstone/bounded-contexts.ts` defines outputs as a bounded
  context that links to projects and milestones by id only.
- Corresponding **CAPSTONE-090** work in the other repositories owns the
  persistence, API endpoints, evidence storage, audit sink and analytics
  pipeline. The backend must enforce the same tenant, author/publisher
  separation and revision rules rather than trusting the client.

## Rollout and rollback

- Roll out behind the existing capstone feature flag. Start with read-only
  rendering of seeded deterministic provenance, then enable capture and
  publication per organization.
- The module is pure and has no persistence or schema migrations, so rollback is
  removing the feature-flag exposure and the module import. Stored versions and
  audit entries remain readable.
- If an upstream contract changes, bump the shared contract version; the
  frontend reports unsupported versions instead of silently parsing them.

## Verification

```bash
npm run test --workspace frontend-v2 -- src/features/capstone/output-provenance.test.ts
npm run typecheck
npm run lint
```

The suite includes deterministic fixtures for boundary and component validation,
private-location rejection, transformation graph cycles, the authorization
matrix, stale and replayed transitions, self-publish prevention, version history,
supersession, audit redaction, small-group analytics suppression and
integrity-commitment verification.
