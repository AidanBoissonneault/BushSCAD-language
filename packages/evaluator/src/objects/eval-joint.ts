/**
 * @author Aidan Boissonneault
 * @file eval-joint.ts
 * @purpose Evaluates joint for the objects in evaluator package.
 * @last-edited October 6, 2026
 */

import type { JointDecl, IRJoint } from '@bushscad/ir';
import type { EvalCtx } from '../core/eval-types.js';
import { evalNum } from '../expressions/eval-expressions.js';
import { toSpan, addError } from '../core/eval-context.js';

/**
 * Resolves joint ref using the objects rules.
 */
function resolveJointRef(ref: string, ctx: EvalCtx): string {
  const parts = ref.split('.');
  const resolved =
    ctx.placedInstanceRoots.get(parts[0]) ??
    ctx.names.get(parts[0]) ??
    parts[0];
  return [resolved, ...parts.slice(1)].join('.');
}

/**
 * Evaluates joint declaration with the current evaluation context.
 */
export function evalJointDecl(stmt: JointDecl, ctx: EvalCtx): void {
  const limitMin =
    stmt.limitMin !== undefined ? evalNum(stmt.limitMin, ctx) : undefined;
  const limitMax =
    stmt.limitMax !== undefined ? evalNum(stmt.limitMax, ctx) : undefined;
  const defaultValue =
    stmt.defaultValue !== undefined
      ? evalNum(stmt.defaultValue, ctx)
      : undefined;

  if (limitMin !== undefined && limitMax !== undefined && limitMin > limitMax) {
    addError(
      ctx,
      `Joint '${stmt.name}': limitMin (${limitMin}) must be <= limitMax (${limitMax})`,
      stmt.span,
    );
  }
  if (
    defaultValue !== undefined &&
    limitMin !== undefined &&
    limitMax !== undefined &&
    (defaultValue < limitMin || defaultValue > limitMax)
  ) {
    addError(
      ctx,
      `Joint '${stmt.name}': default value ${defaultValue} is outside limit range [${limitMin}, ${limitMax}]`,
      stmt.span,
    );
  }

  const irJoint: IRJoint = {
    kind: 'joint',
    name: stmt.name,
    jointType: stmt.jointType,
    sideA: resolveJointRef(stmt.sideA, ctx),
    sideB: resolveJointRef(stmt.sideB, ctx),
    ...(limitMin !== undefined ? { limitMin } : {}),
    ...(limitMax !== undefined ? { limitMax } : {}),
    ...(defaultValue !== undefined ? { defaultValue } : {}),
    span: toSpan(stmt.span),
  };

  ctx.ops.push(irJoint);
}
