/**
 * @author Aidan Boissonneault
 * @file display-number.test.ts
 * @purpose Tests display number behavior in the shared in IR package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import { compactSketchNumber } from '../../src/sketch/sketchPreviewGeometry.js';

describe('display number formatting', () => {
  it.each([
    [12, '12'],
    [12.34567, '12.346'],
    [-12.34567, '-12.346'],
    [12.3, '12.3'],
    [0.012345, '0.012'],
    [0.000123456, '0.000123'],
    [-0.000123456, '-0.000123'],
    [0, '0'],
  ])('formats %s as %s', (value, expected) => {
    expect(compactSketchNumber(value)).toBe(expected);
  });
});
