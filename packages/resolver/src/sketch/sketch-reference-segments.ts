/**
 * @author Aidan Boissonneault
 * @file sketch-reference-segments.ts
 * @purpose Provides sketch reference segments behavior for the sketch in resolver package.
 * @last-edited October 6, 2026
 */

import type { State } from '../core/types.js';

/**
 * Carries selectable segment names through a sketch reference expression.
 * Evaluation clones referenced primitive metadata, so resolver-time face
 * validation must expose the same profile and rectangle-side names on the
 * derived sketch before an object consumes it.
 */
export function inheritSketchSegmentNames(
  targetSketch: string,
  sourceSketch: string,
  state: State,
): void {
  const sourceNames = state.profileSketchSegments.get(sourceSketch);
  if (!sourceNames) return;
  const targetNames =
    state.profileSketchSegments.get(targetSketch) ?? new Set();
  state.profileSketchSegments.set(
    targetSketch,
    new Set([...targetNames, ...sourceNames]),
  );
}
