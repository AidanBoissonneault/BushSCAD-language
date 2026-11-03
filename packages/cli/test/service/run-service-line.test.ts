/**
 * @author Aidan Boissonneault
 * @file run-service-line.test.ts
 * @purpose Tests parsing and response handling for one CLI service line.
 * @last-edited November 3, 2026
 */

import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { handleServiceRequest } from '../../src/service/handleServiceRequest.js';
import { handleServiceLine } from '../../src/service/runService.js';
import type { PersistentOcctWorkerPool } from '../../src/service/parallel/persistent-worker-pool.js';

vi.mock('../../src/service/handleServiceRequest.js', () => ({
  handleServiceRequest: vi.fn(),
}));

afterEach(() => vi.restoreAllMocks());

describe('CLI service line handling', () => {
  it('reports malformed JSON to stderr without entering request handling', async () => {
    const errorOutput = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    await handleServiceLine('{broken', {} as PersistentOcctWorkerPool);

    expect(errorOutput.mock.calls.flat().join('')).toContain('Invalid request');
    expect(handleServiceRequest).not.toHaveBeenCalled();
  });

  it('serializes a response for a valid request', async () => {
    const output = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const request = {
      id: 7,
      kind: 'check',
      filePath: resolve('fixture.bscd'),
    };
    vi.mocked(handleServiceRequest).mockResolvedValue({
      id: 7,
      kind: 'check',
      ok: true,
      env: [],
      elapsedMs: 3,
    });

    await handleServiceLine(JSON.stringify(request), {} as PersistentOcctWorkerPool);

    expect(output.mock.calls.flat().join('')).toContain('"id":7');
    expect(handleServiceRequest).toHaveBeenCalledOnce();
  });

  it('converts a request-processing failure into a response error', async () => {
    const output = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.mocked(handleServiceRequest).mockRejectedValue(new Error('worker gone'));

    await handleServiceLine(
      JSON.stringify({
        id: 8,
        kind: 'check',
        filePath: resolve('fixture.bscd'),
      }),
      {} as PersistentOcctWorkerPool,
    );

    expect(output.mock.calls.flat().join('')).toContain('worker gone');
  });
});
