/**
 * @author Aidan Boissonneault
 * @file mixed-path-primitives.test.ts
 * @purpose Tests mixed path primitives behavior in the sketch in evaluator package.
 * @last-edited October 6, 2026
 */

import { parse } from '@bushscad/parser';
import { resolve } from '@bushscad/resolver';
import type { IRProfileSegment, IRSketch } from '@bushscad/ir';
import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/index.js';

/**
 * Evaluates sketch with the current evaluation context.
 */
function evalSketch(source: string, name: string): IRSketch {
  const parsed = parse(source, 'mixed-path.bscd');
  expect(parsed.errors.map((error) => error.message)).toEqual([]);
  const resolved = resolve(parsed.ast, 'mixed-path.bscd', () => null);
  expect(resolved.errors.map((error) => error.message)).toEqual([]);
  const evaluated = evaluate(resolved.ast);
  expect(evaluated.errors.map((error) => error.message)).toEqual([]);
  const sketch = evaluated.program.ops.find(
    (operation): operation is IRSketch =>
      operation.kind === 'sketch' && operation.name === name,
  );
  if (!sketch) throw new Error(`Expected evaluated sketch '${name}'`);
  return sketch;
}

/**
 * Builds the profile data required by the current operation.
 */
function profileSegments(sketch: IRSketch): IRProfileSegment[] {
  expect(sketch.primitive.kind).toBe('profile');
  return sketch.primitive.kind === 'profile' ? sketch.primitive.segments : [];
}

/**
 * Asserts the expected point behavior in this test.
 */
function expectPoint(
  point: [number, number] | undefined,
  expected: [number, number],
): void {
  expect(point?.[0]).toBeCloseTo(expected[0], 7);
  expect(point?.[1]).toBeCloseTo(expected[1], 7);
}

describe('mixed path primitives', () => {
  it('flattens compact shapes with constraints and construction geometry', () => {
    const plate = evalSketch(
      `
sketch plate = path(
  rect(80, 40, top: mounting_top) at (40, 20),
  circle(12) at (20, 20),
  construction center = line((0, 20), (80, 20)),
  constraint(mounting_top, horizontal)
);
`,
      'plate',
    );
    const segments = profileSegments(plate);

    expect(segments.map((segment) => segment.name)).toEqual([
      'bottom',
      'right',
      'mounting_top',
      'left',
      'circle_2_q1',
      'circle_2_q2',
      'circle_2_q3',
      'circle_2_q4',
      'circle_2_radius',
      'center',
    ]);
    expect(segments.slice(0, 4)).toMatchObject([
      { from: [0, 0], to: [80, 0] },
      { from: [80, 0], to: [80, 40] },
      { from: [80, 40], to: [0, 40] },
      { from: [0, 40], to: [0, 0] },
    ]);
    expect(segments[8]).toMatchObject({
      construction: true,
      from: [20, 20],
      to: [26, 20],
    });
    expect(segments[9]).toMatchObject({
      construction: true,
      from: [0, 20],
      to: [80, 20],
    });
    expect(
      plate.primitive.kind === 'profile'
        ? plate.primitive.constraints?.[0]
        : null,
    ).toMatchObject({ target: 'mounting_top', constraint: 'horizontal' });
  });

  it('does not advance the cursor across an embedded primitive', () => {
    const segments = profileSegments(
      evalSketch(
        `
sketch cursor_test = path(
  lead = line((0, 0), (10, 0)),
  circle(4) at (30, 30),
  tail = line((20, 0))
);
`,
        'cursor_test',
      ),
    );

    expect(segments.find((segment) => segment.name === 'tail')).toMatchObject({
      from: [10, 0],
      to: [20, 0],
    });
  });

  it('uses a compact rectangle as the driver for midpoint construction', () => {
    const segments = profileSegments(
      evalSketch(
        `
sketch centered = path(
  rect(80, 40) at (40, 20),
  construction center = line((-4, 23), (84, 18)),
  constraint(center.start, midpoint, left),
  constraint(center.end, midpoint, right)
);
`,
        'centered',
      ),
    );

    expect(segments.slice(0, 4)).toMatchObject([
      { from: [0, 0], to: [80, 0] },
      { from: [80, 0], to: [80, 40] },
      { from: [80, 40], to: [0, 40] },
      { from: [0, 40], to: [0, 0] },
    ]);
    const center = segments.find((segment) => segment.name === 'center');
    expectPoint(center?.from, [0, 20]);
    expectPoint(center?.to, [80, 20]);
  });

  it('keeps compact circle geometry fixed when construction is attached', () => {
    const segments = profileSegments(
      evalSketch(
        `
sketch circle_driver = path(
  circle(12) at (20, 20),
  construction marker = line((0, 0), (35, 30)),
  constraint(marker.end, coincident, circle_1_q1.start)
);
`,
        'circle_driver',
      ),
    );

    expect(
      segments.find((segment) => segment.name === 'circle_1_q1'),
    ).toMatchObject({ from: [26, 20], to: [20, 26], radius: 6 });
    const marker = segments.find((segment) => segment.name === 'marker');
    expectPoint(marker?.to, [26, 20]);
  });

  it('solves point-pair horizontal and vertical constraints', () => {
    const segments = profileSegments(
      evalSketch(
        `
sketch aligned = path(
  anchor = line((0, 0), (10, 10)),
  follower = line((5, 9), (14, 22)),
  constraint(anchor, fixed),
  constraint(follower.start, horizontal, anchor.end),
  constraint(follower.start, vertical, anchor.start)
);
`,
        'aligned',
      ),
    );

    expect(segments.find((segment) => segment.name === 'anchor')).toMatchObject(
      { from: [0, 0], to: [10, 10] },
    );
    const follower = segments.find((segment) => segment.name === 'follower');
    expectPoint(follower?.from, [0, 10]);
    expect(follower?.to).toEqual([14, 22]);
  });
});
