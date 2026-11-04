/** Coordinates predeclaration and resolution of nested body statements. */
import { resolveSharedStmt } from '../shared-statements.js';
import { resolveFor } from '../for/resolve-for.js';
import { resolveIf } from '../if/resolve-if.js';
import type {
  ComponentBody,
  ComponentStatement,
  ForStatement,
  IfStatement,
  PlaceStatement,
} from '@bushscad/ir';
import type { Scope } from '../../core/scope.js';
import type { State } from '../../core/types.js';
import { resolveMetadataAssignment } from '../metadata.js';
import { resolvePlace as resolvePlaceStatement } from '../resolve-place-statement.js';
import { resolveBodyVar } from './var/resolve-body-var.js';
import { resolveBodyEnv } from './env/resolve-body-env.js';
import { resolveBodySketch } from './sketch/resolve-body-sketch.js';
import { resolveBodySurface } from './surface/resolve-body-surface.js';
import { resolveBodyPath } from './path/resolve-body-path.js';
import { resolveBodyObj } from './obj/resolve-body-obj.js';
import { resolveBodyObjCall } from './obj-call/resolve-body-obj-call.js';
import { resolveBodyRefPart } from './ref-part/resolve-body-ref-part.js';
import { resolveBodyRefObj } from './ref-obj/resolve-body-ref-obj.js';
import { resolveBodyFn } from './fn/resolve-body-fn.js';
import { resolveBodyCallStmt } from './call/resolve-body-call.js';
import { resolveInvalidReturn } from './return/resolve-body-return.js';
import { resolveBodyPlane } from './plane/resolve-body-plane.js';
import { resolveBodyAnchor } from './anchor/resolve-body-anchor.js';

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
  refPart: (stmt, scope, state) =>
    resolveBodyRefPart(stmt, scope, state, resolveBody),
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
  for (const stmt of body.statements)
    resolveBodyStmt(stmt, scope, state, allowPartMetadata);
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
