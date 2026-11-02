/**
 * @author Aidan Boissonneault
 * @file example-20-1-simple-mounting-plate.test.ts
 * @purpose Tests example 20 1 simple mounting plate behavior in the core in parser package.
 * @last-edited October 6, 2026
 */

import type {
  CutOp,
  FaceRef,
  ForStatement,
  ObjDecl,
  PosRef,
} from '@bushscad/ir';
import { describe, expect, it } from 'vitest';
import { component } from '../fixtures/component-selectors.js';
import { faceChain } from '../fixtures/face-ref-format.js';
import { parseOk } from '../fixtures/parse.js';

describe('spec example 20.1 — simple mounting plate', () => {
  const SRC = `
base_unit = mm;
var plate_w = 60;
var plate_h = 40;
var plate_d = 10;
var hole_d  = 3;

part plate {
    sketch base = rect(plate_w, plate_h);
    obj base = extrude(base, plate_d);
    for (i, j) in grid(cols: 2, rows: 2, spacing_x: 44, spacing_y: 28) {
        sketch hole = circle(hole_d);
        obj hole = cut(hole, through base , @base.top.front_left(x: 8 + i, y: 6 + j));
    }
    fillet(@base.top.edges, 1.5);
    chamfer(@base.bottom.edges, 0.5);
}
`;
  it('parses with zero errors', () => {
    parseOk(SRC);
  });

  it('has correct base_unit', () => {
    expect(parseOk(SRC).baseUnit).toBe('mm');
  });

  it('has 5 top-level statements (4 vars + component)', () => {
    const ast = parseOk(SRC);
    expect(ast.statements).toHaveLength(5);
  });

  it('plate component has correct body structure', () => {
    const ast = parseOk(SRC);
    const c = component(ast, 'plate');
    const kinds = c.body.statements.map((s) => s.kind);
    expect(kinds).toContain('sketch');
    expect(kinds).toContain('obj');
    expect(kinds).toContain('for');
    expect(kinds).toContain('fillet');
    expect(kinds).toContain('chamfer');
  });

  it('for loop uses grid iterator with spacing_x/spacing_y', () => {
    const ast = parseOk(SRC);
    const c = component(ast, 'plate');
    const f = bodyStmt<ForStatement>(c, 'for');
    expect(f.iterator.kind).toBe('grid');
    if (f.iterator.kind === 'grid') {
      expect(f.iterator.spacingX).toBeDefined();
      expect(f.iterator.spacingY).toBeDefined();
    }
  });

  it('cut uses through with @ placement', () => {
    const ast = parseOk(SRC);
    const c = component(ast, 'plate');
    const f = bodyStmt<ForStatement>(c, 'for');
    const objStmt = f.body.statements.find((s) => s.kind === 'obj') as ObjDecl;
    const op = objStmt.operation as CutOp;
    expect(op.through).toMatchObject({ kind: 'namedThrough', name: 'base' });
    expect(op.from!.kind).toBe('pos');
    const pos = op.from as PosRef;
    expect(faceChain(pos.anchor as FaceRef)).toBe('base.top.front_left');
  });
});
/**
 * Builds the body data required by the current operation.
 */
function bodyStmt<T>(
  decl: { name: string; body: { statements: { kind: string }[] } },
  kind: string,
  index?: number,
): T {
  const matches = decl.body.statements.filter((stmt) => stmt.kind === kind);
  const i = index ?? 0;
  if (!matches[i]) throw new Error(`No ${kind}[${i}] in '${decl.name}'`);
  return matches[i] as T;
}
