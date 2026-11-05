/**
 * @author Aidan Boissonneault
 * @file parallel-preview.ts
 * @purpose Provides parallel preview behavior for the service parallel in cli package.
 * @last-edited October 6, 2026
 */

import {
  type PreparedComponentBrepCache,
  planIndependentComponentCompilation,
  planIndependentPartCompilation,
  planNativeBooleanBatches,
} from '@bushscad/compiler';
import type { IRProgram, NativeBooleanBatchPlan } from '@bushscad/ir';
import {
  compileFileToIr,
  selectBuildOps,
  type CompileFileOptions,
  type PreviewResult,
} from '@bushscad/compiler/node';
import type { ParallelBuildOutput } from './worker-protocol.js';
import { assembleInteractionSnapshots } from './interaction-assembly.js';
import type { PersistentOcctWorkerPool } from './persistent-worker-pool.js';
import {
  buildTasksWithOutputCache,
  type CompletedBuildOutputCache,
} from './build-output-cache.js';
import type { CompilerMetrics } from '../../dto/types.js';
import type { CompiledPreviewInput } from './preview-types.js';
import { previewIndependentComponents } from './component-preview.js';
import { completedPartCacheBreakpoint } from './completed-part-cache-breakpoint.js';
import {
  EMPTY_NATIVE_STATS,
  nativeBooleanBatchesEnabled,
  nativeStats,
  type NativeBooleanStats,
} from './native-boolean-policy.js';
import { parallelPreviewFailure } from './parallel-preview-failure.js';
import { compilerExecutionMetrics } from './compiler-execution-metrics.js';
import {
  EMPTY_POOL_EXECUTION_METRICS,
  type PoolExecutionMetrics,
} from './pool-execution-metrics.js';

/**
 * Parallel preview outcome is tagged by kind: 'complete' carries result, metrics and 'fallback'
 * carries reason, IR compilation time, compiled.
 */
export type ParallelPreviewOutcome =
  | { kind: 'complete'; result: PreviewResult; metrics: CompilerMetrics }
  | {
      kind: 'fallback';
      reason: string;
      compileIrMs: number;
      compiled: CompiledPreviewInput;
    };

