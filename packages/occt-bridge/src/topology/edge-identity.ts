/**
 * @author Aidan Boissonneault
 * @file edge-identity.ts
 * @purpose Provides edge identity behavior for the topology in OpenCascade bridge package.
 * @last-edited October 6, 2026
 */

import type { OC } from '../bridge/bridge-types.js';

const EDGE_CONNECTIVITY_TOLERANCE = 1e-6;

/**
 * Resolves the edge data required by the current selector.
 */
export function edgeVertexKeys(oc: OC, edge: unknown): [string, string] | null {
  let firstVertex: OC | null = null;
  let lastVertex: OC | null = null;
  let firstPoint: OC | null = null;
  let lastPoint: OC | null = null;
  try {
    firstVertex = oc.TopExp.FirstVertex(edge, true);
    lastVertex = oc.TopExp.LastVertex(edge, true);
    firstPoint = oc.BRep_Tool.Pnt(firstVertex);
    lastPoint = oc.BRep_Tool.Pnt(lastVertex);
    return [
      pointKey(firstPoint.X(), firstPoint.Y(), firstPoint.Z()),
      pointKey(lastPoint.X(), lastPoint.Y(), lastPoint.Z()),
    ];
  } catch {
    return null;
  } finally {
    firstVertex?.delete?.();
    lastVertex?.delete?.();
    firstPoint?.delete?.();
    lastPoint?.delete?.();
  }
}

/**
 * Resolves the edge data required by the current selector.
 */
export function edgeKey(vertexKeys: [string, string]): string {
  return [...vertexKeys].sort().join('|');
}

/**
 * Creates point geometry from the supplied coordinates.
 */
function pointKey(x: number, y: number, z: number): string {
  return [x, y, z]
    .map((coord) => {
      const rounded = Math.round(coord / EDGE_CONNECTIVITY_TOLERANCE);
      return Object.is(rounded, -0) ? 0 : rounded;
    })
    .join(',');
}
