/**
 * @author Aidan Boissonneault
 * @file draft-face-handles.ts
 * @purpose Provides draft face handles behavior for the operations in OpenCascade bridge package.
 * @last-edited October 6, 2026
 */

import type { FaceLabelMap } from '../topology/face-labels.js';
import { parseFaceRef } from '../core/program-utils.js';

/**
 * Returns draft face handles from the supplied input.
 */
export function getDraftFaceHandles(
  labelMap: FaceLabelMap,
  target: string,
): unknown[] {
  const parsed = parseFaceRef(target);
  const qualifier = parsed.qualifier;
  if (isAllSidesRef(target, parsed)) {
    return (['front', 'back', 'left', 'right'] as const).flatMap((dir) =>
      labelMap.getFaceHandles(parsed.objName, dir, qualifier),
    );
  }
  return labelMap.getFaceHandles(
    parsed.objName,
    parsed.face ?? 'front',
    qualifier,
  );
}

/**
 * Returns whether the input meets the `all sides ref` condition.
 */
function isAllSidesRef(
  target: string,
  parsed: ReturnType<typeof parseFaceRef>,
): boolean {
  const parts = target.split('.');
  const faceTokenIndex = parsed.qualifier ? 2 : 1;
  return (
    parts[faceTokenIndex] === 'sides' && parts.length === faceTokenIndex + 1
  );
}
