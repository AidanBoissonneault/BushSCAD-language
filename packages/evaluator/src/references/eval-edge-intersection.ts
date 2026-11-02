/**
 * @author Aidan Boissonneault
 * @file eval-edge-intersection.ts
 * @purpose Evaluates edge intersection for the references in evaluator package.
 * @last-edited October 6, 2026
 */

import type { FaceRef } from '@bushscad/ir';
import type { EvalCtx } from '../core/eval-types.js';
import { addError } from '../core/eval-context.js';

/**
 * Evaluated edge intersection, including owner entity, edge labels, display label, and index.
 */
export type EvaluatedEdgeIntersection = {
  ownerEntity: string;
  edgeLabels: readonly [string, string];
  label: string;
  index?: number;
};

/**
 * Converts authored intersection operands into concrete object-scoped labels.
 * Named edges can be addressed directly under an object or through two `@`
 * aliases. Resolving both forms here keeps the OCCT bridge independent from
 * evaluator name maps and gives generated object instances their final names.
 */
export function evalEdgeIntersection(
  ref: FaceRef,
  ctx: EvalCtx,
): EvaluatedEdgeIntersection | null {
  const position = ref.chain.findIndex(
    (segment) => segment.kind === 'edgeIntersection',
  );
  const segment = ref.chain[position];
  if (position < 0 || segment?.kind !== 'edgeIntersection') return null;

  const edgeLabels =
    position === 1
      ? scopedEdgeLabels(ref, segment, ctx)
      : aliasedEdgeLabels(segment, ctx);
  if (!edgeLabels) return null;
  const ownerEntity = commonOwner(edgeLabels);
  if (!ownerEntity) {
    addError(
      ctx,
      'Intersecting edge aliases must belong to the same object',
      segment.span,
    );
    return null;
  }
  const suffix = segment.index === undefined ? '' : `[${segment.index}]`;
  return {
    ownerEntity,
    edgeLabels,
    label: `${ownerEntity}.(${segment.edges.join(', ')})${suffix}`,
    ...(segment.index === undefined ? {} : { index: segment.index }),
  };
}

/**
 * Handles scoped edge labels in the references flow.
 */
function scopedEdgeLabels(
  ref: FaceRef,
  segment: Extract<FaceRef['chain'][number], { kind: 'edgeIntersection' }>,
  ctx: EvalCtx,
): readonly [string, string] | null {
  const root = ref.chain[0];
  if (root?.kind !== 'name') return null;
  const owner = ctx.names.get(root.value) ?? root.value;
  return [`${owner}.${segment.edges[0]}`, `${owner}.${segment.edges[1]}`];
}

/**
 * Handles aliased edge labels in the references flow.
 */
function aliasedEdgeLabels(
  segment: Extract<FaceRef['chain'][number], { kind: 'edgeIntersection' }>,
  ctx: EvalCtx,
): readonly [string, string] | null {
  const first = ctx.tags.get(segment.edges[0]);
  const second = ctx.tags.get(segment.edges[1]);
  if (first?.kind === 'faceRefValue' && second?.kind === 'faceRefValue') {
    return [first.label, second.label];
  }
  addError(
    ctx,
    'Unscoped edge intersections require two named @ edge aliases',
    segment.span,
  );
  return null;
}

/**
 * Handles common owner in the references flow.
 */
function commonOwner(labels: readonly [string, string]): string | null {
  const first = labels[0].split('.')[0] ?? '';
  const second = labels[1].split('.')[0] ?? '';
  return first && first === second ? first : null;
}
