/**
 * @author Aidan Boissonneault
 * @file rect-plant.test.ts
 * @purpose Tests rect plant behavior in the sketch in IR package.
 * @last-edited October 6, 2026
 */

import type { IRPrimitive, RectSide } from '../../src/index.js';
import { findPlantLineSegment } from '../../src/index.js';
import { describe, expect, it } from 'vitest';

const EDGES: Record<
  RectSide,
  { from: [number, number]; to: [number, number] }
> = {
  bottom: { from: [-20, -10], to: [20, -10] },
  right: { from: [20, -10], to: [20, 10] },
  top: { from: [20, 10], to: [-20, 10] },
  left: { from: [-20, 10], to: [-20, -10] },
};

describe('rectangle plant IR', () => {
  it.each<RectSide>(['bottom', 'right', 'top', 'left'])(
    'synthesizes the directed %s boundary line',
    (side) => {
      const primitive: IRPrimitive = {
        kind: 'rect',
        width: 40,
        height: 20,
        plant: side,
      };

      expect(findPlantLineSegment(primitive)).toMatchObject({
        kind: 'line',
        name: side,
        ...EDGES[side],
        plant: true,
      });
    },
  );

  it('uses the planted side alias and translates through nested placement', () => {
    const primitive: IRPrimitive = {
      kind: 'sketchAt',
      x: 20,
      y: 10,
      primitive: {
        kind: 'sketchAt',
        x: 8,
        y: 6,
        primitive: {
          kind: 'rect',
          width: 40,
          height: 20,
          sideNames: { bottom: 'mount_edge' },
          plant: 'bottom',
        },
      },
    };

    expect(findPlantLineSegment(primitive)).toEqual({
      kind: 'line',
      name: 'mount_edge',
      from: [8, 6],
      to: [48, 6],
      plant: true,
    });
  });

  it('returns no boundary for an unplanted rectangle', () => {
    expect(
      findPlantLineSegment({ kind: 'rect', width: 40, height: 20 }),
    ).toBeNull();
  });
});
