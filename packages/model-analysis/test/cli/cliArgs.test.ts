/**
 * @author Aidan Boissonneault
 * @file cliArgs.test.ts
 * @purpose Tests cli args behavior in the cli in model analysis package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import { parseArgs } from '../../src/cli/cliArgs.js';

describe('model analysis cli args', () => {
  it('parses analyze args', () => {
    expect(
      parseArgs([
        'analyze',
        'model.bscd',
        '--out',
        'out',
        '--env',
        'height=20',
        '--json',
      ]),
    ).toMatchObject({
      kind: 'analyze',
      filePath: 'model.bscd',
      outDir: 'out',
      env: { height: '20' },
      json: true,
    });
  });

  it('requires compare baseline and output directory', () => {
    expect(parseArgs(['compare', 'model.bscd'])).toEqual({
      kind: 'error',
      message: 'compare requires --baseline <name>',
    });
    expect(
      parseArgs(['compare', 'model.bscd', '--baseline', 'main']),
    ).toEqual({
      kind: 'error',
      message: 'compare requires --out <dir>',
    });
  });

  it('parses the language suite command', () => {
    expect(
      parseArgs(['suite', 'examples/test_suite', '--out', 'suite-output']),
    ).toMatchObject({
      kind: 'suite',
      suiteRoot: 'examples/test_suite',
      outDir: 'suite-output',
    });
    expect(parseArgs(['suite', 'examples/test_suite'])).toEqual({
      kind: 'error',
      message: 'suite requires --out <dir>',
    });
  });
});
