/**
 * @author Aidan Boissonneault
 * @file shape-imports.test.ts
 * @purpose Tests shape imports behavior in the pipeline in compiler package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import { compileDocument, normalizePath } from '../../src/index';

describe('compiler shape imports', () => {
  it('loads STL shape assets and preserves their import format', () => {
    const filePath = normalizePath('C:\\workspace\\main.bscd');
    const stlPath = normalizePath('C:\\workspace\\vendor\\base.stl');
    const source = `
import shape base = './vendor/base.stl';

place(base);
`;

    const result = compileDocument({
      source,
      filePath,
      fileMap: { [filePath]: source },
      assetMap: { [stlPath]: new Uint8Array([1, 2, 3]) },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.assets.shapes).toHaveLength(1);
    expect(result.assets.shapes[0]).toMatchObject({
      name: 'base',
      sourcePath: stlPath,
      format: 'stl',
    });
    expect(result.program.ops).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'importShape',
          name: 'base',
          format: 'stl',
        }),
        expect.objectContaining({
          kind: 'alignShape',
          name: 'base',
        }),
      ]),
    );
  });

  it('allows imported shape refs to use planar face predicates', () => {
    const filePath = normalizePath('C:\\workspace\\main.bscd');
    const stepPath = normalizePath('C:\\workspace\\vendor\\base.step');
    const source = `
import shape base = './vendor/base.step';

ref wrapped extends base {
  @top = @largest_planar;
  @small = @smallest_planar;
};

part p {
  place(wrapped);
}
`;

    const result = compileDocument({
      source,
      filePath,
      fileMap: { [filePath]: source },
      assetMap: { [stepPath]: new Uint8Array([1, 2, 3]) },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.program.ops).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'importShape',
          name: 'base',
          format: 'step',
        }),
      ]),
    );
  });
});
