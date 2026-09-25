import { describe, expect, it, vi } from 'vitest';
import {
  ScholarshipBackpressureError,
  ScholarshipBurstCoordinator,
  ScholarshipTenantBoundaryError,
} from '../load-testing';

describe('scholarship deadline burst coordinator', () => {
  it('accepts work once and returns the same result for a duplicate key', async () => {
    const coordinator = new ScholarshipBurstCoordinator('tenant-a', 2);
    const task = vi.fn(async () => 'application-1');

    const first = await coordinator.run('tenant-a', 'submit-1', task);
    const retry = await coordinator.run('tenant-a', 'submit-1', task);

    expect(first).toEqual({ status: 'accepted', value: 'application-1' });
    expect(retry).toEqual({ status: 'duplicate', value: 'application-1' });
    expect(task).toHaveBeenCalledOnce();
  });

  it('rejects saturated work without invoking the task', async () => {
    let release!: () => void;
    const blocked = new Promise<string>((resolve) => { release = () => resolve('done'); });
    const coordinator = new ScholarshipBurstCoordinator('tenant-a', 1, 500);
    const task = vi.fn(() => blocked);

    const first = coordinator.run('tenant-a', 'submit-1', task);
    const second = await coordinator.run('tenant-a', 'submit-2', task);

    expect(second.status).toBe('rejected');
    if (second.status === 'rejected') {
      expect(second.error).toBeInstanceOf(ScholarshipBackpressureError);
    }
    expect(task).toHaveBeenCalledOnce();
    release();
    await first;
  });

  it('blocks cross-tenant operations before work starts', () => {
    const coordinator = new ScholarshipBurstCoordinator('tenant-a');
    expect(() => coordinator.run('tenant-b', 'submit-1', async () => 'blocked')).toThrow(
      ScholarshipTenantBoundaryError
    );
  });
});