/**
 * @author Aidan Boissonneault
 * @file drawing-dimensions.ts
 * @purpose Provides drawing dimensions behavior for the drawing in OpenCascade bridge package.
 * @last-edited October 6, 2026
 */

import type { ViewFace } from '@bushscad/ir';
import type {
  Dim2D,
  Edge2DSegment,
  ShapeBounds,
  ViewBounds,
} from './drawing-projection.js';
import { projectPoint } from './drawing-view-geometry.js';

/**
 * Alias for the dynamically loaded OpenCascade bindings, whose generated wrapper API is not
 * fully described by static declarations.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type OC = any;

const WITNESS_GAP = 1.5;
const WITNESS_OVERSHOOT = 1.0;

/** Compute the 2D bounding box of projected drawing edges. */
export function computeViewBounds(edges: Edge2DSegment[]): ViewBounds {
  if (edges.length === 0) {
    return { xMin: 0, xMax: 10, yMin: 0, yMax: 10, width: 10, height: 10 };
  }
  let xMin = Infinity;
  let xMax = -Infinity;
  let yMin = Infinity;
  let yMax = -Infinity;
  for (const e of edges) {
    xMin = Math.min(xMin, e.x1, e.x2);
    xMax = Math.max(xMax, e.x1, e.x2);
    yMin = Math.min(yMin, e.y1, e.y2);
    yMax = Math.max(yMax, e.y1, e.y2);
  }
  return { xMin, xMax, yMin, yMax, width: xMax - xMin, height: yMax - yMin };
}

/** Read the bounding box of an OCCT shape. */
export function readShapeBounds(oc: OC, shape: unknown): ShapeBounds {
  const bbox = new oc.Bnd_Box_1();
  oc.BRepBndLib.Add(shape, bbox, false);
  const xMin = { current: 0 },
    yMin = { current: 0 },
    zMin = { current: 0 };
  const xMax = { current: 0 },
    yMax = { current: 0 },
    zMax = { current: 0 };
  bbox.Get(xMin, yMin, zMin, xMax, yMax, zMax);
  bbox.delete();
  return {
    xMin: xMin.current,
    xMax: xMax.current,
    yMin: yMin.current,
    yMax: yMax.current,
    zMin: zMin.current,
    zMax: zMax.current,
  };
}

/** Get a projected point for a named object face or center. */
export function getFacePoint(
  bounds: ShapeBounds,
  face: string,
  viewFace: ViewFace,
): [number, number] {
  const cx = (bounds.xMin + bounds.xMax) / 2;
  const cy = (bounds.yMin + bounds.yMax) / 2;
  const cz = (bounds.zMin + bounds.zMax) / 2;
  let x3 = cx;
  let y3 = cy;
  let z3 = cz;
  switch (face) {
    case 'left':
      x3 = bounds.xMin;
      break;
    case 'right':
      x3 = bounds.xMax;
      break;
    case 'front':
      y3 = bounds.yMin;
      break;
    case 'back':
      y3 = bounds.yMax;
      break;
    case 'top':
      z3 = bounds.zMax;
      break;
    case 'bottom':
      z3 = bounds.zMin;
      break;
  }
  return projectPoint(x3, y3, z3, viewFace);
}

/**
 * Handles v witness in the drawing flow.
 */
function vWitness(
  geomY: number,
  dimY: number,
  x: number,
): [number, number, number, number] {
  const dir = Math.sign(dimY - geomY) || -1;
  return [x, geomY + WITNESS_GAP * dir, x, dimY - WITNESS_OVERSHOOT * dir];
}

/**
 * Handles h witness in the drawing flow.
 */
function hWitness(
  geomX: number,
  dimX: number,
  y: number,
): [number, number, number, number] {
  const dir = Math.sign(dimX - geomX) || -1;
  return [geomX + WITNESS_GAP * dir, y, dimX - WITNESS_OVERSHOOT * dir, y];
}

/** Build a dimension line from an object extent measurement. */
export function buildExtentDimension(
  bounds: ShapeBounds,
  axis: 'width' | 'height' | 'depth',
  face: ViewFace,
  padding: number,
): Dim2D {
  let value: number;
  let x1: number, y1: number, x2: number, y2: number;
  let w1x1: number, w1y1: number, w1x2: number, w1y2: number;
  let w2x1: number, w2y1: number, w2x2: number, w2y2: number;

  if (face === 'top' || face === 'bottom') {
    if (axis === 'height') {
      value = bounds.yMax - bounds.yMin;
      x1 = bounds.xMin - padding;
      y1 = bounds.yMin;
      x2 = bounds.xMin - padding;
      y2 = bounds.yMax;
      [w1x1, w1y1, w1x2, w1y2] = hWitness(bounds.xMin, x1, bounds.yMin);
      [w2x1, w2y1, w2x2, w2y2] = hWitness(bounds.xMin, x2, bounds.yMax);
    } else {
      value =
        axis === 'width'
          ? bounds.xMax - bounds.xMin
          : bounds.zMax - bounds.zMin;
      x1 = bounds.xMin;
      y1 = bounds.yMin - padding;
      x2 = bounds.xMax;
      y2 = bounds.yMin - padding;
      [w1x1, w1y1, w1x2, w1y2] = vWitness(bounds.yMin, y1, bounds.xMin);
      [w2x1, w2y1, w2x2, w2y2] = vWitness(bounds.yMin, y2, bounds.xMax);
    }
  } else if (axis === 'depth') {
    value = bounds.zMax - bounds.zMin;
    x1 = bounds.xMin - padding;
    y1 = bounds.zMin;
    x2 = bounds.xMin - padding;
    y2 = bounds.zMax;
    [w1x1, w1y1, w1x2, w1y2] = hWitness(bounds.xMin, x1, bounds.zMin);
    [w2x1, w2y1, w2x2, w2y2] = hWitness(bounds.xMin, x2, bounds.zMax);
  } else {
    value = bounds.xMax - bounds.xMin;
    x1 = bounds.xMin;
    y1 = bounds.zMin - padding;
    x2 = bounds.xMax;
    y2 = bounds.zMin - padding;
    [w1x1, w1y1, w1x2, w1y2] = vWitness(bounds.zMin, y1, bounds.xMin);
    [w2x1, w2y1, w2x2, w2y2] = vWitness(bounds.zMin, y2, bounds.xMax);
  }

  const label = value.toFixed(1);
  return {
    x1,
    y1,
    x2,
    y2,
    value,
    label,
    w1x1,
    w1y1,
    w1x2,
    w1y2,
    w2x1,
    w2y1,
    w2x2,
    w2y2,
  };
}

/** Build a point-to-face dimension line with witness lines. */
export function buildPointToFaceDimension(
  from: [number, number],
  to: [number, number],
  padding: number,
): Dim2D {
  const [fx, fy] = from;
  const [tx, ty] = to;
  const dimY = Math.min(fy, ty) - padding;
  const value = Math.sqrt((fx - tx) ** 2 + (fy - ty) ** 2);
  const [w1x1, w1y1, w1x2, w1y2] = vWitness(fy, dimY, fx);
  const [w2x1, w2y1, w2x2, w2y2] = vWitness(ty, dimY, tx);
  return {
    x1: fx,
    y1: dimY,
    x2: tx,
    y2: dimY,
    value,
    label: value.toFixed(1),
    w1x1,
    w1y1,
    w1x2,
    w1y2,
    w2x1,
    w2y1,
    w2x2,
    w2y2,
  };
}
