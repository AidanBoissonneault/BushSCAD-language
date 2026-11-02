/**
 * @author Aidan Boissonneault
 * @file assetPaths.ts
 * @purpose Provides asset paths behavior for the workspace in compiler package.
 * @last-edited October 6, 2026
 */

import { isAbsoluteLike, joinPath } from './workspace-path-join.js';
import { normalizeWorkspacePath } from './workspace-path-names.js';
import { makeError } from './workspace-errors.js';
import { unique } from './graph.js';
import type { CompileError } from '@bushscad/ir';
import { BUSHSCAD_SOURCE_EXTENSION, isBushScadFile } from '../core/paths.js';

/**
 * Resolves manifest include and asset paths into normalized workspace paths.
 */
export function normalizeManifestPathList(
  rootPath: string,
  values: unknown,
  manifestPath: string,
  field: string,
  errors: CompileError[],
): string[] {
  if (values === undefined) return [];
  if (!Array.isArray(values)) {
    errors.push(
      makeError(
        manifestPath,
        `Manifest field '${field}' must be an array of paths.`,
      ),
    );
    return [];
  }
  const paths: string[] = [];
  for (const value of values) {
    if (typeof value !== 'string') {
      errors.push(
        makeError(
          manifestPath,
          `Manifest field '${field}' must contain only string paths.`,
        ),
      );
      continue;
    }
    paths.push(
      isAbsoluteLike(value)
        ? normalizeWorkspacePath(value)
        : joinPath(rootPath, value),
    );
  }
  return paths;
}

/**
 * Expands include paths into its concrete entries.
 */
export function expandIncludePaths(
  rootPath: string,
  includes: string[],
  fileMap: Record<string, string>,
): string[] {
  const paths: string[] = [];
  const mappedFiles = Object.keys(fileMap).filter(isBushScadFile);
  for (const include of includes) {
    const pattern = sourceIncludePattern(include);
    if (pattern) {
      paths.push(
        ...mappedFiles.filter(
          (path) =>
            path.startsWith(pattern.prefix) &&
            (pattern.recursive ||
              !path.slice(pattern.prefix.length).includes('/')),
        ),
      );
      continue;
    }
    paths.push(
      isAbsoluteLike(include)
        ? normalizeWorkspacePath(include)
        : joinPath(rootPath, include),
    );
  }
  return unique(paths);
}

/** Matches supported source-file globs while preserving shallow and recursive include behavior. */
function sourceIncludePattern(
  include: string,
): { prefix: string; recursive: boolean } | null {
  const normalized = include.toLowerCase();
  const recursiveSuffix = `**/*${BUSHSCAD_SOURCE_EXTENSION}`;
  if (normalized.endsWith(recursiveSuffix)) {
    return {
      prefix: include.slice(0, -recursiveSuffix.length),
      recursive: true,
    };
  }
  const shallowSuffix = `*${BUSHSCAD_SOURCE_EXTENSION}`;
  if (normalized.endsWith(shallowSuffix)) {
    return {
      prefix: include.slice(0, -shallowSuffix.length),
      recursive: false,
    };
  }
  return null;
}
