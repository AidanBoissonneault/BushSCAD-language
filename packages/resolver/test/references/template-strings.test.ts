/**
 * @author Aidan Boissonneault
 * @file template-strings.test.ts
 * @purpose Tests template strings behavior in the references in resolver package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import { resolveErrors, resolveOk } from '../core/test-support.js';

describe('template string resolution', () => {
  it('resolves names in substitutions and nested templates', () => {
    resolveOk('var width = 10; var label = `size ${width}: ${`x${width}`}`;');
  });

  it('reports undefined names inside substitutions', () => {
    expect(resolveErrors('var label = `size ${missing}`;')).toContain(
      "Undefined variable 'missing'",
    );
  });
});
