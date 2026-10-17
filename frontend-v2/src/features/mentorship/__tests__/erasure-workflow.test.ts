import { describe, expect, it } from 'vitest';
import {
  completeStep,
  createErasureRequest,
  erasureProgress,
  planErasure,
  retryErasure,
  verifyIdentity,
  type ErasureRequest,
} from '../privacy/erasure-workflow';

describe('MENTOR-109 erasure workflow', () => {
  it('requires verified identity before any destructive step', () => {
    const request = createErasureRequest('user-1');
    expect(request.state).toBe('awaiting_identity');
    expect(request.steps).toEqual([]);
    expect(() => verifyIdentity(request, '  ', [])).toThrow(/verification reference/i);
    const verified = verifyIdentity(request, 'idv-123', []);
    expect(verified.identityVerified).toBe(true);
    expect(verified.state).toBe('in_progress');
    expect(verifyIdentity(verified, 'idv-999', [])).toBe(verified);
  });

  it('prioritises public discovery removal and retains lawful categories', () => {
    const steps = planErasure([]);
    expect(steps[0].target).toBe('index');
    const retained = steps.flatMap((step) => step.retained ?? []);
    expect(retained).toContain('financial');
    expect(retained).toContain('safety');
  });

  it('honours holds and surfaces them in progress without destructive effects', () => {
    const verified = verifyIdentity(createErasureRequest('user-1'), 'idv-1', [
      { id: 'hold-1', scope: 'index', reason: 'litigation hold' },
    ]);
    expect(verified.state).toBe('blocked_by_hold');
    expect(() => completeStep(verified, 'index')).toThrow(/blocked by a hold/i);
    const progress = erasureProgress(verified);
    expect(progress.heldTargets).toContain('index');
    expect(progress.retainedCategories.length).toBeGreaterThan(0);
  });

  it('observes progress and completes without duplicate effects on retry', () => {
    let request: ErasureRequest = verifyIdentity(createErasureRequest('user-1'), 'idv-1', []);
    request = completeStep(request, 'index');
    expect(erasureProgress(request).done).toBe(1);
    const again = completeStep(request, 'index');
    expect(again).toEqual(request);
    for (const step of request.steps) request = completeStep(request, step.target);
    expect(request.state).toBe('completed');
    expect(() => retryErasure(request)).toThrow(/only failed/i);
  });
});
