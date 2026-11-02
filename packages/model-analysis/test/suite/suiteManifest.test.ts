/**
 * @author Aidan Boissonneault
 * @file suiteManifest.test.ts
 * @purpose Tests source-file acceptance in model-analysis suite manifests.
 * @last-edited October 30, 2026
 */

import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadSuiteManifest } from '../../src/suite/suiteManifest.js';

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryRoots
      .splice(0)
      .map((path) => rm(path, { recursive: true, force: true })),
  );
});

describe('model-analysis suite source extensions', () => {
  it('accepts .bscd models declared in one suite', async () => {
    const root = await mkdtemp(join(tmpdir(), 'bushscad-suite-'));
    temporaryRoots.push(root);
    await writeFile(join(root, 'primary.bscd'), 'part primary {}');
    await writeFile(join(root, 'second.bscd'), 'part second {}');
    await writeFile(
      join(root, 'suite.json'),
      JSON.stringify({
        version: 1,
        title: 'Extension coverage',
        description: 'Source files use the current extension',
        cases: [
          {
            id: 'primary',
            title: 'Primary format',
            description: 'Current source file',
            file: 'primary.bscd',
            capabilities: [],
          },
          {
            id: 'second',
            title: 'Second source',
            description: 'Another source file',
            file: 'second.bscd',
            capabilities: [],
          },
        ],
      }),
    );

    const { checks } = await loadSuiteManifest(root);
    expect(checks.every((check) => check.passed)).toBe(true);
  });
});
