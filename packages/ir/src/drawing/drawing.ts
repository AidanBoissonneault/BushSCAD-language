/**
 * @author Aidan Boissonneault
 * @file drawing.ts
 * @purpose Provides drawing behavior for the drawing in IR package.
 * @last-edited October 6, 2026
 */

import type { SourceSpan, CompileError } from '../shared/ir.js';
import type { ViewFace } from '../ast/drawing.js';

/**
 * Drawing view ir, including obj name, face, and scale.
 */
export type DrawingViewIR = {
  objName: string;
  face: ViewFace;
  scale: number; // resolved, defaults to 1
};

/**
 * Drawing dimension ir is tagged by kind: 'obj_extent' carries obj name, axis and
 * 'point_to_face' carries from obj name, from face, to obj name.
 */
export type DrawingDimensionIR =
  | { kind: 'obj_extent'; objName: string; axis: 'width' | 'height' | 'depth' }
  | {
      kind: 'point_to_face';
      fromObjName: string;
      fromFace: string;
      toObjName: string;
      toFace: string;
    };

/**
 * Drawing output ir, including name, view, dimensions, export dxf path, and export svg path.
 */
export type DrawingOutputIR = {
  name: string;
  view: DrawingViewIR;
  dimensions: DrawingDimensionIR[];
  exportDxfPath: string | null;
  exportSvgPath: string | null;
  span: SourceSpan;
};

/**
 * Drawing program, including drawings.
 */
export type DrawingProgram = {
  drawings: DrawingOutputIR[];
};

/**
 * Result of drawing, including name, dxf content, svg content, export dxf path, and export svg
 * path.
 */
export type DrawingResult = {
  name: string;
  dxfContent: string | null;
  svgContent: string | null;
  exportDxfPath: string | null;
  exportSvgPath: string | null;
  errors: CompileError[];
};