/** Compiles IR once, then builds eligible independent part groups concurrently. */
export async function previewIndependentParts(
  options: CompileFileOptions,
  pool: PersistentOcctWorkerPool,
  componentCache?: PreparedComponentBrepCache,
  buildOutputCache?: CompletedBuildOutputCache,
): Promise<ParallelPreviewOutcome> {
  const startedAt = Date.now();
  const compiled = compileFileToIr(options);
  const compileIrMs = Date.now() - startedAt;
  if (!compiled.ok)
    return {
      kind: 'complete',
      result: compiled,
      metrics: metrics(
        pool,
        compileIrMs,
        0,
        0,
        EMPTY_NATIVE_STATS,
        EMPTY_POOL_EXECUTION_METRICS,
      ),
    };
  if (compiled.drawings.drawings.length > 0) {
    return {
      kind: 'fallback',
      reason: 'drawings require classic final assembly',
      compileIrMs,
      compiled,
    };
  }

  const buildOps = selectBuildOps(
    compiled.program.ops,
    options.cursorOpIndex,
    options.suppressedOpIndices,
  );
  const program = { ...compiled.program, ops: buildOps };
  const nativeBooleanPlan = nativeBooleanBatchesEnabled()
    ? planNativeBooleanBatches(program)
    : undefined;
  const plan = planIndependentPartCompilation(program, options.filePath);
  if (!plan.eligible) {
    if (nativeBooleanPlan && nativeBooleanPlan.batches.length > 0) {
      return previewOneNativeBooleanPlan(
        compiled,
        program,
        nativeBooleanPlan,
        options,
        pool,
        compileIrMs,
        startedAt,
        buildOutputCache,
      );
    }
    const componentPlan = planIndependentComponentCompilation(
      program,
      options.filePath,
      {
        reuseRecipes: process.env.BUSHSCAD_PARALLEL_RECIPE_REUSE !== '0',
        allowSingleComponent: componentCache !== undefined,
        automaticallyAssignCacheBreakpoints:
          options.automaticallyAssignCacheBreakpoints ??
          componentCache !== undefined,
        cacheBreakpoints: options.cacheBreakpoints,
      },
    );
    if (!componentPlan.eligible) {
      return {
        kind: 'fallback',
        reason: componentPlan.reason,
        compileIrMs,
        compiled,
      };
    }
    const componentResult = await previewIndependentComponents(
      compiled,
      componentPlan,
      options,
      pool,
      compileIrMs,
      startedAt,
      componentCache,
      buildOutputCache,
    );
    return {
      kind: 'complete',
      result: componentResult.result,
      metrics: componentResult.metrics,
    };
  }

  const geometryStartedAt = Date.now();
  try {
    const batchPlans = plan.batches.map((batch) =>
      nativeBooleanBatchesEnabled()
        ? planNativeBooleanBatches(batch.program)
        : undefined,
    );
    const nativeOwner = batchPlans.findIndex(
      (candidate) => (candidate?.batches.length ?? 0) > 0,
    );
    const buildBatch = await buildTasksWithOutputCache(
      plan.batches.map((batch, index) => ({
        partName: batch.partName,
        sourceIndex: batch.sourceIndex,
        autoColorOffset: batch.autoColorOffset,
        program: batch.program,
        assets: compiled.assets,
        trace:
          options.occtTrace === true ||
          (index === nativeOwner && batchPlans[index] !== undefined),
        ...(index === nativeOwner
          ? {
              nativeBooleanPlan: batchPlans[index],
              nativeBooleanConcurrencyLimit: 1,
            }
          : {}),
      })),
      pool,
      buildOutputCache,
      options.occtTrace ? options.onOcctTraceEvent : undefined,
    );
    const outputs = withAutomaticPartCachePoints(
      plan.batches,
      buildBatch.outputs,
      options,
      buildOutputCache,
    );
    return assembleParallelOutcome(
      compiled,
      outputs,
      options,
      pool,
      compileIrMs,
      Date.now() - geometryStartedAt,
      startedAt,
      nativeStats(outputs.flatMap((output) => output.traceEvents)),
      buildBatch.execution,
      buildBatch.cacheHitCount,
    );
  } catch (error) {
    return parallelPreviewFailure(
      compiled,
      options,
      metrics(pool, compileIrMs, Date.now() - geometryStartedAt, 0),
      startedAt,
      error,
    );
  }
}

/** Runs a qualifying single-part program in one bounded native-batch owner. */
async function previewOneNativeBooleanPlan(
  compiled: CompiledPreviewInput,
  program: CompiledPreviewInput['program'],
  plan: NativeBooleanBatchPlan,
  options: CompileFileOptions,
  pool: PersistentOcctWorkerPool,
  compileIrMs: number,
  startedAt: number,
  buildOutputCache?: CompletedBuildOutputCache,
): Promise<ParallelPreviewOutcome> {
  const geometryStartedAt = Date.now();
  try {
    const buildBatch = await buildTasksWithOutputCache(
      [
        {
          partName: plan.batches[0]?.partName ?? '__default__',
          sourceIndex: 0,
          autoColorOffset: 0,
          program,
          assets: compiled.assets,
          trace: true,
          nativeBooleanPlan: plan,
          nativeBooleanConcurrencyLimit: 1,
        },
      ],
      pool,
      buildOutputCache,
      options.occtTrace ? options.onOcctTraceEvent : undefined,
    );
    const outputs = withAutomaticPartCachePoints(
      [
        {
          partName: plan.batches[0]?.partName ?? '__default__',
          sourceIndex: 0,
          program,
        },
      ],
      buildBatch.outputs,
      options,
      buildOutputCache,
    );
    const [output] = outputs;
    if (!output) throw new Error('Native boolean worker returned no output.');
    return assembleParallelOutcome(
      compiled,
      [output],
      options,
      pool,
      compileIrMs,
      Date.now() - geometryStartedAt,
      startedAt,
      nativeStats(output.traceEvents),
      buildBatch.execution,
      buildBatch.cacheHitCount,
    );
  } catch (error) {
    return parallelPreviewFailure(
      compiled,
      options,
      metrics(pool, compileIrMs, Date.now() - geometryStartedAt, 0),
      startedAt,
      error,
    );
  }
}

