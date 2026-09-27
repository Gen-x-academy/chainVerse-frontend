# Scholarships — WCAG conformance audit

Closes **#1143**. Route: `/scholarships/accessibility`.
Module: `src/features/scholarships/accessibility/`.

## What this is

A tracked conformance audit for the five scholarship journeys, not a generic
checklist page. `WCAG_SEED_CRITERIA` is a curated list of 27 real WCAG 2.1 level
A/AA success criteria mapped to a journey, each carrying a `status`, an
`automated` flag (whether a tool can decide it), `evidence`, and `lastCheckedAt`.

Journeys: **discovery**, **complex-forms**, **review-rubric**,
**financial-tables**, **status-updates**. The seed list covers 1.1.1, 1.3.1,
1.3.2, 1.4.3, 1.4.4, 1.4.10, 1.4.11, 1.4.13, 2.1.1, 2.1.2, 2.1.4, 2.4.1, 2.4.2,
2.4.3, 2.4.4, 2.4.6, 2.4.7, 2.4.11, 3.2.1, 3.2.2, 3.2.3, 3.2.4, 3.3.1, 3.3.2,
3.3.3, 3.3.4, 4.1.2, and 4.1.3.

Pure functions:

- `summariseAccessibility(results)` — totals plus `blockingFailures`, the failing
  criteria at level A or AA. Those are the release gate.
- `evaluateContrast(foreground, background)` — WCAG 2.1 relative luminance and
  contrast ratio, 1:1 to 21:1, rounded to two decimals. `#000` on `#fff` is
  exactly 21; `#767676` on `#ffffff` is 4.54:1 (the canonical smallest passing
  grey); `#9a9a9a` on `#ffffff` is 2.85:1 and fails AA.
- `meetsContrast(ratio, level, isLargeText)` — 4.5:1 normal / 3:1 large at AA,
  7:1 normal / 4.5:1 large at AAA.
- `validateFocusOrder(expected, actual)` and `focusOrderIsSequential(order)` —
  report missing stops, unexpected stops, and an order that does not follow the
  reading order.
- `describeCriterion(id)` and `blockingCriteria(level)`.

`ScholarshipAccessibilityAudit` renders a real `<table>` with a `<caption>` and
`<th scope>` per column, a per-journey filter, an inline contrast checker, a
blocking-failure summary, a run-checks action, and loading/empty/error/
permission states. `A11yStatusBadge` is the reusable status chip: it always pairs
a glyph with a word, so a pass/fail is never communicated by colour alone.

## Ownership

- **Code owner:** the platform/frontend foundation team.
- **Audit owner:** the accessibility owner named in the run-checks idempotency
  key; the equity and finance representatives sign off on manual results.
- **Review ownership:** adding or removing a criterion, or weakening the
  blocking rule, needs the accessibility owner's approval.

## Privacy

- Audit results hold criterion ids, evidence strings, and timestamps. Evidence is
  expected to describe a rendering (for example a measured contrast ratio), never
  a screenshot containing applicant data.
- The contrast checker runs entirely in the browser on two colour values; no
  applicant data is involved.

## Migration

- Additive only: `/scholarships/accessibility` is a new route and no existing
  page, store, or barrel is modified.
- The seed list is the baseline. A criterion is only marked `not-applicable` with
  a written justification, so the audit total never silently shrinks.

## Operational impact

- `run-checks` sends an idempotency key, so a retried run cannot double-count a
  criterion. A failed run leaves the previous results in place and shows an
  inline alert.
- `automatedCoverage` is reported explicitly: a high pass count with low
  automated coverage means the manual backlog is not really green.
- Metrics to watch: count of blocking failures per release, and the share of
  criteria still `untested`.

## Verify

- `npx vitest run src/features/scholarships/__tests__/accessibility.test.ts` —
  contrast maths against known ratios, `meetsContrast` for normal and large
  text, summary counts, and focus-order validation.
- `npx vitest run src/features/scholarships/accessibility` — table semantics
  (`getByRole('table')`, `getByRole('columnheader')`), the journey filter, the
  contrast checker, and the status badge not being colour-only.
- Manual: run axe against each journey route and record the evidence strings in
  the audit.
