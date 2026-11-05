import { describe, expect, it } from 'vitest';
import { buildWorkspaceIndex } from '../../../src/workspace/buildWorkspaceIndex.js';
import {
  fingerprintOverlays,
  WorkspaceIndexCache,
} from '../../../src/platform/node/workspace-index-cache.js';

const ROOT = '/workspace';
const MAIN_PATH = `${ROOT}/main.bscd`;
const LIBRARY_PATH = `${ROOT}/library.bscd`;
const MANIFEST_PATH = `${ROOT}/bushscad.json`;

describe('workspace index cache', () => {
  it('returns detached snapshots and invalidates when a tracked source changes', () => {
    const sources = baseSources();
    const cache = new WorkspaceIndexCache();
    const readSource = sourceReader(sources);
    const index = buildIndex(sources);
    const cacheArgs = {
      key: `${ROOT}\0${MAIN_PATH}`,
      overlayFingerprint: fingerprintOverlays({}),
      manifestPath: MANIFEST_PATH,
      readSource,
    };

    cache.set({ ...cacheArgs, index });
    const cached = cache.get(cacheArgs);

    expect(cached).toEqual(index);
    expect(cached).not.toBe(index);
    cached?.files[MAIN_PATH]?.imports.push('/mutated.bscd');
    expect(cache.get(cacheArgs)).toEqual(index);

    sources.set(LIBRARY_PATH, 'export var width = 14;');
    expect(cache.get(cacheArgs)).toBeUndefined();
  });

  it('invalidates when the manifest or overlay contents change', () => {
    const sources = baseSources();
    const cache = new WorkspaceIndexCache();
    const index = buildIndex(sources);
    const overlays = { [MAIN_PATH]: "import { width } from './library.bscd';" };
    const cacheArgs = {
      key: `${ROOT}\0${MAIN_PATH}`,
      overlayFingerprint: fingerprintOverlays(overlays),
      manifestPath: MANIFEST_PATH,
      readSource: sourceReader(sources),
    };

    cache.set({ ...cacheArgs, index });
    expect(cache.get(cacheArgs)).toEqual(index);
    expect(
      cache.get({
        ...cacheArgs,
        overlayFingerprint: fingerprintOverlays({
          [MAIN_PATH]: "import { width } from './library.bscd'; // changed",
        }),
      }),
    ).toBeUndefined();

    sources.set(MANIFEST_PATH, '{"version":1,"entrypoints":["other.bscd"]}');
    expect(cache.get(cacheArgs)).toBeUndefined();
  });

  it('does not retain graphs with dynamic include globs', () => {
    const sources = baseSources();
    sources.set(
      MANIFEST_PATH,
      JSON.stringify({
        version: 1,
        entrypoints: ['main.bscd'],
        include: ['parts/**/*.bscd'],
      }),
    );
    const index = buildIndex(sources);
    const cache = new WorkspaceIndexCache();
    const cacheArgs = {
      key: `${ROOT}\0${MAIN_PATH}`,
      overlayFingerprint: fingerprintOverlays({}),
      manifestPath: MANIFEST_PATH,
      readSource: sourceReader(sources),
    };

    cache.set({ ...cacheArgs, index });
    expect(cache.get(cacheArgs)).toBeUndefined();
  });
});

/** Creates a stable two-file workspace fixture for cache tests. */
function baseSources(): Map<string, string> {
  return new Map([
    [MANIFEST_PATH, JSON.stringify({ version: 1, entrypoints: ['main.bscd'] })],
    [MAIN_PATH, "import { width } from './library.bscd';"],
    [LIBRARY_PATH, 'export var width = 10;'],
  ]);
}

/** Builds an index from a path-keyed in-memory source map. */
function buildIndex(sources: Map<string, string>) {
  return buildWorkspaceIndex({
    rootPath: ROOT,
    activeFilePath: MAIN_PATH,
    fileMap: Object.fromEntries(sources),
  });
}

/** Adapts the fixture map to the Node cache source-reader contract. */
function sourceReader(sources: Map<string, string>) {
  return (path: string): string | null => sources.get(path) ?? null;
}
