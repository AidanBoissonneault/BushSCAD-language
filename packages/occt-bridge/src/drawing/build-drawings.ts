/**
 * @author Aidan Boissonneault
 * @file build-drawings.ts
 * @purpose Builds drawings for the drawing in OpenCascade bridge package.
 * @last-edited October 6, 2026
 */

import type {
  CompileError,
  DrawingDimensionIR,
  DrawingOutputIR,
  DrawingProgram,
  DrawingResult,
} from '@bushscad/ir';
import { writeDxf } from '../export/dxf-writer.js';
import { writeSvg } from '../export/svg-writer.js';
import type { OC } from '../bridge/bridge-types.js';
import {
  buildExtentDimension,
  buildPointToFaceDimension,
  computeViewBounds,
  getFacePoint,
  projectShapeToClassifiedEdges,
  projectShapeToFaces,
  readShapeBounds,
  type Dim2D,
  type Face2DPolygon,
} from './drawing-projection.js';

/**
 * Context for drawing build, including oc, shape map, and color map.
 */
type DrawingBuildContext = {
  oc: OC;
  shapeMap: Map<string, OC>;
  colorMap: Map<string, string>;
};
/**
 * Result of dimension build, including dims and errors.
 */
type DimensionBuildResult = {
  dims: Dim2D[];
  errors: CompileError[];
};

/**
 * Builds all drawing export results for a compiled program.
 * Drawing projection, dimension resolution, and output format selection are
 * bridge presentation concerns that should stay out of the geometry build loop.
 */
export function buildDrawingResults(
  oc: OC,
  drawingProgram: DrawingProgram | undefined,
  shapeMap: Map<string, OC>,
  colorMap: Map<string, string>,
): DrawingResult[] {
  if (!drawingProgram || drawingProgram.drawings.length === 0) return [];
  const context = { oc, shapeMap, colorMap };
  return drawingProgram.drawings.map((drawing) =>
    buildDrawingResult(context, drawing),
  );
}

/**
 * Builds drawing result from the supplied inputs.
 */
function buildDrawingResult(
  context: DrawingBuildContext,
  drawing: DrawingOutputIR,
): DrawingResult {
  const shape = context.shapeMap.get(drawing.view.objName);
  if (!shape) {
    return drawingErrorResult(drawing, [
      {
        message: `Drawing '${drawing.name}': object '${drawing.view.objName}' not found in built geometry`,
        span: drawing.span,
      },
    ]);
  }

  try {
    return projectDrawing(context, drawing, shape);
  } catch (err) {
    return drawingErrorResult(drawing, [
      {
        message: `Drawing '${drawing.name}' projection failed: ${errorMessage(err)}`,
        span: drawing.span,
      },
    ]);
  }
}

/**
 * Handles project drawing in the drawing flow.
 */
function projectDrawing(
  context: DrawingBuildContext,
  drawing: DrawingOutputIR,
  shape: OC,
): DrawingResult {
  const fillColor = context.colorMap.get(drawing.view.objName) ?? '#D0D0D0';
  const { visible, hidden } = projectShapeToClassifiedEdges(
    context.oc,
    shape,
    drawing.view.face,
  );
  const faces: Face2DPolygon[] = projectShapeToFaces(
    context.oc,
    shape,
    drawing.view.face,
    fillColor,
  );
  const bounds = computeViewBounds([...visible, ...hidden]);
  const shapeBounds = readShapeBounds(context.oc, shape);
  const padding =
    Math.max(
      shapeBounds.xMax - shapeBounds.xMin,
      shapeBounds.yMax - shapeBounds.yMin,
    ) * 0.15;
  const dimensionResult = buildDrawingDimensions(
    context,
    drawing,
    shape,
    padding,
  );
  const scale = drawing.view.scale;

  return {
    name: drawing.name,
    dxfContent: drawing.exportDxfPath
      ? writeDxf(visible, dimensionResult.dims, bounds, scale)
      : null,
    svgContent: drawing.exportSvgPath
      ? writeSvg(visible, hidden, faces, dimensionResult.dims, bounds, scale)
      : null,
    exportDxfPath: drawing.exportDxfPath,
    exportSvgPath: drawing.exportSvgPath,
    errors: dimensionResult.errors,
  };
}

