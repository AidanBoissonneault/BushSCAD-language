/**
 * @author Aidan Boissonneault
 * @file parse-sketch.ts
 * @purpose Parses sketch for the sketch in parser package.
 * @last-edited October 6, 2026
 */

import type { SketchDecl, SketchPlacement } from '@bushscad/ir';
import type { Parser } from '../core/parser.js';
import { parseSketchExpression } from './parse-sketch-expression.js';
import { parseSketchPlant } from './parse-sketch-plant.js';
import { parseCompactSketchDimensions } from './parse-compact-sketch-dimensions.js';

/**
 * Parses sketch from the supplied source into the sketch representation.
 */
export function parseSketch(p: Parser): SketchDecl {
  const start = p.peek().span;
  p.advance(); // SKETCH
  const nameToken = p.expect('IDENT');
  const name = nameToken.value;
  p.expect('ASSIGN');
  const primitive = parseSketchExpression(p);
  parseSketchPlant(p, primitive);

  const placement: SketchPlacement | undefined =
    'placement' in primitive ? primitive.placement : undefined;
  if ('placement' in primitive) delete primitive.placement;

  p.eatSemi();
  parseCompactSketchDimensions(p, name, primitive);
  return {
    kind: 'sketch',
    name,
    nameSpan: nameToken.span,
    primitive,
    placement,
    span: p.spanFrom(start),
  };
}
