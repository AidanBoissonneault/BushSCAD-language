/**
 * @author Aidan Boissonneault
 * @file array-selection.test.ts
 * @purpose Tests array selection behavior in the references in parser package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import type {
  FaceRefList,
  FilletDetail,
  LoftOp,
  ObjDecl,
  PartDecl,
  PathSketchPrimitive,
  SketchDecl,
} from '@bushscad/ir';
import { parse } from '../../src/core/parser.js';

/**
 * Parses ok from the supplied source into the references representation.
 */
function parseOk(source: string): ReturnType<typeof parse>['ast'] {
  const result = parse(source, 'array-selection.test.bscd');
  expect(
    result.errors,
    `parse errors: ${result.errors.map((error) => error.message).join(', ')}`,
  ).toHaveLength(0);
  return result.ast;
}

/**
 * Parses errors from the supplied source into the references representation.
 */
function parseErrors(source: string): string[] {
  return parse(source, 'array-selection.test.bscd').errors.map(
    (error) => error.message,
  );
}

describe('array selectors', () => {
  it('parses grouped @ roots and grouped suffixes', () => {
    const ast = parseOk(`
part p {
  fillet(@[body1, body2].[top, bottom].[left, right], 2);
}
`);
    const part = ast.statements[0] as PartDecl;
    const fillet = part.body.statements[0] as FilletDetail;
    expect(fillet.target.kind).toBe('faceRef');
    if (fillet.target.kind !== 'faceRef') return;
    expect(fillet.target.chain).toEqual([
      expect.objectContaining({
        kind: 'group',
        options: ['body1', 'body2'],
      }),
      expect.objectContaining({
        kind: 'group',
        options: ['top', 'bottom'],
      }),
      expect.objectContaining({
        kind: 'group',
        options: ['left', 'right'],
      }),
    ]);
    for (const segment of fillet.target.chain) {
      if (segment.kind !== 'group') continue;
      expect(segment.memberSpans).toHaveLength(2);
      expect(segment.delimiterSpan).toEqual(segment.span);
      expect(segment.memberSpans[0]?.col).toBeGreaterThan(segment.span.col);
      expect(segment.memberSpans[1]?.col).toBeGreaterThan(
        segment.memberSpans[0]?.col ?? 0,
      );
    }
  });

  it('parses explicit @ reference lists with shared suffixes', () => {
    const ast = parseOk(`
part p {
  fillet([@body1, @body2].[top, bottom], 2);
}
`);
    const part = ast.statements[0] as PartDecl;
    const fillet = part.body.statements[0] as FilletDetail;
    expect(fillet.target.kind).toBe('faceRefList');
    const target = fillet.target as FaceRefList;
    expect(target.items).toHaveLength(2);
    expect(target.suffix).toEqual([
      expect.objectContaining({ kind: 'group', options: ['top', 'bottom'] }),
    ]);
  });

  it('parses indexed reference roots', () => {
    const ast = parseOk(`
part p {
  fillet(@pocket[1].top.edges, 2);
}
`);
    const part = ast.statements[0] as PartDecl;
    const fillet = part.body.statements[0] as FilletDetail;
    expect(fillet.target.kind).toBe('faceRef');
    if (fillet.target.kind !== 'faceRef') return;
    expect(fillet.target.chain).toEqual([
      expect.objectContaining({ kind: 'name', value: 'pocket' }),
      expect.objectContaining({ kind: 'index', value: 1 }),
      expect.objectContaining({ kind: 'name', value: 'top' }),
      expect.objectContaining({ kind: 'name', value: 'edges' }),
    ]);
  });

  it('parses wildcard reference selectors', () => {
    const ast = parseOk(`
part p {
  fillet(@[body1, body2].*.top.edges, 2);
}
`);
    const part = ast.statements[0] as PartDecl;
    const fillet = part.body.statements[0] as FilletDetail;
    expect(fillet.target.kind).toBe('faceRef');
    if (fillet.target.kind !== 'faceRef') return;
    expect(fillet.target.chain).toEqual([
      expect.objectContaining({
        kind: 'group',
        options: ['body1', 'body2'],
      }),
      expect.objectContaining({ kind: 'wildcard' }),
      expect.objectContaining({ kind: 'name', value: 'top' }),
      expect.objectContaining({ kind: 'name', value: 'edges' }),
    ]);
  });

  it('rejects bare dotted array selectors', () => {
    expect(parseErrors('var target = body.[top, bottom];')).toContain(
      'Array reference selectors require @ syntax, such as @[body].top or [@body].top',
    );
  });

  it('rejects bare dotted wildcard selectors', () => {
    expect(parseErrors('var target = body.*.edges;')).toContain(
      'Wildcard reference selectors require @ syntax, such as @body.*.edges',
    );
  });

  it('recovers when a grouped suffix is missing its closing bracket', () => {
    const errors = parseErrors(`
part p {
  fillet(@body.[top, bottom.edges, 2);
}
`);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors).toContain('Expected comma or ] in reference selector array');
  });

  it('recovers when an anchored root group is missing its closing bracket', () => {
    const errors = parseErrors(`
part p {
  fillet(@[body1, body2.top.edges, 2);
}
`);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors).toContain('Expected comma or ] in reference selector array');
  });

  it('recovers from incomplete wildcard selectors', () => {
    expect(
      parseErrors('part p { fillet(@body.*., 2); }').length,
    ).toBeGreaterThan(0);
    expect(
      parseErrors('part p { fillet(@body.*.top.[, 2); }').length,
    ).toBeGreaterThan(0);
  });

  it('expands path line point arrays into repeated path items', () => {
    const ast = parseOk(`
sketch s = path(
  line((0, 0), (1, 0)),
  line([(2, 0), (3, 0)])
);
`);
    const sketch = ast.statements[0] as SketchDecl;
    const primitive = sketch.primitive as PathSketchPrimitive;
    expect(primitive.items).toHaveLength(3);
    expect(
      primitive.items
        .slice(1)
        .map((item) => (item.kind === 'segment' ? item.segment.kind : null)),
    ).toEqual(['line', 'line']);
  });

  it('parses sketch input arrays for loft operands', () => {
    const ast = parseOk(`
part p {
  sketch a = rect(10, 10);
  sketch b = rect(8, 8);
  sketch top = rect(6, 6);
  obj lofted = loft([a, b], top, height: 5);
}
`);
    const part = ast.statements[0] as PartDecl;
    const obj = part.body.statements[3] as ObjDecl;
    const loft = obj.operation as LoftOp;
    expect(loft.sketches[0]?.kind).toBe('sketchList');
  });
});
