/**
 * @author Aidan Boissonneault
 * @file buildWorkspaceIndex.ts
 * @purpose Builds workspace index for the workspace in compiler package.
 * @last-edited October 6, 2026
 */

import { parse } from '@bushscad/parser';
import type { CompileError } from '@bushscad/ir';
import type {
  ProjectManifest,
  WorkspaceFile,
  WorkspaceIndex,
  WorkspaceIndexInput,
} from './types.js';
import { MANIFEST_NAME } from './types.js';
import { expandIncludePaths, normalizeManifestPathList } from './assetPaths.js';
import {
  addReverseEdges,
  collectTopLevelGraphDeps,
  dependencyClosure,
  recordFromMap,
  unique,
} from './graph.js';
import { normalizeEntrypoints } from './entrypoints.js';
import { parseManifest } from './manifest.js';
import { dirname, normalizeWorkspacePath } from './workspace-path-names.js';
import { joinPath } from './workspace-path-join.js';
import { makeError } from './workspace-errors.js';
import { normalizeFileMap, readWorkspaceFile } from './workspace-file-map.js';

/**
 * Builds workspace index from the supplied inputs.
 */
export function buildWorkspaceIndex(
  input: WorkspaceIndexInput,
): WorkspaceIndex {
  const activeFilePath = normalizeWorkspacePath(input.activeFilePath);
  const rootPath = normalizeWorkspacePath(
    input.rootPath ?? dirname(activeFilePath),
  );
  const fileMap = {
    ...normalizeFileMap(input.fileMap),
    ...normalizeFileMap(input.overlays),
  };
  const manifestPath = joinPath(rootPath, MANIFEST_NAME);
  const manifestSource = readWorkspaceFile(input, fileMap, manifestPath);
  const errors: CompileError[] = [];
  const manifestResult = parseWorkspaceManifest(manifestSource, manifestPath);
  errors.push(...manifestResult.errors);

  const entrypoints = normalizeEntrypoints(
    manifestResult.manifest,
    rootPath,
    activeFilePath,
    errors,
  );
  const manifestIncludes = manifestResult.manifest
    ? normalizeManifestPathList(
        rootPath,
        manifestResult.manifest.include,
        manifestPath,
        'include',
        errors,
      )
    : [];
  const manifestAssets = manifestResult.manifest
    ? normalizeManifestPathList(
        rootPath,
        manifestResult.manifest.assets,
        manifestPath,
        'assets',
        errors,
      )
    : [];
  const defaultEntrypoint =
    entrypoints.find((entry) => entry.isDefault)?.path ?? entrypoints[0].path;
  if (errors.length > 0) {
    return emptyWorkspaceIndex({
      rootPath,
      manifestPath,
      entrypoints,
      defaultEntrypoint,
      errors,
    });
  }
  const crawl = crawlWorkspaceFiles({
    input,
    fileMap,
    rootPath,
    entrypointPaths: entrypoints.map((entry) => entry.path),
    discoveryPaths: (input.discoveryPaths ?? []).map(normalizeWorkspacePath),
    manifestIncludes,
    manifestAssets,
    errors,
  });

  return {
    rootPath,
    manifestPath: manifestResult.manifest ? manifestPath : null,
    manifest: manifestResult.manifest,
    entrypoints,
    defaultEntrypoint,
    files: fileRecordWithDependents(crawl.files, crawl.dependents),
    dependencies: recordFromMap(crawl.dependencies),
    dependents: recordFromMap(crawl.dependents),
    entrypointDependencies: entrypointDependencyRecord(
      entrypoints.map((entry) => entry.path),
      crawl.dependencies,
    ),
    assets: [...crawl.assets].sort(),
    errors,
  };
}

/**
 * Parses workspace manifest from the supplied source into the workspace representation.
 */
function parseWorkspaceManifest(
  manifestSource: string | null,
  manifestPath: string,
): { manifest: ProjectManifest | null; errors: CompileError[] } {
  return manifestSource === null
    ? { manifest: null, errors: [] }
    : parseManifest(manifestSource, manifestPath);
}

/**
 * Handles empty workspace index in the workspace flow.
 */
function emptyWorkspaceIndex(args: {
  rootPath: string;
  manifestPath: string;
  entrypoints: WorkspaceIndex['entrypoints'];
  defaultEntrypoint: string;
  errors: CompileError[];
}): WorkspaceIndex {
  return {
    rootPath: args.rootPath,
    manifestPath: args.manifestPath,
    manifest: null,
    entrypoints: args.entrypoints,
    defaultEntrypoint: args.defaultEntrypoint,
    files: {},
    dependencies: {},
    dependents: {},
    entrypointDependencies: {},
    assets: [],
    errors: args.errors,
  };
}

/**
 * Workspace crawl args, including input, file map, workspace root, entrypoint paths, and
 * discovery paths.
 */
