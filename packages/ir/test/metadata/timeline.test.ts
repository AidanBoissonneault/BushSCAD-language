/**
 * @author Aidan Boissonneault
 * @file timeline.test.ts
 * @purpose Tests timeline behavior in the metadata in IR package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import {
  groupOpsToTimelineSteps,
  timelineOperationName,
  timelineTargetName,
} from '../../src/metadata/timeline.js';

const span = { file: 'model.bscd', line: 2, col: 1 };

describe('shared timeline projection', () => {
  it('pairs a sketch with its feature and exposes literal parameters', () => {
    const steps = groupOpsToTimelineSteps(
      {
        ops: [
          { kind: 'sketch', name: 'profile', span },
          {
            kind: 'extrude',
            objName: 'body',
            span,
            paramSpans: { distance: { literal: '12', span } },
          },
        ],
      } as never,
      [],
    );
    expect(steps).toHaveLength(1);
    expect(steps[0]?.opIndices).toEqual([0, 1]);
    expect(steps[0]?.editableParams).toEqual([
      { name: 'distance', literal: '12', span },
    ]);
    expect(timelineOperationName(steps[0]!.icon)).toBe('Extrude');
    expect(timelineTargetName(steps[0]!)).toBe('body');
  });
});
