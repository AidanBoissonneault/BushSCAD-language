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

  it('rejects unknown, out-of-root, and operation-specific fields', () => {
    expect(() => parseCompilerRequest({ ...preview, unknown: true })).toThrow(
      'Unknown',
    );
    expect(() =>
      parseCompilerRequest({
        ...preview,
        overlays: {
          [resolve(projectRoot, '../other/injected.bscd')]:
            'part injected {}',
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
