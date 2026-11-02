/**
 * @author Aidan Boissonneault
 * @file resolveWorkspaceEntrypoint.ts
 * @purpose Resolves workspace entrypoint for the workspace in compiler package.
 * @last-edited October 6, 2026
 */

import type { WorkspaceIndex } from './types.js';
import { normalizeWorkspacePath } from './workspace-path-names.js';

/**
 * Resolves the active file to the workspace entrypoint that should compile.
 * Editing an imported file should compile the default entrypoint when possible,
 * while direct .bscd files still compile themselves in single-file mode.
 */
export function resolveWorkspaceEntrypoint(
  index: WorkspaceIndex,
  requested: string,
): string {
  const normalized = normalizeWorkspacePath(requested);
  const byPath = index.entrypoints.find((entry) => entry.path === normalized);
  if (byPath) return byPath.path;
  const byName = index.entrypoints.find((entry) => entry.name === requested);
  if (byName) return byName.path;
  if (index.manifest) return index.defaultEntrypoint;
  return normalized;
}
