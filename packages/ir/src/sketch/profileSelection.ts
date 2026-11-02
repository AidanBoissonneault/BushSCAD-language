/**
 * @author Aidan Boissonneault
 * @file profileSelection.ts
 * @purpose Provides profile selection behavior for the sketch in IR package.
 * @last-edited October 6, 2026
 */

import type { IRPrimitive } from './sketchIr.js';

/**
 * The profile variant of an IR primitive, used where sketch-preview code needs profile-specific
 * geometry.
 */
type ProfilePrimitive = Extract<IRPrimitive, { kind: 'profile' }>;

/** A profile together with local translations applied by `sketchAt` wrappers. */
export type IRProfileSelectionSource = {
  profile: ProfilePrimitive;
  x: number;
  y: number;
};

/**
 * Finds selectable profile metadata beneath local sketch translations.
 * Body names belong to the underlying solved profile, while face construction
 * must still preserve every authored `at (x, y)` wrapper around that profile.
 */
export function profileSelectionSource(
  primitive: IRPrimitive | undefined,
): IRProfileSelectionSource | null {
  let current = primitive;
  let x = 0;
  let y = 0;
  while (current?.kind === 'sketchAt') {
    x += current.x;
    y += current.y;
    current = current.primitive;
  }
  return current?.kind === 'profile' ? { profile: current, x, y } : null;
}
