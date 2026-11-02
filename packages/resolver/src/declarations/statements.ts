/**
 * @author Aidan Boissonneault
 * @file statements.ts
 * @purpose Provides statements behavior for the declarations in resolver package.
 * @last-edited October 6, 2026
 */

import type {
  ASTSourceSpan,
  ComponentBody,
  ComponentStatement,
  DefeatureDecl,
  FnCallExpr,
  ForStatement,
  HealDecl,
  IfStatement,
  JointDecl,
  MirrorStmt,
  PathDecl,
  PatternLinearStmt,
  PatternRadialStmt,
  PlaceStatement,
  PlaneDecl,
  RotateStatement,
  TopLevelStatement,
  TransformStmt,
} from '@bushscad/ir';
import { resolveShapeImport } from '../modules/imports.js';
import type { Scope } from '../core/scope.js';
import type { State } from '../core/types.js';
import { Scope as ScopeClass } from '../core/scope.js';
import { addError } from '../core/errors.js';
import { resolveExpr } from '../references/expressions.js';
import { resolveFn } from './functions.js';
import { resolveObj } from './objects.js';
import { resolveFaceRef, resolveFromRef } from '../references/refs.js';
import { recordSelectorAlias } from '../references/selector-aliases.js';
import { resolveSketch } from '../sketch/sketch.js';
import { resolveSheet } from '../geometry/sheet.js';
import { resolveSurface } from '../geometry/surface.js';
import { resolveMetadataAssignment } from './metadata.js';
import { isSelectorNameValue } from '../references/selector-vars.js';
import { resolveForIterator } from './for-iterator.js';
import {
  resolveChamferDetail,
  resolveDraftDetail,
  resolveFilletDetail,
} from './detail-selector-resolvers.js';
import { requireTargetObject } from './object-target-validation.js';
import { resolvePlace as resolvePlaceStatement } from './resolve-place-statement.js';
import {
  resolvePatternLinear,
  resolvePatternRadial,
} from './resolve-pattern-statements.js';
import {
  resolveMirror,
  resolveRotate,
  resolveTransform,
} from './resolve-transform-statements.js';
import {
  isKnownBuiltinLibrary,
  resolvePathDecl,
} from './resolve-path-declaration.js';
import {
  resolveJoint,
  resolvePlane,
} from './resolve-plane-joint-statements.js';

/**
 * Defines the `ResolveImportFn` callback contract used by the declarations layer.
 */
type ResolveImportFn = (
  stmt: Extract<TopLevelStatement, { kind: 'import' }>,
  scope: Scope,
  state: State,
  filePath: string,
) => void;

/**
 * Defines the `ResolveFontImportFn` callback contract used by the declarations layer.
 */
type ResolveFontImportFn = (
  stmt: Extract<TopLevelStatement, { kind: 'fontImport' }>,
  state: State,
  filePath: string,
) => void;

/** Resolves a `heal` declaration: validates its target and tolerance. */
function resolveHeal(stmt: HealDecl, scope: Scope, state: State): void {
  if (stmt.target && scope.lookup(stmt.target) === null) {
    addError(state, `Undefined shape '${stmt.target}' in heal`, stmt.span);
  }
  resolveExpr(stmt.tolerance, scope, state);
}

/** Resolves a `defeature` declaration: validates its target and threshold. */
function resolveDefeature(
  stmt: DefeatureDecl,
  scope: Scope,
  state: State,
): void {
  if (stmt.target && scope.lookup(stmt.target) === null) {
    addError(state, `Undefined shape '${stmt.target}' in defeature`, stmt.span);
  }
  resolveExpr(stmt.threshold, scope, state);
}

/** Resolves a function call: validates the callee name and every argument. */
function resolveCall(
  call: FnCallExpr,
  span: ASTSourceSpan,
  scope: Scope,
  state: State,
): void {
  if (call.name === 'fuse') {
    resolveFuseCall(call, span, scope, state);
    return;
  }
  if (scope.lookup(call.name) === null) {
    addError(state, `Undefined function '${call.name}'`, span);
  }
  for (const arg of call.args) {
    if (!isSelectorNameValue(arg)) resolveExpr(arg, scope, state);
  }
  for (const { value } of call.namedArgs) {
    if (!isSelectorNameValue(value)) resolveExpr(value, scope, state);
  }
}

