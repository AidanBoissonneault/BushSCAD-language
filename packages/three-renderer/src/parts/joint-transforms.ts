/**
 * @author Aidan Boissonneault
 * @file joint-transforms.ts
 * @purpose Provides joint transforms behavior for the parts in three renderer package.
 * @last-edited October 6, 2026
 */

import type { ResolvedJointData } from '@bushscad/ir';
import * as THREE from 'three';

/**
 * Joint part transform, including position and quaternion.
 */
export type JointPartTransform = {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
};

/** Clamps one authored joint value to its optional motion limits. */
export function clampJointValue(
  joint: ResolvedJointData,
  value: number,
): number {
  return Math.max(
    joint.limitMin ?? Number.NEGATIVE_INFINITY,
    Math.min(joint.limitMax ?? Number.POSITIVE_INFINITY, value),
  );
}

/** Derives preview-only part transforms from resolved joint metadata. */
export function jointPartTransforms(
  joints: readonly ResolvedJointData[],
  values: ReadonlyMap<string, number>,
): Map<string, JointPartTransform> {
  const transforms = new Map<string, JointPartTransform>();
  for (const joint of joints) {
    const value = clampJointValue(
      joint,
      values.get(joint.name) ?? joint.defaultValue,
    );
    const origin = new THREE.Vector3(...joint.origin);
    const axis = new THREE.Vector3(...joint.axis).normalize();
    if (joint.jointType === 'revolute' || joint.jointType === 'ball') {
      const quaternion = new THREE.Quaternion().setFromAxisAngle(
        axis,
        THREE.MathUtils.degToRad(value),
      );
      const position = origin
        .clone()
        .add(new THREE.Vector3().sub(origin).applyQuaternion(quaternion));
      transforms.set(joint.movingPartName, { position, quaternion });
    } else if (joint.jointType === 'slider' || joint.jointType === 'planar') {
      transforms.set(joint.movingPartName, {
        position: axis.multiplyScalar(value),
        quaternion: new THREE.Quaternion(),
      });
    }
  }
  return transforms;
}
