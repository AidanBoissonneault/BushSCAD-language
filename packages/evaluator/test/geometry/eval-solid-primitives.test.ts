/**
 * @author Aidan Boissonneault
 * @file eval-solid-primitives.test.ts
 * @purpose Tests eval solid primitives behavior in the geometry in evaluator package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import { parse } from '@bushscad/parser';
import { resolve } from '@bushscad/resolver';
import type { IRSolidPrimitive } from '@bushscad/ir';
import { evaluate } from '../../src/index.js';

/**
 * Handles no files in the geometry flow.
 */
const noFiles = () => null;

/**
 * Evaluates ok with the current evaluation context.
 */
function evalOk(source: string): IRSolidPrimitive[] {
  const parsed = parse(source, 'solid-primitives.bscd');
  expect(parsed.errors).toHaveLength(0);
  const resolved = resolve(parsed.ast, 'solid-primitives.bscd', noFiles);
  expect(resolved.errors).toHaveLength(0);
  const result = evaluate(resolved.ast);
  expect(result.errors).toHaveLength(0);
  return result.program.ops.filter(
    (op): op is IRSolidPrimitive => op.kind === 'solidPrimitive',
  );
}

describe('direct solid primitive evaluation', () => {
  it('normalizes cube and cylinder args into concrete IR', () => {
    const [cube, cylinder] = evalOk(`
obj block = cube([40, 20, 8]);
obj pin = cylinder(12, d: 6);
`);
    expect(cube.shape).toMatchObject({
      primitive: 'cuboid',
      size: [40, 20, 8],
    });
    expect(cylinder.shape).toMatchObject({
      primitive: 'cylinder',
      height: 12,
      radius: 3,
    });
  });

  it('lowers trailing placement to IR placement', () => {
    const [, placed] = evalOk(`
obj base = cube([40, 20, 8]);
obj pin = cylinder(12, d: 6, @base.top.center);
`);
    expect(placed.placement).toMatchObject({ faceRef: 'base.top.center' });
  });
});
