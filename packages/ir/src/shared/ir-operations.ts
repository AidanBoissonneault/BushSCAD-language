/**
 * @author Aidan Boissonneault
 * @file ir-operations.ts
 * @purpose Provides IR operations behavior for the shared in IR package.
 * @last-edited October 6, 2026
 */

import type {
  IRFaceLabel,
  IRParamSpans,
  IRPlacement,
  MaterialAppearance,
  SourceSpan,
  Workplane,
} from './ir-core.js';

/**
 * Ir extrude, including operation kind, obj name, sketch name, closed body names, and depth.
 */
export type IRExtrude = {
  kind: 'extrude';
  objName: string;
  sketchName: string;
  closedBodyNames?: string[];
  depth: number; // resolved in base units, always positive
  from: IRPlacement | null; // null = continue from sketch placement
  symmetric: boolean;
  wrap: boolean;
  material?: MaterialAppearance | null;
  paramSpans?: IRParamSpans;
  span: SourceSpan;
};

/**
 * Ir cut, including operation kind, obj name, sketch name, closed body names, and through.
 */
export type IRCut = {
  kind: 'cut';
  objName: string;
  sketchName: string;
  closedBodyNames?: string[];
  through: boolean;
  throughTarget?: string | null;
  depth: number | null; // null when through:true
  from: IRPlacement;
  wrap: boolean;
  paramSpans?: IRParamSpans;
  span: SourceSpan;
};

/**
 * Ir solid cut tool is tagged by kind: 'object' carries obj name and 'operation' carries
 * operation.
 */
export type IRSolidCutTool =
  | { kind: 'object'; objName: string }
  | {
      kind: 'operation';
      operation:
        | IRExtrude
        | IRRevolve
        | IRLoft
        | IRSweep
        | import('../geometry/surface.js').IRSurfaceThicken;
    };

/**
 * Ir solid cut, including operation kind, obj name, tool, from, and span.
 */
export type IRSolidCut = {
  kind: 'solid_cut';
  objName: string;
  tool: IRSolidCutTool;
  from: IRPlacement;
  span: SourceSpan;
};

/**
 * Ir revolve axis accepts 'x', 'y', 'z', and IRPlacement.
 */
export type IRRevolveAxis = 'x' | 'y' | 'z' | IRPlacement;

/**
 * Ir revolve, including operation kind, obj name, sketch name, angle deg, and around.
 */
export type IRRevolve = {
  kind: 'revolve';
  objName: string;
  sketchName: string;
  angleDeg: number;
  around: IRRevolveAxis;
  radius?: number; // offset from revolve axis; translates profile outward before revolving
  material?: MaterialAppearance | null;
  paramSpans?: IRParamSpans;
  span: SourceSpan;
};

// Sweep parameter t ∈ [0,1] remap. `cubic-bezier` matches CSS spec.
// Radial operation contracts live in radial.ts.

// Extent: either explicit angle+length, OR `between` two faces — resolved by
// OCCT bridge if not eagerly resolvable in the evaluator.
/**
 * Ir loft, including operation kind, obj name, sketch names, height, and guide.
 */
export type IRLoft = {
  kind: 'loft';
  objName: string;
  sketchNames: string[];
  height: number;
  guide: string | null;
  guideWorkplane?: Workplane;
  material?: MaterialAppearance | null;
  span: SourceSpan;
};

/**
 * Ir fillet, including operation kind, target, selection, radius, and param spans.
 */
export type IRFillet = {
  kind: 'fillet';
  target: IRFaceLabel;
  selection?: import('../references/resolved-selection.js').ResolvedSelectionTarget;
  radius: number;
  paramSpans?: IRParamSpans;
  span: SourceSpan;
};

/**
 * Ir chamfer, including operation kind, target, selection, offset, and param spans.
 */
export type IRChamfer = {
  kind: 'chamfer';
  target: IRFaceLabel;
  selection?: import('../references/resolved-selection.js').ResolvedSelectionTarget;
  offset: number;
  paramSpans?: IRParamSpans;
  span: SourceSpan;
};

/**
 * Ir fuse, including operation kind, targets, and span.
 */
export type IRFuse = {
  kind: 'fuse';
  targets: string[];
  span: SourceSpan;
};

/**
 * Ir shell, including operation kind, obj name, thickness, open faces, and param spans.
 */
export type IRShell = {
  kind: 'shell';
  objName: string;
  thickness: number;
  openFaces: string[]; // face names e.g. ['top', 'front']
  paramSpans?: IRParamSpans;
  span: SourceSpan;
};

/**
 * Ir draft, including operation kind, target, selection, angle deg, and param spans.
 */
