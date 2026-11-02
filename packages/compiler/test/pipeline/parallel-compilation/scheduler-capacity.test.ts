/**
 * @author Aidan Boissonneault
 * @file scheduler-capacity.test.ts
 * @purpose Tests scheduler capacity behavior in the pipeline parallel compilation in compiler package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import {
  SimulatedWorkerPool,
  validateSchedulerCapacity,
} from '../../../src/index.js';

const poolOptions = {
  maximumWorkerCount: 4,
  memoryPerWorkerMiB: 1024,
  memoryBudgetMiB: 4096,
};

describe('parallel scheduler capacity and persistent pool simulation', () => {
  it('uses only the healthy subset of a valid requested pool', () => {
    expect(
      validateSchedulerCapacity({
        requestedWorkerCount: 4,
        healthyWorkerCount: 2,
        ...poolOptions,
      }),
    ).toMatchObject({
      ok: true,
      effectiveWorkerCount: 2,
      memoryBoundWorkerCount: 4,
      issues: [],
    });
  });

  it('rejects unsupported counts and memory oversubscription', () => {
    expect(
      validateSchedulerCapacity({
        requestedWorkerCount: 5,
        healthyWorkerCount: 0,
        ...poolOptions,
      }),
    ).toMatchObject({ ok: false, effectiveWorkerCount: 0 });
    const memoryBound = validateSchedulerCapacity({
      requestedWorkerCount: 4,
      healthyWorkerCount: 0,
      ...poolOptions,
      memoryBudgetMiB: 3072,
    });
    expect(memoryBound.ok).toBe(false);
    expect(memoryBound.memoryBoundWorkerCount).toBe(3);
    expect(memoryBound.issues.join(' ')).toContain('exceeding');
  });

  it('retains ready workers across runs and reconciles settings cleanly', () => {
    const pool = new SimulatedWorkerPool(poolOptions);
    expect(pool.reconcile(2).ok).toBe(true);
    expect(pool.snapshot().map(({ state }) => state)).toEqual([
      'warming',
      'warming',
    ]);
    pool.snapshot().forEach((worker) => pool.markReady(worker.id));
    const originalIds = pool.snapshot().map(({ id }) => id);

    const leased = pool.acquire('first-compile');
    expect(leased).toBe(originalIds[0]);
    pool.release(leased!);
    expect(pool.snapshot().map(({ state }) => state)).toEqual([
      'ready',
      'ready',
    ]);
    expect(pool.snapshot().map(({ id }) => id)).toEqual(originalIds);

    expect(pool.reconcile(1).ok).toBe(true);
    expect(pool.snapshot()).toMatchObject([
      { id: originalIds[0], state: 'ready' },
      { id: originalIds[1], state: 'stopped' },
    ]);
    pool.shutdown();
    expect(pool.snapshot().every(({ state }) => state === 'stopped')).toBe(
      true,
    );
    expect(pool.capacity().effectiveWorkerCount).toBe(0);
  });

  it('drains a busy worker and replaces a failed worker without leaks', () => {
    const pool = new SimulatedWorkerPool(poolOptions);
    pool.reconcile(2);
    pool.snapshot().forEach((worker) => pool.markReady(worker.id));
    const first = pool.acquire('busy-task')!;
    const second = pool.snapshot().find(({ state }) => state === 'ready')!.id;
    pool.fail(second);
    pool.reconcile(2);
    const replacement = pool
      .snapshot()
      .find(({ state }) => state === 'warming');
    expect(replacement).toBeDefined();
    pool.markReady(replacement!.id);
    pool.shutdown();
    expect(pool.snapshot().find(({ id }) => id === first)?.state).toBe(
      'stopping',
    );
    pool.release(first);
    expect(pool.snapshot().find(({ id }) => id === first)?.state).toBe(
      'stopped',
    );
    expect(pool.snapshot().some(({ state }) => state === 'busy')).toBe(false);
  });
});
