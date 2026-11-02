/**
 * @author Aidan Boissonneault
 * @file material-shapes.ts
 * @purpose Provides material shapes behavior for the mesh in OpenCascade bridge package.
 * @last-edited October 6, 2026
 */

import type { MaterialAppearance } from '@bushscad/ir';
import type {
  BuiltMaterialShape,
  BuiltPart,
  OC,
} from '../bridge/bridge-types.js';

/**
 * Entry in body material, including shape, material, body name, and is open surface.
 */
type BodyMaterialEntry = {
  shape: OC;
  material: MaterialAppearance | null;
  bodyName: string;
  isOpenSurface?: boolean;
};

/**
 * Builds the material data required by the current operation.
 */
function materialGroupKey(material: MaterialAppearance | null): string {
  return material ? `${material.id}:${material.color}` : '__default__';
}

/**
 * Removes duplicate body entries values while preserving their first occurrence.
 */
export function uniqueBodyEntries(
  bodyShapes: Map<string, OC>,
  bodyMaterials: Map<string, MaterialAppearance | null>,
): BodyMaterialEntry[] {
  const entries: BodyMaterialEntry[] = [];
  const seenShapes = new Set<OC>();
  for (const [owner, shape] of bodyShapes) {
    if (seenShapes.has(shape)) continue;
    seenShapes.add(shape);
    entries.push({
      shape,
      material: bodyMaterials.get(owner) ?? null,
      bodyName: owner,
    });
  }
  return entries;
}

/**
 * Builds material shapes from the supplied inputs.
 */
export function buildMaterialShapes(
  entries: BodyMaterialEntry[],
  buildCompound: (shapes: OC[]) => OC,
  isolatedBodyNames: Set<string> = new Set(),
): BuiltMaterialShape[] {
  const groups = new Map<
    string,
    { material: MaterialAppearance | null; shapes: OC[]; bodyNames: string[] }
  >();
  const isolated: BuiltMaterialShape[] = [];
  for (const entry of entries) {
    if (isolatedBodyNames.has(entry.bodyName)) {
      isolated.push({
        material: entry.material,
        shape: entry.shape,
        bodyName: entry.bodyName,
        ...(entry.isOpenSurface ? { isOpenSurface: true } : {}),
      });
      continue;
    }
    const key = materialGroupKey(entry.material);
    const group = groups.get(key);
    if (group) {
      group.shapes.push(entry.shape);
      group.bodyNames.push(entry.bodyName);
    } else
      groups.set(key, {
        material: entry.material,
        shapes: [entry.shape],
        bodyNames: [entry.bodyName],
      });
  }

  const grouped = [...groups.values()].map((group) => ({
    material: group.material,
    shape:
      group.shapes.length === 1 ? group.shapes[0] : buildCompound(group.shapes),
    ...(group.bodyNames.length === 1 ? { bodyName: group.bodyNames[0] } : {}),
  }));
  return [...isolated, ...grouped];
}

/**
 * Handles delete built part shapes in the mesh flow.
 */
export function deleteBuiltPartShapes(parts: BuiltPart[]): void {
  const seen = new Set<OC>();
  for (const part of parts) {
    if (!seen.has(part.shape)) {
      seen.add(part.shape);
      (part.shape as { delete(): void }).delete();
    }
    for (const materialShape of part.materialShapes) {
      if (seen.has(materialShape.shape)) continue;
      seen.add(materialShape.shape);
      (materialShape.shape as { delete(): void }).delete();
    }
  }
}
