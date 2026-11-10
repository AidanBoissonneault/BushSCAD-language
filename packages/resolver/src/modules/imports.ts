/**
 * @author Aidan Boissonneault
 * @file imports.ts
 * @purpose Provides imports behavior for the modules in resolver package.
 * @last-edited October 6, 2026
 */

import type {
  ExportDecl,
  FontImportDecl,
  ShapeImportDecl,
  ImportDecl,
  Program,
} from '@bushscad/ir';
import { parse } from '@bushscad/parser';
import { Scope } from '../core/scope.js';
import type { State } from '../core/types.js';
import {
  collectGlobalAnchors,
  collectTopLevel,
} from '../declarations/collect.js';
import { addError } from '../core/errors.js';
import {
  collectExports,
  defineImportedExport,
  exportWithName,
} from './exports.js';
import {
  importedFontFsPath,
  importedShapeFsPath,
  resolvePath,
} from '../sketch/paths.js';

/**
 * Defines the `ResolveProgramFn` callback contract used by the modules layer.
 */
type ResolveProgramFn = (
  ast: Program,
  scope: Scope,
  state: State,
  filePath: string,
) => void;

/**
 * Resolves an import declaration by parsing the imported file and exposing its exports.
 */
export function resolveImport(
  stmt: ImportDecl,
  scope: Scope,
  state: State,
  filePath: string,
  resolveProgram: ResolveProgramFn,
): void {
  const importPath = resolvePath(filePath, stmt.path);
  stmt.resolved = [];

  if (state.importStack.includes(importPath)) {
    const cycle = [...state.importStack, importPath].join(' → ');
    addError(state, `Circular import: ${cycle}`, stmt.span);
    return;
  }

  const source = state.loadFile(importPath);
  if (source === null) {
    addError(state, `Cannot load import '${stmt.path}'`, stmt.span);
    return;
  }

  const importedAst = resolveImportedProgram(
    source,
    importPath,
    stmt.path,
    state,
    resolveProgram,
  );

  const exports = collectExports(importedAst);
  const dependencies = importDependencies(importedAst);

  if (stmt.names === null && stmt.namespace === null) {
    const resolved = [...exports.values()];
    stmt.resolved = [...dependencies, ...resolved];
    for (const exp of resolved) defineImportedExport(scope, state, exp);
  } else if (stmt.namespace !== null) {
    scope.define(stmt.namespace, 'component');
  } else if (stmt.names !== null) {
    const resolved = resolveNamedImports(stmt, exports, scope, state);
    stmt.resolved = [...dependencies, ...resolved];
  }
}

/**
 * Resolves imported program against the current scope and reports unresolved references.
 */
function resolveImportedProgram(
  source: string,
  importPath: string,
  sourcePath: string,
  state: State,
  resolveProgram: ResolveProgramFn,
): Program {
  const parsed = parse(source, importPath);
  appendParseErrors(parsed, sourcePath, state);
  const childState = childImportState(state, importPath);
  const childScope = new Scope();
  collectGlobalAnchors(parsed.ast, childState.globalAnchors);
  collectTopLevel(parsed.ast, childScope, childState);
  resolveProgram(parsed.ast, childScope, childState, importPath);
  return parsed.ast;
}

/**
 * Appends parse errors to the current output.
 */
function appendParseErrors(
  parsed: ReturnType<typeof parse>,
  sourcePath: string,
  state: State,
): void {
  for (const error of parsed.errors) {
    state.errors.push({
      message: `In '${sourcePath}': ${error.message}`,
      span: {
        file: error.span.file,
        line: error.span.line,
        col: error.span.col,
        endLine: error.span.endLine,
        endCol: error.span.endCol,
      },
    });
  }
}

/**
 * Handles child import state in the modules flow.
 */
function childImportState(state: State, importPath: string): State {
  return {
    errors: state.errors,
    importStack: [...state.importStack, importPath],
    loadFile: state.loadFile,
    loadAsset: state.loadAsset,
    globalParts: new Set(state.globalParts),
    globalAnchors: new Set(state.globalAnchors),
    selectorAliases: new Map(state.selectorAliases),
    profileSketchSegments: new Map(state.profileSketchSegments),
    objectProfileSegments: new Map(state.objectProfileSegments),
    inComponent: false,
    inWithinLoop: false,
    resolveInlineObjectOperation: state.resolveInlineObjectOperation,
  };
}

/**
 * Imports dependencies into the current workspace.
 */
function importDependencies(
  ast: Program,
): Array<ImportDecl | FontImportDecl | ShapeImportDecl> {
  return ast.statements.filter(
    (statement): statement is ImportDecl | FontImportDecl | ShapeImportDecl =>
      statement.kind === 'import' ||
      statement.kind === 'fontImport' ||
      statement.kind === 'shapeImport',
  );
}

/**
 * Resolves named imports against the current scope and reports unresolved references.
 */
function resolveNamedImports(
  stmt: ImportDecl,
  exports: Map<string, ExportDecl>,
  scope: Scope,
  state: State,
): ExportDecl[] {
  const resolved: ExportDecl[] = [];
  for (const { name, alias } of stmt.names ?? []) {
    const exp = exports.get(name);
    if (!exp) {
      addError(state, `'${name}' not found in '${stmt.path}'`, stmt.span);
      continue;
    }
    const imported = exportWithName(exp, alias ?? name);
    defineImportedExport(scope, state, imported);
    resolved.push(imported);
  }
  return resolved;
}

/**
 * Resolves and validates a font import path and optional asset load.
 */
export function resolveFontImport(
  stmt: FontImportDecl,
  state: State,
  filePath: string,
): void {
  const resolvedPath = resolvePath(filePath, stmt.path);
  stmt.resolvedPath = resolvedPath;
  stmt.fsPath = importedFontFsPath(resolvedPath);
  validateImportedAsset(stmt, state, resolvedPath, 'font', ['.ttf', '.otf']);
}

/**
 * Resolves and validates a shape import path and optional asset load.
 */
export function resolveShapeImport(
  stmt: ShapeImportDecl,
  state: State,
  filePath: string,
): void {
  const resolvedPath = resolvePath(filePath, stmt.path);
  stmt.resolvedPath = resolvedPath;
  stmt.fsPath = importedShapeFsPath(resolvedPath);
  validateImportedAsset(stmt, state, resolvedPath, 'shape', [
    '.step',
    '.stp',
    '.stl',
  ]);
}

/** Validates an imported asset's file extension and that it loads. */
function validateImportedAsset(
  stmt: FontImportDecl | ShapeImportDecl,
  state: State,
  resolvedPath: string,
  kind: string,
  extensions: string[],
): void {
  const lower = resolvedPath.toLowerCase();
  if (!extensions.some((ext) => lower.endsWith(ext))) {
    addError(
      state,
      `Imported ${kind} '${stmt.path}' must be a ${extensions.join(' or ')} file`,
      stmt.span,
    );
    return;
  }
  if (state.loadAsset && state.loadAsset(resolvedPath) === null) {
    addError(state, `Cannot load ${kind} '${stmt.path}'`, stmt.span);
  }
}
