/**
 * @author Aidan Boissonneault
 * @file build-failure-result.test.ts
 * @purpose Tests OCCT bridge build failure result handling.
 * @last-edited November 3, 2026
 */

import { describe, expect, it } from 'vitest';
import { buildFailureResult } from '../../src/bridge/build-failure-result.js';
import { occtError } from '../../src/core/occt-errors.js';
import { createOcctBuildTrace } from '../../src/operations/build-trace.js';

const span = { file: 'fixture.bscd', line: 2, col: 4 };

describe('OCCT build failure handling', () => {
  it('returns authored OCCT errors with their source span and trace', () => {
    const trace = createOcctBuildTrace();
    const error = occtError('invalid profile', span);

    const result = buildFailureResult(error, trace, Date.now());

    expect(result).toMatchObject({ ok: false, error });
    expect(trace.events[0]).toMatchObject({
      kind: 'build-error',
      message: 'invalid profile',
      span,
    });
  });

  it('records and rethrows unexpected runtime failures', () => {
    const trace = createOcctBuildTrace();
    const error = new Error('runtime fault');

    expect(() => buildFailureResult(error, trace, Date.now())).toThrow(error);
    expect(trace.events[0]).toMatchObject({
      kind: 'build-error',
      message: 'runtime fault',
    });
  });

  it('converts non-Error failures to trace text before rethrowing', () => {
    const trace = createOcctBuildTrace();
    expect(() => buildFailureResult('runtime fault', trace, Date.now())).toThrow(
      'runtime fault',
    );
    expect(trace.events[0]).toMatchObject({
      kind: 'build-error',
      message: 'runtime fault',
    });
  });
});
