# Scholarship feature flags & staged rollout

Closes #1166. Source: `src/features/scholarships/flags/`.
Route: `/scholarships/flags`.

## What this is

Runtime gates for the five scholarship surfaces — `discovery`, `applications`,
`reviews`, `awards`, `payouts` — so a programme can be released to an allowlist,
then a percentage of the cohort, then everyone, per environment. There is no
build-time flag: a rollout is a data change, not a redeploy.

Each `FlagDefinition` carries a `defaultEnabled` owner switch, a
`environments` matrix for `development` / `staging` / `production`, and one
`cohort`:

| Cohort | Behaviour |
| --- | --- |
| `{ kind: 'all' }` | Everyone in an enabled environment |
| `{ kind: 'allowlist', userIds }` | Only the listed user ids |
| `{ kind: 'percentage', percent }` | A deterministic hash bucket |

`evaluateFlag` resolves in a fixed order: owner switch, environment toggle, then
cohort. A percentage cohort hashes `userId + cohortSeed` with FNV-1a
(`cohortBucket`), so the same user lands in the same bucket on every reload,
process, and machine — there is no `Math.random` anywhere in the path and the
rollout is unit-testable without a clock. An allowlist is a cohort, not a hint:
a listed user is always in and an unlisted user is always out, regardless of the
seed. A percentage cohort with no signed-in user id falls back to the owner
default, because there is nothing to hash.

**Fail closed.** When the flag service cannot be reached,
`scholarshipFlagService.evaluateAll` returns `failClosedEvaluation` results:
`source: 'default'`, `enabled: false`, and a reason naming the failure.
`isSafeFallback` is the predicate for "the client, not the operator, decided
this". A missing configuration never switches a surface on.

## Ownership

- **Code owner:** platform/frontend foundation team
  (`src/features/scholarships/flags/**`).
- **Flag owners:** each definition names an `owner` string. Changing a rollout
  is an owner decision, recorded in the definition's `version` and `updatedAt`.
- **Roles:** the route is available to `administrator` and to the non-admin
  `finance` role. `finance` may read every flag and change rollouts; no other
  role sees the panel at all. The route guard is a UX boundary only — the API
  must enforce the same grant (ADR-001).

## Privacy

- A definition holds no applicant data. A cohort allowlist holds user ids, which
  are pseudonymous account identifiers and are never rendered to students.
- Cohort bucketing is one-way: the hash is not reversible and is not exported.
  Only the resolved boolean and its reason are returned to the client.
- Exposure records (`FlagExposureRecord`) store the key, the user id, the
  resolved boolean, the surface, and the time. They are used to measure rollout
  coverage and must not be joined to application content.
- Logging must not emit the cohort seed, which is a rollout-control secret.

## Migration

- Additive only. No existing page, module, or store is replaced, and
  `src/features/scholarships/index.ts` is untouched — import from
  `@/src/features/scholarships/flags`.
- Flags start disabled by default. A surface is enabled by an explicit
  definition, so shipping this module changes no user-visible behaviour until an
  owner writes one.
- The client fails closed against a backend that has not shipped
  `/scholarships/flags` yet, which is the correct pre-migration posture.
- To retire a flag later, switch `defaultEnabled` to `false`, keep the definition
  for one full cohort window, then delete the definition and the branch.

## Operational impact

- Five flags gate the scholarship surface. Turning `applications` off stops new
  submissions; turning `payouts` off stops disbursement actions. Neither
  affects data already written.
- Metrics to watch: fail-closed fallback rate (a sustained non-zero rate means
  the flag service is down, not that a rollout is broken), per-surface exposure
  counts during a staged rollout, and the share of users in each cohort.
- Alerts: any fail-closed evaluation on `payouts` in production is
  operational-impacting and should page the on-call.
- Cost: flag evaluation is one deterministic hash per surface per page load. No
  network call on the read path beyond the single `evaluateAll` fetch.

## Verify

- `npx vitest run src/features/scholarships/__tests__/flags.test.ts
  src/features/scholarships/flags` — deterministic hashing, allowlist
  precedence, fail-closed default, exposure records, and the component's
  loading / empty / error / permission states and ARIA wiring.
- `npx tsc --noEmit` — no errors in `src/features/scholarships/flags/`.
- Route smoke: open `/scholarships/flags` as `finance` and confirm the panel
  renders with write controls enabled; open as `student` and confirm the
  consistent access-denied state.
- Fail-closed smoke: point the client at an unreachable flag service and confirm
  every flag resolves to *Disabled* with a reason naming the failure.
