/**
 * @author Aidan Boissonneault
 * @file mesh-options.ts
 * @purpose Provides mesh options behavior for the mesh in OpenCascade bridge package.
 * @last-edited October 6, 2026
 */

import type { OC } from '../bridge/bridge-types.js';

/**
 * Options for mesh, including linear deflection and angular deflection.
 */
interface MeshOptions {
  linearDeflection: number;
  angularDeflection: number;
}

const DEFAULT_MESH_OPTIONS: MeshOptions = {
  linearDeflection: 0.1,
  angularDeflection: 0.5,
};

const DETAILED_MESH_OPTIONS: MeshOptions = {
  linearDeflection: 0.035,
  angularDeflection: 0.25,
};

/**
 * Chooses tessellation settings for an OCCT shape.
 * OpenCASCADE.js commonly exposes shape-level meshing but not stable per-face
 * remeshing controls. M39 therefore tightens the whole shape when curved or
 * blended faces are detected, preserving the old deflection for planar parts.
 */
function meshOptionsForShape(oc: OC, shape: unknown): MeshOptions {
  return shapeHasCurvedOrFilletFaces(oc, shape)
    ? DETAILED_MESH_OPTIONS
    : DEFAULT_MESH_OPTIONS;
}

/**
 * Builds the mesh data required by the current operation.
 */
export function meshShapeWithOptions(
  oc: OC,
  shape: unknown,
  options = meshOptionsForShape(oc, shape),
): void {
  cleanExistingTriangulation(oc, shape);
  const mesher = new oc.BRepMesh_IncrementalMesh_2(
    shape,
    options.linearDeflection,
    false,
    options.angularDeflection,
    false,
  );
  const meshRange = new oc.Message_ProgressRange_1();
  mesher.Perform_1(meshRange);
  meshRange.delete();
  mesher.delete();
}

/**
 * Handles clean existing triangulation in the mesh flow.
 */
function cleanExistingTriangulation(oc: OC, shape: unknown): void {
  try {
    const tools = oc.BRepTools;
    const clean = tools?.Clean_1 ?? tools?.Clean;
    clean?.call(tools, shape);
  } catch {
    // Some OpenCASCADE.js builds omit BRepTools.Clean; meshing still works.
  }
}

/**
 * Returns the shape data required by the current operation.
 */
function shapeHasCurvedOrFilletFaces(oc: OC, shape: unknown): boolean {
  const explorer = new oc.TopExp_Explorer_2(
    shape,
    oc.TopAbs_ShapeEnum.TopAbs_FACE,
    oc.TopAbs_ShapeEnum.TopAbs_SHAPE,
  );
  try {
    while (explorer.More()) {
      const face = oc.TopoDS.Face_1(explorer.Current());
      if (isCurvedFace(oc, face) || isLikelyFilletFace(face)) return true;
      explorer.Next();
    }
  } finally {
    explorer.delete?.();
  }
  return false;
}

/**
 * Returns whether the input meets the `curved face` condition.
 */
function isCurvedFace(oc: OC, face: unknown): boolean {
  const BRepAdaptorSurface = oc.BRepAdaptor_Surface_2 ?? oc.BRepAdaptor_Surface;
  if (typeof BRepAdaptorSurface !== 'function') return false;
  let adaptor: OC | null = null;
  try {
    adaptor = new BRepAdaptorSurface(face, true);
    const type = adaptor.GetType?.();
    const plane = oc.GeomAbs_SurfaceType?.GeomAbs_Plane ?? oc.GeomAbs_Plane;
    return type !== undefined && type !== plane;
  } catch {
    return false;
  } finally {
    adaptor?.delete?.();
  }
}

/**
 * Returns whether the input meets the `likely fillet face` condition.
 */
function isLikelyFilletFace(face: unknown): boolean {
  return Boolean((face as { _isFilletFace?: boolean })?._isFilletFace);
}
