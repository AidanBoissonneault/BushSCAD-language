/**
 * @author Aidan Boissonneault
 * @file surface.ts
 * @purpose Provides surface behavior for the geometry in IR package.
 * @last-edited October 6, 2026
 */

import type {
  IRFaceLabel,
  MaterialAppearance,
  SourceSpan,
} from '../shared/ir.js';

/**
 * Ir surface fill, including operation kind, name, boundary, selection, and material.
 */
export type IRSurfaceFill = {
  kind: 'surface';
  name: string;
  boundary: IRFaceLabel;
  selection?: import('../references/resolved-selection.js').ResolvedSelection;
  material?: MaterialAppearance | null;
  span: SourceSpan;
};

/**
 * Ir surface offset, including operation kind, name, source, distance, and material.
 */
export type IRSurfaceOffset = {
  kind: 'surfaceOffset';
  name: string;
  source: string;
  distance: number;
  material?: MaterialAppearance | null;
  span: SourceSpan;
};

/**
 * Ir surface thicken, including operation kind, obj name, surface name, thickness, and material.
 */
export type IRSurfaceThicken = {
  kind: 'surfaceThicken';
  objName: string;
  surfaceName: string;
  thickness: number;
  material?: MaterialAppearance | null;
  span: SourceSpan;
};

/**
 * Ir surface op accepts IRSurfaceFill, IRSurfaceOffset, and IRSurfaceThicken.
 */
export type IRSurfaceOp = IRSurfaceFill | IRSurfaceOffset | IRSurfaceThicken;
