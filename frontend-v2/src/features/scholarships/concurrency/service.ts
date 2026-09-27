/**
 * Conflict detection, field diffing, and safe rebasing (closes #1152).
 *
 * Nothing in this module mutates its inputs. `applyOptimistic` works on a clone
 * and `commitWrite` either returns a new value or a conflict, so a caller can
 * never observe a partially applied write.
 */

import { apiClient } from '@/src/lib/api-client';
import type {
  ConcurrencyWriteResult,
  ConflictError,
  FieldDiff,
  VersionedDocument,
  VersionedResource,
  VersionedResourceType,
} from './types';

const CONCURRENCY_PATH = '/scholarships/concurrency';

function identityMismatch(
  base: VersionedResource,
  incoming: VersionedResource,
  server: VersionedResource
): boolean {
  return (
    base.resourceType !== incoming.resourceType ||
    base.resourceType !== server.resourceType ||
    base.resourceId !== incoming.resourceId ||
    base.resourceId !== server.resourceId
  );
}

function fieldNames(
  payloads: Record<string, unknown>[],
  selected: (keyof Record<string, unknown>)[] | null
): string[] {
  const [base, incoming, server] = payloads;
  const names = selected ?? (Object.keys({ ...base, ...incoming, ...server }) as (keyof Record<string, unknown>)[]);
  return names
    .filter((name) => JSON.stringify(incoming[name] ?? null) !== JSON.stringify(server[name] ?? null))
    .map((name) => String(name))
    .sort((left, right) => left.localeCompare(right));
}

/**
 * Returns the conflict when the write was made against a version the server has
 * already moved past, otherwise `null`. `incoming` is the write attempt — its
 * `version` is the version the client still held.
 */
export function detectConflict(
  base: VersionedResource,
  incoming: VersionedResource,
  server: VersionedResource,
  payloads?: {
    base: Record<string, unknown>;
    incoming: Record<string, unknown>;
    server: Record<string, unknown>;
  }
): ConflictError | null {
  if (incoming.version === server.version && !identityMismatch(base, incoming, server)) {
    return null;
  }

  const conflictingFields = payloads
    ? fieldNames([payloads.base, payloads.incoming, payloads.server], null)
    : [];

  const detail = identityMismatch(base, incoming, server)
    ? 'The write targeted a different resource than the one the client loaded.'
    : `The server is at version ${server.version} but the write was made against version ${incoming.version}.`;

  return {
    code: 'VERSION_CONFLICT',
    resourceType: server.resourceType,
    resourceId: server.resourceId,
    expectedVersion: incoming.version,
    actualVersion: server.version,
    conflictingFields,
    serverUpdatedAt: server.updatedAt,
    message: `Nothing was saved. ${detail} Last changed by ${server.updatedBy} at ${server.updatedAt}.`,
  };
}

/**
 * Field-by-field comparison of "yours" against "theirs", with the common base
 * so the operator can tell a genuine clash from a field only one side touched.
 */
export function buildFieldDiffs(
  base: Record<string, unknown>,
  incoming: Record<string, unknown>,
  server: Record<string, unknown>
): FieldDiff[] {
  return fieldNames([base, incoming, server], null).map((name) => ({
    field: name,
    yours: incoming[name] ?? null,
    theirs: server[name] ?? null,
    base: base[name] ?? null,
  }));
}

export function describeConflict(conflict: ConflictError): string {
  const fields = conflict.conflictingFields.length
    ? conflict.conflictingFields.join(', ')
    : 'no differing fields reported';
  return `Save rejected for ${conflict.resourceType} ${conflict.resourceId}: expected version ${conflict.expectedVersion}, server is at ${conflict.actualVersion} (differences: ${fields}). Reload the server value or keep yours and rebase.`;
}

/**
 * Applies a local edit without touching the caller's state. The draft is a
 * structural clone, so a throwing mutator leaves the original object intact.
 */
export function applyOptimistic<T>(state: T, mutator: (draft: T) => T): T {
  const draft = structuredClone(state);
  return mutator(draft);
}

/**
 * Re-applies the client's own values on top of the current server values.
 * Fields the client did not send keep the server's value, so a rebase never
 * resurrects a stale field the operator has already moved on from.
 */
export function rebaseOntoServer<T extends Record<string, unknown>>(incoming: T, server: T): T {
  return { ...server, ...incoming };
}

/**
 * The single entry point for a write: applied or conflict, never a mixture.
 */
export function commitWrite<T extends Record<string, unknown>>(input: {
  base: VersionedResource;
  incoming: VersionedResource;
  server: VersionedResource;
  fields: T;
  serverFields?: Record<string, unknown>;
  now?: Date;
}): ConcurrencyWriteResult<T & { version: number; updatedAt: string }> {
  const conflict = detectConflict(input.base, input.incoming, input.server, {
    base: {},
    incoming: input.fields,
    server: input.serverFields ?? input.fields,
  });

  if (conflict) {
    return { status: 'conflict', conflict };
  }

  return {
    status: 'applied',
    value: {
      ...input.fields,
      version: input.server.version + 1,
      updatedAt: (input.now ?? new Date()).toISOString(),
    },
  };
}

export const scholarshipConcurrencyService = {
  load: (
    resourceType: VersionedResourceType,
    resourceId: string
  ): Promise<VersionedDocument | null> =>
    apiClient.get<VersionedDocument | null>(
      `${CONCURRENCY_PATH}/${encodeURIComponent(resourceType)}/${encodeURIComponent(resourceId)}`
    ),

  save: (document: VersionedDocument, expectedVersion: number): Promise<VersionedDocument> =>
    apiClient.post<VersionedDocument>(`${CONCURRENCY_PATH}/writes`, {
      resource: document.resource,
      fields: document.fields,
      expectedVersion,
    }),
};
