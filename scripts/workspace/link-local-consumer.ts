/**
 * @file link-local-consumer.ts
 * @purpose Links public language workspaces into a sibling private project.
 * @last-edited November 3, 2026
 */

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { linkLocalPackages } from './link-local-packages.ts';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const languageRoot = resolve(scriptDirectory, '../..');
const consumerRoot = resolve(process.argv[2] ?? process.cwd());

void linkLocalPackages(consumerRoot, languageRoot).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
