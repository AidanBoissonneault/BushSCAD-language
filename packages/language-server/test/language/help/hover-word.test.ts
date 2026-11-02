/**
 * @author Aidan Boissonneault
 * @file hover-word.test.ts
 * @purpose Tests hover word behavior in the language help in language server package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import { hoverWordAtPosition } from '../../../src/language/help/hover-word.js';

describe('documented hover token ranges', () => {
  it('selects an entire hyphenated easing option from any segment', () => {
    const source = 'curve(ease-in-out, 0, 1)';
    for (const col of [8, 13, 16]) {
      expect(hoverWordAtPosition(source, { line: 1, col })).toEqual({
        word: 'ease-in-out',
        start: { line: 1, col: 7 },
        end: { line: 1, col: 18 },
      });
    }
  });
  it('selects only an explicit unit suffix under the cursor', () => {
    expect(
      hoverWordAtPosition('var length = 25mm;', { line: 1, col: 16 }),
    ).toEqual({
      word: 'mm',
      start: { line: 1, col: 16 },
      end: { line: 1, col: 18 },
    });
    expect(
      hoverWordAtPosition('var length = 25mm;', { line: 1, col: 14 }).word,
    ).toBe('25mm');
  });
  it('retains ordinary identifiers without treating subtraction as a compound name', () => {
    expect(hoverWordAtPosition('width-height', { line: 1, col: 9 }).word).toBe(
      'height',
    );
  });
});
