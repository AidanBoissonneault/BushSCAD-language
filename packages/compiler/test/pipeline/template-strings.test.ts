/**
 * @author Aidan Boissonneault
 * @file template-strings.test.ts
 * @purpose Tests template strings behavior in the pipeline in compiler package.
 * @last-edited October 6, 2026
 */

import type { IRSketch } from '@bushscad/ir';
import { describe, expect, it } from 'vitest';
import { compile } from './test-support.js';

describe('template string compilation', () => {
  it('carries interpolated strings through the document compiler pipeline', () => {
    const result = compile(
      [
        'var width = 8;',
        'var label = `plate-${width * 2}`;',
        'sketch text = word(label, size: 5);',
      ].join('\n'),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.program.ops[0] as IRSketch).toMatchObject({
      kind: 'sketch',
      primitive: { kind: 'word', text: 'plate-16' },
    });
  });
});
