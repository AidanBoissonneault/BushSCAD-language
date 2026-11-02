/**
 * @author Aidan Boissonneault
 * @file default-compiler.ts
 * @purpose Provides default compiler behavior for the cli in cli package.
 * @last-edited October 6, 2026
 */

import type {
  CompileFileOptions,
  PreviewResult,
  ExportFileResult,
} from '@bushscad/compiler/node';
import type { ExportFormat } from '@bushscad/ir';
import { previewWithDependencyAwareCompiler } from '../service/parallel/dependency-aware-preview.js';
import { PersistentOcctWorkerPool } from '../service/parallel/persistent-worker-pool.js';
import { exportInPool } from '../service/parallel/pool-export.js';

/** Runs a one-shot CLI preview through the default dependency-aware compiler. */
export async function previewWithDefaultCompiler(
  options: CompileFileOptions,
): Promise<PreviewResult> {
  return withOneShotCompilerPool(
    async (pool) =>
      (await previewWithDependencyAwareCompiler(options, pool)).result,
  );
}

/** Runs a one-shot CLI export through one dependency-aware OCCT worker. */
export async function exportWithDefaultCompiler(
  options: CompileFileOptions & { format: ExportFormat },
): Promise<ExportFileResult> {
  return withOneShotCompilerPool(
    async (pool) => (await exportInPool(options, pool)).result,
  );
}

/** Owns the worker lifecycle shared by one-shot build and export commands. */
async function withOneShotCompilerPool<Result>(
  run: (pool: PersistentOcctWorkerPool) => Promise<Result>,
): Promise<Result> {
  const pool = new PersistentOcctWorkerPool(1);
  pool.warm();
  try {
    return await run(pool);
  } finally {
    pool.dispose();
  }
}
