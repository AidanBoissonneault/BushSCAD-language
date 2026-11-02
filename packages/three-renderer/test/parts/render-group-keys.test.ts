/**
 * @author Aidan Boissonneault
 * @file render-group-keys.test.ts
 * @purpose Tests render group keys behavior in the parts in three renderer package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import { bodyRenderGroupKey } from '../../src/parts/render-group-keys.js';

describe('bodyRenderGroupKey', () => {
  it('scopes repeated body names by part', () => {
    expect(bodyRenderGroupKey('natural_demo', 'boss')).not.toBe(
      bodyRenderGroupKey('ease_demo', 'boss'),
    );
  });
});
