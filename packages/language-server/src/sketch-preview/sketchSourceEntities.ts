/**
 * @author Aidan Boissonneault
 * @file sketchSourceEntities.ts
 * @purpose Provides sketch source entities behavior for the sketch preview in language server package.
 * @last-edited October 6, 2026
 */

import type {
  ConstraintDecl,
  CompactSketchDimensionDecl,
  Expr,
  PathPrimitiveItem,
  PathSegmentItem,
  PathSketchPrimitive,
  SketchDimensionDecl,
  SketchPreviewSourceAnnotation,
  SketchPreviewSourceEndpoint,
  SketchPreviewSourceLabel,
  SketchPreviewSourcePoint,
  SketchPreviewSourceSegment,
} from '@bushscad/ir';
import {
  compactPathItemSegmentNames,
  compactDimensionPrimitives,
  unwrapTransparentSketchPrimitive,
} from '@bushscad/ir';
import {
  sourcePoint,
  sourceTextForExpression,
  sourceTextForSpan,
} from './sketchSourceText.js';

/**
 * Sketch source entities, including point geometry, segments, placement origin, constraints, and
 * dimensions.
 */
export type SketchSourceEntities = {
  points: Record<string, SketchPreviewSourcePoint>;
  segments: SketchPreviewSourceSegment[];
  placementOrigin?: SketchPreviewSourcePoint;
  constraints: SketchPreviewSourceAnnotation[];
  dimensions: SketchPreviewSourceAnnotation[];
  labels: SketchPreviewSourceLabel[];
};

/** Collects expression-bearing authored entities from path syntax. */
export function collectSketchSourceEntities(
  primitive: import('@bushscad/ir').SketchPrimitive,
  source: string,
): SketchSourceEntities {
  const base: SketchSourceEntities = {
    points: {},
    segments: [],
    constraints: [],
    dimensions: [],
    labels: [],
  };
  const inner = unwrapTransparentSketchPrimitive(primitive);
  if (inner.kind === 'pathSketch') return pathEntities(inner, source);
  const compactDimensions = compactDimensionPrimitives(inner).flatMap(
    (owner) => owner.compactDimensions ?? [],
  );
  if (compactDimensions.length > 0) {
    return {
      ...base,
      constraints: compactDimensions.map((item) =>
        compactDimensionSource(item, source),
      ),
    };
  }
  return base;
}

/**
 * Handles embedded compact dimensions in the sketch preview flow.
 */
function embeddedCompactDimensions(
  primitive: PathPrimitiveItem['primitive'],
): CompactSketchDimensionDecl[] {
  return primitive.kind === 'sketchAt'
    ? embeddedCompactDimensions(primitive.primitive)
    : (primitive.compactDimensions ?? []);
}

/**
 * Builds the path data required by the current operation.
 */
function pathEntities(
  primitive: PathSketchPrimitive,
  source: string,
): SketchSourceEntities {
  const itemNames = compactPathItemSegmentNames(primitive.items);
  return {
    points: {},
    segments: primitive.items.flatMap((item, index) =>
      item.kind === 'segment'
        ? [pathSegmentSource(item, itemNames[index][0], source)]
        : pathPrimitiveSources(item, itemNames[index], source),
    ),
    placementOrigin: primitive.placementOrigin
      ? sourcePoint(source, primitive.placementOrigin)
      : undefined,
    constraints: [
      ...primitive.constraints.map((item) => constraintSource(item, source)),
      ...primitive.items.flatMap((item) =>
        item.kind === 'primitive'
          ? embeddedCompactDimensions(item.primitive).map((dimension) =>
              compactDimensionSource(dimension, source),
            )
          : [],
      ),
    ],
    dimensions: primitive.dimensions.map((item) =>
      dimensionSource(item, source),
    ),
    labels: [
      ...primitive.closedBodies.map((item) => ({
        kind: 'closed-body' as const,
        name: item.name,
        declaration: sourceTextForSpan(source, item.span),
        point: sourcePoint(source, item.point),
      })),
      ...primitive.ignoredClosedBodies.map((item) => ({
        kind: 'ignored-closed-body' as const,
        declaration: sourceTextForSpan(source, item.span),
        point: sourcePoint(source, item.point),
      })),
      ...primitive.bodyExpressions.map((item) => ({
        kind: 'body-expression' as const,
        name: item.name,
        declaration: sourceTextForSpan(source, item.span),
        expression: sourceTextForSpan(source, item.expression.span),
      })),
      ...primitive.ignoredBodyExpressions.map((item) => ({
        kind: 'ignored-body-expression' as const,
        declaration: sourceTextForSpan(source, item.span),
        expression: sourceTextForSpan(source, item.expression.span),
      })),
    ],
  };
}

