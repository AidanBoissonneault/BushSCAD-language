/**
 * @author Aidan Boissonneault
 * @file font-imports.test.ts
 * @purpose Tests font imports behavior in the pipeline in compiler package.
 * @last-edited October 6, 2026
 */

import type { IRSketch } from '@bushscad/ir';
import { describe, expect, it } from 'vitest';
import { compileDocument, normalizePath } from '../../src/index';
import { compile } from './test-support.js';

describe('compiler font imports', () => {
  it('loads imported font assets and emits font asset refs', () => {
    const filePath = normalizePath('C:\\workspace\\main.bscd');
    const fontPath = normalizePath('C:\\workspace\\fonts\\Brand.ttf');
    const source = `
font brand = import './fonts/Brand.ttf';
part plate {
  sketch label = word('ACME', size: 8, font: brand, align: center);
  obj label = extrude(label, 1);
}
`;
    const result = compileDocument({
      source,
      filePath,
      fileMap: { [filePath]: source },
      assetMap: { [fontPath]: new Uint8Array([1, 2, 3]) },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.assets.fonts).toHaveLength(1);
    expect(result.assets.fonts[0]).toMatchObject({
      name: 'brand',
      sourcePath: fontPath,
    });
    const sketch = result.program.ops.find((op) => op.kind === 'sketch');
    expect(sketch?.primitive.kind).toBe('word');
    if (sketch?.primitive.kind === 'word') {
      expect(sketch.primitive.font).toMatchObject({
        kind: 'fontAsset',
        name: 'brand',
        sourcePath: fontPath,
      });
    }
  });

  it('reports missing font assets at the declaration span', () => {
    const result = compile(`
font brand = import './fonts/Missing.ttf';
part plate {
  sketch label = word('ACME', size: 8, font: brand);
  obj label = extrude(label, 1);
}
`);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0].message).toContain(
      "Cannot load font './fonts/Missing.ttf'",
    );
    expect(result.errors[0].span.line).toBe(2);
  });

  it('rejects unsupported font asset extensions', () => {
    const result = compile(`
font brand = import './fonts/Brand.txt';
part plate {
  sketch label = word('ACME', size: 8, font: brand);
  obj label = extrude(label, 1);
}
`);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0].message).toContain('must be a .ttf or .otf file');
  });

  it('supports private imported fonts inside imported exported components', () => {
    const mainPath = normalizePath('C:\\workspace\\main.bscd');
    const libPath = normalizePath('C:\\workspace\\label.bscd');
    const fontPath = normalizePath('C:\\workspace\\fonts\\Brand.ttf');
    const source = `
import { label } from './label.bscd';
part plate {
  sketch base = rect(20, 10);
  obj base = extrude(base, 2);
  place(label, @base.top.center);
}
`;
    const lib = `
font brand = import './fonts/Brand.ttf';
export part label {
  sketch text = word('ACME', size: 4, font: brand);
  obj text = extrude(text, 1);
}
`;
    const result = compileDocument({
      source,
      filePath: mainPath,
      fileMap: {
        [mainPath]: source,
        [libPath]: lib,
      },
      assetMap: { [fontPath]: new Uint8Array([1]) },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.assets.fonts).toHaveLength(1);
    const wordSketch = result.program.ops.find(
      (op): op is IRSketch =>
        op.kind === 'sketch' && op.primitive.kind === 'word',
    );
    expect(wordSketch?.primitive.kind).toBe('word');
    if (wordSketch?.primitive.kind === 'word') {
      expect(wordSketch.primitive.font).toMatchObject({
        kind: 'fontAsset',
        name: 'brand',
      });
    }
  });
});
