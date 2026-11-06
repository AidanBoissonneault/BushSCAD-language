/** Parses cache-specific fields on a compiler service request. */
import type { CacheBreakpoint } from '@bushscad/compiler';
import { parseOptionalBoolean } from './request-fields.js';
import { parseCacheBreakpoints } from './request-cache-breakpoints.js';
import { parseComponentCacheDirectory } from './request-component-cache.js';
import type { CompilerEngine, CompilerRequestKind } from './types.js';

export type ParsedCacheRequestOptions = {
  componentCacheDirectory?: string;
  componentCacheMaxSizeMb?: number;
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
  const componentCacheMaxSizeMb = parseCacheSize(raw.componentCacheMaxSizeMb);
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
    componentCacheMaxSizeMb,
  );
  return {
    ...(componentCacheDirectory ? { componentCacheDirectory } : {}),
    ...(componentCacheMaxSizeMb !== undefined
      ? { componentCacheMaxSizeMb }
      : {}),
    ...(automaticallyAssignCacheBreakpoints !== undefined
      ? { automaticallyAssignCacheBreakpoints }
      : {}),
    ...(cacheBreakpoints ? { cacheBreakpoints } : {}),
  };
}

/** Accepts a bounded integer cache limit from a compiler-service request. */
function parseCacheSize(value: unknown): number | undefined {
  if (value === undefined) return undefined;
  if (
    !Number.isSafeInteger(value) ||
    Number(value) < 128 ||
    Number(value) > 4_096
  ) {
    throw new TypeError(
      'Component cache maximum size must be an integer from 128 to 4096 MB.',
    );
  }
  return Number(value);
}

/** Limits automatic or manual breakpoint controls to parallel preview requests. */
function assertCacheControlsAllowed(
  kind: CompilerRequestKind,
  engine: CompilerEngine | undefined,
  automaticallyAssignCacheBreakpoints: boolean | undefined,
  cacheBreakpoints: readonly CacheBreakpoint[] | undefined,
  componentCacheMaxSizeMb: number | undefined,
): void {
  const hasBreakpoints =
    automaticallyAssignCacheBreakpoints !== undefined ||
    cacheBreakpoints ||
    componentCacheMaxSizeMb !== undefined;
  if (hasBreakpoints && kind !== 'preview') {
    throw new TypeError(
      'Cache breakpoints are only valid for preview requests.',
    );
  }
  if (hasBreakpoints && engine === 'classic') {
    throw new TypeError('Cache controls require the parallel engine.');
  }
}
