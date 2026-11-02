/**
 * @author Aidan Boissonneault
 * @file fileMaps.ts
 * @purpose Provides file maps behavior for the types in compiler package.
 * @last-edited October 6, 2026
 */

import { normalizePath } from '../core/paths.js';

/**
 * Reads a source file from a normalized or original file map key.
 * Consumers may provide Windows or normalized path keys. Supporting both keeps
 * document compilation stable across platforms.
 */
export function readFromFileMap(
  fileMap: Record<string, string>,
  path: string,
): string | null {
  const normalized = normalizePath(path);
  return fileMap[normalized] ?? fileMap[path] ?? null;
}

/**
 * Reads an asset from a normalized or original asset map key.
 */
export function readAssetFromMap(
  assetMap: Record<string, Uint8Array> | undefined,
  path: string,
): Uint8Array | null {
  if (!assetMap) return null;
  const normalized = normalizePath(path);
  return assetMap[normalized] ?? assetMap[path] ?? null;
}
