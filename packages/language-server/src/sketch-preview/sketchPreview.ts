/**
 * @author Aidan Boissonneault
 * @file sketchPreview.ts
 * @purpose Provides sketch preview behavior for the sketch preview in language server package.
 * @last-edited October 6, 2026
 */

import type { SketchPreviewModel } from '@bushscad/ir';
import {
  findEvaluatedSketchPreview,
  findEvaluatedSketchPreviews,
} from './sketchPreviewEvaluation.js';

/**
 * Type used for active sketch preview.
 */
export type ActiveSketchPreview = SketchPreviewModel;

/**
 * Returns the active sketch preview for the current editor position.
 * This public API is consumed by the VS Code extension. Keeping the function name
 * stable lets the richer preview model replace the primitive-only preview
 * without changing editor integration call sites.
 */
export function findActiveSketchPreview(
  source: string,
  filePath: string,
  line: number,
  col: number,
  fileMap: Readonly<Record<string, string>> = {},
): ActiveSketchPreview | null {
  return findEvaluatedSketchPreview(source, filePath, line, col, fileMap);
}

/**
 * Returns sketch previews from the supplied input.
 */
export function findSketchPreviews(
  source: string,
  filePath: string,
  fileMap: Readonly<Record<string, string>> = {},
): SketchPreviewModel[] {
  return findEvaluatedSketchPreviews(source, filePath, fileMap);
}
