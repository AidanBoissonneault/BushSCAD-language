/**
 * @author Aidan Boissonneault
 * @file compileDocument.ts
 * @purpose Provides compile document behavior for the pipeline in compiler package.
 * @last-edited October 6, 2026
 */

import { buildWorkspaceIndex } from '../workspace/buildWorkspaceIndex.js';
import { resolveWorkspaceEntrypoint } from '../workspace/resolveWorkspaceEntrypoint.js';
import { compileSource } from './compileSource.js';
import { readAssetFromMap, readFromFileMap } from '../types/fileMaps.js';
import { dirname, isBushScadFile, normalizePath } from '../core/paths.js';
import type {
  CompileDocumentInput,
  CompileDocumentResult,
} from '../types/types.js';

/**
 * Compiles an in-memory document map and resolves the active entrypoint.
 * Editor integrations compile buffers that may not exist on disk yet, while
 * still needing workspace entrypoint and asset behavior.
 */
export function compileDocument(
  input: CompileDocumentInput,
): CompileDocumentResult {
  const normalizedFilePath = normalizePath(input.filePath);
  const rootPath = input.rootPath
    ? normalizePath(input.rootPath)
    : dirname(normalizedFilePath);
  const workspace =
    input.workspaceIndex ??
    buildWorkspaceIndex({
      rootPath,
      activeFilePath: normalizedFilePath,
      fileMap: input.fileMap,
    });
  if (workspace.errors.length > 0) {
    return {
      ok: false,
      errors: workspace.errors,
      assets: { fonts: [], shapes: [] },
      env: [],
      workspace,
      elapsedMs: 0,
    };
  }
  if (!workspace.manifest && !isBushScadFile(normalizedFilePath)) {
    return {
      ok: false,
      errors: [
        {
          message: `Cannot compile '${normalizedFilePath}'; open a .bscd file or a project with defaultEntrypoint.`,
          span: { file: normalizedFilePath, line: 1, col: 1 },
        },
      ],
      assets: { fonts: [], shapes: [] },
      env: [],
      workspace,
      elapsedMs: 0,
    };
  }
  const entrypoint = resolveWorkspaceEntrypoint(workspace, normalizedFilePath);
  const source = readFromFileMap(input.fileMap, entrypoint) ?? input.source;
  return compileSource({
    source,
    filePath: entrypoint,
    rootPath,
    env: input.env,
    cacheBreakpoints: input.cacheBreakpoints,
    loadFile: (path) => readFromFileMap(input.fileMap, path),
    loadAsset: (path) => readAssetFromMap(input.assetMap, path),
    workspaceIndex: workspace,
  });
}
