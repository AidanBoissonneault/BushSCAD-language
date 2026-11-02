/**
 * @author Aidan Boissonneault
 * @file interaction-edge-descriptions.ts
 * @purpose Provides interaction edge descriptions behavior for the topology in OpenCascade bridge package.
 * @last-edited October 6, 2026
 */

import type { OC } from '../bridge/bridge-types.js';
import { readEdgeEndpoints, type Vec3 } from '../core/geometry-utils.js';
import { parseFaceRef, type FaceDir } from '../core/program-utils.js';
import type { FaceLabelMap } from './face-labels.js';
import { sameTopoShape } from './shape-equality.js';

const FACE_DIRECTIONS: FaceDir[] = [
  'top',
  'bottom',
  'front',
  'back',
  'left',
  'right',
];
const EDGE_DIRECTIONS: Record<FaceDir, string[]> = {
  top: ['front', 'back', 'left', 'right'],
  bottom: ['front', 'back', 'left', 'right'],
  front: ['left', 'right', 'top', 'bottom'],
  back: ['left', 'right', 'top', 'bottom'],
  left: ['front', 'back', 'top', 'bottom'],
  right: ['front', 'back', 'top', 'bottom'],
};
const SAMPLE_COUNT = 32;

/**
 * Describes exact selected edges using semantic names and geometric identity.
 * Hover must reveal what a hidden topology collection contains, not replace
 * its members with opaque numeric indices. Geometry remains the universal
 * fallback for curves and arbitrary custom profiles without authored aliases.
 */
export function describeInteractionEdges(
  oc: OC,
  labels: FaceLabelMap,
  selectorLabel: string,
  edges: readonly unknown[],
): string[] {
  const aliases = edgeAliases(oc, labels, selectorLabel, edges);
  return edges.map((edge) => {
    const alias = aliases.find((entry) =>
      entry.edges.some((candidate) => sameTopoShape(candidate, edge)),
    )?.label;
    return `${alias ?? selectorLabel} — ${describeInteractionEdge(oc, edge)}`;
  });
}

/** Formats one edge independently for focused tests and non-selector callers. */
export function describeInteractionEdge(oc: OC, edge: unknown): string {
  const points = sampleEdgePoints(oc, edge);
  if (points.length === 0) return 'edge (geometry unavailable)';
  const first = points[0]!;
  const last = points.at(-1)!;
  const kind = edgeCurveKind(oc, edge, points);
  const length = polylineLength(points);
  const lengthText = `${kind === 'line' ? '' : '≈'}${formatNumber(length)} mm`;
  if (pointsEqual(first, last)) {
    return `${kind} through ${formatPoint(first)}, length ${lengthText}`;
  }
  return `${kind} ${formatPoint(first)} → ${formatPoint(last)}, length ${lengthText}`;
}

/**
 * Edge alias, including display label and edges.
 */
type EdgeAlias = { label: string; edges: unknown[] };

/**
 * Resolves the edge data required by the current selector.
 */
function edgeAliases(
  oc: OC,
  labels: FaceLabelMap,
  selectorLabel: string,
  selectedEdges: readonly unknown[],
): EdgeAlias[] {
  const parsed = parseFaceRef(selectorLabel);
  const reader = labels as Partial<
    Pick<FaceLabelMap, 'getNamedFaceEdgeEntries' | 'resolveEdges'>
  >;
  const authored = authoredEdgeAliases(reader, parsed.objName);
  if (allEdgesHaveAliases(selectedEdges, authored)) return authored;
  return directionalEdgeAliases(
    oc,
    reader,
    parsed.objName,
    parsed.face ? [parsed.face] : FACE_DIRECTIONS,
    selectedEdges,
    authored,
  );
}

/**
 * Handles authored edge aliases in the topology flow.
 */
function authoredEdgeAliases(
  labels: Partial<Pick<FaceLabelMap, 'getNamedFaceEdgeEntries'>>,
  objName: string,
): EdgeAlias[] {
  const entries = labels.getNamedFaceEdgeEntries
    ? labels.getNamedFaceEdgeEntries(objName)
    : [];
  return entries.map(([name, edges]) => ({
    label: `${objName}.${name}.edges`,
    edges,
  }));
}

/**
 * Handles directional edge aliases in the topology flow.
 */
function directionalEdgeAliases(
  oc: OC,
  labels: Partial<Pick<FaceLabelMap, 'resolveEdges'>>,
  objName: string,
  faces: readonly FaceDir[],
  selectedEdges: readonly unknown[],
  initial: readonly EdgeAlias[],
): EdgeAlias[] {
  const aliases = [...initial];
  for (const face of faces) {
    for (const edgeDirection of EDGE_DIRECTIONS[face]) {
      const edges = labels.resolveEdges
        ? labels.resolveEdges(oc, `${objName}.${face}.edge.${edgeDirection}`)
        : [];
      if (edges.length > 0) {
        aliases.push({
          label: `${objName}.${face}.${edgeDirection}_edge`,
          edges,
        });
      }
      if (allEdgesHaveAliases(selectedEdges, aliases)) return aliases;
    }
  }
  return aliases;
}

/**
 * Handles all edges have aliases in the topology flow.
 */
function allEdgesHaveAliases(
  edges: readonly unknown[],
  aliases: readonly EdgeAlias[],
): boolean {
  return edges.every((edge) =>
    aliases.some((alias) =>
      alias.edges.some((candidate) => sameTopoShape(candidate, edge)),
    ),
  );
}

/**
 * Handles sample edge points in the topology flow.
 */
function sampleEdgePoints(oc: OC, edge: unknown): Vec3[] {
  const endpoints = safeEndpoints(oc, edge);
  const sampled = readEdgeCurve(oc, edge);
  if (!sampled) return endpoints;
  try {
    return sampleCurvePoints(sampled);
  } catch {
    return endpoints;
  } finally {
    sampled.handle.delete?.();
  }
}

