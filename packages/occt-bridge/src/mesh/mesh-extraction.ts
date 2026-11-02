/**
 * @author Aidan Boissonneault
 * @file mesh-extraction.ts
 * @purpose Provides mesh extraction behavior for the mesh in OpenCascade bridge package.
 * @last-edited October 6, 2026
 */

import type { MeshData } from '@bushscad/ir';
import type { OC } from '../bridge/bridge-types.js';
import type { Vec3 } from '../core/geometry-utils.js';
import {
  normalFromTriangles,
  normalizeVec,
  safeFaceNormal,
} from '../topology/frame-utils.js';
import { meshShapeWithOptions } from './mesh-options.js';
import { forEachShapeFace } from '../topology/shape-explorers.js';

/**
 * Mesh buffers, including vertices, normals, and indices.
 */
type MeshBuffers = {
  vertices: number[];
  normals: number[];
  indices: number[];
};

/**
 * Face mesh, including vertices, raw triangles, oriented triangles, reversed, and vertex count.
 */
type FaceMesh = {
  vertices: number[];
  rawTriangles: [number, number, number][];
  orientedTriangles: [number, number, number][];
  reversed: boolean;
  vertexCount: number;
};

/**
 * Tessellates an OCCT shape and converts face triangulations into renderer buffers.
 * Preview and hardware visuals need the same mesh extraction behavior, including
 * orientation correction for reversed or inconsistently triangulated faces.
 */
export function extractMesh(
  oc: OC,
  shape: OC,
): Omit<MeshData, 'partName' | 'color'> {
  meshShapeWithOptions(oc, shape);

  const buffers: MeshBuffers = { vertices: [], normals: [], indices: [] };
  let vertOffset = 0;

  forEachShapeFace(oc, shape, (face) => {
    const faceMesh = readFaceMesh(oc, face);
    if (!faceMesh) return;
    appendFaceMesh(oc, face, faceMesh, buffers, vertOffset);
    vertOffset += faceMesh.vertexCount;
  });

  return {
    vertices: new Float32Array(buffers.vertices),
    normals: new Float32Array(buffers.normals),
    indices: new Uint32Array(buffers.indices),
  };
}

/**
 * Reads face mesh from the supplied source.
 */
function readFaceMesh(oc: OC, face: OC): FaceMesh | null {
  const loc = new oc.TopLoc_Location_1();
  try {
    const triH = oc.BRep_Tool.Triangulation(face, loc);
    if (triH.IsNull()) return null;
    const poly = triH.get();
    const vertices = readFaceVertices(oc, poly, loc);
    const reversed =
      face.Orientation_1() === oc.TopAbs_Orientation.TopAbs_REVERSED;
    const { rawTriangles, orientedTriangles } = readFaceTriangles(
      poly,
      reversed,
    );
    return {
      vertices,
      rawTriangles,
      orientedTriangles,
      reversed,
      vertexCount: poly.NbNodes(),
    };
  } finally {
    loc.delete();
  }
}

/**
 * Reads face vertices from the supplied source.
 */
function readFaceVertices(oc: OC, poly: OC, loc: OC): number[] {
  const vertices: number[] = [];
  const trsf: OC | null = loc.IsIdentity() ? null : loc.Transformation();
  for (let i = 1; i <= poly.NbNodes(); i++) {
    vertices.push(...readFaceVertex(oc, poly.Node(i), trsf));
  }
  return vertices;
}

/**
 * Reads face vertex from the supplied source.
 */
function readFaceVertex(oc: OC, node: OC, trsf: OC | null): Vec3 {
  let x = node.X();
  let y = node.Y();
  let z = node.Z();
  if (trsf) {
    const p = new oc.gp_Pnt_3(x, y, z);
    p.Transform(trsf);
    x = p.X();
    y = p.Y();
    z = p.Z();
    p.delete();
  }
  node.delete();
  return [x, y, z];
}

/**
 * Reads face triangles from the supplied source.
 */
