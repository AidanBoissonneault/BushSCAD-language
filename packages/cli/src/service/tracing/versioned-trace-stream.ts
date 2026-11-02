/**
 * @author Aidan Boissonneault
 * @file versioned-trace-stream.ts
 * @purpose Provides versioned trace stream behavior for the service tracing in cli package.
 * @last-edited October 6, 2026
 */

import type {
  OcctTraceEvent,
  OcctTracePhase,
  OcctTraceState,
} from '@bushscad/ir';
import type { ServiceRequest } from '../../dto/types.js';

/**
 * Versioned trace stream, including build id and next.
 */
export type VersionedTraceStream = {
  buildId: string;
  next: (event: OcctTraceEvent) => OcctTraceEvent;
};

/**
 * Creates monotonically identified trace events for one service request.
 *
 * Why: scheduler messages can arrive concurrently, so the service boundary is
 * the first place that can assign one build ID and a lossless stream order.
 */
export function createVersionedTraceStream(
  request: ServiceRequest,
): VersionedTraceStream {
  const buildId = `build-${request.id}`;
  let sequence = 0;
  return {
    buildId,
    next: (event) => ({
      ...event,
      schemaVersion: 2,
      buildId,
      eventId: `${buildId}:event-${++sequence}`,
      engine: request.engine ?? 'parallel',
      phase: tracePhase(event.kind),
      state: traceState(event.kind),
    }),
  };
}

/**
 * Handles trace phase in the service tracing flow.
 */
function tracePhase(kind: OcctTraceEvent['kind']): OcctTracePhase {
  if (kind.startsWith('build-')) return 'build';
  if (kind.startsWith('part-')) return 'part';
  if (kind === 'selector-resolution') return 'selection';
  if (kind.startsWith('native-boolean')) return 'native-boolean';
  return 'operation';
}

/**
 * Handles trace state in the service tracing flow.
 */
function traceState(kind: OcctTraceEvent['kind']): OcctTraceState {
  if (kind.endsWith('-start')) return 'running';
  if (kind.endsWith('-success') || kind === 'selector-resolution')
    return 'succeeded';
  if (kind.endsWith('-error')) return 'failed';
  if (kind === 'native-boolean-batch-rejected') return 'skipped';
  return 'succeeded';
}
