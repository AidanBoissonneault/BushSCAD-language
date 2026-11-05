/**
 * Validates cache-breakpoint data from the extension service boundary.
 *
 * Why: source selections cross a JSON process boundary and must not grant the
 * compiler access to arbitrary paths or unbounded condition strings.
 */
import type { CacheBreakpoint } from '@bushscad/compiler';

const MAX_CACHE_BREAKPOINTS = 1_024;
const MAX_CONDITION_LENGTH = 1_024;
const CACHE_BREAKPOINT_KEYS = new Set(['filePath', 'line', 'condition']);

type CacheBreakpointPathPolicy = {
  normalizeAbsolutePath: (value: unknown, label: string) => string;
  assertWithinRoot: (path: string, label: string) => void;
};

/** Validates and normalizes bounded source breakpoints received over JSON. */
export function parseCacheBreakpoints(
  value: unknown,
  normalizeAbsolutePath: CacheBreakpointPathPolicy['normalizeAbsolutePath'],
  assertWithinRoot: CacheBreakpointPathPolicy['assertWithinRoot'],
): CacheBreakpoint[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length > MAX_CACHE_BREAKPOINTS) {
    throw new TypeError(
      `Cache breakpoints must be an array of at most ${MAX_CACHE_BREAKPOINTS} entries.`,
    );
  }
  const seen = new Set<string>();
  const policy = { normalizeAbsolutePath, assertWithinRoot };
  return value.map((entry, index) =>
    parseBreakpoint(entry, index, seen, policy),
  );
}

/** Validates one entry, keeping field, path, and duplicate checks in named steps. */
function parseBreakpoint(
  entry: unknown,
  index: number,
  seen: Set<string>,
  policy: CacheBreakpointPathPolicy,
): CacheBreakpoint {
  const label = `Cache breakpoint ${index + 1}`;
  const candidate = breakpointRecord(entry, label);
  validateBreakpointFields(candidate, label);
  const filePath = breakpointPath(candidate.filePath, label, policy);
  assertUniqueBreakpoint(seen, filePath, candidate.line);
  const condition = breakpointCondition(candidate.condition);
  return {
    filePath,
    line: candidate.line as number,
    ...(condition ? { condition } : {}),
  };
}

/** Narrows a JSON value to a plain cache-breakpoint record. */
function breakpointRecord(
  entry: unknown,
  label: string,
): Record<string, unknown> {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    throw new TypeError(`${label} must be an object.`);
  }
  return entry as Record<string, unknown>;
}

/** Rejects unrecognized fields and invalid line or condition values. */
function validateBreakpointFields(
  candidate: Record<string, unknown>,
  label: string,
): asserts candidate is Record<string, unknown> & { line: number } {
  const hasUnknownKey = Object.keys(candidate).some(
    (key) => !CACHE_BREAKPOINT_KEYS.has(key),
  );
  const invalidLine =
    typeof candidate.line !== 'number' ||
    !Number.isSafeInteger(candidate.line) ||
    candidate.line < 1;
  const invalidCondition =
    candidate.condition !== undefined &&
    (typeof candidate.condition !== 'string' ||
      candidate.condition.length > MAX_CONDITION_LENGTH);
  if (hasUnknownKey || invalidLine || invalidCondition) {
    throw new TypeError(`${label} is invalid.`);
  }
}

/** Normalizes and root-checks one breakpoint source path. */
function breakpointPath(
  value: unknown,
  label: string,
  policy: CacheBreakpointPathPolicy,
): string {
  const pathLabel = `${label} path`;
  const path = policy.normalizeAbsolutePath(value, pathLabel);
  policy.assertWithinRoot(path, pathLabel);
  return path;
}

/** Rejects repeated marks for the same normalized source line. */
function assertUniqueBreakpoint(
  seen: Set<string>,
  filePath: string,
  line: number,
): void {
  const identity = `${filePath}\0${line}`;
  if (seen.has(identity)) {
    throw new TypeError(`Duplicate cache breakpoint at line ${line}.`);
  }
  seen.add(identity);
}

/** Trims optional condition text and drops empty expressions. */
function breakpointCondition(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const condition = value.trim();
  return condition || undefined;
}
