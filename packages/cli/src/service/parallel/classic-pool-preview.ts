/**
 * @author Aidan Boissonneault
 * @file classic-pool-preview.ts
 * @purpose Provides classic pool preview behavior for the service parallel in cli package.
 * @last-edited October 6, 2026
 */

import {
  compileFileToIr,
  selectBuildOps,
  type CompileFileOptions,
  type PreviewResult,
} from '@bushscad/compiler/node';
import type { CompilerMetrics } from '../../dto/types.js';
import type { PersistentOcctWorkerPool } from './persistent-worker-pool.js';
import type { CompiledPreviewInput } from './preview-types.js';
import type { ParallelBuildOutput } from './worker-protocol.js';
import { compilerExecutionMetrics } from './compiler-execution-metrics.js';
import { EMPTY_POOL_EXECUTION_METRICS } from './pool-execution-metrics.js';
import { compileErrorFromWorker } from './worker-errors.js';

/**
 * Prepared preview, including compiled and IR compilation time.
 */
type PreparedPreview = {
  compiled: CompiledPreviewInput;
  compileIrMs: number;
};

/** Executes the unchanged classic bridge algorithm inside one pool worker. */
export async function previewClassicInPool(
  options: CompileFileOptions,
  pool: PersistentOcctWorkerPool,
  fallbackReason?: string,
  prepared?: PreparedPreview,
): Promise<{ result: PreviewResult; metrics: CompilerMetrics }> {
  const compilation = prepareCompilation(options, prepared);
  if (!compilation.compiled.ok) {
    return {
      result: compilation.compiled,
      metrics: classicMetrics(
        pool,
        compilation.compileIrMs,
        0,
        fallbackReason,
        EMPTY_POOL_EXECUTION_METRICS,
      ),
    };
  }
  return buildClassicPreview(
    options,
    pool,
    fallbackReason,
    compilation as PreparedPreview,
  );
}

/** Reuses prepared IR after a parallel eligibility fallback. */
function prepareCompilation(
  options: CompileFileOptions,
  prepared?: PreparedPreview,
): { compiled: ReturnType<typeof compileFileToIr>; compileIrMs: number } {
  if (prepared) return prepared;
  const startedAt = Date.now();
  return {
    compiled: compileFileToIr(options),
    compileIrMs: Date.now() - startedAt,
  };
}

/** Sends one whole program through a warm worker and maps its result. */
async function buildClassicPreview(
  options: CompileFileOptions,
  pool: PersistentOcctWorkerPool,
  fallbackReason: string | undefined,
  prepared: PreparedPreview,
): Promise<{ result: PreviewResult; metrics: CompilerMetrics }> {
  const executionStartedAt = Date.now();
  const geometryStartedAt = Date.now();
  try {
    const [output] = await pool.build(
      [classicTask(options, prepared.compiled)],
      options.onOcctTraceEvent,
    );
    return classicSuccess(
      options,
      prepared,
      output,
      pool,
      fallbackReason,
      executionStartedAt,
      geometryStartedAt,
    );
  } catch (error) {
    return classicFailure(
      options,
      prepared,
      pool,
      fallbackReason,
      executionStartedAt,
      geometryStartedAt,
      error,
    );
  }
}

/** Creates the single task that preserves classic operation ordering. */
function classicTask(
  options: CompileFileOptions,
  compiled: CompiledPreviewInput,
): Parameters<PersistentOcctWorkerPool['build']>[0][number] {
  const buildOps = selectBuildOps(
    compiled.program.ops,
    options.cursorOpIndex,
    options.suppressedOpIndices,
  );
  return {
    partName: '__classic__',
    sourceIndex: 0,
    autoColorOffset: 0,
    program: { ...compiled.program, ops: buildOps },
    assets: compiled.assets,
    drawingProgram: compiled.drawings,
    trace: options.occtTrace === true,
  };
}

/** Produces the established classic preview response from its worker output. */
function classicSuccess(
  options: CompileFileOptions,
  prepared: PreparedPreview,
  output: ParallelBuildOutput,
  pool: PersistentOcctWorkerPool,
  fallbackReason: string | undefined,
  executionStartedAt: number,
  geometryStartedAt: number,
): { result: PreviewResult; metrics: CompilerMetrics } {
  const interaction =
    output.interaction ?? prepared.compiled.program.interaction;
  if (!interaction)
    throw new Error('Classic preview has no interaction provenance.');
  return {
    result: {
      ok: true,
      program: prepared.compiled.program,
      drawings: output.drawings,
      meshes: output.meshes,
      interaction,
      validations: output.validations,
      joints: output.joints,
      env: prepared.compiled.env,
      dependents: prepared.compiled.workspace.dependents,
      ...(options.occtTrace ? { occtTraceEvents: output.traceEvents } : {}),
      elapsedMs: prepared.compileIrMs + Date.now() - executionStartedAt,
    },
    metrics: classicMetrics(
      pool,
      prepared.compileIrMs,
      Date.now() - geometryStartedAt,
      fallbackReason,
      pool.executionMetrics(),
    ),
  };
}

/** Produces a classic failure without discarding prior renderer state. */
function classicFailure(
  options: CompileFileOptions,
  prepared: PreparedPreview,
  pool: PersistentOcctWorkerPool,
  fallbackReason: string | undefined,
  executionStartedAt: number,
  geometryStartedAt: number,
  error: unknown,
): { result: PreviewResult; metrics: CompilerMetrics } {
  return {
    result: {
      ok: false,
      errors: [compileErrorFromWorker(error, options.filePath)],
      env: prepared.compiled.env,
      elapsedMs: prepared.compileIrMs + Date.now() - executionStartedAt,
    },
    metrics: classicMetrics(
      pool,
      prepared.compileIrMs,
      Date.now() - geometryStartedAt,
      fallbackReason,
      pool.executionMetrics(),
    ),
  };
}

/** Reports classic/fallback work using the same local phase schema. */
function classicMetrics(
  pool: PersistentOcctWorkerPool,
  compileIrMs: number,
  geometryMs: number,
  fallbackReason?: string,
  execution = EMPTY_POOL_EXECUTION_METRICS,
): CompilerMetrics {
  const status = pool.snapshot();
  return {
    engine: 'classic',
    ...(fallbackReason ? { fallbackReason } : {}),
    workerCount: status.desiredWorkers,
    readyWorkerCount: status.readyWorkers,
    compileIrMs,
    geometryMs,
    assemblyMs: 0,
    workerStartupMs: status.startupMs,
    reusedWarmWorkers: status.readyWorkers > 0,
    ...compilerExecutionMetrics(pool, execution),
  };
}
