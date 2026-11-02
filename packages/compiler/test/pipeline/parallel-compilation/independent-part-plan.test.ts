/**
 * @author Aidan Boissonneault
 * @file independent-part-plan.test.ts
 * @purpose Tests independent part plan behavior in the pipeline parallel compilation in compiler package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import { planIndependentPartCompilation } from '../../../src/index.js';
import { compile } from '../test-support.js';

/**
 * Handles plan in the pipeline parallel compilation flow.
 */
function plan(source: string) {
  const compiled = compile(source);
  expect(compiled.ok).toBe(true);
  if (!compiled.ok) throw new Error(compiled.errors[0]?.message);
  return planIndependentPartCompilation(compiled.program, 'parts.bscd');
}

describe('independent whole-part planning', () => {
  it('creates source-ordered batches for independent explicit parts', () => {
    const result = plan(`
part first { obj body = cube([10, 10, 10]); }
part second { obj body = sphere(5); }
`);
    expect(result.eligible).toBe(true);
    if (!result.eligible) return;
    expect(result.batches.map((batch) => batch.partName)).toEqual([
      'first',
      'second',
    ]);
    expect(result.batches.map((batch) => batch.sourceIndex)).toEqual([0, 1]);
    expect(
      result.batches.every((batch) => batch.program.ops[0]?.kind === 'part'),
    ).toBe(true);
  });

  it('keeps cross-part dependency chains on the classic route', () => {
    const result = plan(`
part housing { obj body = cube([10, 10, 10]); }
part cap { obj body = cube([4, 4, 2], @housing.top.center); }
`);
    expect(result).toEqual({
      eligible: false,
      reason: "part 'cap' has cross-part dependencies",
    });
  });

  it('keeps top-level geometry on the classic route', () => {
    const result = plan(`
obj root = cube([2, 2, 2]);
part explicit { obj body = sphere(2); }
`);
    expect(result).toEqual({
      eligible: false,
      reason: 'top-level geometry is present',
    });
  });
});
