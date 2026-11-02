/**
 * @author Aidan Boissonneault
 * @file nodePaths.ts
 * @purpose Provides node paths behavior for the platform node in compiler package.
 * @last-edited October 6, 2026
 */

import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve as resolvePath } from 'node:path';
import type { CompileError, SourceSpan } from '@bushscad/ir';
import { normalizePath } from '../../core/paths.js';
import type { FileOverlayMap } from './nodeTypes.js';

/**
 * Node-specific path and filesystem helpers for compiler entrypoints.
 * The browser-safe compiler core receives loader callbacks, while Node mode
 * needs to adapt real filesystem paths and editor overlays into that shape.
 */
export function absolutePath(path: string): string {
  return normalizePath(isAbsolute(path) ? path : resolvePath(path));
}

/**
 * Returns project root from the supplied input.
 */
export function findProjectRoot(filePath: string): string {
  let dir = pathIsDirectory(filePath) ? filePath : dirname(filePath);
  while (dir && dir !== dirname(dir)) {
    if (existsSync(join(dir, 'bushscad.json'))) return normalizePath(dir);
    dir = dirname(dir);
  }
  return normalizePath(dirname(filePath));
}

/**
 * Builds the path data required by the current operation.
 */
function pathIsDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Normalizes overlay map into the canonical form.
 */
export function normalizeOverlayMap(
  overlays: FileOverlayMap = {},
): FileOverlayMap {
  const normalized: FileOverlayMap = {};
  for (const [path, source] of Object.entries(overlays)) {
    normalized[absolutePath(path)] = source;
    normalized[normalizePath(path)] = source;
  }
  return normalized;
}

/**
 * Reads source from the supplied source.
 */
export function readSource(
  path: string,
  overlays: FileOverlayMap,
): string | null {
  const normalized = absolutePath(path);
  if (Object.prototype.hasOwnProperty.call(overlays, normalized))
    return overlays[normalized];
  try {
    return readFileSync(normalized, 'utf8');
  } catch {
    return null;
  }
}

/**
 * Reads asset from the supplied source.
 */
export function readAsset(path: string): Uint8Array | null {
  try {
    return new Uint8Array(readFileSync(absolutePath(path)));
  } catch {
    return null;
  }
}

/** Builds the shared failed-compile result envelope with elapsed timing. */
export function compileFailure<E>(
  errors: CompileError[],
  env: E,
  t0: number,
): { ok: false; errors: CompileError[]; env: E; elapsedMs: number } {
  return { ok: false, errors, env, elapsedMs: Date.now() - t0 };
}

/**
 * Converts the supplied value to its compile error representation.
 */
export function toCompileError(error: unknown): CompileError {
  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    'span' in error
  ) {
    const occtError = error as { message: string; span: SourceSpan };
    return { message: occtError.message, span: occtError.span };
  }

  return {
    message: error instanceof Error ? error.message : String(error),
    span: { file: '(occt)', line: 1, col: 1 },
  };
}
