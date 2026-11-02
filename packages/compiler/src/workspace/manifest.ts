/**
 * @author Aidan Boissonneault
 * @file manifest.ts
 * @purpose Provides manifest behavior for the workspace in compiler package.
 * @last-edited October 6, 2026
 */

import type { CompileError } from '@bushscad/ir';
import type { ProjectManifest } from './types.js';
import { makeError } from './workspace-errors.js';

/**
 * Parses and validates a bushscad.json manifest.
 * Workspace indexing depends on a predictable manifest shape, but project files
 * are user-authored JSON and need compiler-style errors.
 */
export function parseManifest(
  raw: string,
  manifestPath: string,
): { manifest: ProjectManifest | null; errors: CompileError[] } {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {
        manifest: null,
        errors: [
          makeError(manifestPath, 'Project manifest must be a JSON object.'),
        ],
      };
    }
    const manifest = parsed as Partial<ProjectManifest>;
    if (manifest.version === undefined) {
      return {
        manifest: null,
        errors: [
          makeError(
            manifestPath,
            "Project manifest is missing required field 'version'.",
          ),
        ],
      };
    }
    return { manifest: manifest as ProjectManifest, errors: [] };
  } catch (error) {
    return {
      manifest: null,
      errors: [
        makeError(
          manifestPath,
          `Invalid project manifest JSON: ${error instanceof Error ? error.message : String(error)}`,
        ),
      ],
    };
  }
}
