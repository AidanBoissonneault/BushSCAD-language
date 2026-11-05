/**
 * @author Aidan Boissonneault
 * @file parallel-recipe-reuse.integration.test.ts
 * @purpose Tests parallel recipe reuse integration behavior in the service in cli package.
 * @last-edited October 6, 2026
 */

import type { ChildProcessWithoutNullStreams } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
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
const singleComponentFixture = resolve(
  testDir,
  '../fixtures/parallel-single-component-cache.bscd',
);
let service: ChildProcessWithoutNullStreams | undefined;
let componentCacheDirectory: string | undefined;
let editFixturePath: string | undefined;

afterEach(async () => {
  service?.kill();
  if (componentCacheDirectory) {
    await rm(componentCacheDirectory, { recursive: true, force: true });
    componentCacheDirectory = undefined;
  }
  if (editFixturePath) {
    await rm(editFixturePath, { force: true });
    editFixturePath = undefined;
  }
});

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

  integrationIt(
    'reuses disk BReps across previews with identical final geometry',
    async () => {
      const started = await startParallelService(2);
      service = started.process;
      componentCacheDirectory = await mkdtemp(
        join(tmpdir(), 'bushscad-component-cache-'),
      );
      const first = await requestPreview(
        service,
        started.messages,
        10,
        undefined,
        false,
        reuseFixture,
        componentCacheDirectory,
      );
      const cached = await requestPreview(
        service,
        started.messages,
        11,
        undefined,
        true,
        reuseFixture,
        componentCacheDirectory,
      );

      expect(first.ok).toBe(true);
      expect(cached.ok).toBe(true);
      if (!first.ok || !cached.ok) return;
      expect(cached.compilerMetrics).toMatchObject({
        preparedComponentCount: 6,
        componentRecipeCount: 1,
        persistentComponentCacheHitCount: 1,
        persistentCompletedBuildCacheHitCount: 1,
      });
      expect(
        cached.compilerMetrics?.componentReductionMs ?? Infinity,
      ).toBeLessThan(
        first.compilerMetrics?.componentReductionMs ?? Number.POSITIVE_INFINITY,
      );
      expect(cached.compilerMetrics?.schedulerTaskCount).toBe(0);
      expect(
        cached.occtTraceEvents?.some(
          (event) => event.message === 'Reused cached prepared component.',
        ),
      ).toBe(true);
      expect(
        cached.occtTraceEvents?.some(
          (event) =>
            event.message ===
            'Reused completed build output from the session cache.',
        ),
      ).toBe(true);
      expect(cached.meshes?.map(meshContract)).toEqual(
        first.meshes?.map(meshContract),
      );
      expect(interactionContract(cached.interaction)).toEqual(
        interactionContract(first.interaction),
      );
      expect(cached.validations).toEqual(first.validations);
      expect(cached.joints).toEqual(first.joints);
      expect(cached.drawings).toEqual(first.drawings);
    },
    180_000,
  );

  integrationIt(
    'reuses a single unchanged component when persistent caching is enabled',
    async () => {
      const started = await startParallelService(1);
      service = started.process;
      componentCacheDirectory = await mkdtemp(
        join(tmpdir(), 'bushscad-component-cache-'),
      );
      const first = await requestPreview(
        service,
        started.messages,
        30,
        undefined,
        false,
        singleComponentFixture,
        componentCacheDirectory,
      );
      const cached = await requestPreview(
        service,
        started.messages,
        31,
        undefined,
        true,
        singleComponentFixture,
        componentCacheDirectory,
      );

      expect(first.ok).toBe(true);
      expect(cached.ok).toBe(true);
      if (!first.ok || !cached.ok) return;
      expect(cached.compilerMetrics).toMatchObject({
        preparedComponentCount: 1,
        componentRecipeCount: 1,
        persistentComponentCacheHitCount: 1,
      });
      expect(cached.meshes?.map(meshContract)).toEqual(
        first.meshes?.map(meshContract),
      );
      expect(interactionContract(cached.interaction)).toEqual(
        interactionContract(first.interaction),
      );
    },
    180_000,
  );

  integrationIt(
    'restarts from an unchanged cached component after an edit',
    async () => {
      const started = await startParallelService(1);
      service = started.process;
      componentCacheDirectory = await mkdtemp(
        join(tmpdir(), 'bushscad-component-cache-'),
      );
      editFixturePath = resolve(
        testDir,
        `../fixtures/.component-cache-edit-${randomUUID()}.bscd`,
      );
      await writeFile(
        editFixturePath,
        'part assembly {\n  obj pin = cylinder(8, r: 2);\n  obj base = cuboid([10, 10, 5]);\n}\n',
      );
      const beforeEdit = await requestPreview(
        service,
        started.messages,
        20,
        undefined,
        false,
        editFixturePath,
        componentCacheDirectory,
      );
      await writeFile(
        editFixturePath,
        'part assembly {\n  obj pin = cylinder(8, r: 2);\n  obj base = cuboid([14, 10, 5]);\n}\n',
      );
      const afterEdit = await requestPreview(
        service,
        started.messages,
        21,
        undefined,
        false,
        editFixturePath,
        componentCacheDirectory,
      );
      const classic = await requestPreview(
        service,
        started.messages,
        22,
        'classic',
        false,
        editFixturePath,
      );

      expect(beforeEdit.ok).toBe(true);
      expect(afterEdit.ok).toBe(true);
      expect(classic.ok).toBe(true);
      if (!beforeEdit.ok || !afterEdit.ok || !classic.ok) return;
      expect(afterEdit.compilerMetrics).toMatchObject({
        preparedComponentCount: 2,
        componentRecipeCount: 2,
        persistentComponentCacheHitCount: 1,
      });
      expect(
        afterEdit.compilerMetrics?.persistentCompletedBuildCacheHitCount ?? 0,
      ).toBe(0);
      expect(afterEdit.meshes?.map(meshContract)).toEqual(
        classic.meshes?.map(meshContract),
      );
      expect(interactionContract(afterEdit.interaction)).toEqual(
        interactionContract(classic.interaction),
      );
    },
    180_000,
  );
});
