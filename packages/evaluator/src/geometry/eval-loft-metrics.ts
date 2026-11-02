/**
 * @author Aidan Boissonneault
 * @file eval-loft-metrics.ts
 * @purpose Evaluates loft metrics for the geometry in evaluator package.
 * @last-edited October 6, 2026
 */

import type { EvalCtx, FaceMetrics } from '../core/eval-types.js';
import {
  metricsForPrimitive,
  profileBoundingBox,
} from '../core/eval-metrics.js';

/**
 * Metric bounds, including width, height, and area.
 */
type MetricBounds = { width: number; height: number; area?: number };
/**
 * Accepted values for loft face are 'top', 'bottom', 'front', 'back', 'left', and 'right'.
 */
type LoftFace = 'top' | 'bottom' | 'front' | 'back' | 'left' | 'right';

/**
 * Registers approximate face and solid metrics for a lofted body.
 * Lofts are first-class solids in the language, so later `within`, `auto`, and
 * face-bound sketch operations need the same symbolic dimensions that extrudes
 * and revolves already publish.
 */
export function registerLoftMetrics(
  ctx: EvalCtx,
  objName: string,
  sketchNames: string[],
  height: number,
): void {
  const bottom = metricBoundsForSketch(ctx, sketchNames[0]);
  const top = metricBoundsForSketch(ctx, sketchNames[sketchNames.length - 1]);
  const side = widestMetricBounds(bottom, top);
  if (!bottom || !top || !side) return;

  ctx.solidMetrics.set(objName, {
    width: side.width,
    height: side.height,
    depth: height,
  });
  registerFaceMetric(ctx, objName, 'top', top, 'z+');
  registerFaceMetric(ctx, objName, 'bottom', bottom, 'z-');
  registerFaceMetric(
    ctx,
    objName,
    'front',
    { width: side.width, height },
    'y-',
  );
  registerFaceMetric(ctx, objName, 'back', { width: side.width, height }, 'y+');
  registerFaceMetric(
    ctx,
    objName,
    'left',
    { width: side.height, height },
    'x-',
  );
  registerFaceMetric(
    ctx,
    objName,
    'right',
    { width: side.height, height },
    'x+',
  );
}

/**
 * Handles metric bounds for sketch in the geometry flow.
 */
function metricBoundsForSketch(
  ctx: EvalCtx,
  sketchName: string | undefined,
): MetricBounds | null {
  if (!sketchName) return null;
  const prim = ctx.sketches.get(sketchName);
  if (!prim) return null;
  const metrics = metricsForPrimitive(prim, sketchName);
  if (metrics) {
    return {
      width: metrics.width,
      height: metrics.height,
      area: metrics.area,
    };
  }
  const bounds = profileBoundingBox(prim);
  if (!bounds) return null;
  const width = bounds.xMax - bounds.xMin;
  const height = bounds.yMax - bounds.yMin;
  return { width, height, area: width * height };
}

/**
 * Handles widest metric bounds in the geometry flow.
 */
function widestMetricBounds(
  a: MetricBounds | null,
  b: MetricBounds | null,
): MetricBounds | null {
  if (!a) return b;
  if (!b) return a;
  return {
    width: Math.max(a.width, b.width),
    height: Math.max(a.height, b.height),
  };
}

/**
 * Handles register face metric in the geometry flow.
 */
function registerFaceMetric(
  ctx: EvalCtx,
  objName: string,
  face: LoftFace,
  bounds: MetricBounds,
  normal: FaceMetrics['normal'],
): void {
  ctx.faceMetrics.set(`${objName}.${face}`, {
    width: bounds.width,
    height: bounds.height,
    area: bounds.area ?? bounds.width * bounds.height,
    normal,
    center: { faceRef: `${objName}.${face}.center` },
  });
}
