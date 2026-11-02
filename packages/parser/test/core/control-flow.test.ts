/**
 * @author Aidan Boissonneault
 * @file control-flow.test.ts
 * @purpose Tests control flow behavior in the core in parser package.
 * @last-edited October 6, 2026
 */

import type { ForStatement, IfStatement } from '@bushscad/ir';
import { describe, expect, it } from 'vitest';
import { parse } from '../../src/core/parser.js';
import { component } from '../fixtures/component-selectors.js';
import { parseOk } from '../fixtures/parse.js';

describe('parser — control flow', () => {
  it.each(['range(3)', 'radial(3)'])(
    'rejects two binding names for %s',
    (iterator) => {
      const result = parse(
        `part p { for (i, j) in ${iterator} {} }`,
        'test.bscd',
      );

      expect(result.errors.map((error) => error.message)).toContain(
        `${iterator.startsWith('range') ? 'range' : 'radial'} loops accept only one binding name`,
      );
    },
  );

  it('rejects duplicate names in a pair binding', () => {
    const result = parse(
      'part p { for (i, i) in grid(2, 2) {} }',
      'test.bscd',
    );

    expect(result.errors.map((error) => error.message)).toContain(
      "Duplicate loop binding 'i'",
    );
  });

  it('parses for range(n)', () => {
    const ast = parseOk(
      'part p { sketch b = rect(1,1); obj b = extrude(b,1); for i in range(4) { sketch h = circle(3); obj h = cut(h, through b , @b.top.center); } }',
    );
    const c = component(ast, 'p');
    const f = bodyStmt<ForStatement>(c, 'for');
    expect(f.kind).toBe('for');
    expect(f.binding).toBe('i');
    expect(f.iterator.kind).toBe('range');
  });

  it('parses for range(start, end)', () => {
    const ast = parseOk(
      'part p { sketch b = rect(1,1); obj b = extrude(b,1); for i in range(1, 5) { sketch h = circle(3); obj h = cut(h, through b , @b.top.center); } }',
    );
    const c = component(ast, 'p');
    const f = bodyStmt<ForStatement>(c, 'for');
    expect(f.iterator.kind).toBe('range');
    if (f.iterator.kind === 'range') {
      expect(f.iterator.start).toBeDefined();
      expect(f.iterator.end).toBeDefined();
    }
  });

  it('parses for range(start, end, step)', () => {
    const ast = parseOk(
      'part p { sketch b = rect(1,1); obj b = extrude(b,1); for i in range(1, 9, 2) { sketch h = circle(3); obj h = cut(h, through b , @b.top.center); } }',
    );
    const c = component(ast, 'p');
    const f = bodyStmt<ForStatement>(c, 'for');
    expect(f.iterator.kind).toBe('range');
    if (f.iterator.kind === 'range') {
      expect(f.iterator.start).toBeDefined();
      expect(f.iterator.end).toBeDefined();
      expect(f.iterator.step).toBeDefined();
    }
  });

  it('parses for grid named args', () => {
    const ast = parseOk(
      'part p { sketch b = rect(1,1); obj b = extrude(b,1); for (i, j) in grid(cols: 4, rows: 3, spacing: 15) { sketch h = circle(2); obj h = cut(h, through b , @b.top.center); } }',
    );
    const c = component(ast, 'p');
    const f = bodyStmt<ForStatement>(c, 'for');
    expect(Array.isArray(f.binding)).toBe(true);
    expect(f.iterator.kind).toBe('grid');
    if (f.iterator.kind === 'grid') {
      expect(f.iterator.cols).toBeDefined();
      expect(f.iterator.rows).toBeDefined();
      expect(f.iterator.spacing).toBeDefined();
    }
  });

  it('parses for grid axis-specific spacing args', () => {
    const ast = parseOk(
      'part p { sketch b = rect(1,1); obj b = extrude(b,1); for (i, j) in grid(cols: 4, rows: 3, spacing_x: 12, spacing_y: 8) { sketch h = circle(2); obj h = cut(h, through b , @b.top.center); } }',
    );
    const c = component(ast, 'p');
    const f = bodyStmt<ForStatement>(c, 'for');
    expect(f.iterator.kind).toBe('grid');
    if (f.iterator.kind === 'grid') {
      expect(f.iterator.spacingX).toBeDefined();
      expect(f.iterator.spacingY).toBeDefined();
    }
  });

  it('parses for grid positional args', () => {
    const ast = parseOk(
      'part p { sketch b = rect(1,1); obj b = extrude(b,1); for (i, j) in grid(4, 3) { sketch h = circle(2); obj h = cut(h, through b , @b.top.center); } }',
    );
    const c = component(ast, 'p');
    const f = bodyStmt<ForStatement>(c, 'for');
    expect(f.iterator.kind).toBe('grid');
  });

  it('parses for radial', () => {
    const ast = parseOk(
      'part p { sketch b = circle(10); obj b = extrude(b,5); for a in radial(6) { sketch h = circle(3); obj h = cut(h, through b , @b.top.center(radius: 20, angle: a)); } }',
    );
    const c = component(ast, 'p');
    const f = bodyStmt<ForStatement>(c, 'for');
    expect(f.iterator.kind).toBe('radial');
  });

  it('parses for list', () => {
    const ast = parseOk(
      'part p { sketch b = rect(1,1); obj b = extrude(b,1); var pts = [(10,10),(20,20)]; for pt in pts { sketch h = circle(3); obj h = cut(h, through b , @b.top.center); } }',
    );
    const c = component(ast, 'p');
    const f = bodyStmt<ForStatement>(c, 'for');
    expect(f.iterator.kind).toBe('list');
  });

  it('parses for enumerate', () => {
    const ast = parseOk(
      'part p { sketch b = rect(1,1); obj b = extrude(b,1); var sizes = [2,3,4]; for (i, d) in enumerate(sizes) { sketch h = circle(d); obj h = cut(h, through b , @b.top.center); } }',
    );
    const c = component(ast, 'p');
    const f = bodyStmt<ForStatement>(c, 'for');
    expect(f.iterator.kind).toBe('enumerate');
    expect(Array.isArray(f.binding)).toBe(true);
  });

  it('parses for with where clause', () => {
    const ast = parseOk(
      'part p { sketch b = rect(1,1); obj b = extrude(b,1); for i in range(8) where i % 2 == 0 { sketch h = circle(3); obj h = cut(h, through b , @b.top.center); } }',
    );
    const c = component(ast, 'p');
    const f = bodyStmt<ForStatement>(c, 'for');
    expect(f.where).not.toBeNull();
  });

  it('parses for with within clause (range form)', () => {
    const ast = parseOk(
      'part p { sketch b = rect(10,10); obj b = extrude(b,1); for i in range(4) within b.top.width { sketch h = circle(1); obj h = cut(h, through b , @b.top(x: auto)); } }',
    );
    const c = component(ast, 'p');
    const f = bodyStmt<ForStatement>(c, 'for');
    expect(f.within).not.toBeNull();
    expect(f.within?.dims).toHaveLength(1);
    expect(f.within?.dims[0].kind).toBe('faceDim');
  });

  it('parses for with within clause (grid form)', () => {
    const ast = parseOk(
      'part p { sketch b = rect(10,10); obj b = extrude(b,1); for (i, j) in grid(3, 2) within(b.top.width, b.top.height) { sketch h = circle(1); obj h = cut(h, through b , @b.top(x: auto, y: auto)); } }',
    );
    const c = component(ast, 'p');
    const f = bodyStmt<ForStatement>(c, 'for');
    expect(f.within?.dims).toHaveLength(2);
  });

  it('parses auto as an expression', () => {
    const ast = parseOk(
      'part p { sketch b = rect(10,10); obj b = extrude(b,1); sketch c = rect(auto, 4); obj c = extrude(c, 1 , @b.top.center); }',
    );
    const c = component(ast, 'p');
    expect(c.body.statements.some((s) => s.kind === 'sketch')).toBe(true);
  });

  it('parses if without else', () => {
    const ast = parseOk(
      "part p { sketch b = rect(1,1); obj b = extrude(b,1); if build_mode == 'release' { fillet(@b.top.edges, 2); } }",
    );
    const c = component(ast, 'p');
    const stmt = bodyStmt<IfStatement>(c, 'if');
    expect(stmt.kind).toBe('if');
    expect(stmt.else).toBeNull();
  });

  it('parses if/else', () => {
    const ast = parseOk(
      'part p { sketch b = rect(1,1); obj b = extrude(b,1); if flag { fillet(@b.top.edges, 2); } else { chamfer(@b.top.edges, 1); } }',
    );
    const c = component(ast, 'p');
    const stmt = bodyStmt<IfStatement>(c, 'if');
    expect(stmt.else).not.toBeNull();
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
