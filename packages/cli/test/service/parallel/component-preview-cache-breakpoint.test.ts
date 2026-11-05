import { describe, expect, it, vi } from 'vitest';
import {
  compileDocument,
  planIndependentComponentCompilation,
  type PreparedComponentBrepCache,
} from '@bushscad/compiler';
import type { CompileFileOptions } from '@bushscad/compiler/node';
import type { OcctTraceEvent } from '@bushscad/ir';
import type { ParallelBuildOutput } from '../../../src/service/parallel/worker-protocol.js';
import { previewIndependentComponents } from '../../../src/service/parallel/component-preview.js';
import type { CompletedBuildOutputCache } from '../../../src/service/parallel/build-output-cache.js';
import type { PersistentOcctWorkerPool } from '../../../src/service/parallel/persistent-worker-pool.js';
import { EMPTY_POOL_EXECUTION_METRICS } from '../../../src/service/parallel/pool-execution-metrics.js';

const filePath = 'C:/workspace/main.bscd';
const libraryPath = 'C:/workspace/library.bscd';
const source = `import { bracket } from './library.bscd';

part housing {
  sketch body = rect(10, 10);
  obj body = extrude(body, 10);
  place(bracket(), @body.top.center);
}
`;
const library = `export fn bracket() {
  sketch profile = rect(2mm, 2mm);
  return {
    obj body = extrude(profile, 2mm),
  }
}
`;

describe('component preview completed-part cache point', () => {
  it('adds a second automatic point after later placed geometry in the cached part', async () => {
    const compiled = compileDocument({
      source,
      filePath,
      rootPath: 'C:/workspace',
      fileMap: { [filePath]: source, [libraryPath]: library },
    });
    expect(compiled.ok, JSON.stringify(compiled)).toBe(true);
    if (!compiled.ok) return;

    const plan = planIndependentComponentCompilation(
      compiled.program,
      filePath,
      { allowSingleComponent: true, automaticallyAssignCacheBreakpoints: true },
    );
    expect(plan.eligible, JSON.stringify(plan)).toBe(true);
    if (!plan.eligible) return;

    const traceEvents: OcctTraceEvent[] = [];
    const options: CompileFileOptions = {
      filePath,
      occtTrace: true,
      automaticallyAssignCacheBreakpoints: true,
      onOcctTraceEvent: (event) => traceEvents.push(event),
    };
    const componentCache: PreparedComponentBrepCache = {
      get: vi.fn(async () => new Uint8Array([1])),
      put: vi.fn(async () => undefined),
    };
    const buildOutputCache: CompletedBuildOutputCache = {
      get: vi.fn(async () => completedOutput()),
      put: vi.fn(async () => undefined),
    };
    const pool = {
      snapshot: () => ({
        desiredWorkers: 1,
        readyWorkers: 1,
        startupMs: 0,
        aggregateWorkerRssBytes: 0,
        peakAggregateWorkerRssBytes: 0,
      }),
      executionMetrics: () => EMPTY_POOL_EXECUTION_METRICS,
    } as unknown as PersistentOcctWorkerPool;

    const outcome = await previewIndependentComponents(
      compiled,
      plan,
      options,
      pool,
      0,
      Date.now(),
      componentCache,
      buildOutputCache,
    );

    const completedPoints = outcome.result.ok
      ? outcome.result.occtTraceEvents?.filter(
          (event) => event.cacheBreakpoint === 'automatic',
        )
      : undefined;
    const componentPoint = completedPoints?.find(
      (event) => event.message === 'Automatically assigned cache breakpoint.',
    );
    const completedPartPoint = completedPoints?.find(
      (event) =>
        event.message ===
        'Automatically assigned completed-part cache breakpoint.',
    );
    expect(componentPoint?.span?.line).toBe(5);
    expect(completedPartPoint?.span?.file).toBe(filePath);
    expect(completedPartPoint?.span?.line).toBe(7);
    expect(traceEvents).toContainEqual(completedPartPoint);
  });
});

/** Supplies a completed part cache hit with no prior trace history. */
function completedOutput(): ParallelBuildOutput {
  return {
    taskId: 0,
    partName: 'housing',
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
