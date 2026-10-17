# MENTOR-109 — Mentorship erasure workflow

Closes #1356. Shared work item: **MENTOR-109** (Privacy track).

## Scope

Coordinate deletion or anonymization across searchable profiles, drafts,
messages, files, analytics, and derived indexes while retaining lawful financial
or safety records.

## Behaviour

- **Identity first** — a request starts in `awaiting_identity` with no steps.
  `verifyIdentity` requires a non-empty verification reference and is idempotent.
- **Holds** — `planErasure` marks targets covered by an active hold (specific
  scope or `all`, respecting `until`). The request moves to `blocked_by_hold` and
  completing a held target throws.
- **Observable progress** — `erasureProgress` reports done/total/percent,
  retained categories, and held targets.
- **Prompt discovery removal** — the `index` target has the highest priority so
  public discovery drops first.
- **Retention explained** — `RETAINED_CATEGORY_REASONS` documents why financial
  and safety records are retained.
- **Safe retries** — only `failed` requests may retry, up to
  `MAX_ERASURE_ATTEMPTS`; completed steps are never re-run.

## APIs

`createErasureRequest`, `verifyIdentity`, `planErasure`, `completeStep`,
`erasureProgress`, `retryErasure`, `activeHold`.

## Dependencies & privacy

- Backend performs the actual deletion/anonymization and enforces holds
  authoritatively; this client mirrors the state machine for UX only.
- Authorization is deny-by-default; unauthenticated users cannot start a request.

## Rollout

Enable per data store behind a flag; verify public discovery removal latency
before enabling message/file erasure.

## Tests

`npx vitest run src/features/mentorship/__tests__/erasure-workflow.test.ts`
covers identity gating, holds, retention, priority ordering, progress, and safe
retries.

## Related MENTOR-109 work

Backend, data platform, and search must honor the same holds and retention rules.
