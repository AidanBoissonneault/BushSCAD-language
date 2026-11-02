/**
 * @author Aidan Boissonneault
 * @file sketchPreviewEditability.ts
 * @purpose Provides sketch preview editability behavior for the sketch preview in language server package.
 * @last-edited October 6, 2026
 */

import type {
  SketchDecl,
  SketchPreviewEditability,
  SketchPrimitive,
} from '@bushscad/ir';

/** Classifies whether visual edits can retain the authored sketch structure. */
export function sketchPreviewEditability(
  sketch: SketchDecl,
  instanceCount: number,
): SketchPreviewEditability {
  if (instanceCount > 1) {
    return {
      kind: 'read-only',
      reasons: [
        `This declaration emitted ${instanceCount} sketch instances, so one source range cannot identify a unique editable instance.`,
      ],
    };
  }
  if (sketch.placement) {
    return {
      kind: 'read-only',
      reasons: [
        `Face placement '${sketch.placement.mode}' must remain source-authored until visual face-placement editing is available.`,
      ],
    };
  }
  if (!hasEditableSketchPlacements(sketch.primitive)) {
    return {
      kind: 'read-only',
      reasons: [
        'Nested sketch placements cannot yet be rewritten without flattening their parameter expressions.',
      ],
    };
  }
  const reasons = readOnlyReasons(sketch.primitive);
  if (reasons.length > 0) return { kind: 'read-only', reasons };
  const losses = conversionLosses(sketch.primitive);
  return losses.length > 0
    ? { kind: 'conversion-required', losses }
    : { kind: 'lossless' };
}

/**
 * Accepts ordinary single placements plus canonical inline primitive algebra.
 * Generated rectangle/circle/ellipse algebra positions each leaf independently and
 * may also place the complete expression once. Other repeated placements
 * remain ambiguous to the visual editor and must stay read-only.
 */
function hasEditableSketchPlacements(primitive: SketchPrimitive): boolean {
  return isCanonicalInlineBoolean(primitive) || sketchAtCount(primitive) <= 1;
}

/**
 * Returns whether the input meets the `canonical inline boolean` condition.
 */
function isCanonicalInlineBoolean(primitive: SketchPrimitive): boolean {
  const expression = unwrapPlacementAndAlias(primitive);
  return (
    expression.kind === 'sketchBoolean' && isCanonicalBooleanTree(expression)
  );
}

/**
 * Returns whether the input meets the `canonical boolean tree` condition.
 */
function isCanonicalBooleanTree(primitive: SketchPrimitive): boolean {
  if (primitive.kind === 'sketchBoolean') {
    return (
      isCanonicalBooleanTree(primitive.left) &&
      isCanonicalBooleanTree(primitive.right)
    );
  }
  const leaf = unwrapPlacementAndAlias(primitive);
  return (
    (leaf.kind === 'rect' ||
      leaf.kind === 'circle' ||
      leaf.kind === 'ellipse') &&
    leaf.origin !== 'corner'
  );
}

/**
 * Handles sketch at count in the sketch preview flow.
 */
function sketchAtCount(primitive: SketchPrimitive): number {
  if (primitive.kind === 'sketchAt') {
    return 1 + sketchAtCount(primitive.primitive);
  }
  if (
    primitive.kind === 'sketchConstruction' ||
    primitive.kind === 'sketchOffset' ||
    primitive.kind === 'sketchFillet' ||
    primitive.kind === 'sketchAlias'
  ) {
    return sketchAtCount(primitive.primitive);
  }
  if (primitive.kind === 'sketchBoolean') {
    return sketchAtCount(primitive.left) + sketchAtCount(primitive.right);
  }
  return 0;
}

/**
 * Reads only reasons from the supplied source.
 */
function readOnlyReasons(primitive: SketchPrimitive): string[] {
  const wrapped = wrappedSketchPrimitive(primitive);
  return wrapped ? readOnlyReasons(wrapped) : directReadOnlyReasons(primitive);
}

/** Returns the authored child of wrappers whose editability is inherited. */
function wrappedSketchPrimitive(
  primitive: SketchPrimitive,
): SketchPrimitive | null {
  switch (primitive.kind) {
    case 'sketchAt':
    case 'sketchConstruction':
    case 'sketchOffset':
    case 'sketchFillet':
    case 'sketchAlias':
      return primitive.primitive;
    default:
      return null;
  }
}

/** Reports source constructs that the visual editor cannot safely rewrite. */
function directReadOnlyReasons(primitive: SketchPrimitive): string[] {
  switch (primitive.kind) {
    case 'sketchRef':
      return [
        `Sketch reference '${primitive.name}' is derived from another declaration and cannot be rewritten at this use site.`,
      ];
    case 'sketchBoolean':
      return isCanonicalBooleanTree(primitive)
        ? []
        : [
            'Boolean sketch operands are derived geometry; edit their source sketches instead.',
          ];
    case 'unsupportedSketch':
      return [
        `The '${primitive.operation}' sketch operation is not editable in this milestone.`,
      ];
    case 'splineSketch':
      return ['Spline editing is scheduled for the advanced-curves milestone.'];
    case 'pathSketch':
      return pathBodyExpressionReasons(primitive);
    default:
      return [];
  }
}

/** Keeps body-expression rewrite limits distinct from ordinary path editing. */
function pathBodyExpressionReasons(
  primitive: Extract<SketchPrimitive, { kind: 'pathSketch' }>,
): string[] {
  const reasons: string[] = [];
  if (primitive.bodyExpressions.length > 0) {
    reasons.push(
      'Feature-based path body expressions are preserved in source and make this sketch read-only.',
    );
  }
  if (primitive.ignoredBodyExpressions.length > 0) {
    reasons.push(
      'Feature-based path ignore expressions are preserved in source and make this sketch read-only.',
    );
  }
  return reasons;
}

/**
 * Handles conversion losses in the sketch preview flow.
 */
function conversionLosses(primitive: SketchPrimitive): string[] {
  if ('origin' in primitive && primitive.origin === 'corner') {
    return [
      'Corner-origin placement will be baked into an explicit numeric offset, so later parameter changes will no longer re-anchor that corner.',
    ];
  }
  switch (primitive.kind) {
    case 'inset':
      return [
        'The context-derived inset will be baked into explicit rectangle dimensions.',
      ];
    case 'sketchConstruction':
      return [
        'The construction wrapper will be expanded into per-curve construction flags.',
        ...conversionLosses(primitive.primitive),
      ];
    case 'sketchOffset':
      return [
        'The associative sketch offset will be baked into authored curves.',
        ...conversionLosses(primitive.primitive),
      ];
    case 'sketchFillet':
      return [
        'The associative sketch fillet will be baked into authored curves.',
        ...conversionLosses(primitive.primitive),
      ];
    case 'sketchAt':
    case 'sketchAlias':
      return conversionLosses(primitive.primitive);
    default:
      return [];
  }
}

/**
 * Handles unwrap placement and alias in the sketch preview flow.
 */
function unwrapPlacementAndAlias(primitive: SketchPrimitive): SketchPrimitive {
  if (primitive.kind === 'sketchAlias') {
    return unwrapPlacementAndAlias(primitive.primitive);
  }
  return primitive.kind === 'sketchAt'
    ? unwrapAliases(primitive.primitive)
    : primitive;
}

/**
 * Handles unwrap aliases in the sketch preview flow.
 */
function unwrapAliases(primitive: SketchPrimitive): SketchPrimitive {
  return primitive.kind === 'sketchAlias'
    ? unwrapAliases(primitive.primitive)
    : primitive;
}
