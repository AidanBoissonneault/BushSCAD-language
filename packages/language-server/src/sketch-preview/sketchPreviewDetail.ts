/**
 * @author Aidan Boissonneault
 * @file sketchPreviewDetail.ts
 * @purpose Provides sketch preview detail behavior for the sketch preview in language server package.
 * @last-edited October 6, 2026
 */

import type { SketchPreviewDetail } from '@bushscad/ir';

/**
 * Handles detail in the sketch preview flow.
 */
export function detail(
  kind: SketchPreviewDetail['kind'],
  label: string,
  value: string,
): SketchPreviewDetail {
  return { kind, label, value };
}
