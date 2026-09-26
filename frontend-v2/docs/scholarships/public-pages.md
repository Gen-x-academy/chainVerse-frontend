# Public scholarship program pages (closes #1138)

## What this is

Shareable, indexable pages for scholarship programs that a sponsor has chosen to
publish. A program carries a visibility of `public`, `restricted`,
`invitation-only`, or `unpublished`, and publication is a **whitelist**:
`PUBLISHABLE_FIELD_KEYS` (`title`, `summary`, `description`, `sponsorName`,
`currency`, `awardAmountCents`, `applicationDeadline`, `eligibilitySummary`) is
the only set of program fields that can reach a page.

- Route: `/scholarships/public` (directory) and `/scholarships/public/[slug]`
  (page, with `generateMetadata` derived from the published page).
- Module: `src/features/scholarships/public-pages`
  (`types.ts`, `service.ts`, `components/ScholarshipPublicProgramPage.tsx`).
- API base path: `/scholarships/public`.

Pure functions: `toPublicPage`, `canPublish`, `publish`, `pageChecksum`,
`nextRevision`, `structuredDataFor`, `canonicalUrlFor`, `assertNoPrivateLeak`.

## Ownership

- **Code owner:** the platform/frontend foundation team.
- **Publication authority:** program administrators and sponsors. Only they may
  call `publicProgramService.publish`, and the API must re-check
  `canPublish` server-side — the frontend guard is a UX boundary only
  (ADR-001).
- **Review ownership:** feature-founder sign-off is required for any change to
  `PUBLISHABLE_FIELD_KEYS` or `PRIVATE_PROGRAM_FIELDS`, because widening the
  whitelist widens what is world-readable.

## Privacy

**No PII is emitted in public pages.** Specifically:

- Private program data (`internalNotes`, `selectionCriteria`, `applicantPool`,
  `reviewPanel`, applicant names, applicant emails) never reaches a
  `PublicProgramPage`. It is stripped before the page object is constructed — a
  non-publishable field is *never emitted and then hidden*, so no rendering path
  can accidentally reveal it.
- The JSON-LD payload (`structuredDataFor`) is derived from the already-redacted
  page, so search engines index nothing a signed-in user could not see.
- `assertNoPrivateLeak(page, program)` is the adversarial guard used in tests: it
  serialises the whole page (including the structured data) and raises if any
  private value, or any element of a private list, appears.
- `invitation-only` and `unpublished` programs are refused publication
  (`INVITATION_ONLY`, `UNPUBLISHED`) and the refused page carries no fields at
  all, so an unshared program cannot be probed through the public route.
- Money is integer minor units (`awardAmountCents`) with an explicit `currency`,
  formatted client-side with `Intl.NumberFormat`; currencies are never mixed.
- Applicant identity never appears on a public page: there are no applicant
  references, reviewer identities, or scores in the whitelist.

## Migration

- Additive only. No existing route, module, or store was changed; the new barrel
  `public-pages/index.ts` is imported directly and
  `src/features/scholarships/index.ts` is untouched.
- Pages are read-mostly. The only writes are `publish` and `unpublish`, both of
  which carry an `idempotencyKey`, and `unpublish` carries an
  `expectedRevision` so a concurrent publication cannot be clobbered.
- Each publication bumps `revision` and appends a `PublicPageRevision` with an
  FNV-1a `checksum` over the page content, so an unchanged republication is
  provably identical and a changed one is visible in the history list.
- Until the backend serves `/scholarships/public`, the route renders its
  loading/error/empty states rather than fixture data.

## Operational impact

- Fails softly: the slug route renders a `role="alert"` panel on a failed
  fetch instead of a 500, and the directory page isolates its own error.
- Refusals are explicit and non-colour-coded: a refused publication renders a
  heading and a `role="note"` next step, and the page declares
  `robots: { index: false }` via `generateMetadata` so an unpublished slug is
  not indexed.
- Metrics to watch: publication refusal rate by reason (a spike in
  `NO_PUBLISHABLE_FIELDS` suggests a field-mapping regression), and 404 rate on
  `/scholarships/public/[slug]` (usually a stale share link after an unpublish).

## Verify

- `npx vitest run src/features/scholarships/__tests__/public-pages.test.ts
  src/features/scholarships/public-pages` — whitelist enforcement, refusal
  reasons, revision/checksum stability, canonical URL, JSON-LD shape, and the
  component states (loading, empty, error, refused, published).
- Manual: publish a program, confirm the copyable canonical link, the JSON-LD
  disclosure, and the revision history; then set the program to
  `invitation-only` and confirm the page shows "not available publicly" with no
  field values.
