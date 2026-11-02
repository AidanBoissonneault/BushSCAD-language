/**
 * @author Aidan Boissonneault
 * @file sketch-segment-names.ts
 * @purpose Provides sketch segment names behavior for the sketch in resolver package.
 * @last-edited October 6, 2026
 */

import type { SketchPrimitive } from '@bushscad/ir';
import { collectPathSegmentNames } from './path-segment-names.js';

/**
 * Collects source names that become selectable edges on a derived solid.
 * Face-reference validation runs before evaluation and OCCT construction. It
 * therefore needs the same profile labels and compact rectangle side names
 * that the geometry bridge will later register on extruded objects.
 */
export function sketchPrimitiveSegmentNames(
  primitive: SketchPrimitive,
  componentPath: readonly string[] = [],
): Set<string> {
  switch (primitive.kind) {
    case 'pathSketch':
      return qualifyNames(
        collectPathSegmentNames(primitive.items),
        componentPath,
      );
    case 'rect':
      return qualifyNames(
        componentPath.length > 0
          ? [
              'bottom',
              'right',
              'top',
              'left',
              ...Object.values(primitive.sideNames ?? {}),
            ]
          : Object.values(primitive.sideNames ?? {}),
        componentPath,
      );
    case 'sketchAlias':
      return sketchPrimitiveSegmentNames(primitive.primitive, [
        ...componentPath,
        primitive.name,
      ]);
    case 'sketchAt':
    case 'sketchConstruction':
    case 'sketchOffset':
    case 'sketchFillet':
      return sketchPrimitiveSegmentNames(primitive.primitive, componentPath);
    case 'sketchBoolean':
      return unionNames(
        sketchPrimitiveSegmentNames(primitive.left, componentPath),
        sketchPrimitiveSegmentNames(primitive.right, componentPath),
      );
    default:
      return new Set();
  }
}

/**
 * Handles qualify names in the sketch flow.
 */
function qualifyNames(
  names: Iterable<string>,
  componentPath: readonly string[],
): Set<string> {
  const prefix = componentPath.length > 0 ? `${componentPath.join('.')}.` : '';
  return new Set([...names].map((name) => `${prefix}${name}`));
}

/**
 * Handles union names in the sketch flow.
 */
function unionNames(first: Set<string>, second: Set<string>): Set<string> {
  return new Set([...first, ...second]);
}
