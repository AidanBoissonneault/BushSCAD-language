/**
 * @author Aidan Boissonneault
 * @file sketch-component-alias.test.ts
 * @purpose Tests sketch component alias behavior in the sketch in parser package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import { parse } from '../../src/core/parser.js';

describe('sketch component aliases', () => {
  it('wraps each Boolean operand in its postfix alias', () => {
    const result = parse(
      'sketch crossed = rect(60, 20) as horizontal + rect(20, 60) as vertical;',
      'component-alias.bscd',
    );

    expect(result.errors).toEqual([]);
    const statement = result.ast.statements[0];
    expect(statement?.kind).toBe('sketch');
    if (statement?.kind !== 'sketch') return;
    expect(statement.primitive).toMatchObject({
      kind: 'sketchBoolean',
      op: 'add',
      left: {
        kind: 'sketchAlias',
        name: 'horizontal',
        primitive: { kind: 'rect' },
      },
      right: {
        kind: 'sketchAlias',
        name: 'vertical',
        primitive: { kind: 'rect' },
      },
    });
  });

  it('accepts qualified component members in intersections', () => {
    const result = parse(
      'fillet(@body.(horizontal.top, vertical.right)[0], 2);',
      'qualified-intersection.bscd',
    );

    expect(result.errors).toEqual([]);
    const statement = result.ast.statements[0];
    expect(statement?.kind).toBe('fillet');
    if (statement?.kind !== 'fillet') return;
    expect(statement.target.kind).toBe('faceRef');
    if (statement.target.kind === 'faceRefList') return;
    expect(statement.target.chain.at(-1)).toMatchObject({
      kind: 'edgeIntersection',
      edges: ['horizontal.top', 'vertical.right'],
      index: 0,
    });
  });
});
