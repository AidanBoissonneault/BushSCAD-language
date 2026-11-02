import { build } from 'esbuild';
import { cp } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const packageDir = resolve(scriptDir, '..');
const packagesDir = resolve(packageDir, '..');

const workspaceAlias = {
  '@bushscad/compiler': resolve(packagesDir, 'compiler/src/index.ts'),
  '@bushscad/compiler/node': resolve(
    packagesDir,
    'compiler/src/platform/node/node.ts',
  ),
  '@bushscad/evaluator': resolve(packagesDir, 'evaluator/src/index.ts'),
  '@bushscad/ir': resolve(packagesDir, 'ir/src/index.ts'),
  '@bushscad/occt-bridge': resolve(packagesDir, 'occt-bridge/src/index.ts'),
  '@bushscad/parser': resolve(packagesDir, 'parser/src/index.ts'),
  '@bushscad/resolver': resolve(packagesDir, 'resolver/src/index.ts'),
};

await build({
  absWorkingDir: packageDir,
  entryPoints: [resolve(packageDir, 'src/index.ts')],
  outfile: resolve(packageDir, 'dist/index.js'),
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'esm',
  sourcemap: true,
  external: ['opencascade.js', 'opencascade.js/*'],
  plugins: [
    {
      name: 'workspace-alias',
      setup(build) {
        for (const [name, path] of Object.entries(workspaceAlias)) {
          build.onResolve(
            { filter: new RegExp(`^${name.replace('/', '\\/')}$`) },
            () => ({ path }),
          );
        }
      },
    },
  ],
});

await cp(
  resolve(packagesDir, 'compiler/assets/fonts'),
  resolve(packageDir, 'dist/fonts'),
  { recursive: true, force: true },
);
