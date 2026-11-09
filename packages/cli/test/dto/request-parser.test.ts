/**
 * @author Aidan Boissonneault
 * @file request-parser.test.ts
 * @purpose Tests request parser behavior in the dto in cli package.
 * @last-edited October 6, 2026
 */

import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  parseCompilerRequest,
  parseServiceRequest,
} from '../../src/dto/request-parser.js';

const projectRoot = resolve('project');
const projectFile = resolve(projectRoot, 'main.bscd');
const preview = {
  kind: 'preview',
  filePath: projectFile,
  rootPath: projectRoot,
};

describe('canonical compiler request parser', () => {
  it('normalizes host requests and preserves unsaved overlays', () => {
    expect(
      parseCompilerRequest({
        ...preview,
        overlays: {
          [resolve(projectRoot, 'imported.bscd')]: 'part imported {}',
        },
        env: { width: '12mm' },
        engine: 'parallel',
      }),
    ).toMatchObject({
      kind: 'preview',
      entrypointMode: 'workspace',
      engine: 'parallel',
      env: { width: '12mm' },
    });
  });

  it('accepts empty string values for environment overrides', () => {
    expect(
      parseCompilerRequest({ ...preview, env: { label: '' } }),
    ).toMatchObject({ env: { label: '' } });
  });

  it('preserves prototype property names at the compiler service boundary', () => {
    const parsed = parseCompilerRequest({
      ...preview,
      env: Object.fromEntries([['__proto__', '']]),
    });

    expect(Object.hasOwn(parsed.env ?? {}, '__proto__')).toBe(true);
    expect(parsed.env?.['__proto__']).toBe('');
  });

  it('rejects unknown, out-of-root, and operation-specific fields', () => {
    expect(() => parseCompilerRequest({ ...preview, unknown: true })).toThrow(
      'Unknown',
    );
    expect(() =>
      parseCompilerRequest({
        ...preview,
        overlays: {
          [resolve(projectRoot, '../other/injected.bscd')]: 'part injected {}',
        },
      }),
    ).toThrow('outside');
    expect(() => parseCompilerRequest({ ...preview, format: 'step' })).toThrow(
      'only valid',
    );
  });

  it('requires a bounded request id at the service boundary', () => {
    expect(parseServiceRequest({ ...preview, id: 7 })).toMatchObject({ id: 7 });
    expect(() => parseServiceRequest(preview)).toThrow('id is required');
  });

  it('accepts a local component cache directory only for previews', () => {
    const componentCacheDirectory = resolve('local-cache');
    expect(
      parseCompilerRequest({ ...preview, componentCacheDirectory }),
    ).toMatchObject({ componentCacheDirectory });
    expect(() =>
      parseCompilerRequest({
        ...preview,
        kind: 'export',
        format: 'step',
        componentCacheDirectory,
      }),
    ).toThrow('only valid for preview');
  });

  it('accepts a bounded maximum component cache size for parallel previews', () => {
    expect(
      parseCompilerRequest({
        ...preview,
        engine: 'parallel',
        componentCacheDirectory: resolve(projectRoot, '.cache'),
        componentCacheMaxSizeMb: 1024,
      }),
    ).toMatchObject({ componentCacheMaxSizeMb: 1024 });
    expect(() =>
      parseCompilerRequest({ ...preview, componentCacheMaxSizeMb: 127 }),
    ).toThrow('128 to 4096 MB');
    expect(() =>
      parseCompilerRequest({
        ...preview,
        engine: 'classic',
        componentCacheMaxSizeMb: 512,
      }),
    ).toThrow('parallel engine');
  });

  it('validates cache breakpoints as bounded in-root preview data', () => {
    const cacheBreakpoints = [
      {
        filePath: resolve(projectRoot, 'library.bscd'),
        line: 12,
        condition: 'i == 2 && width > 5',
      },
    ];
    expect(
      parseCompilerRequest({
        ...preview,
        engine: 'parallel',
        componentCacheDirectory: resolve(projectRoot, '.cache'),
        automaticallyAssignCacheBreakpoints: false,
        cacheBreakpoints,
      }),
    ).toMatchObject({
      cacheBreakpoints,
      automaticallyAssignCacheBreakpoints: false,
    });
    expect(() =>
      parseCompilerRequest({
        ...preview,
        cacheBreakpoints: [
          { filePath: resolve(projectRoot, '../outside.bscd'), line: 1 },
        ],
      }),
    ).toThrow('outside');
    expect(() =>
      parseCompilerRequest({
        ...preview,
        cacheBreakpoints: [{ filePath: projectFile, line: 0 }],
      }),
    ).toThrow('invalid');
  });

  it('allows return-content mode only for drawing exports', () => {
    expect(
      parseCompilerRequest({
        kind: 'exportDrawings',
        filePath: projectFile,
        drawingOutputMode: 'return-content',
      }),
    ).toMatchObject({ drawingOutputMode: 'return-content' });
    expect(() =>
      parseCompilerRequest({
        ...preview,
        drawingOutputMode: 'return-content',
      }),
    ).toThrow('only valid for drawing export');
  });
});
