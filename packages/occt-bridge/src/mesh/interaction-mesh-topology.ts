/**
 * @author Aidan Boissonneault
 * @file interaction-mesh-topology.ts
 * @purpose Provides interaction mesh topology behavior for the mesh in OpenCascade bridge package.
 * @last-edited October 6, 2026
 */

import type { InteractionMeshTopology } from '@bushscad/ir';
import type { OC } from '../bridge/bridge-types.js';
import { sampleEdge } from '../drawing/drawing-edge-sampling.js';
import type {
  InteractionTopologyBindings,
  PointBinding,
} from '../topology/interaction-bindings.js';
import { edgeKey, edgeVertexKeys } from '../topology/edge-identity.js';
import { interactionTopologyId } from '../topology/interaction-topology-id.js';
import { forEachShapeFace } from '../topology/shape-explorers.js';

/**
 * Request to topology, including mesh index, part entity id, object entity id, and bindings.
 */
type TopologyRequest = {
  meshIndex: number;
  partEntityId: string;
  objectEntityId?: string;
  bindings: InteractionTopologyBindings;
};

/** Extracts compact renderer hit-test ownership from an already-meshed shape. */
export function extractInteractionMeshTopology(
  oc: OC,
  shape: OC,
  request: TopologyRequest,
): InteractionMeshTopology {
  const extractedFaces = extractFaces(oc, shape, request);
  const faces = extractedFaces.faces;
  const extracted = extractEdgesAndCorners(oc, shape, request);
  const edges = [...extracted.edges];
  const corners = [...extracted.corners];
  appendReferencePoints(corners, extractedFaces.referencePoints, request);
  return {
    meshIndex: request.meshIndex,
    partEntityId: request.partEntityId,
    ...(request.objectEntityId
      ? { objectEntityId: request.objectEntityId }
      : {}),
    faces,
    edges,
    corners,
  };
}

/**
 * Assigns placements whose construction face did not survive to one final mesh.
 * Boolean operations can replace a selector's original face handle while its
 * resolved point remains valid. Choosing the nearest rendered edge preserves a
 * single usable hover target without copying the selector onto every face.
 */
export function attachUnmatchedReferencePoints(
  topology: readonly InteractionMeshTopology[],
  bindings: readonly PointBinding[],
): InteractionMeshTopology[] {
  const additions = new Map<number, PointBinding[]>();
  for (const binding of bindings) {
    let target: InteractionMeshTopology | undefined;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (const candidate of topology) {
      const distance = topologyDistanceSquared(candidate, binding.point);
      if (distance >= nearestDistance) continue;
      target = candidate;
      nearestDistance = distance;
    }
    if (!target) continue;
    const targetBindings = additions.get(target.meshIndex) ?? [];
    targetBindings.push(binding);
    additions.set(target.meshIndex, targetBindings);
  }
  return topology.map((mesh) => {
    const extra = additions.get(mesh.meshIndex);
    if (!extra?.length) return mesh;
    const corners = [...mesh.corners];
    appendReferencePoints(
      corners,
      extra,
      mesh.objectEntityId ? { objectEntityId: mesh.objectEntityId } : {},
    );
    return { ...mesh, corners };
  });
}

/**
 * Handles topology distance squared in the mesh flow.
 */
function topologyDistanceSquared(
  topology: InteractionMeshTopology,
  point: readonly [number, number, number],
): number {
  let minimum = Number.POSITIVE_INFINITY;
  for (const edge of topology.edges) {
    for (let index = 0; index < edge.points.length; index += 3) {
      const dx = edge.points[index]! - point[0];
      const dy = edge.points[index + 1]! - point[1];
      const dz = edge.points[index + 2]! - point[2];
      minimum = Math.min(minimum, dx * dx + dy * dy + dz * dz);
    }
  }
  return minimum;
}

/** Adds resolved selector placements only to meshes containing their face. */
function appendReferencePoints(
  corners: InteractionMeshTopology['corners'][number][],
  bindings: readonly PointBinding[],
  request: Pick<TopologyRequest, 'objectEntityId'>,
): void {
  for (const binding of bindings) {
    const ownerEntityId = request.objectEntityId ?? binding.id;
    corners.push({
      id: interactionTopologyId(ownerEntityId, 'point', binding.point),
      ownerEntityId,
      semanticTargetIds: [binding.id],
      point: binding.point,
      role: 'reference-point',
    });
  }
}

/**
 * Handles extract faces in the mesh flow.
 */
