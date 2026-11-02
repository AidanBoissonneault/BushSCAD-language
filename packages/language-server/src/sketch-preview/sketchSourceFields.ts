/**
 * @author Aidan Boissonneault
 * @file sketchSourceFields.ts
 * @purpose Provides sketch source fields behavior for the sketch preview in language server package.
 * @last-edited October 6, 2026
 */

import type {
  ASTSourceSpan,
  Expr,
  SketchDecl,
  SketchPlacement,
  SketchPreviewSourcePlacement,
  SketchPreviewSourceText,
  SketchPrimitive,
} from '@bushscad/ir';
import {
  sourceTextForExpression,
  sourceTextForSpan,
} from './sketchSourceText.js';
import { collectPathSketchFields } from './sketchPathSourceFields.js';

/** Collects raw scalar fields with stable dotted keys across wrapper nodes. */
export function collectSketchSourceFields(
  primitive: SketchPrimitive,
  source: string,
): Record<string, SketchPreviewSourceText> {
  const fields: Record<string, SketchPreviewSourceText> = {};
  collectPrimitiveFields(primitive, source, fields, '');
  return fields;
}

/** Retains face and `at (x, y)` placement expressions independently of geometry. */
export function collectSketchSourcePlacements(
  sketch: SketchDecl,
  source: string,
): SketchPreviewSourcePlacement[] {
  const placements: SketchPreviewSourcePlacement[] = [];
  if (sketch.placement) {
    placements.push(facePlacement(sketch.placement, source));
  }
  collectSketchAtPlacements(sketch.primitive, source, placements);
  return placements;
}

/**
 * Dispatches field collection across composite and direct primitives.
 *
 * Composite traversal stays separate so adding path members does not inflate
 * the already broad set of scalar primitive cases.
 */
function collectPrimitiveFields(
  primitive: SketchPrimitive,
  source: string,
  fields: Record<string, SketchPreviewSourceText>,
  prefix: string,
): void {
  switch (primitive.kind) {
    case 'pathSketch':
      collectPathSketchFields(
        primitive,
        source,
        fields,
        prefix,
        collectPrimitiveFields,
      );
      break;
    case 'sketchOffset':
      addSourceField(
        fields,
        source,
        `${prefix}offset.distance`,
        primitive.distance,
      );
      collectPrimitiveFields(primitive.primitive, source, fields, prefix);
      break;
    case 'sketchFillet':
      addSourceField(
        fields,
        source,
        `${prefix}fillet.radius`,
        primitive.radius,
      );
      collectPrimitiveFields(primitive.primitive, source, fields, prefix);
      break;
    case 'sketchAt':
    case 'sketchConstruction':
    case 'sketchAlias':
      collectPrimitiveFields(primitive.primitive, source, fields, prefix);
      break;
    case 'sketchBoolean':
      collectPrimitiveFields(primitive.left, source, fields, `${prefix}left.`);
      collectPrimitiveFields(
        primitive.right,
        source,
        fields,
        `${prefix}right.`,
      );
      break;
    default:
      collectDirectPrimitiveFields(primitive, source, fields, prefix);
  }
}

/**
 * Defines the `SourceFieldAdder` callback contract used by the sketch preview layer.
 */
type SourceFieldAdder = (
  name: string,
  expression?: Expr,
  placeholder?: ASTSourceSpan,
) => void;

/** Routes a primitive through small field families with one shared key writer. */
function collectDirectPrimitiveFields(
  primitive: SketchPrimitive,
  source: string,
  fields: Record<string, SketchPreviewSourceText>,
  prefix: string,
): void {
  /**
   * Adds to its owning collection.
   */
  const add = (
    name: string,
    expression?: Expr,
    placeholder?: ASTSourceSpan,
  ): void =>
    addSourceField(fields, source, `${prefix}${name}`, expression, placeholder);
  collectSizedPrimitiveFields(primitive, add);
  collectPointPrimitiveFields(primitive, add);
  collectTextPrimitiveFields(primitive, add);
}

