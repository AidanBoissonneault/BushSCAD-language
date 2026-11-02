/**
 * @author Aidan Boissonneault
 * @file shape-explorers.ts
 * @purpose Provides shape explorers behavior for the topology in OpenCascade bridge package.
 * @last-edited October 6, 2026
 */

import type { OC } from '../bridge/bridge-types.js';

/**
 * Iterates every face in a shape and releases the explorer afterward.
 * Several OCCT operations need the same TopExp face traversal; centralizing it
 * keeps resource cleanup consistent.
 */
export function forEachShapeFace(
  oc: OC,
  shape: unknown,
  visit: (face: OC) => void,
): void {
  const faceExp = new oc.TopExp_Explorer_2(
    shape,
    oc.TopAbs_ShapeEnum.TopAbs_FACE,
    oc.TopAbs_ShapeEnum.TopAbs_SHAPE,
  );
  for (; faceExp.More(); faceExp.Next()) {
    visit(oc.TopoDS.Face_1(faceExp.Current()));
  }
  faceExp.delete();
}