/**
 * Resolves the built-in `fuse(...)` statement.
 * `fuse` looks like a function call in the grammar, but it mutates OCCT body
 * ownership instead of evaluating a user function. Its arguments must be known
 * solid object names so the evaluator can lower them directly to IR.
 */
function resolveFuseCall(
  call: FnCallExpr,
  span: ASTSourceSpan,
  scope: Scope,
  state: State,
): void {
  if (call.namedArgs.length > 0) {
    addError(state, `fuse(...) only accepts positional object names`, span);
  }
  if (call.args.length < 2) {
    addError(state, `fuse(...) requires at least two object names`, span);
  }
  for (const arg of call.args) {
    if (arg.kind !== 'identifier') {
      addError(state, `fuse(...) arguments must be object names`, arg.span);
      resolveExpr(arg, scope, state);
      continue;
    }
    requireTargetObject(arg.name, scope, state, arg.span, 'fuse');
  }
}

/**
 * Resolves statement kinds handled identically at top level and inside bodies.
 * Returns true if `stmt` was handled, false if the caller must handle it itself.
 */
type Statement = TopLevelStatement | ComponentStatement;

/**
 * Defines the `SharedResolver` callback contract used by the declarations layer.
 */
type SharedResolver = (stmt: Statement, scope: Scope, state: State) => void;

const SHARED_STMT_RESOLVERS: Partial<
  Record<Statement['kind'], SharedResolver>
> = {
  heal: (stmt, scope, state) => resolveHeal(stmt as HealDecl, scope, state),
  defeature: (stmt, scope, state) =>
    resolveDefeature(stmt as DefeatureDecl, scope, state),
  use: resolveUse,
  fit: (stmt, scope) =>
    scope.define((stmt as Extract<Statement, { kind: 'fit' }>).fitName, 'fit'),
  rotate: (stmt, scope, state) =>
    resolveRotate(stmt as RotateStatement, scope, state),
  patternLinear: (stmt, scope, state) =>
    resolvePatternLinear(stmt as PatternLinearStmt, scope, state),
  patternRadial: (stmt, scope, state) =>
    resolvePatternRadial(stmt as PatternRadialStmt, scope, state),
  mirror: (stmt, scope, state) =>
    resolveMirror(stmt as MirrorStmt, scope, state),
  transform: (stmt, scope, state) =>
    resolveTransform(stmt as TransformStmt, scope, state),
  assert: (stmt, scope, state) =>
    resolveExpr(
      (stmt as Extract<Statement, { kind: 'assert' }>).condition,
      scope,
      state,
    ),
  joint: (stmt, scope, state) => resolveJoint(stmt as JointDecl, scope, state),
  sheet: (stmt, scope, state) =>
    resolveSheet(stmt as Extract<Statement, { kind: 'sheet' }>, scope, state),
};

/**
 * Resolves statement kinds handled identically at top level and inside bodies.
 * Returns true if `stmt` was handled, false if the caller must handle it itself.
 */
function resolveSharedStmt(
  stmt: Statement,
  scope: Scope,
  state: State,
): boolean {
  const resolver = SHARED_STMT_RESOLVERS[stmt.kind];
  if (!resolver) return false;
  resolver(stmt, scope, state);
  return true;
}

/**
 * Resolves use against the current scope and reports unresolved references.
 */
function resolveUse(stmt: Statement, _scope: Scope, state: State): void {
  const use = stmt as Extract<Statement, { kind: 'use' }>;
  if (!isKnownBuiltinLibrary(use.library)) {
    addError(state, `Unknown built-in library '${use.library}'`, use.span);
  }
}

/**
 * Context for top stmt, including source file path, resolve import, and resolve font import.
 */
type TopStmtContext = {
  filePath: string;
  resolveImport: ResolveImportFn;
  resolveFontImport: ResolveFontImportFn;
};

/**
 * Defines the `TopStmtResolver` callback contract used by the declarations layer.
 */
type TopStmtResolver = (
  stmt: TopLevelStatement,
  scope: Scope,
  state: State,
  context: TopStmtContext,
) => void;

