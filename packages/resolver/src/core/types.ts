/**
 * @author Aidan Boissonneault
 * @file types.ts
 * @purpose Provides types behavior for the core in resolver package.
 * @last-edited October 6, 2026
 */

import type { CompileError, ObjectOperation, Program } from '@bushscad/ir';
import type { ResolvedSelectorKind } from '@bushscad/ir';
import type { Scope } from './scope.js';

/**
 * Result of resolve, including ast and errors.
 */
export type ResolveResult = {
  ast: Program;
  errors: CompileError[];
};

/**
 * Defines the `FileLoader` callback contract used by the core layer.
 */
export type FileLoader = (path: string) => string | null;
/**
 * Defines the `AssetLoader` callback contract used by the core layer.
 */
export type AssetLoader = (path: string) => Uint8Array | null;

/**
 * Accepted values for sym kind are 'var', 'env', 'font', 'shape', 'sketch', 'path', 'obj',
 * 'component', 'part', 'fn', 'binding', 'plane', 'anchor', 'param', 'fit', 'joint', and
 * 'surface'.
 */
export type SymKind =
  | 'var'
  | 'env'
  | 'font'
  | 'shape'
  | 'sketch'
  | 'path'
  | 'obj'
  | 'component'
  | 'part'
  | 'fn'
  | 'binding'
  | 'plane'
  | 'anchor'
  | 'param'
  | 'fit'
  | 'joint'
  | 'surface';

/**
 * State for state, including errors, import stack, load file, load asset, and global parts.
 */
export interface State {
  errors: CompileError[];
  importStack: string[];
  loadFile: FileLoader;
  loadAsset?: AssetLoader;
  globalParts: Set<string>;
  globalAnchors: Set<string>;
  selectorAliases: Map<string, ResolvedSelectorKind>;
  profileSketchSegments: Map<string, Set<string>>;
  objectProfileSegments: Map<string, Set<string>>;
  inComponent: boolean;
  inWithinLoop: boolean;
  resolveInlineObjectOperation: (
    operation: ObjectOperation,
    profileName: string,
    scope: Scope,
    state: State,
  ) => void;
}
