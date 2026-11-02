/**
 * @author Aidan Boissonneault
 * @file object-operation-resolvers.ts
 * @purpose Provides object operation resolvers behavior for the declarations in resolver package.
 * @last-edited October 6, 2026
 */

import type {
  Expr,
  ObjDecl,
  RadialCutOp,
  RadialExtrudeOp,
  SolidCutOp,
  SolidCutTool,
  SolidPrimitiveOp,
  RepeatableSpatialRef,
} from '@bushscad/ir';
import type { Scope } from '../core/scope.js';
import type { State } from '../core/types.js';
import { addError } from '../core/errors.js';
import { resolveExpr } from '../references/expressions.js';
import { resolveFaceRef, resolveFromRef } from '../references/refs.js';
import {
  resolveNamedObjectInput,
  resolvePathInput,
  resolveSketchInput,
  resolveSurfaceInput,
  resolveThroughTarget,
} from '../references/operand-inputs.js';
import { resolveRadialOp } from './object-radial-resolver.js';
import { validateWrapTarget } from './object-wrap-resolver.js';
import {
  namedSketchInputs,
  registerObjectProfileSegments,
} from './object-profile-segments.js';

/**
 * Derives `OpSpan` from `ObjDecl['operation']['span']` to preserve its type relationship in the
 * declarations layer.
 */
type OpSpan = ObjDecl['operation']['span'];
/**
 * Defines the `ObjResolver` callback contract used by the declarations layer.
 */
type ObjResolver = (stmt: ObjDecl, scope: Scope, state: State) => void;
/**
 * Defines the `ObjOperationResolver` callback contract used by the declarations layer.
 */
type ObjOperationResolver = (
  stmt: ObjDecl,
  scope: Scope,
  state: State,
  resolveObj: ObjResolver,
) => void;

const OBJ_OPERATION_RESOLVERS: Partial<
  Record<ObjDecl['operation']['kind'], ObjOperationResolver>
> = {
  extrude: resolveExtrudeObj,
  cut: resolveCutObj,
  solid_cut: resolveSolidCutObj,
  revolve: resolveRevolveObj,
  radial_extrude: resolveRadialObj,
  radial_cut: resolveRadialObj,
  hole: resolveHoleObj,
  heatset_insert: (stmt, scope, state) =>
    resolveDepthAndFrom(stmt.operation, scope, state),
  loft: resolveLoftObj,
  sweep: resolveSweepObj,
  sweep_cut: resolveSweepCutObj,
  thicken: resolveThickenObj,
  solidPrimitive: (stmt, scope, state) =>
    resolveSolidPrimitiveOp(stmt.operation as SolidPrimitiveOp, scope, state),
};

/**
 * Resolves the operation payload inside an object declaration.
 */
export function resolveObjOperation(
  stmt: ObjDecl,
  scope: Scope,
  state: State,
  resolveObj: ObjResolver,
): void {
  OBJ_OPERATION_RESOLVERS[stmt.operation.kind]?.(
    stmt,
    scope,
    state,
    resolveObj,
  );
}

/**
 * Resolves optional from against the current scope and reports unresolved references.
 */
function resolveOptionalFrom(
  op: { from?: RepeatableSpatialRef | null; span: OpSpan },
  scope: Scope,
  state: State,
): void {
  if (op.from) resolveFromRef(op.from, scope, state, op.span, resolveExpr);
}

/**
 * Resolves depth and from against the current scope and reports unresolved references.
 */
function resolveDepthAndFrom(
  op: { depth?: Expr | null; from?: RepeatableSpatialRef | null; span: OpSpan },
  scope: Scope,
  state: State,
): void {
  if (op.depth) resolveExpr(op.depth, scope, state);
  resolveOptionalFrom(op, scope, state);
}

/**
 * Resolves extrude obj against the current scope and reports unresolved references.
 */
function resolveExtrudeObj(stmt: ObjDecl, scope: Scope, state: State): void {
  const op = stmt.operation as Extract<
    ObjDecl['operation'],
    { kind: 'extrude' }
  >;
  resolveSketchInput(op.sketch, scope, state, 'extrude', !op.wrap);
  resolveExpr(op.depth, scope, state);
  resolveOptionalFrom(op, scope, state);
  validateWrapTarget('extrude', op.wrap, op.from ?? null, op.span, state);
  registerObjectProfileSegments(
    stmt.name,
    namedSketchInputs([op.sketch]),
    state,
  );
}

/**
 * Resolves cut obj against the current scope and reports unresolved references.
 */
function resolveCutObj(stmt: ObjDecl, scope: Scope, state: State): void {
  const op = stmt.operation as Extract<ObjDecl['operation'], { kind: 'cut' }>;
  resolveSketchInput(op.sketch, scope, state, 'cut', !op.wrap);
  resolveThroughTarget(op.through, scope, state, 'through-cut');
  resolveDepthAndFrom(op, scope, state);
  validateWrapTarget('cut', op.wrap, op.from ?? null, op.span, state);
}

/**
 * Resolves solid cut obj against the current scope and reports unresolved references.
 */
function resolveSolidCutObj(
  stmt: ObjDecl,
  scope: Scope,
  state: State,
  resolveObj: ObjResolver,
): void {
  resolveSolidCutOp(
    stmt.operation as Extract<ObjDecl['operation'], { kind: 'solid_cut' }>,
    scope,
    state,
    resolveObj,
  );
}

/**
 * Resolves revolve obj against the current scope and reports unresolved references.
 */
