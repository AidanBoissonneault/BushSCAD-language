/**
 * @author Aidan Boissonneault
 * @file link-local-packages.test.ts
 * @purpose Tests local package selection and npm link planning.
 * @last-edited November 3, 2026
 */

import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { linkLocalPackages } from '../../../../scripts/workspace/link-local-packages.js';

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryRoots
      .splice(0)
      .map((path) => rm(path, { recursive: true, force: true })),
  );
});

describe('local package linking', () => {
  it('builds special packages and links direct dependencies in name order', async () => {
    const { consumerRoot, languageRoot, packagesRoot } = await roots();
    await packageWorkspace(packagesRoot, 'cli', '@bushscad/cli');
    await packageWorkspace(
      packagesRoot,
      'content',
      '@bushscad/language-content',
    );
    await packageWorkspace(packagesRoot, 'core', '@bushscad/core');
    await writeJson(join(consumerRoot, 'package.json'), {
      dependencies: { '@bushscad/core': '1', '@bushscad/cli': '1' },
      optionalDependencies: { '@bushscad/language-content': '1' },
    });
    const runNpm = vi.fn();

    await linkLocalPackages(consumerRoot, languageRoot, runNpm);

    expect(runNpm.mock.calls.map(([args]) => args)).toEqual([
      ['run', 'build', '--workspace=@bushscad/cli'],
      ['run', 'docs:publish'],
      ['run', 'prepack', '--workspace=@bushscad/language-content'],
      ['link', '--no-audit', '--no-fund'],
      ['link', '--no-audit', '--no-fund'],
      ['link', '--no-audit', '--no-fund'],
      [
        'link',
        '--no-save',
        '--no-audit',
        '--no-fund',
        '@bushscad/cli',
        '@bushscad/core',
        '@bushscad/language-content',
      ],
    ]);
    expect(runNpm.mock.calls.slice(3, 6).map(([, cwd]) => cwd)).toEqual([
      join(packagesRoot, 'cli'),
      join(packagesRoot, 'core'),
      join(packagesRoot, 'content'),
    ]);
  });

  it('rejects a consumer with no public BushSCAD dependency', async () => {
    const { consumerRoot, languageRoot } = await roots();
    await writeJson(join(consumerRoot, 'package.json'), {
      dependencies: { three: '1' },
    });

    await expect(linkLocalPackages(consumerRoot, languageRoot)).rejects.toThrow(
      'No direct @bushscad/* dependencies',
    );
  });

  it('reports public dependencies without a matching workspace', async () => {
    const { consumerRoot, languageRoot } = await roots();
    await writeJson(join(consumerRoot, 'package.json'), {
      dependencies: { '@bushscad/missing': '1' },
    });

    await expect(linkLocalPackages(consumerRoot, languageRoot)).rejects.toThrow(
      '@bushscad/missing',
    );
  });
});

/** Creates isolated language and consumer package roots. */
async function roots(): Promise<{
  consumerRoot: string;
  languageRoot: string;
  packagesRoot: string;
}> {
  const root = await mkdtemp(join(tmpdir(), 'bushscad-link-'));
  temporaryRoots.push(root);
  const consumerRoot = join(root, 'consumer');
  const languageRoot = join(root, 'language');
  const packagesRoot = join(languageRoot, 'packages');
  await Promise.all([
    mkdir(consumerRoot, { recursive: true }),
    mkdir(packagesRoot, { recursive: true }),
  ]);
  return { consumerRoot, languageRoot, packagesRoot };
}

/** Writes a workspace manifest used to build the public package index. */
async function packageWorkspace(
  packagesRoot: string,
  directory: string,
  name: string,
): Promise<void> {
  const packageRoot = join(packagesRoot, directory);
  await mkdir(packageRoot);
  await writeJson(join(packageRoot, 'package.json'), { name });
}

/** Writes JSON fixture data using the same manifest format as npm. */
async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, JSON.stringify(value), 'utf8');
}
