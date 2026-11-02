/**
 * @author Aidan Boissonneault
 * @file message-parser.test.ts
 * @purpose Tests message parser behavior in the dto in cli package.
 * @last-edited October 6, 2026
 */

import { describe, expect, it } from 'vitest';
import { parseServiceMessageLine } from '../../src/dto/message-parser.js';

describe('canonical compiler service message parser', () => {
  it('parses successful responses and pool status messages', () => {
    expect(
      parseServiceMessageLine(
        JSON.stringify({
          id: 1,
          kind: 'check',
          ok: true,
          env: [],
          elapsedMs: 2,
        }),
      ),
    ).toMatchObject({ id: 1, ok: true });
    expect(
      parseServiceMessageLine(
        JSON.stringify({
          kind: 'pool-status',
          status: {
            state: 'ready',
            desiredWorkers: 1,
            warmingWorkers: 0,
            readyWorkers: 1,
            busyWorkers: 0,
            failedWorkers: 0,
            startupMs: 2,
            aggregateWorkerRssBytes: 3,
            peakAggregateWorkerRssBytes: 4,
          },
        }),
      ),
    ).toMatchObject({ kind: 'pool-status', status: { state: 'ready' } });
  });

  it('rejects malformed JSON and incomplete failures', () => {
    expect(() => parseServiceMessageLine('{')).toThrow('invalid JSON');
    expect(() =>
      parseServiceMessageLine(
        JSON.stringify({
          id: 1,
          kind: 'preview',
          ok: false,
          env: [],
          elapsedMs: 0,
        }),
      ),
    ).toThrow('include errors');
  });

  it('validates additive v2 trace identity while retaining legacy events', () => {
    expect(
      parseServiceMessageLine(
        JSON.stringify({
          id: 4,
          kind: 'occt-trace',
          event: {
            kind: 'op-start',
            timestampMs: 10,
            schemaVersion: 2,
            buildId: 'build-4',
            eventId: 'build-4:event-1',
            engine: 'parallel',
            phase: 'operation',
            state: 'running',
          },
        }),
      ),
    ).toMatchObject({ event: { schemaVersion: 2, buildId: 'build-4' } });
    expect(
      parseServiceMessageLine(
        JSON.stringify({
          id: 4,
          kind: 'occt-trace',
          event: { kind: 'op-start', timestampMs: 10 },
        }),
      ),
    ).toMatchObject({ event: { kind: 'op-start' } });
    expect(() =>
      parseServiceMessageLine(
        JSON.stringify({
          id: 4,
          kind: 'occt-trace',
          event: {
            kind: 'op-start',
            timestampMs: 10,
            schemaVersion: 2,
          },
        }),
      ),
    ).toThrow('buildId');
  });
});
