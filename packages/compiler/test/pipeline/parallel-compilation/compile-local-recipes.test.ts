/**
 * @author Aidan Boissonneault
 * @file compile-local-recipes.test.ts
 * @purpose Tests compile local recipes behavior in the pipeline parallel compilation in compiler package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import { CompileLocalRecipeRegistry } from '../../../src/pipeline/parallel-compilation/compile-local-recipes.js';

describe('compile-local recipe collision verification', () => {
  it('reuses canonical matches but separates unequal digest collisions', () => {
    const registry = new CompileLocalRecipeRegistry();
    const first = registry.intern({
      digest: 'forced-collision',
      canonical: '{"radius":10}',
      cacheSafe: true,
    });
    const repeat = registry.intern({
      digest: 'forced-collision',
      canonical: '{"radius":10}',
      cacheSafe: true,
    });
    const collision = registry.intern({
      digest: 'forced-collision',
      canonical: '{"radius":11}',
      cacheSafe: true,
    });

    expect(first).toEqual({
      key: 'forced-collision',
      cacheHit: false,
      collision: false,
    });
    expect(repeat).toMatchObject({ key: first.key, cacheHit: true });
    expect(collision).toEqual({
      key: 'forced-collision:collision:1',
      cacheHit: false,
      collision: true,
    });
  });
});
