/** Resolves component body statements and their nested declaration scopes. */

import { resolveSharedStmt } from '../shared-statements.js';
import { resolveCall } from '../call/resolve-call.js';
import { resolveFor } from '../for/resolve-for.js';
import { resolveIf } from '../if/resolve-if.js';
import type {
  ComponentBody,
  ComponentStatement,
  ForStatement,
  IfStatement,
  PlaceStatement,
  PathDecl,
  PlaneDecl,
} from '@bushscad/ir';
import type { Scope } from '../../core/scope.js';
import type { State } from '../../core/types.js';
import { Scope as ScopeClass } from '../../core/scope.js';
import { addError } from '../../core/errors.js';
import { resolveExpr } from '../../references/expressions.js';
import { resolveFn } from '../functions.js';
import { resolveObj } from '../objects.js';
import { resolveFromRef } from '../../references/refs.js';
import { recordSelectorAlias } from '../../references/selector-aliases.js';
import { resolveSketch } from '../../sketch/sketch.js';
import { resolveSurface } from '../../geometry/surface.js';
import { resolveMetadataAssignment } from '../metadata.js';
import { resolvePlace as resolvePlaceStatement } from '../resolve-place-statement.js';
import { isSelectorNameValue } from '../../references/selector-vars.js';
import { resolvePathDecl } from '../resolve-path-declaration.js';
import { resolvePlane } from '../plane/resolve-plane.js';

/**
 * Resolves declarations and commands inside component, part, loop, and branch bodies.
 */
type BodyPredeclare = (stmt: ComponentStatement, scope: Scope) => void;

type BodyStmtResolver = (
  stmt: ComponentStatement,
  scope: Scope,
  state: State,
  allowPartMetadata: boolean,
) => void;

const BODY_PREDECLARES: Partial<
  Record<ComponentStatement['kind'], BodyPredeclare>
> = {
  var: defineNamedBodySymbol('var'),
  env: defineNamedBodySymbol('env'),
  sketch: defineNamedBodySymbol('sketch'),
  surface: defineNamedBodySymbol('surface'),
  path: defineNamedBodySymbol('path'),
  obj: predeclareObj,
  objCall: defineNamedBodySymbol('obj'),
  refPart: defineNamedBodySymbol('component'),
  refObj: defineNamedBodySymbol('obj'),
  fn: defineNamedBodySymbol('fn'),
  plane: defineNamedBodySymbol('plane'),
  anchor: defineNamedBodySymbol('anchor'),
  fit: (stmt, scope) =>
    scope.define(
      (stmt as Extract<ComponentStatement, { kind: 'fit' }>).fitName,
      'fit',
    ),
};

const BODY_STMT_RESOLVERS: Partial<
  Record<ComponentStatement['kind'], BodyStmtResolver>
> = {
  var: resolveBodyVar,
  env: resolveBodyEnv,
  sketch: resolveBodySketch,
  surface: resolveBodySurface,
  path: resolveBodyPath,
  obj: resolveBodyObj,
  objCall: resolveBodyObjCall,
  refPart: resolveBodyRefPart,
  refObj: resolveBodyRefObj,
  fn: resolveBodyFn,
  callStmt: resolveBodyCallStmt,
  return: resolveInvalidReturn,
  for: (stmt, scope, state) =>
    resolveFor(stmt as ForStatement, scope, state, resolveBody),
  if: (stmt, scope, state) =>
    resolveIf(stmt as IfStatement, scope, state, resolveBody),
  metadata: (stmt, scope, state, allowPartMetadata) =>
    resolveMetadataAssignment(
      stmt as Extract<ComponentStatement, { kind: 'metadata' }>,
      scope,
      state,
      allowPartMetadata,
    ),
  place: (stmt, scope, state) =>
    resolvePlaceStatement(stmt as PlaceStatement, scope, state),
  plane: resolveBodyPlane,
  anchor: resolveBodyAnchor,
};

export function resolveBody(
  body: ComponentBody,
  scope: Scope,
  state: State,
  inComponent: boolean,
  allowPartMetadata = false,
): void {
  const prev = state.inComponent;
  state.inComponent = inComponent;
  predeclareBodySymbols(body, scope);
  for (const stmt of body.statements) {
    resolveBodyStmt(stmt, scope, state, allowPartMetadata);
  }
  state.inComponent = prev;
}

/**
 * Predeclares body-local symbols before resolving references.
 *
 * Component bodies support references to later objects and anchor aliases in
 * the same scope, just like the top-level collector does for file-level names.
 */
function predeclareBodySymbols(body: ComponentBody, scope: Scope): void {
  for (const stmt of body.statements) {
    BODY_PREDECLARES[stmt.kind]?.(stmt, scope);
  }
}

/**
 * Handles define named body symbol in the declarations flow.
 */
function defineNamedBodySymbol(kind: Parameters<Scope['define']>[1]) {
  return (stmt: ComponentStatement, scope: Scope): void => {
    scope.define((stmt as ComponentStatement & { name: string }).name, kind);
  };
}

/**
 * Handles predeclare obj in the declarations flow.
 */
function predeclareObj(stmt: ComponentStatement, scope: Scope): void {
  const obj = stmt as Extract<ComponentStatement, { kind: 'obj' }>;
  scope.define(obj.name, 'obj');
  for (const anchor of obj.anchors) scope.define(anchor.name, 'anchor');
}

/**
 * Resolves body stmt against the current scope and reports unresolved references.
 */
