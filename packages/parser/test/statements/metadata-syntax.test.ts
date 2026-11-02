/**
 * @author Aidan Boissonneault
 * @file metadata-syntax.test.ts
 * @purpose Tests metadata syntax behavior in the statements in parser package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import type {
  MetadataAssignment,
  PartDecl,
  Program,
  RefObjDecl,
  RefPartDecl,
} from '@bushscad/ir';
import { parse } from '../../src/core/parser.js';

/**
 * Parses ok from the supplied source into the statements representation.
 */
function parseOk(source: string): Program {
  const result = parse(source, 'metadata-syntax.test.bscd');
  expect(
    result.errors,
    `parse errors: ${result.errors.map((error) => error.message).join(', ')}`,
  ).toHaveLength(0);
  return result.ast;
}

/**
 * Parses errors from the supplied source into the statements representation.
 */
function parseErrors(source: string): string[] {
  return parse(source, 'metadata-syntax.test.bscd').errors.map(
    (error) => error.message,
  );
}

/**
 * Returns the first part that matches the requested condition.
 */
function firstPart(ast: Program): PartDecl {
  return ast.statements.find((stmt): stmt is PartDecl => stmt.kind === 'part')!;
}

describe('part metadata and declaration syntax', () => {
  it('parses part and ref block declarations without equals', () => {
    const ast = parseOk(`
part base {
  sketch s = rect(1, 1);
}

export part exported {
  sketch s = rect(1, 1);
}

ref mount {
  @default = @base.top.center;
}

ref inherited extends base {
  @top = @largest_planar;
}

sketch tool_sketch = rect(1, 1);
ref tool = extrude(tool_sketch, 1);
`);
    expect(ast.statements.some((stmt) => stmt.kind === 'part')).toBe(true);
    expect(ast.statements.some((stmt) => stmt.kind === 'export')).toBe(true);
    expect(
      ast.statements.filter(
        (stmt): stmt is RefPartDecl => stmt.kind === 'refPart',
      ),
    ).toHaveLength(2);
    expect(
      ast.statements.find((stmt): stmt is RefObjDecl => stmt.kind === 'refObj')
        ?.name,
    ).toBe('tool');
  });

  it('parses part and object metadata assignments', () => {
    const ast = parseOk(`
part p {
  var finish = 'PLA';
  var accent = #88ccff;
  part.material = finish;
  part.color = accent;
  sketch s = rect(1, 1);
  obj base = extrude(s, 1);
  base.material = 'PETG';
  base.color = #111111;
}
`);
    const metadata = firstPart(ast).body.statements.filter(
      (stmt): stmt is MetadataAssignment => stmt.kind === 'metadata',
    );
    expect(metadata.map((stmt) => stmt.property)).toEqual([
      'material',
      'color',
      'material',
      'color',
    ]);
    expect(metadata[0].target.kind).toBe('part');
    expect(metadata[2].target).toEqual({ kind: 'object', name: 'base' });
  });

  it('rejects removed declaration and metadata forms', () => {
    const errors = [
      ...parseErrors('part p = {}'),
      ...parseErrors('ref r = {}'),
      ...parseErrors("part p { material: 'petg'; }"),
      ...parseErrors('part p { color: #fff000; }'),
      ...parseErrors('part p { part.colour = #fff000; }'),
      ...parseErrors('part p { base.colour = #fff000; }'),
      ...parseErrors("part p { this.material = 'petg'; }"),
      ...parseErrors('part p { this.color = #fff000; }'),
    ];

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining(`Part declarations no longer use '='`),
        expect.stringContaining(`Ref block declarations no longer use '='`),
        expect.stringContaining(`Loose 'material:' statements were removed`),
        expect.stringContaining(`Loose 'color:' statements were removed`),
        expect.stringContaining(`part.color`),
        expect.stringContaining(`base.color`),
        expect.stringContaining(`this.material is contextual geometry data`),
        expect.stringContaining(`this.color is contextual geometry data`),
      ]),
    );
  });
});
