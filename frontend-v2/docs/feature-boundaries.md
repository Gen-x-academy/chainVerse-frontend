# Feature Boundaries (issue #822)

`src/features/*` modules can currently import any file from any other
feature, including private internals, making cross-feature cycles easy to
introduce by accident.

## Rule

- A feature may only import from another feature's **public entrypoint**
  (`src/features/<name>/index.ts`), never from its internal `components/`,
  `hooks/`, or `services/` subfolders directly.
- Shared code that multiple features need belongs in `src/lib`, `src/hooks`,
  or `src/services` — not in another feature.
- Dependency direction is one-way: `app/` and `src/app/` routes may import
  features; features may import shared layers; shared layers may not import
  features.

## Enforcement (next step)

Wire this up with `eslint-plugin-import`'s `no-restricted-paths`, restricting
each `src/features/<name>` zone to only `src/features/<name>/index.ts` in
other zones. That dependency isn't installed yet, so this doc captures the
agreed rule first; the lint rule is a follow-up once the plugin is added.
