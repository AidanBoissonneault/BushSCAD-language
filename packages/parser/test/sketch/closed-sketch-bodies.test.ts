/**
 * @author Aidan Boissonneault
 * @file closed-sketch-bodies.test.ts
 * @purpose Tests closed sketch bodies behavior in the sketch in parser package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import type { Program, SketchDecl } from '@bushscad/ir';
import { parse } from '../../src/core/parser.js';

/**
 * Parses ok from the supplied source into the sketch representation.
 */
function parseOk(source: string): Program {
  const result = parse(source, 'closed-bodies.bscd');
  expect(result.errors.map((error) => error.message)).toEqual([]);
  return result.ast;
}

/**
 * Returns the first sketch that matches the requested condition.
 */
function firstSketch(ast: Program): SketchDecl {
  const sketch = ast.statements.find(
    (stmt): stmt is SketchDecl => stmt.kind === 'sketch',
  );
  if (!sketch) throw new Error('Expected sketch declaration');
  return sketch;
}

describe('closed sketch body syntax', () => {
  it('parses named and ignored closed bodies inside path sketches', () => {
    const ast = parseOk(`
sketch plate = path(
  bottom = line((0, 0), (20, 0)),
  right = line((20, 10)),
  top = line((0, 10)),
  left = close(),
  tab = closed(10, 5),
  ignoreClosed((15, 5))
);
`);

    const sketch = firstSketch(ast);
    expect(sketch.primitive.kind).toBe('pathSketch');
    if (sketch.primitive.kind !== 'pathSketch') return;
    expect(sketch.primitive.closedBodies[0]).toMatchObject({
      kind: 'closedBody',
      name: 'tab',
    });
    expect(sketch.primitive.ignoredClosedBodies).toHaveLength(1);
    expect(sketch.primitive.bodyExpressions).toEqual([]);
    expect(sketch.primitive.ignoredBodyExpressions).toEqual([]);
  });

  it('parses feature-anchored body algebra and ignored expressions', () => {
    const ast = parseOk(`
sketch plate = path(
  bottom = line((0, 0), (20, 0)),
  right = line((20, 10)),
  top = line((0, 10)),
  left = close(),
  outer = loop(bottom),
  ring = outer - loop(hole_edge),
  combined = ring + cap & overlap,
  grouped = (ring + cap) & overlap,
  ignore(ring + scrap)
);
`);

    const sketch = firstSketch(ast);
    expect(sketch.primitive.kind).toBe('pathSketch');
    if (sketch.primitive.kind !== 'pathSketch') return;

    expect(sketch.primitive.bodyExpressions).toHaveLength(4);
    expect(sketch.primitive.bodyExpressions[0]).toMatchObject({
      kind: 'bodyExpression',
      name: 'outer',
      expression: {
        kind: 'pathBodyLoop',
        featureName: 'bottom',
      },
    });
    expect(sketch.primitive.bodyExpressions[1]).toMatchObject({
      name: 'ring',
      expression: {
        kind: 'pathBodyBoolean',
        op: 'subtract',
        left: { kind: 'pathBodyRef', name: 'outer' },
        right: { kind: 'pathBodyLoop', featureName: 'hole_edge' },
      },
    });
    expect(sketch.primitive.bodyExpressions[2]).toMatchObject({
      name: 'combined',
      expression: {
        kind: 'pathBodyBoolean',
        op: 'union',
        left: { kind: 'pathBodyRef', name: 'ring' },
        right: {
          kind: 'pathBodyBoolean',
          op: 'intersect',
          left: { kind: 'pathBodyRef', name: 'cap' },
          right: { kind: 'pathBodyRef', name: 'overlap' },
        },
      },
    });
    expect(sketch.primitive.bodyExpressions[3]).toMatchObject({
      name: 'grouped',
      expression: {
        kind: 'pathBodyBoolean',
        op: 'intersect',
        left: { kind: 'pathBodyBoolean', op: 'union' },
        right: { kind: 'pathBodyRef', name: 'overlap' },
      },
    });
    expect(sketch.primitive.ignoredBodyExpressions[0]).toMatchObject({
      kind: 'ignoredBodyExpression',
      expression: {
        kind: 'pathBodyBoolean',
        op: 'union',
        left: { kind: 'pathBodyRef', name: 'ring' },
        right: { kind: 'pathBodyRef', name: 'scrap' },
      },
    });
  });

  it('parses sketch body operands and same-sketch body arrays', () => {
    const ast = parseOk(`
sketch plate = rect(20, 10);
obj one = extrude(plate.tab, 2);
obj two = extrude([plate.tab, plate.slot], 2);
`);

    const objects = ast.statements.filter((stmt) => stmt.kind === 'obj');
    expect(objects[0].operation.kind).toBe('extrude');
    if (objects[0].operation.kind === 'extrude') {
      expect(objects[0].operation.sketch).toMatchObject({
        kind: 'namedSketchBody',
        sketchName: 'plate',
        bodyName: 'tab',
      });
    }
    if (objects[1].operation.kind === 'extrude') {
      expect(objects[1].operation.sketch).toMatchObject({
        kind: 'sketchBodyList',
        sketchName: 'plate',
        bodyNames: ['tab', 'slot'],
      });
    }
  });
});
