/**
 * @author Aidan Boissonneault
 * @file preview.ts
 * @purpose Provides preview behavior for the rendering in model analysis package.
 * @last-edited October 6, 2026
 */

import { resolve } from 'node:path';
import { previewFile } from '@bushscad/compiler/node';
import type { ModelAnalysisOptions } from '../types/types.js';

/**
 * Runs the exact Node preview pipeline used by BushSCAD.
 * Geometry analysis is only useful if it inspects the same meshes the app would
 * render, including OCCT trace events and source spans.
 */
export function buildPreview(options: ModelAnalysisOptions) {
  return previewFile({
    filePath: resolve(options.filePath),
    rootPath: options.rootPath ?? null,
    env: options.env ?? {},
    occtTrace: true,
  });
}
