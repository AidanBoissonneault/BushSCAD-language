/**
 * @author Aidan Boissonneault
 * @file part-group-layout.ts
 * @purpose Provides part group layout behavior for the core in three renderer package.
 * @last-edited October 6, 2026
 */

import * as THREE from 'three';
import { computePartLayout } from './part-layout.js';
import type { PartLayoutOffset } from './plate-layout.js';

/**
 * Options for part group layout, including exploded parts, plate offsets, and gap mm.
 */
export type PartGroupLayoutOptions = {
  explodedParts: Set<string> | null;
  plateOffsets: ReadonlyMap<string, PartLayoutOffset> | null;
  gapMm: number;
};

/**
 * Applies either explicit plate offsets or the legacy X-axis explode layout.
 * All outer part-group placement is kept outside the renderer lifecycle so
 * print layout cannot diverge from the established explode behavior.
 */
export function applyPartGroupLayout(
  groups: ReadonlyMap<string, THREE.Group>,
  options: PartGroupLayoutOptions,
): void {
  if (options.plateOffsets) {
    applyPlateOffsets(groups, options.plateOffsets);
    return;
  }
  const set = options.explodedParts;
  if (!set) {
    for (const group of groups.values()) group.position.set(0, 0, 0);
    return;
  }
  const inputs = explodeLayoutInputs(groups, set);
  if (inputs.length < 2) return;
  const offsets = computePartLayout(inputs, options.gapMm);
  for (const [name, group] of groups) {
    group.position.set(offsets.get(name) ?? 0, 0, 0);
  }
}

/**
 * Applies plate offsets to the supplied state or geometry.
 */
function applyPlateOffsets(
  groups: ReadonlyMap<string, THREE.Group>,
  offsets: ReadonlyMap<string, PartLayoutOffset>,
): void {
  for (const [name, group] of groups) {
    const offset = offsets.get(name);
    group.position.set(offset?.x ?? 0, offset?.y ?? 0, offset?.z ?? 0);
  }
}

/**
 * Handles explode layout inputs in the core flow.
 */
function explodeLayoutInputs(
  groups: ReadonlyMap<string, THREE.Group>,
  selected: Set<string>,
): Array<{
  name: string;
  spanX: number;
  minX: number;
  spanY: number;
  spanZ: number;
}> {
  const inputs: Array<{
    name: string;
    spanX: number;
    minX: number;
    spanY: number;
    spanZ: number;
  }> = [];
  const box = new THREE.Box3();
  for (const [name, group] of groups) {
    group.position.set(0, 0, 0);
    if (!selected.has(name)) continue;
    box.setFromObject(group);
    inputs.push({
      name,
      spanX: box.isEmpty() ? 0 : box.max.x - box.min.x,
      minX: box.isEmpty() ? 0 : box.min.x,
      spanY: box.isEmpty() ? 0 : box.max.y - box.min.y,
      spanZ: box.isEmpty() ? 0 : box.max.z - box.min.z,
    });
  }
  return inputs;
}
