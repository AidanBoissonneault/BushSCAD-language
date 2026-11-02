/**
 * @author Aidan Boissonneault
 * @file sketchPrimitiveTraversal.ts
 * @purpose Provides sketch primitive traversal behavior for the ast in IR package.
 * @last-edited October 6, 2026
 */

import type { SketchPrimitive } from './sketchPrimitives.js';

/** Closed primitives that own deferred scalar dimension assignments. */
export type CompactDimensionPrimitive = Extract<
  SketchPrimitive,
  { kind: 'rect' | 'circle' | 'ellipse' | 'roundrect' }
>;

/**
 * Unwraps sketch modifiers that preserve the authored primitive's members.
 * Source-aware features should see path labels through placement and transparent
 * unary modifiers without treating boolean or reference sketches as equivalent.
 */
export function unwrapTransparentSketchPrimitive(
  primitive: SketchPrimitive,
): SketchPrimitive {
  if (
    primitive.kind === 'sketchAt' ||
    primitive.kind === 'sketchConstruction' ||
    primitive.kind === 'sketchOffset' ||
    primitive.kind === 'sketchFillet'
  ) {
    return unwrapTransparentSketchPrimitive(primitive.primitive);
  }
  return primitive;
}

/** Finds the sole compact primitive eligible to own trailing dimensions. */
export function soleCompactDimensionPrimitive(
  primitive: SketchPrimitive,
): CompactDimensionPrimitive | null {
  const primitives = compactDimensionPrimitives(primitive);
  return primitives.length === 1 ? primitives[0] : null;
}

/** Collects compact dimension owners through placement, Boolean, and path nodes. */
export function compactDimensionPrimitives(
  primitive: SketchPrimitive,
): CompactDimensionPrimitive[] {
  if (primitive.kind === 'sketchAt') {
    return compactDimensionPrimitives(primitive.primitive);
  }
  if (primitive.kind === 'sketchBoolean') {
    return [
      ...compactDimensionPrimitives(primitive.left),
      ...compactDimensionPrimitives(primitive.right),
    ];
  }
  if (primitive.kind === 'pathSketch') {
    return primitive.items.flatMap((item) =>
      item.kind === 'primitive'
        ? compactDimensionPrimitives(item.primitive)
        : [],
    );
  }
  return ['rect', 'circle', 'ellipse', 'roundrect'].includes(primitive.kind)
    ? [primitive as CompactDimensionPrimitive]
    : [];
}

/** Tests one primitive-local side or scalar name used by compact dimensions. */
export function compactDimensionPrimitiveOwnsReference(
  primitive: CompactDimensionPrimitive,
  reference: string,
): boolean {
  if (primitive.kind === 'circle') {
    return ['diameter', 'radius'].includes(reference);
  }
  if (primitive.kind === 'ellipse') {
    return ['width', 'height'].includes(reference);
  }
  if (primitive.kind === 'roundrect' && reference === 'radius') return true;
  if (primitive.kind !== 'rect' && primitive.kind !== 'roundrect') return false;
  return (['bottom', 'right', 'top', 'left'] as const).some(
    (side) =>
      reference === side ||
      (primitive.kind === 'rect' && primitive.sideNames?.[side] === reference),
  );
}
