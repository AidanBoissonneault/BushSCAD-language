import { describe, expect, it } from 'vitest';
import { ignoredTokenOffsets } from '../../src/providers/semanticTokens.js';

describe('ignored semantic token offsets', () => {
  it('marks comments and quoted strings while leaving code and substitutions active', () => {
    const source = 'drawing "view" // part\n`sketch ${range}`';
    const ignored = ignoredTokenOffsets(source);
    const marked = (text: string): boolean[] => {
      const start = source.indexOf(text);
      return ignored.slice(start, start + text.length);
    };

    expect(marked('drawing')).toEqual(Array(7).fill(false));
    expect(marked('view')).toEqual(Array(4).fill(true));
    expect(marked('part')).toEqual(Array(4).fill(true));
    expect(marked('sketch')).toEqual(Array(6).fill(true));
    expect(marked('range')).toEqual(Array(5).fill(false));
  });
});
