/**
 * @author Aidan Boissonneault
 * @file m41-language-smoothing.test.ts
 * @purpose Tests m41 language smoothing behavior in the declarations in resolver package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import { parse } from '@bushscad/parser';
import { resolve } from '../../src/index.js';

/**
 * Handles no files in the declarations flow.
 */
const noFiles = () => null;

/**
 * Resolves errors against the current scope and reports unresolved references.
 */
function resolveErrors(source: string): string[] {
  const parsed = parse(source, 'm41.bscd');
  expect(parsed.errors).toEqual([]);
  return resolve(parsed.ast, 'm41.bscd', noFiles).errors.map(
    (error) => error.message,
  );
}

describe('M41 language expectation smoothing resolver', () => {
  it('resolves expressions inside inline sketch and path operands', () => {
    const errors = resolveErrors(`
part p {
  obj base = extrude(rect(missing_width, 40), 10);
  obj swept = sweep(circle(3) along polyline([(0, missing_y, 0), (0, 0, 10)]));
}`);
    expect(errors).toEqual(
      expect.arrayContaining([
        "Undefined variable 'missing_width'",
        "Undefined variable 'missing_y'",
      ]),
    );
  });
});
