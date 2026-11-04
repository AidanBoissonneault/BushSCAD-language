/**
 * @author Aidan Boissonneault
 * @file ir.ts
 * @purpose Provides IR behavior for the shared in IR package.
 * @last-edited October 6, 2026
 */

// Sketch primitives

export type {
  IRArcSegment,
  IRClosedBody,
  IRConstraintState,
  IREllipsePrimitive,
  IREllipseSegment,
  IRLineSegment,
  IRPrimitive,
  IRProfileSegment,
  IRProfileBodySelection,
  IRRectPrimitive,
  IRSketchAt,
  IRSketchBoolean,
  IRSketchDimension,
  IRSketchConstraint,
  IRSketchRef,
  IRWrapMetadata,
} from '../sketch/sketchIr.js';

export { findPlantLineSegment } from '../sketch/sketchIr.js';
export { rectangleSideEndpoints } from '../sketch/rectangleSides.js';

export type {
  IRRadialCurve,
  IRRadialCut,
  IRRadialDirection,
  IRRadialExtent,
  IRRadialExtrude,
} from '../geometry/radial.js';

import type { IRRadialCut, IRRadialExtrude } from '../geometry/radial.js';

export type {
  IRSolidPrimitive,
  IRSolidPrimitiveShape,
} from '../geometry/solidPrimitives.js';

import type { IRSolidPrimitive } from '../geometry/solidPrimitives.js';

export type {
  IRSurfaceFill,
  IRSurfaceOffset,
  IRSurfaceOp,
  IRSurfaceThicken,
} from '../geometry/surface.js';

export * from './ir-core.js';

export * from './ir-operations.js';

export * from './ir-domain.js';

import type {
  IRSketch,
  MaterialAppearance,
  SourceSpan,
  Workplane,
} from './ir-core.js';

import type {
  IRChamfer,
  IRCut,
  IRDraft,
  IRExtrude,
  IRFillet,
  IRFuse,
  IRLoft,
  IRMirror,
  IRPartBoundary,
  IRPath,
  IRPatternLinear,
  IRPatternRadial,
  IRRevolve,
  IRRotate,
  IRShell,
  IRSolidCut,
  IRSweep,
  IRSweepCut,
  IRThread,
  IRTransform,
} from './ir-operations.js';

import type {
  IRAlignShape,
  IRAssert,
  IRDeclareShape,
  IRDefeature,
  IRFit,
  IRHardwareVisual,
  IRHeal,
  IRImportShape,
  IRJoint,
  IRRef,
} from './ir-domain.js';

/**
 * Ir op accepts IRSketch, IRExtrude, IRCut, IRSolidCut, IRRevolve, IRRadialExtrude, IRRadialCut,
 * IRLoft, IRFillet, IRChamfer, IRFuse, IRShell, IRDraft, IRThread, IRRotate, IRPatternLinear,
 * IRPatternRadial, IRMirror, IRTransform, IRPartBoundary, IRPath, IRSweep, IRSweepCut, IRFit,
 * IRAssert, IRHardwareVisual, IRJoint, IRImportShape, IRHeal, IRDefeature, IRRef,
 * IRDeclareShape, IRAlignShape, IRSolidPrimitive, and
 * import('../geometry/surface.js').IRSurfaceOp.
 */
export type IROp =
  | IRSketch
  | IRExtrude
  | IRCut
  | IRSolidCut
  | IRRevolve
  | IRRadialExtrude
  | IRRadialCut
  | IRLoft
  | IRFillet
  | IRChamfer
  | IRFuse
  | IRShell
  | IRDraft
  | IRThread
  | IRRotate
  | IRPatternLinear
  | IRPatternRadial
  | IRMirror
  | IRTransform
  | IRPartBoundary
  | IRPath
  | IRSweep
  | IRSweepCut
  | IRFit
  | IRAssert
  | IRHardwareVisual
  | IRJoint
  | IRImportShape
  | IRHeal
  | IRDefeature
  | IRRef
  | IRDeclareShape
  | IRAlignShape
  | IRSolidPrimitive
  | import('../geometry/surface.js').IRSurfaceOp;

/**
 * Ir program, including ops, parts, base unit mm, workplane, and interaction.
 */
export type IRProgram = {
  ops: IROp[];
  parts: string[]; // part names in declaration order
  baseUnitMm: number; // conversion factor: 1 base unit → mm
  workplane?: Workplane; // default starting sketch plane for unplaced sketches
  /** Present on evaluated programs; optional for direct bridge/test fixtures. */
  interaction?: import('../metadata/interaction-provenance.js').InteractionSnapshot;
};

// OCCT bridge output

/**
 * Mesh data, including part name, body name, color, uses default color, and material.
 */
export type MeshData = {
  partName: string;
  bodyName?: string; // IR-level body name; set when mesh maps to a single named body
  color: string; // hex, auto-assigned if not explicit
  usesDefaultColor?: boolean; // renderer may theme auto-assigned colors only
  material?: MaterialAppearance;
  isOpenSurface?: boolean;
  vertices: Float32Array;
  normals: Float32Array;
  indices: Uint32Array;
  isHardwareVisual?: boolean;
  hardwareKind?: 'bolt' | 'insert';
};

/**
 * Occt error, including message and span.
 */
export type OcctError = {
  message: string;
  span: SourceSpan;
};

/**
 * Accepted values for export format are 'step' and 'stl'.
 */
export type ExportFormat = 'step' | 'stl';
