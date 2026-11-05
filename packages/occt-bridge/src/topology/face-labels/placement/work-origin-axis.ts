import type { Workplane } from '@bushscad/ir';
import type { FaceDir } from '../../../core/program-utils.js';
import { workplaneFrame } from '../../frame-utils.js';
import {
  dirToNormal,
  dirToOffsetAxes,
  toWorldVector,
  type OC,
} from '../../face-placement-transform.js';

/**
 * Builds an origin placement axis from a workplane and one of its six sides.
 *
 * Why: the global origin has no shape entry, but placements still need the
 * same oriented frame and offset behavior as a face on a solid.
 */
export function makeWorkOriginAxis(
  oc: OC,
  workplane: Workplane,
  direction: FaceDir,
): unknown {
  const frame = workplaneFrame(workplane);
  const normal = toWorldVector(dirToNormal(direction), frame);
  const tangent = toWorldVector(dirToOffsetAxes(direction)[0], frame);
  const origin = new oc.gp_Pnt_3(0, 0, 0);
  const normalDirection = new oc.gp_Dir_4(...normal);
  const xDirection = new oc.gp_Dir_4(...tangent);
  const axis = new oc.gp_Ax2_2(origin, normalDirection, xDirection);
  origin.delete();
  normalDirection.delete();
  xDirection.delete();
  return axis;
}