function resolveRevolveObj(stmt: ObjDecl, scope: Scope, state: State): void {
  const op = stmt.operation as Extract<
    ObjDecl['operation'],
    { kind: 'revolve' }
  >;
  resolveSketchInput(op.sketch, scope, state, 'revolve');
  resolveExpr(op.angle, scope, state);
  if (typeof op.around !== 'string') {
    resolveFaceRef(
      op.around,
      scope,
      state,
      op.span,
      resolveExpr,
      'revolve-axis',
    );
  }
  registerObjectProfileSegments(
    stmt.name,
    namedSketchInputs([op.sketch]),
    state,
  );
}

/**
 * Resolves radial obj against the current scope and reports unresolved references.
 */
function resolveRadialObj(stmt: ObjDecl, scope: Scope, state: State): void {
  resolveRadialOp(
    stmt.name,
    stmt.operation as RadialExtrudeOp | RadialCutOp,
    scope,
    state,
  );
}

/**
 * Resolves hole obj against the current scope and reports unresolved references.
 */
function resolveHoleObj(stmt: ObjDecl, scope: Scope, state: State): void {
  const op = stmt.operation as Extract<ObjDecl['operation'], { kind: 'hole' }>;
  resolveThroughTarget(op.through, scope, state, 'hole through-cut');
  resolveDepthAndFrom(op, scope, state);
}

/**
 * Resolves loft obj against the current scope and reports unresolved references.
 */
function resolveLoftObj(stmt: ObjDecl, scope: Scope, state: State): void {
  const op = stmt.operation as Extract<ObjDecl['operation'], { kind: 'loft' }>;
  if (op.sketches.length < 2) {
    addError(state, `loft requires at least two profile sketches`, op.span);
  }
  for (const sketch of op.sketches) {
    resolveSketchInput(sketch, scope, state, 'loft');
  }
  resolveExpr(op.height, scope, state);
  resolveLoftGuide(op, scope, state);
  registerObjectProfileSegments(
    stmt.name,
    namedSketchInputs(op.sketches),
    state,
  );
}

/**
 * Resolves loft guide against the current scope and reports unresolved references.
 */
function resolveLoftGuide(
  op: Extract<ObjDecl['operation'], { kind: 'loft' }>,
  scope: Scope,
  state: State,
): void {
  if (
    op.guide?.kind === 'namedSketch' &&
    scope.lookup(op.guide.name) === null
  ) {
    addError(
      state,
      `Undefined guide sketch '${op.guide.name}' in loft`,
      op.guide.span,
    );
  } else if (op.guide !== null) {
    resolveSketchInput(op.guide, scope, state, 'loft guide');
  }
}

/**
 * Resolves sweep obj against the current scope and reports unresolved references.
 */
function resolveSweepObj(stmt: ObjDecl, scope: Scope, state: State): void {
  const op = stmt.operation as Extract<ObjDecl['operation'], { kind: 'sweep' }>;
  resolveSketchInput(op.sketch, scope, state, 'sweep');
  resolvePathInput(op.path, scope, state, 'sweep');
}

/**
 * Resolves sweep cut obj against the current scope and reports unresolved references.
 */
function resolveSweepCutObj(stmt: ObjDecl, scope: Scope, state: State): void {
  const op = stmt.operation as Extract<
    ObjDecl['operation'],
    { kind: 'sweep_cut' }
  >;
  resolveSketchInput(op.sketch, scope, state, 'sweep cut');
  resolvePathInput(op.path, scope, state, 'sweep cut');
  resolveThroughTarget(op.through, scope, state, 'sweep cut through');
  resolveDepthAndFrom(op, scope, state);
}

/**
 * Resolves thicken obj against the current scope and reports unresolved references.
 */
function resolveThickenObj(stmt: ObjDecl, scope: Scope, state: State): void {
  const op = stmt.operation as Extract<
    ObjDecl['operation'],
    { kind: 'thicken' }
  >;
  resolveSurfaceInput(op.surface, scope, state, 'thicken');
  resolveExpr(op.thickness, scope, state);
}

/**
 * Resolves solid primitive op against the current scope and reports unresolved references.
 */
function resolveSolidPrimitiveOp(
  op: SolidPrimitiveOp,
  scope: Scope,
  state: State,
): void {
  for (const arg of op.args) resolveExpr(arg.value, scope, state);
  if (op.placement) {
    resolveFromRef(op.placement, scope, state, op.span, resolveExpr);
  }
}

/**
 * Resolves solid cut op against the current scope and reports unresolved references.
 */
function resolveSolidCutOp(
  op: SolidCutOp,
  scope: Scope,
  state: State,
  resolveObj: ObjResolver,
): void {
  if (op.tool.kind === 'object') {
    resolveNamedObjectInput(op.tool.object, scope, state, 'solid cut');
  } else {
    resolveInlineSolidTool(op.tool.operation, scope, state, resolveObj);
  }
  resolveFromRef(op.from, scope, state, op.span, resolveExpr);
}

/**
 * Resolves inline solid tool against the current scope and reports unresolved references.
 */
function resolveInlineSolidTool(
  op: Extract<SolidCutTool, { kind: 'operation' }>['operation'],
  scope: Scope,
  state: State,
  resolveObj: ObjResolver,
): void {
  resolveObj(
    {
      kind: 'obj',
      name: '__solid_cut_tool__',
      operation: op,
      anchors: [],
      span: op.span,
    },
    scope,
    state,
  );
}
