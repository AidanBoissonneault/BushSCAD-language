/**
 * @author Aidan Boissonneault
 * @file place-anchor-color.test.ts
 * @purpose Tests place anchor color behavior in the core in parser package.
 * @last-edited October 6, 2026
 */

import type {
  AnchorDecl,
  FaceRef,
  MetadataAssignment,
  PlaceStatement,
} from '@bushscad/ir';
import { describe, expect, it } from 'vitest';
import { component } from '../fixtures/component-selectors.js';
import { faceChain } from '../fixtures/face-ref-format.js';
import { parseOk } from '../fixtures/parse.js';

describe('parser — place/anchor/color', () => {
  it('parses place at faceRef', () => {
    const ast = parseOk(
      'part p { sketch b = rect(1,1); obj b = extrude(b,1); place(bracket, @b.top.center); }',
    );
    const c = component(ast, 'p');
    const pl = bodyStmt<PlaceStatement>(c, 'place');
    expect(pl.kind).toBe('place');
    expect(pl.component).toBe('bracket');
    expect(pl.sourceAnchor).toBeNull();
  });

  it('parses place with using', () => {
    const ast = parseOk(
      'part p { sketch b = rect(1,1); obj b = extrude(b,1); place(bracket, @b.top.center, @mount); }',
    );
    const c = component(ast, 'p');
    const pl = bodyStmt<PlaceStatement>(c, 'place');
    expect(faceChain(pl.sourceAnchor as FaceRef)).toBe('mount');
  });

  it('parses place-time rotate', () => {
    const ast = parseOk(
      'part p { sketch b = rect(1,1); obj b = extrude(b,1); place(bracket, @b.top.center) rotate(90deg); }',
    );
    const c = component(ast, 'p');
    const pl = bodyStmt<PlaceStatement>(c, 'place');
    expect(pl.rotate?.kind).toBe('default');
  });

  it('parses place-time rotate axis forms', () => {
    const ast = parseOk(`
part p {
    sketch b = rect(1,1);
    obj b = extrude(b,1);
    place(bracket, @b.top.center) rotate(x: 10deg, y: 20deg, z: 30deg);
    place(bracket, @b.top.center) rotate(10deg, 20deg, 30deg);
    place(bracket, @b.top.center) rotateX(15deg);
    place(bracket, @b.top.center) rotateY(25deg);
    place(bracket, @b.top.center) rotateZ(35deg);
}
`);
    const c = component(ast, 'p');
    const places = c.body.statements.filter(
      (stmt): stmt is PlaceStatement => stmt.kind === 'place',
    );
    expect(places[0].rotate).toMatchObject({ kind: 'axes' });
    expect(places[1].rotate).toMatchObject({ kind: 'axes' });
    expect(places[2].rotate).toMatchObject({ kind: 'axes', y: null, z: null });
    expect(places[3].rotate).toMatchObject({ kind: 'axes', x: null, z: null });
    expect(places[4].rotate).toMatchObject({ kind: 'axes', x: null, y: null });
  });

  it('parses anchor default', () => {
    const ast = parseOk(
      'part p { sketch b = rect(1,1); obj b = extrude(b,1); @default = @b.bottom.center; }',
    );
    const c = component(ast, 'p');
    const a = bodyStmt<AnchorDecl>(c, 'anchor');
    expect(a.kind).toBe('anchor');
    expect(a.name).toBe('default');
  });

  it('parses anchor named', () => {
    const ast = parseOk(
      'part p { sketch b = rect(1,1); obj b = extrude(b,1); @mount = @b.bottom.front_left; }',
    );
    const c = component(ast, 'p');
    const a = bodyStmt<AnchorDecl>(c, 'anchor');
    expect(a.name).toBe('mount');
    expect(faceChain(a.point as FaceRef)).toBe('b.bottom.front_left');
  });

  it('parses part color metadata', () => {
    const ast = parseOk(
      'part p { sketch b = rect(1,1); obj b = extrude(b,1); part.color = #2563EB; }',
    );
    const c = component(ast, 'p');
    const col = bodyStmt<MetadataAssignment>(c, 'metadata');
    expect(col.property).toBe('color');
    expect(col.target.kind).toBe('part');
    expect(col.value).toMatchObject({ kind: 'string', value: '#2563EB' });
  });

  it('parses part material metadata string', () => {
    const ast = parseOk(
      "part p { sketch b = rect(1,1); part.material = 'PLA'; obj b = extrude(b,1); }",
    );
    const c = component(ast, 'p');
    const material = bodyStmt<MetadataAssignment>(c, 'metadata');
    expect(material.property).toBe('material');
    expect(material.value).toMatchObject({ kind: 'string', value: 'PLA' });
  });

  it('parses part material metadata identifier expression', () => {
    const ast = parseOk(
      "part p { var finish = 'silk PLA'; part.material = finish; sketch b = rect(1,1); obj b = extrude(b,1); }",
    );
    const c = component(ast, 'p');
    const material = bodyStmt<MetadataAssignment>(c, 'metadata');
    expect(material.value).toMatchObject({
      kind: 'identifier',
      name: 'finish',
    });
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
