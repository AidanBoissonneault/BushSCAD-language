/**
 * @author Aidan Boissonneault
 * @file error-recovery-no-infinite-loops.test.ts
 * @purpose Tests error recovery no infinite loops behavior in the core in parser package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import { parse } from '../../src/core/parser.js';

describe('error recovery — no infinite loops', () => {
  it('removed tag syntax in an obj anchor block does not hang', () => {
    // Regression: object block recovery over-consumed the block's },
    // leaving the component's } as a stray top-level RBRACE that made
    // parseProgram() loop forever.
    const result = parse(
      `part p {
  obj base = extrude(sketch, 10) {
    tag top: sketch.top;
    tag varname =
  }
}`,
      'test.bscd',
    );
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('removed tag syntax as a plain component statement does not hang', () => {
    const result = parse(
      `part p {
  sketch base = rect(10, 10);
  obj base = extrude(base, 10);
  tag varname =
}`,
      'test.bscd',
    );
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('anchor with = instead of : does not hang', () => {
    const result = parse(
      `part p {
  sketch base = rect(10, 10);
  obj base = extrude(base, 10);
  anchor center =
}`,
      'test.bscd',
    );
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
