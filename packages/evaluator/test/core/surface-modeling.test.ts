/**
 * @author Aidan Boissonneault
 * @file surface-modeling.test.ts
 * @purpose Tests surface modeling behavior in the core in evaluator package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import { evalOk, opsOfKind } from './test-support.js';

describe('surface modeling', () => {
  it('emits surface fill, offset, and thicken IR', () => {
    const { program } = evalOk(`
sketch profile = rect(20, 10);
surface cap = fill(profile);
surface offset_cap = offset_surface(cap, 2);
obj solid_cap = thicken(offset_cap, 1.5);
`);
    expect(opsOfKind(program.ops, 'surface')).toEqual([
      expect.objectContaining({ name: 'cap', boundary: 'profile' }),
    ]);
    expect(opsOfKind(program.ops, 'surfaceOffset')).toEqual([
      expect.objectContaining({
        name: 'offset_cap',
        source: 'cap',
        distance: 2,
      }),
    ]);
    expect(opsOfKind(program.ops, 'surfaceThicken')).toEqual([
      expect.objectContaining({
        objName: 'solid_cap',
        surfaceName: 'offset_cap',
        thickness: 1.5,
      }),
    ]);
  });
});
