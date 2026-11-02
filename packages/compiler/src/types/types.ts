/**
 * @author Aidan Boissonneault
 * @file types.ts
 * @purpose Provides types behavior for the types in compiler package.
 * @last-edited October 6, 2026
 */

import type {
  CompileError,
  CompileAssets,
  IRProgram,
  SourceSpan,
  DrawingProgram,
} from '@bushscad/ir';
import type { EnvOverrideValue } from '@bushscad/evaluator';
import type { FileLoader } from '@bushscad/resolver';
import type { WorkspaceIndex } from '../workspace/types.js';

/**
 * Type used for env value.
 */
export type EnvValue = EnvOverrideValue;
/**
 * Accepted values for env value type are 'number', 'string', 'boolean', and 'list'.
 */
export type EnvValueType = 'number' | 'string' | 'boolean' | 'list';
/**
 * Lookup from string keys to string values.
 */
export type RawEnvOverrides = Record<string, string>;

/**
 * Entry in env manifest, including name, value kind, fallback, and span.
 */
export type EnvManifestEntry = {
  name: string;
  type: EnvValueType;
  fallback: EnvValue;
  span: SourceSpan;
};

/**
 * Input for compile source, including source, source file path, workspace root, load file, and
 * load asset.
 */
export type CompileSourceInput = {
  source: string;
  filePath: string;
  rootPath?: string | null;
  loadFile: FileLoader;
  loadAsset?: (path: string) => Uint8Array | null;
  env?: RawEnvOverrides;
  workspaceIndex?: WorkspaceIndex;
};

/**
 * Input for compile document, including source, source file path, workspace root, file map, and
 * asset map.
 */
export type CompileDocumentInput = {
  source: string;
  filePath: string;
  rootPath?: string | null;
  fileMap: Record<string, string>;
  assetMap?: Record<string, Uint8Array>;
  env?: RawEnvOverrides;
  workspaceIndex?: WorkspaceIndex;
};

/**
 * Result of compile document is tagged by ok: 'true' carries program, drawings and 'false'
 * carries errors.
 */
export type CompileDocumentResult =
  | {
      ok: true;
      program: IRProgram;
      drawings: DrawingProgram;
      assets: CompileAssets;
      env: EnvManifestEntry[];
      workspace: WorkspaceIndex;
      elapsedMs: number;
    }
  | {
      ok: false;
      errors: CompileError[];
      assets: CompileAssets;
      env: EnvManifestEntry[];
      workspace: WorkspaceIndex;
      elapsedMs: number;
    };

/**
 * Result of env manifest, including entries and errors.
 */
export type EnvManifestResult = {
  entries: EnvManifestEntry[];
  errors: CompileError[];
};
