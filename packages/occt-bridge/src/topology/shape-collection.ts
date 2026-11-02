/**
 * @author Aidan Boissonneault
 * @file shape-collection.ts
 * @purpose Provides shape collection behavior for the topology in OpenCascade bridge package.
 * @last-edited October 6, 2026
 */

import { sameTopoShape } from './shape-equality.js';

/**
 * Checks whether the supplied shape values are equivalent.
 */
export function sameShape(a: unknown, b: unknown): boolean {
  return sameTopoShape(a, b);
}

/**
 * Removes duplicate shapes values while preserving their first occurrence.
 */
export function uniqueShapes<T>(shapes: T[]): T[] {
  const unique: T[] = [];
  for (const shape of shapes) {
    if (!unique.some((existing) => sameShape(existing, shape))) {
      unique.push(shape);
    }
  }
  return unique;
}
