/**
 * @author Aidan Boissonneault
 * @file interaction-bounds.ts
 * @purpose Provides interaction bounds behavior for the scene in three renderer package.
 * @last-edited October 6, 2026
 */

import * as THREE from 'three';

/**
 * Handles combined interaction bounds in the scene flow.
 */
export function combinedInteractionBounds(
  model: THREE.Box3 | null,
  sketches: THREE.Box3 | null,
): THREE.Box3 | null {
  if (!model) return sketches;
  return sketches ? model.union(sketches) : model;
}
