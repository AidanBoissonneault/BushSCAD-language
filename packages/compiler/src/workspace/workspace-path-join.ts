/**
 * @author Aidan Boissonneault
 * @file workspace-path-join.ts
 * @purpose Provides workspace path join behavior for the workspace in compiler package.
 * @last-edited October 6, 2026
 */

import { dirname } from '../core/paths.js';
import { normalizeWorkspacePath } from './workspace-path-names.js';

/**
 * Returns whether the input meets the `absolute like` condition.
 */
export function isAbsoluteLike(path: string): boolean {
  return /^[A-Za-z]:\//.test(path) || path.startsWith('/');
}

/**
 * Joins a workspace base path and child path while preserving normalized separators.
 * Compiler workspace maps use slash-normalized paths even when input paths come
 * from Windows file systems or browser APIs.
 */
export function joinPath(base: string, child: string): string {
  if (isAbsoluteLike(child)) return normalizeWorkspacePath(child);
  const combined = `${base.replace(/\/+$/, '')}/${child}`;
  const drive = /^[A-Za-z]:/.exec(combined)?.[0] ?? '';
  const rest = drive ? combined.slice(drive.length) : combined;
  const absolute = rest.startsWith('/');
  const parts: string[] = [];
  for (const part of rest.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') parts.pop();
    else parts.push(part);
  }
  return `${drive}${absolute ? '/' : ''}${parts.join('/')}`;
}

/**
 * Resolves from file using the workspace rules.
 */
export function resolveFromFile(
  filePath: string,
  relativePath: string,
): string {
  if (!relativePath.startsWith('.')) {
    return normalizeWorkspacePath(relativePath);
  }
  return joinPath(dirname(filePath), relativePath);
}
