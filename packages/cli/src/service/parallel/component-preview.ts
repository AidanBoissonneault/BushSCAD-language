/**
 * @author Aidan Boissonneault
 * @file component-preview.ts
 * @purpose Provides component preview behavior for the service parallel in cli package.
 * @last-edited October 6, 2026
 */

import type {
  IndependentComponentPlan,
  PreparedComponentBrepCache,
} from '@bushscad/compiler';
import type {
  CompileFileOptions,
  PreviewResult,
} from '@bushscad/compiler/node';
import type { CompilerMetrics } from '../../dto/types.js';
import type { PersistentOcctWorkerPool } from './persistent-worker-pool.js';
import {
  buildTasksWithOutputCache,
  type CompletedBuildOutputCache,
} from './build-output-cache.js';
import type { CompiledPreviewInput } from './preview-types.js';
import { prepareIndependentComponents } from './component-preparation.js';
import { compilerExecutionMetrics } from './compiler-execution-metrics.js';
import {
  mergePoolExecutionMetrics,
  type PoolExecutionMetrics,
} from './pool-execution-metrics.js';
import { compileErrorFromWorker } from './worker-errors.js';
import { completedPartCacheBreakpoint } from './completed-part-cache-breakpoint.js';

/** Prepares independent components, then replays ordered reduction in one worker. */
export async function previewIndependentComponents(
  compiled: CompiledPreviewInput,
  plan: Extract<IndependentComponentPlan, { eligible: true }>,
  options: CompileFileOptions,
  pool: PersistentOcctWorkerPool,
  compileIrMs: number,
  startedAt: number,
  componentCache?: PreparedComponentBrepCache,
  buildOutputCache?: CompletedBuildOutputCache,
): Promise<{ result: PreviewResult; metrics: CompilerMetrics }> {
  const preparationStartedAt = Date.now();
  let persistentCacheHitCount = 0;
  try {
    const preparation = await prepareIndependentComponents(
      compiled,
      plan,
      options,
      pool,
      componentCache,
    );
    persistentCacheHitCount = preparation.cacheHitCount;
    const reductionStartedAt = Date.now();
    const buildBatch = await buildTasksWithOutputCache(
      [
        {
          partName: plan.partName,
          sourceIndex: 0,
          autoColorOffset: 0,
          program: plan.reductionProgram,
          assets: compiled.assets,
          trace: options.occtTrace === true,
          preparedComponents: preparation.artifacts,
        },
      ],
      pool,
      buildOutputCache,
      options.onOcctTraceEvent,
    );
    const [output] = buildBatch.outputs;
    if (!output) throw new Error('Parallel reduction returned no output.');
    const execution = mergePoolExecutionMetrics([
      preparation.execution,
      buildBatch.execution,
    ]);
    const componentReductionMs = Date.now() - reductionStartedAt;
    const interaction = output.interaction ?? compiled.program.interaction;
    if (!interaction)
      throw new Error(
        'Parallel component preview has no interaction provenance.',
      );
    const completedPartPoint =
      options.occtTrace &&
      buildOutputCache &&
      options.automaticallyAssignCacheBreakpoints !== false
        ? completedPartCacheBreakpoint(
            plan.reductionProgram.ops,
            plan.partName,
            0,
            output.traceEvents.reduce(
              (earliest, event) => Math.min(earliest, event.timestampMs),
              Date.now(),
            ),
          )
        : undefined;
    if (completedPartPoint) options.onOcctTraceEvent?.(completedPartPoint);
    const traceEvents = [
      ...preparation.traceEvents,
      ...output.traceEvents,
      ...(completedPartPoint ? [completedPartPoint] : []),
    ].sort((left, right) => left.timestampMs - right.timestampMs);
    return {
      result: {
        ok: true,
        program: compiled.program,
        drawings: output.drawings,
        meshes: output.meshes,
        interaction,
        validations: output.validations,
        joints: output.joints,
        env: compiled.env,
        dependents: compiled.workspace.dependents,
        ...(options.occtTrace ? { occtTraceEvents: traceEvents } : {}),
        elapsedMs: Date.now() - startedAt,
      },
      metrics: componentMetrics(
        pool,
        compileIrMs,
        preparation.elapsedMs,
        componentReductionMs,
        plan.componentCount,
        plan.tasks.length,
        plan.avoidedBuildCount,
        execution,
        componentCache ? persistentCacheHitCount : undefined,
        buildBatch.cacheHitCount,
      ),
    };
  } catch (error) {
    const failure = compileErrorFromWorker(error, options.filePath);
    return {
      result: {
        ok: false,
        errors: [
          {
            ...failure,
            message: `Parallel component build failed: ${failure.message}. Retry with the classic compiler.`,
          },
        ],
        env: compiled.env,
        elapsedMs: Date.now() - startedAt,
      },
      metrics: componentMetrics(
        pool,
        compileIrMs,
        Date.now() - preparationStartedAt,
        0,
        plan.componentCount,
        plan.tasks.length,
        plan.avoidedBuildCount,
        pool.executionMetrics(),
        componentCache ? persistentCacheHitCount : undefined,
        0,
      ),
    };
  }
}

/**
 * Builds the component data required by the current operation.
 */
function componentMetrics(
  pool: PersistentOcctWorkerPool,
  compileIrMs: number,
  componentPreparationMs: number,
  componentReductionMs: number,
  preparedComponentCount: number,
  componentRecipeCount: number,
  componentCacheHitCount: number,
  execution: PoolExecutionMetrics,
  persistentComponentCacheHitCount?: number,
  persistentCompletedBuildCacheHitCount = 0,
): CompilerMetrics {
  const status = pool.snapshot();
  return {
    engine: 'parallel',
    workerCount: status.desiredWorkers,
    readyWorkerCount: status.readyWorkers,
    compileIrMs,
    geometryMs: componentPreparationMs + componentReductionMs,
    assemblyMs: componentReductionMs,
    workerStartupMs: status.startupMs,
    reusedWarmWorkers: status.startupMs > 0,
    componentPreparationMs,
    componentReductionMs,
    preparedComponentCount,
    componentRecipeCount,
    componentCacheHitCount,
    ...(persistentComponentCacheHitCount !== undefined
      ? { persistentComponentCacheHitCount }
      : {}),
    ...(persistentCompletedBuildCacheHitCount > 0
      ? { persistentCompletedBuildCacheHitCount }
      : {}),
    ...compilerExecutionMetrics(pool, execution),
  };
}
