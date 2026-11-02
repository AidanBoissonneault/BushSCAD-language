/**
 * @author Aidan Boissonneault
 * @file scheduler-preflight.ts
 * @purpose Provides scheduler preflight behavior for the pipeline parallel compilation in compiler package.
 * @last-edited October 6, 2026
 */

import type { CompilationGraph, SourceSpan } from '@bushscad/ir';
import { schedulerLane } from './scheduler-dispatch.js';
import type {
  SchedulerCapacity,
  SchedulerError,
  SchedulerSimulationOptions,
} from './scheduler-types.js';
import { validateCompilationGraph } from './validate-compilation-graph.js';

export const SCHEDULER_FALLBACK_SPAN: SourceSpan = Object.freeze({
  file: '(compilation-scheduler)',
  line: 1,
  col: 1,
});

/**
 * Type used for scheduler preflight.
 */
export type SchedulerPreflight = Readonly<{
  capacity: SchedulerCapacity;
  errors: readonly SchedulerError[];
}>;

/** Rejects invalid graphs, lane limits, pool sizes, and unready geometry pools. */
export function schedulerPreflight(
  graph: CompilationGraph,
  options: SchedulerSimulationOptions,
  metadataConcurrency: number,
): SchedulerPreflight {
  const capacity = options.workerPool.capacity();
  const errors: SchedulerError[] = validateCompilationGraph(graph).map(
    (diagnostic) => ({
      code: 'invalid-graph',
      message: `${diagnostic.code}: ${diagnostic.message}`,
      ...(diagnostic.nodeIds[0] ? { nodeId: diagnostic.nodeIds[0] } : {}),
      span: diagnostic.span,
    }),
  );
  if (!capacity.ok)
    errors.push(
      ...capacity.issues.map((message) => ({
        code: 'capacity' as const,
        message,
        span: SCHEDULER_FALLBACK_SPAN,
      })),
    );
  if (!Number.isInteger(metadataConcurrency) || metadataConcurrency < 1)
    errors.push({
      code: 'capacity',
      message: 'Metadata concurrency must be a positive integer.',
      span: SCHEDULER_FALLBACK_SPAN,
    });
  if (
    capacity.ok &&
    capacity.effectiveWorkerCount === 0 &&
    graph.nodes.some((node) => schedulerLane(node) === 'geometry')
  )
    errors.push({
      code: 'capacity',
      message: 'No ready healthy geometry workers are available.',
      span: SCHEDULER_FALLBACK_SPAN,
    });
  return Object.freeze({ capacity, errors: Object.freeze(errors) });
}
