import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { PersistentOcctWorkerPool } from '../../src/service/parallel/persistent-worker-pool.js';
import { previewIndependentParts } from '../../src/service/parallel/parallel-preview.js';
import { EMPTY_POOL_EXECUTION_METRICS } from '../../src/service/parallel/pool-execution-metrics.js';

describe('previewIndependentParts', () => {
  it('returns to the classic preview path for ineligible part plans', async () => {
    const pool = {
      build: vi.fn(),
      executionMetrics: () => EMPTY_POOL_EXECUTION_METRICS,
      snapshot: () => ({
        desiredWorkers: 1,
        readyWorkers: 0,
        startupMs: 0,
        aggregateWorkerRssBytes: 0,
        peakAggregateWorkerRssBytes: 0,
      }),
    } as unknown as PersistentOcctWorkerPool;

    const outcome = await previewIndependentParts(
      {
        filePath: resolve('test/fixtures/invalid-font-span.bscd'),
      },
      pool,
    );

    expect(outcome.kind).toBe('fallback');
    if (outcome.kind !== 'fallback') return;
    expect(outcome.reason.length).toBeGreaterThan(0);
    expect(outcome.compiled.program).toBeDefined();
    expect(pool.build).not.toHaveBeenCalled();
  });
});
