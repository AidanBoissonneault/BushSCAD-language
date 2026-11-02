/**
 * @author Aidan Boissonneault
 * @file parallel-recipe-reuse.integration.test.ts
 * @purpose Tests parallel recipe reuse integration behavior in the service in cli package.
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
const reuseFixture = resolve(
  testDir,
  '../fixtures/parallel-components-p5-reuse.bscd',
);
let service: ChildProcessWithoutNullStreams | undefined;

afterEach(() => service?.kill());

describe('compile-local component recipe reuse', () => {
  integrationIt(
    'matches reuse-disabled and classic output for transformed loop instances',
    async () => {
      const enabled = await startParallelService(2);
      service = enabled.process;
      const reused = await requestPreview(
        service,
        enabled.messages,
        1,
        undefined,
        false,
        reuseFixture,
      );
      const classic = await requestPreview(
        service,
        enabled.messages,
        2,
        'classic',
        false,
        reuseFixture,
      );
      service.kill();

      const disabled = await startParallelService(2, {
        BUSHSCAD_PARALLEL_RECIPE_REUSE: '0',
      });
      service = disabled.process;
      const uncached = await requestPreview(
        service,
        disabled.messages,
        3,
        undefined,
        false,
        reuseFixture,
      );

      expect(reused.ok).toBe(true);
      expect(uncached.ok).toBe(true);
      expect(classic.ok).toBe(true);
      if (!reused.ok || !uncached.ok || !classic.ok) return;
      expect(reused.compilerMetrics).toMatchObject({
        preparedComponentCount: 6,
        componentRecipeCount: 1,
        componentCacheHitCount: 5,
      });
      expect(uncached.compilerMetrics).toMatchObject({
        preparedComponentCount: 6,
        componentRecipeCount: 6,
        componentCacheHitCount: 0,
      });
      expect(reused.meshes?.map(meshContract)).toEqual(
        classic.meshes?.map(meshContract),
      );
      expect(uncached.meshes?.map(meshContract)).toEqual(
        classic.meshes?.map(meshContract),
      );
      expect(interactionContract(reused.interaction)).toEqual(
        interactionContract(classic.interaction),
      );
      expect(interactionContract(uncached.interaction)).toEqual(
        interactionContract(classic.interaction),
      );
    },
    180_000,
  );
});
