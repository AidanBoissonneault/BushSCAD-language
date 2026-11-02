/**
 * @author Aidan Boissonneault
 * @file eval-metrics.ts
 * @purpose Evaluates metrics for the core in evaluator package.
 * @last-edited October 6, 2026
 */

import type { IRPrimitive, RevolveOp } from '@bushscad/ir';
import {
  bounds2FromPoints,
  findPlantLineSegment,
  normalize2,
  profilePointToRevolveLocal,
  profileVectorToRevolveLocal,
  revolvePlantLineLocalNormal,
} from '@bushscad/ir';
import type { EvalCtx, FaceMetrics, PlantAnchorInfo } from './eval-types.js';
import { registerExtrudeProfileAnchor } from '../sketch/eval-profile-anchors.js';

const GEOM_EPS = 1e-7;

// Primitive geometry helpers

/**
 * Handles metrics for primitive in the core flow.
 */
export function metricsForPrimitive(
  prim: IRPrimitive,
  objName: string,
): FaceMetrics | null {
  if (prim.kind === 'rect' || prim.kind === 'roundrect') {
    const width = prim.width;
    const height = prim.height;
    return {
      width,
      height,
      area: width * height,
      normal: 'z+',
      center: { faceRef: `${objName}.top.center` },
    };
  }
  if (prim.kind === 'circle') {
    const width = prim.diameter;
    const height = prim.diameter;
    return {
      width,
      height,
      area: Math.PI * (prim.diameter / 2) ** 2,
      normal: 'z+',
      center: { faceRef: `${objName}.top.center` },
    };
  }
  return null;
}

/**
 * Registers face and solid metrics after emitting an extrude or cut operation.
 */
export function registerObjectMetricsWithDepth(
  ctx: EvalCtx,
  objName: string,
  sketchName: string,
  depth: number,
): void {
  const prim = ctx.sketches.get(sketchName);
  if (!prim) return;
  registerExtrudeProfileAnchor(ctx, objName, prim);
  const metrics = metricsForPrimitive(prim, objName);
  if (!metrics) return;
  if (depth > 0 && 'width' in prim && 'height' in prim) {
    ctx.solidMetrics.set(objName, {
      width: prim.width,
      height: prim.height,
      depth,
    });
  }
  ctx.faceMetrics.set(`${objName}.top`, {
    ...metrics,
    normal: 'z+',
    center: { faceRef: `${objName}.top.center` },
  });
  ctx.faceMetrics.set(`${objName}.bottom`, {
    ...metrics,
    normal: 'z-',
    center: { faceRef: `${objName}.bottom.center` },
  });

  if (depth <= 0 || !('width' in prim) || !('height' in prim)) return;

  const width = prim.width;
  const height = prim.height;
  const sideDepth = depth;
  ctx.faceMetrics.set(`${objName}.front`, {
    width,
    height: sideDepth,
    area: width * sideDepth,
    normal: 'y-',
    center: { faceRef: `${objName}.front.center` },
  });
  ctx.faceMetrics.set(`${objName}.back`, {
    width,
    height: sideDepth,
    area: width * sideDepth,
    normal: 'y+',
    center: { faceRef: `${objName}.back.center` },
  });
  ctx.faceMetrics.set(`${objName}.left`, {
    width: height,
    height: sideDepth,
    area: height * sideDepth,
    normal: 'x-',
    center: { faceRef: `${objName}.left.center` },
  });
  ctx.faceMetrics.set(`${objName}.right`, {
    width: height,
    height: sideDepth,
    area: height * sideDepth,
    normal: 'x+',
    center: { faceRef: `${objName}.right.center` },
  });
}

/**
 * Builds the profile data required by the current operation.
 */
export function profileBoundingBox(
  prim: IRPrimitive,
): { xMin: number; xMax: number; yMin: number; yMax: number } | null {
  if (prim.kind === 'rect') {
    return { xMin: 0, xMax: prim.width, yMin: 0, yMax: prim.height };
  }
  if (prim.kind === 'circle') {
    const r = prim.diameter / 2;
    return { xMin: 0, xMax: r, yMin: -r, yMax: r };
  }
  if (prim.kind === 'roundrect') {
    return { xMin: 0, xMax: prim.width, yMin: 0, yMax: prim.height };
  }
  if (prim.kind === 'polygon') {
    return pointsBounds(prim.points);
  }
  if (prim.kind === 'profile') {
    return pointsBounds(prim.segments.flatMap((seg) => [seg.from, seg.to]));
  }
  if (prim.kind === 'sketchAt') {
    const bounds = profileBoundingBox(prim.primitive);
    return bounds
      ? {
          xMin: bounds.xMin + prim.x,
          xMax: bounds.xMax + prim.x,
          yMin: bounds.yMin + prim.y,
          yMax: bounds.yMax + prim.y,
        }
      : null;
  }
  if (prim.kind === 'sketchBoolean') {
    const left = profileBoundingBox(prim.left);
    const right = profileBoundingBox(prim.right);
    if (!left) return right;
    if (!right) return left;
    return {
      xMin: Math.min(left.xMin, right.xMin),
      xMax: Math.max(left.xMax, right.xMax),
      yMin: Math.min(left.yMin, right.yMin),
      yMax: Math.max(left.yMax, right.yMax),
    };
  }
  if (prim.kind === 'sketchRef') return null;
  return null;
}

