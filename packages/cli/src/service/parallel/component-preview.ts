/**
 * @author Aidan Boissonneault
 * @file component-preview.ts
 * @purpose Provides component preview behavior for the service parallel in cli package.
 * @last-edited October 6, 2026
 */

import {
  materializePreparedComponentArtifact,
  type IndependentComponentPlan,
} from '@bushscad/compiler';
import type {
  CompileFileOptions,
  PreviewResult,
} from '@bushscad/compiler/node';
import type { CompilerMetrics } from '../../dto/types.js';
import type { PersistentOcctWorkerPool } from './persistent-worker-pool.js';
import type { CompiledPreviewInput } from './preview-types.js';
import { compilerExecutionMetrics } from './compiler-execution-metrics.js';
import {
  mergePoolExecutionMetrics,
  type PoolExecutionMetrics,
} from './pool-execution-metrics.js';
import { compileErrorFromWorker } from './worker-errors.js';

/** Prepares independent components, then replays ordered reduction in one worker. */
export async function previewIndependentComponents(
  compiled: CompiledPreviewInput,
  plan: Extract<IndependentComponentPlan, { eligible: true }>,
  options: CompileFileOptions,
  pool: PersistentOcctWorkerPool,
  compileIrMs: number,
  startedAt: number,
): Promise<{ result: PreviewResult; metrics: CompilerMetrics }> {
  const preparationStartedAt = Date.now();
  try {
    const prepared = await pool.prepareComponents(
      plan.tasks.map((task) => ({
        partName: task.partName,
        sourceIndex: task.sourceIndex,
        name: task.name,
        recipeDigest: task.recipeDigest,
        program: task.program,
        assets: compiled.assets,
        semanticConsumerIds: [...task.semanticConsumerIds],
        trace: options.occtTrace === true,
      })),
      options.onOcctTraceEvent,
    );
    const preparationExecution = pool.executionMetrics();
    const componentPreparationMs = Date.now() - preparationStartedAt;
    const preparedArtifacts = prepared.flatMap((output, index) => {
      const task = plan.tasks[index];
      if (!task || output.recipeDigest !== task.recipeDigest) {
        throw new Error('Parallel component recipe output order changed.');
      }
      return materializePreparedComponentArtifact(task, output.artifact);
    });
    const reductionStartedAt = Date.now();
    const [output] = await pool.build(
      [
        {
          partName: plan.partName,
          sourceIndex: 0,
          autoColorOffset: 0,
          program: plan.reductionProgram,
          assets: compiled.assets,
          trace: options.occtTrace === true,
          preparedComponents: preparedArtifacts,
        },
      ],
      options.onOcctTraceEvent,
    );
    const execution = mergePoolExecutionMetrics([
      preparationExecution,
      pool.executionMetrics(),
    ]);
    const componentReductionMs = Date.now() - reductionStartedAt;
    const interaction = output.interaction ?? compiled.program.interaction;
    if (!interaction)
      throw new Error(
        'Parallel component preview has no interaction provenance.',
      );
    const traceEvents = [
      ...prepared.flatMap((component) => component.traceEvents),
      ...output.traceEvents,
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
        componentPreparationMs,
        componentReductionMs,
        plan.componentCount,
        plan.tasks.length,
        plan.avoidedBuildCount,
        execution,
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
    ...compilerExecutionMetrics(pool, execution),
  };
}
