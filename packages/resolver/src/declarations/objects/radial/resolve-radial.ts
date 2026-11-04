/**
 * @author Aidan Boissonneault
 * @file resolve-radial.ts
 * @purpose Provides object radial resolver behavior for the declarations in resolver package.
 * @last-edited October 6, 2026
 */

import type { ObjDecl, RadialCutOp, RadialExtrudeOp } from '@bushscad/ir';
import type { Scope } from '../../../core/scope.js';
import type { State } from '../../../core/types.js';
import { resolveSketchInput } from '../../../references/operand-inputs.js';
import { resolveRadialCurve } from './resolve-radial-curve.js';
import { resolveRadialExtent } from './resolve-radial-extent.js';
import { resolveRadialParameters } from './resolve-radial-parameters.js';
import {
  resolveRadialAxis,
  resolveRadialFrom,
} from './resolve-radial-references.js';
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
  resolveRadialAxis(op, scope, state);
  resolveRadialExtent(op, scope, state);
  resolveRadialParameters(op, scope, state);
  resolveRadialCurve(op, scope, state);
  resolveRadialFrom(op, scope, state);
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