type WorkspaceCrawlArgs = {
  input: WorkspaceIndexInput;
  fileMap: Record<string, string>;
  rootPath: string;
  entrypointPaths: string[];
  discoveryPaths: string[];
  manifestIncludes: string[];
  manifestAssets: string[];
  errors: CompileError[];
};

/**
 * Handles crawl workspace files in the workspace flow.
 */
function crawlWorkspaceFiles(args: WorkspaceCrawlArgs): {
  dependencies: Map<string, Set<string>>;
  dependents: Map<string, Set<string>>;
  files: Map<string, WorkspaceFile>;
  assets: Set<string>;
} {
  const entrypointPaths = new Set(args.entrypointPaths);
  const queue = unique([
    ...args.entrypointPaths,
    ...args.discoveryPaths,
    ...expandIncludePaths(args.rootPath, args.manifestIncludes, args.fileMap),
  ]);
  const visited = new Set<string>();
  const dependencies = new Map<string, Set<string>>();
  const dependents = new Map<string, Set<string>>();
  const files = new Map<string, WorkspaceFile>();
  const assets = new Set(args.manifestAssets);

  while (queue.length > 0) {
    const filePath = normalizeWorkspacePath(queue.shift() ?? '');
    if (!filePath || visited.has(filePath)) continue;
    visited.add(filePath);
    crawlWorkspaceFile(args, {
      filePath,
      entrypointPaths,
      dependencies,
      dependents,
      files,
      assets,
      queue,
    });
  }
  return { dependencies, dependents, files, assets };
}

/**
 * Handles crawl workspace file in the workspace flow.
 */
function crawlWorkspaceFile(
  args: WorkspaceCrawlArgs,
  state: {
    filePath: string;
    entrypointPaths: Set<string>;
    dependencies: Map<string, Set<string>>;
    dependents: Map<string, Set<string>>;
    files: Map<string, WorkspaceFile>;
    assets: Set<string>;
    queue: string[];
  },
): void {
  const source = readWorkspaceFile(args.input, args.fileMap, state.filePath);
  if (source === null) {
    recordMissingWorkspaceFile(args, state);
    return;
  }
  const parsed = parse(source, state.filePath);
  for (const error of parsed.errors) {
    args.errors.push({
      message: error.message,
      span: {
        file: error.span.file,
        line: error.span.line,
        col: error.span.col,
      },
    });
  }
  const graphDeps = collectTopLevelGraphDeps(parsed.ast, state.filePath);
  for (const asset of graphDeps.assets) state.assets.add(asset);
  const allDeps = unique([...graphDeps.imports, ...graphDeps.assets]);
  state.dependencies.set(state.filePath, new Set(allDeps));
  addReverseEdges(state.dependents, state.filePath, allDeps);
  state.files.set(
    state.filePath,
    workspaceFile(state.filePath, graphDeps.imports, graphDeps.assets, args),
  );
  state.queue.push(...graphDeps.imports);
}

/**
 * Handles record missing workspace file in the workspace flow.
 */
function recordMissingWorkspaceFile(
  args: WorkspaceCrawlArgs,
  state: {
    filePath: string;
    entrypointPaths: Set<string>;
    files: Map<string, WorkspaceFile>;
  },
): void {
  if (state.entrypointPaths.has(state.filePath)) {
    args.errors.push(
      makeError(
        state.filePath,
        `Cannot load workspace entrypoint '${state.filePath}'`,
      ),
    );
  }
  state.files.set(state.filePath, workspaceFile(state.filePath, [], [], args));
}

/**
 * Handles workspace file in the workspace flow.
 */
function workspaceFile(
  path: string,
  imports: string[],
  assets: string[],
  args: WorkspaceCrawlArgs,
): WorkspaceFile {
  const dependencies = unique([...imports, ...assets]);
  return {
    path,
    imports,
    assets,
    dependencies,
    dependents: [],
    isOverlay: Object.prototype.hasOwnProperty.call(
      normalizeFileMap(args.input.overlays),
      path,
    ),
  };
}

/**
 * Handles file record with dependents in the workspace flow.
 */
function fileRecordWithDependents(
  files: Map<string, WorkspaceFile>,
  dependents: Map<string, Set<string>>,
): Record<string, WorkspaceFile> {
  const dependentRecord = recordFromMap(dependents);
  const fileRecord: Record<string, WorkspaceFile> = {};
  for (const [path, file] of files.entries()) {
    fileRecord[path] = { ...file, dependents: dependentRecord[path] ?? [] };
  }
  return fileRecord;
}

/**
 * Handles entrypoint dependency record in the workspace flow.
 */
function entrypointDependencyRecord(
  entrypoints: string[],
  dependencies: Map<string, Set<string>>,
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const entrypoint of entrypoints) {
    out[entrypoint] = dependencyClosure(entrypoint, dependencies).sort();
  }
  return out;
}