function readFaceTriangles(
  poly: OC,
  reversed: boolean,
): {
  rawTriangles: [number, number, number][];
  orientedTriangles: [number, number, number][];
} {
  const rawTriangles: [number, number, number][] = [];
  const orientedTriangles: [number, number, number][] = [];
  for (let i = 1; i <= poly.NbTriangles(); i++) {
    const raw = readTriangle(poly.Triangle(i));
    rawTriangles.push(raw);
    orientedTriangles.push(orientTriangle(raw, reversed));
  }
  return { rawTriangles, orientedTriangles };
}

/**
 * Reads triangle from the supplied source.
 */
function readTriangle(tri: OC): [number, number, number] {
  const ns = { current: 0 };
  const ms = { current: 0 };
  const ps = { current: 0 };
  tri.Get(ns, ms, ps);
  tri.delete();
  return [ns.current - 1, ms.current - 1, ps.current - 1];
}

/**
 * Appends face mesh to the current output.
 */
function appendFaceMesh(
  oc: OC,
  face: OC,
  faceMesh: FaceMesh,
  buffers: MeshBuffers,
  vertOffset: number,
): void {
  buffers.vertices.push(...faceMesh.vertices);
  const faceNormal = resolvedFaceNormal(oc, face, faceMesh);
  appendFaceIndices(faceMesh, faceNormal, buffers, vertOffset);
  for (let i = 0; i < faceMesh.vertexCount; i++)
    buffers.normals.push(...faceNormal);
}

/**
 * Handles resolved face normal in the mesh flow.
 */
function resolvedFaceNormal(oc: OC, face: OC, faceMesh: FaceMesh): Vec3 {
  const fallback = normalFromTriangles(
    faceMesh.vertices,
    faceMesh.orientedTriangles,
  ) ?? [0, 0, 1];
  const [nx, ny, nz] = safeFaceNormal(oc, face, fallback);
  return [nx, ny, nz];
}

/**
 * Appends face indices to the current output.
 */
function appendFaceIndices(
  faceMesh: FaceMesh,
  faceNormal: Vec3,
  buffers: MeshBuffers,
  vertOffset: number,
): void {
  for (const raw of faceMesh.rawTriangles) {
    const oriented = orientTriangle(raw, faceMesh.reversed);
    const finalTriangle = correctTriangleWinding(
      faceMesh.vertices,
      oriented,
      faceNormal,
    );
    buffers.indices.push(
      finalTriangle[0] + vertOffset,
      finalTriangle[1] + vertOffset,
      finalTriangle[2] + vertOffset,
    );
  }
}

/**
 * Handles orient triangle in the mesh flow.
 */
function orientTriangle(
  triangle: [number, number, number],
  reversed: boolean,
): [number, number, number] {
  return reversed ? [triangle[0], triangle[2], triangle[1]] : triangle;
}

/**
 * Handles correct triangle winding in the mesh flow.
 */
function correctTriangleWinding(
  vertices: number[],
  oriented: [number, number, number],
  faceNormal: Vec3,
): [number, number, number] {
  const normal = triangleNormal(vertices, oriented);
  return normal && dotVec(normal, faceNormal) < 0
    ? [oriented[0], oriented[2], oriented[1]]
    : oriented;
}

/**
 * Returns the dot product of the supplied vectors.
 */
function dotVec(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

/**
 * Handles triangle normal in the mesh flow.
 */
function triangleNormal(
  vertices: number[],
  [ai, bi, ci]: [number, number, number],
): Vec3 | null {
  const ax = vertices[ai * 3];
  const ay = vertices[ai * 3 + 1];
  const az = vertices[ai * 3 + 2];
  const bx = vertices[bi * 3];
  const by = vertices[bi * 3 + 1];
  const bz = vertices[bi * 3 + 2];
  const cx = vertices[ci * 3];
  const cy = vertices[ci * 3 + 1];
  const cz = vertices[ci * 3 + 2];
  return normalizeVec([
    (by - ay) * (cz - az) - (bz - az) * (cy - ay),
    (bz - az) * (cx - ax) - (bx - ax) * (cz - az),
    (bx - ax) * (cy - ay) - (by - ay) * (cx - ax),
  ]);
}
