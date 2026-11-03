/**
 * @author Aidan Boissonneault
 * @file link-local-packages.ts
 * @purpose Links language workspace packages declared by a private consumer.
 * @last-edited November 3, 2026
 */

import { spawnSync } from 'node:child_process';
import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

type PackageManifest = {
  name?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
};

type NpmRunner = (args: string[], cwd: string) => void;

/** Links matching public language workspaces without modifying consumer manifests. */
export async function linkLocalPackages(
  consumerRoot: string,
  languageRoot: string,
  runNpm: NpmRunner = runNpmCommand,
): Promise<void> {
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

  const packagesRoot = resolve(languageRoot, 'packages');
  const workspaces = await Promise.all(
    (await readdir(packagesRoot, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map(async (entry) => {
        const packageRoot = join(packagesRoot, entry.name);
        try {
          const manifest = await readManifest(join(packageRoot, 'package.json'));
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
}

/** Reads a JSON package manifest from its resolved path. */
async function readManifest(path: string): Promise<PackageManifest> {
  return JSON.parse(await readFile(path, 'utf8')) as PackageManifest;
}

/** Runs npm in a workspace and turns process failures into useful errors. */
function runNpmCommand(args: string[], cwd: string): void {
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
