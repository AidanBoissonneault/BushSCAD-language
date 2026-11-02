/**
 * @author Aidan Boissonneault
 * @file eval-geometry-queries.test.ts
 * @purpose Tests eval geometry queries behavior in the geometry in evaluator package.
 * @last-edited October 6, 2026
 */

import type { ASTSourceSpan, Expr, IRAssert } from '@bushscad/ir';
import { describe, expect, it } from 'vitest';
import type { EvalCtx } from '../../src/core/eval-types.js';
import {
  buildIRAssert,
  evalGeometryQuery,
  tryEvalAssertCondition,
} from '../../src/geometry/eval-geometry-queries.js';

const span: ASTSourceSpan = {
  file: 'test.bscd',
  line: 1,
  col: 1,
  endLine: 1,
  endCol: 1,
};

/**
 * Handles test context in the geometry flow.
 */
function testCtx(): EvalCtx {
  return {
    names: new Map([['cube', 'cube_1']]),
    values: new Map([['limit', 10]]),
    tags: new Map(),
    partsSnapshot: new Map(),
    faceMetrics: new Map([
      [
        'cube_1.top',
        {
          width: 4,
          height: 5,
          area: 20,
          normal: 'z',
          center: { faceRef: 'cube_1.top.center' },
        },
      ],
    ]),
    solidMetrics: new Map([['cube_1', { width: 2, height: 3, depth: 4 }]]),
    errors: [],
    fitDecls: new Map(),
  } as unknown as EvalCtx;
}

describe('geometry query evaluation', () => {
  it('evaluates face area and solid volume from compile-time metrics', () => {
    const ctx = testCtx();

    expect(evalGeometryQuery('face_area', [faceRef('cube', 'top')], ctx)).toBe(
      20,
    );
    expect(evalGeometryQuery('volume', [identifier('cube')], ctx)).toBe(24);
  });

  it('leaves OCCT-only queries deferred', () => {
    const ctx = testCtx();

    expect(evalGeometryQuery('distance', [identifier('cube')], ctx)).toBeNull();
    expect(
      tryEvalAssertCondition(
        binary(call('distance', [identifier('cube')]), '>', number(1)),
        ctx,
      ),
    ).toBeNull();
  });

  it('evaluates deterministic assert expressions', () => {
    const ctx = testCtx();

    expect(
      tryEvalAssertCondition(
        binary(call('volume', [identifier('cube')]), '>', identifier('limit')),
        ctx,
      ),
    ).toBe(true);
  });

  it('builds deferred IR assert query expressions', () => {
    const ctx = testCtx();
    const result = buildIRAssert(
      {
        kind: 'assert',
        condition: binary(
          call('clearance', [identifier('cube'), faceRef('cube', 'top')]),
          '>=',
          number(0.2),
        ),
        severity: 'warning',
        message: 'too close',
        span,
      },
      ctx,
    );

    expect(result).toMatchObject({
      kind: 'assert',
      op: '>=',
      severity: 'warning',
      message: 'too close',
    } satisfies Partial<IRAssert>);
    expect(result?.left).toEqual({
      kind: 'query',
      fn: 'clearance',
      args: ['cube_1', 'cube_1.top'],
    });
    expect(result?.right).toEqual({ kind: 'literal', value: 0.2 });
  });
});

/**
 * Handles number in the geometry flow.
 */
function number(value: number): Expr {
  return { kind: 'number', value, span };
}

/**
 * Handles identifier in the geometry flow.
 */
function identifier(name: string): Expr {
  return { kind: 'identifier', name, span };
}

/**
 * Handles call in the geometry flow.
 */
function call(name: string, args: Expr[]): Expr {
  return { kind: 'call', name, args, namedArgs: [], span };
}

/**
 * Handles binary in the geometry flow.
 */
function binary(left: Expr, op: string, right: Expr): Expr {
  return { kind: 'binary', left, op, right, span } as Expr;
}

/**
 * Resolves the face data required by the current selector.
 */
function faceRef(root: string, face: string): Expr {
  return {
    kind: 'faceRef',
    chain: [
      { kind: 'name', value: root, span },
      { kind: 'name', value: face, span },
    ],
    span,
  };
}
