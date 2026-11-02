/**
 * @author Aidan Boissonneault
 * @file profile-loop-solids.ts
 * @purpose Provides profile loop solids behavior for the profiles in OpenCascade bridge package.
 * @last-edited October 6, 2026
 */

import type { IRClosedBody, IRProfileLoop, SourceSpan } from '@bushscad/ir';
import {
  applyStableBoolCommon,
  applyStableBoolCut,
} from '../operations/boolean-operations.js';
import type { OC } from '../bridge/bridge-types.js';
import { makePartFuseOverlapExtrudeInput } from '../operations/additive-overlap.js';
import { occtError } from '../core/occt-errors.js';
import { transformToAxis } from '../primitives/solid-primitive-geometry.js';
import { buildProfileFaceShape } from './profile-faces.js';

/**
 * Options for profile loop extrude, including oc, ax2, depth, symmetric, and span.
 */
export type ProfileLoopExtrudeOptions = {
  oc: OC;
  ax2: OC;
  depth: number;
  symmetric: boolean;
  span: SourceSpan;
  overlapAdditive?: boolean;
  transformLocalFace?: (face: OC) => OC;
  clipPlacedFace?: (face: OC) => OC;
};

/**
 * Result of profile loop solid, including shape and overlapped.
 */
export type ProfileLoopSolidResult = {
  shape: OC;
  overlapped?: true;
};

/**
 * Builds one exact atomic profile-body solid from its source loop membership.
 * Atomic regions can be intersections with other loops removed. Keeping this
 * construction separate lets selection grouping decide whether the resulting
 * solids should remain separate or be fused into one named body.
 */
export function buildProfileBodySolid(
  options: ProfileLoopExtrudeOptions,
  loops: IRProfileLoop[],
  body: IRClosedBody,
): ProfileLoopSolidResult {
  const includeIds = bodyLoopIds(loops, body);
  const shape = cutExcludedLoopSolids(
    options,
    loops,
    commonLoopSolids(options, loops, includeIds),
    body.excludedLoopIds ?? [],
  );
  return {
    shape,
    ...(options.overlapAdditive ? { overlapped: true as const } : {}),
  };
}

/**
 * Handles cut excluded loop solids in the profiles flow.
 */
function cutExcludedLoopSolids(
  options: ProfileLoopExtrudeOptions,
  loops: IRProfileLoop[],
  shape: OC,
  excludeIds: string[],
): OC {
  let result = shape;
  for (const id of excludeIds) {
    const tool = buildLoopSolidById(options, loops, id);
    const next = applyStableBoolCut(
      options.oc,
      result,
      tool.shape,
      options.span,
    );
    result.delete?.();
    tool.shape.delete?.();
    result = next;
  }
  return result;
}

/**
 * Handles common loop solids in the profiles flow.
 */
function commonLoopSolids(
  options: ProfileLoopExtrudeOptions,
  loops: IRProfileLoop[],
  includeIds: string[],
): OC {
  const solids = includeIds.map(
    (id) => buildLoopSolidById(options, loops, id).shape,
  );
  let shape = firstSolid(solids, options.span);
  for (const solid of solids.slice(1)) {
    const next = applyStableBoolCommon(
      options.oc,
      shape,
      solid,
      options.span,
      'Closed body intersection failed',
    );
    shape.delete?.();
    solid.delete?.();
    shape = next;
  }
  return shape;
}

/**
 * Builds loop solid by ID from the supplied inputs.
 */
function buildLoopSolidById(
  options: ProfileLoopExtrudeOptions,
  loops: IRProfileLoop[],
  id: string,
): ProfileLoopSolidResult {
  const loop = loops.find((item) => item.id === id);
  if (!loop)
    throw occtError(`Closed body loop '${id}' was not found`, options.span);
  return buildLoopSolid(options, loop.segments);
}

/**
 * Builds loop solid from the supplied inputs.
 */
