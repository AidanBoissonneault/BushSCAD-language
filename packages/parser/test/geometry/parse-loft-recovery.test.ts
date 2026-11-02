/**
 * @author Aidan Boissonneault
 * @file parse-loft-recovery.test.ts
 * @purpose Tests parse loft recovery behavior in the geometry in parser package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import { parse } from '../../src/core/parser.js';
import type { PartDecl } from '@bushscad/ir';

/**
 * Handles part in the geometry flow.
 */
function part(result: ReturnType<typeof parse>, name: string): PartDecl {
  const stmt = result.ast.statements.find(
    (candidate) => candidate.kind === 'part' && candidate.name === name,
  );
  if (!stmt) throw new Error(`Part '${name}' not found`);
  return stmt as PartDecl;
}

describe('loft parser recovery', () => {
  it('recovers , @incomplete loft before the next top-level statement', () => {
    const result = parse(
      'obj objname = loft(\nsketch a = rect(1, 1);',
      'test.bscd',
    );

    expect(result.errors.some((e) => e.message.includes('Unclosed loft'))).toBe(
      true,
    );
    expect(result.ast.statements.some((s) => s.kind === 'sketch')).toBe(true);
  });

  it('recovers , @incomplete loft before the next part-body statement', () => {
    const result = parse(
      'part p {\n  obj objname = loft(\n  sketch a = rect(1, 1);\n}',
      'test.bscd',
    );

    expect(result.errors.some((e) => e.message.includes('Unclosed loft'))).toBe(
      true,
    );
    expect(
      part(result, 'p').body.statements.some((s) => s.kind === 'sketch'),
    ).toBe(true);
  });

  it('keeps valid loft syntax unchanged', () => {
    const result = parse(
      'obj body = loft(profile, mid, height: 40, guide: rail);',
      'test.bscd',
    );

    expect(result.errors).toHaveLength(0);
    expect(result.ast.statements[0]).toMatchObject({
      kind: 'obj',
      operation: {
        kind: 'loft',
        sketches: [
          { kind: 'namedSketch', name: 'profile' },
          { kind: 'namedSketch', name: 'mid' },
        ],
        guide: { kind: 'namedSketch', name: 'rail' },
      },
    });
  });
});
