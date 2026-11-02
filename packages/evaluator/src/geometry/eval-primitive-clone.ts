/**
 * @author Aidan Boissonneault
 * @file eval-primitive-clone.ts
 * @purpose Evaluates primitive clone for the geometry in evaluator package.
 * @last-edited October 6, 2026
 */

import type { IRPrimitive } from '@bushscad/ir';

/**
 * Clones evaluated sketch primitives before embedding a sketch reference.
 *
 * Nested primitive arrays are copied so later evaluators can transform the
 * clone without mutating the referenced sketch's stored IR.
 */
export function clonePrimitive(primitive: IRPrimitive): IRPrimitive {
  if (primitive.kind === 'rect' && primitive.sideNames) {
    return { ...primitive, sideNames: { ...primitive.sideNames } };
  }
  if (primitive.kind === 'polygon') {
    return { ...primitive, points: primitive.points.map(([x, y]) => [x, y]) };
  }
  if (primitive.kind === 'profile') {
    return {
      ...primitive,
      segments: primitive.segments.map((segment) => ({ ...segment })),
      placementOrigin: primitive.placementOrigin
        ? [...primitive.placementOrigin]
        : undefined,
    };
  }
  if (primitive.kind === 'sketchAt' || primitive.kind === 'sketchAlias') {
    return { ...primitive, primitive: clonePrimitive(primitive.primitive) };
  }
  if (primitive.kind === 'sketchBoolean') {
    return {
      ...primitive,
      left: clonePrimitive(primitive.left),
      right: clonePrimitive(primitive.right),
    };
  }
  return { ...primitive };
}
