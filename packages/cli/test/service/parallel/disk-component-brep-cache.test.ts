/**
 * @author Aidan Boissonneault
 * @file disk-component-brep-cache.test.ts
 * @purpose Tests disk-backed prepared component cache integrity and write policy.
 */

import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DiskComponentBrepCache } from '../../../src/service/parallel/disk-component-brep-cache.js';

const directories: string[] = [];
const sampleDigest = '0123456789abcdef';
const sampleCanonical = '{"kind":"solidPrimitive","shape":{}}';

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(
    directories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe('DiskComponentBrepCache', () => {
  it('round-trips a BRep and rejects bytes whose checksum changed', async () => {
    const directory = await createCacheDirectory();
    const cache = new DiskComponentBrepCache(directory);
    const brep = new Uint8Array([1, 2, 3, 4]);

    await cache.put(sampleDigest, sampleCanonical, brep, 300);

    expect(
      Array.from((await cache.get(sampleDigest, sampleCanonical)) ?? []),
    ).toEqual(Array.from(brep));
    expect(
      await cache.get(sampleDigest, '{"kind":"different"}'),
    ).toBeUndefined();
    expect(
      await cache.get('fedcba9876543210', sampleCanonical),
    ).toBeUndefined();
    const files = await readdir(directory);
    expect(
      JSON.parse(
        await readFile(
          join(
            directory,
            files.find((file) => file.endsWith('.json'))!,
          ),
          'utf8',
        ),
      ),
    ).toMatchObject({
      format: 'occt-brep-v1',
      recipeDigest: sampleDigest,
      byteLength: brep.byteLength,
    });

    await writeFile(
      join(
        directory,
        files.find((file) => file.endsWith('.brep'))!,
      ),
      new Uint8Array([9]),
    );
    expect(await cache.get(sampleDigest, sampleCanonical)).toBeUndefined();
  });

  it('writes small components only after the idle interval', async () => {
    const directory = await createCacheDirectory();
    const cache = new DiskComponentBrepCache(directory);
    let now = 1_000_000;
    vi.spyOn(Date, 'now').mockImplementation(() => now);

    await cache.put(sampleDigest, sampleCanonical, new Uint8Array([1]), 300);
    await cache.put(
      'fedcba9876543210',
      '{"kind":"small"}',
      new Uint8Array([2]),
      20,
    );
    expect(
      await cache.get('fedcba9876543210', '{"kind":"small"}'),
    ).toBeUndefined();
    await cache.put(
      'fedcba9876543211',
      '{"kind":"manual"}',
      new Uint8Array([3]),
      20,
      'manual',
    );
    expect(
      Array.from(
        (await cache.get('fedcba9876543211', '{"kind":"manual"}', 'manual')) ??
          [],
      ),
    ).toEqual([3]);

    now += 10_001;
    await cache.put(
      'fedcba9876543210',
      '{"kind":"small"}',
      new Uint8Array([2]),
      20,
    );
    expect(
      Array.from(
        (await cache.get('fedcba9876543210', '{"kind":"small"}')) ?? [],
      ),
    ).toEqual([2]);
  });

  it('does not create files for invalid recipe keys or empty payloads', async () => {
    const directory = await createCacheDirectory();
    const cache = new DiskComponentBrepCache(directory);

    await cache.put('../unsafe', sampleCanonical, new Uint8Array([1]), 500);
    await cache.put(sampleDigest, sampleCanonical, new Uint8Array(), 500);

    expect(await readdir(directory)).toEqual([]);
  });
});

/** Creates a disposable test directory and records it for cleanup. */
async function createCacheDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'bushscad-brep-cache-test-'));
  directories.push(directory);
  return directory;
}
