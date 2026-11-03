/**
 * @author Aidan Boissonneault
 * @file symbols.test.ts
 * @purpose Tests source symbol collection for language server providers.
 * @last-edited November 3, 2026
 */

import { describe, expect, it } from 'vitest';
import { collectSymbolsForSource } from '../../src/providers/symbols.js';

describe('source symbols', () => {
  it('collects named declarations at their source positions', () => {
    const symbols = collectSymbolsForSource(
      `var width = 12;
export fn mount_hole(d = 3) {
  sketch hole_profile = circle(d);
  obj hole = cut(hole_profile, through);
}`,
      '/project/main.bscd',
    );

    expect(symbols.map(({ name, kind }) => [name, kind])).toEqual([
      ['width', 'var'],
      ['hole_profile', 'sketch'],
      ['hole', 'obj'],
      ['mount_hole', 'fn'],
    ]);
    expect(symbols[0]).toMatchObject({
      detail: 'var width',
      value: '12',
      uri: 'file:///project/main.bscd',
      range: { start: { line: 1, col: 5 }, end: { line: 1, col: 10 } },
    });
    expect(symbols.find(({ name }) => name === 'mount_hole')).toMatchObject({
      kind: 'fn',
    });
  });
});
