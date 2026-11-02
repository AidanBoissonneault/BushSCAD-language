/**
 * @author Aidan Boissonneault
 * @file plate-layout.test.ts
 * @purpose Tests plate layout behavior in the core in three renderer package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import {
  computePlateLayout,
  includeVerticesInPartBounds,
  type PlatePartBounds,
} from '../../src/core/plate-layout.js';

/**
 * Handles part in the core flow.
 */
function part(
  name: string,
  width: number,
  depth: number,
  minZ = 0,
): PlatePartBounds {
  return { name, minX: 0, maxX: width, minY: 0, maxY: depth, minZ };
}

describe('printer plate layout', () => {
  it('centers two parts side by side with a printable gap', () => {
    const offsets = computePlateLayout(
      [part('left', 80, 80), part('right', 80, 80)],
      220,
      220,
      10,
    );

    expect(offsets.get('left')).toEqual({ x: -85, y: -40, z: -0 });
    expect(offsets.get('right')).toEqual({ x: 5, y: -40, z: -0 });
  });

  it('wraps footprints into rows that fit the available bed width', () => {
    const offsets = computePlateLayout(
      ['a', 'b', 'c', 'd'].map((name) => part(name, 100, 100)),
      220,
      220,
      10,
    );

    expect(offsets.get('a')).toEqual({ x: -105, y: -105, z: -0 });
    expect(offsets.get('d')).toEqual({ x: 5, y: 5, z: -0 });
  });

  it('places each part bottom on the printer bed', () => {
    const offsets = computePlateLayout(
      [part('raised', 20, 20, -4)],
      100,
      100,
      5,
    );

    expect(offsets.get('raised')?.z).toBe(4);
  });

  it('accumulates translated XYZ vertices for presentation bounds', () => {
    const bounds = { ...part('translated', 0, 0), maxZ: -Infinity };
    bounds.minX = Infinity;
    bounds.minY = Infinity;
    bounds.minZ = Infinity;
    bounds.maxX = -Infinity;
    bounds.maxY = -Infinity;
    includeVerticesInPartBounds(
      bounds,
      new Float32Array([-2, 1, 3, 4, -5, 6]),
      { x: 10, y: 20, z: 30 },
    );
    expect(bounds).toMatchObject({
      minX: 8,
      maxX: 14,
      minY: 15,
      maxY: 21,
      minZ: 33,
      maxZ: 36,
    });
  });
});