/**
 * Sampled curve, including curve, handle, first, and last.
 */
type SampledCurve = {
  curve: { Value(parameter: number): OC };
  handle: OC;
  first: number;
  last: number;
};

/**
 * Reads edge curve from the supplied source.
 */
function readEdgeCurve(oc: OC, edge: unknown): SampledCurve | null {
  const tool = oc.BRep_Tool;
  if (!tool) return null;
  const readCurve = tool.Curve_2;
  if (typeof readCurve !== 'function') return null;
  const first = { current: 0 };
  const last = { current: 0 };
  const handle = readCurve(edge, first, last);
  const curve = typeof handle?.get === 'function' ? handle.get() : handle;
  if (!curve || curve.IsNull?.()) {
    handle?.delete?.();
    return null;
  }
  return { curve, handle, first: first.current, last: last.current };
}

/**
 * Handles sample curve points in the topology flow.
 */
function sampleCurvePoints(sampled: SampledCurve): Vec3[] {
  const points: Vec3[] = [];
  for (let index = 0; index <= SAMPLE_COUNT; index++) {
    const parameter =
      sampled.first + ((sampled.last - sampled.first) * index) / SAMPLE_COUNT;
    const point = sampled.curve.Value(parameter);
    points.push([point.X(), point.Y(), point.Z()]);
    point.delete?.();
  }
  return points;
}

/**
 * Handles safe endpoints in the topology flow.
 */
function safeEndpoints(oc: OC, edge: unknown): Vec3[] {
  try {
    return readEdgeEndpoints(oc, edge);
  } catch {
    return [];
  }
}

/**
 * Resolves the edge data required by the current selector.
 */
function edgeCurveKind(oc: OC, edge: unknown, points: readonly Vec3[]): string {
  try {
    const Adapter = oc.BRepAdaptor_Curve_2 ?? oc.BRepAdaptor_Curve;
    const adaptor = new Adapter(edge);
    const type = adaptor.GetType();
    adaptor.delete?.();
    return edgeCurveSegmentName(curveTypeName(oc, type), points);
  } catch {
    return inferredCurveKind(points);
  }
}

/**
 * Resolves the edge data required by the current selector.
 */
function edgeCurveSegmentName(type: string, points: readonly Vec3[]): string {
  if (pointsEqual(points[0]!, points.at(-1)!)) return type;
  if (type === 'circle') return 'circular arc';
  if (type === 'ellipse') return 'elliptical arc';
  return type;
}

/**
 * Handles curve type name in the topology flow.
 */
function curveTypeName(oc: OC, type: unknown): string {
  return (
    configuredCurveTypeName(oc.GeomAbs_CurveType, type) ??
    CURVE_TYPE_NAMES.get(type) ??
    'curve'
  );
}

/**
 * Handles configured curve type name in the topology flow.
 */
function configuredCurveTypeName(
  types: Record<string, unknown> | undefined,
  type: unknown,
): string | undefined {
  if (!types) return undefined;
  const key = Object.entries(types).find(([, value]) => value === type)?.[0];
  return key ? CURVE_TYPE_KEYS.get(key) : undefined;
}

const CURVE_TYPE_NAMES = new Map<unknown, string>([
  [0, 'line'],
  [1, 'circle'],
  [2, 'ellipse'],
  [3, 'hyperbola'],
  [4, 'parabola'],
  [5, 'Bezier curve'],
  [6, 'B-spline curve'],
  [7, 'offset curve'],
]);

const CURVE_TYPE_KEYS = new Map<string, string>([
  ['GeomAbs_Line', 'line'],
  ['GeomAbs_Circle', 'circle'],
  ['GeomAbs_Ellipse', 'ellipse'],
  ['GeomAbs_Hyperbola', 'hyperbola'],
  ['GeomAbs_Parabola', 'parabola'],
  ['GeomAbs_BezierCurve', 'Bezier curve'],
  ['GeomAbs_BSplineCurve', 'B-spline curve'],
  ['GeomAbs_OffsetCurve', 'offset curve'],
]);

/**
 * Handles inferred curve kind in the topology flow.
 */
function inferredCurveKind(points: readonly Vec3[]): string {
  if (points.length < 3) return 'edge';
  if (pointsEqual(points[0]!, points.at(-1)!)) return 'closed curve';
  const first = points[0]!;
  const last = points.at(-1)!;
  const middle = points[Math.floor(points.length / 2)]!;
  const chordMiddle: Vec3 = [
    (first[0] + last[0]) / 2,
    (first[1] + last[1]) / 2,
    (first[2] + last[2]) / 2,
  ];
  return distance(middle, chordMiddle) < 1e-5 ? 'line' : 'curve';
}

/**
 * Handles polyline length in the topology flow.
 */
function polylineLength(points: readonly Vec3[]): number {
  let length = 0;
  for (let index = 1; index < points.length; index++) {
    length += distance(points[index - 1]!, points[index]!);
  }
  return length;
}

/**
 * Calculates the distance between the supplied points.
 */
function distance(a: Vec3, b: Vec3): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

/**
 * Handles points equal in the topology flow.
 */
function pointsEqual(a: Vec3, b: Vec3): boolean {
  return distance(a, b) < 1e-6;
}

/**
 * Formats point for display or serialization.
 */
function formatPoint(point: Vec3): string {
  return `(${point.map(formatNumber).join(', ')})`;
}

/**
 * Formats number for display or serialization.
 */
function formatNumber(value: number): string {
  const rounded = Math.abs(value) < 5e-7 ? 0 : Number(value.toFixed(3));
  return String(rounded);
}
