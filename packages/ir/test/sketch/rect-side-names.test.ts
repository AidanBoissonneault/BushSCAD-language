/**
 * @author Aidan Boissonneault
 * @file rect-side-names.test.ts
 * @purpose Tests rect side names behavior in the sketch in IR package.
 * @last-edited October 6, 2026
 */

import type { IRRectPrimitive, RectSide } from '../../src/index.js';
import { sketchPreviewPrimitiveBounds } from '../../src/index.js';
import { describe, expect, it } from 'vitest';

describe('rectangle side-name IR', () => {
  it('retains side metadata without changing rectangle bounds', () => {
    const side: RectSide = 'bottom';
    const rectangle: IRRectPrimitive = {
      kind: 'rect',
      width: 80,
      height: 40,
      sideNames: { [side]: 'mount_edge' },
    };

    expect(rectangle.sideNames?.bottom).toBe('mount_edge');
    expect(sketchPreviewPrimitiveBounds(rectangle)).toEqual({
      minX: -40,
      maxX: 40,
      minY: -20,
      maxY: 20,
      width: 80,
      height: 40,
    });
  });
});
