/**
 * @author Aidan Boissonneault
 * @file sketch-preview-metadata.test.ts
 * @purpose Tests sketch preview metadata behavior in the sketch preview in three renderer package.
 * @last-edited October 6, 2026
 */

import type { SketchPreviewModel } from '@bushscad/ir';
import { describe, expect, it } from 'vitest';
import {
  sketchPreviewConstraintStatus,
  sketchPreviewDetails,
  sketchPreviewStats,
} from '../../src/sketch-preview/sketch-preview-metadata.js';

describe('sketch preview metadata', () => {
  it('projects dimensions, counts, bounds, and constraint status consistently', () => {
    const preview = model();
    expect(sketchPreviewConstraintStatus(preview)).toEqual({
      label: 'Under constrained',
      detail: '2 DOF free',
      tone: 'warning',
    });
    expect(sketchPreviewDetails(preview)).toEqual([
      { kind: 'dimension', label: 'Bounds', value: '10 x 6 mm' },
    ]);
    expect(sketchPreviewStats(preview)).toEqual(
      expect.arrayContaining([
        { label: 'Entities', value: '1' },
        { label: 'Size', value: '10 × 6 mm' },
      ]),
    );
  });
});

/**
 * Handles model in the sketch preview flow.
 */
function model(): SketchPreviewModel {
  return {
    name: 'slot',
    line: 1,
    col: 1,
    filePath: 'slot.bscd',
    componentPath: [],
    kind: 'profile',
    primitive: {
      kind: 'profile',
      segments: [{ kind: 'line', name: 'edge', from: [0, 0], to: [10, 0] }],
      constraintState: { status: 'underconstrained', dof: 2 },
    },
    bounds: { minX: 0, maxX: 10, minY: 0, maxY: 6, width: 10, height: 6 },
    details: [],
  };
}
