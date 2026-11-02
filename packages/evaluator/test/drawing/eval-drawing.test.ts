/**
 * @author Aidan Boissonneault
 * @file eval-drawing.test.ts
 * @purpose Tests eval drawing behavior in the drawing in evaluator package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import { evalOk } from '../core/test-support.js';

describe('drawing evaluation', () => {
  it('resolves part-qualified view and dimension object references', () => {
    const result = evalOk(`
      part main {
        sketch profile = rect(60, 40);
        obj base = extrude(profile, 10);
        sketch hole_sk = circle(d: 8);
        obj hole = cut(hole_sk, through base , @base.top(x: 30, y: 20));
      }

      drawing plate_sheet {
        view main.top scale: 1;
        dimension main.width;
        dimension main.hole.center to main.base.left;
        export svg './exports/plate.svg';
      }
    `);

    const drawing = result.drawings.drawings[0];
    expect(drawing.view.objName).toBe('main');
    expect(drawing.dimensions).toEqual([
      { kind: 'obj_extent', objName: 'main', axis: 'width' },
      {
        kind: 'point_to_face',
        fromObjName: 'hole',
        fromFace: 'center',
        toObjName: 'base',
        toFace: 'left',
      },
    ]);
  });
});
