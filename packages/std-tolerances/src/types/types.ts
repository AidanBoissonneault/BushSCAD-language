/**
 * @author Aidan Boissonneault
 * @file types.ts
 * @purpose Defines fit classes, tolerance levels, and their profile offsets.
 * @last-edited October 6, 2026
 */

/**
 * Accepted values for fit kind are 'clearance', 'slip', 'press', 'interference', 'loose', and
 * 'tight'.
 */

export type FitKind =
  | 'clearance'
  | 'slip'
  | 'press'
  | 'interference'
  | 'loose'
  | 'tight';
/**
 * Accepted values for tolerance level are 'normal', 'tight', and 'loose'.
 */
export type ToleranceLevel = 'normal' | 'tight' | 'loose';

// mm offset per fit kind per tolerance level for a given process profile.
// Positive = hole grows (clearance). Negative = hole shrinks (interference).
/**
 * Lookup from FitKind keys to Record<ToleranceLevel, number> values.
 */
export type ProfileOffsets = Record<FitKind, Record<ToleranceLevel, number>>;
