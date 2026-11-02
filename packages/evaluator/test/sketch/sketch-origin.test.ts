/**
 * @author Aidan Boissonneault
 * @file sketch-origin.test.ts
 * @purpose Tests sketch origin behavior in the sketch in evaluator package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import { parse } from '@bushscad/parser';
import { resolve } from '@bushscad/resolver';
import type { IRSketch } from '@bushscad/ir';
import { evaluate } from '../../src/index.js';

/**
 * Handles no files in the sketch flow.
 */
const noFiles = () => null;

/**
 * Evaluates ok with the current evaluation context.
 */
function evalOk(source: string): IRSketch[] {
  const parsed = parse(source, 'sketch-origin.bscd');
  expect(parsed.errors.map((error) => error.message)).toEqual([]);
  const resolved = resolve(parsed.ast, 'sketch-origin.bscd', noFiles);
  expect(resolved.errors.map((error) => error.message)).toEqual([]);
  const evaluated = evaluate(resolved.ast);
  expect(evaluated.errors.map((error) => error.message)).toEqual([]);
  return evaluated.program.ops.filter(
    (op): op is IRSketch => op.kind === 'sketch',
  );
}

describe('sketch origin evaluation', () => {
  it('keeps centered primitives unchanged by default', () => {
    const [sketch] = evalOk('sketch base = rect(60, 40);');

    expect(sketch.primitive).toEqual({
      kind: 'rect',
      width: 60,
      height: 40,
    });
  });

  it('translates built-in corner-origin sketches , @evaluated bounds', () => {
    const sketches = evalOk(
      [
        'sketch rect_sk = rect(60, 40, corner);',
        'sketch circle_sk = circle(10, origin: corner);',
        'sketch tri_sk = triangle(30, 20, corner);',
        'sketch poly_sk = polygon([(0, 0), (10, 0), (5, 8)], corner);',
      ].join('\n'),
    );

    expect(sketches.map((sketch) => sketch.primitive)).toMatchObject([
      { kind: 'sketchAt', x: 30, y: -20 },
      { kind: 'sketchAt', x: 5, y: -5 },
      { kind: 'sketchAt', x: 15, y: -20 },
      { kind: 'sketchAt', x: 0, y: -8 },
    ]);
  });

  it('normalizes origin inside sketch booleans and references', () => {
    const sketches = evalOk(
      [
        'sketch hole = circle(4, corner);',
        'sketch keyhole = hole + rect(2, 6, corner) at (0, 3);',
      ].join('\n'),
    );
    const keyhole = sketches.find((sketch) => sketch.name === 'keyhole');

    expect(keyhole?.primitive).toMatchObject({
      kind: 'sketchBoolean',
      left: { kind: 'sketchAt', x: 2, y: -2 },
      right: {
        kind: 'sketchAt',
        x: 0,
        y: 3,
        primitive: { kind: 'sketchAt', x: 1, y: -3 },
      },
    });
  });
});
