/**
 * @author Aidan Boissonneault
 * @file interaction-invocations.ts
 * @purpose Provides interaction invocations behavior for the metadata in evaluator package.
 * @last-edited October 6, 2026
 */

import {
  interactionId,
  type InteractionEntity,
  type InteractionInvocation,
} from '@bushscad/ir';
import type { InteractionInvocationTrace } from '../core/eval-types.js';

/**
 * Resolves evaluator call traces to the concrete semantic entities they emitted.
 * Evaluator unrolling gives every loop/function result a distinct IR name,
 * while source interaction needs to aggregate those instances at one call site.
 */
export function buildInteractionInvocations(
  entrypoint: string,
  traces: readonly InteractionInvocationTrace[],
  entities: readonly InteractionEntity[],
): InteractionInvocation[] {
  const byName = new Map(entities.map((entity) => [entity.name, entity]));
  return traces.flatMap((trace) => {
    const entityIds = [
      ...new Set(
        trace.outputNames
          .map((name) => byName.get(name)?.id)
          .filter((id): id is string => id !== undefined),
      ),
    ];
    if (entityIds.length === 0) return [];
    return [
      {
        id: interactionId(
          'invocation',
          entrypoint,
          trace.linkSpan,
          trace.name,
          entityIds.join(','),
        ),
        name: trace.name,
        span: trace.span,
        linkSpan: trace.linkSpan,
        entityIds,
      },
    ];
  });
}
