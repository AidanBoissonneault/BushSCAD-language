/**
 * @author Aidan Boissonneault
 * @file types.ts
 * @purpose Provides types behavior for the workspace in compiler package.
 * @last-edited October 6, 2026
 */

import type { CompileError } from '@bushscad/ir';

/**
 * Project manifest export, including export format, out, and entrypoints.
 */
type ProjectManifestExport = {
  format?: 'step' | 'stl';
  out?: string;
  entrypoints?: string[];
};

/**
 * Project manifest, including version, entrypoints, default entrypoint, include, and assets.
 */
export type ProjectManifest = {
  version: number | string;
  entrypoints?:
    | string[]
    | Record<string, string>
    | { name?: string; path: string }[];
  defaultEntrypoint?: string;
  include?: string[];
  assets?: string[];
  env?: Record<string, string>;
  export?: ProjectManifestExport;
};

/**
 * Workspace entrypoint, including name, path, and is default.
 */
export type WorkspaceEntrypoint = {
  name: string;
  path: string;
  isDefault: boolean;
};

/**
 * Entrypoint spec, including name and path.
 */
export type EntrypointSpec = {
  name: string;
  path: string;
};

/**
 * Workspace file, including path, imports, assets, dependencies, and dependents.
 */
export type WorkspaceFile = {
  path: string;
  imports: string[];
  assets: string[];
  dependencies: string[];
  dependents: string[];
  isOverlay: boolean;
};

/**
 * Workspace index, including workspace root, manifest path, manifest, entrypoints, and default
 * entrypoint.
 */
export type WorkspaceIndex = {
  rootPath: string;
  manifestPath: string | null;
  manifest: ProjectManifest | null;
  entrypoints: WorkspaceEntrypoint[];
  defaultEntrypoint: string;
  files: Record<string, WorkspaceFile>;
  dependencies: Record<string, string[]>;
  dependents: Record<string, string[]>;
  entrypointDependencies: Record<string, string[]>;
  assets: string[];
  errors: CompileError[];
};

/**
 * Input for workspace index, including workspace root, active file path, discovery paths, file
 * map, and source overlays.
 */
export type WorkspaceIndexInput = {
  rootPath?: string | null;
  activeFilePath: string;
  /** Additional known source paths to include when constructing tooling graphs. */
  discoveryPaths?: string[];
  fileMap?: Record<string, string>;
  overlays?: Record<string, string>;
  loadFile?: (path: string) => string | null;
};

export const MANIFEST_NAME = 'bushscad.json';
