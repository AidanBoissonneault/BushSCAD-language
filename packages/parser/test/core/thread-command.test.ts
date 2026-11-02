/**
 * @author Aidan Boissonneault
 * @file thread-command.test.ts
 * @purpose Tests thread command behavior in the core in parser package.
 * @last-edited October 6, 2026
 */

import type { ThreadDetail } from '@bushscad/ir';
import { describe, expect, it } from 'vitest';
import { parse } from '../../src/core/parser.js';
import { part } from '../fixtures/part-selectors.js';
import { parseOk } from '../fixtures/parse.js';

describe('thread command', () => {
  describe('external thread', () => {
    const SRC = `
base_unit = mm;
part bolt {
    sketch shaft = circle(6);
    obj shaft = extrude(shaft, 20);
    thread(shaft, external, 6, 1, length: 12, direction: clockwise, angle: 18deg);
}
`;
    it('parses with zero errors', () => {
      parseOk(SRC);
    });

    it('has correct kind and threadType', () => {
      const ast = parseOk(SRC);
      const p = part(ast, 'bolt');
      const t = bodyStmt<ThreadDetail>(p, 'thread');
      expect(t.kind).toBe('thread');
      expect(t.threadType).toBe('external');
    });

    it('has correct target', () => {
      const ast = parseOk(SRC);
      const p = part(ast, 'bolt');
      const t = bodyStmt<ThreadDetail>(p, 'thread');
      expect(t.target).toBe('shaft');
    });

    it('has numeric diameter, pitch, length, and angle expressions', () => {
      const ast = parseOk(SRC);
      const p = part(ast, 'bolt');
      const t = bodyStmt<ThreadDetail>(p, 'thread');
      expect(t.diameter.kind).toBe('number');
      expect(t.pitch.kind).toBe('number');
      expect(t.length?.kind).toBe('number');
      expect(t.direction).toBe('clockwise');
      expect(t.angle?.kind).toBe('unit');
      if (t.angle?.kind === 'unit') expect(t.angle.unit).toBe('deg');
    });
  });

  describe('internal thread', () => {
    const SRC = `
base_unit = mm;
part block {
    sketch body = rect(20, 20);
    obj body = extrude(body, 15);
    sketch hole = circle(2.1);
    obj hole = cut(hole, through body);
    thread(hole, internal, 4.2, 0.7, length: 10, direction: counter clockwise);
}
`;
    it('parses with zero errors', () => {
      parseOk(SRC);
    });

    it('has correct kind and threadType', () => {
      const ast = parseOk(SRC);
      const p = part(ast, 'block');
      const t = bodyStmt<ThreadDetail>(p, 'thread');
      expect(t.kind).toBe('thread');
      expect(t.threadType).toBe('internal');
      expect(t.direction).toBe('counter_clockwise');
    });

    it('has correct target', () => {
      const ast = parseOk(SRC);
      const p = part(ast, 'block');
      const t = bodyStmt<ThreadDetail>(p, 'thread');
      expect(t.target).toBe('hole');
    });

    it('accepts degrees alias for thread angle', () => {
      const ast = parseOk(`
base_unit = mm;
part bolt {
    sketch shaft = circle(6);
    obj shaft = extrude(shaft, 20);
    thread(shaft, external, 6, 1, direction: clockwise, degrees: 12);
}
`);
      const p = part(ast, 'bolt');
      const t = bodyStmt<ThreadDetail>(p, 'thread');
      expect(t.angle?.kind).toBe('number');
    });
  });

  describe('error recovery', () => {
    it('reports error for unknown thread type', () => {
      const result = parse(
        `part p { sketch s = circle(3); obj s = extrude(s, 10); thread(s, conical, 6, 1); }`,
        'test.bscd',
      );
      expect(result.errors.some((e) => e.message.includes('conical'))).toBe(
        true,
      );
    });

    it('reports error for missing type param', () => {
      const result = parse(
        `part p { sketch s = circle(3); obj s = extrude(s, 10); thread(target: s, d: 6, pitch: 1); }`,
        'test.bscd',
      );
      expect(result.errors.some((e) => e.message.includes('type'))).toBe(true);
    });

    it('reports error when using deprecated depth param', () => {
      const result = parse(
        `part p { sketch s = circle(3); obj s = extrude(s, 10); thread(s, external, 6, 1, depth: 8); }`,
        'test.bscd',
      );
      expect(
        result.errors.some((e) => e.message.includes("use 'length:'")),
      ).toBe(true);
    });

    it('reports error for unknown thread direction', () => {
      const result = parse(
        `part p { sketch s = circle(3); obj s = extrude(s, 10); thread(s, external, 6, 1, direction: sideways); }`,
        'test.bscd',
      );
      expect(result.errors.some((e) => e.message.includes('direction'))).toBe(
        true,
      );
    });
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
