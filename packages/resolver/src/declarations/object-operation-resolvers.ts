/** Dispatches object declarations to operation-specific resolvers. */
import type { ObjDecl } from '@bushscad/ir';
import type { Scope } from '../core/scope.js';
import type { State } from '../core/types.js';
import type { ObjOperationResolver, ObjResolver } from './objects/types.js';
import { resolveExtrudeObj } from './objects/extrude/resolve-extrude.js';
import { resolveCutObj } from './objects/cut/resolve-cut.js';
import { resolveSolidCutObj } from './objects/solid-cut/resolve-solid-cut.js';
import { resolveRevolveObj } from './objects/revolve/resolve-revolve.js';
import { resolveRadialObj } from './objects/radial/resolve-radial.js';
import { resolveHoleObj } from './objects/hole/resolve-hole.js';
import { resolveHeatsetInsert } from './objects/heatset-insert/resolve-heatset-insert.js';
import { resolveLoftObj } from './objects/loft/resolve-loft.js';
import { resolveSweepObj } from './objects/sweep/resolve-sweep.js';
import { resolveSweepCutObj } from './objects/sweep-cut/resolve-sweep-cut.js';
import { resolveThickenObj } from './objects/thicken/resolve-thicken.js';
import { resolveSolidPrimitiveOp } from './objects/solid-primitive/resolve-solid-primitive.js';

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
  heatset_insert: resolveHeatsetInsert,
  loft: resolveLoftObj,
  sweep: resolveSweepObj,
  sweep_cut: resolveSweepCutObj,
  thicken: resolveThickenObj,
  solidPrimitive: (stmt, scope, state) =>
    resolveSolidPrimitiveOp(
      stmt.operation as Extract<
        ObjDecl['operation'],
        { kind: 'solidPrimitive' }
      >,
      scope,
      state,
    ),
};

/** Resolves the operation payload inside an object declaration. */
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