function extractFaces(
  oc: OC,
  shape: OC,
  request: TopologyRequest,
): {
  faces: InteractionMeshTopology['faces'];
  referencePoints: PointBinding[];
} {
  const faces: InteractionMeshTopology['faces'][number][] = [];
  const referencePoints = new Map<string, PointBinding>();
  let triangleStart = 0;
  forEachShapeFace(oc, shape, (face) => {
    const triangulation = faceTriangulation(oc, face);
    if (!triangulation) return;
    try {
      const points = triangulationPoints(triangulation.poly, triangulation.loc);
      const semanticTargetIds = request.bindings.faceIds(face);
      for (const binding of request.bindings.referencePointsForFace(face)) {
        referencePoints.set(binding.id, binding);
      }
      const ownerEntityId =
        request.objectEntityId ?? semanticTargetIds[0] ?? request.partEntityId;
      const triangleCount = triangulation.poly.NbTriangles();
      faces.push({
        id: interactionTopologyId(ownerEntityId, 'face', points),
        ownerEntityId,
        semanticTargetIds,
        triangleStart,
        triangleCount,
      });
      triangleStart += triangleCount;
    } finally {
      triangulation.loc.delete();
    }
  });
  return { faces, referencePoints: [...referencePoints.values()] };
}

/**
 * Resolves the face data required by the current selector.
 */
function faceTriangulation(oc: OC, face: OC): { poly: OC; loc: OC } | null {
  const loc = new oc.TopLoc_Location_1();
  const handle = oc.BRep_Tool.Triangulation(face, loc);
  if (handle.IsNull()) {
    loc.delete();
    return null;
  }
  return { poly: handle.get(), loc };
}

/**
 * Handles triangulation points in the mesh flow.
 */
function triangulationPoints(poly: OC, loc: OC): number[] {
  const points: number[] = [];
  const transform: OC | null = loc.IsIdentity() ? null : loc.Transformation();
  for (let index = 1; index <= poly.NbNodes(); index += 1) {
    const node = poly.Node(index);
    if (transform) node.Transform(transform);
    points.push(node.X(), node.Y(), node.Z());
    node.delete();
  }
  return points;
}

/**
 * Handles extract edges and corners in the mesh flow.
 */
function extractEdgesAndCorners(
  oc: OC,
  shape: OC,
  request: TopologyRequest,
): Pick<InteractionMeshTopology, 'edges' | 'corners'> {
  const edges: InteractionMeshTopology['edges'][number][] = [];
  const corners: InteractionMeshTopology['corners'][number][] = [];
  const seenEdges = new Set<string>();
  const seenCorners = new Set<string>();
  const explorer = new oc.TopExp_Explorer_2(
    shape,
    oc.TopAbs_ShapeEnum.TopAbs_EDGE,
    oc.TopAbs_ShapeEnum.TopAbs_SHAPE,
  );
  for (; explorer.More(); explorer.Next()) {
    const edge = oc.TopoDS.Edge_1(explorer.Current());
    const vertexKeys = edgeVertexKeys(oc, edge);
    const points = sampleEdge(oc, edge);
    if (!vertexKeys || points.length === 0) continue;
    const edgeTargetIds = request.bindings.edgeIds(edge);
    const key = edgeKey(vertexKeys);
    if (!seenEdges.has(key)) {
      seenEdges.add(key);
      appendEdge(edges, request, points, edgeTargetIds);
    }
    appendCorners(corners, seenCorners, request, points, edgeTargetIds);
  }
  explorer.delete();
  return { edges, corners };
}

/**
 * Appends edge to the current output.
 */
function appendEdge(
  edges: InteractionMeshTopology['edges'][number][],
  request: TopologyRequest,
  points: [number, number, number][],
  semanticTargetIds: string[],
): void {
  const flat = points.flat();
  const ownerEntityId =
    request.objectEntityId ?? semanticTargetIds[0] ?? request.partEntityId;
  edges.push({
    id: interactionTopologyId(ownerEntityId, 'edge', flat),
    ownerEntityId,
    semanticTargetIds,
    points: flat,
  });
}

/**
 * Appends corners to the current output.
 */
function appendCorners(
  corners: InteractionMeshTopology['corners'][number][],
  seen: Set<string>,
  request: TopologyRequest,
  points: [number, number, number][],
  edgeTargetIds: string[],
): void {
  for (const point of [points[0], points.at(-1)]) {
    if (!point) continue;
    const key = point.map((value) => Math.round(value * 1e6)).join(',');
    if (seen.has(key)) continue;
    seen.add(key);
    const semanticTargetIds = request.bindings.cornerIds(point);
    const ownerEntityId =
      request.objectEntityId ??
      edgeTargetIds[0] ??
      semanticTargetIds[0] ??
      request.partEntityId;
    corners.push({
      id: interactionTopologyId(ownerEntityId, 'corner', point),
      ownerEntityId,
      semanticTargetIds,
      point,
    });
  }
}
