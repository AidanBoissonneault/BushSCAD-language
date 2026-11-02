/**
 * @author Aidan Boissonneault
 * @file part-group-layout.test.ts
 * @purpose Tests part group layout behavior in the core in three renderer package.
 * @last-edited October 6, 2026
 */

import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { applyPartGroupLayout } from '../../src/core/part-group-layout.js';

/**
 * Handles group in the core flow.
 */
function group(width: number): THREE.Group {
  const result = new THREE.Group();
  result.add(new THREE.Mesh(new THREE.BoxGeometry(width, 10, 10)));
  return result;
}

describe('part group layout', () => {
  it('preserves the established X-axis explode behavior', () => {
    const groups = new Map([
      ['a', group(20)],
      ['b', group(20)],
    ]);

    applyPartGroupLayout(groups, {
      explodedParts: new Set(['a', 'b']),
      plateOffsets: null,
      gapMm: 10,
    });

    expect(groups.get('a')?.position.x).toBe(-15);
    expect(groups.get('b')?.position.x).toBe(15);
  });

  it('applies explicit XYZ plate offsets instead of the explode line', () => {
    const groups = new Map([['part', group(20)]]);

    applyPartGroupLayout(groups, {
      explodedParts: new Set(['part']),
      plateOffsets: new Map([['part', { x: 12, y: -8, z: 3 }]]),
      gapMm: 10,
    });

    expect(groups.get('part')?.position.toArray()).toEqual([12, -8, 3]);
  });
});
