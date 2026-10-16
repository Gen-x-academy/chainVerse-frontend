/**
 * Mentorship identity public surface (MENTOR-008 … MENTOR-011).
 *
 * Each concern is exported from its own submodule so a consumer can import the
 * narrowest slice it needs:
 *
 * - `profiles` — mentor professional profiles (MENTOR-008)
 * - `mentee-profiles` — mentee learning profiles (MENTOR-009)
 * - `taxonomy` — mentor expertise taxonomy (MENTOR-010)
 * - `verification` — mentor identity verification (MENTOR-011)
 *
 * `access` and the shared page shell support the identity route pages.
 */
export * from './access';
export * from './nav';
export * from './profiles';
export * from './mentee-profiles';
export * from './taxonomy';
export * from './verification';
export { IdentityPageShell } from './components/IdentityPageShell';
