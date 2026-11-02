/**
 * @author Aidan Boissonneault
 * @file paths.ts
 * @purpose Provides paths behavior for the core in compiler package.
 * @last-edited October 6, 2026
 */

/** Source extension used by BushSCAD projects and tools. */
export const BUSHSCAD_SOURCE_EXTENSION = '.bscd';

/**
 * Normalizes paths to the workspace's forward-slash convention.
 * Compiler APIs run in both browser-like and Node environments, so callers
 * need one path representation before parsing, resolving, and indexing.
 */
export function normalizePath(path: string): string {
  return path.replace(/\\/g, '/');
}

/**
 * Handles dirname in the core flow.
 */
export function dirname(path: string): string {
  const normalized = normalizePath(path).replace(/\/+$/, '');
  const slash = normalized.lastIndexOf('/');
  return slash >= 0 ? normalized.slice(0, slash) : '';
}

/** Identifies BushSCAD source file paths. */
export function isBushScadFile(path: string): boolean {
  return normalizePath(path).toLowerCase().endsWith(BUSHSCAD_SOURCE_EXTENSION);
}
