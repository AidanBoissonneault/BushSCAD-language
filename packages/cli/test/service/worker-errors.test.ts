/**
 * @author Aidan Boissonneault
 * @file worker-errors.test.ts
 * @purpose Tests worker errors behavior in the service in cli package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import {
  compileErrorFromWorker,
  sourceMappedWorkerError,
  workerErrorMessage,
} from '../../src/service/parallel/worker-errors.js';

describe('parallel worker errors', () => {
  it('preserves a native source span through worker error rehydration', () => {
    const span = {
      file: 'C:/workspace/main.bscd',
      line: 20,
      col: 20,
      endLine: 20,
      endCol: 88,
    };
    const error = sourceMappedWorkerError('Unable to build word sketch', span);

    expect(compileErrorFromWorker(error, 'fallback.bscd')).toEqual({
      message: 'Unable to build word sketch',
      span,
    });
  });

  it('reads messages from plain structured OCCT errors', () => {
    expect(
      workerErrorMessage({
        message: 'font unavailable',
        span: { file: 'main.bscd', line: 7, col: 3 },
      }),
    ).toBe('font unavailable');
  });

  it('uses line one only when a worker provides no source span', () => {
    expect(
      compileErrorFromWorker(new Error('worker exited'), 'main.bscd'),
    ).toMatchObject({
      message: 'worker exited',
      span: { file: 'main.bscd', line: 1, col: 1 },
    });
  });
});
