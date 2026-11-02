/**
 * @author Aidan Boissonneault
 * @file word-sketch.test.ts
 * @purpose Tests word sketch behavior in the core in evaluator package.
 * @last-edited October 6, 2026
 */

import type { IRSketch } from '@bushscad/ir';
import { describe, expect, it } from 'vitest';
import { evalOk, opsOfKind } from './test-support.js';

describe('word sketch', () => {
  it('resolves text string and literal font string', () => {
    const { program } = evalOk(`
base_unit = mm;
var label = 'HELLO';
part p {
    sketch s = word(label, size: 6, font: 'Times New Roman', align: center);
    obj s = cut(s, 0.5 , @s.top.center);
}
`);
    const sk = opsOfKind<IRSketch>(program.ops, 'sketch')[0];
    expect(sk.primitive).toMatchObject({
      kind: 'word',
      text: 'HELLO',
      size: 6,
      font: 'Times New Roman',
      align: 'center',
    });
  });

  it('resolves font , @a string variable', () => {
    const { program } = evalOk(`
base_unit = mm;
var label_font = 'Arial';
part p {
    sketch s = word('Front', size: 6, font: label_font, align: left);
    obj s = cut(s, 0.5 , @s.top.center);
}
`);
    const sk = opsOfKind<IRSketch>(program.ops, 'sketch')[0];
    expect(sk.primitive).toMatchObject({
      kind: 'word',
      text: 'Front',
      size: 6,
      font: 'Arial',
      align: 'left',
    });
  });

  it('defaults omitted font to sans', () => {
    const { program } = evalOk(`
base_unit = mm;
part p {
    sketch s = word('Front', size: 6);
    obj s = cut(s, 0.5 , @s.top.center);
}
`);
    const sk = opsOfKind<IRSketch>(program.ops, 'sketch')[0];
    expect(sk.primitive).toMatchObject({
      kind: 'word',
      text: 'Front',
      size: 6,
      font: 'sans',
      align: 'center',
    });
  });

  it('resolves imported font references into word IR', () => {
    const { program } = evalOk(`
font brand = import './fonts/Brand.ttf';
part p {
    sketch s = word('Front', size: 6, font: brand, align: left);
    obj s = cut(s, 0.5 , @s.top.center);
}
`);
    const sk = opsOfKind<IRSketch>(program.ops, 'sketch')[0];
    expect(sk.primitive.kind).toBe('word');
    if (sk.primitive.kind === 'word') {
      expect(sk.primitive.font).toMatchObject({
        kind: 'fontAsset',
        name: 'brand',
        sourcePath: 'fonts/Brand.ttf',
      });
    }
  });
});
