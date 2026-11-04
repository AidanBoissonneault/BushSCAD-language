/**
 * @author Aidan Boissonneault
 * @file reference-syntax.test.ts
 * @purpose Tests reference syntax behavior in the references in parser package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import { parse } from '../../src/core/parser.js';
import type {
  ChamferDetail,
  FaceRef,
  FilletDetail,
  PartDecl,
  PosRef,
  Program,
  RepeatableFaceRef,
} from '@bushscad/ir';

/**
 * Parses ok from the supplied source into the references representation.
 */
function parseOk(source: string): Program {
  const result = parse(source, 'reference-syntax.test.bscd');
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
  return parse(source, 'reference-syntax.test.bscd').errors.map(
    (error) => error.message,
  );
}

/**
 * Resolves the face data required by the current selector.
 */
function faceChain(ref: FaceRef | RepeatableFaceRef): string {
  if (ref.kind === 'faceRefList') return '<list>';
  return ref.chain
    .map((segment) =>
      segment.kind === 'call'
        ? `${segment.name}(${segment.arg})`
        : segment.kind === 'edgeIntersection'
          ? `(${segment.edges.join(',')})${segment.index === undefined ? '' : `[${segment.index}]`}`
          : segment.kind === 'group'
            ? `[${segment.options.join(',')}]`
            : segment.kind === 'wildcard'
              ? '*'
              : segment.value,
    )
    .join('.');
}

/**
 * Returns the first part that matches the requested condition.
 */
function firstPart(ast: Program): PartDecl {
  return ast.statements.find((stmt): stmt is PartDecl => stmt.kind === 'part')!;
}

describe('anchor-centric reference syntax', () => {
  it('parses direct corner, edge, and named-face references', () => {
    const ast = parseOk(`
part p {
  sketch b = rect(10, 10);
  obj b = extrude(b, 2);
  @corner = @b.top.front_left;
  fillet(@b.top.front_edge, 1);
  chamfer(@b.lip.edges, 0.5);
}
`);
    const part = firstPart(ast);
    const anchor = part.body.statements.find((stmt) => stmt.kind === 'anchor');
    const fillet = part.body.statements.find(
      (stmt): stmt is FilletDetail => stmt.kind === 'fillet',
    )!;
    const chamfer = part.body.statements.find(
      (stmt): stmt is ChamferDetail => stmt.kind === 'chamfer',
    )!;

    expect(anchor?.kind).toBe('anchor');
    expect(faceChain(anchor!.point as FaceRef)).toBe('b.top.front_left');
    expect(faceChain(fillet.target)).toBe('b.top.front_edge');
    expect(faceChain(chamfer.target)).toBe('b.lip.edges');
  });

  it('parses edge intersections and an optional crossing index', () => {
    const ast = parseOk(`
part p {
  sketch profile = rect(20, 10, right: first) + rect(10, 20, top: second);
  obj body = extrude(profile, 4);
  fillet(@body.(first, second), 1);
  chamfer(@body.(first, second)[0], 0.5);
}
`);
    const statements = firstPart(ast).body.statements;
    const fillet = statements.find(
      (stmt): stmt is FilletDetail => stmt.kind === 'fillet',
    )!;
    const chamfer = statements.find(
      (stmt): stmt is ChamferDetail => stmt.kind === 'chamfer',
    )!;

    expect(faceChain(fillet.target)).toBe('body.(first,second)');
    expect(faceChain(chamfer.target)).toBe('body.(first,second)[0]');
  });

  it('parses direct-reference local offsets as x/y values', () => {
    const ast = parseOk(`
part p {
  sketch b = rect(10, 10);
  obj b = extrude(b, 2);
  place(pin, @b.top.center(1, 2));
}
`);
    const part = firstPart(ast);
    const place = part.body.statements.find((stmt) => stmt.kind === 'place')!;
    expect(place.kind).toBe('place');
    const target = place.target as PosRef;
    expect(target.kind).toBe('pos');
    expect(target.x?.kind).toBe('number');
    expect(target.y?.kind).toBe('number');
    expect(target.radius).toBeUndefined();
    expect(target.angle).toBeUndefined();
  });

  it('parses offset-plane placements from the reserved plane keyword', () => {
    const ast = parseOk(`
part p {
  sketch b = rect(10, 10);
  obj b = extrude(b, 2);
  place(pin, @plane(b.top.center, offset: 1));
}
`);
    const part = firstPart(ast);
    const place = part.body.statements.find((stmt) => stmt.kind === 'place')!;
    expect(place.kind).toBe('place');
    const target = place.target as PosRef;
    expect(target.kind).toBe('pos');
    expect(faceChain(target.anchor as FaceRef)).toBe('b.top.center');
    expect(target.offset?.kind).toBe('number');
  });

  it('accepts positional and labeled offsets for plane placements', () => {
    const ast = parseOk(`
part p {
  place(pin, @plane(b.top.center, 2));
  place(pin2, @plane(b.top.center, offset: 3));
}
`);
    const part = firstPart(ast);
    const offsets = part.body.statements
      .filter(
        (stmt): stmt is Extract<typeof stmt, { kind: 'place' }> =>
          stmt.kind === 'place',
      )
      .map((stmt) => (stmt.target as PosRef).offset);
    expect(
      offsets.map((offset) => offset?.kind === 'number' && offset.value),
    ).toEqual([2, 3]);
  });

  it('rejects removed selector calls and colon modifiers', () => {
    const errors = [
      ...parseErrors('part p { fillet: b.top.edges 1; }'),
      ...parseErrors('part p { chamfer: b.bottom.edges 1; }'),
      ...parseErrors('part p { place(pin, @b.side(front).center); }'),
      ...parseErrors('part p { place(pin, @b.top.corner(front_left)); }'),
      ...parseErrors('part p { place(pin, @b.top.edge(front)); }'),
      ...parseErrors('part p { place(pin, @b.face(lip).center); }'),
    ];

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Use fillet(@target, radius)'),
        expect.stringContaining('Use chamfer(@target, offset)'),
        expect.stringContaining('side(...) selectors have been removed'),
        expect.stringContaining('corner(...) selectors have been removed'),
        expect.stringContaining('edge(...) selectors have been removed'),
        expect.stringContaining('face(...) selectors have been removed'),
      ]),
    );
  });
});
