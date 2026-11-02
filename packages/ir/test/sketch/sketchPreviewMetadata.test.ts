/**
 * @author Aidan Boissonneault
 * @file sketchPreviewMetadata.test.ts
 * @purpose Tests sketch preview metadata behavior in the sketch in IR package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import type {
  SketchPreviewEditability,
  SketchPreviewSourceMetadata,
} from '../../src/index.js';

describe('sketch preview metadata contract', () => {
  it('represents source expressions, exact ranges, and conversion losses', () => {
    const expression = {
      text: 'width / 2',
      range: { startLine: 2, startCol: 21, endLine: 2, endCol: 30 },
    };
    const source = {
      declaration: {
        text: 'sketch plate = rect(width / 2, 10);',
        range: { startLine: 2, startCol: 1, endLine: 2, endCol: 39 },
      },
      primitiveKind: 'rect',
      fields: { width: expression },
      points: {},
      segments: [],
      placements: [],
      constraints: [],
      dimensions: [],
      labels: [],
    } satisfies SketchPreviewSourceMetadata;
    const editability = {
      kind: 'conversion-required',
      losses: ['An associative offset will be baked.'],
    } satisfies SketchPreviewEditability;

    expect(source.fields.width.text).toBe('width / 2');
    expect(editability.losses).toHaveLength(1);
  });
});
