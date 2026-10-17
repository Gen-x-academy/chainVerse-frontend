# MENTOR-005: Stable public identifiers

| Field | Value |
| --- | --- |
| Work item | MENTOR-005 |
| Issue | #1252 |
| Owner | Memplethee-lab |
| Depends on | MENTOR-001 (identifier shape, OP-4) |

## Scope

Stable, public identifiers for every mentorship record. The glossary
(MENTOR-001, OP-4) owns the `aggregate_prefix` shape (`mtr_<opaque>`,
`eng_<opaque>`, ...); this module owns producing the opaque part safely.

## Guarantees

1. **Never display-derived.** The opaque part comes from non-personal source
   keys only. `opaqueIsDisplayLike` and `assertNotDisplayDerived` reject
   email-like, name-like, and blank values before they can enter an
   identifier, so renaming a person or organization never orphans a record
   and no personal data leaks into a public id.
2. **Stable across exports and replays.** `buildStablePublicId` hashes the
   backend source key (a UUID or numeric key) deterministically: the same
   source key always produces the same public id, so CSV re-exports and
   replays stay aligned.
3. **Collision-resistant generation.** `generateMentorshipOpaqueId` mixes a
   UUID (with a timestamp-plus-counter fallback for deterministic test
   environments); `generateMentorshipId` wraps it in the canonical prefix.
4. **Searchable without exposing identity.** `deriveCorrelationId` pairs every
   public id with a deterministic correlation id used to group retries and
   event logs, and `isStablePublicId` re-uses the glossary validator so UI and
   logs can trust the shape.

## Module

`src/features/mentorship/public-identifiers.ts`

- `MENTORSHIP_IDENTIFIER_VERSION` - identifier scheme version.
- `buildStablePublicId(aggregate, { apiKey })`.
- `generateMentorshipId(aggregate)` / `generateMentorshipOpaqueId()`.
- `isStablePublicId(aggregate, value)`.
- `deriveCorrelationId(publicId)`.
- `opaqueIsDisplayLike(value)` / `assertNotDisplayDerived(aggregate, opaque)`.

## Migration

Records created before this module used raw database keys behind the prefix.
New writes MUST go through `buildStablePublicId` or `generateMentorshipId`;
read paths accept both, since `isMentorshipId` validates the shape for
aggregates either way. A backend migration re-keys old rows to derived ids
one aggregate at a time.

## Tests

`__tests__/public-identifiers.test.ts` covers determinism, collision
resistance of generated keys, glossary shape validity for every aggregate,
rejection of display-derived opaque values, and correlation-id pairing.
