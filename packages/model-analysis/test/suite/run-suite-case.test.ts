/**
 * @author Aidan Boissonneault
 * @file run-suite-case.test.ts
 * @purpose Tests one suite case's analysis and report mapping.
 * @last-edited November 3, 2026
 */

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { ModelAnalysisResult } from '../../src/types/types.js';
import { analyzeModel } from '../../src/analysis/modelAnalysis.js';
import { runSuiteCase } from '../../src/suite/runSuite.js';
import type {
  SuiteCaseManifest,
  SuiteRunOptions,
} from '../../src/suite/suiteTypes.js';

vi.mock('../../src/analysis/modelAnalysis.js', () => ({
  analyzeModel: vi.fn(),
}));

describe('model analysis suite case', () => {
  it('preserves source, analysis failures, and case metadata', async () => {
    const suiteRoot = resolve('test/fixtures');
    const outDir = resolve('test-output');
    const entry: SuiteCaseManifest = {
      id: 'invalid-shape',
      title: 'Invalid shape',
      description: 'Rejected fixture',
      file: 'invalid-shape.bscd',
      capabilities: ['primitives'],
      env: { width: '12' },
    };
    const options: SuiteRunOptions = {
      suiteRoot,
      outDir,
      width: 700,
      height: 500,
    };
    const failure: ModelAnalysisResult = {
      ok: false,
      filePath: entry.file,
      env: {},
      elapsedMs: 8,
      errors: [
        {
          message: 'Unsupported primitive',
          span: { file: entry.file, line: 2, col: 4 },
        },
      ],
      occtTraceEvents: [],
      screenshots: [],
    };
    vi.mocked(analyzeModel).mockResolvedValue(failure);

    const result = await runSuiteCase(entry, suiteRoot, outDir, options);
    const fixtureSource = await readFile(resolve(suiteRoot, entry.file), 'utf8');

    expect(result).toMatchObject({
      id: entry.id,
      title: entry.title,
      status: 'failed',
      capabilities: ['primitives'],
      errors: failure.errors,
      source: fixtureSource,
      artifactDirectory: expect.stringContaining('cases'),
    });
    expect(analyzeModel).toHaveBeenCalledWith(
      expect.objectContaining({
        filePath: expect.stringContaining(entry.file),
        rootPath: suiteRoot,
        outDir: expect.stringContaining('invalid-shape'),
        env: entry.env,
        width: options.width,
        height: options.height,
      }),
    );
  });
});