function buildLoopSolid(
  options: ProfileLoopExtrudeOptions,
  segments: IRProfileLoop['segments'],
): ProfileLoopSolidResult {
  const face = preparedLoopFace(options, segments);
  const input = extrudeInputForLoop(options, face);
  const shape = extrudeFaceAlongAxis(
    options.oc,
    input.face,
    options.ax2,
    input.depth,
    options.symmetric,
    options.span,
  );
  input.face.delete?.();
  return {
    shape,
    ...('overlapped' in input ? { overlapped: true as const } : {}),
  };
}

/**
 * Handles prepared loop face in the profiles flow.
 */
function preparedLoopFace(
  options: ProfileLoopExtrudeOptions,
  segments: IRProfileLoop['segments'],
): OC {
  const localFace = buildProfileFaceShape(options.oc, [segments], options.span);
  const transformedFace = options.transformLocalFace?.(localFace) ?? localFace;
  if (transformedFace !== localFace) localFace.delete?.();
  const placedFace = transformToAxis(options.oc, transformedFace, options.ax2);
  transformedFace.delete?.();
  return clipPreparedLoopFace(options, placedFace);
}

/**
 * Handles clip prepared loop face in the profiles flow.
 */
function clipPreparedLoopFace(
  options: ProfileLoopExtrudeOptions,
  placedFace: OC,
): OC {
  if (!options.clipPlacedFace) return placedFace;
  const clippedFace = options.clipPlacedFace(placedFace);
  if (clippedFace !== placedFace) placedFace.delete?.();
  return clippedFace;
}

/**
 * Handles extrude input for loop in the profiles flow.
 */
function extrudeInputForLoop(
  options: ProfileLoopExtrudeOptions,
  face: OC,
): { face: OC; depth: number; overlapped?: true } {
  return options.overlapAdditive
    ? makePartFuseOverlapExtrudeInput(
        options.oc,
        face,
        options.ax2,
        options.depth,
        options.span,
      )
    : { face, depth: options.depth };
}

/**
 * Handles extrude face along axis in the profiles flow.
 */
function extrudeFaceAlongAxis(
  oc: OC,
  face: OC,
  ax2: OC,
  depth: number,
  symmetric: boolean,
  span: SourceSpan,
): OC {
  const dir = ax2.Direction();
  const vec = new oc.gp_Vec_4(
    dir.X() * depth,
    dir.Y() * depth,
    dir.Z() * depth,
  );
  const prism = new oc.BRepPrimAPI_MakePrism_1(face, vec, false, true);
  try {
    if (!prism.IsDone()) throw occtError('Extrude failed', span);
    const shape = prism.Shape();
    return symmetric ? centerSymmetricShape(oc, shape, dir, depth) : shape;
  } finally {
    vec.delete?.();
    prism.delete?.();
    dir.delete?.();
  }
}

/**
 * Handles center symmetric shape in the profiles flow.
 */
function centerSymmetricShape(oc: OC, shape: OC, dir: OC, depth: number): OC {
  const trsf = new oc.gp_Trsf_1();
  const halfVec = new oc.gp_Vec_4(
    (-dir.X() * depth) / 2,
    (-dir.Y() * depth) / 2,
    (-dir.Z() * depth) / 2,
  );
  trsf.SetTranslation_1(halfVec);
  const loc = new oc.TopLoc_Location_2(trsf);
  const moved = shape.Located(loc);
  [trsf, halfVec, loc].forEach((item: OC) => item.delete?.());
  return moved;
}

/**
 * Returns the first solid that matches the requested condition.
 */
function firstSolid(solids: OC[], span: SourceSpan): OC {
  if (solids.length === 0)
    throw occtError('No closed bodies selected for profile', span);
  return solids[0];
}

/**
 * Builds the body data required by the current operation.
 */
function bodyLoopIds(loops: IRProfileLoop[], body: IRClosedBody): string[] {
  if (body.loopIds?.length) return body.loopIds;
  return loops
    .filter((loop) =>
      loop.segmentNames.some((name) => body.segmentNames.includes(name)),
    )
    .map((loop) => loop.id);
}
