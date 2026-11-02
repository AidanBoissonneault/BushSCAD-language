/**
 * @author Aidan Boissonneault
 * @file circularArcVertices.ts
 * @purpose Provides circular arc vertices behavior for the geometry in IR package.
 * @last-edited October 6, 2026
 */

import type { CircularArc } from './circularArcLoop.js';

/**
 * Arc endpoint, including arc index, endpoint, and point.
 */
type ArcEndpoint = {
  arcIndex: number;
  endpoint: 'from' | 'to';
  point: [number, number];
};

/**
 * Clusters arc endpoints into tolerance-aware topology vertex keys.
 * Evaluated profiles can carry tiny solver differences at a coincident join.
 * Circle analysis needs graph identity without scaling tolerance by a sketch's
 * potentially very large world-space offset.
 */
export function circularArcEndpointKeys(
  arcs: CircularArc[],
  tolerance: number,
): { from: string; to: string }[] {
  const endpoints: ArcEndpoint[] = arcs.flatMap((arc, arcIndex) => [
    { arcIndex, endpoint: 'from', point: arc.from },
    { arcIndex, endpoint: 'to', point: arc.to },
  ]);
  const parents = endpoints.map((_, index) => index);
  endpoints.forEach((first, firstIndex) => {
    endpoints.slice(firstIndex + 1).forEach((second, offset) => {
      if (pointDistance(first.point, second.point) <= tolerance) {
        union(parents, firstIndex, firstIndex + offset + 1);
      }
    });
  });
  const keys = arcs.map(() => ({ from: '', to: '' }));
  endpoints.forEach((endpoint, index) => {
    keys[endpoint.arcIndex][endpoint.endpoint] =
      `vertex_${root(parents, index)}`;
  });
  return keys;
}

/**
 * Creates point geometry from the supplied coordinates.
 */
function pointDistance(
  first: [number, number],
  second: [number, number],
): number {
  return Math.hypot(first[0] - second[0], first[1] - second[1]);
}

/**
 * Handles root in the geometry flow.
 */
function root(parents: number[], index: number): number {
  if (parents[index] !== index) parents[index] = root(parents, parents[index]);
  return parents[index];
}

/**
 * Handles union in the geometry flow.
 */
function union(parents: number[], first: number, second: number): void {
  const firstRoot = root(parents, first);
  const secondRoot = root(parents, second);
  if (firstRoot !== secondRoot) parents[secondRoot] = firstRoot;
}
