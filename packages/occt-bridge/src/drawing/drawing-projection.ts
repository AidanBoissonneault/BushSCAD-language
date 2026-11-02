/**
 * @author Aidan Boissonneault
 * @file drawing-projection.ts
 * @purpose Defines and computes 2D projected drawing geometry from 3D shapes.
 * @last-edited October 6, 2026
 */

/**
 * Edge2 d segment, including x1, y1, x2, and y2.
 */

export type Edge2DSegment = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

/**
 * View bounds, including x min, x max, y min, y max, and width.
 */
export type ViewBounds = {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  width: number;
  height: number;
};

/**
 * Dim2 d, including x1, y1, x2, y2, and display value.
 */
export type Dim2D = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  value: number;
  label: string;
  w1x1: number;
  w1y1: number;
  w1x2: number;
  w1y2: number;
  w2x1: number;
  w2y1: number;
  w2x2: number;
  w2y2: number;
};

/**
 * Face2 d polygon, including outer boundary points, inner boundary rings, color, and depth.
 */
export type Face2DPolygon = {
  outerPoints: [number, number][];
  innerRings: [number, number][][];
  color: string;
  depth: number;
};

/**
 * Shape bounds, including x min, x max, y min, y max, and z min.
 */
export type ShapeBounds = {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  zMin: number;
  zMax: number;
};

export {
  computeViewBounds,
  readShapeBounds,
  getFacePoint,
  buildExtentDimension,
  buildPointToFaceDimension,
} from './drawing-dimensions.js';
export {
  projectShapeToClassifiedEdges,
  projectShapeToFaces,
} from './drawing-face-projection.js';
