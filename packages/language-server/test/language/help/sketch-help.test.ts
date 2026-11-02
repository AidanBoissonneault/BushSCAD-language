/**
 * @author Aidan Boissonneault
 * @file sketch-help.test.ts
 * @purpose Tests sketch help behavior in the language help in language server package.
 * @last-edited October 6, 2026
 */

import { parse } from '@bushscad/parser';
import { describe, expect, it } from 'vitest';
import { sketchHelp } from '../../../src/language/help/sketch-help.js';

describe('sketch language help', () => {
  for (const [name, entry] of Object.entries(sketchHelp)) {
    for (const [index, example] of entry.examples.entries()) {
      it(`${name} example ${index + 1} uses supported parser syntax`, () => {
        expect(parse(example, `${name}-help.bscd`).errors).toEqual([]);
      });
    }
  }

  it('distinguishes currently implemented sketch and guide spline forms', () => {
    expect(sketchHelp.spline.behavior?.join(' ')).toContain(
      'exactly two points',
    );
    expect(sketchHelp.polyline.behavior?.join(' ')).toContain(
      'interpolates a B-spline',
    );
    expect(sketchHelp.arc.behavior?.join(' ')).toContain('not arc(from:');
  });

  it('retains compact primitive semantics and canonical side aliases', () => {
    expect(
      sketchHelp.rect.parameters?.map((item) => item.description).join(' '),
    ).toContain('bare identifiers');
    expect(sketchHelp.rect.behavior?.join(' ')).toContain(
      'plant bottom|right|top|left',
    );
    expect(sketchHelp.circle.behavior?.join(' ')).toContain('@sketch.radius');
    expect(sketchHelp._.behavior?.join(' ')).toContain(
      'not a general expression',
    );
  });
});
