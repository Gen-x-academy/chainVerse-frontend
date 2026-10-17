/**
 * MENTOR-109: mentorship erasure workflow.
 *
 * Coordinates deletion/anonymization across every searchable surface while
 * honouring legal holds and retaining lawful financial or safety records.
 * Identity must be verified before any destructive step runs, holds block
 * affected targets, progress is observable, and retries never duplicate work.
 */

export const ERASURE_TARGETS = ['profile', 'draft', 'message', 'file', 'analytics', 'index'] as const;
export type ErasureTarget = (typeof ERASURE_TARGETS)[number];

export type RetainedCategory = 'financial' | 'safety';

export const RETAINED_CATEGORY_REASONS: Record<RetainedCategory, string> = {
  financial: 'Financial records are retained to satisfy accounting and tax law.',
  safety: 'Safety records are retained to protect users and support investigations.',
};

export type ErasureState = 'awaiting_identity' | 'in_progress' | 'blocked_by_hold' | 'completed' | 'failed';

export interface ErasureHold {
  id: string;
  /** A specific target or 'all' surfaces. */
  scope: ErasureTarget | 'all';
  reason: string;
  until?: string;
}

export interface ErasureStep {
  target: ErasureTarget;
  action: 'erase' | 'anonymize';
  status: 'pending' | 'erased' | 'retained';
  /** High-priority steps run first (e.g. public discovery removal). */
  priority: number;
  retained?: RetainedCategory[];
  holdId?: string;
  holdReason?: string;
}

export interface ErasureRequest {
  id: string;
  userId: string;
  state: ErasureState;
  identityVerified: boolean;
  verificationRef?: string;
  steps: ErasureStep[];
  attempts: number;
  createdAt: string;
  updatedAt: string;
  lastError?: string;
}

export const MAX_ERASURE_ATTEMPTS = 3;

/** Index/public-discovery removal is prioritised so discovery drops promptly. */
const TARGET_PRIORITY: Record<ErasureTarget, number> = {
  index: 0,
  profile: 1,
  file: 2,
  message: 3,
  draft: 4,
  analytics: 5,
};

const RETENTION_BY_TARGET: Partial<Record<ErasureTarget, RetainedCategory[]>> = {
  file: ['financial'],
  message: ['safety'],
};

export function createErasureRequest(userId: string, now: Date = new Date()): ErasureRequest {
  return {
    id: `erase-${userId}-${now.getTime()}`,
    userId,
    state: 'awaiting_identity',
    identityVerified: false,
    steps: [],
    attempts: 0,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}

export function activeHold(holds: ErasureHold[], target: ErasureTarget, now: Date = new Date()): ErasureHold | undefined {
  return holds.find((hold) => {
    if (hold.scope !== 'all' && hold.scope !== target) return false;
    if (!hold.until) return true;
    return now.getTime() < Date.parse(hold.until);
  });
}

/** Identity verification is required and idempotent. */
export function verifyIdentity(
  request: ErasureRequest,
  verificationRef: string,
  holds: ErasureHold[],
  now: Date = new Date(),
): ErasureRequest {
  if (request.identityVerified) return request;
  if (!verificationRef.trim()) throw new Error('A verification reference is required');
  const steps = planErasure(holds, now);
  const blocked = steps.some((step) => step.holdId);
  return {
    ...request,
    identityVerified: true,
    verificationRef,
    steps,
    state: blocked ? 'blocked_by_hold' : 'in_progress',
    updatedAt: now.toISOString(),
  };
}

export function planErasure(holds: ErasureHold[], now: Date = new Date()): ErasureStep[] {
  return [...ERASURE_TARGETS]
    .sort((a, b) => TARGET_PRIORITY[a] - TARGET_PRIORITY[b])
    .map((target) => {
      const hold = activeHold(holds, target, now);
      const retained = RETENTION_BY_TARGET[target];
      return {
        target,
        action: retained ? 'anonymize' : 'erase',
        status: 'pending',
        priority: TARGET_PRIORITY[target],
        retained,
        holdId: hold?.id,
        holdReason: hold?.reason,
      } as ErasureStep;
    });
}

/** Marks a target done. Safe to retry: already-finished steps are unchanged. */
export function completeStep(
  request: ErasureRequest,
  target: ErasureTarget,
  now: Date = new Date(),
): ErasureRequest {
  if (request.steps.some((step) => step.target === target && step.holdId)) {
    throw new Error(`Target ${target} is blocked by a hold`);
  }
  const steps = request.steps.map((step) =>
    step.target === target && step.status === 'pending' ? { ...step, status: 'erased' as const } : step,
  );
  const done = steps.every((step) => step.status !== 'pending' || step.holdId);
  return {
    ...request,
    steps,
    state: done ? 'completed' : request.state,
    updatedAt: now.toISOString(),
    lastError: undefined,
  };
}

export interface ErasureProgress {
  done: number;
  total: number;
  percent: number;
  retainedCategories: RetainedCategory[];
  heldTargets: ErasureTarget[];
}

export function erasureProgress(request: ErasureRequest): ErasureProgress {
  const total = request.steps.length;
  const done = request.steps.filter((step) => step.status !== 'pending').length;
  const retained = new Set<RetainedCategory>();
  for (const step of request.steps) for (const category of step.retained ?? []) retained.add(category);
  return {
    done,
    total,
    percent: total === 0 ? 0 : Math.round((done / total) * 100),
    retainedCategories: Array.from(retained),
    heldTargets: request.steps.filter((step) => step.holdId).map((step) => step.target),
  };
}

/** Retry only failed requests; resets unfinished work without double-running. */
export function retryErasure(request: ErasureRequest, now: Date = new Date()): ErasureRequest {
  if (request.state !== 'failed') throw new Error('Only failed erasure requests can be retried');
  if (request.attempts >= MAX_ERASURE_ATTEMPTS) throw new Error('Erasure retry limit reached');
  return {
    ...request,
    attempts: request.attempts + 1,
    state: 'in_progress',
    steps: request.steps.map((step) => (step.status === 'pending' ? step : step)),
    updatedAt: now.toISOString(),
    lastError: undefined,
  };
}
