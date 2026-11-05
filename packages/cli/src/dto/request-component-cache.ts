/**
 * Parses the optional local cache directory from a compiler service request.
 *
 * Why: component BRep caching belongs to the preview harness and must not be
 * available on check or export requests.
 */
import type { CompilerRequestKind } from './types.js';

/** Validates and normalizes a cache directory only for preview requests. */
export function parseComponentCacheDirectory(
  value: unknown,
  kind: CompilerRequestKind,
  parseAbsolutePath: (value: unknown, label: string) => string,
): string | undefined {
  if (value === undefined) return undefined;
  if (kind !== 'preview') {
    throw new TypeError(
      'Component cache directory is only valid for preview requests.',
    );
  }
  return parseAbsolutePath(value, 'Component cache directory');
}
