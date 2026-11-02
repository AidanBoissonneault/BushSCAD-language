/**
 * @author Aidan Boissonneault
 * @file joint-resolution.ts
 * @purpose Provides joint resolution behavior for the operations in OpenCascade bridge package.
 * @last-edited October 6, 2026
 */

import type { IROp, IRJoint, ResolvedJointData } from '@bushscad/ir';
import type { FaceLabelMap } from '../topology/face-labels.js';
import type { OC } from '../bridge/bridge-types.js';

/**
 * Extracts body or part roots that are controlled by joints in an operation list.
 * Joint-controlled bodies need their own renderer mesh group. If they are
 * compounded with same-material siblings, the viewport has no separate target
 * to move when the joint value changes.
 */
export function movingJointBodyNames(ops: IROp[]): Set<string> {
  const names = new Set<string>();
  for (const op of ops) {
    if (op.kind !== 'joint') continue;
    names.add(op.sideA.split('.')[0]);
  }
  return names;
}

/**
 * Resolves joint declarations against the active label scope.
 * Joints can be declared inside a part and reference local body labels, while
 * top-level assembly joints can reference previously built parts through the
 * label map fallback chain.
 */
export function resolveJointsForOps(
  oc: OC,
  ops: IROp[],
  labels: FaceLabelMap,
): ResolvedJointData[] {
  const result: ResolvedJointData[] = [];
  for (const op of ops) {
    if (op.kind !== 'joint') continue;
    const joint = op as IRJoint;
    const axisData = labels.resolveJointAxisRaw(oc, joint.sideA);
    if (!axisData) continue;
    result.push({
      name: joint.name,
      jointType: joint.jointType,
      limitMin: joint.limitMin,
      limitMax: joint.limitMax,
      defaultValue: joint.defaultValue ?? 0,
      origin: axisData.origin as [number, number, number],
      axis: axisData.axis as [number, number, number],
      movingPartName: joint.sideA.split('.')[0],
      staticPartName: joint.sideB.split('.')[0],
    });
  }
  return result;
}
