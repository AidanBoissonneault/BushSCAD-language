/**
 * @author Aidan Boissonneault
 * @file command-runner.test.ts
 * @purpose Tests model-analysis CLI command routing and exit codes.
 * @last-edited November 3, 2026
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { analyzeModel } from '../../src/analysis/modelAnalysis.js';
import { parseArgs } from '../../src/cli/cliArgs.js';
import { runModelAnalysisCommand } from '../../src/cli/command-runner.js';
import type { ModelAnalysisResult } from '../../src/types/types.js';

vi.mock('../../src/analysis/modelAnalysis.js', () => ({
  analyzeModel: vi.fn(),
}));

afterEach(() => vi.restoreAllMocks());

describe('model-analysis CLI command runner', () => {
  it('returns success for help and failure for invalid commands', async () => {
    const errorOutput = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    await expect(
      runModelAnalysisCommand(parseArgs(['--help'])),
    ).resolves.toBe(0);
    await expect(
      runModelAnalysisCommand(parseArgs(['unknown'])),
    ).resolves.toBe(2);
    expect(errorOutput).toHaveBeenCalledTimes(2);
  });

  it('reports analysis failures and returns a failing exit code', async () => {
    const output = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const failure: ModelAnalysisResult = {
      ok: false,
      filePath: 'fixture.bscd',
      env: {},
      elapsedMs: 2,
      errors: [
        {
          message: 'bad model',
          span: { file: 'fixture.bscd', line: 1, col: 1 },
        },
      ],
      occtTraceEvents: [],
      screenshots: [],
    };
    vi.mocked(analyzeModel).mockResolvedValue(failure);

    await expect(
      runModelAnalysisCommand(
        parseArgs(['analyze', 'fixture.bscd', '--out', 'report', '--json']),
      ),
    ).resolves.toBe(1);
    expect(output.mock.calls.flat().join('')).toContain('bad model');
  });
});
