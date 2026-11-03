/**
 * @author Aidan Boissonneault
 * @file publication-check.test.ts
 * @purpose Tests generated language-reference publication validation.
 * @last-edited November 3, 2026
 */

import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  checkPublication,
  type PublicationAssetPaths,
  type PublicationCheckInput,
} from '../../../../scripts/docs/publication-check.js';

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryRoots
      .splice(0)
      .map((path) => rm(path, { recursive: true, force: true })),
  );
});

describe('language-reference publication checks', () => {
  it('accepts matching text, manifest, and non-empty PDF assets', async () => {
    const { paths } = await writePublicationFiles();
    await expect(checkPublication(publication(), paths)).resolves.toBeUndefined();
  });

  it('rejects stale published markdown', async () => {
    const { root, paths } = await writePublicationFiles();
    await writeFile(paths.markdownPath, 'stale', 'utf8');

    await expect(checkPublication(publication(), paths)).rejects.toThrow(
      'assets are stale',
    );
    expect(root).toBeTruthy();
  });
});

/** Creates a complete on-disk publication fixture under an isolated folder. */
async function writePublicationFiles(): Promise<{
  root: string;
  paths: PublicationAssetPaths;
}> {
  const root = await mkdtemp(join(tmpdir(), 'bushscad-publication-'));
  temporaryRoots.push(root);
  const paths: PublicationAssetPaths = {
    markdownPath: join(root, 'public.md'),
    packageReferencePath: join(root, 'reference.md'),
    robotsPath: join(root, 'robots.txt'),
    llmsPath: join(root, 'llms.txt'),
    manifestPath: join(root, 'manifest.json'),
    pdfPath: join(root, 'reference.pdf'),
  };
  const expected = publication();
  await Promise.all([
    writeFile(paths.markdownPath, expected.source, 'utf8'),
    writeFile(paths.packageReferencePath, expected.source, 'utf8'),
    writeFile(paths.robotsPath, expected.robots, 'utf8'),
    writeFile(paths.llmsPath, expected.llms, 'utf8'),
    writeFile(
      paths.manifestPath,
      JSON.stringify({
        version: expected.version,
        sourceSha256: expected.sourceSha256,
      }),
      'utf8',
    ),
    writeFile(paths.pdfPath, 'pdf'),
  ]);
  return { root, paths };
}

/** Returns deterministic publication values for filesystem validation. */
function publication(): PublicationCheckInput {
  return {
    source: '# Reference\n',
    version: '0.10.0',
    sourceSha256: 'abc123',
    robots: 'Allow: /docs/\n',
    llms: '# BushSCAD\n',
  };
}