/** Adds visible source markers for automatic whole-part disk cache boundaries. */
function withAutomaticPartCachePoints(
  batches: readonly {
    partName: string;
    sourceIndex: number;
    program: IRProgram;
  }[],
  outputs: readonly ParallelBuildOutput[],
  options: CompileFileOptions,
  cache: CompletedBuildOutputCache | undefined,
): ParallelBuildOutput[] {
  if (
    !options.occtTrace ||
    !cache ||
    options.automaticallyAssignCacheBreakpoints === false
  )
    return [...outputs];
  return outputs.map((output, index) => {
    const batch = batches[index];
    if (!batch) return output;
    const event = completedPartCacheBreakpoint(
      batch.program.ops,
      batch.partName,
      batch.sourceIndex,
      output.traceEvents.reduce(
        (earliest, traceEvent) => Math.min(earliest, traceEvent.timestampMs),
        Date.now(),
      ),
    );
    if (!event) return output;
    options.onOcctTraceEvent?.(event);
    return {
      ...output,
      traceEvents: [...output.traceEvents, event].sort(
        (left, right) => left.timestampMs - right.timestampMs,
      ),
    };
  });
}

/** Reassembles source-ordered worker outputs into the established preview DTO. */
function assembleParallelOutcome(
  compiled: CompiledPreviewInput,
  outputs: readonly ParallelBuildOutput[],
  options: CompileFileOptions,
  pool: PersistentOcctWorkerPool,
  compileIrMs: number,
  geometryMs: number,
  startedAt: number,
  booleanStats: NativeBooleanStats = EMPTY_NATIVE_STATS,
  execution: PoolExecutionMetrics = pool.executionMetrics(),
  completedBuildCacheHitCount = 0,
): ParallelPreviewOutcome {
  const assemblyStartedAt = Date.now();
  const interactionSource = compiled.program.interaction;
  if (!interactionSource)
    throw new Error('Parallel preview has no interaction provenance.');
  const interaction = assembleInteractionSnapshots(
    interactionSource,
    outputs.flatMap((output) =>
      output.interaction
        ? [
            {
              partName: output.partName,
              snapshot: output.interaction,
              meshCount: output.meshes.length,
            },
          ]
        : [],
    ),
  );
  const traceEvents = outputs
    .flatMap((output) => output.traceEvents)
    .sort((left, right) => left.timestampMs - right.timestampMs);
  return {
    kind: 'complete',
    result: {
      ok: true,
      program: compiled.program,
      drawings: [],
      meshes: outputs.flatMap((output) => output.meshes),
      interaction,
      validations: outputs.flatMap((output) => output.validations),
      joints: outputs.flatMap((output) => output.joints),
      env: compiled.env,
      dependents: compiled.workspace.dependents,
      ...(options.occtTrace ? { occtTraceEvents: traceEvents } : {}),
      elapsedMs: Date.now() - startedAt,
    },
    metrics: metrics(
      pool,
      compileIrMs,
      geometryMs,
      Date.now() - assemblyStartedAt,
      booleanStats,
      execution,
      completedBuildCacheHitCount,
    ),
  };
}

/**
 * Handles metrics in the service parallel flow.
 */
function metrics(
  pool: PersistentOcctWorkerPool,
  compileIrMs: number,
  geometryMs: number,
  assemblyMs: number,
  booleanStats: NativeBooleanStats = EMPTY_NATIVE_STATS,
  execution: PoolExecutionMetrics = pool.executionMetrics(),
  persistentCompletedBuildCacheHitCount = 0,
): CompilerMetrics {
  const status = pool.snapshot();
  return {
    engine: 'parallel',
    workerCount: status.desiredWorkers,
    readyWorkerCount: status.readyWorkers,
    compileIrMs,
    geometryMs,
    assemblyMs,
    workerStartupMs: status.startupMs,
    reusedWarmWorkers: status.startupMs > 0 && compileIrMs > 0,
    nativeBooleanBatchCount: booleanStats.batchCount,
    nativeBooleanAvoidedBuildCount: booleanStats.avoidedBuildCount,
    nativeBooleanRejectionCount: booleanStats.rejectionCount,
    ...(persistentCompletedBuildCacheHitCount > 0
      ? { persistentCompletedBuildCacheHitCount }
      : {}),
    ...compilerExecutionMetrics(pool, execution),
  };
}
