/**
 * @author Aidan Boissonneault
 * @file node-font-resolution.test.ts
 * @purpose Tests node font resolution behavior in the platform node in compiler package.
 * @last-edited October 6, 2026
 */

import { copyFileSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CompileAssets, IRProgram, IRSketch } from '@bushscad/ir';
import { afterEach, describe, expect, it } from 'vitest';
import {
  cssFontFamilies,
  resolveNodeFonts,
} from '../../../../src/platform/node/fonts/resolve-node-fonts.js';
import { fontFamilyNames } from '../../../../src/platform/node/fonts/font-name-table.js';

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

describe('Node font resolution', () => {
  it('parses CSS-style ordered family stacks', () => {
    expect(
      cssFontFamilies('\'Missing, Display\', "Noto Sans", sans-serif'),
    ).toEqual(['Missing, Display', 'Noto Sans', 'sans-serif']);
  });

  it('reads the family name from a bundled OpenType font', () => {
    const bytes = new Uint8Array(readFileSync(bundledFontPath()));
    expect(fontFamilyNames(bytes)).toContain('Noto Sans');
  });

  it('prefers a font file in the workspace and emits it as an OCCT asset', () => {
    const workspace = mkdtempSync(join(tmpdir(), 'bushscad-font-'));
    temporaryDirectories.push(workspace);
    const workspaceFont = join(workspace, 'Brand.ttf');
    copyFileSync(bundledFontPath(), workspaceFont);
    const program = wordProgram("'Noto Sans', sans-serif");
    const assets: CompileAssets = { fonts: [], shapes: [] };

    resolveNodeFonts(program, assets, workspace);

    const sketch = program.ops[0] as IRSketch;
    expect(sketch.primitive).toMatchObject({
      kind: 'word',
      font: {
        kind: 'fontAsset',
        name: 'Noto Sans',
        sourcePath: workspaceFont,
      },
    });
    expect(assets.fonts).toHaveLength(1);
    expect(assets.fonts[0]?.data.byteLength).toBeGreaterThan(100_000);
  });
});

/**
 * Handles bundled font path in the platform node flow.
 */
function bundledFontPath(): string {
  return resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../../../../assets/fonts/NotoSans-Regular.ttf',
  );
}

/**
 * Handles word program in the platform node flow.
 */
function wordProgram(font: string): IRProgram {
  return {
    ops: [
      {
        kind: 'sketch',
        name: 'label',
        primitive: {
          kind: 'word',
          text: 'VS Code',
          size: 8,
          font,
          align: 'center',
        },
        placement: null,
        span: { file: 'main.bscd', line: 4, col: 1 },
      },
    ],
    parts: [],
    baseUnitMm: 1,
  };
}
