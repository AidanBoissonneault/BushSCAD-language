/** Implements the building behavior owned by the OCCT bridge. */

import { TextBridge } from '../../primitives/text/text.js';

import type { MeshData } from '@bushscad/ir';

import { extractMesh as extractOcctMesh } from '../mesh-extraction.js';

import type { BuiltPart, OC } from '../../bridge/bridge-types.js';

export abstract class BuildingBridge extends TextBridge {
  protected override collectShapeAndColorMaps(builtParts: BuiltPart[]): {
    shapeMap: Map<string, OC>;
    colorMap: Map<string, string>;
  } {
    const shapeMap = new Map<string, OC>();
    for (const { group, shape } of builtParts) shapeMap.set(group.name, shape);
    for (const { bodyShapes } of builtParts) {
      for (const [name, s] of bodyShapes) shapeMap.set(name, s);
    }
    const colorMap = new Map<string, string>();
    for (const { group, bodyShapes } of builtParts) {
      const c = group.color ?? '#D0D0D0';
      colorMap.set(group.name, c);
      for (const [name] of bodyShapes) colorMap.set(name, c);
    }
    return { shapeMap, colorMap };
  }

  protected override extractMesh(
    shape: OC,
  ): Omit<MeshData, 'partName' | 'color'> {
    return extractOcctMesh(this.oc, shape);
  }
}
