/**
 * @author Aidan Boissonneault
 * @file example-20-4-two-part-assembly.test.ts
 * @purpose Tests example 20 4 two part assembly behavior in the core in parser package.
 * @last-edited October 6, 2026
 */

import type {
  CutOp,
  ExtrudeOp,
  FaceRef,
  ForStatement,
  MetadataAssignment,
  ObjDecl,
} from '@bushscad/ir';
import { describe, expect, it } from 'vitest';
import { part } from '../fixtures/part-selectors.js';
import { faceChain } from '../fixtures/face-ref-format.js';
import { parseOk } from '../fixtures/parse.js';

describe('spec example 20.4 — two-part assembly', () => {
  const SRC = `
base_unit = mm;

part base_plate {
    sketch base = rect(100, 80);
    obj base = extrude(base, 6);
    for pt in [
        @base.top.front_left(x:  8, y:  8),
        @base.top.front_right(x: -8, y:  8),
        @base.top.back_left(x:  8, y: -8),
        @base.top.back_right(x: -8, y: -8)
    ] {
        sketch hole = circle(3);
        obj hole = cut(hole, through base , @pt);
    }
    fillet(@base.top.edges, 1);
    part.color = #2563EB;
}

part lid {
    sketch face = rect(100, 80);
    obj face = extrude(face, 3 , @base_plate.top.center);
    chamfer(@face.top.edges, 0.3);
    part.color = #7C3AED;
}
`;
  it('parses with zero errors', () => {
    parseOk(SRC);
  });

  it('has two parts', () => {
    const ast = parseOk(SRC);
    expect(ast.statements.filter((s) => s.kind === 'part')).toHaveLength(2);
  });

  it('base_plate for loop iterates a list of @ values', () => {
    const ast = parseOk(SRC);
    const bp = part(ast, 'base_plate');
    const f = bp.body.statements.find((s) => s.kind === 'for') as ForStatement;
    expect(f.binding).toBe('pt');
    expect(f.iterator.kind).toBe('list');
    if (f.iterator.kind === 'list') {
      expect(f.iterator.expr.kind).toBe('list');
    }
  });

  it('cut inside for loop uses identifier pt as placement', () => {
    const ast = parseOk(SRC);
    const bp = part(ast, 'base_plate');
    const f = bp.body.statements.find((s) => s.kind === 'for') as ForStatement;
    const objStmt = f.body.statements.find((s) => s.kind === 'obj') as ObjDecl;
    const op = objStmt.operation as CutOp;
    expect(op.from!.kind).toBe('faceRef');
    expect(faceChain(op.from as FaceRef)).toBe('pt');
  });

  it('lid extrude uses cross-part face ref', () => {
    const ast = parseOk(SRC);
    const l = part(ast, 'lid');
    const obj = l.body.statements.find((s) => s.kind === 'obj') as ObjDecl;
    const op = obj.operation as ExtrudeOp;
    expect(faceChain(op.from as FaceRef)).toBe('base_plate.top.center');
  });

  it('base_plate has color #2563EB', () => {
    const ast = parseOk(SRC);
    const bp = part(ast, 'base_plate');
    const col = bp.body.statements.find(
      (s): s is MetadataAssignment =>
        s.kind === 'metadata' && s.property === 'color',
    )!;
    expect(col.value).toMatchObject({ kind: 'string', value: '#2563EB' });
  });
});
