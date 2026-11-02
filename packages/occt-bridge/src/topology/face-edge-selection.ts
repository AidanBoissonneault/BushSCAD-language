/**
 * @author Aidan Boissonneault
 * @file face-edge-selection.ts
 * @purpose Provides face edge selection behavior for the topology in OpenCascade bridge package.
 * @last-edited October 6, 2026
 */

import type { ParsedFaceRef } from '../core/program-utils.js';

/**
 * Defines the `EdgeFallback` callback contract used by the topology layer.
 */
type EdgeFallback = () => unknown[];

/**
 * Selects the edge set for an outer face selector.
 * M39 fused-part recovery can make `base.top.edges` fall back to current face
 * wires after many loop-created cuts. `.edges` must include every face wire,
 * including hole rims, while `.perimeter` remains a perimeter-only selector.
 */
export function selectOuterFaceEdges(
  parsed: ParsedFaceRef,
  faceEdges: unknown[],
  fallbackPerimeterEdges: EdgeFallback,
): unknown[] {
  if (parsed.subRef === 'edges') {
    return faceEdges.length > 0 ? faceEdges : fallbackPerimeterEdges();
  }
  const perimeterEdges = fallbackPerimeterEdges();
  return perimeterEdges.length > 0 ? perimeterEdges : faceEdges;
}
