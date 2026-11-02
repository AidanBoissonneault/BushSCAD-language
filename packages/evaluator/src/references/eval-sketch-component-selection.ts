/**
 * @author Aidan Boissonneault
 * @file eval-sketch-component-selection.ts
 * @purpose Evaluates sketch component selection for the references in evaluator package.
 * @last-edited October 6, 2026
 */

import type { FaceRef } from '@bushscad/ir';
import type { EvalCtx } from '../core/eval-types.js';

/**
 * Selection of evaluated sketch component, including owner entity, component path, member, and
 * display label.
 */
export type EvaluatedSketchComponentSelection = {
  ownerEntity: string;
  componentPath: readonly string[];
  member: string;
  label: string;
};

/** Recognizes an exact member path emitted by a sketch `as` component. */
export function evalSketchComponentSelection(
  ref: FaceRef,
  ctx: EvalCtx,
): EvaluatedSketchComponentSelection | null {
  const names = ref.chain.map((segment) =>
    segment.kind === 'name' ? segment.value : null,
  );
  if (names.some((name) => name === null) || names.length < 3) return null;
  const values = names as string[];
  const memberPath = values.slice(1).join('.');
  if (!ctx.sketchComponentMembers?.has(memberPath)) return null;
  const ownerEntity = ctx.names.get(values[0]!) ?? values[0]!;
  const componentPath = values.slice(1, -1);
  const member = values.at(-1)!;
  return {
    ownerEntity,
    componentPath,
    member,
    label: [ownerEntity, ...componentPath, member].join('.'),
  };
}
