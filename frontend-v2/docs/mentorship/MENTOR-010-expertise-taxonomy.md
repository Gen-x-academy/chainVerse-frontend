# MENTOR-010 — Mentor expertise taxonomy

Closes #1257. Source: `src/features/mentorship/identity/taxonomy/`.
Shared work item: **MENTOR-010** (Identity track).

## What this is

A versioned tree of mentor skills. A skill has a **stable id** that filters and
stored preferences use; its label, slug, and aliases are display data that may
change. Deprecated skills keep their id and point at a replacement, so a stored
reference migrates forward instead of becoming a dead id.

## Aliases

`normalizeAlias` folds case, trims, collapses internal whitespace, and strips
edge punctuation. `buildAliasIndex` builds a map from every normalised
label/alias/slug to its node id and throws on the first duplicate, so a collision
can never silently shadow a skill. `resolveExpertiseId(input, nodes)` returns the
stable id for any label, alias, or slug — the UI never filters on the label.

## Integrity rules

`validateTaxonomy(nodes)` returns stable error codes:

| Code | Meaning |
| --- | --- |
| `DUPLICATE_ID` | two nodes share an id |
| `DUPLICATE_SLUG` | two nodes share a slug |
| `DUPLICATE_ALIAS` | an alias belongs to another node |
| `MISSING_PARENT` | `parentId` does not exist |
| `CYCLE` | a parent chain loops |
| `DEPRECATED_WITHOUT_REPLACEMENT` | a deprecated node has no `replacedBy` |
| `REPLACEMENT_NOT_FOUND` | `replacedBy` does not exist |

## Deprecation and migration

- `deprecateExpertise(node, replacementId, updatedAt)` retires a node in favour
  of its replacement.
- `migrateExpertiseId(id, nodes)` follows the `replacedBy` chain to a live node.
  A live reference is returned unchanged; an unknown id, a broken chain, or a
  replacement cycle returns `undefined`.

## Auditing

`auditTaxonomyChange(previous, next, editorId)` records the changed node ids with
the editor and time, so a taxonomy edit is reviewable.

## API

`mentorshipTaxonomyService` maps to `/mentorship/expertise-taxonomy`:
`list`, `upsert`, `deprecate`, and `changes`.

## Verify

```sh
npx vitest run src/features/mentorship/identity/__tests__/taxonomy.test.ts
npx tsc --noEmit
```
