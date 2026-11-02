/**
 * @author Aidan Boissonneault
 * @file fn.test.ts
 * @purpose Tests fn behavior in the core in parser package.
 * @last-edited October 6, 2026
 */

import type { ReturnStatement } from '@bushscad/ir';
import { describe, expect, it } from 'vitest';
import { parse } from '../../src/core/parser.js';
import { parseOk } from '../fixtures/parse.js';

describe('parser — fn', () => {
  it('parses fn no params', () => {
    const ast = parseOk(
      'fn doThing() { sketch h = circle(3); obj h = cut(h, through base , @base.top.center); }',
    );
    const fn = ast.statements[0];
    expect(fn.kind).toBe('fn');
    if (fn.kind === 'fn') {
      expect(fn.name).toBe('doThing');
      expect(fn.params).toHaveLength(0);
    }
  });

  it('parses fn with params and defaults', () => {
    const ast = parseOk(
      'fn bolt_hole(d, depth: 3, cs_ratio: 1.8) { sketch h = circle(d); obj h = cut(h, depth , @base.top.center); }',
    );
    const fn = ast.statements[0];
    if (fn.kind === 'fn') {
      expect(fn.params).toHaveLength(3);
      expect(fn.params[0].default).toBeNull();
      expect(fn.params[1].default).not.toBeNull();
    }
  });

  it('rejects duplicate function parameter names', () => {
    const result = parse(
      'fn size(width, width) { sketch body = rect(width, width); }',
      'test.bscd',
    );

    expect(
      result.errors.some((error) =>
        error.message.includes("Duplicate function parameter 'width'"),
      ),
    ).toBe(true);
  });

  it('parses fn with setup statements and return body', () => {
    const ast = parseOk(`
fn cs_hole(pilot_d, cs_d, depth) {
    sketch pilot = circle(pilot_d);
    sketch cs = circle(cs_d);
    return {
        obj pilot = cut(pilot, depth),
        obj cs = cut(cs, depth * 0.4),
    }
}
`);
    const fn = ast.statements[0];
    expect(fn.kind).toBe('fn');
    if (fn.kind === 'fn') {
      const ret = fn.body.statements[2] as ReturnStatement;
      expect(ret.kind).toBe('return');
      expect(ret.body.statements).toHaveLength(2);
    }
  });

  it('parses empty and single-entry return bodies', () => {
    const empty = parseOk('fn noop() { return {} }');
    expect(empty.statements[0].kind).toBe('fn');

    const single = parseOk(
      'fn one(depth) { sketch h = circle(3); return { obj h = cut(h, depth), } }',
    );
    const fn = single.statements[0];
    expect(fn.kind).toBe('fn');
    if (fn.kind === 'fn') {
      const ret = fn.body.statements[1] as ReturnStatement;
      expect(ret.body.statements).toHaveLength(1);
    }
  });

  it('reports semicolons inside return bodies', () => {
    const result = parse(
      `
fn bad(depth) {
    sketch h = circle(3);
    return {
        obj h = cut(h, depth);
    }
}
`,
      'test.bscd',
    );
    expect(
      result.errors.some((e) =>
        e.message.includes('semicolons are not allowed inside return blocks'),
      ),
    ).toBe(true);
  });

  it('reports missing commas between return entries', () => {
    const result = parse(
      `
fn bad(depth) {
    sketch h = circle(3);
    return {
        obj a = cut(h, depth)
        obj b = cut(h, depth)
    }
}
`,
      'test.bscd',
    );
    expect(
      result.errors.some((e) =>
        e.message.includes("Expected ',' between return entries"),
      ),
    ).toBe(true);
  });
});
