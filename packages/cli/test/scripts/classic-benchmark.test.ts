/**
 * @author Aidan Boissonneault
 * @file classic-benchmark.test.ts
 * @purpose Tests classic compiler benchmark sequencing and report output.
 * @last-edited November 3, 2026
 */

import type { MeshData } from '@bushscad/ir';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { runClassicBenchmark } from '../../../../scripts/parallel-compilation/classic-benchmark.js';

describe('classic compilation benchmark', () => {
  it('measures compilation, cold and warm previews, then writes a report', async () => {
    const compileFileToIr = vi.fn().mockReturnValue({
      ok: true,
      elapsedMs: 2,
      program: { ops: [{ kind: 'part' }] },
    });
    const previewFile = vi.fn().mockResolvedValue({
      ok: true,
      elapsedMs: 4,
      meshes: [mesh()],
      occtTraceEvents: [],
    });
    const writeJsonReport = vi.fn().mockResolvedValue(undefined);
    const dependencies = {
      compileFileToIr,
      previewFile,
      writeJsonReport,
    } as unknown as NonNullable<Parameters<typeof runClassicBenchmark>[1]>;

    await runClassicBenchmark(
      ['--file', 'fixture.bscd', '--out', 'benchmark.json'],
      dependencies,
    );

    expect(compileFileToIr).toHaveBeenCalledWith({
      filePath: resolve('fixture.bscd'),
    });
    expect(previewFile).toHaveBeenCalledTimes(2);
    expect(writeJsonReport).toHaveBeenCalledWith(
      resolve('benchmark.json'),
      expect.objectContaining({
        filePath: resolve('fixture.bscd'),
        check: expect.objectContaining({ operationCount: 1 }),
        coldPreview: expect.objectContaining({ meshCount: 1 }),
        warmPreview: expect.objectContaining({ meshCount: 1 }),
      }),
    );
  });

  it('rejects invocations without a source model', async () => {
    await expect(runClassicBenchmark([])).rejects.toThrow('Missing required --file');
  });
});

/** Creates a small mesh used to calculate benchmark summary metrics. */
function mesh(): MeshData {
  return {
    partName: 'part',
    color: '#336699',
    vertices: new Float32Array([0, 0, 0]),
    normals: new Float32Array([0, 0, 1]),
    indices: new Uint32Array([0, 1, 2]),
  };
}
