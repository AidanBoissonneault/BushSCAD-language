/**
 * @author Aidan Boissonneault
 * @file workspace-files.ts
 * @purpose Provides workspace files behavior for the platform lsp in language server package.
 * @last-edited October 6, 2026
 */

import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { isBushScadFile } from '@bushscad/compiler/paths';
import { normalizePath } from '../../language/uri.js';

const EXCLUDED_DIRECTORIES = new Set([
  '.git',
  '.bushscad-analysis',
  '.vscode-test',
  'coverage',
  'dist',
  'node_modules',
  'out',
]);

/** Loads project sources without entering generated or dependency directories. */
export async function readBushScadWorkspace(
  rootPath: string,
): Promise<Record<string, string>> {
  const sources: Record<string, string> = {};
  await visit(rootPath, sources);
  return sources;
}

/**
 * Handles visit in the platform lsp flow.
 */
async function visit(
  directory: string,
  sources: Record<string, string>,
): Promise<void> {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return;
  }
  await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!EXCLUDED_DIRECTORIES.has(entry.name)) await visit(path, sources);
        return;
      }
      if (entry.isFile() && isBushScadFile(entry.name)) {
        try {
          sources[normalizePath(path)] = await readFile(path, 'utf8');
        } catch {
          // A concurrent rename/delete is represented by the next file event.
        }
      }
    }),
  );
}