const TOP_STMT_RESOLVERS: Partial<
  Record<TopLevelStatement['kind'], TopStmtResolver>
> = {
  var: resolveTopVar,
  env: () => {},
  fontImport: (stmt, _scope, state, context) =>
    context.resolveFontImport(
      stmt as Extract<TopLevelStatement, { kind: 'fontImport' }>,
      state,
      context.filePath,
    ),
  shapeImport: (stmt, _scope, state, context) =>
    resolveShapeImport(
      stmt as Extract<TopLevelStatement, { kind: 'shapeImport' }>,
      state,
      context.filePath,
    ),
  sketch: (stmt, scope, state) =>
    resolveSketch(
      stmt as Extract<TopLevelStatement, { kind: 'sketch' }>,
      scope,
      state,
    ),
  surface: (stmt, scope, state) =>
    resolveSurface(
      stmt as Extract<TopLevelStatement, { kind: 'surface' }>,
      scope,
      state,
    ),
  path: (stmt, scope, state) => resolvePathDecl(stmt as PathDecl, scope, state),
  obj: (stmt, scope, state) =>
    resolveObj(
      stmt as Extract<TopLevelStatement, { kind: 'obj' }>,
      scope,
      state,
    ),
  objCall: resolveObjCall,
  fillet: (stmt, scope, state) =>
    resolveFilletDetail(
      stmt as Extract<TopLevelStatement, { kind: 'fillet' }>,
      scope,
      state,
    ),
  place: (stmt, scope, state) =>
    resolvePlaceStatement(stmt as PlaceStatement, scope, state),
  anchor: resolveTopAnchor,
  refPart: resolveTopRefPart,
  refObj: resolveTopRefObj,
  drawing: resolveDrawing,
  part: resolveTopPart,
  fn: (stmt, scope, state) =>
    resolveFn(stmt as Extract<TopLevelStatement, { kind: 'fn' }>, scope, state),
  import: (stmt, scope, state, context) =>
    context.resolveImport(
      stmt as Extract<TopLevelStatement, { kind: 'import' }>,
      scope,
      state,
      context.filePath,
    ),
  export: resolveExport,
};

/**
 * Resolves every statement in a top-level program after collection has run.
 */
export function resolveTopStmt(
  stmt: TopLevelStatement,
  scope: Scope,
  state: State,
  filePath: string,
  resolveImport: ResolveImportFn,
  resolveFontImport: ResolveFontImportFn,
): void {
  if (resolveSharedStmt(stmt, scope, state)) return;
  TOP_STMT_RESOLVERS[stmt.kind]?.(stmt, scope, state, {
    filePath,
    resolveImport,
    resolveFontImport,
  });
}

/**
 * Resolves top var against the current scope and reports unresolved references.
 */
function resolveTopVar(
  stmt: TopLevelStatement,
  scope: Scope,
  state: State,
): void {
  const varStmt = stmt as Extract<TopLevelStatement, { kind: 'var' }>;
  if (!isSelectorNameValue(varStmt.value)) {
    resolveExpr(varStmt.value, scope, state);
  }
}

/**
 * Resolves obj call against the current scope and reports unresolved references.
 */
function resolveObjCall(
  stmt: TopLevelStatement,
  scope: Scope,
  state: State,
): void {
  const objCall = stmt as Extract<TopLevelStatement, { kind: 'objCall' }>;
  resolveCall(objCall.call, objCall.span, scope, state);
}

/**
 * Resolves top anchor against the current scope and reports unresolved references.
 */
function resolveTopAnchor(
  stmt: TopLevelStatement,
  scope: Scope,
  state: State,
): void {
  const anchor = stmt as Extract<TopLevelStatement, { kind: 'anchor' }>;
  resolveFromRef(anchor.point, scope, state, anchor.span, resolveExpr);
  recordSelectorAlias(anchor.name, anchor.point, scope, state);
}

/**
 * Resolves top ref part against the current scope and reports unresolved references.
 */
