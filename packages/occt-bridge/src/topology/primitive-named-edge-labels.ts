/**
 * @author Aidan Boissonneault
 * @file primitive-named-edge-labels.ts
 * @purpose Provides primitive named edge labels behavior for the topology in OpenCascade bridge package.
 * @last-edited October 6, 2026
 */

import {
  rectangleSideEndpoints,
  type IRPrimitive,
  type IRProfileSegment,
  type IRRectPrimitive,
  type RectSide,
} from '@bushscad/ir';
import type { GroupBuildState, OC } from '../bridge/bridge-types.js';
import {
  getEdges,
  readEdgeEndpoints,
  type Vec3,
} from '../core/geometry-utils.js';
import type { FaceFrame } from './face-labels.js';
import { workplaneFrame } from './frame-utils.js';
import { matchEdgesForExtrudedProfileSegment } from './named-face-edge-labels.js';
import { uniqueShapes } from './shape-collection.js';

const RECTANGLE_SIDES = ['bottom', 'right', 'top', 'left'] as const;
const REVOLVE_MATCH_TOLERANCE = 0.1;

/**
 * Named segment candidate, including segment and allow broad fallback.
 */
type NamedSegmentCandidate = {
  segment: IRProfileSegment;
  allowBroadFallback: boolean;
};

/**
 * Revolved profile axis, including point and dir.
 */
export type RevolvedProfileAxis = {
  point: Vec3;
  dir: Vec3;
};

/**
 * Options for primitive named edge, including frame and revolve axis.
 */
export type PrimitiveNamedEdgeOptions = {
  frame?: FaceFrame;
  revolveAxis?: RevolvedProfileAxis;
};

/**
 * Registers authored profile names and compact-primitive side aliases on a body.
 * A compact rectangle has no stored profile segments, but a custom side name
 * must resolve exactly like the equivalent named path line after solid
 * creation. Traversing the primitive tree also preserves aliases through
 * sketch placement and Boolean composition without changing canonical faces.
 */
export function registerPrimitiveNamedEdgesForBody(
  oc: OC,
  state: GroupBuildState,
  objName: string,
  sketchName: string,
  options: PrimitiveNamedEdgeOptions = {},
): void {
  const primitive = state.sketchPrimitives.get(sketchName);
  const shape = state.labelMap.getShape(objName);
  if (!primitive || !shape) return;

  const candidates = namedSegmentCandidates(primitive);
  if (candidates.length === 0) return;
  const edges = getEdges(oc, shape);
  const frame =
    options.frame ??
    state.bodyFrames.get(objName) ??
    workplaneFrame(state.defaultWorkplane);

  for (const [name, namedCandidates] of groupCandidatesByName(candidates)) {
    const matches = uniqueShapes(
      namedCandidates.flatMap((candidate) =>
        candidateEdges(oc, edges, candidate, frame, options.revolveAxis),
      ),
    );
    if (matches.length > 0) {
      state.labelMap.registerNamedFaceEdges(objName, name, matches);
    }
  }
}

/** Collects named segment geometry in the root sketch coordinate system. */
function namedSegmentCandidates(
  primitive: IRPrimitive,
  offset: readonly [number, number] = [0, 0],
  componentPath: readonly string[] = [],
): NamedSegmentCandidate[] {
  switch (primitive.kind) {
    case 'profile':
      return primitive.segments.map((segment) => ({
        segment: namedSegment(offsetSegment(segment, offset), componentPath),
        allowBroadFallback: true,
      }));
    case 'rect':
      return rectangleSideCandidates(primitive, offset, componentPath);
    case 'sketchAlias':
      return namedSegmentCandidates(primitive.primitive, offset, [
        ...componentPath,
        primitive.name,
      ]);
    case 'sketchAt':
      return namedSegmentCandidates(
        primitive.primitive,
        [offset[0] + primitive.x, offset[1] + primitive.y],
        componentPath,
      );
    case 'sketchBoolean':
      return [
        ...namedSegmentCandidates(primitive.left, offset, componentPath),
        ...namedSegmentCandidates(primitive.right, offset, componentPath),
      ];
    default:
      return [];
  }
}

/**
 * Creates rectangle geometry from the supplied dimensions.
 */
function rectangleSideCandidates(
  primitive: IRRectPrimitive,
  offset: readonly [number, number],
  componentPath: readonly string[],
): NamedSegmentCandidate[] {
  return RECTANGLE_SIDES.flatMap((side) => {
    const customName = primitive.sideNames?.[side];
    const names =
      componentPath.length > 0
        ? uniqueNames([side, ...(customName ? [customName] : [])])
        : customName && customName !== side
          ? [customName]
          : [];
    return names.map((name) => ({
      segment: rectangleSideSegment(
        primitive,
        side,
        qualifyName(name, componentPath),
        offset,
      ),
      allowBroadFallback: false,
    }));
  });
}

