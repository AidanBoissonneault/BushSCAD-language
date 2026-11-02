/**
 * @author Aidan Boissonneault
 * @file native-parallel-booleans.integration.test.ts
 * @purpose Tests native parallel booleans integration behavior in the service in cli package.
 * @last-edited October 6, 2026
 */

import type { ChildProcessWithoutNullStreams } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import {
  interactionContract,
  meshContract,
} from '../fixtures/parallel-preview-contract.js';
import {
  requestExport,
  requestPreview,
  startParallelService,
} from '../fixtures/parallel-service-harness.js';

const integrationIt =
  process.env['BUSHSCAD_RUN_OCCT_INTEGRATION'] === '1' ? it : it.skip;
const testDir = dirname(fileURLToPath(import.meta.url));
const cutFixture = resolve(
  testDir,
  '../fixtures/parallel-p6-within-cuts.bscd',
);
const fuseFixture = resolve(
  testDir,
  '../fixtures/parallel-p6-additive-extrudes.bscd',
);
const riskyFixture = resolve(
  testDir,
  '../fixtures/parallel-p6-risky-cuts.bscd',
);
let services: ChildProcessWithoutNullStreams[] = [];

afterEach(() => {
  services.forEach((service) => service.kill());
  services = [];
});

describe('native parallel boolean batches', () => {
  integrationIt(
    'matches classic and disabled cuts while proving one native multi-tool build',
    async () => {
      const enabled = await startParallelService(1);
      services.push(enabled.process);
      const batched = await requestPreview(
        enabled.process,
        enabled.messages,
        1,
        undefined,
        true,
        cutFixture,
      );
      const classic = await requestPreview(
        enabled.process,
        enabled.messages,
        2,
        'classic',
        false,
        cutFixture,
      );
      const silentBatched = await requestPreview(
        enabled.process,
        enabled.messages,
        8,
        undefined,
        false,
        cutFixture,
      );
      const disabled = await startParallelService(1, {
        BUSHSCAD_NATIVE_PARALLEL_BREP: '0',
      });
      services.push(disabled.process);
      const sequential = await requestPreview(
        disabled.process,
        disabled.messages,
        3,
        undefined,
        false,
        cutFixture,
      );

      expectEquivalent(batched, classic);
      expectEquivalent(silentBatched, classic);
      expectEquivalent(sequential, classic);
      if (!batched.ok) return;
      expect(batched.compilerMetrics).toMatchObject({
        nativeBooleanBatchCount: 1,
        nativeBooleanAvoidedBuildCount: 5,
      });
      expect(batched.occtTraceEvents).toContainEqual(
        expect.objectContaining({
          kind: 'native-boolean-batch',
          nativeApi: 'BOPAlgo_BOP',
          runParallel: true,
          batchSize: 6,
          booleanBuildCount: 1,
          nativeConcurrencyLimit: 1,
          cpuMs: expect.any(Number),
        }),
      );
      if (silentBatched.ok) {
        expect(silentBatched.compilerMetrics).toMatchObject({
          nativeBooleanBatchCount: 1,
          nativeBooleanAvoidedBuildCount: 5,
        });
        expect(silentBatched.occtTraceEvents).toBeUndefined();
      }
    },
    180_000,
  );

  integrationIt(
    'constructs placed extrusions and combines them with one native fuse',
    async () => {
      const enabled = await startParallelService(1);
      services.push(enabled.process);
      const batched = await requestPreview(
        enabled.process,
        enabled.messages,
        4,
        undefined,
        true,
        fuseFixture,
      );
      const classic = await requestPreview(
        enabled.process,
        enabled.messages,
        5,
        'classic',
        false,
        fuseFixture,
      );

      expectEquivalent(batched, classic);
      if (!batched.ok) return;
      expect(batched.compilerMetrics).toMatchObject({
        nativeBooleanBatchCount: 1,
        nativeBooleanAvoidedBuildCount: 4,
      });
      expect(batched.occtTraceEvents).toContainEqual(
        expect.objectContaining({
          kind: 'native-boolean-batch',
          opKind: 'fuse',
          runParallel: true,
          batchSize: 5,
          booleanBuildCount: 1,
        }),
      );
    },
    180_000,
  );

  integrationIt(
    'matches classic for touching, overlapping, and coincident cutters',
    async () => {
      const enabled = await startParallelService(1);
      services.push(enabled.process);
      const batched = await requestPreview(
        enabled.process,
        enabled.messages,
        6,
        undefined,
        true,
        riskyFixture,
      );
      const classic = await requestPreview(
        enabled.process,
        enabled.messages,
        7,
        'classic',
        false,
        riskyFixture,
      );
      expectEquivalent(batched, classic, 8);
      if (!batched.ok) return;
      expect(batched.compilerMetrics).toMatchObject({
        nativeBooleanBatchCount: 1,
        nativeBooleanAvoidedBuildCount: 3,
      });
    },
    180_000,
  );

  integrationIt(
    'preserves native-batched STL and STEP export bytes',
    async () => {
      const enabled = await startParallelService(1);
      const disabled = await startParallelService(1, {
        BUSHSCAD_NATIVE_PARALLEL_BREP: '0',
      });
      services.push(enabled.process, disabled.process);
      for (const [index, format] of ['stl', 'step'].entries()) {
        const batched = await requestExport(
          enabled.process,
          enabled.messages,
          10 + index,
          cutFixture,
          format as 'stl' | 'step',
        );
        const sequential = await requestExport(
          disabled.process,
          disabled.messages,
          20 + index,
          cutFixture,
          format as 'stl' | 'step',
        );
        expect(batched.ok, JSON.stringify(batched)).toBe(true);
        expect(sequential.ok, JSON.stringify(sequential)).toBe(true);
        if (!batched.ok || !sequential.ok) continue;
        expect(batched.compilerMetrics).toMatchObject({
          schedulerTaskCount: 1,
          workerCpuMs: expect.any(Number),
          peakWorkerRssBytes: expect.any(Number),
        });
        expect(exportContract(batched.buffers, format)).toEqual(
          exportContract(sequential.buffers, format),
        );
      }
    },
    180_000,
  );
});

