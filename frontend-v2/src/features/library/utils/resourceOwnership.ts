const ID_PATTERN = /^[a-zA-Z0-9_-]{6,64}$/;

export type ResourceAccessResult = "allowed" | "forbidden" | "not-found" | "invalid";

export interface ResourceAccessCheck {
  resourceId: string;
  ownerId: string | null;
  currentUserId: string;
  resourceExists: boolean;
}

/** Validates a route identifier without trusting client-supplied ownership claims. */
export function isValidResourceId(resourceId: string): boolean {
  return ID_PATTERN.test(resourceId);
}

/**
 * Determines access outcome server-side rules should mirror: malformed IDs
 * never trigger a request, and missing resources look identical to forbidden
 * ones so existence isn't leaked to unauthorized users.
 */
export function resolveResourceAccess({
  resourceId,
  ownerId,
  currentUserId,
  resourceExists,
}: ResourceAccessCheck): ResourceAccessResult {
  if (!isValidResourceId(resourceId)) return "invalid";
  if (!resourceExists) return "not-found";
  if (ownerId !== currentUserId) return "forbidden";
  return "allowed";
}
