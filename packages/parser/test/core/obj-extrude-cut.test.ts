/**
 * @author Aidan Boissonneault
 * @file obj-extrude-cut.test.ts
 * @purpose Tests obj extrude cut behavior in the core in parser package.
 * @last-edited October 6, 2026
 */

import type {
  CutOp,
  ExtrudeOp,
  FaceRef,
  ObjDecl,
  PosRef,
  RefObjDecl,
  SolidCutOp,
} from '@bushscad/ir';
import { describe, expect, it } from 'vitest';
import { parse } from '../../src/core/parser.js';
import { faceChain } from '../fixtures/face-ref-format.js';
import { parseOk } from '../fixtures/parse.js';

describe('parser — obj extrude/cut', () => {
  it('parses basic extrude', () => {
    const ast = parseOk(
      'sketch base = rect(60, 40);\nobj base = extrude(base, 10);',
    );
    const o = ast.statements[1] as ObjDecl;
    expect(o.kind).toBe('obj');
    expect(o.name).toBe('base');
    expect(o.operation.kind).toBe('extrude');
    const op = o.operation as ExtrudeOp;
    expect(op.sketch).toMatchObject({ kind: 'namedSketch', name: 'base' });
    expect(op.from).toBeNull();
    expect(op.symmetric).toBe(false);
  });

  it('parses extrude with , @faceRef', () => {
    const ast = parseOk('obj pipe = extrude(pipe, 20 , @base.top.center);');
    const op = (ast.statements[0] as ObjDecl).operation as ExtrudeOp;
    expect(op.from).not.toBeNull();
    expect(op.from!.kind).toBe('faceRef');
    expect(faceChain(op.from as FaceRef)).toBe('base.top.center');
  });

  it('parses symmetric extrude', () => {
    const ast = parseOk(
      'obj flange = extrude(flange, 4 symmetric , @base.top.center);',
    );
    const op = (ast.statements[0] as ObjDecl).operation as ExtrudeOp;
    expect(op.symmetric).toBe(true);
  });

  it('parses extrude , @', () => {
    const ast = parseOk(
      'obj boss = extrude(boss, 8 , @base.top(x: 10, y: 10));',
    );
    const op = (ast.statements[0] as ObjDecl).operation as ExtrudeOp;
    expect(op.from!.kind).toBe('pos');
    const pos = op.from as PosRef;
    expect(pos.x).toBeDefined();
    expect(pos.y).toBeDefined();
  });

  it('parses blind cut', () => {
    const ast = parseOk('obj pocket = cut(pocket, 4 , @base.top.center);');
    const op = (ast.statements[0] as ObjDecl).operation as CutOp;
    expect(op.kind).toBe('cut');
    expect(op.through).toBeNull();
    expect(op.depth).not.toBeNull();
  });

  it('parses blind cut using active placement', () => {
    const ast = parseOk('obj pocket = cut(pocket, 4);');
    const op = (ast.statements[0] as ObjDecl).operation as CutOp;
    expect(op.through).toBeNull();
    expect(op.depth).not.toBeNull();
    expect(op.from).toBeNull();
  });

  it('parses through cut', () => {
    const ast = parseOk(
      'obj hole = cut(hole, through base , @base.top.center);',
    );
    const op = (ast.statements[0] as ObjDecl).operation as CutOp;
    expect(op.through).toMatchObject({ kind: 'namedThrough', name: 'base' });
    expect(op.depth).toBeNull();
  });

  it('parses through cut using active placement', () => {
    const ast = parseOk('obj hole = cut(hole, through base);');
    const op = (ast.statements[0] as ObjDecl).operation as CutOp;
    expect(op.through).toMatchObject({ kind: 'namedThrough', name: 'base' });
    expect(op.depth).toBeNull();
    expect(op.from).toBeNull();
  });

  it('parses cut with @ placement', () => {
    const ast = parseOk(
      'obj bolt = cut(bolt, through base , @base.top(x: 10, y: 10));',
    );
    const op = (ast.statements[0] as ObjDecl).operation as CutOp;
    expect(op.from!.kind).toBe('pos');
  });

  it('parses solid cut with inline loft tool', () => {
    const ast = parseOk(
      'obj channel = cut(loft(a, b, height: 30), @base.top.center);',
    );
    const op = (ast.statements[0] as ObjDecl).operation as SolidCutOp;
    expect(op.kind).toBe('solid_cut');
    expect(op.tool.kind).toBe('operation');
    if (op.tool.kind === 'operation') {
      expect(op.tool.operation.kind).toBe('loft');
    }
    expect(faceChain(op.from as FaceRef)).toBe('base.top.center');
  });

  it('parses solid cut with predefined object tool', () => {
    const ast = parseOk('obj shaped = cut(tool_body, @base.front.center);');
    const op = (ast.statements[0] as ObjDecl).operation as SolidCutOp;
    expect(op.kind).toBe('solid_cut');
    expect(op.tool).toMatchObject({
      kind: 'object',
      object: { kind: 'namedObject', name: 'tool_body' },
    });
  });

  it('parses one-line ref object declarations', () => {
    const ast = parseOk(
      'sketch s = rect(4, 8); ref punch_tool = extrude(s, 14);',
    );
    const ref = ast.statements[1] as RefObjDecl;
    expect(ref.kind).toBe('refObj');
    expect(ref.name).toBe('punch_tool');
    expect(ref.operation.kind).toBe('extrude');
  });

  it('keeps identifier plus depth as regular sketch cut', () => {
    const ast = parseOk('obj pocket = cut(tool_body, 4 , @base.top.center);');
    const op = (ast.statements[0] as ObjDecl).operation as CutOp;
    expect(op.kind).toBe('cut');
    expect(op.sketch).toMatchObject({
      kind: 'namedSketch',
      name: 'tool_body',
    });
    expect(op.depth).not.toBeNull();
  });

  it('rejects removed object tag blocks', () => {
    const result = parse(
      `
sketch profile = rect(10, 10);
obj base = extrude(profile, 4) {
  tag top_face: top;
  tag front_edge: top.edge(front);
}
`,
      'test.bscd',
    );
    expect(
      result.errors.some((e) =>
        e.message.includes('Expected @ anchor declaration'),
      ),
    ).toBe(true);
  });
});
