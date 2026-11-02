/**
 * @author Aidan Boissonneault
 * @file font-imports.test.ts
 * @purpose Tests font imports behavior in the core in resolver package.
 * @last-edited October 6, 2026
 */

import { parse } from '@bushscad/parser';
import { describe, expect, it } from 'vitest';
import { resolve } from '../../src/index.js';
import { noFiles, resolveErrorsWithAssets } from './test-support.js';

describe('font imports', () => {
  it('resolves valid imported font assets', () => {
    const parsed = parse(
      "font brand = import './fonts/Brand.ttf';",
      'C:/workspace/main.bscd',
    );
    const result = resolve(
      parsed.ast,
      'C:/workspace/main.bscd',
      noFiles,
      (path) =>
        path === 'C:/workspace/fonts/Brand.ttf' ? new Uint8Array([1]) : null,
    );

    expect(result.errors).toHaveLength(0);
    const stmt = result.ast.statements[0];
    expect(stmt.kind).toBe('fontImport');
    if (stmt.kind === 'fontImport') {
      expect(stmt.resolvedPath).toBe('C:/workspace/fonts/Brand.ttf');
      expect(stmt.fsPath).toContain('/fonts/imported/');
    }
  });

  it('rejects unsupported font extensions', () => {
    const errors = resolveErrorsWithAssets(
      "font brand = import './fonts/Brand.txt';",
      () => new Uint8Array([1]),
    );
    expect(errors[0]).toContain('must be a .ttf or .otf file');
  });

  it('reports missing imported font files', () => {
    const errors = resolveErrorsWithAssets(
      "font brand = import './fonts/Missing.ttf';",
      () => null,
    );
    expect(errors[0]).toContain("Cannot load font './fonts/Missing.ttf'");
  });
});
