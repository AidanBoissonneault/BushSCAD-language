/**
 * @author Aidan Boissonneault
 * @file native-explicit-fuse.integration.test.ts
 * @purpose Tests native explicit fuse integration behavior in the service in cli package.
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
  requestPreview,
  startParallelService,
} from '../fixtures/parallel-service-harness.js';

const integrationIt =
  process.env['BUSHSCAD_RUN_OCCT_INTEGRATION'] === '1' ? it : it.skip;
const testDir = dirname(fileURLToPath(import.meta.url));
const fixture = resolve(
  testDir,
  '../fixtures/parallel-p6-placed-fuse.bscd',
);
let services: ChildProcessWithoutNullStreams[] = [];

afterEach(() => {
  services.forEach((service) => service.kill());
  services = [];
});

describe('native explicit fuse reduction', () => {
  integrationIt(
    'fuses independently built and world-placed bodies with native OCCT',
    async () => {
      const enabled = await startParallelService(2);
      services.push(enabled.process);
      const native = await requestPreview(
        enabled.process,
        enabled.messages,
        1,
        undefined,
        true,
        fixture,
      );
      const classic = await requestPreview(
        enabled.process,
        enabled.messages,
        2,
        'classic',
        false,
        fixture,
      );

      expect(native.ok, JSON.stringify(native)).toBe(true);
      expect(classic.ok, JSON.stringify(classic)).toBe(true);
      if (!native.ok || !classic.ok) return;
      expect(native.meshes?.map(meshContract)).toEqual(
        classic.meshes?.map(meshContract),
      );
      expect(interactionContract(native.interaction)).toEqual(
        interactionContract(classic.interaction),
      );
      expect(native.compilerMetrics).toMatchObject({
        nativeBooleanBatchCount: 1,
        nativeBooleanAvoidedBuildCount: 1,
      });
      expect(native.occtTraceEvents).toContainEqual(
        expect.objectContaining({
          kind: 'native-boolean-batch',
          opKind: 'fuse',
          nativeApi: 'BOPAlgo_BOP',
          runParallel: true,
          batchSize: 2,
          booleanBuildCount: 1,
        }),
      );
    },
    180_000,
  );
});
