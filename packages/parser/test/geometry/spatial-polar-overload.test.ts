/**
 * @author Aidan Boissonneault
 * @file spatial-polar-overload.test.ts
 * @purpose Tests spatial polar overload behavior in the geometry in parser package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import type { FaceRef, PartDecl, PlaceStatement, PosRef } from '@bushscad/ir';
import { parse } from '../../src/core/parser.js';

/**
 * Parses ok from the supplied source into the geometry representation.
 */
function parseOk(source: string): PartDecl {
  const result = parse(source, 'spatial-polar-overload.bscd');
  expect(result.errors).toEqual([]);
  return result.ast.statements[0] as PartDecl;
}

/**
 * Handles place target in the geometry flow.
 */
function placeTarget(part: PartDecl, index = 0): PosRef {
  const places = part.body.statements.filter(
    (stmt): stmt is PlaceStatement => stmt.kind === 'place',
  );
  const target = places[index]?.target;
  if (!target || target.kind !== 'pos') throw new Error('expected pos target');
  return target;
}

describe('spatial reference offsets', () => {
  it('parses center alias positional arguments as x and y', () => {
    const part = parseOk(`
part p {
  sketch base = rect(1, 1);
  obj base = extrude(base, 1);
  @base_center = @base.top.center;
  place(child, @base_center(60, 18));
}`);

    const target = placeTarget(part);
    expect(target.x?.kind).toBe('number');
    expect(target.y?.kind).toBe('number');
    expect(target.radius).toBeUndefined();
    expect(target.angle).toBeUndefined();
  });

  it('keeps non-center positional spatial arguments as x and y', () => {
    const part = parseOk(`
part p {
  sketch base = rect(1, 1);
  obj base = extrude(base, 1);
  place(child, @base.top(10, 15));
}`);

    const target = placeTarget(part);
    expect(target.x?.kind).toBe('number');
    expect(target.y?.kind).toBe('number');
    expect(target.radius).toBeUndefined();
    expect(target.angle).toBeUndefined();
  });

  it('parses direct center positional arguments as x and y', () => {
    const part = parseOk(`
part p {
  sketch base = rect(1, 1);
  obj base = extrude(base, 1);
  place(child, @base.top.center(60, 18));
}`);

    const target = placeTarget(part);
    expect((target.anchor as FaceRef).chain.at(-1)).toMatchObject({
      kind: 'name',
      value: 'center',
    });
    expect(target.x?.kind).toBe('number');
    expect(target.y?.kind).toBe('number');
  });

  it('keeps polar offsets available through named arguments', () => {
    const part = parseOk(`
part p {
  sketch base = rect(1, 1);
  obj base = extrude(base, 1);
  place(child, @base.top.center(radius: 60, angle: 180deg));
}`);

    const target = placeTarget(part);
    expect(target.radius?.kind).toBe('number');
    expect(target.angle?.kind).toBe('unit');
    expect(target.x).toBeUndefined();
    expect(target.y).toBeUndefined();
  });
});
