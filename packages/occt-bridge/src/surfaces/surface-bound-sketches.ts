/**
 * @author Aidan Boissonneault
 * @file surface-bound-sketches.ts
 * @purpose Provides surface bound sketches behavior for the surfaces in OpenCascade bridge package.
 * @last-edited October 6, 2026
 */

import type { SourceSpan } from '@bushscad/ir';
import type { GroupBuildState, OC } from '../bridge/bridge-types.js';
import { configureBooleanBuilder } from '../operations/boolean-operations.js';
import { occtError } from '../core/occt-errors.js';
import { parseFaceRef } from '../core/program-utils.js';

/**
 * Clips a placed sketch face to its declared `on` target face.
 * Surface-bound sketches are authored as local details on a host face. The
 * sketch plane may be larger than the host, so downstream extrude/cut must use
 * only the portion that lies on the host surface.
 */
export function clipSurfaceBoundSketchFace(
  oc: OC,
  state: GroupBuildState,
  sketchName: string,
  placedFace: OC,
  span: SourceSpan,
): OC {
  const placement = state.surfaceBoundSketches.get(sketchName);
  if (!placement) return placedFace;

  const targetFace = resolveBoundTargetFace(state, placement.faceRef, span);
  const Common = oc.BRepAlgoAPI_Common_3 ?? oc.BRepAlgoAPI_Common_2;
  if (typeof Common !== 'function') {
    throw occtError(
      'Surface-bound sketch clipping is not available in this OpenCascade build',
      span,
    );
  }

  const common = new Common(placedFace, targetFace);
  try {
    configureBooleanBuilder(oc, common, { useGlue: false, simplify: false });
    common.Build?.();
    if (common.IsDone?.() === false) {
      throw occtError('Surface-bound sketch clipping failed', span);
    }
    return common.Shape();
  } finally {
    common.delete?.();
  }
}

/**
 * Resolves bound target face against the current shape and its topology labels.
 */
function resolveBoundTargetFace(
  state: GroupBuildState,
  faceRef: string,
  span: SourceSpan,
): OC {
  const parsed = parseFaceRef(faceRef);
  if (!parsed.face) {
    throw occtError(
      `Surface-bound sketch target '${faceRef}' must resolve to a face`,
      span,
    );
  }

  const owner = state.bodyOwners.get(parsed.objName);
  const candidates =
    owner && owner !== parsed.objName
      ? [parsed.objName, owner]
      : [parsed.objName];
  for (const name of candidates) {
    const faces = state.labelMap.getFaceHandles(
      name,
      parsed.face,
      parsed.qualifier ?? 'outer',
    );
    if (faces.length > 0) return faces[0];
  }

  throw occtError(
    `Surface-bound sketch target '${faceRef}' did not resolve to a face`,
    span,
  );
}
