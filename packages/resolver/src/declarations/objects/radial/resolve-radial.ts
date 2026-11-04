/**
 * @author Aidan Boissonneault
 * @file resolve-radial.ts
 * @purpose Provides object radial resolver behavior for the declarations in resolver package.
 * @last-edited October 6, 2026
 */

import type { ObjDecl, RadialCutOp, RadialExtrudeOp } from '@bushscad/ir';
import type { Scope } from '../../../core/scope.js';
import type { State } from '../../../core/types.js';
import { addError } from '../../../core/errors.js';
import { resolveExpr } from '../../../references/expressions.js';
import { resolveFaceRef, resolveFromRef } from '../../../references/refs.js';
import { resolveSketchInput } from '../../../references/operand-inputs.js';
import {
  namedSketchInputs,
  registerObjectProfileSegments,
} from '../profile-segments/profile-segments.js';

/**
 * Resolves the sketch, axis, extent, and curve expressions for radial object
 * operations.
 */
export function resolveRadialOp(
  objName: string,
  op: RadialExtrudeOp | RadialCutOp,
  scope: Scope,
  state: State,
): void {
  resolveSketchInput(
    op.sketch,
    scope,
    state,
    op.kind === 'radial_extrude' ? 'radial_extrude' : 'radial_cut',
  );
  if (op.axis && typeof op.axis !== 'string') {
    resolveFaceRef(op.axis, scope, state, op.span, resolveExpr, 'revolve-axis');
  }
  resolveRadialExtent(op, scope, state);
  if (op.start) resolveExpr(op.start, scope, state);
  if (op.twist) resolveExpr(op.twist, scope, state);
  if (op.taper) resolveExpr(op.taper, scope, state);
  if (op.radius) resolveExpr(op.radius, scope, state);
  if (op.sections.kind === 'expr') resolveExpr(op.sections.value, scope, state);
  if (op.curve.kind === 'cubic-bezier') {
    resolveExpr(op.curve.x1, scope, state);
    resolveExpr(op.curve.y1, scope, state);
    resolveExpr(op.curve.x2, scope, state);
    resolveExpr(op.curve.y2, scope, state);
  }
  if (op.from) resolveFromRef(op.from, scope, state, op.span, resolveExpr);
  registerObjectProfileSegments(objName, namedSketchInputs([op.sketch]), state);
}

/** Resolves a radial operation object while retaining its declared object name. */
export function resolveRadialObj(
  stmt: ObjDecl,
  scope: Scope,
  state: State,
): void {
  resolveRadialOp(
    stmt.name,
    stmt.operation as RadialExtrudeOp | RadialCutOp,
    scope,
    state,
  );
}

/**
 * Resolves radial extent against the current scope and reports unresolved references.
 */
function resolveRadialExtent(
  op: RadialExtrudeOp | RadialCutOp,
  scope: Scope,
  state: State,
): void {
  if (op.extent.kind === 'angle-length') {
    resolveExpr(op.extent.angle, scope, state);
    resolveExpr(op.extent.length, scope, state);
  } else if (op.extent.kind === 'between') {
    resolveFromRef(op.extent.a, scope, state, op.span, resolveExpr);
    resolveFromRef(op.extent.b, scope, state, op.span, resolveExpr);
  } else {
    resolveFromRef(op.extent.from, scope, state, op.span, resolveExpr);
    resolveFromRef(op.extent.to, scope, state, op.span, resolveExpr);
    if (op.extent.along && scope.lookup(op.extent.along) !== 'path') {
      addError(
        state,
        `Undefined path '${op.extent.along}' in radial operation`,
        op.span,
      );
    }
  }
}
