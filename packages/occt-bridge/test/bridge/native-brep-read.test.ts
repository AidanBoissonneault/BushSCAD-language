/**
 * @author Aidan Boissonneault
 * @file native-brep-read.test.ts
 * @purpose Tests validation of native BRep shape reads in the bridge.
 * @last-edited November 3, 2026
 */

import { describe, expect, it, vi } from 'vitest';
import { readNativeBrepShape } from '../../src/bridge/native-brep-read.js';

describe('native BRep shape reads', () => {
  it('returns the shape after a successful non-null read', () => {
    const shape = { IsNull: vi.fn(() => false) };
    const read = vi.fn(() => true);

    expect(readNativeBrepShape(shape, read, 'read failed')).toBe(shape);
    expect(read).toHaveBeenCalledOnce();
  });

  it.each([
    { readResult: false, isNull: false },
    { readResult: true, isNull: true },
  ])(
    'rejects readResult=$readResult with isNull=$isNull',
    ({ readResult, isNull }) => {
      const shape = { IsNull: vi.fn(() => isNull) };
      const read = vi.fn(() => readResult);

      expect(() => readNativeBrepShape(shape, read, 'read failed')).toThrow(
        'read failed',
      );
    },
  );
});
