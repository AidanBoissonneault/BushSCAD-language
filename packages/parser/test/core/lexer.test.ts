/**
 * @author Aidan Boissonneault
 * @file lexer.test.ts
 * @purpose Tests lexer behavior in the core in parser package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import { tokenize } from '../../src/core/lexer.js';

describe('lexer', () => {
  it('tokenizes keywords', () => {
    const toks = tokenize(
      'sketch obj extrude cut revolve plant loft guide wrap line arc radius clockwise counterclockwise var env workplane rotate around',
      'test.bscd',
    );
    expect(toks[0].kind).toBe('SKETCH');
    expect(toks[1].kind).toBe('OBJ');
    expect(toks[2].kind).toBe('EXTRUDE');
    expect(toks[3].kind).toBe('CUT');
    expect(toks[4].kind).toBe('REVOLVE');
    expect(toks[5].kind).toBe('PLANT');
    expect(toks[6].kind).toBe('LOFT');
    expect(toks[7].kind).toBe('GUIDE');
    expect(toks[8].kind).toBe('WRAP');
    expect(toks[9].kind).toBe('LINE');
    expect(toks[10].kind).toBe('ARC');
    expect(toks[11].kind).toBe('RADIUS');
    expect(toks[12].kind).toBe('CLOCKWISE');
    expect(toks[13].kind).toBe('COUNTERCLOCKWISE');
    expect(toks[14].kind).toBe('VAR');
    expect(toks[15].kind).toBe('ENV');
    expect(toks[16].kind).toBe('WORKPLANE');
    expect(toks[17].kind).toBe('ROTATE');
    expect(toks[18].kind).toBe('AROUND');
  });

  it('tokenizes surface modeling keywords', () => {
    const toks = tokenize(
      'surface fill offset_surface thicken',
      'test.bscd',
    );
    expect(toks.map((tok) => tok.kind).slice(0, 4)).toEqual([
      'SURFACE',
      'FILL',
      'OFFSET_SURFACE',
      'THICKEN',
    ]);
  });

  it('tokenizes number with unit suffix', () => {
    const toks = tokenize('2mm 0.5in 45deg', 'test.bscd');
    expect(toks[0].kind).toBe('NUMBER');
    expect(toks[0].value).toBe('2');
    expect(toks[1].kind).toBe('UNIT_MM');
    expect(toks[2].kind).toBe('NUMBER');
    expect(toks[2].value).toBe('0.5');
    expect(toks[3].kind).toBe('UNIT_IN');
    expect(toks[4].kind).toBe('NUMBER');
    expect(toks[4].value).toBe('45');
    expect(toks[5].kind).toBe('UNIT_DEG');
  });

  it('tokenizes hex color', () => {
    const toks = tokenize('#2563EB', 'test.bscd');
    expect(toks[0].kind).toBe('STRING');
    expect(toks[0].value).toBe('#2563EB');
  });

  it('tokenizes string literals', () => {
    const toks = tokenize('\'hello\' "world"', 'test.bscd');
    expect(toks[0].kind).toBe('STRING');
    expect(toks[0].value).toBe('hello');
    expect(toks[1].kind).toBe('STRING');
    expect(toks[1].value).toBe('world');
  });

  it('tokenizes template strings and cooks TypeScript escapes', () => {
    const toks = tokenize(
      '`line\\n${width + 2} \\`ok\\` ${`nested ${height}`}`',
      'test.bscd',
    );

    expect(toks.map((token) => token.kind)).toEqual([
      'TEMPLATE_START',
      'TEMPLATE_TEXT',
      'TEMPLATE_EXPR_START',
      'IDENT',
      'PLUS',
      'NUMBER',
      'TEMPLATE_EXPR_END',
      'TEMPLATE_TEXT',
      'TEMPLATE_EXPR_START',
      'TEMPLATE_START',
      'TEMPLATE_TEXT',
      'TEMPLATE_EXPR_START',
      'IDENT',
      'TEMPLATE_EXPR_END',
      'TEMPLATE_END',
      'TEMPLATE_EXPR_END',
      'TEMPLATE_END',
      'EOF',
    ]);
    expect(toks[1].value).toBe('line\n');
    expect(toks[7].value).toBe(' `ok` ');
  });

  it('cooks hexadecimal and Unicode template escapes', () => {
    const toks = tokenize('`\\x41\\u0042\\u{43}`', 'test.bscd');

    expect(toks[1]).toMatchObject({ kind: 'TEMPLATE_TEXT', value: 'ABC' });
  });

  it('tokenizes two-char operators', () => {
    const toks = tokenize('== != <= >= && ||', 'test.bscd');
    expect(toks[0].kind).toBe('EQ');
    expect(toks[1].kind).toBe('NEQ');
    expect(toks[2].kind).toBe('LTE');
    expect(toks[3].kind).toBe('GTE');
    expect(toks[4].kind).toBe('AND');
    expect(toks[5].kind).toBe('OR');
  });

  it('tokenizes single = as ASSIGN', () => {
    const toks = tokenize('x = 5', 'test.bscd');
    expect(toks[1].kind).toBe('ASSIGN');
  });

  it('skips line comments', () => {
    const toks = tokenize('var x = 1 // comment\nvar y = 2', 'test.bscd');
    expect(toks.filter((t) => t.kind !== 'EOF').map((t) => t.kind)).toEqual([
      'VAR',
      'IDENT',
      'ASSIGN',
      'NUMBER',
      'VAR',
      'IDENT',
      'ASSIGN',
      'NUMBER',
    ]);
  });

  it('skips block comments', () => {
    const toks = tokenize('var x = /* skip this */ 1', 'test.bscd');
    expect(toks[3].kind).toBe('NUMBER');
  });

  it('tracks line numbers', () => {
    const toks = tokenize('a\nb\nc', 'test.bscd');
    expect(toks[0].span.line).toBe(1);
    expect(toks[1].span.line).toBe(2);
    expect(toks[2].span.line).toBe(3);
  });

  it('ends with EOF', () => {
    const toks = tokenize('', 'test.bscd');
    expect(toks[toks.length - 1].kind).toBe('EOF');
  });
});
