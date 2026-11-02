/**
 * @author Aidan Boissonneault
 * @file worker-errors.ts
 * @purpose Provides worker errors behavior for the service parallel in cli package.
 * @last-edited October 6, 2026
 */

import type { CompileError, SourceSpan } from '@bushscad/ir';

/**
 * Derives `SourceMappedError` from `Error & { span?: SourceSpan }` to preserve its type relationship
 * in the service parallel layer.
 */
export type SourceMappedError = Error & { span?: SourceSpan };

/** Rehydrates a worker failure while retaining native source provenance. */
export function sourceMappedWorkerError(
  message: string,
  span?: SourceSpan,
): SourceMappedError {
  return Object.assign(new Error(message), span ? { span } : {});
}

/** Converts an unknown worker rejection into a compiler diagnostic. */
export function compileErrorFromWorker(
  error: unknown,
  fallbackFile: string,
): CompileError {
  const message = error instanceof Error ? error.message : String(error);
  const span = sourceSpanFrom(error) ?? {
    file: fallbackFile,
    line: 1,
    col: 1,
  };
  return { message, span };
}

/** Returns the useful message from Error instances and plain IPC errors alike. */
export function workerErrorMessage(error: unknown): string {
  if (
    error &&
    typeof error === 'object' &&
    'message' in error &&
    typeof error.message === 'string'
  )
    return error.message;
  return String(error);
}

/** Reads only a structurally valid compiler source span from an IPC error. */
export function sourceSpanFrom(error: unknown): SourceSpan | undefined {
  if (!error || typeof error !== 'object' || !('span' in error)) return;
  const span = error.span;
  if (
    !span ||
    typeof span !== 'object' ||
    !('file' in span) ||
    !('line' in span) ||
    !('col' in span) ||
    typeof span.file !== 'string' ||
    typeof span.line !== 'number' ||
    typeof span.col !== 'number'
  )
    return;
  return span as SourceSpan;
}
