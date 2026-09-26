# Scholarships — funnel rates, bias audit, and proxy screening

Closes **#1144** and **#1145**. Route: `/scholarships/fairness`.
Module: `src/features/scholarships/fairness/`.

## What this is

Two guarantees in one report.

**Outcome reporting (#1144).** The application funnel — `eligible`, `started`,
`submitted`, `reviewed`, `decided`, `awarded` — is published as an accessible
table. Each row carries two rates: `rateFromPrevious` (stage conversion) and
`rateFromEligible`. Every published metric ships with a `FairnessDefinition`
holding a plain-language `definition` **and** a `caveat`, so a rate is never read
without its limits.

**Bias audit and proxy screening (#1145).** A `BiasAudit` is recorded per rule
version: owner, frozen test cohort, `disparateImpactRatio`, worst-affected
group, mitigations, and a `rollbackPlan`. `disparateImpactRatio(group, reference)`
divides the two selection rates; `evaluateDisparateImpact` flags a ratio below
**0.8** per the four-fifths (80%) rule, and also flags an implausibly high ratio
above 1.25. `auditOutcome` enforces the approval rule: a high-risk rule version
resolves to `changes-required` unless a named `approvedBy` **and** at least one
mitigation are recorded, so a failing audit cannot be cleared silently even if
the payload claims otherwise. `screenProxies` classifies every selection field as
`prohibited` (a direct identifier or a protected characteristic), `sensitive`
(a documented-justification proxy such as postcode or household income), or
`permissible`, each with a written reason and the surfaces it was detected in.

## Privacy

**No individual applicant is ever exposed.** This is a property of the data
shaping, not of the view:

- `MIN_COHORT_SIZE` is 10. `suppressCohort(size, threshold)` marks any cohort
  below it as suppressed.
- A suppressed `FunnelMetric` reports `count: 0`, `cohortSize: 0`, a `null`
  `rateFromPrevious`, and a `0` `rateFromEligible`, with
  `suppressedReason: 'SMALL_COHORT'`. The true count and the true cohort size are
  never emitted, so no downstream consumer — export, API response, or test
  fixture — can recover the number. The same applies to `buildCohortSlices`.
- A stage rate is withheld when either side of the ratio is suppressed, because a
  published conversion rate would otherwise leak the suppressed stage.
- `hasUnsuppressedIndividual` is the last guard before an export leaves the
  client: it rejects any payload that carries a direct identifier
  (`applicantId`, `studentId`, `name`, `email`, `applicationId`, `nationalId`) or
  an unsuppressed single-person cell.
- The UI renders a suppressed cell as `Suppressed (cohort < 10)` with an
  `aria-label` explaining why, and never as a number or a colour alone.
- Group-level reporting only: dimensions are `region`, `incomeBand`,
  `institution`, and `firstGeneration`. Small slices inside a dimension are
  suppressed by the same rule.

## Ownership

- **Code owner:** the platform/frontend foundation team.
- **Data owner:** the Academy equity and finance group; they own the funnel
  definitions and their caveats.
- **Approval owner:** the named `approvedBy` on a `BiasAudit`. The equity lead is
  the default approver for a high-risk rule version.
- **Review ownership:** changing `MIN_COHORT_SIZE`, the 0.8 threshold, or the
  `auditOutcome` approval rule requires the equity lead and the privacy reviewer.

## Migration

- Additive only: `/scholarships/fairness` is a new route; no existing page,
  store, or barrel is modified.
- The suppression threshold is `10` everywhere, so a consumer that already
  honoured `MIN_COHORT_SIZE` from the programme report needs no change. A
  consumer that used to publish cells of 1–9 must switch to the suppressed
  sentinel, which is a breaking change for those cells and an intentional one.
- Until the backend serves `/scholarships/fairness`, the report renders its
  loading, error, and empty states rather than seeded numbers.

## Operational impact

- Two suppression reasons exist: `SMALL_COHORT` and `NO_DATA`. `NO_DATA` means
  the source pipeline has not produced a figure yet; it is not a zero and is
  rendered as such.
- The funnel table is the accessible source of truth. Any chart added later must
  carry the same numbers and must not become the only representation.
- Metrics to watch: share of suppressed cells (a jump means a cohort got too
  small to report on), count of high-risk rule versions without an approver, and
  proxy-screen hits on `prohibited` fields.

## Verify

- `npx vitest run src/features/scholarships/__tests__/fairness.test.ts` —
  suppression (asserting the number is absent from the output), rate maths, the
  disparate-impact ratio and its 0.8 threshold, proxy screening, and the rule
  that a high-risk audit cannot be approved silently.
- `npx vitest run src/features/scholarships/fairness` — table semantics, the
  suppressed-cell `aria-label`, definition and caveat disclosure, and the
  rollback-plan field.
- Manual: run a round with a deliberate 9-applicant region and confirm the cell
  shows `Suppressed (cohort < 10)` with no number anywhere in the DOM.
