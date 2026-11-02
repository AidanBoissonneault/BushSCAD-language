/**
 * @author Aidan Boissonneault
 * @file workspace-path-names.ts
 * @purpose Provides workspace path names behavior for the workspace in compiler package.
 * @last-edited October 6, 2026
 */

import { normalizePath } from '../core/paths.js';

export { dirname } from '../core/paths.js';

/**
 * Normalizes workspace paths to forward slashes.
 * Workspace graphs must compare paths consistently across Windows, macOS, and
 * browser-provided file maps.
 */
export function normalizeWorkspacePath(path: string): string {
  return normalizePath(path);
}

/**
 * Handles basename in the workspace flow.
 */
function basename(path: string): string {
  const normalized = normalizeWorkspacePath(path);
  const slash = normalized.lastIndexOf('/');
  return slash >= 0 ? normalized.slice(slash + 1) : normalized;
}

/**
 * Handles without ext in the workspace flow.
 */
export function withoutExt(path: string): string {
  return basename(path).replace(/\.[^.]+$/, '');
}
