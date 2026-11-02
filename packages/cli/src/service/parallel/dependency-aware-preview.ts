/**
 * @author Aidan Boissonneault
 * @file dependency-aware-preview.ts
 * @purpose Provides dependency aware preview behavior for the service parallel in cli package.
 * @last-edited October 6, 2026
 */

import type { CompileFileOptions } from '@bushscad/compiler/node';
import { previewClassicInPool } from './classic-pool-preview.js';
import { previewIndependentParts } from './parallel-preview.js';
import type { PersistentOcctWorkerPool } from './persistent-worker-pool.js';

/**
 * Runs the default preview planner and preserves its deterministic fallback.
 * Persistent service and one-shot CLI requests must make the same
 * eligibility decision and reuse the already compiled IR when serialization is
 * required.
 */
export async function previewWithDependencyAwareCompiler(
  options: CompileFileOptions,
  pool: PersistentOcctWorkerPool,
): Promise<Awaited<ReturnType<typeof previewClassicInPool>>> {
  const outcome = await previewIndependentParts(options, pool);
  if (outcome.kind === 'complete') {
    return { result: outcome.result, metrics: outcome.metrics };
  }
  return previewClassicInPool(options, pool, outcome.reason, {
    compiled: outcome.compiled,
    compileIrMs: outcome.compileIrMs,
  });
}
