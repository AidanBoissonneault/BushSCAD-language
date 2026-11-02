/**
 * @author Aidan Boissonneault
 * @file test-support.ts
 * @purpose Tests test support behavior in the pipeline in compiler package.
 * @last-edited October 6, 2026
 */

import { readFileSync } from 'node:fs';
import { compileDocument, normalizePath } from '../../src/index';

const workspaceRoot = normalizePath('C:\\workspace');

/**
 * Builds a normalized path inside the synthetic compiler test workspace.
 *
 * Why:
 * Import and manifest tests need stable Windows-style paths without repeating
 * normalization details in each test case.
 */
export function workspacePath(relativePath: string): string {
  return `${workspaceRoot}/${relativePath.replaceAll('\\', '/')}`;
}

/**
 * Handles compile in the pipeline flow.
 */
export function compile(
  source: string,
  env: Record<string, string> = {},
  fileMap?: Record<string, string>,
) {
  const filePath = workspacePath('main.bscd');
  return compileDocument({
    source,
    filePath,
    fileMap: fileMap ?? { [filePath]: source },
    env,
  });
}

/**
 * Compiles an example file as a single-file compiler workspace.
 *
 * Why:
 * Example regression tests should vary only the example name and assertions,
 * not the file-path/read/compileDocument boilerplate.
 */
export function compileExample(exampleName: string) {
  const filePath = workspacePath(`examples/${exampleName}`);
  const source = readFileSync(
    new URL(`../../../../examples/${exampleName}`, import.meta.url),
    'utf8',
  );
  return compileDocument({
    source,
    filePath,
    fileMap: { [filePath]: source },
  });
}
