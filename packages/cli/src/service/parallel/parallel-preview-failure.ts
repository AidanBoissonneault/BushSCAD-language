/**
 * @author Aidan Boissonneault
 * @file parallel-preview-failure.ts
 * @purpose Provides parallel preview failure behavior for the service parallel in cli package.
 * @last-edited October 6, 2026
 */

import type {
  CompileFileOptions,
  PreviewResult,
} from '@bushscad/compiler/node';
import type { CompilerMetrics } from '../../dto/types.js';
import type { CompiledPreviewInput } from './preview-types.js';
import { compileErrorFromWorker } from './worker-errors.js';

/** Normalizes a failed parallel geometry task into the preview service contract. */
export function parallelPreviewFailure(
  compiled: CompiledPreviewInput,
  options: CompileFileOptions,
  compilerMetrics: CompilerMetrics,
  startedAt: number,
  error: unknown,
): { kind: 'complete'; result: PreviewResult; metrics: CompilerMetrics } {
  const failure = compileErrorFromWorker(error, options.filePath);
  return {
    kind: 'complete',
    result: {
      ok: false,
      errors: [
        {
          ...failure,
          message: `Parallel OCCT build failed: ${failure.message}. Retry with the classic compiler.`,
        },
      ],
      env: compiled.env,
      elapsedMs: Date.now() - startedAt,
    },
    metrics: compilerMetrics,
  };
}
