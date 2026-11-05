/**
 * @file strict-statement-terminators.test.ts
 * @purpose Tests semicolon enforcement through the compiler pipeline.
 */

import { describe, expect, it } from 'vitest';
import { compile } from './test-support.js';

describe('compiler statement terminators', () => {
  it('returns a parse diagnostic when a compiled statement omits its semicolon', () => {
    const result = compile(`
part plate {
  sketch profile = rect(10, 8);
  obj body = extrude(profile, 2)
}
`);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.map(({ message }) => message)).toContain(
      "Expected ';' after statement",
    );
  });
});
