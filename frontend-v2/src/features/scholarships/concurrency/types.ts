/**
 * Optimistic concurrency for scholarship writes (closes #1152).
 *
 * Every scholarship resource carries a monotonically increasing `version`. A
 * write is only applied when the client's version still matches the server's;
 * otherwise the write is rejected wholesale as a `ConflictError` and nothing is
 * mutated. The union `ConcurrencyWriteResult` makes a half-applied write
 * unrepresentable — there is no third state in which some fields landed.
 */

export type VersionedResourceType = 'program' | 'application' | 'review' | 'award' | 'finance';

export type VersionedResource = {
  resourceType: VersionedResourceType;
  resourceId: string;
  version: number;
  updatedAt: string;
  updatedBy: string;
};

export type ConflictError = {
  code: 'VERSION_CONFLICT';
  resourceType: VersionedResourceType;
  resourceId: string;
  expectedVersion: number;
  actualVersion: number;
  conflictingFields: string[];
  serverUpdatedAt: string;
  message: string;
};

export type ConcurrencyWriteResult<T> =
  | { status: 'applied'; value: T }
  | { status: 'conflict'; conflict: ConflictError };

export type FieldDiff = {
  field: string;
  yours: unknown;
  theirs: unknown;
  base: unknown;
};

export type VersionedDocument = {
  resource: VersionedResource;
  fields: Record<string, unknown>;
};
