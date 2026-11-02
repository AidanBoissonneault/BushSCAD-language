/**
 * @author Aidan Boissonneault
 * @file rectanglePlantCompletions.test.ts
 * @purpose Tests rectangle plant completions behavior in the providers in language server package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import {
  isRectanglePlantSideContext,
  rectanglePlantSideCompletionItems,
} from '../../src/providers/rectanglePlantCompletions.js';

describe('rectangle plant completions', () => {
  it('recognizes a compact rectangle suffix after placement', () => {
    expect(
      isRectanglePlantSideContext(
        'sketch plate = rect(40, 20) at (28, 16) plant b',
      ),
    ).toBe(true);
    expect(
      rectanglePlantSideCompletionItems().map((item) => item.label),
    ).toEqual(['bottom', 'right', 'top', 'left']);
  });

  it('does not replace named path-line completion with rectangle sides', () => {
    expect(
      isRectanglePlantSideContext(
        'sketch plate = path(\n  plant bottom = line((0, 0), (40, 0))',
      ),
    ).toBe(false);
  });

  it('follows rectangle expression precedence exactly', () => {
    expect(
      isRectanglePlantSideContext(
        'sketch plate = (rect(40, 20) at (28, 16)) plant ',
      ),
    ).toBe(true);
    expect(
      isRectanglePlantSideContext(
        'sketch plate = rect(40, 20) + circle(5) plant ',
      ),
    ).toBe(false);
    expect(
      isRectanglePlantSideContext(
        'sketch first = rect(1, 1);\n// sketch fake = rect(2, 2) plant ',
      ),
    ).toBe(false);
  });
});
