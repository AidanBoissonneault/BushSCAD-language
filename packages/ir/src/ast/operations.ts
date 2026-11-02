/**
 * @author Aidan Boissonneault
 * @file operations.ts
 * @purpose Provides operations behavior for the ast in IR package.
 * @last-edited October 6, 2026
 */

import type { ASTSourceSpan } from './sourceSpan.js';
import type { Expr, FaceRef, RepeatableSpatialRef } from './expressions.js';
import type { SketchPrimitive } from './sketchPrimitives.js';
import type { SurfaceOperation } from './surface.js';
import type { SolidPrimitiveOp } from './solidPrimitives.js';

/** Solid creation and boolean operation parsed from an obj declaration. */
export type ObjectOperation =
  | ExtrudeOp
  | CutOp
  | SolidCutOp
  | RevolveOp
  | RadialExtrudeOp
  | RadialCutOp
  | LoftOp
  | HoleOp
  | HeatsetInsertOp
  | SweepOp
  | SweepCutOp
  | ThickenOp
  | SolidPrimitiveOp;

/**
 * Input for sketch is tagged by kind: 'namedSketch' carries name, 'namedSketchBody' carries
 * sketch name, body name, 'sketchBodyList' carries sketch name, body names, 'inlineSketch'
 * carries primitive, and 'sketchList' carries items.
 */
export type SketchInput =
  | { kind: 'namedSketch'; name: string; span: ASTSourceSpan }
  | {
      kind: 'namedSketchBody';
      sketchName: string;
      bodyName: string;
      span: ASTSourceSpan;
    }
  | {
      kind: 'sketchBodyList';
      sketchName: string;
      bodyNames: string[];
      span: ASTSourceSpan;
    }
  | { kind: 'inlineSketch'; primitive: SketchPrimitive; span: ASTSourceSpan }
  | { kind: 'sketchList'; items: SketchInput[]; span: ASTSourceSpan };

/**
 * Input for object is tagged by kind: 'namedObject' carries name and 'inlineObject' carries
 * operation.
 */
export type ObjectInput =
  | { kind: 'namedObject'; name: string; span: ASTSourceSpan }
  | { kind: 'inlineObject'; operation: ObjectOperation; span: ASTSourceSpan };

/**
 * Input for path is tagged by kind: 'namedPath' carries name and 'inlinePath' carries primitive.
 */
export type PathInput =
  | { kind: 'namedPath'; name: string; span: ASTSourceSpan }
  | { kind: 'inlinePath'; primitive: PathPrimitive; span: ASTSourceSpan };

/**
 * Input for surface is tagged by kind: 'namedSurface' carries name and 'inlineSurface' carries
 * operation.
 */
export type SurfaceInput =
  | { kind: 'namedSurface'; name: string; span: ASTSourceSpan }
  | { kind: 'inlineSurface'; operation: SurfaceOperation; span: ASTSourceSpan };

/**
 * Target for through accepts { kind: 'namedThrough'; name: string; span: ASTSou, { kind:
 * 'inferredThrough'; span: ASTSourceSpan }, and null.
 */
export type ThroughTarget =
  | { kind: 'namedThrough'; name: string; span: ASTSourceSpan }
  | { kind: 'inferredThrough'; span: ASTSourceSpan }
  | null;

/**
 * Accepted values for hardware spec kind are 'clearance', 'tap', 'counterbore', 'countersink',
 * 'heatset_insert', and 'pilot'.
 */
export type HardwareSpecKind =
  | 'clearance'
  | 'tap'
  | 'counterbore'
  | 'countersink'
  | 'heatset_insert'
  | 'pilot';

/**
 * Hardware spec ref, including size, spec kind, and span.
 */
export type HardwareSpecRef = {
  size: string;
  specKind: HardwareSpecKind;
  span: ASTSourceSpan;
};

/**
 * Hole op, including operation kind, spec, through, depth, and from.
 */
export type HoleOp = {
  kind: 'hole';
  spec: HardwareSpecRef;
  through: ThroughTarget;
  depth: Expr | null;
  from: RepeatableSpatialRef | null;
  span: ASTSourceSpan;
};

/**
 * Heatset insert op, including operation kind, size, depth, from, and span.
 */
export type HeatsetInsertOp = {
  kind: 'heatset_insert';
  size: string;
  depth: Expr | null;
  from: RepeatableSpatialRef | null;
  span: ASTSourceSpan;
};

/**
 * Extrude op, including operation kind, sketch, depth, from, and symmetric.
 */
export type ExtrudeOp = {
  kind: 'extrude';
  sketch: SketchInput;
  depth: Expr;
  from: RepeatableSpatialRef | null;
  symmetric: boolean;
  wrap: boolean;
  span: ASTSourceSpan;
};

/**
 * Cut op, including operation kind, sketch, through, depth, and from.
 */
export type CutOp = {
  kind: 'cut';
  sketch: SketchInput;
  through: ThroughTarget;
  depth: Expr | null;
  from: RepeatableSpatialRef | null;
  wrap: boolean;
  span: ASTSourceSpan;
};

/**
 * Solid cut tool is tagged by kind: 'object' carries object and 'operation' carries operation.
 */
export type SolidCutTool =
  | { kind: 'object'; object: ObjectInput; span: ASTSourceSpan }
  | {
      kind: 'operation';
      operation: ExtrudeOp | RevolveOp | LoftOp | SweepOp | ThickenOp;
      span: ASTSourceSpan;
    };

