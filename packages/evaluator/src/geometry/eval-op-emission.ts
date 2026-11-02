/**
 * @author Aidan Boissonneault
 * @file eval-op-emission.ts
 * @purpose Evaluates op emission for the geometry in evaluator package.
 * @last-edited October 6, 2026
 */

import type { IRPath, ObjectOperation, PathDecl } from '@bushscad/ir';
import type { EvalCtx } from '../core/eval-types.js';
import { fresh, toSpan } from '../core/eval-context.js';
import { evalPathPrimitive } from './eval-inline-operands.js';
import { evalSolidCutOp } from './eval-solid-cut.js';
import { evalSurfaceThicken } from './eval-surface.js';
import { evalSolidPrimitiveOp } from './eval-solid-primitives.js';
import {
  evalExtrudeOp,
  evalCutOp,
  evalSweepCutOp,
} from './eval-linear-object-ops.js';
import { evalHoleOp, evalHeatsetInsertOp } from './eval-hardware-object-ops.js';
import {
  evalLoftOp,
  evalRevolveOp,
  evalSweepOp,
} from './eval-profile-object-ops.js';
import { evalRadialOp } from './eval-radial-object-ops.js';
import { expandObjectOperationVariants } from './eval-object-op-variants.js';

export { resolveInlineMaterial } from './eval-material-inline.js';
export {
  emitHoleSketchAndCut,
  offsetIRPlacement,
} from './eval-hardware-object-ops.js';
export { emitSketchOp } from './eval-sketch-op-emission.js';

/**
 * Defines the `ObjectOpHandler` callback contract used by the geometry layer.
 */
type ObjectOpHandler<K extends ObjectOperation['kind']> = (
  astName: string,
  irName: string,
  op: Extract<ObjectOperation, { kind: K }>,
  ctx: EvalCtx,
) => string;

const OBJECT_OP_HANDLERS: {
  [K in ObjectOperation['kind']]: ObjectOpHandler<K>;
} = {
  extrude: evalExtrudeOp,
  cut: evalCutOp,
  solid_cut: (astName, _irName, op, ctx) => evalSolidCutOp(astName, op, ctx),
  hole: (astName, _irName, op, ctx) => evalHoleOp(astName, op, ctx),
  heatset_insert: (astName, _irName, op, ctx) =>
    evalHeatsetInsertOp(astName, op, ctx),
  thicken: (astName, _irName, op, ctx) => evalSurfaceThicken(astName, op, ctx),
  solidPrimitive: evalSolidPrimitiveOp,
  revolve: evalRevolveOp,
  radial_extrude: evalRadialOp,
  radial_cut: evalRadialOp,
  sweep: evalSweepOp,
  sweep_cut: evalSweepCutOp,
  loft: evalLoftOp,
};

/** Emits a path declaration into IR and records the resolved path name. */
export function evalPathDecl(decl: PathDecl, ctx: EvalCtx): void {
  const irName = ctx.names.get(decl.name) ?? decl.name;
  ctx.ops.push({
    kind: 'path',
    name: irName,
    primitive: evalPathPrimitive(decl.primitive, ctx),
    span: toSpan(decl.span),
  } satisfies IRPath);
  ctx.names.set(decl.name, irName);
}

/**
 * Lowers an object operation into IR, expanding repeated sketch or placement operands first.
 * `obj` declarations are the public entrypoint for many geometry operations,
 * but each concrete operation owns its detailed lowering rules in focused modules.
 */
export function evalObjOp(
  astName: string,
  op: ObjectOperation,
  ctx: EvalCtx,
): string {
  const variants = expandObjectOperationVariants(op, ctx);
  if (variants.length > 1) return evalRepeatedObjectOps(astName, variants, ctx);

  const irName = ctx.names.get(astName) ?? astName;
  return evalSingleObjectOp(astName, irName, op, ctx);
}

/**
 * Evaluates repeated object ops with the current evaluation context.
 */
function evalRepeatedObjectOps(
  astName: string,
  variants: ObjectOperation[],
  ctx: EvalCtx,
): string {
  let firstName = astName;
  const emittedNames: string[] = [];
  variants.forEach((variant, index) => {
    const variantName = index === 0 ? astName : fresh(ctx, astName);
    const emittedName = evalObjOp(variantName, variant, ctx);
    emittedNames.push(emittedName);
    if (index === 0) firstName = emittedName;
  });
  ctx.names.set(astName, firstName);
  ctx.values.set(
    astName,
    emittedNames.map((label) => ({ kind: 'faceRefValue' as const, label })),
  );
  return firstName;
}

/**
 * Evaluates single object op with the current evaluation context.
 */
function evalSingleObjectOp(
  astName: string,
  irName: string,
  op: ObjectOperation,
  ctx: EvalCtx,
): string {
  const handler = OBJECT_OP_HANDLERS[op.kind] as ObjectOpHandler<
    typeof op.kind
  >;
  return handler(astName, irName, op as never, ctx);
}
