/**
 * @author Aidan Boissonneault
 * @file parse-sketch-plant.ts
 * @purpose Parses sketch plant for the sketch in parser package.
 * @last-edited October 6, 2026
 */

import type { RectPrimitive, RectSide, SketchPrimitive } from '@bushscad/ir';
import type { Parser } from '../core/parser.js';

const RECT_SIDES = new Set<RectSide>(['bottom', 'right', 'top', 'left']);

/**
 * Parses the declaration-level plant qualifier for compact sketches.
 * Polygon's legacy bare `plant` and a rectangle's selected planted side share
 * one suffix position after the complete sketch expression. Keeping that rule
 * here prevents `plant` from acquiring ambiguous precedence inside Boolean
 * sketch algebra.
 */
export function parseSketchPlant(p: Parser, primitive: SketchPrimitive): void {
  if (!p.eat('PLANT')) return;
  if (primitive.kind === 'polygon') {
    primitive.plant = true;
    return;
  }

  const rectangle = plantedRectangle(primitive);
  if (!rectangle) {
    p.addError(
      'plant can only follow polygon sketches or select a rectangle side',
      primitive.span,
    );
    p.eat('IDENT');
    return;
  }

  if (!p.check('IDENT')) {
    p.addError(
      'Rectangle plant requires one of: bottom, right, top, left',
      p.peek().span,
    );
    if (!p.check('SEMICOLON', 'EOF')) p.advance();
    return;
  }
  const target = p.advance();
  if (!isRectSide(target.value)) {
    p.addError(
      `Invalid rectangle plant side '${target.value}'. Expected: bottom, right, top, left`,
      target.span,
    );
    return;
  }
  rectangle.plant = target.value;
}

/** Finds the rectangle beneath local `at` translations, if one exists. */
function plantedRectangle(
  primitive: SketchPrimitive,
): RectPrimitive | undefined {
  if (primitive.kind === 'rect') return primitive;
  return primitive.kind === 'sketchAt'
    ? plantedRectangle(primitive.primitive)
    : undefined;
}

/**
 * Returns whether the input meets the `rect side` condition.
 */
function isRectSide(value: string): value is RectSide {
  return RECT_SIDES.has(value as RectSide);
}