/**
 * Builds the path data required by the current operation.
 */
function pathSegmentSource(
  item: PathSegmentItem,
  name: string,
  source: string,
): SketchPreviewSourceSegment {
  const segment = item.segment;
  return {
    name,
    kind: segment.kind,
    declaration: sourceTextForSpan(source, item.span),
    from:
      segment.kind !== 'close' && segment.start
        ? endpointSource(segment.start, source)
        : undefined,
    to:
      segment.kind !== 'close'
        ? endpointSource(segment.end, source)
        : undefined,
    radius:
      segment.kind === 'arc' && segment.radius
        ? sourceTextForExpression(source, segment.radius)
        : undefined,
  };
}

/**
 * Builds the path data required by the current operation.
 */
function pathPrimitiveSources(
  item: PathPrimitiveItem,
  names: string[],
  source: string,
): SketchPreviewSourceSegment[] {
  const primitive = unwrapPathPlacement(item.primitive);
  const kinds: SketchPreviewSourceSegment['kind'][] =
    primitive.kind === 'rect'
      ? ['line', 'line', 'line', 'line']
      : ['arc', 'arc', 'arc', 'arc', 'line'];
  return kinds.map((kind, index) => ({
    name: names[index],
    kind,
    declaration: sourceTextForSpan(source, item.span),
  }));
}

/**
 * Handles unwrap path placement in the sketch preview flow.
 */
function unwrapPathPlacement(
  primitive: PathPrimitiveItem['primitive'],
): Exclude<PathPrimitiveItem['primitive'], { kind: 'sketchAt' }> {
  return primitive.kind === 'sketchAt'
    ? unwrapPathPlacement(primitive.primitive)
    : primitive;
}

/**
 * Handles endpoint source in the sketch preview flow.
 */
function endpointSource(
  point: [Expr, Expr],
  source: string,
): SketchPreviewSourceEndpoint {
  return { kind: 'coordinates', point: sourcePoint(source, point) };
}

/**
 * Handles constraint source in the sketch preview flow.
 */
function constraintSource(
  item: ConstraintDecl,
  source: string,
): SketchPreviewSourceAnnotation {
  return {
    name: item.name,
    kind: item.constraint,
    target: item.target,
    property: item.property,
    ref: item.ref,
    axis: item.axis,
    declaration: sourceTextForSpan(source, item.span),
    value: item.value ? sourceTextForExpression(source, item.value) : undefined,
    label: item.label ? sourcePoint(source, item.label) : undefined,
  };
}

/**
 * Builds the dimension data required by the current drawing.
 */
function dimensionSource(
  item: SketchDimensionDecl,
  source: string,
): SketchPreviewSourceAnnotation {
  return {
    name: item.name,
    kind: item.dimension,
    target: item.target,
    property: item.property,
    ref: item.ref,
    axis: item.axis,
    declaration: sourceTextForSpan(source, item.span),
    label: sourcePoint(source, item.label),
  };
}

/**
 * Compacts dimension source while preserving its values.
 */
function compactDimensionSource(
  item: CompactSketchDimensionDecl,
  source: string,
): SketchPreviewSourceAnnotation {
  return {
    name: item.name,
    kind: item.dimension,
    target: item.target,
    property: item.property,
    ref: item.ref,
    axis: item.axis,
    declaration: sourceTextForSpan(source, item.span),
    value: sourceTextForExpression(source, item.value),
    offset: item.offset
      ? sourceTextForExpression(source, item.offset)
      : undefined,
  };
}
