/**
 * @author Aidan Boissonneault
 * @file surface-modeling.test.ts
 * @purpose Tests surface modeling behavior in the core in resolver package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import { resolveErrors, resolveOk } from './test-support.js';

describe('surface modeling', () => {
  it('resolves fill, offset_surface, and thicken', () => {
    resolveOk(`
sketch profile = rect(20, 10);
surface cap = fill(profile);
surface offset_cap = offset_surface(cap, 2);
obj solid_cap = thicken(offset_cap, 1.5);
`);
  });

  it('rejects undefined surface refs in offset and thicken', () => {
    const errors = resolveErrors(`
surface offset_cap = offset_surface(missing, 2);
obj solid_cap = thicken(missing, 1.5);
`);
    expect(errors).toEqual(
      expect.arrayContaining([
        "Undefined surface 'missing' in offset_surface",
        "Undefined surface 'missing' in thicken",
      ]),
    );
  });

  it('rejects open surfaces where solid objects are required', () => {
    const errors = resolveErrors(`
sketch profile = rect(20, 10);
surface cap = fill(profile);
part p {
  shell(cap, 1);
}
`);
    expect(errors).toContain(
      "Open surface 'cap' cannot be used as a solid object in shell",
    );
  });
});
