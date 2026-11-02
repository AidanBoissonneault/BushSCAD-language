/**
 * @author Aidan Boissonneault
 * @file whole-shape-edge-selection.ts
 * @purpose Provides whole shape edge selection behavior for the topology in OpenCascade bridge package.
 * @last-edited October 6, 2026
 */

import { uniqueShapes } from './shape-collection.js';

/**
 * Whole shape face, including face and qualifier.
 */
export type WholeShapeFace = {
  face: unknown;
  qualifier: 'inner' | 'outer';
};

/**
 * Selection of whole shape edge, including sub ref, infer bare edges, shape edges, faces, and
 * perimeter edges for face.
 */
export type WholeShapeEdgeSelection<TFace extends WholeShapeFace> = {
  subRef: 'edges' | 'center' | 'perimeter' | 'corner' | 'edge' | undefined;
  inferBareEdges: boolean;
  shapeEdges: unknown[];
  faces: TFace[];
  perimeterEdgesForFace: (face: TFace) => unknown[];
  sourcePerimeterEdges?: unknown[];
};

/**
 * Selects edges for an object-wide topology reference.
 * Object-level `.edges` means every current edge, while `.perimeter` preserves
 * the authored exterior boundary when source topology is available. Modifier
 * consumers may additionally infer `.edges` from a bare object reference.
 */
export function selectWholeShapeEdges<TFace extends WholeShapeFace>({
  subRef,
  inferBareEdges,
  shapeEdges,
  faces,
  perimeterEdgesForFace,
  sourcePerimeterEdges,
}: WholeShapeEdgeSelection<TFace>): unknown[] {
  if (subRef === 'edges' || (subRef === undefined && inferBareEdges)) {
    return uniqueShapes(shapeEdges);
  }
  if (subRef !== 'perimeter') return [];
  if (sourcePerimeterEdges !== undefined) {
    return uniqueShapes(sourcePerimeterEdges);
  }
  return uniqueShapes(
    faces
      .filter((face) => face.qualifier === 'outer')
      .flatMap(perimeterEdgesForFace),
  );
}