/**
 * Handles points bounds in the core flow.
 */
function pointsBounds(
  points: Iterable<readonly [number, number]>,
): { xMin: number; xMax: number; yMin: number; yMax: number } | null {
  return bounds2FromPoints(points);
}

/**
 * Handles revolve plant anchor for primitive in the core flow.
 */
function revolvePlantAnchorForPrimitive(
  prim: IRPrimitive,
  axis: 'x' | 'y' | 'z',
  radiusOffset = 0,
): Omit<PlantAnchorInfo, 'ref'> | null {
  if (prim.kind === 'polygon') {
    if (!prim.plant || prim.points.length === 0) return null;
    const yMin = Math.min(...prim.points.map(([, y]) => y));
    return {
      localPoint: profilePointToRevolveLocal(axis, 0, yMin),
      localNormal: profileVectorToRevolveLocal(axis, 0, -1),
    };
  }
  if (prim.kind === 'sketchRef') return null;

  const segment = findPlantLineSegment(prim);
  if (!segment) return null;

  const [radialNormal] = normalize2(
    segment.to[1] - segment.from[1],
    segment.from[0] - segment.to[0],
  );
  const radialCenter =
    Math.abs(radialNormal) <= GEOM_EPS
      ? 0
      : (segment.from[0] + segment.to[0]) / 2 + radiusOffset;
  const axisCenter = (segment.from[1] + segment.to[1]) / 2;

  return {
    faceName: segment.name,
    localPoint: profilePointToRevolveLocal(axis, radialCenter, axisCenter),
    localNormal: revolvePlantLineLocalNormal(segment.from, segment.to, axis),
  };
}

/**
 * Registers approximate face and solid metrics for a revolve operation using
 * the profile sketch bounds.
 */
export function registerRevolveMetrics(
  ctx: EvalCtx,
  irName: string,
  sketchName: string,
  radiusOffset?: number,
  around?: RevolveOp['around'],
): void {
  const prim = ctx.sketches.get(sketchName);
  if (!prim) return;
  const bb = profileBoundingBox(prim);
  if (!bb) return;

  const offset = radiusOffset ?? 0;
  const maxRadius = bb.xMax + offset;
  const axisExtent = bb.yMax - bb.yMin;
  const diam = maxRadius * 2;

  ctx.solidMetrics.set(irName, {
    width: diam,
    height: diam,
    depth: axisExtent,
  });

  const faceW: FaceMetrics = {
    width: diam,
    height: diam,
    area: Math.PI * maxRadius * maxRadius,
    normal: 'z+',
    center: { faceRef: `${irName}.top.center` },
  };
  ctx.faceMetrics.set(`${irName}.top`, {
    ...faceW,
    normal: 'z+',
    center: { faceRef: `${irName}.top.center` },
  });
  ctx.faceMetrics.set(`${irName}.bottom`, {
    ...faceW,
    normal: 'z-',
    center: { faceRef: `${irName}.bottom.center` },
  });

  const sideW: FaceMetrics = {
    width: diam,
    height: axisExtent,
    area: diam * axisExtent,
    normal: 'x+',
    center: { faceRef: `${irName}.right.center` },
  };
  ctx.faceMetrics.set(`${irName}.front`, {
    ...sideW,
    normal: 'y-',
    center: { faceRef: `${irName}.front.center` },
  });
  ctx.faceMetrics.set(`${irName}.back`, {
    ...sideW,
    normal: 'y+',
    center: { faceRef: `${irName}.back.center` },
  });
  ctx.faceMetrics.set(`${irName}.left`, {
    ...sideW,
    normal: 'x-',
    center: { faceRef: `${irName}.left.center` },
  });
  ctx.faceMetrics.set(`${irName}.right`, {
    ...sideW,
    normal: 'x+',
    center: { faceRef: `${irName}.right.center` },
  });

  if (typeof around === 'string') {
    const plant = revolvePlantAnchorForPrimitive(prim, around, offset);
    if (plant) {
      ctx.plantAnchors.set(irName, {
        ref: `${irName}.bottom.center`,
        ...plant,
      });
    }
  }
}
