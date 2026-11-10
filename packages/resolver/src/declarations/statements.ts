/**
 * @author Aidan Boissonneault
 * @file statements.ts
 * @purpose Provides statements behavior for the declarations in resolver package.
 * @last-edited October 6, 2026
 */

import { resolveTopVar } from './variables/top-level-variable.js';
import { resolveObjCall } from './call/resolve-object-call.js';
import { resolveTopAnchor } from './references/resolve-top-level-references.js';
import { resolveTopRefPart } from './references/resolve-top-level-references.js';
import { resolveTopRefObj } from './references/resolve-top-level-references.js';
import { resolveDrawing } from './drawing/resolve-drawing.js';
import { resolveTopPart } from './part/resolve-top-part.js';
import { resolveExport } from './exports/resolve-export.js';
import { resolveSharedStmt } from './shared-statements.js';
import type {
  ResolveFontImportFn,
  ResolveImportFn,
  TopStmtContext,
} from './top-level-context.js';
import type { PathDecl, PlaceStatement, TopLevelStatement } from '@bushscad/ir';
import { resolveShapeImport } from '../modules/imports.js';
import type { Scope } from '../core/scope.js';
import type { State } from '../core/types.js';
import { resolveFn } from './functions.js';
import { resolveAnonymousObj, resolveObj } from './objects.js';
import { resolveSketch } from '../sketch/sketch.js';
import { resolveSurface } from '../geometry/surface.js';
import { resolvePlace as resolvePlaceStatement } from './resolve-place-statement.js';
import { resolvePathDecl } from './resolve-path-declaration.js';

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
  anonymousObj: (stmt, scope, state) =>
    resolveAnonymousObj(
      stmt as Extract<TopLevelStatement, { kind: 'anonymousObj' }>,
      scope,
      state,
    ),
  objCall: resolveObjCall,
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
    resolveTopStmt: (nestedStmt, nestedScope, nestedState, context) =>
      resolveTopStmt(
        nestedStmt,
        nestedScope,
        nestedState,
        context.filePath,
        context.resolveImport,
        context.resolveFontImport,
      ),
  });
}
