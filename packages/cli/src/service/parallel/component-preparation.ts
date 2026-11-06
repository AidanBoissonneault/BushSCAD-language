/**
 * @author Aidan Boissonneault
 * @file component-preparation.ts
 * @purpose Reuses cached BReps and prepares cache misses before ordered reduction.
 */

import {
  cachedPreparedComponentArtifact,
  materializePreparedComponentArtifact,
  type IndependentComponentPlan,
  type IndependentComponentTask,
  type PreparedComponentBrepCache,
} from '@bushscad/compiler';
import type { OcctTraceEvent, PreparedComponentArtifact } from '@bushscad/ir';
import type { CompileFileOptions } from '@bushscad/compiler/node';
import type { CompiledPreviewInput } from './preview-types.js';
import type { PersistentOcctWorkerPool } from './persistent-worker-pool.js';
import type { ParallelComponentOutput } from './worker-protocol.js';
import {
  EMPTY_POOL_EXECUTION_METRICS,
  type PoolExecutionMetrics,
} from './pool-execution-metrics.js';

type EligibleComponentPlan = Extract<
  IndependentComponentPlan,
  { eligible: true }
>;

type CacheLookup = {
  artifacts: Array<PreparedComponentArtifact | undefined>;
  traceEvents: OcctTraceEvent[][];
  missIndices: number[];
  hitCount: number;
};

/** Resolves cache hits and worker misses into current-tree prepared artifacts. */
export async function prepareIndependentComponents(
  compiled: CompiledPreviewInput,
  plan: EligibleComponentPlan,
  options: CompileFileOptions,
  pool: PersistentOcctWorkerPool,
  componentCache?: PreparedComponentBrepCache,
): Promise<{
  artifacts: PreparedComponentArtifact[];
  traceEvents: OcctTraceEvent[];
  cacheHitCount: number;
  execution: PoolExecutionMetrics;
  elapsedMs: number;
}> {
  const startedAt = Date.now();
  const lookup = await loadCachedComponents(plan, options, componentCache);
  const prepared = await prepareCacheMisses(
    compiled,
    plan,
    options,
    pool,
    lookup,
    componentCache,
  );
  attachPreparedOutputs(plan, lookup, prepared);
  return {
    artifacts: materializeCurrentComponents(plan, lookup.artifacts),
    traceEvents: flattenTraceEvents(lookup.traceEvents),
    cacheHitCount: lookup.hitCount,
    execution:
      prepared.length > 0
        ? pool.executionMetrics()
        : EMPTY_POOL_EXECUTION_METRICS,
    elapsedMs: Date.now() - startedAt,
  };
}

/** Reads safe canonical recipes from disk and records misses for parallel preparation. */
async function loadCachedComponents(
  plan: EligibleComponentPlan,
  options: CompileFileOptions,
  cache: PreparedComponentBrepCache | undefined,
): Promise<CacheLookup> {
  const lookup: CacheLookup = {
    artifacts: new Array(plan.tasks.length),
    traceEvents: plan.tasks.map(() => []),
    missIndices: [],
    hitCount: 0,
  };
  for (const [index, task] of plan.tasks.entries()) {
    const result = await loadCachedComponent(task, options, cache);
    lookup.traceEvents[index] = result.traceEvents;
    if (result.artifact) lookup.artifacts[index] = result.artifact;
    if (result.cacheHit) lookup.hitCount++;
    else lookup.missIndices.push(index);
  }
  return lookup;
}

/** Loads one selected recipe and returns its trace and cache outcome. */
async function loadCachedComponent(
  task: IndependentComponentTask,
  options: CompileFileOptions,
  cache: PreparedComponentBrepCache | undefined,
): Promise<{
  artifact?: PreparedComponentArtifact;
  traceEvents: OcctTraceEvent[];
  cacheHit: boolean;
}> {
  const traceEvents: OcctTraceEvent[] = [];
  const selected = hasCacheBreakpoint(task);
  const priority = retentionPriority(task);
  if (options.occtTrace && selected) {
    appendTraceEvents(traceEvents, cacheBreakpointTrace(task), options);
  }
  const brep =
    cache && task.cacheSafe && selected
      ? await readCachedBrep(cache, task, priority)
      : undefined;
  if (!brep) return { traceEvents, cacheHit: false };

  if (options.occtTrace) {
    appendTraceEvents(traceEvents, cachedRecipeTrace(task), options);
  }
  return {
    artifact: cachedPreparedComponentArtifact(task, brep),
    traceEvents,
    cacheHit: true,
  };
}

/** Delivers the same trace events to the current result and live trace consumer. */
function appendTraceEvents(
  target: OcctTraceEvent[],
  events: readonly OcctTraceEvent[],
  options: CompileFileOptions,
): void {
  target.push(...events);
  for (const event of events) options.onOcctTraceEvent?.(event);
}

/** Indicates whether the planner selected at least one consumer for caching. */
function hasCacheBreakpoint(task: IndependentComponentTask): boolean {
  return task.consumers.some((item) => item.cacheBreakpoint !== undefined);
}

