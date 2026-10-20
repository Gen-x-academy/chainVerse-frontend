/**
 * Mentorship feature public surface.
 *
 * Cross-feature imports must use this entrypoint only (see
 * `docs/feature-boundaries.md`). The vocabulary (MENTOR-001), capability
 * configuration (MENTOR-002), and role/permission matrix (MENTOR-003) live
 * here; the identity modules (MENTOR-008…011) are exported from their own
 * submodules to keep this barrel from widening the dependency graph.
 */
export * from "./glossary";
export * from "./rbac";
export * from "./config";
export * from "./components";
export * from "./operations";
export * from "./summaries";
