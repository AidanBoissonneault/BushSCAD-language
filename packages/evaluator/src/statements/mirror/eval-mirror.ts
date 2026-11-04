/**
 * Emits mirror operations after resolving the mirror plane.
 */
import type { IRMirror, IRMirrorPlane, MirrorStmt } from '@bushscad/ir';
import { toSpan } from '../../core/eval-context.js';
import type { EvalCtx } from '../../core/eval-types.js';
import { serializeFaceRef } from '../../expressions/eval-expressions.js';
import { objectTargetNames } from '../../objects/eval-object-arrays.js';
/**
 * Emits mirror operations after resolving the mirror plane.
 */
export function evalMirror(stmt: MirrorStmt, ctx: EvalCtx): void {
  const across = evalMirrorPlane(stmt.across, ctx);
  for (const objName of objectTargetNames(stmt.target, ctx)) {
    ctx.ops.push({
      kind: 'mirror',
      objName,
      across,
      span: toSpan(stmt.span),
    } satisfies IRMirror);
  }
}

/**
 * Converts a mirror statement plane into the IR mirror plane shape.
 */
function evalMirrorPlane(
  plane: MirrorStmt['across'],
  ctx: EvalCtx,
): IRMirrorPlane {
  if (plane.kind === 'world') {
    return { kind: 'world', axis: plane.axis.toLowerCase() as 'x' | 'y' | 'z' };
  }
  if (plane.kind === 'named') {
    return { kind: 'named', name: plane.name };
  }
  return { kind: 'faceRef', ref: serializeFaceRef(plane.ref, ctx) };
}