/** Collects dimensions owned by the standard closed sketch primitives. */
function collectSizedPrimitiveFields(
  primitive: SketchPrimitive,
  add: SourceFieldAdder,
): void {
  switch (primitive.kind) {
    case 'rect':
      add('width', primitive.width, placeholder(primitive, 'width'));
      add('height', primitive.height, placeholder(primitive, 'height'));
      add('cornerRadius', primitive.cornerRadius);
      break;
    case 'circle':
      add('diameter', primitive.diameter, placeholder(primitive, 'diameter'));
      break;
    case 'ellipse':
      add('width', primitive.width, placeholder(primitive, 'width'));
      add('height', primitive.height, placeholder(primitive, 'height'));
      break;
    case 'roundrect':
      add('width', primitive.width, placeholder(primitive, 'width'));
      add('height', primitive.height, placeholder(primitive, 'height'));
      add('radius', primitive.radius, placeholder(primitive, 'radius'));
      break;
    case 'triangle':
      add('base', primitive.base);
      add('height', primitive.height);
      break;
  }
}

/**
 * Handles placeholder in the sketch preview flow.
 */
function placeholder(
  primitive: SketchPrimitive,
  parameter: 'width' | 'height' | 'radius' | 'diameter',
): ASTSourceSpan | undefined {
  return 'dimensionPlaceholders' in primitive
    ? primitive.dimensionPlaceholders?.[parameter]
    : undefined;
}

/** Collects coordinate-list and option fields from point-driven primitives. */
function collectPointPrimitiveFields(
  primitive: SketchPrimitive,
  add: SourceFieldAdder,
): void {
  switch (primitive.kind) {
    case 'polygon':
    case 'splineSketch':
      primitive.points.forEach((point, index) => {
        add(`points.${index}.x`, point[0]);
        add(`points.${index}.y`, point[1]);
      });
      break;
    case 'wrapSketch':
      add('points', primitive.points);
      primitive.options.forEach((option) =>
        add(`options.${option.name}`, option.value),
      );
      break;
  }
}

/** Collects user-facing text and inset scalar fields. */
function collectTextPrimitiveFields(
  primitive: SketchPrimitive,
  add: SourceFieldAdder,
): void {
  switch (primitive.kind) {
    case 'word':
      add('text', primitive.text);
      add('size', primitive.size);
      add('font', primitive.font);
      break;
    case 'inset':
      add('all', primitive.all);
      add('x', primitive.x);
      add('y', primitive.y);
      add('top', primitive.top);
      add('bottom', primitive.bottom);
      add('sides', primitive.sides);
      break;
  }
}

/** Stores one source expression when the primitive supplies that field. */
function addSourceField(
  fields: Record<string, SketchPreviewSourceText>,
  source: string,
  key: string,
  expression?: Expr,
  placeholder?: ASTSourceSpan,
): void {
  if (placeholder) {
    fields[key] = sourceTextForSpan(source, placeholder);
  } else if (expression) {
    fields[key] = sourceTextForExpression(source, expression);
  }
}

/** Walks nested sketch geometry while retaining every authored `at` wrapper. */
function collectSketchAtPlacements(
  primitive: SketchPrimitive,
  source: string,
  placements: SketchPreviewSourcePlacement[],
): void {
  if (primitive.kind === 'sketchAt') {
    placements.push({
      kind: 'sketchAt',
      x: sourceTextForExpression(source, primitive.x),
      y: sourceTextForExpression(source, primitive.y),
    });
  }
  for (const child of nestedSketchPrimitives(primitive)) {
    collectSketchAtPlacements(child, source, placements);
  }
}

/** Returns only geometry-bearing children that can contain nested placement. */
function nestedSketchPrimitives(primitive: SketchPrimitive): SketchPrimitive[] {
  switch (primitive.kind) {
    case 'sketchAt':
    case 'sketchConstruction':
    case 'sketchOffset':
    case 'sketchFillet':
    case 'sketchAlias':
      return [primitive.primitive];
    case 'sketchBoolean':
      return [primitive.left, primitive.right];
    case 'pathSketch':
      return primitive.items.flatMap((item) =>
        item.kind === 'primitive' ? [item.primitive] : [],
      );
    default:
      return [];
  }
}

/**
 * Resolves the face data required by the current selector.
 */
function facePlacement(
  placement: SketchPlacement,
  source: string,
): SketchPreviewSourcePlacement {
  return {
    kind: 'face',
    mode: placement.mode,
    face: sourceTextForSpan(source, placement.face.span),
    angle: placement.angle
      ? sourceTextForExpression(source, placement.angle)
      : undefined,
  };
}
