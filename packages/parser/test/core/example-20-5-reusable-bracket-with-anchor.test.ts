/**
 * @author Aidan Boissonneault
 * @file example-20-5-reusable-bracket-with-anchor.test.ts
 * @purpose Tests example 20 5 reusable bracket with anchor behavior in the core in parser package.
 * @last-edited October 6, 2026
 */

import type {
  AnchorDecl,
  ExportDecl,
  FaceRef,
  FilletDetail,
  ForStatement,
  PartDecl,
  PlaceStatement,
  SketchDecl,
} from '@bushscad/ir';
import { describe, expect, it } from 'vitest';
import { component } from '../fixtures/component-selectors.js';
import { faceChain } from '../fixtures/face-ref-format.js';
import { parseOk } from '../fixtures/parse.js';

describe('spec example 20.5 — reusable bracket with anchor points', () => {
  const SRC = `
base_unit = mm;

export part bracket {
    sketch body = rect(this.width - 4, 20);
    obj body = extrude(body, 5);
    sketch gusset = triangle(8, 8);
    obj gusset = extrude(gusset, 5 , @body.back.center);
    @mount = @body.bottom.front_left;
    @center = @body.bottom.center;
    fillet(@body.top.edges, 1);
    fillet(@gusset.edges, 0.5);
    chamfer(@body.bottom.edges, 0.3);
}

part frame {
    sketch base = rect(120, 80);
    obj base = extrude(base, 10);
    for pt in [
        @base.top.front_left(x:  6, y:  6),
        @base.top.front_right(x: -6, y:  6),
        @base.top.back_left(x:  6, y: -6),
        @base.top.back_right(x: -6, y: -6)
    ] {
        place(bracket, @pt, @mount);
    }
    fillet(@base.front.edges, 2);
    fillet(@base.back.edges, 2);
}
`;
  it('parses with zero errors', () => {
    parseOk(SRC);
  });

  it('bracket is exported component', () => {
    const ast = parseOk(SRC);
    const exp = ast.statements.find((s) => s.kind === 'export') as ExportDecl;
    expect(exp).toBeDefined();
    expect(exp.statement.kind).toBe('part');
    if (exp.statement.kind === 'part')
      expect(exp.statement.name).toBe('bracket');
  });

  it('bracket has this.width in rect primitive', () => {
    const ast = parseOk(SRC);
    const exp = ast.statements.find((s) => s.kind === 'export') as ExportDecl;
    const bracketDecl = exp.statement as PartDecl;
    const sketch = bracketDecl.body.statements.find(
      (s) => s.kind === 'sketch',
    ) as SketchDecl;
    expect(sketch.primitive.kind).toBe('rect');
    if (sketch.primitive.kind === 'rect') {
      expect(sketch.primitive.width.kind).toBe('binary'); // this.width - 4
    }
  });

  it('bracket has two named anchors', () => {
    const ast = parseOk(SRC);
    const exp = ast.statements.find((s) => s.kind === 'export') as ExportDecl;
    const bracketDecl = exp.statement as PartDecl;
    const anchors = bracketDecl.body.statements.filter(
      (s) => s.kind === 'anchor',
    ) as AnchorDecl[];
    expect(anchors).toHaveLength(2);
    expect(anchors[0].name).toBe('mount');
    expect(anchors[1].name).toBe('center');
  });

  it('frame place uses source anchor mount', () => {
    const ast = parseOk(SRC);
    const c = component(ast, 'frame');
    const f = c.body.statements.find((s) => s.kind === 'for') as ForStatement;
    const pl = f.body.statements.find(
      (s) => s.kind === 'place',
    ) as PlaceStatement;
    expect(faceChain(pl.sourceAnchor as FaceRef)).toBe('mount');
  });

  it('frame fillets use direct face segments', () => {
    const ast = parseOk(SRC);
    const c = component(ast, 'frame');
    const fillets = c.body.statements.filter(
      (s) => s.kind === 'fillet',
    ) as FilletDetail[];
    expect(fillets).toHaveLength(2);
    expect(faceChain(fillets[0].target)).toBe('base.front.edges');
    expect(faceChain(fillets[1].target)).toBe('base.back.edges');
  });
});
