/**
 * @file link-local-consumer.ts
 * @purpose Links public language workspaces into a sibling private project.
 * @last-edited November 1, 2026
 */

import { spawnSync } from 'node:child_process';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

type PackageManifest = {
  name?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
};

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const languageRoot = resolve(scriptDirectory, '../..');
const packagesRoot = resolve(languageRoot, 'packages');

/** Runs npm from a project root and forwards output so link failures are actionable. */
function runNpm(args: string[], cwd: string): void {
  const result = spawnSync(
    process.platform === 'win32' ? 'npm.cmd' : 'npm',
    args,
    {
      cwd,
      stdio: 'inherit',
      windowsHide: true,
      shell: process.platform === 'win32',
    },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `npm ${args.join(' ')} failed in ${cwd} with status ${result.status}.`,
    );
  }
}

/** Reads a manifest without requiring the consumer to be part of this npm workspace. */
async function readManifest(path: string): Promise<PackageManifest> {
  return JSON.parse(await readFile(path, 'utf8')) as PackageManifest;
}

/** Links only the public language packages directly declared by a private consumer. */
async function linkLocalConsumer(): Promise<void> {
  const consumerRoot = resolve(process.argv[2] ?? process.cwd());
  const consumerManifest = await readManifest(
    resolve(consumerRoot, 'package.json'),
  );
  const dependencies = {
    ...consumerManifest.dependencies,
    ...consumerManifest.devDependencies,
    ...consumerManifest.optionalDependencies,
  };
  const packageNames = Object.keys(dependencies)
    .filter((name) => name.startsWith('@bushscad/'))
    .sort();
  if (packageNames.length === 0) {
    throw new Error(
      `No direct @bushscad/* dependencies were found in ${consumerRoot}.`,
    );
  }

  const workspaces = await Promise.all(
    (await readdir(packagesRoot, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map(async (entry) => {
        const packageRoot = join(packagesRoot, entry.name);
        try {
          const manifest = await readManifest(
            join(packageRoot, 'package.json'),
          );
          return manifest.name?.startsWith('@bushscad/')
            ? { name: manifest.name, root: packageRoot }
            : undefined;
        } catch {
          return undefined;
        }
      }),
  );
  const workspaceByName = new Map(
    workspaces
      .filter((workspace) => workspace !== undefined)
      .map((workspace) => [workspace.name, workspace.root]),
  );
  const missing = packageNames.filter((name) => !workspaceByName.has(name));
  if (missing.length > 0) {
    throw new Error(
      `These consumer dependencies have no matching language workspace: ${missing.join(', ')}.`,
    );
  }

  if (packageNames.includes('@bushscad/cli')) {
    runNpm(['run', 'build', '--workspace=@bushscad/cli'], languageRoot);
  }
  if (packageNames.includes('@bushscad/language-content')) {
    runNpm(['run', 'docs:publish'], languageRoot);
    runNpm(
      ['run', 'prepack', '--workspace=@bushscad/language-content'],
      languageRoot,
    );
  }

  for (const name of packageNames) {
    runNpm(['link', '--no-audit', '--no-fund'], workspaceByName.get(name)!);
  }
  runNpm(
    ['link', '--no-save', '--no-audit', '--no-fund', ...packageNames],
    consumerRoot,
  );
  console.log(`Linked public language packages into ${consumerRoot}.`);
}

void linkLocalConsumer().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
