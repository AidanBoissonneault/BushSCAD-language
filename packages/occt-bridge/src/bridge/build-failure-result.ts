/**
 * @author Aidan Boissonneault
 * @file build-failure-result.ts
 * @purpose Creates and traces failed OCCT build results.
 * @last-edited November 3, 2026
 */

import type { OcctError } from '@bushscad/ir';
import type { BuildResult } from './bridge-types.js';
import { isOcctError, rawErrorMessage } from '../core/occt-errors.js';
import {
  pushTraceEvent,
  type OcctBuildTrace,
} from '../operations/build-trace.js';

/**
 * Records a build failure and returns source errors while rethrowing unexpected ones.
 *
 * Why:
 * The bridge reports authored OCCT errors as build results but leaves programming
 * and runtime faults visible to callers after recording the failure trace.
 */
export function buildFailureResult(
  error: unknown,
  trace: OcctBuildTrace | undefined,
  startedAt: number,
): BuildResult {
  const message = error instanceof Error ? error.message : rawErrorMessage(error);
  pushTraceEvent(trace, {
    kind: 'build-error',
    elapsedMs: Date.now() - startedAt,
    message,
    ...(isOcctError(error) ? { span: (error as OcctError).span } : {}),
  });
  if (!isOcctError(error)) throw error;
  return {
    ok: false,
    error: error as OcctError,
    ...(trace ? { occtTraceEvents: trace.events } : {}),
  };
}
