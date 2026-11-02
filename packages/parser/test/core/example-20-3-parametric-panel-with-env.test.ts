/**
 * @author Aidan Boissonneault
 * @file example-20-3-parametric-panel-with-env.test.ts
 * @purpose Tests example 20 3 parametric panel with env behavior in the core in parser package.
 * @last-edited October 6, 2026
 */

import type { ForStatement, IfStatement } from '@bushscad/ir';
import { describe, expect, it } from 'vitest';
import { component } from '../fixtures/component-selectors.js';
import { parseOk } from '../fixtures/parse.js';

describe('spec example 20.3 — parametric panel with env grid', () => {
  const SRC = `
base_unit = mm;
env grid_cols  fallback 4;
env grid_rows  fallback 3;
env spacing    fallback 22;
env hole_dia   fallback 3;
env build_mode fallback 'debug';

part panel {
    sketch base = rect(100, 80);
    obj base = extrude(base, 6);
    for (i, j) in grid(cols: grid_cols, rows: grid_rows, spacing: spacing) {
        sketch hole = circle(hole_dia);
        obj hole = cut(hole, through base , @base.top.front_left(x: 10 + i, y: 10 + j));
    }
    if build_mode == 'release' {
        fillet(@base.top.edges, 2);
        fillet(@base.bottom.edges, 1);
    }
}
`;
  it('parses with zero errors', () => {
    parseOk(SRC);
  });

  it('has 5 env declarations', () => {
    const ast = parseOk(SRC);
    expect(ast.statements.filter((s) => s.kind === 'env')).toHaveLength(5);
  });

  it('panel has for loop with grid iterator using variable cols/rows', () => {
    const ast = parseOk(SRC);
    const c = component(ast, 'panel');
    const f = bodyStmt<ForStatement>(c, 'for');
    expect(f.iterator.kind).toBe('grid');
    if (f.iterator.kind === 'grid') {
      expect(f.iterator.cols!.kind).toBe('identifier');
      expect(f.iterator.rows!.kind).toBe('identifier');
    }
  });

  it('has if statement with binary condition', () => {
    const ast = parseOk(SRC);
    const c = component(ast, 'panel');
    const stmt = bodyStmt<IfStatement>(c, 'if');
    expect(stmt.condition.kind).toBe('binary');
    if (stmt.condition.kind === 'binary') expect(stmt.condition.op).toBe('==');
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
