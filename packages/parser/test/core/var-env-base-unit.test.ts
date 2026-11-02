/**
 * @author Aidan Boissonneault
 * @file var-env-base-unit.test.ts
 * @purpose Tests var env base unit behavior in the core in parser package.
 * @last-edited October 6, 2026
 */

import type { EnvDecl, VarDecl } from '@bushscad/ir';
import { describe, expect, it } from 'vitest';
import { parse } from '../../src/core/parser.js';
import { parseOk } from '../fixtures/parse.js';

describe('parser — var/env/base_unit', () => {
  it('parses base_unit', () => {
    const ast = parseOk('base_unit = mm;');
    expect(ast.baseUnit).toBe('mm');
  });

  it('parses base_unit = in (keyword token)', () => {
    const ast = parseOk('base_unit = in;');
    expect(ast.baseUnit).toBe('in');
  });

  it('parses workplane values', () => {
    expect(parseOk('workplane = XY;').workplane).toBe('XY');
    expect(parseOk('workplane = XZ;').workplane).toBe('XZ');
    expect(parseOk('workplane = YZ;').workplane).toBe('YZ');
  });

  it('reports unknown workplane values', () => {
    const result = parse('workplane = ZX;', 'test.bscd');
    expect(result.errors[0].message).toContain("Unknown workplane 'ZX'");
    expect(result.ast.workplane).toBe('XY');
  });

  it('parses var number', () => {
    const ast = parseOk('var x = 42;');
    const v = ast.statements[0] as VarDecl;
    expect(v.kind).toBe('var');
    expect(v.name).toBe('x');
    expect(v.value.kind).toBe('number');
  });

  it('parses var string', () => {
    const ast = parseOk("var label = 'FRONT';");
    const v = ast.statements[0] as VarDecl;
    expect(v.value.kind).toBe('string');
  });

  it('parses var bool', () => {
    const ast = parseOk('var flag = true;');
    const v = ast.statements[0] as VarDecl;
    expect(v.value.kind).toBe('bool');
  });

  it('parses var list', () => {
    const ast = parseOk('var pts = [(10, 10), (20, 20)];');
    const v = ast.statements[0] as VarDecl;
    expect(v.value.kind).toBe('list');
  });

  it('parses var expression', () => {
    const ast = parseOk('var x = 2 * 3 + 1;');
    const v = ast.statements[0] as VarDecl;
    expect(v.value.kind).toBe('binary');
  });

  it('parses env with number fallback', () => {
    const ast = parseOk('env count fallback 4;');
    const e = ast.statements[0] as EnvDecl;
    expect(e.kind).toBe('env');
    expect(e.name).toBe('count');
    expect(e.fallback.kind).toBe('number');
  });

  it('parses env with string fallback', () => {
    const ast = parseOk("env mode fallback 'debug';");
    const e = ast.statements[0] as EnvDecl;
    expect(e.fallback.kind).toBe('string');
  });

  it('parses env with bool fallback', () => {
    const ast = parseOk('env show fallback true;');
    const e = ast.statements[0] as EnvDecl;
    expect(e.fallback.kind).toBe('bool');
  });

  it('rejects expressions in environment fallback lists', () => {
    const result = parse('env sizes fallback [2 + 3];', 'test.bscd');

    expect(
      result.errors.some((error) =>
        error.message.includes(
          'Environment fallback lists may contain only literal values',
        ),
      ),
    ).toBe(true);
  });
});