/**
 * Handles named segment in the topology flow.
 */
function namedSegment(
  segment: IRProfileSegment,
  componentPath: readonly string[],
): IRProfileSegment {
  return {
    ...segment,
    name: qualifyName(segment.name, componentPath),
  };
}

/**
 * Handles qualify name in the topology flow.
 */
function qualifyName(name: string, componentPath: readonly string[]): string {
  return componentPath.length > 0 ? `${componentPath.join('.')}.${name}` : name;
}

/**
 * Removes duplicate names values while preserving their first occurrence.
 */
function uniqueNames(names: readonly string[]): string[] {
  return [...new Set(names)];
}

/**
 * Creates rectangle geometry from the supplied dimensions.
 */
function rectangleSideSegment(
  primitive: IRRectPrimitive,
  side: RectSide,
  name: string,
  offset: readonly [number, number],
): IRProfileSegment {
  const [from, to] = rectangleSideEndpoints(
    primitive.width,
    primitive.height,
    side,
  );
  return {
    kind: 'line',
    name,
    from: offsetPoint(from, offset),
    to: offsetPoint(to, offset),
  };
}

/**
 * Handles offset segment in the topology flow.
 */
function offsetSegment(
  segment: IRProfileSegment,
  offset: readonly [number, number],
): IRProfileSegment {
  if (offset[0] === 0 && offset[1] === 0) return segment;
  return {
    ...segment,
    from: offsetPoint(segment.from, offset),
    to: offsetPoint(segment.to, offset),
  };
}

/**
 * Handles offset point in the topology flow.
 */
function offsetPoint(
  point: readonly [number, number],
  offset: readonly [number, number],
): [number, number] {
  return [point[0] + offset[0], point[1] + offset[1]];
}

/**
 * Handles group candidates by name in the topology flow.
 */
function groupCandidatesByName(
  candidates: NamedSegmentCandidate[],
): Map<string, NamedSegmentCandidate[]> {
  const grouped = new Map<string, NamedSegmentCandidate[]>();
  for (const candidate of candidates) {
    const entries = grouped.get(candidate.segment.name) ?? [];
    entries.push(candidate);
    grouped.set(candidate.segment.name, entries);
  }
  return grouped;
}

/**
 * Handles candidate edges in the topology flow.
 */
function candidateEdges(
  oc: OC,
  edges: unknown[],
  candidate: NamedSegmentCandidate,
  frame: FaceFrame,
  revolveAxis: RevolvedProfileAxis | undefined,
): unknown[] {
  const matched = revolveAxis
    ? matchEdgesForRevolvedSegment(oc, edges, candidate.segment, revolveAxis)
    : matchEdgesForExtrudedProfileSegment(oc, edges, candidate.segment, frame);
  return matched.length > 0 || !candidate.allowBroadFallback ? matched : edges;
}

/**
 * Handles match edges for revolved segment in the topology flow.
 */
function matchEdgesForRevolvedSegment(
  oc: OC,
  edges: unknown[],
  segment: IRProfileSegment,
  axis: RevolvedProfileAxis,
): unknown[] {
  return edges.filter((edge) => {
    try {
      const [first, last] = readEdgeEndpoints(oc, edge);
      return (
        vertexMatchesProfilePoint(first, segment.from, axis) ||
        vertexMatchesProfilePoint(last, segment.from, axis) ||
        vertexMatchesProfilePoint(first, segment.to, axis) ||
        vertexMatchesProfilePoint(last, segment.to, axis)
      );
    } catch {
      return false;
    }
  });
}

/**
 * Handles vertex matches profile point in the topology flow.
 */
function vertexMatchesProfilePoint(
  worldPoint: Vec3,
  profilePoint: readonly [number, number],
  axis: RevolvedProfileAxis,
): boolean {
  const relative: Vec3 = [
    worldPoint[0] - axis.point[0],
    worldPoint[1] - axis.point[1],
    worldPoint[2] - axis.point[2],
  ];
  const height = dot(relative, axis.dir);
  const radial: Vec3 = [
    relative[0] - height * axis.dir[0],
    relative[1] - height * axis.dir[1],
    relative[2] - height * axis.dir[2],
  ];
  return (
    Math.abs(height - profilePoint[1]) < REVOLVE_MATCH_TOLERANCE &&
    Math.abs(Math.hypot(...radial) - profilePoint[0]) < REVOLVE_MATCH_TOLERANCE
  );
}

/**
 * Returns the dot product of the supplied vectors.
 */
function dot(first: Vec3, second: Vec3): number {
  return first[0] * second[0] + first[1] * second[1] + first[2] * second[2];
}
