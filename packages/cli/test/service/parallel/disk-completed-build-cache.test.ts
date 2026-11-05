import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { DiskCompletedBuildCache } from '../../../src/service/parallel/disk-completed-build-cache.js';
import type { ParallelBuildOutput } from '../../../src/service/parallel/worker-protocol.js';

let directory: string | undefined;

afterEach(async () => {
  if (directory) {
    await rm(directory, { recursive: true, force: true });
    directory = undefined;
  }
});

describe('DiskCompletedBuildCache', () => {
  it('round trips typed meshes and current semantic output from disk', async () => {
    directory = await mkdtemp(join(tmpdir(), 'bushscad-build-cache-'));
    const cache = new DiskCompletedBuildCache(directory);
    const output = sampleOutput();
    const digest = 'a'.repeat(64);

    await cache.put(digest, 'exact-task', output);

    const restored = await cache.get(digest, 'exact-task');
    expect(restored).toMatchObject({
      taskId: 0,
      partName: 'base_plate',
      sourceIndex: 0,
      elapsedMs: 0,
      workerCpuMs: 0,
      workerRssBytes: 0,
      drawings: output.drawings,
      interaction: output.interaction,
      validations: output.validations,
      joints: output.joints,
    });
    expect(restored?.meshes).toHaveLength(1);
    expect(Array.from(restored?.meshes[0]?.vertices ?? [])).toEqual([1, 2, 3]);
    expect(Array.from(restored?.meshes[0]?.normals ?? [])).toEqual([0, 0, 1]);
    expect(Array.from(restored?.meshes[0]?.indices ?? [])).toEqual([0, 1, 2]);
    expect(await cache.get(digest, 'changed-task')).toBeUndefined();
  });

  it('treats a corrupted binary mesh payload as a cache miss', async () => {
    directory = await mkdtemp(join(tmpdir(), 'bushscad-build-cache-'));
    const cache = new DiskCompletedBuildCache(directory);
    const digest = 'b'.repeat(64);
    await cache.put(digest, 'exact-task', sampleOutput());
    const payloadName = (await readdir(directory)).find((name) =>
      name.endsWith('.mesh-cache'),
    );
    expect(payloadName).toBeDefined();
    if (!payloadName) return;
    const payloadPath = join(directory, payloadName);
    const payload = await readFile(payloadPath);
    payload[0] = (payload[0] ?? 0) ^ 0xff;
    await writeFile(payloadPath, payload);

    expect(await cache.get(digest, 'exact-task')).toBeUndefined();
  });

  it('treats a corrupted metadata sidecar as a cache miss', async () => {
    directory = await mkdtemp(join(tmpdir(), 'bushscad-build-cache-'));
    const cache = new DiskCompletedBuildCache(directory);
    const digest = 'c'.repeat(64);
    await cache.put(digest, 'exact-task', sampleOutput());
    const metadataName = (await readdir(directory)).find((name) =>
      name.endsWith('.mesh-cache.json'),
    );
    expect(metadataName).toBeDefined();
    if (!metadataName) return;
    const metadataPath = join(directory, metadataName);
    const metadata = JSON.parse(await readFile(metadataPath, 'utf8')) as {
      metadataSha256: string;
    };
    metadata.metadataSha256 = '0'.repeat(64);
    await writeFile(metadataPath, JSON.stringify(metadata));

    expect(await cache.get(digest, 'exact-task')).toBeUndefined();
  });
});

/** Supplies a compact completed worker result with each typed mesh buffer. */
function sampleOutput(): ParallelBuildOutput {
  return {
    taskId: 1,
    partName: 'base_plate',
    sourceIndex: 4,
    meshes: [
      {
        partName: 'base_plate',
        bodyName: 'base',
        color: '#abcdef',
        vertices: new Float32Array([1, 2, 3]),
        normals: new Float32Array([0, 0, 1]),
        indices: new Uint32Array([0, 1, 2]),
      },
    ],
    drawings: [],
    interaction: {
      version: 1,
      entrypoint: 'model.bscd',
      entities: [],
      effects: [],
      references: [],
      topology: [],
    },
    validations: [],
    joints: [],
    traceEvents: [],
    elapsedMs: 500,
    workerCpuMs: 480,
    workerRssBytes: 1024,
  };
}
