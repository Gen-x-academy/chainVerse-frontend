# MENTOR-007: Deterministic seed data

| Field | Value |
| --- | --- |
| Work item | MENTOR-007 |
| Issue | #1254 |
| Owner | Memplethee-lab |
| Depends on | MENTOR-001 (identifiers, states), MENTOR-004 (engagement states), MENTOR-006 (money) |

## Scope

A deterministic dataset that makes every mentorship flow demonstrable in local
development and tests, without a backend: enrollment, matching, sessions,
deliverables, settlement, and disputes - including the sparse, edge, and
terminal states an empty environment would never show.

## Module

`src/features/mentorship/seed/dataset.ts`, exported from
`src/features/mentorship/seed/index.ts`.

- `buildMentorshipSeedDataset(options)` - deterministic (mulberry32 PRNG, fixed
  timestamps). Same `seed`, deep-equal dataset; a different seed produces a
  different one.
- `resetMentorshipSeedData()` - clears persisted mentorship state and rebuilds
  the default dataset (`seed: 7`) in one step.
- `clearPersistedMentorshipState(storage?)` - removes every
  `chainverse-mentorship-` key from local storage, so a reset truly leaves no
  global state behind. Storage is injectable for tests.
- `seedDataIsSynthetic(dataset)` / `engagementIdsAreWellFormed(dataset)` -
  invariants used by the tests and the dev console page.

## What the dataset contains

Organizations, mentors, mentees, and programs, plus one engagement per mentor
pair that draws its status from every state of the MENTOR-004 engagement
machine (proposed, accepted, active, completed, declined, withdrawn,
cancelled, disputed), a session and deliverable per engagement drawing on the
session and deliverable state lists, payments in MENTOR-006 money for the
engagements that carry financial state, and disputes for the disputed
engagements.

## Guarantees

1. **Deterministic.** Fixed PRNG and fixed ISO instants keep the dataset
   byte-identical across rebuilds with the same seed.
2. **No real personal data.** Names come from fixed synthetic pools, nothing
   in the dataset contains an email address, and every identifier is an
   opaque, aggregate-prefixed MENTOR-001 id (`mtr_`, `mte_`, `prg_`, `eng_`,
   `ses_`, `dlv_`, `pay_`, `dsp_`).
3. **Reset is clean.** Only storage keys under `chainverse-mentorship-` are
   removed; unrelated keys survive.
4. **Versioned.** `MENTORSHIP_SEED_VERSION` lets fixtures and tests pin the
   shape they were written against.

## Route

`/mentorship/seed` (administrator only) renders dataset counts, exercises the
determinism guarantee, and exposes the reset action.

## Tests

`seed/__tests__/dataset.test.ts` covers determinism, seed sensitivity, full
engagement-state coverage, well-formed ids, integer minor-unit money, the
synthetic-data invariant, and the storage reset boundary.