export type IRDraft = {
  kind: 'draft';
  target: IRFaceLabel;
  selection?: import('../references/resolved-selection.js').ResolvedSelectionTarget;
  angleDeg: number;
  paramSpans?: IRParamSpans;
  span: SourceSpan;
};

/**
 * Ir thread, including operation kind, target, thread type, diameter mm, and pitch mm.
 */
export type IRThread = {
  kind: 'thread';
  target: string;
  threadType: 'external' | 'internal';
  diameterMm: number;
  pitchMm: number;
  axis: IRPlacement | null;
  axialExtentMm: number | null;
  direction: 'regular' | 'clockwise' | 'counter_clockwise';
  threadAngleDeg: number | null;
  span: SourceSpan;
};

/**
 * Ir rotation axis accepts 'x', 'y', 'z', and IRPlacement.
 */
export type IRRotationAxis = 'x' | 'y' | 'z' | IRPlacement;

/**
 * Ir rotate, including operation kind, target, angle deg, around, and span.
 */
export type IRRotate = {
  kind: 'rotate';
  target: string;
  angleDeg: number;
  around: IRRotationAxis;
  span: SourceSpan;
};

/**
 * Ir pattern linear, including operation kind, obj name, count x, count y, and spacing x.
 */
export type IRPatternLinear = {
  kind: 'patternLinear';
  objName: string;
  countX: number;
  countY: number; // 1 if not specified
  spacingX: number; // mm
  spacingY: number; // mm, 0 if not specified
  span: SourceSpan;
};

/**
 * Ir pattern radial, including operation kind, obj name, count, around ref, and span.
 */
export type IRPatternRadial = {
  kind: 'patternRadial';
  objName: string;
  count: number;
  aroundRef: IRFaceLabel; // e.g. "base.top.center"
  span: SourceSpan;
};

/**
 * Ir mirror plane is tagged by kind: 'world' carries axis, 'named' carries name, and 'faceRef'
 * carries ref.
 */
export type IRMirrorPlane =
  | { kind: 'world'; axis: 'x' | 'y' | 'z' }
  | { kind: 'named'; name: string }
  | { kind: 'faceRef'; ref: IRFaceLabel };

/**
 * Ir mirror, including operation kind, obj name, across, and span.
 */
export type IRMirror = {
  kind: 'mirror';
  objName: string;
  across: IRMirrorPlane;
  span: SourceSpan;
};

/**
 * Ir transform op is tagged by kind: 'translate' carries x, y, z, 'rotate' carries angle deg,
 * around, and 'scale' carries factor.
 */
export type IRTransformOp =
  | { kind: 'translate'; x: number; y: number; z: number }
  | { kind: 'rotate'; angleDeg: number; around: IRRotationAxis }
  | { kind: 'scale'; factor: number };

/**
 * Ir transform, including operation kind, obj name, operation, and span.
 */
export type IRTransform = {
  kind: 'transform';
  objName: string;
  operation: IRTransformOp;
  span: SourceSpan;
};

// Marks the start of a new part mesh in the op stream.
/**
 * Ir part boundary, including operation kind, name, color, and span.
 */
export type IRPartBoundary = {
  kind: 'part';
  name: string;
  color: string | null; // hex e.g. '#2563EB', null = auto from palette
  span: SourceSpan;
};

/**
 * Ir path point, including x, y, and z.
 */
export type IRPathPoint = { x: number; y: number; z: number };

/**
 * Primitive for ir path is tagged by kind: 'polyline' and 'spline'.
 */
export type IRPathPrimitive =
  | { kind: 'polyline'; points: IRPathPoint[] }
  | { kind: 'spline'; points: IRPathPoint[] };

/**
 * Ir path, including operation kind, name, primitive, and span.
 */
export type IRPath = {
  kind: 'path';
  name: string;
  primitive: IRPathPrimitive;
  span: SourceSpan;
};

/**
 * Ir sweep, including operation kind, obj name, sketch name, path name, and orientation.
 */
export type IRSweep = {
  kind: 'sweep';
  objName: string;
  sketchName: string;
  pathName: string;
  orientation: 'default' | 'fixed' | 'binormal';
  material?: MaterialAppearance | null;
  span: SourceSpan;
};

/**
 * Ir sweep cut, including operation kind, obj name, sketch name, path name, and through.
 */
export type IRSweepCut = {
  kind: 'sweep_cut';
  objName: string;
  sketchName: string;
  pathName: string;
  through: boolean;
  throughTarget?: string | null;
  depth: number | null;
  from: IRPlacement;
  orientation: 'default' | 'fixed' | 'binormal';
  span: SourceSpan;
};