function resolveBodyStmt(
  stmt: ComponentStatement,
  scope: Scope,
  state: State,
  allowPartMetadata: boolean,
): void {
  if (resolveSharedStmt(stmt, scope, state)) return;
  BODY_STMT_RESOLVERS[stmt.kind]?.(stmt, scope, state, allowPartMetadata);
}

/**
 * Resolves body var against the current scope and reports unresolved references.
 */
function resolveBodyVar(
  stmt: ComponentStatement,
  scope: Scope,
  state: State,
): void {
  const varStmt = stmt as Extract<ComponentStatement, { kind: 'var' }>;
  if (!isSelectorNameValue(varStmt.value)) {
    resolveExpr(varStmt.value, scope, state);
  }
  scope.define(varStmt.name, 'var');
}

/**
 * Resolves body env against the current scope and reports unresolved references.
 */
function resolveBodyEnv(stmt: ComponentStatement, scope: Scope): void {
  scope.define(
    (stmt as Extract<ComponentStatement, { kind: 'env' }>).name,
    'env',
  );
}

/**
 * Resolves body sketch against the current scope and reports unresolved references.
 */
function resolveBodySketch(
  stmt: ComponentStatement,
  scope: Scope,
  state: State,
): void {
  const sketch = stmt as Extract<ComponentStatement, { kind: 'sketch' }>;
  resolveSketch(sketch, scope, state);
  scope.define(sketch.name, 'sketch');
}

/**
 * Resolves body surface against the current scope and reports unresolved references.
 */
function resolveBodySurface(
  stmt: ComponentStatement,
  scope: Scope,
  state: State,
): void {
  const surface = stmt as Extract<ComponentStatement, { kind: 'surface' }>;
  resolveSurface(surface, scope, state);
  scope.define(surface.name, 'surface');
}

/**
 * Resolves body path against the current scope and reports unresolved references.
 */
function resolveBodyPath(
  stmt: ComponentStatement,
  scope: Scope,
  state: State,
): void {
  const path = stmt as PathDecl;
  resolvePathDecl(path, scope, state);
  scope.define(path.name, 'path');
}

/**
 * Resolves body obj against the current scope and reports unresolved references.
 */
function resolveBodyObj(
  stmt: ComponentStatement,
  scope: Scope,
  state: State,
): void {
  const obj = stmt as Extract<ComponentStatement, { kind: 'obj' }>;
  resolveObj(obj, scope, state);
  scope.define(obj.name, 'obj');
  for (const anchor of obj.anchors) scope.define(anchor.name, 'anchor');
}

/**
 * Resolves body obj call against the current scope and reports unresolved references.
 */
function resolveBodyObjCall(
  stmt: ComponentStatement,
  scope: Scope,
  state: State,
): void {
  const objCall = stmt as Extract<ComponentStatement, { kind: 'objCall' }>;
  resolveCall(objCall.call, objCall.span, scope, state);
  scope.define(objCall.name, 'obj');
}

/**
 * Resolves body ref part against the current scope and reports unresolved references.
 */
function resolveBodyRefPart(
  stmt: ComponentStatement,
  scope: Scope,
  state: State,
): void {
  const refPart = stmt as Extract<ComponentStatement, { kind: 'refPart' }>;
  resolveBody(refPart.body, new ScopeClass(scope), state, true, true);
  scope.define(refPart.name, 'component');
}

/**
 * Resolves body ref obj against the current scope and reports unresolved references.
 */
function resolveBodyRefObj(
  stmt: ComponentStatement,
  scope: Scope,
  state: State,
): void {
  const refObj = stmt as Extract<ComponentStatement, { kind: 'refObj' }>;
  resolveObj(
    {
      kind: 'obj',
      name: refObj.name,
      operation: refObj.operation,
      anchors: [],
      span: refObj.span,
    },
    scope,
    state,
  );
  scope.define(refObj.name, 'obj');
}

/**
 * Resolves body fn against the current scope and reports unresolved references.
 */
function resolveBodyFn(
  stmt: ComponentStatement,
  scope: Scope,
  state: State,
): void {
  const fn = stmt as Extract<ComponentStatement, { kind: 'fn' }>;
  resolveFn(fn, scope, state);
  scope.define(fn.name, 'fn');
}

/**
 * Resolves body call stmt against the current scope and reports unresolved references.
 */
function resolveBodyCallStmt(
  stmt: ComponentStatement,
  scope: Scope,
  state: State,
): void {
  const callStmt = stmt as Extract<ComponentStatement, { kind: 'callStmt' }>;
  resolveCall(callStmt.call, callStmt.span, scope, state);
}

/**
 * Resolves invalid return against the current scope and reports unresolved references.
 */
function resolveInvalidReturn(
  stmt: ComponentStatement,
  _scope: Scope,
  state: State,
): void {
  addError(state, `'return' is only valid inside a function body`, stmt.span);
}

/**
 * Resolves body plane against the current scope and reports unresolved references.
 */
function resolveBodyPlane(
  stmt: ComponentStatement,
  scope: Scope,
  state: State,
): void {
  const plane = stmt as PlaneDecl;
  resolvePlane(plane, scope, state);
  scope.define(plane.name, 'plane');
}

/**
 * Resolves body anchor against the current scope and reports unresolved references.
 */
function resolveBodyAnchor(
  stmt: ComponentStatement,
  scope: Scope,
  state: State,
): void {
  const anchor = stmt as Extract<ComponentStatement, { kind: 'anchor' }>;
  resolveFromRef(anchor.point, scope, state, anchor.span, resolveExpr);
  recordSelectorAlias(anchor.name, anchor.point, scope, state);
  scope.define(anchor.name, 'anchor');
}
