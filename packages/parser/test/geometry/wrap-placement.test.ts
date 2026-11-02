/**
 * @author Aidan Boissonneault
 * @file wrap-placement.test.ts
 * @purpose Tests wrap placement behavior in the geometry in parser package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import type {
  CutOp,
  ExtrudeOp,
  FaceRef,
  ObjDecl,
  PartDecl,
} from '@bushscad/ir';
import { parse } from '../../src/core/parser.js';

/**
 * Parses part from the supplied source into the geometry representation.
 */
function parsePart(src: string): PartDecl {
  const result = parse(src, 'wrap-placement.bscd');
  expect(
    result.errors,
    `parse errors: ${result.errors.map((error) => error.message).join(', ')}`,
  ).toHaveLength(0);
  return result.ast.statements.find(
    (statement): statement is PartDecl => statement.kind === 'part',
  )!;
}

/**
 * Handles obj in the geometry flow.
 */
function obj(part: PartDecl, index: number): ObjDecl {
  return part.body.statements.filter(
    (statement): statement is ObjDecl => statement.kind === 'obj',
  )[index];
}

describe('curved wrap placement syntax', () => {
  it('parses wrap from curved placement arguments', () => {
    const part = parsePart(`
part p {
    sketch profile = circle(5);
    obj cyl = extrude(profile, 10);
    obj label = cut(profile, 0.5, @cyl.curved(0deg, wrap));
    obj rib = extrude(profile, 1, @cyl.curved(45deg, wrap));
}
`);

    const cut = obj(part, 1).operation as CutOp;
    const extrude = obj(part, 2).operation as ExtrudeOp;

    expect(cut.wrap).toBe(true);
    expect((cut.from as FaceRef).surfaceAngle).toBeDefined();
    expect(extrude.wrap).toBe(true);
    expect((extrude.from as FaceRef).surfaceAngle).toBeDefined();
  });
});
