/**
 * @author Aidan Boissonneault
 * @file rect-plant.test.ts
 * @purpose Tests rect plant behavior in the sketch in evaluator package.
 * @last-edited October 6, 2026
 */

import type { IRAlignShape, IROp, IRSketch, RectSide } from '@bushscad/ir';
import { describe, expect, it } from 'vitest';
import { evalOk, evalOps } from '../core/test-support.js';

/**
 * Handles evaluated sketch in the sketch flow.
 */
function evaluatedSketch(source: string): IRSketch {
  const sketch = evalOk(source).program.ops.find(
    (operation): operation is IRSketch => operation.kind === 'sketch',
  );
  if (!sketch) throw new Error('Expected an evaluated sketch');
  return sketch;
}

/**
 * Handles align shape in the sketch flow.
 */
function alignShape(ops: IROp[]): IRAlignShape {
  const align = ops.find(
    (operation): operation is IRAlignShape => operation.kind === 'alignShape',
  );
  if (!align) throw new Error('Expected a placement alignment');
  return align;
}

describe('rectangle plant evaluation', () => {
  it.each<RectSide>(['bottom', 'right', 'top', 'left'])(
    'lowers the canonical %s side into rectangle IR',
    (side) => {
      const sketch = evaluatedSketch(
        `sketch plate = rect(40, 20) plant ${side};`,
      );

      expect(sketch.primitive).toMatchObject({ kind: 'rect', plant: side });
    },
  );

  it('retains plant metadata beneath local placement', () => {
    const sketch = evaluatedSketch(
      'sketch plate = rect(40, 20) at (28, 16) plant bottom;',
    );

    expect(sketch.primitive).toMatchObject({
      kind: 'sketchAt',
      x: 28,
      y: 16,
      primitive: { kind: 'rect', width: 40, height: 20, plant: 'bottom' },
    });
  });

  it.each([
    ['bottom', 'front'],
    ['right', 'right'],
    ['top', 'back'],
    ['left', 'left'],
  ] as const)(
    'uses planted %s as the default downstream %s placement face',
    (side, face) => {
      const ops = evalOps(`
part root {
  sketch profile = rect(40, 20) plant ${side};
  ref body = extrude(profile, 4);
  place(body);
}
`);

      expect(alignShape(ops)).toMatchObject({
        name: 'body',
        sourceRef: `body.${face}.center`,
        targetPlacement: { faceRef: '0,0,0' },
      });
    },
  );

  it('translates the planted midpoint used by component placement', () => {
    const ops = evalOps(`
ref bracket {
  sketch plate = rect(40, 20) at (28, 16) plant bottom;
  obj body = extrude(plate, 4);
}
part base_part {
  sketch base = rect(80, 40);
  obj base = extrude(base, 2);
  place(bracket, @base.top.center);
}
`);
    const placed = ops.find(
      (operation): operation is IRSketch =>
        operation.kind === 'sketch' && Boolean(operation.placement?.anchor),
    );

    expect(placed?.placement?.anchor).toMatchObject({
      localPoint: [28, 6, 0],
      localNormal: [0, -1, 0],
    });
  });
});
