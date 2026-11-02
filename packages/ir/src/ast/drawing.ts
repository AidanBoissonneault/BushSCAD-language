/**
 * @author Aidan Boissonneault
 * @file drawing.ts
 * @purpose Provides drawing behavior for the ast in IR package.
 * @last-edited October 6, 2026
 */

import type { ASTSourceSpan } from './sourceSpan.js';

/**
 * Accepted values for view face are 'top', 'bottom', 'front', 'back', 'left', and 'right'.
 */
export type ViewFace = 'top' | 'bottom' | 'front' | 'back' | 'left' | 'right';

/**
 * Drawing view decl, including obj name, face, scale, and span.
 */
export type DrawingViewDecl = {
  objName: string;
  face: ViewFace;
  scale: number | null;
  span: ASTSourceSpan;
};

/**
 * Dimension ref is tagged by kind: 'obj_extent' carries obj name, axis and 'point_to_face'
 * carries from obj name, from face, to obj name.
 */
export type DimensionRef =
  | { kind: 'obj_extent'; objName: string; axis: 'width' | 'height' | 'depth' }
  | {
      kind: 'point_to_face';
      fromObjName: string;
      fromFace: string;
      toObjName: string;
      toFace: string;
    };

/**
 * Dimension decl, including operation kind, ref, and span.
 */
export type DimensionDecl = {
  kind: 'dimension';
  ref: DimensionRef;
  span: ASTSourceSpan;
};

/**
 * Drawing decl, including operation kind, name, view, dimensions, and export dxf path.
 */
export type DrawingDecl = {
  kind: 'drawing';
  name: string;
  view: DrawingViewDecl;
  dimensions: DimensionDecl[];
  exportDxfPath: string | null;
  exportSvgPath: string | null;
  span: ASTSourceSpan;
};