/**
 * Builds drawing dimensions from the supplied inputs.
 */
function buildDrawingDimensions(
  context: DrawingBuildContext,
  drawing: DrawingOutputIR,
  fallbackShape: OC,
  padding: number,
): DimensionBuildResult {
  const dims: Dim2D[] = [];
  const errors: CompileError[] = [];
  for (const dim of drawing.dimensions) {
    const result = buildDrawingDimension(
      context,
      drawing,
      dim,
      fallbackShape,
      padding,
    );
    if (result.dimension) dims.push(result.dimension);
    if (result.error) errors.push(result.error);
  }
  return { dims, errors };
}

/**
 * Builds drawing dimension from the supplied inputs.
 */
function buildDrawingDimension(
  context: DrawingBuildContext,
  drawing: DrawingOutputIR,
  dim: DrawingDimensionIR,
  fallbackShape: OC,
  padding: number,
): { dimension: Dim2D | null; error: CompileError | null } {
  if (dim.kind === 'obj_extent') {
    const dimShape = context.shapeMap.get(dim.objName) ?? fallbackShape;
    const bounds = readShapeBounds(context.oc, dimShape);
    return {
      dimension: buildExtentDimension(
        bounds,
        dim.axis,
        drawing.view.face,
        padding,
      ),
      error: null,
    };
  }
  return buildPointToFaceDimensionResult(context, drawing, dim, padding);
}

/**
 * Builds point to face dimension result from the supplied inputs.
 */
function buildPointToFaceDimensionResult(
  context: DrawingBuildContext,
  drawing: DrawingOutputIR,
  dim: Extract<DrawingDimensionIR, { kind: 'point_to_face' }>,
  padding: number,
): { dimension: Dim2D | null; error: CompileError | null } {
  const fromShape = context.shapeMap.get(dim.fromObjName);
  const toShape = context.shapeMap.get(dim.toObjName);
  if (!fromShape || !toShape) {
    return {
      dimension: null,
      error: missingDimensionObjectError(drawing, dim, fromShape, toShape),
    };
  }
  const fromBounds = readShapeBounds(context.oc, fromShape);
  const toBounds = readShapeBounds(context.oc, toShape);
  const from = getFacePoint(fromBounds, dim.fromFace, drawing.view.face);
  const to = getFacePoint(toBounds, dim.toFace, drawing.view.face);
  return {
    dimension: buildPointToFaceDimension(from, to, padding),
    error: null,
  };
}

/**
 * Handles missing dimension object error in the drawing flow.
 */
function missingDimensionObjectError(
  drawing: DrawingOutputIR,
  dim: Extract<DrawingDimensionIR, { kind: 'point_to_face' }>,
  fromShape: OC | undefined,
  toShape: OC | undefined,
): CompileError {
  const missing = [
    fromShape ? null : dim.fromObjName,
    toShape ? null : dim.toObjName,
  ].filter((name): name is string => name !== null);
  return {
    message: `Drawing '${drawing.name}': dimension object not found: ${missing.join(', ')}`,
    span: drawing.span,
  };
}

/**
 * Handles drawing error result in the drawing flow.
 */
function drawingErrorResult(
  drawing: DrawingOutputIR,
  errors: CompileError[],
): DrawingResult {
  return {
    name: drawing.name,
    dxfContent: null,
    svgContent: null,
    exportDxfPath: drawing.exportDxfPath,
    exportSvgPath: drawing.exportSvgPath,
    errors,
  };
}

/**
 * Converts the supplied value into readable error text.
 */
function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