/** Dispatches only missing recipes and stores each completed result as it arrives. */
async function prepareCacheMisses(
  compiled: CompiledPreviewInput,
  plan: EligibleComponentPlan,
  options: CompileFileOptions,
  pool: PersistentOcctWorkerPool,
  lookup: CacheLookup,
  cache: PreparedComponentBrepCache | undefined,
): Promise<ParallelComponentOutput[]> {
  if (lookup.missIndices.length === 0) return [];
  const tasksBySourceIndex = new Map(
    plan.tasks.map((task) => [task.sourceIndex, task]),
  );
  const tasks = lookup.missIndices.map((index) => {
    const task = plan.tasks[index];
    if (!task) throw new Error('Parallel component task is missing.');
    return {
      partName: task.partName,
      sourceIndex: task.sourceIndex,
      name: task.name,
      recipeDigest: task.recipeDigest,
      program: task.program,
      assets: compiled.assets,
      semanticConsumerIds: [...task.semanticConsumerIds],
      trace: options.occtTrace === true,
    };
  });
  return pool.prepareComponents(tasks, options.onOcctTraceEvent, (output) =>
    storeCompletedComponent(
      cache,
      tasksBySourceIndex.get(output.sourceIndex),
      output,
    ),
  );
}

/** Persists the exact completed node state without blocking worker scheduling. */
async function storeCompletedComponent(
  cache: PreparedComponentBrepCache | undefined,
  task: IndependentComponentTask | undefined,
  output: ParallelComponentOutput,
): Promise<void> {
  if (
    !cache ||
    !task?.cacheSafe ||
    !task.consumers.some((item) => item.cacheBreakpoint) ||
    task.recipeDigest !== output.recipeDigest
  ) {
    return;
  }
  try {
    await cache.put(
      task.recipeDigest,
      task.recipeCanonical,
      output.artifact.brep,
      output.elapsedMs,
      retentionPriority(task),
    );
  } catch {
    // Cache storage failures must leave the normal compiler path available.
  }
}

/** Places worker outputs back at their recipe positions before reduction. */
function attachPreparedOutputs(
  plan: EligibleComponentPlan,
  lookup: CacheLookup,
  prepared: readonly ParallelComponentOutput[],
): void {
  for (const [preparedIndex, output] of prepared.entries()) {
    const taskIndex = lookup.missIndices[preparedIndex];
    const task = taskIndex === undefined ? undefined : plan.tasks[taskIndex];
    if (!task || output.recipeDigest !== task.recipeDigest) {
      throw new Error('Parallel component recipe output order changed.');
    }
    lookup.artifacts[taskIndex] = output.artifact;
    lookup.traceEvents[taskIndex] = [
      ...(lookup.traceEvents[taskIndex] ?? []),
      ...output.traceEvents,
    ];
  }
}

/** Rebuilds source identity sidecars and expands shared recipe consumers. */
function materializeCurrentComponents(
  plan: EligibleComponentPlan,
  artifacts: readonly (PreparedComponentArtifact | undefined)[],
): PreparedComponentArtifact[] {
  return plan.tasks.flatMap((task, index) => {
    const artifact = artifacts[index];
    if (!artifact) throw new Error('Parallel component artifact is missing.');
    return materializePreparedComponentArtifact(task, artifact);
  });
}

/** Reads a cache entry without allowing storage failures to fail compilation. */
async function readCachedBrep(
  cache: PreparedComponentBrepCache,
  task: IndependentComponentTask,
  priority: 'automatic' | 'manual',
): Promise<Uint8Array | undefined> {
  try {
    const brep = await cache.get(
      task.recipeDigest,
      task.recipeCanonical,
      priority,
    );
    return brep instanceof Uint8Array && brep.byteLength > 0 ? brep : undefined;
  } catch {
    return undefined;
  }
}

/** Retains manually selected geometry ahead of compiler-assigned cache points. */
function retentionPriority(
  task: IndependentComponentTask,
): 'automatic' | 'manual' {
  return task.consumers.some(
    (consumer) => consumer.cacheBreakpoint === 'manual',
  )
    ? 'manual'
    : 'automatic';
}

/** Marks cache reuse in the operation trace without claiming native work ran. */
function cachedRecipeTrace(task: IndependentComponentTask): OcctTraceEvent[] {
  let timestampMs = Date.now();
  return task.consumers
    .filter((item) => item.cacheBreakpoint)
    .flatMap((item) => {
      const common = {
        partName: item.partName,
        opKind: item.operation.kind,
        opName: item.name,
        span: item.operation.span,
        sourceIndex: item.sourceIndex,
        bodiesBefore: [],
        cacheHit: 'component' as const,
      };
      return [
        {
          kind: 'op-start' as const,
          timestampMs: timestampMs++,
          ...common,
          message: 'Cached recipe hit.',
        },
        {
          kind: 'op-success' as const,
          timestampMs: timestampMs++,
          elapsedMs: 0,
          ...common,
          bodiesAfter: [item.name],
          addedBodies: [item.name],
          message: 'Reused cached prepared component.',
        },
      ];
    });
}

/** Reports each planner-selected cache point independently of a cache hit. */
function cacheBreakpointTrace(
  task: IndependentComponentTask,
): OcctTraceEvent[] {
  let timestampMs = Date.now();
  return task.consumers.flatMap((item) =>
    item.cacheBreakpoint
      ? [
          {
            kind: 'cache-breakpoint' as const,
            timestampMs: timestampMs++,
            partName: item.partName,
            opKind: item.operation.kind,
            opName: item.name,
            span: item.operation.span,
            sourceIndex: item.sourceIndex,
            cacheBreakpoint: item.cacheBreakpoint,
            message:
              item.cacheBreakpoint === 'automatic'
                ? 'Automatically assigned cache breakpoint.'
                : 'Manual cache breakpoint.',
          },
        ]
      : [],
  );
}

/** Sorts cached and worker traces into the established source task order. */
function flattenTraceEvents(
  events: readonly OcctTraceEvent[][],
): OcctTraceEvent[] {
  return events
    .flat()
    .sort((left, right) => left.timestampMs - right.timestampMs);
}
