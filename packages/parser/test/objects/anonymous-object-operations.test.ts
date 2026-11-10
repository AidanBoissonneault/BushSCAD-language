import { describe, expect, it } from 'vitest';
import type {
  AnonymousObjDecl,
  FaceRef,
  FilletDetail,
  PlaceStatement,
  Program,
} from '@bushscad/ir';
import { parse } from '../../src/core/parser.js';

/** Parses a source file expected to contain valid anonymous operations. */
function parseOk(source: string): Program {
  const result = parse(source, 'anonymous-object-operations.test.bscd');
  expect(
    result.errors,
    `parse errors: ${result.errors.map((error) => error.message).join(', ')}`,
  ).toHaveLength(0);
  return result.ast;
}

describe('anonymous object operations', () => {
  it('parses bare operations at file and component-body scope', () => {
    const ast = parseOk(`
cube(4);
part p {
  cube(10);
}
`);
    const rootOperation = ast.statements[0] as AnonymousObjDecl;
    const part = ast.statements.find((statement) => statement.kind === 'part')!;
    const bodyOperation = part.body.statements[0] as AnonymousObjDecl;

    expect(rootOperation).toMatchObject({
      kind: 'anonymousObj',
      operation: { kind: 'solidPrimitive', primitive: 'cube' },
    });
    expect(bodyOperation).toMatchObject({
      kind: 'anonymousObj',
      operation: { kind: 'solidPrimitive', primitive: 'cube' },
    });
  });

  it('parses an inline operation as a selector target', () => {
    const ast = parseOk(`
part p {
  fillet(@cube(10).top, 2);
}
`);
    const part = ast.statements.find((statement) => statement.kind === 'part')!;
    const fillet = part.body.statements[0] as FilletDetail;

    expect(fillet.target.kind).toBe('faceRef');
    expect((fillet.target as FaceRef).inlineOperation).toMatchObject({
      kind: 'solidPrimitive',
      primitive: 'cube',
      args: [{ value: { kind: 'number', value: 10 } }],
    });
    const root = (fillet.target as FaceRef).chain[0];
    const face = (fillet.target as FaceRef).chain[1];
    expect(root?.kind).toBe('name');
    if (!root || root.kind !== 'name') throw new Error('Expected inline root');
    expect(root.value).toMatch(/^\0inline:/);
    expect(face).toMatchObject({ kind: 'name', value: 'top' });
  });

  it('parses inline operations in placements', () => {
    const ast = parseOk(`part p { place(component, @cube(10).top); }`);
    const part = ast.statements.find((statement) => statement.kind === 'part')!;
    const place = part.body.statements[0] as PlaceStatement;
    const target = place.target as FaceRef;

    expect(target.inlineOperation).toMatchObject({
      kind: 'solidPrimitive',
      primitive: 'cube',
    });
    expect(target.chain[0]?.kind).toBe('name');
    expect(
      target.chain[0]?.kind === 'name' ? target.chain[0].value : '',
    ).toMatch(/^\0inline:/);
    expect(target.chain[1]).toMatchObject({ kind: 'name', value: 'top' });
  });

  it('keeps soft-keyword object names available as spatial roots', () => {
    const ast = parseOk(`
part p {
  obj hole = cube(4);
  fillet(@hole.top.edges, 1);
}
`);
    const part = ast.statements.find((statement) => statement.kind === 'part')!;
    const fillet = part.body.statements[1] as FilletDetail;

    expect((fillet.target as FaceRef).inlineOperation).toBeUndefined();
    expect((fillet.target as FaceRef).chain[0]).toMatchObject({
      kind: 'name',
      value: 'hole',
    });
  });
});
