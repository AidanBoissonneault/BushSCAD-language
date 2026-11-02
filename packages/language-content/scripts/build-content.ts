/**
 * @file build-content.ts
 * @purpose Packages the canonical language reference and selected public examples.
 * @last-edited November 1, 2026
 */

import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const packageRoot = resolve(import.meta.dirname, '..');
const languageRoot = resolve(packageRoot, '../..');
const outputRoot = resolve(packageRoot, 'dist');
const referenceSource = resolve(
  languageRoot,
  'BushSCAD_Language_Reference_v0.10.md',
);
const exampleFiles = [
  'constrained-path-plate.bscd',
  'docs/css-font-family.bscd',
  'docs/extruded-plate.bscd',
  'docs/function-bosses.bscd',
];

/**
 * Builds the public content artifact consumed by the isolated website project.
 *
 * Why: the website repository can stay private while using the exact reference
 * and examples published with the public language toolchain.
 */
async function buildContent(): Promise<void> {
  await mkdir(outputRoot, { recursive: true });
  const reference = (await readFile(referenceSource, 'utf8')).replace(
    /\r\n?/g,
    '\n',
  );
  await writeFile(resolve(outputRoot, 'reference.md'), reference, 'utf8');
  for (const example of exampleFiles) {
    const source = resolve(languageRoot, 'examples', example);
    const destination = resolve(outputRoot, 'examples', example);
    await mkdir(dirname(destination), { recursive: true });
    await copyFile(source, destination);
  }
}

void buildContent().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