function resolveTopRefPart(
  stmt: TopLevelStatement,
  scope: Scope,
  state: State,
): void {
  const refPart = stmt as Extract<TopLevelStatement, { kind: 'refPart' }>;
  resolveBody(refPart.body, new ScopeClass(scope), state, true, true);
}

/**
 * Resolves top ref obj against the current scope and reports unresolved references.
 */
function resolveTopRefObj(
  stmt: TopLevelStatement,
  scope: Scope,
  state: State,
): void {
  const refObj = stmt as Extract<TopLevelStatement, { kind: 'refObj' }>;
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
}

/**
 * Resolves drawing against the current scope and reports unresolved references.
 */
function resolveDrawing(
  stmt: TopLevelStatement,
  scope: Scope,
  state: State,
): void {
  const drawing = stmt as Extract<TopLevelStatement, { kind: 'drawing' }>;
  /**
   * Resolves obj name against the current scope and reports unresolved references.
   */
  const resolveObjName = (name: string) => scope.lookup(name.split('.')[0]);
  if (drawing.view.objName && resolveObjName(drawing.view.objName) === null) {
    addError(
      state,
      `Undefined object '${drawing.view.objName}' in drawing view`,
      drawing.view.span,
    );
  }
  for (const dim of drawing.dimensions) {
    resolveDrawingDimension(dim, resolveObjName, state);
  }
}

/**
 * Resolves drawing dimension against the current scope and reports unresolved references.
 */
function resolveDrawingDimension(
  dim: Extract<TopLevelStatement, { kind: 'drawing' }>['dimensions'][number],
  resolveObjName: (name: string) => string | null,
  state: State,
): void {
  if (dim.ref.kind === 'obj_extent') {
    if (resolveObjName(dim.ref.objName) === null) {
      addError(
        state,
        `Undefined object '${dim.ref.objName}' in dimension`,
        dim.span,
      );
    }
    return;
  }
  if (resolveObjName(dim.ref.fromObjName) === null) {
    addError(
      state,
      `Undefined object '${dim.ref.fromObjName}' in dimension`,
      dim.span,
    );
  }
  if (resolveObjName(dim.ref.toObjName) === null) {
    addError(
      state,
      `Undefined object '${dim.ref.toObjName}' in dimension`,
      dim.span,
    );
  }
}

/**
 * Resolves top part against the current scope and reports unresolved references.
 */
function resolveTopPart(
  stmt: TopLevelStatement,
  scope: Scope,
  state: State,
): void {
  const part = stmt as Extract<TopLevelStatement, { kind: 'part' }>;
  resolveBody(part.body, new ScopeClass(scope), state, true, true);
}

/**
 * Resolves export against the current scope and reports unresolved references.
 */
function resolveExport(
  stmt: TopLevelStatement,
  scope: Scope,
  state: State,
  context: TopStmtContext,
): void {
  const exportStmt = stmt as Extract<TopLevelStatement, { kind: 'export' }>;
  resolveTopStmt(
    exportStmt.statement,
    scope,
    state,
    context.filePath,
    context.resolveImport,
    context.resolveFontImport,
  );
}

/**
 * Resolves declarations and commands inside component, part, loop, and branch bodies.
 */
function resolveBody(
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
 * Defines the `BodyPredeclare` callback contract used by the declarations layer.
 */
type BodyPredeclare = (stmt: ComponentStatement, scope: Scope) => void;

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
 * Defines the `BodyStmtResolver` callback contract used by the declarations layer.
 */
type BodyStmtResolver = (
  stmt: ComponentStatement,
  scope: Scope,
  state: State,
  allowPartMetadata: boolean,
) => void;

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
  for: (stmt, scope, state) => resolveFor(stmt as ForStatement, scope, state),
  if: (stmt, scope, state) => resolveIf(stmt as IfStatement, scope, state),
  metadata: (stmt, scope, state, allowPartMetadata) =>
    resolveMetadataAssignment(
      stmt as Extract<ComponentStatement, { kind: 'metadata' }>,
      scope,
      state,
      allowPartMetadata,
    ),
  place: (stmt, scope, state) =>
    resolvePlaceStatement(stmt as PlaceStatement, scope, state),
  fillet: (stmt, scope, state) =>
    resolveFilletDetail(
      stmt as Extract<ComponentStatement, { kind: 'fillet' }>,
      scope,
      state,
    ),
  chamfer: resolveChamferDetail,
  draft: resolveDraftDetail,
  thread: resolveThread,
  shell: resolveShell,
  plane: resolveBodyPlane,
  anchor: resolveBodyAnchor,
};

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
 * Resolves thread against the current scope and reports unresolved references.
 */
