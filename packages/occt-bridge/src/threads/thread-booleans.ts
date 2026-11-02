/**
 * @author Aidan Boissonneault
 * @file thread-booleans.ts
 * @purpose Provides thread booleans behavior for the threads in OpenCascade bridge package.
 * @last-edited October 6, 2026
 */

import type { IRThread, SourceSpan } from '@bushscad/ir';
import type { OC } from '../bridge/bridge-types.js';
import { readBounds, type Bounds } from '../core/geometry-utils.js';
import { occtError } from '../core/occt-errors.js';

/**
 * Applies a boolean cut for thread tools and validates the resulting body.
 * Thread tools are intentionally close to the target surface. A failed boolean
 * must stop compilation instead of replacing the body with empty geometry.
 */
export function applyThreadBoolCut(
  oc: OC,
  target: OC,
  tool: OC,
  span: SourceSpan,
  originalBounds: Bounds,
  threadType: IRThread['threadType'],
  threadDepth: number,
): OC {
  const cutter = new oc.BRepAlgoAPI_Cut_3(target, tool);
  return finishThreadBoolean(
    oc,
    cutter,
    span,
    originalBounds,
    threadType,
    threadDepth,
    'Thread cut failed',
  );
}

/**
 * Applies a boolean fuse for added internal thread ridges.
 * Internal handed threads are more stable as material fused into a major bore
 * than as a subtractive helical cutter through the bore wall.
 */
export function applyThreadBoolFuse(
  oc: OC,
  target: OC,
  tool: OC,
  span: SourceSpan,
  originalBounds: Bounds,
  threadType: IRThread['threadType'],
  threadDepth: number,
): OC {
  const fuser = new oc.BRepAlgoAPI_Fuse_3(target, tool);
  return finishThreadBoolean(
    oc,
    fuser,
    span,
    originalBounds,
    threadType,
    threadDepth,
    'Thread fuse failed',
  );
}

/**
 * Completes thread boolean and records its final state.
 */
function finishThreadBoolean(
  oc: OC,
  operation: OC,
  span: SourceSpan,
  originalBounds: Bounds,
  threadType: IRThread['threadType'],
  threadDepth: number,
  errorMessage: string,
): OC {
  operation.Build?.();
  if (operation.IsDone && !operation.IsDone()) {
    operation.delete?.();
    throw occtError(errorMessage, span);
  }
  const result = operation.Shape();
  operation.delete?.();
  validateThreadResult(
    oc,
    result,
    originalBounds,
    threadType,
    threadDepth,
    span,
  );
  return result;
}

/**
 * Validates thread result and reports any violations.
 */
function validateThreadResult(
  oc: OC,
  result: OC,
  original: Bounds,
  threadType: IRThread['threadType'],
  threadDepth: number,
  span: SourceSpan,
): void {
  const next = readBounds(oc, result);
  const originalDims = boundsDims(original);
  const nextDims = boundsDims(next);
  if (
    nextDims.some((dim) => !Number.isFinite(dim) || dim <= 1e-6) ||
    originalDims.some((dim) => !Number.isFinite(dim) || dim <= 1e-6)
  ) {
    throw occtError('Thread operation produced invalid geometry', span);
  }
  const minRatio = threadType === 'external' ? 0.65 : 0.5;
  if (nextDims.some((dim, i) => dim < originalDims[i] * minRatio)) {
    throw occtError(
      'Thread operation removed too much of the target body',
      span,
    );
  }
  if (threadType === 'external') {
    const allowedShrink = Math.max(threadDepth * 2.5, 0.25);
    if (nextDims.some((dim, i) => dim < originalDims[i] - allowedShrink)) {
      throw occtError('External thread operation collapsed the shaft', span);
    }
  }
}

/**
 * Calculates the bounds of the supplied geometry.
 */
function boundsDims(bounds: Bounds): [number, number, number] {
  return [
    bounds.xMax.current - bounds.xMin.current,
    bounds.yMax.current - bounds.yMin.current,
    bounds.zMax.current - bounds.zMin.current,
  ];
}
