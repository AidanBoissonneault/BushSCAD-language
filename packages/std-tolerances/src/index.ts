/**
 * @author Aidan Boissonneault
 * @file index.ts
 * @purpose Public entry point for std tolerances package.
 * @last-edited October 6, 2026
 */

export type { FitKind, ToleranceLevel, ProfileOffsets } from './types/types.js';
export { PROFILES, DEFAULT_PROFILE } from './profiles/profiles.js';

import type { FitKind, ToleranceLevel } from './types/types.js';
import { PROFILES, DEFAULT_PROFILE } from './profiles/profiles.js';

/**
 * Returns the millimetre offset for a process, fit, and tolerance level.
 * Unknown profiles use the normal FDM offset.
 */
export function lookupToleranceOffset(
  profile: string,
  fitKind: FitKind,
  level: ToleranceLevel,
): number {
  const p = PROFILES[profile] ?? PROFILES[DEFAULT_PROFILE];
  return p[fitKind][level];
}

export const VALID_FIT_KINDS: ReadonlySet<FitKind> = new Set([
  'clearance',
  'slip',
  'press',
  'interference',
  'loose',
  'tight',
]);

export const VALID_TOLERANCE_LEVELS: ReadonlySet<ToleranceLevel> = new Set([
  'normal',
  'tight',
  'loose',
]);

export const PROCESS_PROFILE_PREFIXES = [
  'std.printing.',
  'std.machining.',
  'std.cutting.',
];

/**
 * Returns whether the input meets the `process profile library` condition.
 */
export function isProcessProfileLibrary(library: string): boolean {
  return PROCESS_PROFILE_PREFIXES.some((prefix) => library.startsWith(prefix));
}
