/**
 * @author Aidan Boissonneault
 * @file previewFile.test.ts
 * @purpose Tests preview file behavior in the pipeline in compiler package.
 * @last-edited October 6, 2026
 */

import type { IROp } from '@bushscad/ir';
import { describe, expect, it } from 'vitest';
import { selectBuildOps } from '../../src/pipeline/previewFile';

// Minimal op stand-ins — selectBuildOps only cares about array positions.
const ops = ['a', 'b', 'c', 'd', 'e'].map(
  (k) => ({ kind: k }) as unknown as IROp,
);

describe('selectBuildOps (M35 timeline build filtering)', () => {
  it('returns all ops when no cursor and no suppression', () => {
    expect(selectBuildOps(ops, undefined, undefined)).toBe(ops);
  });

  it('truncates at the timeline cursor', () => {
    expect(selectBuildOps(ops, 2, undefined)).toHaveLength(3);
  });

  it('drops suppressed op indices', () => {
    const result = selectBuildOps(ops, undefined, [1, 3]);
    expect(result.map((o) => o.kind)).toEqual(['a', 'c', 'e']);
  });

  it('applies suppression within the cursor-truncated range', () => {
    const result = selectBuildOps(ops, 3, [1]);
    expect(result.map((o) => o.kind)).toEqual(['a', 'c', 'd']);
  });

  it('ignores suppressed indices beyond the cursor cutoff', () => {
    const result = selectBuildOps(ops, 1, [4]);
    expect(result.map((o) => o.kind)).toEqual(['a', 'b']);
  });
});
