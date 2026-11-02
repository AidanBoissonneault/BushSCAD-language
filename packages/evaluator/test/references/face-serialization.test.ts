/**
 * @author Aidan Boissonneault
 * @file face-serialization.test.ts
 * @purpose Tests face serialization behavior in the references in evaluator package.
 * @last-edited October 6, 2026
 */

import type { FaceRef } from '@bushscad/ir';
import { describe, expect, it } from 'vitest';
import type { EvalCtx } from '../../src/core/eval-types.js';
import {
  serializeAnchorTarget,
  serializeFaceRef,
  serializeFaceRefSegments,
} from '../../src/references/eval-face-serialization.js';

const span = { file: 'test.bscd', line: 1, col: 1, endLine: 1, endCol: 1 };

/**
 * Handles test context in the references flow.
 */
function testCtx(): EvalCtx {
  return {
    names: new Map([
      ['box', 'box_ir'],
      ['child', 'child_ir'],
    ]),
    values: new Map(),
    tags: new Map([['mount', { kind: 'faceRefValue', label: 'box_ir.top' }]]),
    partsSnapshot: new Map([
      [
        'part',
        {
          names: new Map([['body', 'body_ir']]),
          tags: new Map([
            ['tagged', { kind: 'faceRefValue', label: 'body_ir.left' }],
          ]),
        },
      ],
    ]),
  } as unknown as EvalCtx;
}

describe('face reference serialization', () => {
  it('serializes raw face ref segment forms', () => {
    const ctx = testCtx();

    expect(
      serializeFaceRefSegments(
        faceRef([
          { kind: 'name', value: 'box', span },
          {
            kind: 'group',
            options: ['left', 'right'],
            memberSpans: [span, span],
            delimiterSpan: span,
            span,
          },
          { kind: 'index', value: 2, span },
          { kind: 'wildcard', span },
          {
            kind: 'call',
            name: 'edge',
            arg: 'front',
            namedArgs: [{ name: 'near', value: 'top' }],
            span,
          },
        ]).chain,
        ctx,
      ),
    ).toBe('box_ir.left.right.2.*.edge.front.near.top');
  });

  it('resolves root tags before normal object names', () => {
    expect(serializeFaceRef(faceRef(['mount', 'center']), testCtx())).toBe(
      'box_ir.top.center',
    );
  });

  it('resolves part snapshot object and tag references', () => {
    const ctx = testCtx();

    expect(serializeFaceRef(faceRef(['part', 'body', 'top']), ctx)).toBe(
      'body_ir.top',
    );
    expect(serializeFaceRef(faceRef(['part', 'tagged', 'center']), ctx)).toBe(
      'body_ir.left.center',
    );
  });

  it('keeps part-level face words on the completed part shape', () => {
    expect(
      serializeFaceRef(faceRef(['part', 'top', 'center']), testCtx()),
    ).toBe('part.top.center');
  });

  it('serializes anchor targets relative to another object when needed', () => {
    expect(
      serializeAnchorTarget(faceRef(['child', 'top']), testCtx(), 'box'),
    ).toBe('box_ir.face.child.top');
    expect(
      serializeAnchorTarget(faceRef(['box', 'top']), testCtx(), 'box'),
    ).toBe('box_ir.top');
  });
});

/**
 * Resolves the face data required by the current selector.
 */
function faceRef(segments: (string | FaceRef['chain'][number])[]): FaceRef {
  return {
    kind: 'faceRef',
    chain: segments.map((segment) =>
      typeof segment === 'string'
        ? { kind: 'name', value: segment, span }
        : segment,
    ),
    span,
  };
}
