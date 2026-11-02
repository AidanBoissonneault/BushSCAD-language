/**
 * @author Aidan Boissonneault
 * @file compileFileToIr.ts
 * @purpose Provides compile file to IR behavior for the pipeline in compiler package.
 * @last-edited October 6, 2026
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { CompileDocumentResult } from '../types/types.js';
import { compileSource } from './compileSource.js';
import { isBushScadFile } from '../core/paths.js';
import { buildWorkspaceIndex } from '../workspace/buildWorkspaceIndex.js';
import { resolveWorkspaceEntrypoint } from '../workspace/resolveWorkspaceEntrypoint.js';
import type { CompileFileOptions } from '../platform/node/nodeTypes.js';
import {
  absolutePath,
  findProjectRoot,
  normalizeOverlayMap,
  readAsset,
  readSource,
} from '../platform/node/nodePaths.js';
import { resolveNodeFonts } from '../platform/node/nodeFontResolution.js';

/**
 * Compiles a source file from disk or editor overlays into IR.
 * Node CLI and service calls need a filesystem-backed wrapper around the
 * loader-based compiler core.
 */
export function compileFileToIr(
  options: CompileFileOptions,
): CompileDocumentResult {
  const requestedFilePath = absolutePath(options.filePath);
  const rootPath = options.rootPath
    ? absolutePath(options.rootPath)
    : findProjectRoot(requestedFilePath);
  const manifestExists = existsSync(join(rootPath, 'bushscad.json'));
  if (!manifestExists && !isBushScadFile(requestedFilePath)) {
    const workspace = buildWorkspaceIndex({
      rootPath,
      activeFilePath: requestedFilePath,
      fileMap: {},
    });
    return {
      ok: false,
      errors: [
        {
          message: `Cannot compile '${requestedFilePath}'; open a .bscd file or a project with defaultEntrypoint.`,
          span: { file: requestedFilePath, line: 1, col: 1 },
        },
      ],
      assets: { fonts: [], shapes: [] },
      env: [],
      workspace,
      elapsedMs: 0,
    };
  }
  const overlays = normalizeOverlayMap(options.overlays);
  const workspace = buildWorkspaceIndex({
    rootPath,
    activeFilePath: requestedFilePath,
    overlays,
    loadFile: (path) => readSource(path, overlays),
  });
  if (!workspace.manifest && !isBushScadFile(requestedFilePath)) {
    return {
      ok: false,
      errors: [
        {
          message: `Cannot compile '${requestedFilePath}'; open a .bscd file or a project with defaultEntrypoint.`,
          span: { file: requestedFilePath, line: 1, col: 1 },
        },
      ],
      assets: { fonts: [], shapes: [] },
      env: [],
      workspace,
      elapsedMs: 0,
    };
  }
  const filePath =
    options.entrypointMode === 'requested-file'
      ? requestedFilePath
      : resolveWorkspaceEntrypoint(workspace, requestedFilePath);
  const source = readSource(filePath, overlays);
  if (source === null) {
    return {
      ok: false,
      errors: [
        {
          message: `Cannot read '${filePath}'`,
          span: { file: filePath, line: 1, col: 1 },
        },
      ],
      assets: { fonts: [], shapes: [] },
      env: [],
      workspace,
      elapsedMs: 0,
    };
  }

  const result = compileSource({
    source,
    filePath,
    rootPath,
    env: options.env,
    loadFile: (path) => readSource(path, overlays),
    loadAsset: readAsset,
    workspaceIndex: workspace,
  });
  if (result.ok) resolveNodeFonts(result.program, result.assets, rootPath);
  return result;
}
