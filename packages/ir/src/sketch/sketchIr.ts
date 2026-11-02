/**
 * @author Aidan Boissonneault
 * @file sketchIr.ts
 * @purpose Provides sketch IR behavior for the sketch in IR package.
 * @last-edited October 6, 2026
 */

import type { IRFontRef, SourceSpan } from '../shared/ir.js';
import type { ConstraintKind } from '../ast/sketchAnnotations.js';
import type {
  RectSide,
  RectSideNames,
  WrapMode,
} from '../ast/sketchPrimitives.js';
import { rectangleSideEndpoints } from './rectangleSides.js';

/**
 * State for ir constraint, including status, dof, free names, and residual.
 */
export type IRConstraintState = {
  status: 'fully-constrained' | 'underconstrained' | 'no-convergence';
  dof?: number;
  freeNames?: string[];
  residual?: number;
};

/** Evaluated rectangle geometry plus any authored aliases for its four sides. */
export type IRRectPrimitive = {
  kind: 'rect';
  width: number;
  height: number;
  cornerRadius?: number;
  sideNames?: RectSideNames;
  plant?: RectSide;
  dimensions?: IRSketchDimension[];
};

/** Evaluated compact circle with optional editor-facing dimensions. */
export type IRCirclePrimitive = {
  kind: 'circle';
  diameter: number;
  dimensions?: IRSketchDimension[];
};

/** Evaluated axis-aligned ellipse with editor-facing driving dimensions. */
export type IREllipsePrimitive = {
  kind: 'ellipse';
  width: number;
  height: number;
  dimensions?: IRSketchDimension[];
};

/**
 * Primitive for ir accepts IRRectPrimitive, IRCirclePrimitive, IREllipsePrimitive, { kind:
 * 'roundrect'; width: number; height: number, { kind: 'triangle'; base: number; height: number
 * }, { kind: 'polygon'; points: [number, number][]; pla, { kind: 'profile'; segments:
 * IRProfileSegment[]; c, { kind: 'word'; text: string; size: number; font: , IRSketchBoolean,
 * IRSketchAlias, IRSketchAt, and IRSketchRef.
 */
export type IRPrimitive =
  | IRRectPrimitive
  | IRCirclePrimitive
  | IREllipsePrimitive
  | { kind: 'roundrect'; width: number; height: number; radius: number }
  | { kind: 'triangle'; base: number; height: number }
  | { kind: 'polygon'; points: [number, number][]; plant?: boolean }
  | {
      kind: 'profile';
      segments: IRProfileSegment[];
      closedBodies?: IRClosedBody[];
      bodySelections?: IRProfileBodySelection[];
      dimensions?: IRSketchDimension[];
      constraints?: IRSketchConstraint[];
      constraintState?: IRConstraintState;
      placementOrigin?: [number, number];
      wrap?: IRWrapMetadata;
    }
  | {
      kind: 'word';
      text: string;
      size: number;
      font: IRFontRef;
      align: 'center' | 'left' | 'right';
    }
  | IRSketchBoolean
  | IRSketchAlias
  | IRSketchAt
  | IRSketchRef;

/**
 * Ir sketch boolean, including operation kind, op, left, and right.
 */
export type IRSketchBoolean = {
  kind: 'sketchBoolean';
  op: 'add' | 'subtract';
  left: IRPrimitive;
  right: IRPrimitive;
};

/** Evaluated sketch subtree retaining its authored component namespace. */
export type IRSketchAlias = {
  kind: 'sketchAlias';
  name: string;
  primitive: IRPrimitive;
};

/**
 * Ir sketch at, including operation kind, primitive, x, and y.
 */
export type IRSketchAt = {
  kind: 'sketchAt';
  primitive: IRPrimitive;
  x: number;
  y: number;
};

/**
 * Ir sketch ref, including operation kind and name.
 */
export type IRSketchRef = {
  kind: 'sketchRef';
  name: string;
};

/**
 * Ir profile segment accepts IRLineSegment, IRArcSegment, and IREllipseSegment.
 */
export type IRProfileSegment = IRLineSegment | IRArcSegment | IREllipseSegment;

/**
 * Metadata for ir wrap, including point geometry, probe mode, and options.
 */
