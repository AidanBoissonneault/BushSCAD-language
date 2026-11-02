/**
 * @author Aidan Boissonneault
 * @file eval-sketch-constraint-metadata.ts
 * @purpose Evaluates sketch constraint metadata for the sketch in evaluator package.
 * @last-edited October 6, 2026
 */

import type {
  ConstraintDecl,
  IRProfileSegment,
  IRSketchConstraint,
} from '@bushscad/ir';
import type { EvalCtx } from '../core/eval-types.js';
import { toSpan } from '../core/eval-context.js';
import { evalNum } from '../expressions/eval-expressions.js';
import { measureSketchDimension } from './eval-sketch-reference-values.js';

/**
 * Emits persistent constraint metadata after geometry has been solved.
 * Editors and renderers need individual relationships and measured driving
 * values, not only the sketch's aggregate solver status.
 */
export function evalSketchConstraintMetadata(
  constraints: ConstraintDecl[],
  segments: IRProfileSegment[],
  ctx: EvalCtx,
): IRSketchConstraint[] | undefined {
  const evaluated = constraints.map((constraint) => ({
    name: constraint.name,
    constraint: constraint.constraint,
    target: constraint.target,
    property: constraint.property,
    ref: constraint.ref,
    axis: constraint.axis,
    value: measuredConstraintValue(constraint, segments),
    label: constraint.label
      ? ([
          evalNum(constraint.label[0], ctx),
          evalNum(constraint.label[1], ctx),
        ] as [number, number])
      : undefined,
    span: toSpan(constraint.span),
  }));
  return evaluated.length > 0 ? evaluated : undefined;
}

/**
 * Handles measured constraint value in the sketch flow.
 */
function measuredConstraintValue(
  constraint: ConstraintDecl,
  segments: IRProfileSegment[],
): number | undefined {
  if (!isDimensional(constraint.constraint)) return undefined;
  return measureSketchDimension(
    constraint.constraint,
    constraint.target,
    constraint.ref,
    constraint.axis,
    segments,
  );
}

/**
 * Returns whether the input meets the `dimensional` condition.
 */
function isDimensional(
  kind: ConstraintDecl['constraint'],
): kind is 'length' | 'distance' | 'angle' | 'radius' | 'diameter' {
  return ['length', 'distance', 'angle', 'radius', 'diameter'].includes(kind);
}
