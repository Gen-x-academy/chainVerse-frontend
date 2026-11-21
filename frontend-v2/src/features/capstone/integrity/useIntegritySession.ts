'use client';

import { useAuthStore } from '../../../store/authStore';

export type IntegrityCapability =
  | 'integrity:checks:read'
  | 'integrity:checks:request'
  | 'integrity:checks:review'
  | 'integrity:screening:read'
  | 'integrity:screening:create'
  | 'integrity:screening:decide'
  | 'integrity:reports:read'
  | 'integrity:reports:submit'
  | 'integrity:reports:triage'
  | 'integrity:disputes:read'
  | 'integrity:disputes:file'
  | 'integrity:disputes:decide';

/**
 * Role-aware session for the integrity workspace. Server-granted workspace
 * roles are mapped to capabilities; a missing tenant, identity or role always
 * denies access (deny-by-default).
 */
const ROLE_CAPABILITIES: Record<string, readonly IntegrityCapability[]> = {
  owner: ['integrity:checks:read', 'integrity:checks:request', 'integrity:screening:read', 'integrity:screening:create', 'integrity:reports:read', 'integrity:reports:submit', 'integrity:disputes:read', 'integrity:disputes:file'],
  manager: ['integrity:checks:read', 'integrity:checks:request', 'integrity:screening:read', 'integrity:screening:create', 'integrity:reports:read', 'integrity:reports:submit', 'integrity:disputes:read', 'integrity:disputes:file'],
  contributor: ['integrity:checks:read', 'integrity:checks:request', 'integrity:screening:read', 'integrity:screening:create', 'integrity:reports:submit', 'integrity:disputes:read', 'integrity:disputes:file'],
  reviewer: ['integrity:checks:read', 'integrity:checks:review', 'integrity:screening:read', 'integrity:reports:read', 'integrity:reports:triage', 'integrity:disputes:read', 'integrity:disputes:decide'],
  approver: ['integrity:checks:read', 'integrity:checks:review', 'integrity:screening:read', 'integrity:screening:decide', 'integrity:reports:read', 'integrity:reports:triage', 'integrity:disputes:read', 'integrity:disputes:decide'],
  observer: ['integrity:checks:read', 'integrity:screening:read', 'integrity:reports:read', 'integrity:disputes:read'],
};

export function useIntegritySession() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);
  const roles = useAuthStore((state) => state.workspaceRoles);

  const can = (capability: IntegrityCapability): boolean =>
    Boolean(
      isAuthenticated &&
        user?.id &&
        user.tenantId &&
        roles.some((role) => ROLE_CAPABILITIES[role]?.includes(capability)),
    );

  return {
    actorId: user?.id ?? null,
    tenantId: user?.tenantId ?? null,
    isAuthenticated,
    can,
  };
}