/**
 * Asserts the expected equivalent behavior in this test.
 */
function expectEquivalent(
  actual: Awaited<ReturnType<typeof requestPreview>>,
  classic: Awaited<ReturnType<typeof requestPreview>>,
  decimalPlaces?: number,
): void {
  expect(actual.ok, JSON.stringify(actual)).toBe(true);
  expect(classic.ok, JSON.stringify(classic)).toBe(true);
  if (!actual.ok || !classic.ok) return;
  expect(
    actual.meshes?.map((mesh) => comparableMesh(mesh, decimalPlaces)),
  ).toEqual(classic.meshes?.map((mesh) => comparableMesh(mesh, decimalPlaces)));
  expect(interactionContract(actual.interaction)).toEqual(
    interactionContract(classic.interaction),
  );
}

/**
 * Handles comparable mesh in the service flow.
 */
function comparableMesh(
  mesh: Parameters<typeof meshContract>[0],
  decimalPlaces?: number,
): ReturnType<typeof meshContract> {
  const contract = meshContract(mesh);
  return decimalPlaces === undefined
    ? contract
    : {
        ...contract,
        sums: contract.sums.map((value) =>
          Number(value.toFixed(decimalPlaces)),
        ),
      };
}

/**
 * Exports contract to the requested format.
 */
function exportContract(
  buffers: { name: string; dataBase64: string }[] | undefined,
  format: string,
): { name: string; data: string }[] {
  return (buffers ?? []).map(({ name, dataBase64 }) => {
    const data = Buffer.from(dataBase64, 'base64').toString('binary');
    return {
      name,
      data:
        format === 'step'
          ? data.replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/g, '<timestamp>')
          : data,
    };
  });
}
