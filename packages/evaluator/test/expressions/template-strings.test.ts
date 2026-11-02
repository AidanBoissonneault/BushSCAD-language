/**
 * @author Aidan Boissonneault
 * @file template-strings.test.ts
 * @purpose Tests template strings behavior in the expressions in evaluator package.
 * @last-edited October 6, 2026
 */

import type { IRSketch } from '@bushscad/ir';
import { describe, expect, it } from 'vitest';
import { evalOk } from '../core/test-support.js';

describe('template string evaluation', () => {
  it('interpolates expressions left-to-right with TypeScript coercion', () => {
    const source = [
      'var width = 12;',
      'var enabled = true;',
      'var values = [1, 2, 3];',
      'var label = `W=${width * 2}; enabled=${enabled}; values=${values}`;',
      'sketch text = word(label, size: 5);',
    ].join('\n');
    const sketch = evalOk(source).program.ops[0] as IRSketch;

    expect(sketch.primitive).toMatchObject({
      kind: 'word',
      text: 'W=24; enabled=true; values=1,2,3',
    });
  });

  it('supports nesting, multiline text, and escaped interpolation', () => {
    const source = [
      'var value = 3;',
      'var label = `first',
      'second \\${value} ${`nested ${value + 1}`}`;',
      'sketch text = word(label, size: 5);',
    ].join('\n');
    const sketch = evalOk(source).program.ops[0] as IRSketch;

    expect(sketch.primitive).toMatchObject({
      kind: 'word',
      text: 'first\nsecond ${value} nested 4',
    });
  });
});
