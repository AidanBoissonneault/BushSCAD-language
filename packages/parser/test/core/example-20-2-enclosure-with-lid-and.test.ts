/**
 * @author Aidan Boissonneault
 * @file example-20-2-enclosure-with-lid-and.test.ts
 * @purpose Tests example 20 2 enclosure with lid and behavior in the core in parser package.
 * @last-edited October 6, 2026
 */

import type {
  CutOp,
  FaceRef,
  ObjDecl,
  ShellDetail,
  SketchDecl,
} from '@bushscad/ir';
import { describe, expect, it } from 'vitest';
import { component } from '../fixtures/component-selectors.js';
import { faceChain } from '../fixtures/face-ref-format.js';
import { parseOk } from '../fixtures/parse.js';

describe('spec example 20.2 — enclosure with lid and engraved label', () => {
  const SRC = `
base_unit = mm;
var wall = 2;
var w = 80;
var h = 60;
var d = 40;
env serial fallback 'SN-0001';

part enclosure {
    sketch body = rect(w, h);
    obj body = extrude(body, d);
    shell: body wall open: top;

    sketch lid = rect inset(wall);
    obj lid = extrude(lid, 2 , @body.top.center);

    sketch serial = word(serial, size: 5, font: 'mono', align: center);
    obj serial = cut(serial, 0.5 , @body.outer.front.center);

    fillet(@body.top.perimeter, 2);
    fillet(@body.bottom.edges, 1);
    chamfer(@lid.top.edges, 0.5);
}
`;
  it('parses with zero errors', () => {
    parseOk(SRC);
  });

  it('has shell with open top', () => {
    const ast = parseOk(SRC);
    const c = component(ast, 'enclosure');
    const sh = bodyStmt<ShellDetail>(c, 'shell');
    expect(sh.target).toBe('body');
    expect(sh.openFaces).toContain('top');
  });

  it('has rect inset primitive', () => {
    const ast = parseOk(SRC);
    const c = component(ast, 'enclosure');
    const sketches = c.body.statements.filter(
      (s) => s.kind === 'sketch',
    ) as SketchDecl[];
    const lidSketch = sketches.find((s) => s.name === 'lid')!;
    expect(lidSketch.primitive.kind).toBe('inset');
  });

  it('has word primitive with variable text', () => {
    const ast = parseOk(SRC);
    const c = component(ast, 'enclosure');
    const sketches = c.body.statements.filter(
      (s) => s.kind === 'sketch',
    ) as SketchDecl[];
    const serialSketch = sketches.find((s) => s.name === 'serial')!;
    expect(serialSketch.primitive.kind).toBe('word');
    if (serialSketch.primitive.kind === 'word') {
      expect(serialSketch.primitive.font).toMatchObject({
        kind: 'string',
        value: 'mono',
      });
      expect(serialSketch.primitive.align).toBe('center');
    }
  });

  it('cut targets body.outer.front.center', () => {
    const ast = parseOk(SRC);
    const c = component(ast, 'enclosure');
    const objs = c.body.statements.filter((s) => s.kind === 'obj') as ObjDecl[];
    const serialObj = objs.find((s) => s.name === 'serial')!;
    const op = serialObj.operation as CutOp;
    expect(faceChain(op.from as FaceRef)).toBe('body.outer.front.center');
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
