/**
 * @author Aidan Boissonneault
 * @file expressions.test.ts
 * @purpose Tests expressions behavior in the core in parser package.
 * @last-edited October 6, 2026
 */

import type {
  ASTSourceSpan,
  CutOp,
  ExtrudeOp,
  FilletDetail,
  ObjDecl,
  PosRef,
  SketchDecl,
  VarDecl,
} from '@bushscad/ir';
import { describe, expect, it } from 'vitest';
import { parse } from '../../src/index.js';
import { component } from '../fixtures/component-selectors.js';
import { faceChain } from '../fixtures/face-ref-format.js';
import { parseOk } from '../fixtures/parse.js';

describe('parser — expressions', () => {
  it('parses ternary', () => {
    const ast = parseOk('var x = flag ? 20 : 10;');
    const v = ast.statements[0] as VarDecl;
    expect(v.value.kind).toBe('ternary');
  });

  it('parses arithmetic precedence', () => {
    const ast = parseOk('var x = 2 + 3 * 4;');
    const v = ast.statements[0] as VarDecl;
    // 2 + (3*4) — top node should be binary +
    expect(v.value.kind).toBe('binary');
    if (v.value.kind === 'binary') {
      expect(v.value.op).toBe('+');
      expect(v.value.right.kind).toBe('binary');
    }
  });

  it('spans the complete binary expression', () => {
    const source = 'var x = 2 + 3 * 4;';
    const value = (parseOk(source).statements[0] as VarDecl).value;

    expect(sourceText(source, value.span)).toBe('2 + 3 * 4');
  });

  it('retains explicit grouping in expression spans', () => {
    const source = 'var x = (2 + 3) * 4;';
    const value = (parseOk(source).statements[0] as VarDecl).value;

    expect(sourceText(source, value.span)).toBe('(2 + 3) * 4');
    if (value.kind === 'binary') {
      expect(sourceText(source, value.left.span)).toBe('(2 + 3)');
    }
  });

  it('parses unary minus', () => {
    const ast = parseOk('var x = -5;');
    const v = ast.statements[0] as VarDecl;
    expect(v.value.kind).toBe('unary');
  });

  it('parses unit expression', () => {
    const ast = parseOk('var x = 2mm;');
    const v = ast.statements[0] as VarDecl;
    expect(v.value.kind).toBe('unit');
    if (v.value.kind === 'unit') expect(v.value.unit).toBe('mm');
  });

  it('parses this.width', () => {
    const ast = parseOk('sketch lid = rect(this.width, this.height);');
    const s = ast.statements[0] as SketchDecl;
    if (s.primitive.kind === 'rect') {
      expect(s.primitive.width.kind).toBe('this');
      expect(s.primitive.height.kind).toBe('this');
    }
  });

  it('parses face ref chain', () => {
    const ast = parseOk(
      'part p { sketch b = rect(1,1); obj b = extrude(b,1); fillet(@b.top.front_edge.center, 1); }',
    );
    const c = component(ast, 'p');
    const f = bodyStmt<FilletDetail>(c, 'fillet');
    expect(faceChain(f.target)).toBe('b.top.front_edge.center');
  });

  it('parses @ with named args', () => {
    const ast = parseOk('obj b = extrude(b, 8 , @base.top(x: 10, y: -5));');
    const op = (ast.statements[0] as ObjDecl).operation as ExtrudeOp;
    const pos = op.from as PosRef;
    expect(pos.kind).toBe('pos');
    expect(pos.x).toBeDefined();
    expect(pos.y).toBeDefined();
  });

  it('parses @ radial', () => {
    const ast = parseOk(
      'obj h = cut(h, through base , @base.top.center(radius: 20, angle: 45deg));',
    );
    const op = (ast.statements[0] as ObjDecl).operation as CutOp;
    const pos = op.from as PosRef;
    expect(pos.radius).toBeDefined();
    expect(pos.angle).toBeDefined();
  });

  it('parses fn call with named args', () => {
    const ast = parseOk(
      "sketch s = word('X', size: 5, font: 'sans', align: center);",
    );
    const sk = ast.statements[0] as SketchDecl;
    expect(sk.primitive.kind).toBe('word');
  });

  it('parses comparison operators', () => {
    const ast = parseOk('var x = a >= b;');
    const v = ast.statements[0] as VarDecl;
    if (v.value.kind === 'binary') expect(v.value.op).toBe('>=');
  });

  it('parses logical and/or', () => {
    const ast = parseOk('var x = a && b || c;');
    const v = ast.statements[0] as VarDecl;
    expect(v.value.kind).toBe('binary');
  });

  it('parses template strings with full expressions and nesting', () => {
    const source = 'var label = `size ${width * 2}: ${`ok ${enabled}`}`;';
    const value = (parseOk(source).statements[0] as VarDecl).value;

    expect(value.kind).toBe('template');
    if (value.kind !== 'template') return;
    expect(value.parts.map((part) => part.kind)).toEqual([
      'text',
      'expression',
      'text',
      'expression',
    ]);
    const nested = value.parts[3];
    expect(
      nested.kind === 'expression' ? nested.expression.kind : undefined,
    ).toBe('template');
    expect(sourceText(source, value.span)).toBe(
      '`size ${width * 2}: ${`ok ${enabled}`}`',
    );
  });

  it('reports unterminated templates and substitutions', () => {
    expect(parse('var x = `open', 'test.bscd').errors).not.toHaveLength(0);
    expect(
      parse('var x = `open ${width', 'test.bscd').errors,
    ).not.toHaveLength(0);
  });

  it('rejects template escapes that TypeScript rejects', () => {
    const invalidOctal = parse('var x = `bad \\8`;', 'test.bscd');
    const invalidUnicode = parse('var x = `bad \\u12zz`;', 'test.bscd');

    expect(invalidOctal.errors[0]?.message).toContain('Invalid escape');
    expect(invalidUnicode.errors[0]?.message).toContain('Invalid escape');
  });
});

/**
 * Returns the source data required by the current operation.
 */
function sourceText(source: string, span: ASTSourceSpan): string {
  return source.slice(span.col - 1, span.endCol - 1);
}

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
