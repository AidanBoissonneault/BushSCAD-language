/**
 * @author Aidan Boissonneault
 * @file sketch-references.ts
 * @purpose Provides sketch references behavior for the sketch in resolver package.
 * @last-edited October 6, 2026
 */

/**
 * Checks whether a sketch reference names a built-in global reference.
 * Origin and axis references are valid in sketch dimensions without being
 * declared as user segments or points.
 */
function isGlobalSketchReference(target: string): boolean {
  return (
    target === 'origin' ||
    target === 'origin.x_axis' ||
    target === 'origin.y_axis'
  );
}

/**
 * Returns whether the input meets the `known sketch name` condition.
 */
export function isKnownSketchName(target: string, names: Set<string>): boolean {
  return names.has(target) || isGlobalSketchReference(target);
}
