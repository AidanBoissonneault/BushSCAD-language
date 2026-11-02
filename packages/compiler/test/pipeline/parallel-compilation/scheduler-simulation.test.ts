/**
 * @author Aidan Boissonneault
 * @file scheduler-simulation.test.ts
 * @purpose Tests scheduler simulation behavior in the pipeline parallel compilation in compiler package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import {
  SimulatedWorkerPool,
  simulateCompilationSchedule,
} from '../../../src/index.js';
import { SchedulerResourceLocks } from '../../../src/pipeline/parallel-compilation/scheduler-resource-locks.js';
import {
  readyWorkerPool,
  schedulerEdge,
  schedulerGraph,
  schedulerNode,
} from '../../fixtures/parallel-compilation/scheduler-graphs.js';

/**
 * Handles delay in the pipeline parallel compilation flow.
 */
const delay = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

describe('parallel compilation scheduler simulation', () => {
  it('releases dependencies, overlaps readers, respects the cap, and orders artifacts', async () => {
    const source = schedulerNode('source', 0, {
      estimatedCost: 'metadata',
      writes: ['shared'],
    });
    const left = schedulerNode('left', 1, { reads: ['shared'] });
    const right = schedulerNode('right', 2, { reads: ['shared'] });
    const output = schedulerNode('output', 3, { estimatedCost: 'metadata' });
    const graph = schedulerGraph(
      [source, left, right, output],
      [
        schedulerEdge('source', 'left', 'shape', 'shared'),
        schedulerEdge('source', 'right', 'shape', 'shared'),
        schedulerEdge('left', 'output'),
        schedulerEdge('right', 'output'),
      ],
    );
    const pool = readyWorkerPool(2);
    const completed = new Set<string>();
    let activeGeometry = 0;
    let observedGeometryMaximum = 0;
    const result = await simulateCompilationSchedule(
      graph,
      { workerPool: pool, metadataConcurrency: 2 },
      async ({ node, workerId }) => {
        for (const dependency of node.dependencies)
          expect(completed.has(dependency)).toBe(true);
        if (workerId) {
          activeGeometry++;
          observedGeometryMaximum = Math.max(
            observedGeometryMaximum,
            activeGeometry,
          );
        }
        await delay(node.id === 'left' ? 8 : 1);
        if (workerId) activeGeometry--;
        completed.add(node.id);
        return { kind: 'completed', artifact: node.id };
      },
    );

    expect(result.ok).toBe(true);
    expect(observedGeometryMaximum).toBe(2);
    expect(result.metrics.maximumGeometryConcurrency).toBe(2);
    expect(result.metrics.effectiveWorkerCount).toBe(2);
    expect(result.artifacts.map(({ nodeId }) => nodeId)).toEqual([
      'source',
      'left',
      'right',
      'output',
    ]);
    expect(result.workerSnapshot.map(({ state }) => state)).toEqual([
      'ready',
      'ready',
    ]);

    const second = await simulateCompilationSchedule(
      graph,
      { workerPool: pool },
      ({ node }) => ({ kind: 'completed', artifact: node.id }),
    );
    expect(second.ok).toBe(true);
    expect(second.workerSnapshot.map(({ id }) => id)).toEqual(
      result.workerSnapshot.map(({ id }) => id),
    );
  });

  it('continues independent work and cancels only failed dependents', async () => {
    const nodes = [
      schedulerNode('source', 0, { estimatedCost: 'metadata' }),
      schedulerNode('fails', 1),
      schedulerNode('survives', 2),
      schedulerNode('failed-dependent', 3),
      schedulerNode('independent-dependent', 4),
      schedulerNode('output', 5, { estimatedCost: 'metadata' }),
    ];
    const graph = schedulerGraph(nodes, [
      schedulerEdge('source', 'fails'),
      schedulerEdge('source', 'survives'),
      schedulerEdge('fails', 'failed-dependent'),
      schedulerEdge('survives', 'independent-dependent'),
      schedulerEdge('failed-dependent', 'output'),
      schedulerEdge('independent-dependent', 'output'),
    ]);
    const executed: string[] = [];
    const result = await simulateCompilationSchedule(
      graph,
      { workerPool: readyWorkerPool(2) },
      async ({ node }) => {
        executed.push(node.id);
        if (node.id === 'fails') return { kind: 'failed', message: 'boom' };
        if (node.id === 'survives') await delay(2);
        return { kind: 'completed', artifact: node.id };
      },
    );

    expect(result.ok).toBe(false);
    expect(result.errors).toMatchObject([
      { code: 'task-failed', nodeId: 'fails', message: 'boom' },
    ]);
    expect(executed).toContain('independent-dependent');
    expect(executed).not.toContain('failed-dependent');
    expect(result.nodes).toMatchObject([
      { nodeId: 'source', status: 'completed' },
      { nodeId: 'fails', status: 'failed' },
      { nodeId: 'survives', status: 'completed' },
      { nodeId: 'failed-dependent', status: 'cancelled' },
      { nodeId: 'independent-dependent', status: 'completed' },
      { nodeId: 'output', status: 'cancelled' },
    ]);
  });

  it('publishes cascading cache hits without consuming geometry slots', async () => {
    const first = schedulerNode('cached-first', 0, { cacheSafe: true });
    const second = schedulerNode('cached-second', 1, { cacheSafe: true });
    const output = schedulerNode('output', 2, { estimatedCost: 'metadata' });
    const graph = schedulerGraph(
      [first, second, output],
      [schedulerEdge(first.id, second.id), schedulerEdge(second.id, output.id)],
    );
    const calls: string[] = [];
    const result = await simulateCompilationSchedule(
      graph,
      {
        workerPool: readyWorkerPool(1),
        cachedArtifacts: new Map([
          [first.id, 'first-artifact'],
          [second.id, 'second-artifact'],
        ]),
      },
      ({ node }) => {
        calls.push(node.id);
        return { kind: 'completed', artifact: node.id };
      },
    );

    expect(result.ok).toBe(true);
    expect(calls).toEqual(['output']);
    expect(result.metrics).toMatchObject({
      cacheHitCount: 2,
      dispatchedTaskCount: 1,
      maximumGeometryConcurrency: 0,
    });
    expect(result.artifacts.map(({ cacheHit }) => cacheHit)).toEqual([
      true,
      true,
      false,
    ]);
  });

  it('cancels pending and running simulation work and returns workers to ready', async () => {
    const controller = new AbortController();
    const graph = schedulerGraph(
      [
        schedulerNode('source', 0, { estimatedCost: 'metadata' }),
        schedulerNode('left', 1),
        schedulerNode('right', 2),
        schedulerNode('output', 3, { estimatedCost: 'metadata' }),
      ],
      [
        schedulerEdge('source', 'left'),
        schedulerEdge('source', 'right'),
        schedulerEdge('left', 'output'),
        schedulerEdge('right', 'output'),
      ],
    );
    const result = await simulateCompilationSchedule(
      graph,
      { workerPool: readyWorkerPool(2), signal: controller.signal },
      async ({ node }) => {
        if (node.id === 'left') controller.abort();
        await delay(1);
        return { kind: 'completed' };
      },
    );

    expect(result.cancelled).toBe(true);
    expect(result.ok).toBe(false);
    expect(result.nodes.map(({ status }) => status)).toEqual([
      'completed',
      'cancelled',
      'cancelled',
      'cancelled',
    ]);
    expect(result.workerSnapshot.every(({ state }) => state === 'ready')).toBe(
      true,
    );
  });

  it('rejects geometry execution when no worker has reached ready', async () => {
    const pool = new SimulatedWorkerPool({
      maximumWorkerCount: 4,
      memoryPerWorkerMiB: 1024,
      memoryBudgetMiB: 4096,
    });
    pool.reconcile(1);
    let called = false;
    const result = await simulateCompilationSchedule(
      schedulerGraph([schedulerNode('geometry', 0)], []),
      { workerPool: pool },
      () => {
        called = true;
        return { kind: 'completed' };
      },
    );
    expect(called).toBe(false);
    expect(result.errors[0]?.message).toContain('No ready healthy');
  });
});

describe('scheduler logical resource locks', () => {
  it('allows concurrent readers and excludes readers or writers during a write', () => {
    const locks = new SchedulerResourceLocks();
    const firstReader = schedulerNode('reader-a', 0, { reads: ['shape'] });
    const secondReader = schedulerNode('reader-b', 1, { reads: ['shape'] });
    const writer = schedulerNode('writer', 2, { writes: ['shape'] });
    locks.acquire(firstReader);
    expect(locks.canAcquire(secondReader)).toBe(true);
    locks.acquire(secondReader);
    expect(locks.canAcquire(writer)).toBe(false);
    locks.release(firstReader);
    locks.release(secondReader);
    locks.acquire(writer);
    expect(locks.canAcquire(firstReader)).toBe(false);
    expect(
      locks.canAcquire(schedulerNode('other', 3, { reads: ['other'] })),
    ).toBe(true);
  });
});
