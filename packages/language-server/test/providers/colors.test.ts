import { describe, expect, it } from 'vitest';
import { parseHexColorLiteral } from '../../src/providers/colors.js';

describe('parseHexColorLiteral', () => {
  it('expands short RGB and RGBA forms into byte channels', () => {
    expect(parseHexColorLiteral('#3af')).toEqual({
      red: 51,
      green: 170,
      blue: 255,
      alpha: 1,
    });
    expect(parseHexColorLiteral('#3af8')).toEqual({
      red: 51,
      green: 170,
      blue: 255,
      alpha: 136 / 255,
    });
  });

  it('parses full byte pairs and rejects malformed literals', () => {
    expect(parseHexColorLiteral('#12a0ff80')).toEqual({
      red: 18,
      green: 160,
      blue: 255,
      alpha: 128 / 255,
    });
    expect(parseHexColorLiteral('#12a0ff')).toEqual({
      red: 18,
      green: 160,
      blue: 255,
      alpha: 1,
    });
    expect(parseHexColorLiteral('#12')).toBeNull();
    expect(parseHexColorLiteral('#12a0ff80extra')).toBeNull();
  });
});
