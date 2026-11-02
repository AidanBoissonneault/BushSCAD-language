/**
 * @author Aidan Boissonneault
 * @file parallel-worker.integration.test.ts
 * @purpose Tests parallel worker integration behavior in the service in cli package.
 * @last-edited October 6, 2026
 */

import type { ChildProcessWithoutNullStreams } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { PersistentOcctWorkerPool } from '../../src/service/parallel/persistent-worker-pool.js';
import type { ParallelPoolStatus } from '../../src/service/parallel/worker-protocol.js';
import {
  interactionContract,
  meshContract,
} from '../fixtures/parallel-preview-contract.js';
import {
  parallelCliEntry,
  poolStatusCount,
  requestPreview,
  startParallelService,
  waitFor,
} from '../fixtures/parallel-service-harness.js';

const runIntegration = process.env['BUSHSCAD_RUN_OCCT_INTEGRATION'] === '1';
const integrationIt = runIntegration ? it : it.skip;
const testDir = dirname(fileURLToPath(import.meta.url));
const componentFixture = resolve(
  testDir,
  '../fixtures/parallel-components-p4.bscd',
);
const invalidFontFixture = resolve(
  testDir,
  '../fixtures/invalid-font-span.bscd',
);
let service: ChildProcessWithoutNullStreams | undefined;
let pool: PersistentOcctWorkerPool | undefined;

afterEach(() => {
  service?.kill();
  pool?.dispose();
});

describe('persistent parallel OCCT service', () => {
  integrationIt(
    'matches classic with one worker and reuses the pre-request warm runtime',
    async () => {
      const started = await startParallelService();
      service = started.process;
      const { messages } = started;
      const warmingMessages = poolStatusCount(messages, 'warming');

      const parallel = await requestPreview(service, messages, 1);
      const classic = await requestPreview(service, messages, 2, 'classic');
      expect(parallel.ok).toBe(true);
      expect(classic.ok).toBe(true);
      if (!parallel.ok || !classic.ok) return;
      expect(parallel.meshes).toEqual(classic.meshes);
      expect(parallel.interaction).toEqual(classic.interaction);
      expect(parallel.validations).toEqual(classic.validations);
      expect(parallel.joints).toEqual(classic.joints);
      expect(parallel.compilerMetrics?.engine).toBe('parallel');
      expect(classic.compilerMetrics?.engine).toBe('classic');
      expect(classic.compilerMetrics?.workerStartupMs).toBe(
        parallel.compilerMetrics?.workerStartupMs,
      );
      expect(parallel.compilerMetrics).toMatchObject({
        schedulerTaskCount: 2,
        workerCpuMs: expect.any(Number),
        workerUtilization: expect.any(Number),
        aggregateWorkerRssBytes: expect.any(Number),
        peakWorkerRssBytes: expect.any(Number),
      });
      expect(parallel.compilerMetrics?.workerCpuMs).toBeGreaterThan(0);
      expect(parallel.compilerMetrics?.aggregateWorkerRssBytes).toBeGreaterThan(
        0,
      );
      expect(poolStatusCount(messages, 'warming')).toBe(warmingMessages);
    },
    60_000,
  );

  integrationIt(
    'preserves a text geometry failure at the authored sketch line',
    async () => {
      const started = await startParallelService();
      service = started.process;
      const parallel = await requestPreview(
        service,
        started.messages,
        20,
        undefined,
        false,
        invalidFontFixture,
      );
      expect(parallel.ok).toBe(false);
      if (parallel.ok) return;
      expect(parallel.errors[0]).toMatchObject({
        span: { file: invalidFontFixture.replace(/\\/g, '/'), line: 3 },
      });
    },
    60_000,
  );

  integrationIt(
    'contains a worker crash and restores the configured ready count',
    async () => {
      const statuses: ParallelPoolStatus[] = [];
      pool = new PersistentOcctWorkerPool(
        1,
        (status) => statuses.push(status),
        parallelCliEntry,
      );
      pool.warm();
      await waitFor(() => pool?.snapshot().state === 'ready');
      const internal = pool as unknown as {
        slots: { process: { kill(): void } }[];
      };
      internal.slots[0]?.process.kill();
      await waitFor(
        () =>
          statuses.some((status) => status.failedWorkers > 0) &&
          pool?.snapshot().readyWorkers === 1,
      );
      expect(pool.snapshot().state).toBe('ready');
      expect(pool.snapshot().aggregateWorkerRssBytes).toBeGreaterThan(0);
    },
    60_000,
  );

  integrationIt(
    'overlaps independent part trace intervals with two workers',
    async () => {
      const started = await startParallelService(2);
      service = started.process;
      const { messages } = started;
      const response = await requestPreview(
        service,
        messages,
        3,
        undefined,
        true,
      );
      expect(response.ok).toBe(true);
      if (!response.ok) return;
      const starts = response.occtTraceEvents?.filter(
        (event) => event.kind === 'part-start',
      );
      const finishes = response.occtTraceEvents?.filter(
        (event) => event.kind === 'part-success',
      );
      expect(starts).toHaveLength(2);
      expect(finishes).toHaveLength(2);
      expect(starts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            schemaVersion: 2,
            buildId: 'build-3',
            eventId: expect.stringMatching(/^build-3:event-/),
            taskId: expect.stringMatching(/^task-/),
            workerId: expect.stringMatching(/^worker-/),
            engine: 'parallel',
            phase: 'part',
            state: 'running',
          }),
        ]),
      );
      expect(starts?.[1]?.timestampMs).toBeLessThan(
        finishes?.[0]?.timestampMs ?? 0,
      );
    },
    60_000,
  );

  integrationIt(
    'overlaps component preparation and preserves ordered single-part output',
    async () => {
      const started = await startParallelService(2);
      service = started.process;
      const { messages } = started;

      const parallel = await requestPreview(
        service,
        messages,
        4,
        undefined,
        true,
        componentFixture,
      );
      const classic = await requestPreview(
        service,
        messages,
        5,
        'classic',
        false,
        componentFixture,
      );
      expect(parallel.ok).toBe(true);
      expect(classic.ok).toBe(true);
      if (!parallel.ok || !classic.ok) return;
      expect(parallel.compilerMetrics?.preparedComponentCount).toBe(5);
      expect(parallel.compilerMetrics?.schedulerTaskCount).toBe(6);
      expect(parallel.meshes?.map(meshContract)).toEqual(
        classic.meshes?.map(meshContract),
      );
      expect(interactionContract(parallel.interaction)).toEqual(
        interactionContract(classic.interaction),
      );
      const starts = parallel.occtTraceEvents?.filter(
        (event) =>
          event.kind === 'op-start' && event.bodiesBefore?.length === 0,
      );
      const finishes = parallel.occtTraceEvents?.filter(
        (event) =>
          event.kind === 'op-success' && event.bodiesBefore?.length === 0,
      );
      expect(starts?.length).toBeGreaterThanOrEqual(4);
      expect(finishes?.length).toBeGreaterThanOrEqual(4);
      expect(starts?.[1]?.timestampMs).toBeLessThan(
        finishes?.[0]?.timestampMs ?? 0,
      );
    },
    120_000,
  );
});
