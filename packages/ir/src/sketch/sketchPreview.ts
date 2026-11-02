/**
 * @author Aidan Boissonneault
 * @file sketchPreview.ts
 * @purpose Provides sketch preview behavior for the sketch in IR package.
 * @last-edited October 6, 2026
 */

import type { IRConstraintState, IRPrimitive } from '../shared/ir.js';
import type { WrapMode } from '../ast/sketchPrimitives.js';
import type { EvaluatedWrapOptions, WrapPoint } from '../geometry/wrapTypes.js';

/**
 * Sketch preview bounds, including min x, max x, min y, max y, and width.
 */
export type SketchPreviewBounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  width: number;
  height: number;
};

/**
 * Accepted values for sketch preview detail kind are 'dimension', 'segment', 'status', and
 * 'text'.
 */
export type SketchPreviewDetailKind =
  | 'dimension'
  | 'segment'
  | 'status'
  | 'text';

/**
 * Sketch preview detail, including operation kind, display label, and display value.
 */
export type SketchPreviewDetail = {
  kind: SketchPreviewDetailKind;
  label: string;
  value: string;
};

/**
 * Sketch preview wrap, including point geometry, probe mode, options, and source.
 */
export type SketchPreviewWrap = {
  points: WrapPoint[];
  mode: WrapMode;
  options: EvaluatedWrapOptions;
  source?: {
    pointsExpr?: string;
    options?: Record<string, string>;
  };
};

/** Exact one-based source coordinates used for safe source navigation. */
export type SketchPreviewSourceRange = {
  startLine: number;
  startCol: number;
  endLine: number;
  endCol: number;
};

/** Verbatim source text paired with the range that produced it. */
export type SketchPreviewSourceText = {
  text: string;
  range: SketchPreviewSourceRange;
};

/**
 * Sketch preview source point, including x and y.
 */
export type SketchPreviewSourcePoint = {
  x: SketchPreviewSourceText;
  y: SketchPreviewSourceText;
};

/** Source endpoint coordinates and their authored text for sketch preview editing. */
export type SketchPreviewSourceEndpoint = {
  kind: 'coordinates';
  point: SketchPreviewSourcePoint;
};

/**
 * Sketch preview source segment, including name, operation kind, declaration, from, and to.
 */
export type SketchPreviewSourceSegment = {
  name?: string;
  kind: 'line' | 'arc' | 'close';
  declaration: SketchPreviewSourceText;
  from?: SketchPreviewSourceEndpoint;
  to?: SketchPreviewSourceEndpoint;
  radius?: SketchPreviewSourceText;
};

/**
 * Sketch preview source annotation, including name, operation kind, target, property, and ref.
 */
export type SketchPreviewSourceAnnotation = {
  name?: string;
  kind: string;
  target: string;
  property?: string;
  ref?: string;
  axis?: 'x' | 'y';
  declaration: SketchPreviewSourceText;
  value?: SketchPreviewSourceText;
  label?: SketchPreviewSourcePoint;
  /** Source expression for relative automatic label spacing. */
  offset?: SketchPreviewSourceText;
};

/**
 * Sketch preview source label accepts { kind: 'closed-body' | 'ignored-closed-body'; nam and {
 * kind: 'body-expression' | 'ignored-body-expressi.
 */
export type SketchPreviewSourceLabel =
  | {
      kind: 'closed-body' | 'ignored-closed-body';
      name?: string;
      declaration: SketchPreviewSourceText;
      point: SketchPreviewSourcePoint;
    }
  | {
      kind: 'body-expression' | 'ignored-body-expression';
      name?: string;
      declaration: SketchPreviewSourceText;
      expression: SketchPreviewSourceText;
    };

/**
 * Sketch preview source placement is tagged by kind: 'sketchAt' carries x, y and 'face' carries
 * probe mode, face, angle.
 */
export type SketchPreviewSourcePlacement =
  | {
      kind: 'sketchAt';
      x: SketchPreviewSourceText;
      y: SketchPreviewSourceText;
    }
  | {
      kind: 'face';
      mode: 'from' | 'on';
      face: SketchPreviewSourceText;
      angle?: SketchPreviewSourceText;
    };

/** AST-backed text retained so untouched expressions survive visual edits. */
export type SketchPreviewSourceMetadata = {
  declaration: SketchPreviewSourceText;
  primitiveKind: string;
  fields: Record<string, SketchPreviewSourceText>;
  points: Record<string, SketchPreviewSourcePoint>;
  segments: SketchPreviewSourceSegment[];
  placementOrigin?: SketchPreviewSourcePoint;
  placements: SketchPreviewSourcePlacement[];
  constraints: SketchPreviewSourceAnnotation[];
  dimensions: SketchPreviewSourceAnnotation[];
  labels: SketchPreviewSourceLabel[];
};

/** Whether the visual editor can round-trip the authored source structure. */
export type SketchPreviewEditability =
  | { kind: 'lossless' }
  | { kind: 'conversion-required'; losses: string[] }
  | { kind: 'read-only'; reasons: string[] };

/**
 * Sketch preview model, including name, source line, source column, source file path, and
 * component path.
 */
export type SketchPreviewModel = {
  name: string;
  line: number;
  col: number;
  filePath: string;
  componentPath: string[];
  kind: IRPrimitive['kind'];
  primitive: IRPrimitive;
  bounds: SketchPreviewBounds;
  details: SketchPreviewDetail[];
  isClosed?: boolean;
  instanceCount?: number;
  constraintState?: IRConstraintState;
  wrap?: SketchPreviewWrap;
  editableRange?: SketchPreviewSourceRange;
  source?: SketchPreviewSourceMetadata;
  editability?: SketchPreviewEditability;
};
