/** Parses cache-specific fields on a compiler service request. */
import type { CacheBreakpoint } from '@bushscad/compiler';
import { parseOptionalBoolean } from './request-fields.js';
import { parseCacheBreakpoints } from './request-cache-breakpoints.js';
import { parseComponentCacheDirectory } from './request-component-cache.js';
import type { CompilerEngine, CompilerRequestKind } from './types.js';

export type ParsedCacheRequestOptions = {
  componentCacheDirectory?: string;
  automaticallyAssignCacheBreakpoints?: boolean;
  cacheBreakpoints?: CacheBreakpoint[];
};

/** Carries bounded cache controls into preview parsing and rejects invalid uses. */
export function parseCacheRequestOptions(
  raw: Record<string, unknown>,
  kind: CompilerRequestKind,
  engine: CompilerEngine | undefined,
  normalizeAbsolutePath: (value: unknown, label: string) => string,
  assertBreakpointPathAllowed: (path: string, label: string) => void,
): ParsedCacheRequestOptions {
  const componentCacheDirectory = parseComponentCacheDirectory(
    raw.componentCacheDirectory,
    kind,
    normalizeAbsolutePath,
  );
  const automaticallyAssignCacheBreakpoints = parseOptionalBoolean(
    raw.automaticallyAssignCacheBreakpoints,
    'Automatic cache breakpoint flag',
  );
  const cacheBreakpoints = parseCacheBreakpoints(
    raw.cacheBreakpoints,
    normalizeAbsolutePath,
    assertBreakpointPathAllowed,
  );
  assertCacheControlsAllowed(
    kind,
    engine,
    automaticallyAssignCacheBreakpoints,
    cacheBreakpoints,
  );
  return {
    ...(componentCacheDirectory ? { componentCacheDirectory } : {}),
    ...(automaticallyAssignCacheBreakpoints !== undefined
      ? { automaticallyAssignCacheBreakpoints }
      : {}),
    ...(cacheBreakpoints ? { cacheBreakpoints } : {}),
  };
}

/** Limits automatic or manual breakpoint controls to parallel preview requests. */
function assertCacheControlsAllowed(
  kind: CompilerRequestKind,
  engine: CompilerEngine | undefined,
  automaticallyAssignCacheBreakpoints: boolean | undefined,
  cacheBreakpoints: readonly CacheBreakpoint[] | undefined,
): void {
  const hasBreakpoints =
    automaticallyAssignCacheBreakpoints !== undefined || cacheBreakpoints;
  if (hasBreakpoints && kind !== 'preview') {
    throw new TypeError(
      'Cache breakpoints are only valid for preview requests.',
    );
  }
  if (hasBreakpoints && engine === 'classic') {
    throw new TypeError('Cache breakpoints require the parallel engine.');
  }
}
