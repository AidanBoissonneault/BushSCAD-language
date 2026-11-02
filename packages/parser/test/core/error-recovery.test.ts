/**
 * @author Aidan Boissonneault
 * @file error-recovery.test.ts
 * @purpose Tests error recovery behavior in the core in parser package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import { parse } from '../../src/core/parser.js';

describe('parser — error recovery', () => {
  it('continues after bad statement', () => {
    const result = parse('@@@ garbage @@@\nvar x = 5;', 'test.bscd');
    expect(result.errors.length).toBeGreaterThan(0);
    // should still parse var x
    const varDecl = result.ast.statements.find((s) => s.kind === 'var');
    expect(varDecl).toBeDefined();
  });

  it('collects multiple errors', () => {
    const result = parse('@@\nvar x = 5;\n@@\nvar y = 6;', 'test.bscd');
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.ast.statements.filter((s) => s.kind === 'var')).toHaveLength(
      2,
    );
  });

  it('reports an unterminated quoted string', () => {
    const result = parse('var label = "unfinished', 'test.bscd');

    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: expect.stringContaining('UNKNOWN'),
        }),
      ]),
    );
  });

  it('reports an unterminated block comment', () => {
    const result = parse('/* unfinished comment', 'test.bscd');

    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: expect.stringContaining('UNKNOWN'),
        }),
      ]),
    );
  });
});
