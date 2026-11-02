/**
 * @author Aidan Boissonneault
 * @file sketchPathSourceFields.ts
 * @purpose Provides sketch path source fields behavior for the sketch preview in language server package.
 * @last-edited October 6, 2026
 */

import type {
  PathEmbeddedPrimitive,
  PathSketchPrimitive,
  SketchPreviewSourceText,
  SketchPrimitive,
} from '@bushscad/ir';
import { sourceTextForExpression } from './sketchSourceText.js';

/**
 * Defines the `PrimitiveFieldCollector` callback contract used by the sketch preview layer.
 */
type PrimitiveFieldCollector = (
  primitive: SketchPrimitive,
  source: string,
  fields: Record<string, SketchPreviewSourceText>,
  prefix: string,
) => void;

/** Assigns stable shape indexes to compact primitives mixed into a path. */
export function collectPathSketchFields(
  primitive: PathSketchPrimitive,
  source: string,
  fields: Record<string, SketchPreviewSourceText>,
  prefix: string,
  collectPrimitiveFields: PrimitiveFieldCollector,
): void {
  let shapeIndex = 0;
  for (const item of primitive.items) {
    if (item.kind !== 'primitive') continue;
    collectPathPrimitiveFields(
      item.primitive,
      source,
      fields,
      `${prefix}path.${shapeIndex}.`,
      collectPrimitiveFields,
    );
    shapeIndex += 1;
  }
}

/**
 * Records compact path dimensions plus one losslessly reusable local center.
 *
 * Multiple nested `at` wrappers evaluate as a summed translation. Reusing
 * either authored pair alone would move the shape on regeneration, so those
 * centers deliberately fall back to evaluated geometry during import.
 */
function collectPathPrimitiveFields(
  primitive: PathEmbeddedPrimitive,
  source: string,
  fields: Record<string, SketchPreviewSourceText>,
  prefix: string,
  collectPrimitiveFields: PrimitiveFieldCollector,
): void {
  const placement = singlePathPrimitivePlacement(primitive);
  if (placement) {
    fields[`${prefix}center.x`] = sourceTextForExpression(source, placement.x);
    fields[`${prefix}center.y`] = sourceTextForExpression(source, placement.y);
  }
  collectPrimitiveFields(primitive, source, fields, prefix);
}

/** Returns a local placement only when the wrapper chain contains exactly one. */
function singlePathPrimitivePlacement(
  primitive: PathEmbeddedPrimitive,
): Extract<PathEmbeddedPrimitive, { kind: 'sketchAt' }> | undefined {
  return primitive.kind === 'sketchAt' &&
    primitive.primitive.kind !== 'sketchAt'
    ? primitive
    : undefined;
}