/**
 * Solid cut op, including operation kind, tool, from, and span.
 */
export type SolidCutOp = {
  kind: 'solid_cut';
  tool: SolidCutTool;
  from: RepeatableSpatialRef;
  span: ASTSourceSpan;
};

/**
 * Revolve axis ref accepts 'x', 'y', 'z', and FaceRef.
 */
export type RevolveAxisRef = 'x' | 'y' | 'z' | FaceRef;

/**
 * Revolve op, including operation kind, sketch, angle, around, and radius.
 */
export type RevolveOp = {
  kind: 'revolve';
  sketch: SketchInput;
  angle: Expr;
  around: RevolveAxisRef;
  radius?: Expr;
  span: ASTSourceSpan;
};

/**
 * Accepted values for radial curve kind are 'natural', 'linear', 'ease', 'ease-in', 'ease-out',
 * 'ease-in-out', 'step-start', and 'step-end'.
 */
export type RadialCurveKind =
  | 'natural'
  | 'linear'
  | 'ease'
  | 'ease-in'
  | 'ease-out'
  | 'ease-in-out'
  | 'step-start'
  | 'step-end';

/**
 * Radial curve accepts { kind: RadialCurveKind; span: ASTSourceSpan } and { kind:
 * 'cubic-bezier'; x1: Expr; y1: Expr; x2: Ex.
 */
export type RadialCurve =
  | { kind: RadialCurveKind; span: ASTSourceSpan }
  | {
      kind: 'cubic-bezier';
      x1: Expr;
      y1: Expr;
      x2: Expr;
      y2: Expr;
      span: ASTSourceSpan;
    };

/**
 * Accepted values for radial direction are 'ccw' and 'cw'.
 */
export type RadialDirection = 'ccw' | 'cw';

/**
 * Radial extent is tagged by kind: 'angle-length' carries angle, length, 'between' carries a, b,
 * and 'placement-bridge' carries from, to, along.
 */
export type RadialExtent =
  | { kind: 'angle-length'; angle: Expr; length: Expr }
  | { kind: 'between'; a: RepeatableSpatialRef; b: RepeatableSpatialRef }
  | {
      kind: 'placement-bridge';
      from: RepeatableSpatialRef;
      to: RepeatableSpatialRef;
      along: string | null;
    };

/**
 * Radial sections is tagged by kind: 'auto' and 'expr' carries display value.
 */
export type RadialSections = { kind: 'auto' } | { kind: 'expr'; value: Expr };

/**
 * Radial extrude op, including operation kind, sketch, axis, extent, and curve.
 */
export type RadialExtrudeOp = {
  kind: 'radial_extrude';
  sketch: SketchInput;
  axis: RevolveAxisRef | null;
  extent: RadialExtent;
  curve: RadialCurve;
  direction: RadialDirection;
  start: Expr | null;
  twist: Expr | null;
  taper: Expr | null;
  radius: Expr | null;
  sections: RadialSections;
  from: RepeatableSpatialRef | null;
  span: ASTSourceSpan;
};

/**
 * Radial cut op, including operation kind, sketch, axis, extent, and curve.
 */
export type RadialCutOp = {
  kind: 'radial_cut';
  sketch: SketchInput;
  axis: RevolveAxisRef | null;
  extent: RadialExtent;
  curve: RadialCurve;
  direction: RadialDirection;
  start: Expr | null;
  twist: Expr | null;
  taper: Expr | null;
  radius: Expr | null;
  sections: RadialSections;
  from: RepeatableSpatialRef | null;
  span: ASTSourceSpan;
};

/**
 * Loft op, including operation kind, sketches, height, guide, and guide workplane.
 */
export type LoftOp = {
  kind: 'loft';
  sketches: SketchInput[];
  height: Expr;
  guide: SketchInput | null;
  guideWorkplane?: 'XY' | 'XZ' | 'YZ';
  span: ASTSourceSpan;
};

/**
 * Point3 d, including x, y, and z.
 */
export type Point3D = { x: Expr; y: Expr; z: Expr };

/**
 * Primitive for path is tagged by kind: 'polyline' and 'spline'.
 */
export type PathPrimitive =
  | { kind: 'polyline'; points: Point3D[]; span: ASTSourceSpan }
  | { kind: 'spline'; points: Point3D[]; span: ASTSourceSpan };

/**
 * Accepted values for sweep orientation are 'default', 'fixed', and 'binormal'.
 */
export type SweepOrientation = 'default' | 'fixed' | 'binormal';

/**
 * Sweep op, including operation kind, sketch, path, orientation, and span.
 */
export type SweepOp = {
  kind: 'sweep';
  sketch: SketchInput;
  path: PathInput;
  orientation: SweepOrientation;
  span: ASTSourceSpan;
};

/**
 * Sweep cut op, including operation kind, sketch, path, through, and depth.
 */
export type SweepCutOp = {
  kind: 'sweep_cut';
  sketch: SketchInput;
  path: PathInput;
  through: ThroughTarget;
  depth: Expr | null;
  from: RepeatableSpatialRef | null;
  orientation: SweepOrientation;
  span: ASTSourceSpan;
};

/**
 * Thicken op, including operation kind, surface, thickness, and span.
 */
export type ThickenOp = {
  kind: 'thicken';
  surface: SurfaceInput;
  thickness: Expr;
  span: ASTSourceSpan;
};
