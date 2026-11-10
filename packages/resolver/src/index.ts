/**
 * @author Aidan Boissonneault
 * @file index.ts
 * @purpose Public entry point for resolver package.
 * @last-edited October 6, 2026
 */

import type { Program } from '@bushscad/ir';
import {
  collectGlobalAnchors,
  collectTopLevel,
} from './declarations/collect.js';
import { resolveProgram } from './core/program.js';
import { Scope } from './core/scope.js';
import { resolveInlineObjectOperation } from './declarations/objects.js';
import type {
  AssetLoader,
  FileLoader,
  ResolveResult,
  State,
} from './core/types.js';

export type { AssetLoader, FileLoader, ResolveResult } from './core/types.js';
export { Scope } from './core/scope.js';

/**
 * Resolves an AST program and returns the same AST plus collected diagnostics.
 * The resolver validates cross-reference correctness after parsing, including
 * imports, sketches, object operations, placement references, and body scopes.
 */
export function resolve(
  ast: Program,
  filePath: string,
  loadFile: FileLoader,
  loadAsset?: AssetLoader,
): ResolveResult {
  const state: State = {
    errors: [],
    importStack: [filePath],
    loadFile,
    loadAsset,
    globalParts: new Set(),
    globalAnchors: new Set(),
    selectorAliases: new Map(),
    profileSketchSegments: new Map(),
    objectProfileSegments: new Map(),
    inComponent: false,
    inWithinLoop: false,
    resolveInlineObjectOperation,
  };

  const globalScope = new Scope();
  collectGlobalAnchors(ast, state.globalAnchors);
  collectTopLevel(ast, globalScope, state);
  resolveProgram(ast, globalScope, state, filePath);

  return { ast, errors: state.errors };
}
