/**
 * @author Aidan Boissonneault
 * @file render-script.test.ts
 * @purpose Tests render script behavior in the rendering in model analysis package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import { renderScript } from '../../src/rendering/renderScript.js';

describe('model analysis screenshot rendering', () => {
  it('shades faces without drawing triangulation edges', () => {
    const script = renderScript();

    expect(script).toContain('const normal = normalize(cross(');
    expect(script).toContain('shade(tri.color, tri.normal)');
    expect(script).toContain('Math.abs(dot(normal, light))');
    expect(script).not.toContain('ctx.stroke()');
  });
});
