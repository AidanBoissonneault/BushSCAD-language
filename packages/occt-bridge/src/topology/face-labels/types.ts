/** Owns face label and selector contracts for the OCCT topology layer. */
import { faceEdgePlaneMetrics } from './selection/selection-resolution.js';
import type { FaceDir, ParsedFaceRef } from '../../core/program-utils.js';
import { type Bounds, type Vec3 } from '../../core/geometry-utils.js';
import { type SourceAttachmentPlane } from '../source-edge-recovery.js';

/**
 * Accepted values for axis are '0', '1', and '2'.
 */
export type Axis = 0 | 1 | 2;

/**
 * boundary represented by readonly [axis: Axis, value: number].
 */
export type Boundary = readonly [axis: Axis, value: number];

/**
 * Face predicate mode, including want planar, want cylindrical, and want largest.
 */
export type FacePredicateMode = {
  wantPlanar: boolean;
  wantCylindrical: boolean;
  wantLargest: boolean;
};

/**
 * Face frame, including x, y, and z.
 */
export interface FaceFrame {
  x: Vec3;
  y: Vec3;
  z: Vec3;
}

/**
 * Entry in face, including dir, qualifier, face, center, and local center.
 */
export interface FaceEntry {
  dir: FaceDir;
  qualifier: 'inner' | 'outer';
  face: unknown; // TopoDS_Face
  center: Vec3;
  localCenter: Vec3;
}

/**
 * Entry in shape, including shape, faces, edge mode, frame, and region bounds.
 */
export interface ShapeEntry {
  shape: unknown; // TopoDS_Shape
  faces: FaceEntry[];
  edgeMode: 'outer' | 'inner' | 'all';
  frame: FaceFrame;
  regionBounds?: Bounds;
  regionLocalBounds?: Bounds;
  regionTag?: unknown;
  regionName?: string;
  regionToolKind?: string;
  source?: SourceShapeEntry;
  attachmentPlane?: SourceAttachmentPlane;
}

/**
 * Entry in source shape, including shape, faces, edge mode, frame, and local bounds.
 */
export interface SourceShapeEntry {
  shape: unknown;
  faces: FaceEntry[];
  edgeMode: 'outer' | 'inner' | 'all';
  frame: FaceFrame;
  localBounds: Bounds;
  attachmentPlane?: SourceAttachmentPlane;
}

/**
 * Axis base resolution, including ax2, entry, face dir, parsed, and apply transforms.
 */
export type AxisBaseResolution = {
  ax2: unknown;
  entry: ShapeEntry | null;
  faceDir: FaceDir | null;
  parsed: ParsedFaceRef;
  applyTransforms: boolean;
};

/**
 * Type used for measurements for face edge plane.
 */
export type FaceEdgePlaneMetrics = ReturnType<typeof faceEdgePlaneMetrics>;

/**
 * Defines the `NamedFaceEdgeMatcher` callback contract used by the topology layer.
 */
export type NamedFaceEdgeMatcher = (
  dir: FaceDir,
  metrics: FaceEdgePlaneMetrics,
) => boolean;
