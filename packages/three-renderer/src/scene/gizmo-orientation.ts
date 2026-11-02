/**
 * @author Aidan Boissonneault
 * @file gizmo-orientation.ts
 * @purpose Provides gizmo orientation behavior for the scene in three renderer package.
 * @last-edited October 6, 2026
 */

import * as THREE from 'three';

/**
 * Handles align plane to normal in the scene flow.
 */
export function alignPlaneToNormal(
  mesh: THREE.Object3D,
  n: THREE.Vector3,
): void {
  if (n.x !== 0) mesh.rotation.y = n.x > 0 ? Math.PI / 2 : -Math.PI / 2;
  else if (n.y !== 0) mesh.rotation.x = n.y > 0 ? -Math.PI / 2 : Math.PI / 2;
  else if (n.z < 0) mesh.rotation.x = Math.PI;
}

/**
 * Handles snap preset in the scene flow.
 */
export function snapPreset(raw: THREE.Vector3): THREE.Vector3 {
  const dir = raw.clone().normalize();
  const components = [
    { axis: 'x' as const, value: Math.abs(dir.x), sign: Math.sign(dir.x) || 1 },
    { axis: 'y' as const, value: Math.abs(dir.y), sign: Math.sign(dir.y) || 1 },
    { axis: 'z' as const, value: Math.abs(dir.z), sign: Math.sign(dir.z) || 1 },
  ].sort((a, b) => b.value - a.value);

  const keep =
    components[1].value / components[0].value < 0.42
      ? 1
      : components[2].value / components[0].value < 0.42
        ? 2
        : 3;

  const out = new THREE.Vector3();
  for (const part of components.slice(0, keep)) out[part.axis] = part.sign;
  return out.normalize();
}

/**
 * Handles direction key in the scene flow.
 */
export function directionKey(dir: THREE.Vector3 | null): string {
  if (!dir) return '';
  const snapped = snapPreset(dir);
  return [snapped.x, snapped.y, snapped.z]
    .map((v) => Math.round(v * 100) / 100)
    .join(',');
}
