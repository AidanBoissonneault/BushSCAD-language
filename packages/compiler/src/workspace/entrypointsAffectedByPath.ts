/**
 * @author Aidan Boissonneault
 * @file entrypointsAffectedByPath.ts
 * @purpose Provides entrypoints affected by path behavior for the workspace in compiler package.
 * @last-edited October 6, 2026
 */

import type { WorkspaceEntrypoint, WorkspaceIndex } from './types.js';
import { normalizeWorkspacePath } from './workspace-path-names.js';

/**
 * Lists entrypoints impacted by a changed source path.
 * Watchers and editors need targeted recompilation instead of rebuilding every
 * possible entrypoint after each edit.
 */
export function entrypointsAffectedByPath(
  index: WorkspaceIndex,
  changedPath: string,
): WorkspaceEntrypoint[] {
  const normalized = normalizeWorkspacePath(changedPath);
  return index.entrypoints.filter((entry) =>
    index.entrypointDependencies[entry.path]?.includes(normalized),
  );
}
