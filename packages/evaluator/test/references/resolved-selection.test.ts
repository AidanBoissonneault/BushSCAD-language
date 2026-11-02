/**
 * @author Aidan Boissonneault
 * @file resolved-selection.test.ts
 * @purpose Tests resolved selection behavior in the references in evaluator package.
 * @last-edited October 6, 2026
 */

import type { EvalCtx } from '../../src/core/eval-types.js';
import type { FaceRef } from '@bushscad/ir';
import { describe, expect, it } from 'vitest';
import { evalResolvedSelection } from '../../src/references/eval-resolved-selection.js';
import { evalSingularPlacement } from '../../src/references/eval-repeatable-refs.js';

const span = {
  file: 'selection.bscd',
  line: 1,
  col: 1,
  endLine: 1,
  endCol: 20,
};
const topSpan = { ...span, col: 8, endCol: 11 };
const bottomSpan = { ...span, col: 13, endCol: 19 };

/**
 * Handles test context in the references flow.
 */
function testCtx(): EvalCtx {
  return {
    names: new Map(),
    values: new Map(),
    tags: new Map(),
    partsSnapshot: new Map(),
    faceMetrics: new Map(),
    solidMetrics: new Map(),
    spatialAliases: new Map(),
    errors: [],
  } as unknown as EvalCtx;
}

describe('resolved selector evaluation', () => {
  it('retains member provenance and removes duplicate targets in source order', () => {
    const ref: FaceRef = {
      kind: 'faceRef',
      chain: [
        { kind: 'name', value: 'plate', span },
        {
          kind: 'group',
          options: ['top', 'bottom', 'top'],
          memberSpans: [topSpan, bottomSpan, topSpan],
          delimiterSpan: span,
          span,
        },
        { kind: 'name', value: 'edges', span },
      ],
      span,
    };

    const selection = evalResolvedSelection(ref, testCtx(), 'fillet');

    expect(selection.requestedKind).toBe('expanded-selection');
    expect(selection.targets.map((target) => target.label)).toEqual([
      'plate.top.edges',
      'plate.bottom.edges',
    ]);
    expect(selection.targets[0]?.source.segmentSpans[1]).toEqual({
      span: topSpan,
      expandedFrom: topSpan,
    });
    expect(selection.targets[1]?.source.segmentSpans[1]).toEqual({
      span: bottomSpan,
      expandedFrom: bottomSpan,
    });
  });

  it('diagnoses multiple targets for singular consumers', () => {
    const ctx = testCtx();
    const ref: FaceRef = {
      kind: 'faceRef',
      chain: [
        { kind: 'name', value: 'plate', span },
        {
          kind: 'group',
          options: ['top', 'bottom'],
          memberSpans: [topSpan, bottomSpan],
          delimiterSpan: span,
          span,
        },
      ],
      span,
    };

    evalSingularPlacement(ref, ctx, ref.span, 'revolve-axis');

    expect(ctx.errors.map((error) => error.message)).toContain(
      'Selector must resolve to exactly one placement; found 2',
    );
  });
});