export type IRWrapMetadata = {
  points: [number, number][];
  mode: WrapMode;
  options: {
    rounded?: number;
    tension?: number;
    tolerance?: number;
  };
};

/**
 * Ir closed body, including identifier, name, segment names, loop ids, and excluded loop ids.
 */
export type IRClosedBody = {
  id: string;
  name?: string;
  segmentNames: string[];
  loopIds?: string[];
  excludedLoopIds?: string[];
  containsPoint?: [number, number];
  ignored?: boolean;
};

/** Maps a source body-expression name to its selected atomic profile bodies. */
export type IRProfileBodySelection = {
  name: string;
  bodyIds: string[];
};

/**
 * Ir sketch dimension, including name, probe mode, dimension, target, and property.
 */
export type IRSketchDimension = {
  name?: string;
  mode: 'driving' | 'reference';
  dimension: 'length' | 'distance' | 'angle' | 'radius' | 'diameter';
  target: string;
  property: string;
  ref?: string;
  axis?: 'x' | 'y';
  value?: number;
  label?: [number, number];
  /** Relative spacing from the automatically chosen exterior label position. */
  labelOffset?: number;
};

/** Evaluated persistent geometric or dimensional relationship for sketch UIs. */
export type IRSketchConstraint = {
  name?: string;
  constraint: ConstraintKind;
  target: string;
  property?: string;
  ref?: string;
  axis?: 'x' | 'y';
  value?: number;
  label?: [number, number];
  span: SourceSpan;
};

/**
 * Ir line segment, including operation kind, name, from, to, and plant.
 */
export type IRLineSegment = {
  kind: 'line';
  name: string;
  from: [number, number];
  to: [number, number];
  plant?: boolean;
  construction?: boolean;
};

/**
 * Ir arc segment, including operation kind, name, from, to, and radius.
 */
export type IRArcSegment = {
  kind: 'arc';
  name: string;
  from: [number, number];
  to: [number, number];
  radius: number;
  clockwise: boolean;
  construction?: boolean;
};

/** Exact axis-aligned ellipse curve, either a full loop or a trimmed interval. */
export type IREllipseSegment = {
  kind: 'ellipse';
  name: string;
  center: [number, number];
  radiusX: number;
  radiusY: number;
  from: [number, number];
  to: [number, number];
  startAngle: number;
  endAngle: number;
  clockwise: boolean;
  full: boolean;
  construction?: boolean;
};

/**
 * Finds or synthesizes the planted boundary line of a sketch primitive.
 * Compact rectangles do not store four explicit profile segments, while
 * placement and revolve code need the same directed-line anchor contract used
 * by path sketches. Translating through `sketchAt` keeps the returned midpoint
 * in the evaluated sketch's local coordinate system.
 */
export function findPlantLineSegment(prim: IRPrimitive): IRLineSegment | null {
  if (prim.kind === 'profile') {
    return (
      prim.segments.find(
        (seg): seg is IRLineSegment =>
          seg.kind === 'line' && seg.plant === true,
      ) ?? null
    );
  }
  if (prim.kind === 'rect') return plantedRectangleSide(prim);
  if (prim.kind === 'sketchAlias') return findPlantLineSegment(prim.primitive);
  if (prim.kind !== 'sketchAt') return null;
  const segment = findPlantLineSegment(prim.primitive);
  return segment ? translatePlantLine(segment, prim.x, prim.y) : null;
}

/** Builds the canonical counterclockwise edge selected by a compact rectangle. */
function plantedRectangleSide(prim: IRRectPrimitive): IRLineSegment | null {
  if (!prim.plant) return null;
  const [from, to] = rectangleSideEndpoints(
    prim.width,
    prim.height,
    prim.plant,
  );
  return {
    kind: 'line',
    name: prim.sideNames?.[prim.plant] ?? prim.plant,
    from,
    to,
    plant: true,
  };
}

/** Returns a translated copy so nested placement never mutates stored IR. */
function translatePlantLine(
  segment: IRLineSegment,
  x: number,
  y: number,
): IRLineSegment {
  return {
    ...segment,
    from: [segment.from[0] + x, segment.from[1] + y],
    to: [segment.to[0] + x, segment.to[1] + y],
  };
}
