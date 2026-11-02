/**
 * @author Aidan Boissonneault
 * @file workspace-file-map.ts
 * @purpose Provides workspace file map behavior for the workspace in compiler package.
 * @last-edited October 6, 2026
 */

import type { WorkspaceIndexInput } from './types.js';
import { normalizeWorkspacePath } from './workspace-path-names.js';

/**
 * Normalizes file map into the canonical form.
 */
export function normalizeFileMap(
  map: Record<string, string> | undefined,
): Record<string, string> {
  const normalized: Record<string, string> = {};
  if (!map) return normalized;
  for (const [path, source] of Object.entries(map)) {
    normalized[normalizeWorkspacePath(path)] = source;
  }
  return normalized;
}

/**
 * Reads mapped from the supplied source.
 */
function readMapped(map: Record<string, string>, path: string): string | null {
  return map[normalizeWorkspacePath(path)] ?? null;
}

/**
 * Reads workspace file from the supplied source.
 */
export function readWorkspaceFile(
  input: WorkspaceIndexInput,
  fileMap: Record<string, string>,
  path: string,
): string | null {
  const normalized = normalizeWorkspacePath(path);
  const mapped = readMapped(fileMap, normalized);
  if (mapped !== null) return mapped;
  return input.loadFile?.(normalized) ?? null;
}
