/**
 * @author Aidan Boissonneault
 * @file eval-sketch-component-members.ts
 * @purpose Evaluates sketch component members for the sketch in evaluator package.
 * @last-edited October 6, 2026
 */

import type { IRPrimitive } from '@bushscad/ir';

const RECTANGLE_MEMBERS = ['bottom', 'right', 'top', 'left'] as const;

/** Collects exact selectable member paths introduced by sketch `as` wrappers. */
export function evaluatedSketchComponentMembers(
  primitive: IRPrimitive,
  parent: readonly string[] = [],
): Set<string> {
  if (primitive.kind === 'sketchAlias') {
    return evaluatedSketchComponentMembers(primitive.primitive, [
      ...parent,
      primitive.name,
    ]);
  }
  if (primitive.kind === 'sketchBoolean') {
    return new Set([
      ...evaluatedSketchComponentMembers(primitive.left, parent),
      ...evaluatedSketchComponentMembers(primitive.right, parent),
    ]);
  }
  if (primitive.kind === 'sketchAt') {
    return evaluatedSketchComponentMembers(primitive.primitive, parent);
  }
  if (parent.length === 0) return new Set();
  const members =
    primitive.kind === 'rect'
      ? [...RECTANGLE_MEMBERS, ...Object.values(primitive.sideNames ?? {})]
      : primitive.kind === 'profile'
        ? primitive.segments.map((segment) => segment.name)
        : [];
  const prefix = `${parent.join('.')}.`;
  return new Set(members.map((member) => `${prefix}${member}`));
}
