/**
 * @author Aidan Boissonneault
 * @file custom-sketch-syntax.test.ts
 * @purpose Tests custom sketch syntax behavior in the sketch in parser package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import { parse } from '../../src/core/parser.js';
import type { Program, SketchDecl } from '@bushscad/ir';

/**
 * Parses ok from the supplied source into the sketch representation.
 */
function parseOk(source: string): Program {
  const result = parse(source, 'custom-sketch.bscd');
  expect(
    result.errors,
    `parse errors: ${result.errors.map((error) => error.message).join(', ')}`,
  ).toHaveLength(0);
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

describe('custom sketch syntax', () => {
  it('parses named, planted, anonymous, arc, and close path items', () => {
    const ast = parseOk(`
sketch profile = path(
  plant foot = line((6, 0), (18, 0)),
  wall = line((16, 32)),
  arc((12, 36), radius: 4, ccw),
  heel = close()
);
`);

    const sketch = firstSketch(ast);
    expect(sketch.primitive.kind).toBe('pathSketch');
    if (sketch.primitive.kind !== 'pathSketch') return;
    expect(
      sketch.primitive.items.map((item) =>
        item.kind === 'segment' ? item.name : undefined,
      ),
    ).toEqual(['foot', 'wall', undefined, 'heel']);
    expect(sketch.primitive.items[0]).toMatchObject({ plant: true });
    const wall = sketch.primitive.items[1];
    const crown = sketch.primitive.items[2];
    expect(wall.kind === 'segment' ? wall.segment : null).toMatchObject({
      kind: 'line',
      form: 'inferred',
    });
    expect(crown.kind === 'segment' ? crown.segment : null).toMatchObject({
      kind: 'arc',
      direction: 'ccw',
    });
  });

  it('requires tuple point syntax when a line displays two points', () => {
    const result = parse(
      'sketch bad = path(base = line(0, 0, 20, 0));',
      'custom-sketch.bscd',
    );

    expect(result.errors.map((error) => error.message)).toContain(
      'line() with two points must use point tuples: line((x1, y1), (x2, y2)). Use line(x, y) or line((x, y)) for one cursor endpoint.',
    );
  });

  it('parses constraints inside path sketches', () => {
    const ast = parseOk(`
sketch plate = path(
  plant bottom = line((0, 0), (80, 0)),
  right = line((80, 40)),
  top = line((0, 40)),
  close(),
  constraint(bottom.start, fixed),
  constraint(bottom, horizontal),
  constraint(right, vertical),
  constraint(top, parallel, bottom),
  constraint(bottom, length, 80),
  constraint(right, length, 40)
);
`);

    const sketch = firstSketch(ast);
    expect(sketch.primitive.kind).toBe('pathSketch');
    if (sketch.primitive.kind !== 'pathSketch') return;
    expect(sketch.primitive.constraints).toHaveLength(6);
    expect(sketch.primitive.constraints[0]).toMatchObject({
      target: 'bottom.start',
      constraint: 'fixed',
    });
    expect(sketch.primitive.constraints[3]).toMatchObject({
      target: 'top',
      constraint: 'parallel',
      ref: 'bottom',
    });
    expect(sketch.primitive.constraints[4]).toMatchObject({
      target: 'bottom',
      property: 'length',
      constraint: 'length',
    });
  });

  it('parses endpoint distance dimensions inside path sketches', () => {
    const ast = parseOk(`
sketch span = path(
  plant base = line((0, 0), (40, 0)),
  constraint(base.start, distance, base.end, 40)
);
`);

    const sketch = firstSketch(ast);
    expect(sketch.primitive.kind).toBe('pathSketch');
    if (sketch.primitive.kind !== 'pathSketch') return;
    expect(sketch.primitive.constraints[0]).toMatchObject({
      target: 'base.start',
      ref: 'base.end',
      property: 'distance',
      constraint: 'distance',
    });
  });

  it('parses labeled driving and reference dimensions inside path sketches', () => {
    const ast = parseOk(`
sketch span = path(
  origin((5, 2)),
  plant base = line((0, 0), (40, 0)),
  constraint(base, length, 40, (20, -8)),
  dimension base.length at (20, -14),
  dimension base.start.distance to base.end at (20, -20),
  dimension base.start.distance to origin.x_axis at (20, -26)
);
`);

    const sketch = firstSketch(ast);
    expect(sketch.primitive.kind).toBe('pathSketch');
    if (sketch.primitive.kind !== 'pathSketch') return;
    expect(sketch.primitive.placementOrigin).toBeDefined();
    expect(sketch.primitive.constraints[0].label).toBeDefined();
    expect(sketch.primitive.dimensions).toHaveLength(3);
    expect(sketch.primitive.dimensions[1]).toMatchObject({
      target: 'base.start',
      ref: 'base.end',
      property: 'distance',
      dimension: 'distance',
    });
    expect(sketch.primitive.dimensions[2]).toMatchObject({
      target: 'base.start',
      ref: 'origin.x_axis',
      dimension: 'distance',
    });
  });

  it('keeps at-prefixed constraint labels as a compatibility form', () => {
    const ast = parseOk(`
sketch span = path(
  plant base = line((0, 0), (40, 0)),
  constraint(base, length, 40, at: (20, -8))
);
`);

    const sketch = firstSketch(ast);
    expect(sketch.primitive.kind).toBe('pathSketch');
    if (sketch.primitive.kind !== 'pathSketch') return;
    expect(sketch.primitive.constraints[0].label).toBeDefined();
  });

  it('reports a migration diagnostic for old constrain statements', () => {
    const result = parse(
      `sketch bad = path(
  bottom = line((0, 0), (10, 0)),
  constrain bottom horizontal
);`,
      'custom-sketch.bscd',
    );

    expect(result.errors.map((error) => error.message)).toContain(
      'Old constrain syntax has been removed. Use constraint(target, type, ...) instead.',
    );
  });

  it('parses construction path items and advanced sketch calls', () => {
    const ast = parseOk(`
sketch guide_sketch = path(
  construction center = line((0, 0), (40, 0)),
  plant edge = line((0, 5), (40, 5))
);
sketch padded = offset(rect(20, 10), 2);
sketch rounded = fillet(rect(20, 10), 3);
sketch exact_circle = ellipse(12, 12);
sketch projected = project(@body.top.edges);
`);

    const sketches = ast.statements.filter(
      (stmt): stmt is SketchDecl => stmt.kind === 'sketch',
    );
    expect(sketches[0].primitive.kind).toBe('pathSketch');
    if (sketches[0].primitive.kind === 'pathSketch') {
      expect(sketches[0].primitive.items[0]).toMatchObject({
        construction: true,
      });
    }
    expect(sketches.map((sketch) => sketch.primitive.kind)).toEqual([
      'pathSketch',
      'sketchOffset',
      'sketchFillet',
      'ellipse',
      'unsupportedSketch',
    ]);
  });

  it('parses locally placed rectangles and circles inside mixed paths', () => {
    const ast = parseOk(`
sketch plate = path(
  rect(80, 40, top: mounting_top) at (40, 20),
  circle(12) at (20, 20),
  construction center = line((0, 20), (80, 20))
);
`);

    const sketch = firstSketch(ast);
    expect(sketch.primitive.kind).toBe('pathSketch');
    if (sketch.primitive.kind !== 'pathSketch') return;
    expect(sketch.primitive.items.map((item) => item.kind)).toEqual([
      'primitive',
      'primitive',
      'segment',
    ]);
    const rectangle = sketch.primitive.items[0];
    const circle = sketch.primitive.items[1];
    expect(
      rectangle.kind === 'primitive' ? rectangle.primitive : null,
    ).toMatchObject({
      kind: 'sketchAt',
      x: { kind: 'number', value: 40 },
      primitive: { kind: 'rect', sideNames: { top: 'mounting_top' } },
    });
    expect(circle.kind === 'primitive' ? circle.primitive : null).toMatchObject(
      {
        kind: 'sketchAt',
        primitive: { kind: 'circle' },
      },
    );
  });

  it('parses wrap modes and keyword options', () => {
    const ast = parseOk(`
sketch blob = wrap([
  (-20, -5),
  (-8, -16),
  (14, -10),
  (20, 6)
], smooth, tension: 0.4);
`);

    const sketch = firstSketch(ast);
    expect(sketch.primitive.kind).toBe('wrapSketch');
    if (sketch.primitive.kind !== 'wrapSketch') return;
    expect(sketch.primitive.mode).toBe('smooth');
    expect(sketch.primitive.options[0]?.name).toBe('tension');
  });

  it('reports planted anonymous path elements and unknown wrap modes', () => {
    const result = parse(
      `
sketch bad_path = path(plant line((0, 0), (20, 0)));
sketch bad_wrap = wrap([(0, 0), (1, 0), (0, 1)], rubber);
`,
      'custom-sketch.bscd',
    );

    expect(result.errors.map((error) => error.message)).toEqual(
      expect.arrayContaining([
        'Planted sketch elements must be named. Use plant name = line(...).',
        "Unknown wrap mode 'rubber'. Expected ordered, convex, concave, or smooth.",
      ]),
    );
  });
});
