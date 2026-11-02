/**
 * @author Aidan Boissonneault
 * @file joint-syntax.test.ts
 * @purpose Tests joint syntax behavior in the objects in parser package.
 * @last-edited October 6, 2026
 */

import type { JointDecl } from '@bushscad/ir';
import { describe, expect, it } from 'vitest';
import { parse } from '../../src/core/parser.js';
import { parseOk } from '../fixtures/parse.js';

describe('joint syntax', () => {
  it('parses modern @ spatial references for both joint endpoints', () => {
    const ast = parseOk(`
part drawer { obj body = cube([20, 10, 5]); }
part housing { obj body = cube([30, 20, 10]); }
slider slide(@drawer.body.front, @housing.body.front) {
  range = 0mm..30mm;
  default = 10mm;
}
`);
    const joint = ast.statements[2] as JointDecl;

    expect(joint).toMatchObject({
      kind: 'joint',
      name: 'slide',
      sideA: 'drawer.body.front',
      sideB: 'housing.body.front',
      jointType: 'slider',
    });
  });

  it('rejects the unreleased joint-between block form', () => {
    const result = parse(
      'joint slide between @drawer.front and @housing.front { type: slider; }',
      'test.bscd',
    );

    expect(result.errors.map((error) => error.message)).toContain(
      "Unexpected token 'joint'",
    );
  });
});
