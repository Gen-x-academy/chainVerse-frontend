# Student scholarship dashboard (`closes #1132`)

## What this is

A student-facing journey dashboard at `/scholarships/dashboard/student`. One
tile per step: programs, applications, decisions, awards, milestones, payments.

Two properties matter more than the layout:

- **Counts are authoritative.** Each count carries its own `asOf` timestamp and
  `source` (`api`, `cached`, `unavailable`). "0 open milestones" is never
  confused with "milestones could not be loaded".
- **Partial failure is isolated.** The dashboard is built from independent parts
  (`studentDashboardService.getParts`); one failing part marks exactly one
  section `error`, with a retry for that section only, while every other section
  stays `ready`.

A count of zero gives the section `status: 'empty'` and a `nextStep` link, so a
student is never left at a dead end.

## Ownership

- **Code owner:** the platform/frontend foundation team
  (`src/features/scholarships/dashboards/student/**`).
- **Access:** the student the dashboard belongs to. The `allowed` prop is a UX
  guard only; the API must scope every count to `studentId`.
- **Data ownership:** the student's own application and award records.

## Privacy

- The dashboard is scoped to one `studentId` server side. Cross-student counts
  are a data incident, not a UI bug.
- Reviewer identities and internal notes are never present in a count source, so
  they cannot leak through this surface.
- `asOf` timestamps reveal only when data was read, not who read it.

## Migration

- Additive only; no existing page is replaced and the scholarships barrel is
  untouched. The dashboard reads
  `/scholarships/dashboard/student/{studentId}/{resource}` per resource, so a
  resource that is not implemented yet degrades to a single errored tile rather
  than an outage.

## Operational impact

- Six small requests per dashboard load. Watch per-resource failure rate: a
  resource that is always failing is a service regression, not a UI problem.
- Stale counts (`staleCount`, 300s default) are labelled as possibly lagging
  rather than presented as fact.

## Verify

```bash
npx vitest run src/features/scholarships/__tests__/student-dashboard.test.ts \
  src/features/scholarships/dashboards/student
npx tsc --noEmit 2>&1 | grep -E "src/features/scholarships/dashboards/student/"  # expect nothing
```

Route smoke: `/scholarships/dashboard/student` — fail the milestones endpoint
and expect exactly one errored tile with its own retry.
