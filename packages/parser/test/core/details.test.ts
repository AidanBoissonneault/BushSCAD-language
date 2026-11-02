/**
 * @author Aidan Boissonneault
 * @file details.test.ts
 * @purpose Tests details behavior in the core in parser package.
 * @last-edited October 6, 2026
 */

import type {
  AnchorDecl,
  ChamferDetail,
  FaceRef,
  FilletDetail,
  RotateStatement,
  ShellDetail,
} from '@bushscad/ir';
import { describe, expect, it } from 'vitest';
import { component } from '../fixtures/component-selectors.js';
import { faceChain } from '../fixtures/face-ref-format.js';
import { parseOk } from '../fixtures/parse.js';

describe('parser — details', () => {
  it('parses fillet all edges', () => {
    const ast = parseOk(
      'part plate { sketch b = rect(1,1); obj b = extrude(b, 1); fillet(@b.top.edges, 2); }',
    );
    const c = component(ast, 'plate');
    const f = bodyStmt<FilletDetail>(c, 'fillet');
    expect(f.kind).toBe('fillet');
    expect(faceChain(f.target)).toBe('b.top.edges');
  });

  it('parses top-level fillet details', () => {
    const ast = parseOk(
      'sketch b = rect(1,1); obj b = extrude(b, 1); fillet(@b.top.edges, 2);',
    );
    const f = ast.statements[2] as FilletDetail;
    expect(f.kind).toBe('fillet');
    expect(faceChain(f.target)).toBe('b.top.edges');
  });

  it('parses fillet single edge', () => {
    const ast = parseOk(
      'part p { sketch b = rect(1,1); obj b = extrude(b, 1); fillet(@b.top.front_edge, 3); }',
    );
    const c = component(ast, 'p');
    const f = bodyStmt<FilletDetail>(c, 'fillet');
    expect(faceChain(f.target)).toBe('b.top.front_edge');
  });

  it('parses chamfer', () => {
    const ast = parseOk(
      'part p { sketch b = rect(1,1); obj b = extrude(b, 1); chamfer(@b.bottom.edges, 1); }',
    );
    const c = component(ast, 'p');
    const ch = bodyStmt<ChamferDetail>(c, 'chamfer');
    expect(ch.kind).toBe('chamfer');
  });

  it('parses shell no open', () => {
    const ast = parseOk(
      'part p { sketch b = rect(1,1); obj b = extrude(b, 1); shell: b 1.5; }',
    );
    const c = component(ast, 'p');
    const sh = bodyStmt<ShellDetail>(c, 'shell');
    expect(sh.kind).toBe('shell');
    expect(sh.target).toBe('b');
    expect(sh.openFaces).toHaveLength(0);
  });

  it('parses shell open single face', () => {
    const ast = parseOk(
      'part p { sketch b = rect(1,1); obj b = extrude(b, 1); shell: b 1.5 open: top; }',
    );
    const c = component(ast, 'p');
    const sh = bodyStmt<ShellDetail>(c, 'shell');
    expect(sh.openFaces).toEqual(['top']);
  });

  it('parses shell open multiple faces', () => {
    const ast = parseOk(
      'part p { sketch b = rect(1,1); obj b = extrude(b, 1); shell: b 1.5 open: [top, front]; }',
    );
    const c = component(ast, 'p');
    const sh = bodyStmt<ShellDetail>(c, 'shell');
    expect(sh.openFaces).toEqual(['top', 'front']);
  });

  it('parses draft', () => {
    const ast = parseOk(
      'part p { sketch b = rect(1,1); obj b = extrude(b, 1); draft: b.sides 2deg; }',
    );
    const c = component(ast, 'p');
    const d = bodyStmt<{ kind: string; angle: unknown }>(c, 'draft');
    expect(d.kind).toBe('draft');
  });

  it('parses spatial anchors and rotate statements', () => {
    const ast = parseOk(
      'part p { sketch b = rect(1,1); obj b = extrude(b, 1); @top_face = @b.top; rotate b 90deg around top_face.center; }',
    );
    const c = component(ast, 'p');
    const anchor = bodyStmt<AnchorDecl>(c, 'anchor');
    const rotate = bodyStmt<RotateStatement>(c, 'rotate');
    expect(anchor.name).toBe('top_face');
    expect(faceChain(anchor.point as FaceRef)).toBe('b.top');
    expect(rotate.target).toBe('b');
    expect(typeof rotate.around).toBe('object');
    expect(faceChain(rotate.around as FaceRef)).toBe('top_face.center');
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
