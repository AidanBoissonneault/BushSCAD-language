import { describe, expect, it, vi } from 'vitest';
import { buildTasksWithOutputCache } from '../../../src/service/parallel/build-output-cache.js';
import type { ParallelBuildOutput } from '../../../src/service/parallel/worker-protocol.js';
import type { PersistentOcctWorkerPool } from '../../../src/service/parallel/persistent-worker-pool.js';

describe('completed build output cache traces', () => {
  it('marks a reused completed part even when cached output has no previous trace', async () => {
    const cachedOutput = sampleOutput();
    const cache = {
      get: vi.fn(async () => cachedOutput),
      put: vi.fn(async () => undefined),
    };
    const pool = { build: vi.fn() } as unknown as PersistentOcctWorkerPool;

    const result = await buildTasksWithOutputCache(
      [
        {
          partName: 'finished_part',
          sourceIndex: 0,
          autoColorOffset: 0,
          program: { ops: [], parts: ['finished_part'], baseUnitMm: 1 },
          assets: { fonts: [], shapes: [] },
          trace: true,
        },
      ],
      pool,
      cache,
    );

    expect(result.cacheHitCount).toBe(1);
    expect(result.outputs[0]?.traceEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'part-success',
          cacheHit: 'completed-build',
        }),
        expect.objectContaining({
          kind: 'build-success',
          cacheHit: 'completed-build',
        }),
      ]),
    );
    expect(pool.build).not.toHaveBeenCalled();
  });
});

/** Provides a completed cache entry without historical trace events. */
function sampleOutput(): ParallelBuildOutput {
  return {
    taskId: 0,
    partName: 'finished_part',
    sourceIndex: 0,
    meshes: [],
    drawings: [],
    validations: [],
    joints: [],
    traceEvents: [],
    elapsedMs: 0,
    workerCpuMs: 0,
    workerRssBytes: 0,
  };
}