function resolveThread(
  stmt: ComponentStatement,
  scope: Scope,
  state: State,
): void {
  const thread = stmt as Extract<ComponentStatement, { kind: 'thread' }>;
  requireTargetObject(thread.target, scope, state, thread.span, 'thread');
  resolveExpr(thread.diameter, scope, state);
  resolveExpr(thread.pitch, scope, state);
  if (thread.length) resolveExpr(thread.length, scope, state);
  if (thread.angle) resolveExpr(thread.angle, scope, state);
}

/**
 * Resolves shell against the current scope and reports unresolved references.
 */
function resolveShell(
  stmt: ComponentStatement,
  scope: Scope,
  state: State,
): void {
  const shell = stmt as Extract<ComponentStatement, { kind: 'shell' }>;
  requireTargetObject(shell.target, scope, state, shell.span, 'shell');
  resolveExpr(shell.thickness, scope, state);
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

/**
 * Resolves for against the current scope and reports unresolved references.
 */
function resolveFor(stmt: ForStatement, scope: Scope, state: State): void {
  resolveForIterator(stmt, scope, state);
  const bodyScope = forBodyScope(stmt, scope);
  if (stmt.where) resolveExpr(stmt.where, bodyScope, state);
  if (stmt.within) resolveWithinClause(stmt, bodyScope, state);
  resolveForBody(stmt, bodyScope, state);
}

/**
 * Handles for body scope in the declarations flow.
 */
function forBodyScope(stmt: ForStatement, scope: Scope): Scope {
  const bodyScope = new ScopeClass(scope);
  const bindings = Array.isArray(stmt.binding) ? stmt.binding : [stmt.binding];
  for (const binding of bindings) bodyScope.define(binding, 'binding');
  return bodyScope;
}

/**
 * Resolves within clause against the current scope and reports unresolved references.
 */
function resolveWithinClause(
  stmt: ForStatement,
  bodyScope: Scope,
  state: State,
): void {
  const within = stmt.within;
  if (!within) return;

  for (const dim of within.dims) resolveWithinDim(dim, bodyScope, state);
  const expected = stmt.iterator.kind === 'grid' ? 2 : 1;
  if (within.dims.length !== expected) {
    addError(
      state,
      `'within' expects ${expected} dimension${expected > 1 ? 's' : ''} for a ${stmt.iterator.kind} loop, got ${within.dims.length}`,
      within.span,
    );
  }
}

/**
 * Resolves within dim against the current scope and reports unresolved references.
 */
function resolveWithinDim(
  dim: NonNullable<ForStatement['within']>['dims'][number],
  bodyScope: Scope,
  state: State,
): void {
  if (dim.kind === 'faceDim') {
    resolveFaceRef(
      dim.ref,
      bodyScope,
      state,
      dim.span,
      resolveExpr,
      'measurement',
    );
  } else {
    resolveExpr(dim.expr, bodyScope, state);
  }
}

/**
 * Resolves for body against the current scope and reports unresolved references.
 */
function resolveForBody(
  stmt: ForStatement,
  bodyScope: Scope,
  state: State,
): void {
  const prevWithin = state.inWithinLoop;
  if (stmt.within) state.inWithinLoop = true;
  resolveBody(stmt.body, bodyScope, state, state.inComponent, false);
  state.inWithinLoop = prevWithin;
}

/**
 * Resolves if against the current scope and reports unresolved references.
 */
function resolveIf(stmt: IfStatement, scope: Scope, state: State): void {
  resolveExpr(stmt.condition, scope, state);
  resolveBody(
    stmt.then,
    new ScopeClass(scope),
    state,
    state.inComponent,
    false,
  );
  if (stmt.else)
    resolveBody(
      stmt.else,
      new ScopeClass(scope),
      state,
      state.inComponent,
      false,
    );
}
