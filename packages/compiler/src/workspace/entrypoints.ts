/**
 * @author Aidan Boissonneault
 * @file entrypoints.ts
 * @purpose Provides entrypoints behavior for the workspace in compiler package.
 * @last-edited October 6, 2026
 */

import type { CompileError } from '@bushscad/ir';
import {
  MANIFEST_NAME,
  type EntrypointSpec,
  type ProjectManifest,
  type WorkspaceEntrypoint,
} from './types.js';
import { isAbsoluteLike, joinPath } from './workspace-path-join.js';
import { normalizeWorkspacePath, withoutExt } from './workspace-path-names.js';
import { makeError } from './workspace-errors.js';
import { isBushScadFile } from '../core/paths.js';

/**
 * Normalizes manifest and implicit entrypoint declarations.
 * The rest of the compiler expects entrypoints to have names, normalized paths,
 * and a single default marker regardless of manifest syntax.
 */
export function normalizeEntrypoints(
  manifest: ProjectManifest | null,
  rootPath: string,
  activeFilePath: string,
  errors: CompileError[],
): WorkspaceEntrypoint[] {
  if (!manifest) {
    return [implicitEntrypoint(activeFilePath, true)];
  }

  const manifestPath = joinPath(rootPath, MANIFEST_NAME);
  const entries = extractManifestEntrypoints(
    manifest.entrypoints,
    manifestPath,
    errors,
  );
  ensureEntrypointFallback(entries, activeFilePath, manifestPath, errors);

  const normalized = normalizeEntrypointSpecs(entries, rootPath);
  const defaultPath = resolveDefaultEntrypoint(
    normalized,
    manifest.defaultEntrypoint,
    rootPath,
    manifestPath,
    errors,
  );
  return markDefaultEntrypoint(normalized, defaultPath);
}

/**
 * Handles implicit entrypoint in the workspace flow.
 */
function implicitEntrypoint(
  activeFilePath: string,
  isDefault: boolean,
): WorkspaceEntrypoint {
  return {
    name: withoutExt(activeFilePath),
    path: normalizeWorkspacePath(activeFilePath),
    isDefault,
  };
}

/**
 * Handles extract manifest entrypoints in the workspace flow.
 */
function extractManifestEntrypoints(
  raw: ProjectManifest['entrypoints'],
  manifestPath: string,
  errors: CompileError[],
): EntrypointSpec[] {
  const entries: EntrypointSpec[] = [];
  if (Array.isArray(raw)) {
    readEntrypointArray(raw, manifestPath, entries, errors);
  } else if (raw && typeof raw === 'object') {
    readEntrypointMap(raw, manifestPath, entries, errors);
  }
  return entries;
}

/**
 * Reads entrypoint array from the supplied source.
 */
function readEntrypointArray(
  raw: NonNullable<ProjectManifest['entrypoints']>,
  manifestPath: string,
  entries: EntrypointSpec[],
  errors: CompileError[],
): void {
  if (!Array.isArray(raw)) return;
  for (const item of raw) {
    if (typeof item === 'string') {
      entries.push({ name: withoutExt(item), path: item });
    } else if (
      item &&
      typeof item === 'object' &&
      typeof item.path === 'string'
    ) {
      entries.push({
        name: item.name ?? withoutExt(item.path),
        path: item.path,
      });
    } else {
      errors.push(
        makeError(
          manifestPath,
          "Manifest field 'entrypoints' must contain strings or { name, path } objects.",
        ),
      );
    }
  }
}

/**
 * Reads entrypoint map from the supplied source.
 */
function readEntrypointMap(
  raw: NonNullable<ProjectManifest['entrypoints']>,
  manifestPath: string,
  entries: EntrypointSpec[],
  errors: CompileError[],
): void {
  if (Array.isArray(raw) || typeof raw !== 'object') return;
  for (const [name, path] of Object.entries(raw)) {
    if (typeof path === 'string') entries.push({ name, path });
    else
      errors.push(
        makeError(
          manifestPath,
          `Manifest entrypoint '${name}' must be a string path.`,
        ),
      );
  }
}

/**
 * Handles ensure entrypoint fallback in the workspace flow.
 */
function ensureEntrypointFallback(
  entries: EntrypointSpec[],
  activeFilePath: string,
  manifestPath: string,
  errors: CompileError[],
): void {
  if (entries.length === 0) {
    if (isBushScadFile(activeFilePath)) {
      entries.push({
        name: withoutExt(activeFilePath),
        path: normalizeWorkspacePath(activeFilePath),
      });
    } else {
      errors.push(
        makeError(
          manifestPath,
          'Project manifest must declare at least one .bscd entrypoint when compiling from a non-BushSCAD file.',
        ),
      );
      entries.push({
        name: withoutExt(activeFilePath),
        path: normalizeWorkspacePath(activeFilePath),
      });
    }
  }
}

/**
 * Normalizes entrypoint specs into the canonical form.
 */
function normalizeEntrypointSpecs(
  entries: EntrypointSpec[],
  rootPath: string,
): WorkspaceEntrypoint[] {
  return entries.map((entry) => ({
    name: entry.name,
    path: isAbsoluteLike(entry.path)
      ? normalizeWorkspacePath(entry.path)
      : joinPath(rootPath, entry.path),
    isDefault: false,
  }));
}

/**
 * Resolves default entrypoint using the workspace rules.
 */
function resolveDefaultEntrypoint(
  normalized: WorkspaceEntrypoint[],
  defaultEntrypoint: string | undefined,
  rootPath: string,
  manifestPath: string,
  errors: CompileError[],
): string {
  let defaultPath = normalized[0].path;
  if (defaultEntrypoint) {
    const byName = normalized.find((entry) => entry.name === defaultEntrypoint);
    const requestedPath = isAbsoluteLike(defaultEntrypoint)
      ? normalizeWorkspacePath(defaultEntrypoint)
      : joinPath(rootPath, defaultEntrypoint);
    const byPath = normalized.find((entry) => entry.path === requestedPath);
    const resolved = byName ?? byPath;
    if (resolved) {
      defaultPath = resolved.path;
    } else {
      errors.push(
        makeError(
          manifestPath,
          `Default entrypoint '${defaultEntrypoint}' does not match a manifest entrypoint.`,
        ),
      );
    }
  }
  return defaultPath;
}

/**
 * Updates state to record default entrypoint.
 */
function markDefaultEntrypoint(
  normalized: WorkspaceEntrypoint[],
  defaultPath: string,
): WorkspaceEntrypoint[] {
  return normalized.map((entry) => ({
    ...entry,
    isDefault: entry.path === defaultPath,
  }));
}
