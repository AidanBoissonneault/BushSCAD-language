/**
 * @author Aidan Boissonneault
 * @file constraint-access.ts
 * @purpose Provides constraint access behavior for the constraints in sketch solver package.
 * @last-edited October 6, 2026
 */

import type { SegmentEndpointRef, SolverSegment } from '../types/types.js';
import type {
  ConstraintPoint,
  ConstraintSegmentPoints,
} from './constraint-geometry.js';

/**
 * Constraint access, including point, segment, radius, and arc.
 */
export type ConstraintAccess = {
  point(name: string): ConstraintPoint;
  segment(name: string): ConstraintSegmentPoints | null;
  radius(name: string): number | undefined;
  arc(name: string): ConstraintArcGeometry | null;
};

/**
 * Constraint arc geometry, including center and radius.
 */
export type ConstraintArcGeometry = {
  center: ConstraintPoint;
  radius: number;
};

/** Creates coordinate and radius lookups over the solver's current variable vector. */
export function createConstraintAccess(
  segments: Map<string, SolverSegment>,
  variables: number[],
  variableIndex: Map<string, number>,
  fixedPoints: Map<string, ConstraintPoint>,
): ConstraintAccess {
  /**
   * Creates point geometry from the supplied coordinates.
   */
  const point = (name: string): ConstraintPoint => {
    const index = variableIndex.get(`${name}_x`);
    return index === undefined
      ? (fixedPoints.get(name) ?? [0, 0])
      : [variables[index], variables[index + 1]];
  };
  /**
   * Handles endpoint in the constraints flow.
   */
  const endpoint = (value: SegmentEndpointRef): ConstraintPoint =>
    value.kind === 'coords' ? [value.x, value.y] : point(value.name);
  /**
   * Creates a segment from its endpoint coordinates.
   */
  const segment = (name: string): ConstraintSegmentPoints | null => {
    const definition = segments.get(name);
    return definition
      ? [endpoint(definition.from), endpoint(definition.to)]
      : null;
  };
  /**
   * Handles radius in the constraints flow.
   */
  const radius = (name: string): number | undefined => {
    const definition = segments.get(name);
    if (definition?.kind !== 'arc') return undefined;
    const index = variableIndex.get(`${name}_radius`);
    return index === undefined ? definition.radius : variables[index];
  };
  return {
    point,
    segment,
    radius,
    arc: (name) => {
      const definition = segments.get(name);
      const points = segment(name);
      const currentRadius = radius(name);
      if (
        definition?.kind !== 'arc' ||
        !points ||
        currentRadius === undefined
      ) {
        return null;
      }
      return {
        center: arcCenter(
          points[0],
          points[1],
          currentRadius,
          definition.clockwise,
        ),
        radius: currentRadius,
      };
    },
  };
}

/** Resolves the circle center represented by an endpoint/radius arc. */
function arcCenter(
  from: ConstraintPoint,
  to: ConstraintPoint,
  radius: number,
  clockwise: boolean,
): ConstraintPoint {
  const midpoint: ConstraintPoint = [
    (from[0] + to[0]) / 2,
    (from[1] + to[1]) / 2,
  ];
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const chord = Math.hypot(dx, dy);
  if (chord <= 1e-12) return midpoint;
  const height = Math.sqrt(
    Math.max(0, Math.abs(radius) ** 2 - (chord / 2) ** 2),
  );
  const side = clockwise ? -1 : 1;
  return [
    midpoint[0] + (-dy / chord) * height * side,
    midpoint[1] + (dx / chord) * height * side,
  ];
}
