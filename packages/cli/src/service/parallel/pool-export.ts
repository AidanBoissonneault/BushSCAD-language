/**
 * @author Aidan Boissonneault
 * @file pool-export.ts
 * @purpose Provides pool export behavior for the service parallel in cli package.
 * @last-edited October 6, 2026
 */

import {
  compileFileToIr,
  type CompileFileOptions,
  type ExportFileResult,
} from '@bushscad/compiler/node';
import { planNativeBooleanBatches } from '@bushscad/compiler';
import type { ExportFormat } from '@bushscad/ir';
import type { PersistentOcctWorkerPool } from './persistent-worker-pool.js';
import { nativeBooleanBatchesEnabled } from './native-boolean-policy.js';
import type { CompilerMetrics } from '../../dto/types.js';
import { compilerExecutionMetrics } from './compiler-execution-metrics.js';
import {
  EMPTY_POOL_EXECUTION_METRICS,
  type PoolExecutionMetrics,
} from './pool-execution-metrics.js';

/**
 * Pool export outcome, including result and metrics.
 */
export type PoolExportOutcome = {
  result: ExportFileResult;
  metrics: CompilerMetrics;
};

/** Compiles once and runs classic export inside an already warm pool worker. */
export async function exportInPool(
  options: CompileFileOptions & { format: ExportFormat },
  pool: PersistentOcctWorkerPool,
  engine: CompilerMetrics['engine'] = 'parallel',
): Promise<PoolExportOutcome> {
  const startedAt = Date.now();
  const compiled = compileFileToIr(options);
  const compileIrMs = Date.now() - startedAt;
  if (!compiled.ok) {
    return {
      result: compiled,
      metrics: exportMetrics(
        pool,
        compileIrMs,
        0,
        EMPTY_POOL_EXECUTION_METRICS,
        engine,
      ),
    };
  }
  const geometryStartedAt = Date.now();
  try {
    const nativeBooleanPlan =
      engine === 'parallel' && nativeBooleanBatchesEnabled()
        ? planNativeBooleanBatches(compiled.program)
        : undefined;
    const output = await pool.export({
      program: compiled.program,
      assets: compiled.assets,
      drawingProgram: compiled.drawings,
      format: options.format,
      ...(nativeBooleanPlan?.batches.length ? { nativeBooleanPlan } : {}),
    });
    return {
      result: {
        ok: true,
        program: compiled.program,
        buffers: output.buffers,
        drawings: output.drawings,
        env: compiled.env,
        elapsedMs: Date.now() - startedAt,
      },
      metrics: exportMetrics(
        pool,
        compileIrMs,
        Date.now() - geometryStartedAt,
        pool.executionMetrics(),
        engine,
      ),
    };
  } catch (error) {
    return {
      result: {
        ok: false,
        errors: [
          {
            message: error instanceof Error ? error.message : String(error),
            span: { file: options.filePath, line: 1, col: 1 },
          },
        ],
        env: compiled.env,
        elapsedMs: Date.now() - startedAt,
      },
      metrics: exportMetrics(
        pool,
        compileIrMs,
        Date.now() - geometryStartedAt,
        pool.executionMetrics(),
        engine,
      ),
    };
  }
}

/** Reports export work using the same phase and pool schema as preview. */
function exportMetrics(
  pool: PersistentOcctWorkerPool,
  compileIrMs: number,
  geometryMs: number,
  execution: PoolExecutionMetrics,
  engine: CompilerMetrics['engine'],
): CompilerMetrics {
  const status = pool.snapshot();
  return {
    engine,
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
