/**
 * @author Aidan Boissonneault
 * @file run-commands.test.ts
 * @purpose Tests CLI build text and export output behavior.
 * @last-edited November 3, 2026
 */

import type { ExportFileResult } from '@bushscad/compiler/node';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CliOptions } from '../../src/commands/arguments/types.js';
import { writeBuildText } from '../../src/cli/runBuild.js';
import { runExport } from '../../src/cli/runExport.js';
import { exportWithDefaultCompiler } from '../../src/cli/default-compiler.js';
import { writeExportBuffers } from '@bushscad/compiler/node';
import { writeDrawingFiles } from '../../src/cli/writeDrawingFiles.js';

vi.mock('../../src/cli/default-compiler.js', () => ({
  exportWithDefaultCompiler: vi.fn(),
}));
vi.mock('../../src/cli/writeDrawingFiles.js', () => ({
  writeDrawingFiles: vi.fn(() => []),
}));
vi.mock('@bushscad/compiler/node', () => ({
  writeExportBuffers: vi.fn(() => ['part.step']),
}));

afterEach(() => vi.restoreAllMocks());

describe('CLI command output', () => {
  it('writes successful build summaries and drawing paths', () => {
    const output = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    writeBuildText(
      { filePath: 'part.bscd' } as CliOptions,
      { ok: true, elapsedMs: 12 } as never,
      [],
      [{ path: 'part.svg' }] as never,
    );

    expect(output.mock.calls.flat().join('')).toContain('all assertions passed');
    expect(output.mock.calls.flat().join('')).toContain('Wrote part.svg');
  });

  it('writes artifacts and drawings in export JSON responses', async () => {
    const output = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.mocked(exportWithDefaultCompiler).mockResolvedValue({
      ok: true,
      program: { ops: [], parts: [], baseUnitMm: 1, workplane: 'XY' },
      buffers: [{ name: 'part.step', data: new ArrayBuffer(4) }],
      drawings: [],
      env: [],
      elapsedMs: 6,
    } as ExportFileResult);
    vi.mocked(writeExportBuffers).mockReturnValue(['part.step']);
    vi.mocked(writeDrawingFiles).mockReturnValue([]);

    const exitCode = await runExport({
      filePath: 'part.bscd',
      env: {},
      format: 'step',
      out: null,
      check: false,
      build: false,
      json: true,
    });

    expect(exitCode).toBe(0);
    expect(output.mock.calls.flat().join('')).toContain('"artifacts"');
    expect(writeExportBuffers).toHaveBeenCalledWith(
      [{ name: 'part.step', data: expect.any(ArrayBuffer) }],
      { sourceFile: 'part.bscd', format: 'step', out: null },
    );
  });
});
