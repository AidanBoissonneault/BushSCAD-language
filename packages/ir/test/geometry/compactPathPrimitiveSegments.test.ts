/**
 * @author Aidan Boissonneault
 * @file compactPathPrimitiveSegments.test.ts
 * @purpose Tests compact path primitive segments behavior in the geometry in IR package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import {
  compactPathPrimitiveSegmentBases,
  compactPathPrimitiveSegments,
} from '../../src/index.js';

describe('compact path primitive segments', () => {
  it('materializes a placed rectangle with canonical and aliased sides', () => {
    const segments = compactPathPrimitiveSegments(
      {
        kind: 'sketchAt',
        x: 40,
        y: 20,
        primitive: {
          kind: 'rect',
          width: 80,
          height: 40,
          sideNames: { top: 'mount_top' },
        },
      },
      1,
    );

    expect(segments).toMatchObject([
      { name: 'bottom', from: [0, 0], to: [80, 0] },
      { name: 'right', from: [80, 0], to: [80, 40] },
      { name: 'mount_top', from: [80, 40], to: [0, 40] },
      { name: 'left', from: [0, 40], to: [0, 0] },
    ]);
  });

  it('materializes a circle as four arcs and its construction radius', () => {
    const segments = compactPathPrimitiveSegments(
      { kind: 'circle', diameter: 20 },
      2,
    );

    expect(segments?.map((segment) => segment.name)).toEqual([
      'circle_2_q1',
      'circle_2_q2',
      'circle_2_q3',
      'circle_2_q4',
      'circle_2_radius',
    ]);
    expect(segments?.slice(0, 4)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'arc', radius: 10 }),
      ]),
    );
    expect(segments?.at(-1)).toMatchObject({
      kind: 'line',
      from: [0, 0],
      to: [10, 0],
      construction: true,
    });
  });

  it('uses later-shape rectangle prefixes independently of dimensions', () => {
    expect(compactPathPrimitiveSegmentBases({ kind: 'rect' }, 3)).toEqual([
      'rect_3_bottom',
      'rect_3_right',
      'rect_3_top',
      'rect_3_left',
    ]);
  });

  it('materializes a placed ellipse as one exact closed curve', () => {
    const segments = compactPathPrimitiveSegments(
      {
        kind: 'sketchAt',
        x: 5,
        y: -3,
        primitive: { kind: 'ellipse', width: 40, height: 20 },
      },
      3,
    );

    expect(segments).toMatchObject([
      {
        kind: 'ellipse',
        name: 'ellipse_3',
        center: [5, -3],
        radiusX: 20,
        radiusY: 10,
        from: [25, -3],
        to: [25, -3],
        full: true,
      },
    ]);
  });

  it('refuses rounded rectangles instead of changing their geometry', () => {
    expect(
      compactPathPrimitiveSegments(
        { kind: 'rect', width: 20, height: 10, cornerRadius: 2 },
        1,
      ),
    ).toBeNull();
  });
});
