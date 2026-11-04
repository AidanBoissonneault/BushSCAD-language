import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { drawPrimitive } from '../../../../src/sketch-preview/sketch-preview-primitives.js';

vi.mock('../../../../src/sketch-preview/sketch-preview-dimensions.js', () => ({
  drawBoundsDimensions: vi.fn(),
}));

describe('sketch preview primitives', () => {
  it('draws rectangle outlines from centered bounds', () => {
    const group = new THREE.Group();

    drawPrimitive(group, { kind: 'rect', width: 12, height: 6 }, 10);

    expect(group.children).toHaveLength(1);
    const outline = group.children[0] as THREE.LineSegments;
    const positions = outline.geometry.getAttribute('position');
    expect(positions.count).toBe(8);
    expect(Array.from(positions.array)).toEqual([
      -6, -3, 0, 6, -3, 0, 6, -3, 0, 6, 3, 0, 6, 3, 0, -6, 3, 0, -6, 3, 0, -6,
      -3, 0,
    ]);
  });
});
